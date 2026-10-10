const terms = ["fraud", "corruption", "bribery", "arrest", "charged", "investigation", "money laundering", "sanction", "criminal", "embezzlement", "lawsuit", "misconduct", "trafficking", "tax evasion"];
const regions = {
  "United States": ["en-US", "US", "US:en"],
  "United Kingdom": ["en-GB", "GB", "GB:en"],
  India: ["en-IN", "IN", "IN:en"],
  Singapore: ["en-SG", "SG", "SG:en"],
  "United Arab Emirates": ["en-AE", "AE", "AE:en"]
};
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
function decodeXml(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
function readTag(item, name) {
  const match = item.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return match ? decodeXml(match[1]).trim() : "";
}
function parseGoogleNews(xml, country) {
  if (!/<rss\b/i.test(xml)) throw new Error("Invalid RSS response");
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, 50);
  const articles = items.map(([, item]) => {
    const rawDescription = readTag(item, "description");
    return {
      title: readTag(item, "title") || "Untitled article",
      url: readTag(item, "link"),
      source: readTag(item, "source") || "Google News",
      date: readTag(item, "pubDate"),
      language: "News",
      sourceCountry: country || "",
      description: rawDescription.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()
    };
  }).filter(article => /^https?:\/\//i.test(article.url));
  return { provider: "Google News", count: articles.length, capped: articles.length >= 50, articles };
}
async function fetchText(url, timeoutMs, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; ClearSignal/1.0; personal screening)" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.text();
  } finally { clearTimeout(timer); }
}
export async function onRequestPost({ request }) {
  let input;
  try { input = await request.json(); } catch { return reply({ error: "Enter a valid search request." }, 400); }
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 150) return reply({ error: "Enter a name between 2 and 150 characters." }, 400);
  const country = String(input.country || "");
  const [hl, gl, ceid] = regions[country] || regions.India;
  const query = '"' + name + '" (' + terms.join(" OR ") + ')';
  const googleUrl = new URL("https://news.google.com/rss/search");
  googleUrl.search = new URLSearchParams({ q: query, hl, gl, ceid });
  let googleError;
  try {
    const xml = await fetchText(googleUrl, 8000, "application/rss+xml, application/xml, text/xml");
    return reply(parseGoogleNews(xml, country));
  } catch (error) { googleError = error; }
  const gdeltUrl = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  gdeltUrl.search = new URLSearchParams({ query, mode: "artlist", format: "json", maxrecords: "50", sort: "datedesc" });
  try {
    const responseText = await fetchText(gdeltUrl, 7000, "application/json");
    const data = JSON.parse(responseText);
    if (!Array.isArray(data.articles)) throw new Error("Invalid response");
    const articles = data.articles.filter(article => /^https?:\/\//i.test(article.url || "")).slice(0, 50).map(article => ({
      title: article.title || "Untitled article", url: article.url, source: article.domain || "News source",
      date: article.seendate || "", language: article.language || "News", sourceCountry: article.sourcecountry || "", description: ""
    }));
    return reply({ provider: "GDELT", count: articles.length, capped: articles.length >= 50, articles });
  } catch (gdeltError) {
    const first = googleError && googleError.name === "AbortError" ? "timeout" : (googleError && googleError.message || "unavailable");
    const second = gdeltError && gdeltError.name === "AbortError" ? "timeout" : (gdeltError && gdeltError.message || "unavailable");
    return reply({ error: "Search providers failed (Google News: " + first + "; GDELT: " + second + ")." }, 502);
  }
}
