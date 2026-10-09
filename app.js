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
  $('#resultList').innerHTML=items.map(a=>`<article class="result-card"><div class="result-symbol">↗</div><div class="result-body"><div class="result-tags"><span class="tag medium">NEWS MENTION</span><span class="tag category">${esc(a.language||'News')}</span></div><h3>${esc(a.title)}</h3><p>Search result only. Open the original article to confirm the context, identity and whether the reporting is reliable.</p><div class="result-meta"><span>${esc(a.source)}</span><span>•</span><span>${esc(formatDate(a.date))}</span>${a.sourceCountry?`<span>•</span><span>${esc(a.sourceCountry)}</span>`:''}</div></div><div class="result-side"><div><span class="match-label">Source result</span></div>${a.url?`<a class="review-button" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Open article&nbsp; ↗</a>`:''}</div></article>`).join('');
}
async function screen(name){
  searchedName=name.trim(); if(!searchedName)return;
  const remaining=6000-(Date.now()-lastSearchAt);
  if(remaining>0){
    $('#lowerGrid').hidden=true;$('#resultsSection').hidden=false;$('#resultTitle').innerHTML=`Results for <b>${esc(searchedName)}</b>`;
    $('#resultList').innerHTML=`<div class="empty-state">Please wait ${Math.ceil(remaining/1000)} seconds before searching again. The news source limits request frequency.</div>`;
    $('#resultCount').textContent='';$('#resultsSection').scrollIntoView({behavior:'smooth',block:'start'});return;
  }
  lastSearchAt=Date.now();
  $('#lowerGrid').hidden=true;$('#resultsSection').hidden=false;$('#resultTitle').innerHTML=`Results for <b>${esc(searchedName)}</b>`;
  $('#summaryRow').innerHTML='<div class="summary-card"><span class="summary-icon">⌕</span><div><strong>…</strong><small>Searching</small></div></div><div class="summary-card"><span class="summary-icon">◷</span><div><strong>—</strong><small>Source</small></div></div><div class="summary-card"><span class="summary-icon">▤</span><div><strong>—</strong><small>Articles</small></div></div>';
  $('#resultList').innerHTML='<div class="empty-state">Searching live news coverage…</div>';$('#resultCount').textContent='';
  currentFilter='all';document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));
  const safeName=searchedName.replace(/[^\p{L}\p{M}\p{N}\s.'’-]/gu,' ').replace(/\s+/g,' ').trim();
  const riskTerms=['arrest','charged','convicted','fraud','bribery','corruption','money laundering','sanction','embezzlement','crime','criminal','investigation','prosecuted','lawsuit','misconduct','scandal','terrorism','trafficking','tax evasion'];
  const query=`"${safeName}" (${riskTerms.join(' OR ')})`;
  const countryCodes={'United States':'us','United Kingdom':'uk','India':'in','Singapore':'sn','United Arab Emirates':'ae'};
  const country=countryCodes[$('#countryInput').value];
  const params=new URLSearchParams({query:country?`${query} sourcecountry:${country}`:query,mode:'artlist',format:'json',maxrecords:'50',sort:'datedesc'});
  try{
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
    let response, raw;
    try{response=await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`,{signal:controller.signal});raw=await response.text()}
    finally{clearTimeout(timeout)}
    let data;
    try{data=JSON.parse(raw)}catch{
      if(/please limit requests to one every 5 seconds/i.test(raw||''))throw new Error('GDELT is rate-limiting searches right now. Wait at least 6 seconds and try again.');
      throw new Error('The news provider returned an unreadable response. Please try again shortly.');
    }
    if(!response.ok)throw new Error(data.error||`News provider returned status ${response.status}.`);
    currentResults=(data.articles||[]).map(a=>({title:a.title||'Untitled article',url:/^https?:\/\//i.test(a.url||'')?a.url:'',source:a.domain||'News source',date:a.seendate||'',language:a.language||'',sourceCountry:a.sourcecountry||''}));
    $('#summaryRow').innerHTML=`<div class="summary-card"><span class="summary-icon">↗</span><div><strong>${currentResults.length}</strong><small>Articles found</small></div></div><div class="summary-card"><span class="summary-icon">◎</span><div><strong>GDELT</strong><small>News source</small></div></div><div class="summary-card"><span class="summary-icon">◷</span><div><strong>Live</strong><small>Search run</small></div></div>`;
    drawResults();
    const index=recent.findIndex(r=>r.name.toLowerCase()===searchedName.toLowerCase());if(index>=0)recent.splice(index,1);
    recent.unshift({name:searchedName,detail:$('#countryInput').value?`Name · ${$('#countryInput').value}`:'Name · All regions',status:`${currentResults.length} found`,time:'Just now',initial:searchedName.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),kind:currentResults.length?'review':'clear'});drawRecent();
  }catch(error){currentResults=[];$('#summaryRow').innerHTML='<div class="summary-card"><span class="summary-icon">!</span><div><strong>Unavailable</strong><small>Search status</small></div></div>';$('[data-filter="all"]')?.classList.add('selected');$('#resultCount').textContent='';const message=error.name==='AbortError'?'The live search timed out. Check your internet connection and try again.':error instanceof TypeError?'Could not reach GDELT. Check your internet connection or try opening the app in a regular browser.':error.message;const fallback=`https://news.google.com/search?q=${encodeURIComponent(`"${searchedName}" (fraud OR corruption OR bribery OR arrest OR investigation)`)}&hl=en-IN&gl=IN&ceid=IN:en`;$('#resultList').innerHTML=`<div class="empty-state"><div>${esc(message)}</div><p style="margin:12px 0 8px">You can try the same name search on Google News. The name will be sent to Google if you open this link.</p><a class="review-button fallback-link" href="${esc(fallback)}" target="_blank" rel="noopener noreferrer">Search Google News&nbsp; ↗</a></div>`}
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
