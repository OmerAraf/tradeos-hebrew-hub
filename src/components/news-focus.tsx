import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, RefreshCw, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchTranslatedNewsForSymbol,
  type TranslatedNewsItem,
} from "@/lib/news.functions";
import { relativeTimeHe } from "@/lib/relative-time-he";
import { GlassCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { useRefreshHandler } from "@/lib/refresh";
import { useTrades } from "@/lib/use-trades";
import { isOpen } from "@/lib/trade-types";
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


/** Chips row: "הכל" + union of watchlist symbols and open-position symbols. */
export function NewsSymbolChips({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (symbol: string | null) => void;
}) {
  const trades = useTrades();
  const [watchSymbols, setWatchSymbols] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("watchlist").select("symbol");
      if (!alive) return;
      setWatchSymbols((data ?? []).map((r) => String(r.symbol).toUpperCase()));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { muted, mute, unmute } = useMutedSymbols();

  const symbols = useMemo(() => {
    const set = new Set<string>(watchSymbols);
    for (const t of trades) if (isOpen(t)) set.add(t.symbol.toUpperCase());
    for (const m of muted) set.delete(m.toUpperCase());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [watchSymbols, trades, muted]);


  function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    const s = query.trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(s)) return;
    onSelect(s);
    setQuery("");
  }

  async function confirmRemove() {
    const sym = pendingRemove;
    setPendingRemove(null);
    if (!sym) return;
    try {
      await mute(sym);
      if (selected === sym) onSelect(null);
      toast.success(`${sym} הוסר מהחדשות`, {
        action: {
          label: "בטל",
          onClick: () => {
            void unmute(sym).catch(() => toast.error("ההחזרה נכשלה"));
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההסרה נכשלה");
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="-mx-1 flex-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max flex-nowrap items-center gap-2">
            <Chip active={selected === null} onClick={() => onSelect(null)}>
              הכל
            </Chip>
            {symbols.map((s) => (
              <Chip
                key={s}
                active={selected === s}
                onClick={() => onSelect(s)}
                onLongPress={() => setPendingRemove(s)}
              >
                <span dir="ltr">{s}</span>
              </Chip>
            ))}
          </div>
        </div>
        <form onSubmit={submitQuery} className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="סימבול אחר…"
              maxLength={10}
              aria-label="חיפוש סימבול"
              className="glass min-h-11 w-40 rounded-xl border border-white/10 bg-transparent py-2 pr-8 pl-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
            />
          </div>
        </form>
      </div>

      {symbols.length > 0 && muted.length === 0 && (
        <p className="text-xs text-muted-foreground">
          לחיצה ארוכה על סימבול מסירה אותו מהחדשות
        </p>
      )}

      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{`להסיר את ${pendingRemove ?? ""} מהחדשות?`}</AlertDialogTitle>
            <AlertDialogDescription>
              לא תקבל יותר עדכוני חדשות על הסימבול הזה. אפשר להחזיר בכל רגע מהרשימה בתחתית המסך.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">ביטול</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={confirmRemove}>
              הסר
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 12;

function Chip({
  active,
  onClick,
  onLongPress,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [pressing, setPressing] = useState(false);

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    setPressing(false);
  }

  function trigger() {
    timer.current = null;
    fired.current = true;
    setPressing(false);
    navigator.vibrate?.(40);
    onLongPress?.();
  }

  useEffect(() => clear, []);

  return (
    <button
      type="button"
      style={{ touchAction: "pan-x" }}
      onClick={(e) => {
        if (fired.current) {
          e.preventDefault();
          return;
        }
        onClick();
      }}
      onPointerDown={(e) => {
        if (!onLongPress) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* pointer capture unsupported */
        }
        setPressing(true);
        timer.current = setTimeout(trigger, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        if (!timer.current || !start.current) return;
        const d = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
        if (d > MOVE_TOLERANCE_PX) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onKeyDown={(e) => {
        if (!onLongPress) return;
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          clear();
          onLongPress();
        }
      }}
      onContextMenu={(e) => {
        if (!onLongPress) return;
        e.preventDefault();
        if (fired.current) return;
        clear();
        trigger();
      }}
      aria-pressed={active}
      aria-keyshortcuts={onLongPress ? "Delete" : undefined}
      className={`flex min-h-11 select-none touch-manipulation items-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-all duration-500 [-webkit-touch-callout:none] [-webkit-user-select:none] ${
        pressing ? "scale-95 opacity-80 ring-2 ring-neon/60" : ""
      } ${
        active
          ? "neon-border bg-primary/20 text-neon"

          : "glass border border-white/10 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}


/** Focus mode: all available news for one symbol. */
export function NewsFocusPanel({
  symbol,
  onBack,
}: {
  symbol: string;
  onBack: () => void;
}) {
  const fetchOne = useServerFn(fetchTranslatedNewsForSymbol);
  const [items, setItems] = useState<TranslatedNewsItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchOne({ data: { symbol } });
      const sorted = [...res.items].sort(
        (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
      );
      setItems(sorted);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה לא ידועה");
      setItems(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useRefreshHandler(async () => {
    await load();
  });

  return (
    <GlassCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-widest text-neon" dir="ltr">
              {symbol}
            </span>
            <span className="text-sm font-semibold">חדשות</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            כל הכותרות הזמינות עבור הסימבול, מהחדש לישן
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          <Button variant="ghost" size="sm" onClick={onBack} className="min-h-11">
            חזרה לכל החדשות
            <ArrowRight className="ms-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {items === null && loading ? (
        <ul className="divide-y divide-white/5">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="py-3">
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
              </div>
            </li>
          ))}
        </ul>
      ) : err ? (
        <div className="py-6 text-center">
          <p className="text-sm text-loss">טעינת החדשות נכשלה</p>
          <p className="mt-1 text-xs text-muted-foreground">{err}</p>
          <Button variant="ghost" size="sm" className="mt-3 min-h-11" onClick={load}>
            נסה שוב
          </Button>
        </div>
      ) : !items || items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          לא נמצאו חדשות עבור {symbol}
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((it) => (
            <li key={it.link} className="py-3">
              <a
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 rounded-lg p-1.5 transition hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded bg-neon/15 px-1.5 py-0.5 text-[10px] font-semibold text-neon"
                      dir="ltr"
                    >
                      {it.symbol}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {relativeTimeHe(it.publishedAt)} · {it.source}
                    </span>
                  </div>
                  <div className="mt-1 text-base text-foreground group-hover:text-neon">
                    {it.titleHe}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground/70" dir="ltr">
                    {it.titleEn}
                  </div>
                </div>
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 transition group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
