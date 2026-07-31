export interface DeepNewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO
}

const cache = new Map<string, { at: number; items: DeepNewsItem[] }>();
const TTL = 3 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function pickTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function parseRss(xml: string, fallbackSource: string): DeepNewsItem[] {
  const items: DeepNewsItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = pickTag(block, "title");
    const link = pickTag(block, "link");
    const pub = pickTag(block, "pubDate");
    const src = pickTag(block, "source") || fallbackSource;
    if (!title || !link) continue;
    const publishedAt = pub ? new Date(pub).toISOString() : new Date().toISOString();
    items.push({ title, link, source: src, publishedAt });
  }
  return items;
}

async function fetchText(url: string, ms = 9000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), ms);
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { "user-agent": "Mozilla/5.0 TradeOS/1.0" },
    });
    clearTimeout(to);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Deep per-symbol news: Yahoo Finance RSS (full feed, not trimmed) plus a
 * Google News query for the ticker, which reaches further back in time.
 */
export async function fetchDeepNewsForSymbol(symbol: string): Promise<DeepNewsItem[]> {
  const now = Date.now();
  const hit = cache.get(symbol);
  if (hit && now - hit.at < TTL) return hit.items;

  const [yahoo, google] = await Promise.all([
    fetchText(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`,
    ),
    fetchText(
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${symbol} stock`)}&hl=en-US&gl=US&ceid=US:en`,
    ),
  ]);

  const items = [
    ...(yahoo ? parseRss(yahoo, "Yahoo Finance") : []),
    ...(google ? parseRss(google, "Google News") : []),
  ];

  if (!items.length) return hit ? hit.items : [];
  cache.set(symbol, { at: now, items });
  return items;
}
