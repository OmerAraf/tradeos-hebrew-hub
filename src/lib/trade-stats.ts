import { pnl, rMultiple, type Trade } from "./trade-types";

export interface Stats {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgR: number;
  totalTrades: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
}

export function computeStats(trades: Trade[]): Stats {
  const closed = trades.filter((t) => t.exitDate && t.exitPrice != null);
  if (!closed.length) {
    return {
      totalPnl: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgR: 0,
      totalTrades: trades.length,
      bestTrade: null,
      worstTrade: null,
    };
  }
  const withPnl = closed.map((t) => ({ t, p: pnl(t) }));
  const wins = withPnl.filter((x) => x.p > 0);
  const losses = withPnl.filter((x) => x.p < 0);
  const totalWins = wins.reduce((s, x) => s + x.p, 0);
  const totalLosses = Math.abs(losses.reduce((s, x) => s + x.p, 0));
  const rs = closed.map(rMultiple).filter((x): x is number => x != null);
  const best = withPnl.reduce((a, b) => (b.p > a.p ? b : a), withPnl[0]);
  const worst = withPnl.reduce((a, b) => (b.p < a.p ? b : a), withPnl[0]);
  return {
    totalPnl: withPnl.reduce((s, x) => s + x.p, 0),
    winRate: wins.length / closed.length,
    profitFactor: totalLosses === 0 ? (totalWins > 0 ? Infinity : 0) : totalWins / totalLosses,
    avgWin: wins.length ? totalWins / wins.length : 0,
    avgLoss: losses.length ? -totalLosses / losses.length : 0,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0,
    totalTrades: trades.length,
    bestTrade: best.t,
    worstTrade: worst.t,
  };
}

export function equityCurve(trades: Trade[]) {
  const closed = trades.filter((t): t is Trade & { exitDate: string } => !!t.exitDate && t.exitPrice != null);
  const sorted = [...closed].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  let cum = 0;
  return sorted.map((t) => {
    cum += pnl(t);
    return {
      date: t.exitDate.slice(0, 10),
      equity: Number(cum.toFixed(2)),
      label: t.symbol,
    };
  });
}

export function monthlyPnl(trades: Trade[]) {
  const map = new Map<string, number>();
  for (const t of trades) {
    if (!t.exitDate || t.exitPrice == null) continue;
    const key = t.exitDate.slice(0, 7);
    map.set(key, (map.get(key) || 0) + pnl(t));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value: Number(value.toFixed(2)) }));
}
