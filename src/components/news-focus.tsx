import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, RefreshCw, ArrowRight, Search, Pencil, Check, X } from "lucide-react";
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
  const [editing, setEditing] = useState(false);

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

  // Exit edit mode automatically once no removable chips remain.
  useEffect(() => {
    if (editing && symbols.length === 0) setEditing(false);
  }, [editing, symbols.length]);

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
        <div className="flex items-center gap-2">
          {symbols.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={editing}
              aria-label={editing ? "סיום עריכה" : "עריכת סימבולים"}
              style={NO_SELECT}
              className={`flex min-h-11 shrink-0 select-none touch-manipulation items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-all duration-300 [-webkit-touch-callout:none] [-webkit-user-select:none] ${
                editing
                  ? "neon-border bg-primary/20 text-neon"
                  : "glass border-white/15 text-muted-foreground hover:text-foreground"
              }`}
            >
              {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              <span style={NO_SELECT}>{editing ? "סיום" : "עריכה"}</span>
            </button>
          )}
          <div className="-mx-1 flex-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max flex-nowrap items-center gap-2">
              <Chip active={selected === null} onClick={() => onSelect(null)}>
                <span style={NO_SELECT}>הכל</span>
              </Chip>
              {symbols.map((s) => (
                <Chip
                  key={s}
                  active={selected === s}
                  onClick={() => onSelect(s)}
                  editing={editing}
                  onRemove={() => setPendingRemove(s)}
                >
                  <span dir="ltr" style={NO_SELECT}>
                    {s}
                  </span>
                </Chip>
              ))}
            </div>
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

      {symbols.length > 0 && !editing && muted.length === 0 && (
        <p className="text-xs text-muted-foreground">
          לחץ על העיפרון כדי להסיר סימבולים מהחדשות
        </p>
      )}
      {editing && (
        <p className="text-xs text-muted-foreground">
          לחץ על ✕ ליד סימבול כדי להסיר אותו מהחדשות
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

function Chip({
  active,
  onClick,
  editing = false,
  onRemove,
  children,
}: {
  active: boolean;
  onClick: () => void;
  editing?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 select-none touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-all duration-300 [-webkit-touch-callout:none] [-webkit-user-select:none] ${
        editing ? "border border-dashed border-white/20 bg-white/5" : ""
      } ${
        active
          ? "neon-border bg-primary/20 text-neon"
          : editing
            ? "text-foreground"
            : "glass border border-white/10 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {editing && onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label="הסר סימבול"
          onClick={(e) => {
            e.stopPropagation();
            navigator.vibrate?.(30);
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-muted-foreground transition hover:bg-loss/20 hover:text-loss"
        >
          <X className="h-3 w-3 animate-pulse" />
        </span>
      )}
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
