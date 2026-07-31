import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/ui-blocks";
import { AdvancedChart, MiniSymbolOverview, TickerTape, TimelineNews } from "@/components/tradingview";
import {
  addSymbol,
  DuplicateSymbolError,
  fetchWatchlist,
  removeSymbol,
  type WatchlistItem,
} from "@/lib/watchlist-store";
import { useRefreshHandler } from "@/lib/refresh";


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

  useRefreshHandler(async () => {
    setItems(await fetchWatchlist());
  });

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
      if (e instanceof DuplicateSymbolError) {
        toast("הסימבול כבר במעקב");
        setInput("");
      } else {
        setErr(e instanceof Error ? e.message : "שגיאה בהוספה");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string, symbol: string) {
    if (expanded === symbol) setExpanded(null);
    await removeSymbol(id);
    await reload();
  }

  const symbols = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const i of items ?? []) {
      const s = i.symbol.toUpperCase();
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }, [items]);


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
          className="flex min-h-11 items-center gap-1 rounded-xl neon-border bg-primary/10 px-4 py-2 text-sm font-semibold text-neon transition hover:bg-primary/20 disabled:opacity-50 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          {busy ? "מוסיף..." : "הוסף"}
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
            aria-expanded={expanded}
            className="flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground active:scale-95"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "סגור" : "הרחב"}
          </button>
          <button
            onClick={onRemove}
            aria-label={`הסר את ${item.symbol} מרשימת המעקב`}
            title="הסר"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-loss/10 hover:text-loss active:scale-95"
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
          <div className="glass rounded-xl border border-white/5 p-3">
            <div className="mb-2 text-sm font-semibold text-foreground">חדשות</div>
            <TimelineNews symbol={item.symbol} />
          </div>
        </div>
      )}
    </div>
  );
}

