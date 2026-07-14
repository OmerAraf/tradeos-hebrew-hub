import { createServerFn } from "@tanstack/react-start";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO
}

export interface TranslatedNewsItem {
  symbol: string;
  titleHe: string;
  titleEn: string;
  link: string;
  source: string;
  publishedAt: string;
}

// Per-worker caches
const rssCache = new Map<string, { at: number; items: NewsItem[] }>();
const RSS_TTL = 3 * 60 * 1000; // 3 minutes
const translationCache = new Map<string, string>(); // key: link, value: Hebrew title

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

async function fetchYahooForSymbol(symbol: string): Promise<NewsItem[]> {
  const now = Date.now();
  const hit = rssCache.get(symbol);
  if (hit && now - hit.at < RSS_TTL) return hit.items;
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  const xml = await fetchWithTimeout(url);
  if (!xml) {
    if (hit) return hit.items; // stale is better than nothing
    return [];
  }
  const items = parseRss(xml, "Yahoo Finance").slice(0, 8);
  rssCache.set(symbol, { at: now, items });
  return items;
}

async function translateBatch(titles: { id: string; text: string }[]): Promise<Record<string, string>> {
  if (!titles.length) return {};
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return {};
  const prompt =
    'Translate each of the following English financial news headlines to natural, concise Hebrew. Preserve stock tickers, product names, and numbers as-is (do not translate them). Return a JSON object of the shape {"translations":{"<id>":"<hebrew>", ...}} covering every id. Input JSON:\n' +
    JSON.stringify({ items: titles });
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a professional financial-news translator. You translate English headlines to Hebrew and respond only with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return {};
    const parsed = JSON.parse(content) as { translations?: Record<string, string> };
    return parsed.translations ?? {};
  } catch {
    return {};
  }
}

export const fetchNewsForSymbol = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => {
    const symbol = String(d?.symbol || "").trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) throw new Error("invalid symbol");
    return { symbol };
  })
  .handler(async ({ data }) => {
    const items = await fetchYahooForSymbol(data.symbol);
    const seen = new Set<string>();
    const merged: NewsItem[] = [];
    for (const item of items) {
      const nk = normalizeTitle(item.title).slice(0, 60);
      if (!nk || seen.has(nk)) continue;
      seen.add(nk);
      merged.push(item);
    }
    merged.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    return { items: merged.slice(0, 5) };
  });

export const fetchTranslatedNewsForSymbols = createServerFn({ method: "GET" })
  .inputValidator((d: { symbols: string[] }) => {
    const raw = Array.isArray(d?.symbols) ? d.symbols : [];
    const symbols = Array.from(
      new Set(
        raw
          .map((s) => String(s || "").trim().toUpperCase())
          .filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s)),
      ),
    ).slice(0, 12);
    return { symbols };
  })
  .handler(async ({ data }) => {
    if (data.symbols.length === 0) return { items: [] as TranslatedNewsItem[] };

    // Fetch RSS for every symbol in parallel
    const raw = await Promise.all(
      data.symbols.map(async (symbol) => ({
        symbol,
        items: await fetchYahooForSymbol(symbol),
      })),
    );

    // Merge, dedupe by link (fallback to normalized title)
    const byKey = new Map<string, { symbol: string; item: NewsItem }>();
    for (const { symbol, items } of raw) {
      for (const item of items.slice(0, 4)) {
        const key = item.link || normalizeTitle(item.title).slice(0, 80);
        if (!key || byKey.has(key)) continue;
        byKey.set(key, { symbol, item });
      }
    }

    const merged = Array.from(byKey.values()).sort(
      (a, b) => +new Date(b.item.publishedAt) - +new Date(a.item.publishedAt),
    );

    // Trim to a reasonable size for one Lovable AI call
    const trimmed = merged.slice(0, 24);

    // Translate what isn't cached
    const missing = trimmed.filter((x) => !translationCache.has(x.item.link));
    if (missing.length) {
      const map = await translateBatch(
        missing.map((x, i) => ({ id: `n${i}`, text: x.item.title })),
      );
      missing.forEach((x, i) => {
        const heb = map[`n${i}`];
        if (heb && heb.trim()) translationCache.set(x.item.link, heb.trim());
      });
    }

    const out: TranslatedNewsItem[] = trimmed.map(({ symbol, item }) => ({
      symbol,
      titleEn: item.title,
      titleHe: translationCache.get(item.link) || item.title,
      link: item.link,
      source: item.source,
      publishedAt: item.publishedAt,
    }));

    return { items: out };
  });
