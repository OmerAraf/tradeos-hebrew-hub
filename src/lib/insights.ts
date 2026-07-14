import { pnl, rMultiple, type Trade } from "./trade-types";

export interface Insight {
  level: "warn" | "danger" | "info";
  title: string;
  detail: string;
}

export function computeInsights(trades: Trade[]): Insight[] {
  const out: Insight[] = [];
  if (!trades.length) return out;

  // strategies win rate < 40%
  const byStrat = new Map<string, { wins: number; count: number }>();
  for (const t of trades) {
    const cur = byStrat.get(t.strategy) || { wins: 0, count: 0 };
    cur.count += 1;
    if (pnl(t) > 0) cur.wins += 1;
    byStrat.set(t.strategy, cur);
  }
  for (const [strat, v] of byStrat) {
    if (v.count >= 3 && v.wins / v.count < 0.4) {
      out.push({
        level: "warn",
        title: `אחוז הצלחה נמוך באסטרטגיית "${strat === "swing" ? "סווינג" : "לונג טרם"}"`,
        detail: `${v.wins}/${v.count} עסקאות מנצחות (${Math.round((v.wins / v.count) * 100)}%). מתחת ל־40%.`,
      });
    }
  }

  // symbols with 3+ losing trades
  const bySym = new Map<string, number>();
  for (const t of trades) if (pnl(t) < 0) bySym.set(t.symbol, (bySym.get(t.symbol) || 0) + 1);
  for (const [sym, n] of bySym) {
    if (n >= 3) {
      out.push({
        level: "danger",
        title: `רצף הפסדים בסימבול ${sym}`,
        detail: `${n} עסקאות מפסידות בסימבול זה. שקול להימנע או לשנות גישה.`,
      });
    }
  }

  // conflicting long+short overlapping
  const byS = new Map<string, Trade[]>();
  for (const t of trades) {
    const arr = byS.get(t.symbol) || [];
    arr.push(t);
    byS.set(t.symbol, arr);
  }
  for (const [sym, arr] of byS) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        if (a.direction === b.direction) continue;
        const aStart = a.entryDate, aEnd = a.exitDate ?? a.entryDate;
        const bStart = b.entryDate, bEnd = b.exitDate ?? b.entryDate;
        if (aStart <= bEnd && bStart <= aEnd) {
          out.push({
            level: "warn",
            title: `חשיפה סותרת ב־${sym}`,
            detail: `פוזיציית לונג ושורט חופפות בזמן על אותו נכס.`,
          });
          i = arr.length;
          break;
        }
      }
    }
  }

  // avg loss > avg win (absolute)
  const wins = trades.map(pnl).filter((p) => p > 0);
  const losses = trades.map(pnl).filter((p) => p < 0);
  if (wins.length && losses.length) {
    const avgW = wins.reduce((a, b) => a + b, 0) / wins.length;
    const avgL = Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length);
    if (avgL > avgW) {
      out.push({
        level: "warn",
        title: "הפסד ממוצע גדול מרווח ממוצע",
        detail: `רווח ממוצע $${avgW.toFixed(2)} מול הפסד ממוצע $${avgL.toFixed(2)}. יחס סיכוי/סיכון בעייתי.`,
      });
    }
  }

  // stop too tight / not honored
  for (const t of trades) {
    const r = rMultiple(t);
    if (r != null && r <= -1.5) {
      out.push({
        level: "danger",
        title: `סטופ חרג בעסקה ${t.symbol}`,
        detail: `R-Multiple של ${r.toFixed(2)} — סטופ הודק מדי או לא כובד.`,
      });
    }
  }

  return out;
}
