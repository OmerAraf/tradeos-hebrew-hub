import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, GlassCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { NewsPanel } from "@/components/news-panel";
import { NewsFocusPanel, NewsSymbolChips } from "@/components/news-focus";
import { useMutedSymbols } from "@/lib/news-mute";

export const Route = createFileRoute("/_authenticated/news")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = String(search.symbol ?? "").trim().toUpperCase();
    return { symbol: /^[A-Z0-9.\-]{1,10}$/.test(raw) ? raw : undefined };
  },
  head: () => ({
    meta: [
      { title: "חדשות חמות — TRADE·OS 2050" },
      { name: "description", content: "פיד חדשות עדכני עבור המניות במעקב, מתורגם לעברית" },
    ],
  }),
  component: NewsPage,
});

function MutedSection() {
  const { muted, unmute } = useMutedSymbols();
  const [open, setOpen] = useState(false);

  if (muted.length === 0) return null;

  return (
    <div className="mt-6">
      <GlassCard>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-right"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            סימבולים מוסתרים ({muted.length})
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <ul className="mt-2 divide-y divide-white/5">
            {muted.map((s) => (
              <li key={s} className="flex min-h-11 items-center justify-between gap-2 py-2">
                <span className="text-sm font-semibold text-foreground" dir="ltr">
                  {s}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-neon hover:bg-neon/10"
                  onClick={() => {
                    void unmute(s)
                      .then(() => toast.success(`חדשות של ${s} הוחזרו`))
                      .catch(() => toast.error("ההחזרה נכשלה"));
                  }}
                >
                  החזר
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function NewsPage() {
  const { symbol } = Route.useSearch();
  const navigate = useNavigate();

  function select(next: string | null) {
    navigate({
      to: "/news",
      search: next ? { symbol: next } : { symbol: undefined },
    });
  }

  return (
    <div>
      <PageHeader
        title="חדשות חמות"
        subtitle="כותרות עדכניות מ־Yahoo Finance עבור המניות שברשימת המעקב"
      />

      <NewsSymbolChips selected={symbol ?? null} onSelect={select} />

      {symbol ? (
        <NewsFocusPanel symbol={symbol} onBack={() => select(null)} />
      ) : (
        <NewsPanel variant="full" />
      )}

      <MutedSection />
    </div>
  );
}
