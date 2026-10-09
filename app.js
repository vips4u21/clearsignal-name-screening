const recent=[];
let currentFilter='all', currentResults=[], searchedName='';
let lastSearchAt=0;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function formatDate(value){const m=String(value||'').match(/^(\d{4})(\d{2})(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:(value||'Date unavailable')}
function showToast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
function drawRecent(){
  $('#recentList').innerHTML=recent.length?recent.slice(0,4).map(r=>`<div class="recent-item"><div class="recent-initial">${esc(r.initial)}</div><div class="recent-info"><b>${esc(r.name)}</b><small>${esc(r.detail)}</small></div><span class="recent-status ${r.kind}">${esc(r.status)}</span><span class="recent-time">${esc(r.time)}</span></div>`).join(''):'<div class="recent-empty">Your searches will appear here during this session.</div>';
}
function drawResults(){
  let items=[...currentResults];
  if(currentFilter==='high')items=items.filter(a=>/(arrest|charged|convict|fraud|brib|corrupt|launder|sanction|embezz|crime|criminal|prosecut|traffick|terror)/i.test(a.title));
  if(currentFilter==='medium')items=items.filter(a=>!/(arrest|charged|convict|fraud|brib|corrupt|launder|sanction|embezz|crime|criminal|prosecut|traffick|terror)/i.test(a.title));
  if($('#sortSelect').value==='recent')items.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('#resultCount').textContent=`${items.length} ${items.length===1?'article':'articles'} · matched name and adverse media terms`;
  if(!items.length){$('#resultList').innerHTML='<div class="empty-state">No articles matched this filter. Try “All results” or another spelling. No matches does not confirm that a person has no adverse media.</div>';return}
  $('#resultList').innerHTML=items.map(a=>`<article class="result-card"><div class="result-symbol">↗</div><div class="result-body"><div class="result-tags"><span class="tag medium">POTENTIAL HIT</span><span class="tag category">${esc(a.language||'News')}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.description||'Search result only. Open the original article to confirm the context, identity and whether the reporting is reliable.')}</p><div class="result-meta"><span>${esc(a.source)}</span><span>•</span><span>${esc(formatDate(a.date))}</span>${a.sourceCountry?`<span>•</span><span>${esc(a.sourceCountry)}</span>`:''}</div></div><div class="result-side"><div><span class="match-label">Review required</span></div>${a.url?`<a class="review-button" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Open article&nbsp; ↗</a>`:''}</div></article>`).join('');
}
async function screen(name){
  searchedName=name.trim(); if(!searchedName)return;
  $('#lowerGrid').hidden=true;$('#resultsSection').hidden=false;$('#resultTitle').innerHTML=`Results for <b>${esc(searchedName)}</b>`;
  currentResults=[];currentFilter='all';
  $('#resultsSection .result-toolbar .filters').hidden=false;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));
  $('#summaryRow').innerHTML='<div class="summary-card"><span class="summary-icon">⌕</span><div><strong>…</strong><small>Searching</small></div></div><div class="summary-card"><span class="summary-icon">◷</span><div><strong>—</strong><small>News source</small></div></div><div class="summary-card"><span class="summary-icon">▤</span><div><strong>—</strong><small>Articles</small></div></div>';
  $('#resultCount').textContent='';$('#resultList').innerHTML='<div class="empty-state">Searching live news sources…</div>';
  const adverseTerms='fraud OR corruption OR bribery OR arrest OR charged OR investigation OR money laundering OR sanction OR criminal OR embezzlement OR lawsuit OR misconduct OR trafficking OR tax evasion';
  const fallbackQuery=`"${searchedName}" (${adverseTerms})`;
  const countryCodes={'United States':['en-US','US','US:en'],'United Kingdom':['en-GB','GB','GB:en'],'India':['en-IN','IN','IN:en'],'Singapore':['en-SG','SG','SG:en'],'United Arab Emirates':['en-AE','AE','AE:en']};
  const [hl,gl,ceid]=countryCodes[$('#countryInput').value]||['en-IN','IN','IN:en'];
  const fallbackUrl=`https://news.google.com/search?q=${encodeURIComponent(fallbackQuery)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  try{
    const response=await fetch(new URL('api/search',window.location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:searchedName,country:$('#countryInput').value})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||`Search service returned ${response.status}.`);
    currentResults=(data.articles||[]).map(a=>({title:a.title||'Untitled article',url:/^https?:\/\//i.test(a.url||'')?a.url:'',source:a.source||data.provider||'News source',date:a.date||'',language:a.language||'News',sourceCountry:a.sourceCountry||'',description:a.description||''}));
    $('#summaryRow').innerHTML=`<div class="summary-card"><span class="summary-icon">↗</span><div><strong>${Number(data.count)||0}</strong><small>Potential mentions</small></div></div><div class="summary-card"><span class="summary-icon">◎</span><div><strong>${esc(data.provider||'News')}</strong><small>News source</small></div></div><div class="summary-card"><span class="summary-icon">▤</span><div><strong>${currentResults.length}</strong><small>Articles returned</small></div></div>`;
    $('#resultCount').textContent=`${currentResults.length} articles returned. A name match is only a lead for review.`;
    if(currentResults.length)drawResults();
    else $('#resultList').innerHTML='<div class="empty-state">No matching articles were returned for this search. This does not confirm that the person has no adverse media.</div>';
    const index=recent.findIndex(r=>r.name.toLowerCase()===searchedName.toLowerCase());if(index>=0)recent.splice(index,1);
    recent.unshift({name:searchedName,detail:$('#countryInput').value?`News search · ${$('#countryInput').value}`:'News search · All regions',status:`${currentResults.length} returned`,time:'Just now',initial:searchedName.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),kind:currentResults.length?'review':'clear'});drawRecent();
  }catch(error){
    currentResults=[];$('#summaryRow').innerHTML='<div class="summary-card"><span class="summary-icon">!</span><div><strong>Unavailable</strong><small>Search status</small></div></div>';
    $('#resultCount').textContent='';
    $('#resultList').innerHTML=`<div class="empty-state"><div>${esc(error.message||'Live news search could not be reached.')}</div><p style="margin:12px 0 8px">You can still run this search directly on Google News. Your name will be sent to Google if you open the link.</p><a class="review-button fallback-link" href="${esc(fallbackUrl)}" target="_blank" rel="noopener noreferrer">Search Google News&nbsp; ↗</a></div>`;
  }
  $('#resultsSection').scrollIntoView({behavior:'smooth',block:'start'});
}
$('#screenForm').addEventListener('submit',e=>{e.preventDefault();screen($('#nameInput').value)});
$('#nameInput').addEventListener('input',()=>{$('#clearInput').style.display=$('#nameInput').value?'block':'none'});
$('#clearInput').addEventListener('click',()=>{$('#nameInput').value='';$('#clearInput').style.display='none';$('#nameInput').focus()});
document.querySelectorAll('.filter-btn').forEach(b=>b.addEventListener('click',()=>{currentFilter=b.dataset.filter;document.querySelectorAll('.filter-btn').forEach(x=>x.classList.toggle('selected',x===b));drawResults()}));
$('#sortSelect').addEventListener('change',drawResults);
$('#historyButton').addEventListener('click',()=>{$('#lowerGrid').hidden=false;$('#lowerGrid').scrollIntoView({behavior:'smooth',block:'center'})});
$('#guideButton').addEventListener('click',()=>showToast('Verify the person, context and original source before escalating a result.'));
drawRecent();
