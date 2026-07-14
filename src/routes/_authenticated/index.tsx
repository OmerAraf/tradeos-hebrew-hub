import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrades } from "@/lib/use-trades";
import { bySymbol, computeStats, equityCurve, monthlyPnl } from "@/lib/trade-stats";
import { fmtMoney, fmtNum, fmtPct, pnl } from "@/lib/trade-types";
import { GlassCard, KpiCard, PageHeader } from "@/components/ui-blocks";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "דשבורד — TRADE·OS 2050" },
      { name: "description", content: "מבט על ביצועי המסחר: P&L, אחוזי הצלחה וגרף הון" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const trades = useTrades();
  const stats = computeStats(trades);
  const equity = equityCurve(trades);
  const monthly = monthlyPnl(trades);
  const symbols = bySymbol(trades);

  const totalTone = stats.totalPnl > 0 ? "profit" : stats.totalPnl < 0 ? "loss" : "neutral";

  return (
    <div>
      <PageHeader title="דשבורד" subtitle="סקירת ביצועים כוללת" />

      {trades.length === 0 ? (
        <GlassCard className="text-center">
          <p className="text-muted-foreground">אין עדיין עסקאות. הוסף עסקה או ייבא CSV כדי להתחיל.</p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="P&L כולל" value={fmtMoney(stats.totalPnl)} tone={totalTone as "profit" | "loss" | "neutral"} />
            <KpiCard label="אחוז הצלחה" value={fmtPct(stats.winRate)} tone="accent" />
            <KpiCard label="Profit Factor" value={isFinite(stats.profitFactor) ? fmtNum(stats.profitFactor) : "∞"} />
            <KpiCard label="R-Multiple ממוצע" value={fmtNum(stats.avgR)} />
            <KpiCard label="רווח ממוצע" value={fmtMoney(stats.avgWin)} tone="profit" />
            <KpiCard label="הפסד ממוצע" value={fmtMoney(stats.avgLoss)} tone="loss" />
            <KpiCard
              label="עסקה טובה"
              value={stats.bestTrade ? stats.bestTrade.symbol : "—"}
              sub={stats.bestTrade ? fmtMoney((stats.bestTrade.direction === "long"
                ? (stats.bestTrade.exitPrice - stats.bestTrade.entryPrice)
                : (stats.bestTrade.entryPrice - stats.bestTrade.exitPrice)) * stats.bestTrade.quantity - stats.bestTrade.fees) : ""}
              tone="profit"
            />
            <KpiCard
              label="עסקה גרועה"
              value={stats.worstTrade ? stats.worstTrade.symbol : "—"}
              sub={stats.worstTrade ? fmtMoney((stats.worstTrade.direction === "long"
                ? (stats.worstTrade.exitPrice - stats.worstTrade.entryPrice)
                : (stats.worstTrade.entryPrice - stats.worstTrade.exitPrice)) * stats.worstTrade.quantity - stats.worstTrade.fees) : ""}
              tone="loss"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GlassCard>
              <div className="mb-2 text-sm font-semibold">עקומת הון מצטברת</div>
              <div dir="ltr" className="h-72">
                <ResponsiveContainer>
                  <LineChart data={equity} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="#8ea0b8" fontSize={11} />
                    <YAxis stroke="#8ea0b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,25,40,0.95)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        color: "#fff",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      stroke="oklch(0.82 0.18 200)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "oklch(0.82 0.18 200)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="mb-2 text-sm font-semibold">P&L חודשי</div>
              <div dir="ltr" className="h-72">
                <ResponsiveContainer>
                  <BarChart data={monthly} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" stroke="#8ea0b8" fontSize={11} />
                    <YAxis stroke="#8ea0b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,25,40,0.95)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {monthly.map((m, i) => (
                        <Cell
                          key={i}
                          fill={m.value >= 0 ? "oklch(0.75 0.2 145)" : "oklch(0.65 0.24 25)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          <div className="mt-4">
            <GlassCard>
              <div className="mb-3 text-sm font-semibold">פירוט לפי סימבול</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="p-2 text-right font-medium">סימבול</th>
                      <th className="p-2 text-right font-medium">עסקאות</th>
                      <th className="p-2 text-right font-medium">אחוז הצלחה</th>
                      <th className="p-2 text-right font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbols.map((s) => (
                      <tr key={s.symbol} className="border-t border-white/5">
                        <td className="p-2 font-semibold" dir="ltr">{s.symbol}</td>
                        <td className="p-2" dir="ltr">{s.count}</td>
                        <td className="p-2" dir="ltr">{fmtPct(s.winRate)}</td>
                        <td className={`p-2 font-semibold ${s.pnl >= 0 ? "text-profit" : "text-loss"}`} dir="ltr">
                          {fmtMoney(s.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
