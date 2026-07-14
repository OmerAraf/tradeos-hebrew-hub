import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/ui-blocks";
import { AdvancedChart, MiniSymbolOverview, TickerTape } from "@/components/tradingview";
import { addSymbol, fetchWatchlist, removeSymbol, type WatchlistItem } from "@/lib/watchlist-store";
import { fetchNewsForSymbol, type NewsItem } from "@/lib/news.functions";
import { relativeTimeHe } from "@/lib/relative-time-he";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "מעקב — TRADE·OS 2050" },
      { name: "description", content: "רשימת מעקב אחרי מניות עם מחירים בזמן אמת וחדשות" },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[] | null>(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await fetchWatchlist());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה בטעינה");
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!input.trim()) return;
    setBusy(true);
    try {
      await addSymbol(input);
      setInput("");
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה בהוספה");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string, symbol: string) {
    if (expanded === symbol) setExpanded(null);
    await removeSymbol(id);
    await reload();
  }

  const symbols = useMemo(() => items?.map((i) => i.symbol) ?? [], [items]);

  return (
    <div>
      <PageHeader
        title="מעקב"
        subtitle="מחירים בזמן אמת וחדשות עדכניות למניות שאתה עוקב אחריהן"
      />

      <form onSubmit={onAdd} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="הוסף סימבול (למשל AAPL)"
          dir="ltr"
          maxLength={10}
          className="glass w-40 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-neon focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1 rounded-xl neon-border bg-primary/10 px-3 py-2 text-sm font-semibold text-neon transition hover:bg-primary/20 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          הוסף
        </button>
        {err && <span className="text-sm text-loss">{err}</span>}
      </form>

      {items === null ? (
        <GlassCard className="text-center text-muted-foreground">טוען…</GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="text-center text-muted-foreground">
          רשימת המעקב ריקה. הוסף סימבול כדי להתחיל.
        </GlassCard>
      ) : (
        <>
          <div className="mb-4">
            <TickerTape symbols={symbols} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((it) => (
              <WatchlistCard
                key={it.id}
                item={it}
                expanded={expanded === it.symbol}
                onToggle={() => setExpanded(expanded === it.symbol ? null : it.symbol)}
                onRemove={() => onRemove(it.id, it.symbol)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function WatchlistCard({
  item,
  expanded,
  onToggle,
  onRemove,
}: {
  item: WatchlistItem;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black tracking-widest text-neon" dir="ltr">
            {item.symbol}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "סגור" : "הרחב"}
          </button>
          <button
            onClick={onRemove}
            title="הסר"
            className="flex items-center rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-loss/10 hover:text-loss"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button onClick={onToggle} className="block w-full text-right">
        <MiniSymbolOverview symbol={item.symbol} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <AdvancedChart symbol={item.symbol} />
          <NewsPanel symbol={item.symbol} />
        </div>
      )}
    </div>
  );
}

function NewsPanel({ symbol }: { symbol: string }) {
  const call = useServerFn(fetchNewsForSymbol);
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await call({ data: { symbol } });
      setItems(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה בטעינת חדשות");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Re-render for relative time
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="glass rounded-xl border border-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">חדשות</div>
        <button
          onClick={load}
          disabled={loading}
          title="רענן"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-neon disabled:opacity-50"
        >
          <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
          רענן
        </button>
      </div>
      {err ? (
        <div className="flex items-center gap-2 text-xs text-loss">
          <X className="h-4 w-4" />
          {err}
        </div>
      ) : items === null ? (
        <div className="text-xs text-muted-foreground">טוען…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground">לא נמצאו חדשות עדכניות.</div>
      ) : (
        <ul className="space-y-2" data-tick={tick}>
          {items.map((n, i) => (
            <li key={i} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-medium text-foreground hover:text-neon"
              >
                {n.title}
              </a>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{n.source}</span>
                <span>·</span>
                <span>{relativeTimeHe(n.publishedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
