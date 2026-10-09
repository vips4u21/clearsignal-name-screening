const terms = ["fraud", "corruption", "bribery", "arrest", "charged", "investigation", "money laundering", "sanction", "criminal", "embezzlement", "lawsuit", "misconduct", "trafficking", "tax evasion"];
const countries = { "United States": "us", "United Kingdom": "uk", India: "in", Singapore: "sn", "United Arab Emirates": "ae" };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
export async function onRequestPost({ request }) {
  let input;
  try { input = await request.json(); } catch { return reply({ error: "Enter a valid search request." }, 400); }
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 150) return reply({ error: "Enter a name between 2 and 150 characters." }, 400);
  const country = countries[String(input.country || "")];
  const query = '"' + name + '" (' + terms.join(" OR ") + ')' + (country ? " sourcecountry:" + country : "");
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.search = new URLSearchParams({ query, mode: "artlist", format: "json", maxrecords: "50", sort: "datedesc" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.articles)) throw new Error("News provider unavailable");
    const articles = data.articles.filter(a => /^https?:\/\//i.test(a.url || "")).map(a => ({ title: a.title || "Untitled article", url: a.url, source: a.domain || "News source", date: a.seendate || "", language: a.language || "News", sourceCountry: a.sourcecountry || "", description: "" }));
    return reply({ provider: "GDELT", count: articles.length, capped: articles.length >= 50, articles });
  } catch { return reply({ error: "Live news search is temporarily unavailable. Please try again shortly." }, 502); }
  finally { clearTimeout(timer); }
}
