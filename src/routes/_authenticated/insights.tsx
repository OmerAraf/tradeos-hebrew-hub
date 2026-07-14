import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/ui-blocks";
import { useTrades } from "@/lib/use-trades";
import { computeInsights } from "@/lib/insights";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "תובנות — TRADE·OS 2050" },
      { name: "description", content: "אזהרות ותובנות אוטומטיות על המסחר שלך" },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const trades = useTrades();
  const insights = computeInsights(trades);

  return (
    <div>
      <PageHeader title="תובנות" subtitle="ניתוח אוטומטי של דפוסים ובעיות במסחר" />

      {trades.length === 0 ? (
        <GlassCard className="text-center">
          <p className="text-muted-foreground">אין עדיין נתונים לנתח.</p>
        </GlassCard>
      ) : insights.length === 0 ? (
        <GlassCard className="text-center">
          <p className="text-profit">מצוין — לא זוהו דגלים אדומים במסחר שלך.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {insights.map((ins, i) => {
            const Icon = ins.level === "danger" ? ShieldAlert : ins.level === "warn" ? AlertTriangle : Info;
            const tone =
              ins.level === "danger"
                ? "border-loss/40 bg-loss/10"
                : ins.level === "warn"
                  ? "border-yellow-400/30 bg-yellow-400/5"
                  : "border-primary/30 bg-primary/5";
            const iconTone =
              ins.level === "danger" ? "text-loss" : ins.level === "warn" ? "text-yellow-400" : "text-neon";
            return (
              <div key={i} className={`glass rounded-2xl border p-4 ${tone}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} />
                  <div>
                    <div className="font-semibold text-foreground">{ins.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{ins.detail}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
