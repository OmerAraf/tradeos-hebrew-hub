import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-blocks";
import { NewsPanel } from "@/components/news-panel";
import { NewsFocusPanel, NewsSymbolChips } from "@/components/news-focus";

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
    </div>
  );
}
