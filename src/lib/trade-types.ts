export type Direction = "long" | "short";
export type Strategy = "swing" | "long-term";

export interface Trade {
  id: string;
  symbol: string;
  direction: Direction;
  entryDate: string; // ISO
  exitDate: string; // ISO
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  fees: number;
  stopPrice?: number;
  strategy: Strategy;
  notes?: string;
}

export function pnl(t: Trade): number {
  const gross =
    t.direction === "long"
      ? (t.exitPrice - t.entryPrice) * t.quantity
      : (t.entryPrice - t.exitPrice) * t.quantity;
  return gross - (t.fees || 0);
}

export function rMultiple(t: Trade): number | null {
  if (t.stopPrice == null) return null;
  const risk = Math.abs(t.entryPrice - t.stopPrice) * t.quantity;
  if (risk === 0) return null;
  return pnl(t) / risk;
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtNum(n: number, d = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
