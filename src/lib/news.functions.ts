import { createServerFn } from "@tanstack/react-start";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO
}

// Simple in-memory cache per worker instance (5-minute TTL)
const cache = new Map<string, { at: number; items: NewsItem[] }>();
const TTL_MS = 5 * 60 * 1000;

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

function parseRss(xml: string, fallbackSource: string): NewsItem[] {
  const items: NewsItem[] = [];
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

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\u0590-\u05ff\s]/g, "").replace(/\s+/g, " ").trim();
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<string | null> {
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

export const fetchNewsForSymbol = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => {
    const symbol = String(d?.symbol || "").trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) throw new Error("invalid symbol");
    return { symbol };
  })
  .handler(async ({ data }) => {
    const key = data.symbol;
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL_MS) return { items: hit.items, cached: true };

    const yahooUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(key)}&region=US&lang=en-US`;
    const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(key + " stock")}&hl=en-US&gl=US&ceid=US:en`;

    const [yahooXml, googleXml] = await Promise.all([
      fetchWithTimeout(yahooUrl),
      fetchWithTimeout(googleUrl),
    ]);

    const yahoo = yahooXml ? parseRss(yahooXml, "Yahoo Finance") : [];
    const google = googleXml ? parseRss(googleXml, "Google News") : [];

    // Merge, dedupe by normalized title prefix
    const seen = new Set<string>();
    const merged: NewsItem[] = [];
    for (const item of [...yahoo, ...google]) {
      const nk = normalizeTitle(item.title).slice(0, 60);
      if (!nk || seen.has(nk)) continue;
      seen.add(nk);
      merged.push(item);
    }
    merged.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    const items = merged.slice(0, 5);
    cache.set(key, { at: now, items });
    return { items, cached: false };
  });
