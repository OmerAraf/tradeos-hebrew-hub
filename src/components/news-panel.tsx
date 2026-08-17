import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ExternalLink, ArrowLeft, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchTranslatedNewsForSymbols, type TranslatedNewsItem } from "@/lib/news.functions";
import { relativeTimeHe } from "@/lib/relative-time-he";
import { GlassCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useRefreshHandler } from "@/lib/refresh";
import { useMutedSymbols } from "@/lib/news-mute";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const LAST_SEEN_KEY = "tradeos_news_lastseen";
const POLL_MS = 3 * 60 * 1000; // 3 minutes

function readLastSeen(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(LAST_SEEN_KEY);
  const n = raw ? Number(raw) : 0;
  return isFinite(n) ? n : 0;
}

function writeLastSeen(ts: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SEEN_KEY, String(ts));
}

export function NewsPanel({
  variant = "full",
  limit,
}: {
  variant?: "full" | "summary";
  limit?: number;
}) {
  const isSummary = variant === "summary";
  const fetchNews = useServerFn(fetchTranslatedNewsForSymbols);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [items, setItems] = useState<TranslatedNewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastSeenRef = useRef<number>(readLastSeen());
  const [, forceTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("watchlist").select("symbol");
      if (!alive) return;
      const uniq = Array.from(
        new Set((data ?? []).map((r) => String(r.symbol).toUpperCase())),
      );
      setSymbols(uniq);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function load() {
    if (symbols.length === 0) {
      setItems([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchNews({ data: { symbols } });
      setItems((prev) => {
        const seen = new Set<string>();
        const merged: TranslatedNewsItem[] = [];
        for (const it of [...res.items, ...prev]) {
          if (!it.link || seen.has(it.link)) continue;
          seen.add(it.link);
          merged.push(it);
        }
        merged.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
        return merged.slice(0, 60);
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה בטעינת חדשות");
    } finally {
      setLoading(false);
    }
  }

  useRefreshHandler(async () => {
    const { data } = await supabase.from("watchlist").select("symbol");
    const uniq = Array.from(new Set((data ?? []).map((r) => String(r.symbol).toUpperCase())));
    setSymbols(uniq);
    await load();
  });

  useEffect(() => {
    if (symbols.length === 0) return;
    load();
    const iv = setInterval(load, POLL_MS);
    const tick = setInterval(() => forceTick((x) => x + 1), 60_000);
    return () => {
      clearInterval(iv);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  useEffect(() => {
    return () => {
      if (!isSummary && items.length) {
        const newest = Math.max(...items.map((i) => +new Date(i.publishedAt)));
        if (isFinite(newest)) {
          writeLastSeen(newest);
          lastSeenRef.current = newest;
        }
      }
    };
  }, [items, isSummary]);

  const newestTs = useMemo(
    () => (items.length ? Math.max(...items.map((i) => +new Date(i.publishedAt))) : 0),
    [items],
  );

  function markAllSeen() {
    if (newestTs) {
      writeLastSeen(newestTs);
      lastSeenRef.current = newestTs;
      forceTick((x) => x + 1);
    }
  }

  const shown = limit ? items.slice(0, limit) : items;

  return (
    <GlassCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">חדשות חמות</div>
          <div className="text-xs text-muted-foreground truncate">
            {isSummary
              ? `${symbols.length} סימבולים במעקב`
              : `כותרות עדכניות עבור ${symbols.length} סימבולים במעקב, מתורגמות לעברית`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isSummary && newestTs > lastSeenRef.current && (
            <Button variant="ghost" size="sm" onClick={markAllSeen}>
              סמן כנקרא
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            disabled={loading}
            aria-label="רענון חדשות"
            title="רענון"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {symbols.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          אין סימבולים ברשימת המעקב. הוסף מניה במסך "מעקב" כדי לקבל חדשות.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {loading ? "טוען חדשות…" : err ? err : "לא נמצאו חדשות כרגע."}
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {shown.map((it) => {
            const isNew = !isSummary && +new Date(it.publishedAt) > lastSeenRef.current;
            return (
              <li key={it.link} className={isSummary ? "py-2" : "py-3"}>
                <a
                  href={it.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 rounded-lg p-1.5 transition hover:bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded bg-neon/15 px-1.5 py-0.5 text-[10px] font-semibold text-neon"
                        dir="ltr"
                      >
                        {it.symbol}
                      </span>
                      {isNew && (
                        <span className="rounded bg-profit/20 px-1.5 py-0.5 text-[10px] font-semibold text-profit">
                          חדש
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {relativeTimeHe(it.publishedAt)} · {it.source}
                      </span>
                    </div>
                    <div className={`mt-1 ${isSummary ? "text-sm" : "text-base"} text-foreground group-hover:text-neon`}>
                      {it.titleHe}
                    </div>
                    {!isSummary && (
                      <div className="mt-0.5 text-xs text-muted-foreground/70" dir="ltr">
                        {it.titleEn}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 transition group-hover:opacity-100" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {isSummary && (
        <div className="mt-3 border-t border-white/5 pt-3 text-center">
          <Link
            to="/news"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-neon hover:bg-neon/10"
          >
            לכל החדשות
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      )}
    </GlassCard>
  );
}
