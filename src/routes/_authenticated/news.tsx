import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-blocks";
import { NewsPanel } from "@/components/news-panel";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "חדשות חמות — TRADE·OS 2050" },
      { name: "description", content: "פיד חדשות עדכני עבור המניות במעקב, מתורגם לעברית" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <div>
      <PageHeader
        title="חדשות חמות"
        subtitle="כותרות עדכניות מ־Yahoo Finance עבור המניות שברשימת המעקב"
      />
      <NewsPanel variant="full" />
    </div>
  );
}
