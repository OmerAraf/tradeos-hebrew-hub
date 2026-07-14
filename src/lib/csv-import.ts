import { newId } from "./trade-store";
import type { Direction, Strategy, Trade } from "./trade-types";

export interface RawRow {
  [key: string]: string;
}

export interface ColumnMap {
  symbol: string;
  quantity: string;
  price: string;
  date: string;
  side: string;
  fees?: string;
}

export type Side = "buy" | "sell";

export interface ParsedTx {
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
  date: string; // ISO
  fees: number;
}

// CSV parser (supports quoted values, commas)
export function parseCsv(text: string): RawRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if ((c === "," || c === "\t" || c === ";") && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: RawRow = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));
    return row;
  });
}

const CANDIDATES = {
  symbol: ["symbol", "ticker", "instrument", "asset", "stock"],
  quantity: ["qty", "quantity", "shares", "size", "amount", "units"],
  price: ["price", "avg price", "avg. price", "fill price", "exec price", "@"],
  date: ["date", "time", "datetime", "timestamp", "executed", "trade date", "fill time"],
  side: ["side", "type", "action", "buy/sell", "direction", "b/s"],
  fees: ["fee", "fees", "commission", "commissions"],
};

export function autoMap(headers: string[]): Partial<ColumnMap> {
  const map: Partial<ColumnMap> = {};
  const lower = headers.map((h) => h.toLowerCase());
  for (const key of Object.keys(CANDIDATES) as (keyof typeof CANDIDATES)[]) {
    for (const cand of CANDIDATES[key]) {
      const idx = lower.findIndex((h) => h.includes(cand));
      if (idx >= 0) {
        (map as Record<string, string>)[key] = headers[idx];
        break;
      }
    }
  }
  return map;
}

export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO first
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/;
  const m1 = s.match(iso);
  if (m1) {
    const [, y, mo, d, h = "12", mi = "0", se = "0"] = m1;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se)).toISOString();
  }
  // MM/DD/YYYY or DD/MM/YYYY
  const m2 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m2) {
    const [, a, b, y, h = "12", mi = "0", se = "0"] = m2;
    const yr = y.length === 2 ? 2000 + +y : +y;
    // Heuristic: if first > 12 assume DD/MM; if second > 12 assume MM/DD; else default MM/DD (US)
    let mo: number, d: number;
    if (+a > 12) { d = +a; mo = +b; }
    else if (+b > 12) { mo = +a; d = +b; }
    else { mo = +a; d = +b; }
    return new Date(Date.UTC(yr, mo - 1, d, +h, +mi, +se)).toISOString();
  }
  const asDate = new Date(s);
  if (!isNaN(asDate.getTime())) return asDate.toISOString();
  return null;
}

function parseNum(s: string): number {
  if (!s) return NaN;
  return Number(s.replace(/[,$\s]/g, ""));
}

function parseSide(s: string): Side | null {
  const v = s.toLowerCase().trim();
  if (["buy", "b", "long", "bought", "purchase"].includes(v)) return "buy";
  if (["sell", "s", "short", "sold", "sale"].includes(v)) return "sell";
  return null;
}

export function rowsToTxs(rows: RawRow[], map: ColumnMap): ParsedTx[] {
  const out: ParsedTx[] = [];
  for (const r of rows) {
    const sym = (r[map.symbol.toLowerCase()] || "").toUpperCase().trim();
    const qty = parseNum(r[map.quantity.toLowerCase()] || "");
    const price = parseNum(r[map.price.toLowerCase()] || "");
    const dateStr = r[map.date.toLowerCase()] || "";
    const side = parseSide(r[map.side.toLowerCase()] || "");
    const fees = map.fees ? parseNum(r[map.fees.toLowerCase()] || "0") || 0 : 0;
    const date = parseDate(dateStr);
    if (!sym || !isFinite(qty) || !isFinite(price) || !date || !side) continue;
    out.push({ symbol: sym, quantity: Math.abs(qty), price, date, side, fees });
  }
  return out;
}

// FIFO match into round-trip trades. Supports partial fills.
export function matchToTrades(txs: ParsedTx[]): Trade[] {
  const bySym = new Map<string, ParsedTx[]>();
  for (const tx of txs) {
    const arr = bySym.get(tx.symbol) || [];
    arr.push(tx);
    bySym.set(tx.symbol, arr);
  }
  const trades: Trade[] = [];
  for (const [symbol, list] of bySym) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    // Track open positions. Long = queue of buys; Short = queue of sells.
    interface Lot { qty: number; price: number; date: string; fees: number; }
    const longs: Lot[] = [];
    const shorts: Lot[] = [];
    for (const tx of list) {
      if (tx.side === "buy") {
        // close shorts first
        let remaining = tx.quantity;
        let feesLeft = tx.fees;
        while (remaining > 0 && shorts.length > 0) {
          const lot = shorts[0];
          const q = Math.min(remaining, lot.qty);
          const feeShare = feesLeft * (q / remaining);
          const openFee = lot.fees * (q / lot.qty);
          trades.push({
            id: newId(),
            symbol,
            direction: "short",
            entryDate: lot.date,
            exitDate: tx.date,
            entryPrice: lot.price,
            exitPrice: tx.price,
            quantity: q,
            fees: Number((openFee + feeShare).toFixed(2)),
            strategy: "swing",
          });
          lot.qty -= q;
          lot.fees -= openFee;
          remaining -= q;
          feesLeft -= feeShare;
          if (lot.qty <= 1e-9) shorts.shift();
        }
        if (remaining > 0) {
          longs.push({ qty: remaining, price: tx.price, date: tx.date, fees: feesLeft });
        }
      } else {
        // sell: close longs first
        let remaining = tx.quantity;
        let feesLeft = tx.fees;
        while (remaining > 0 && longs.length > 0) {
          const lot = longs[0];
          const q = Math.min(remaining, lot.qty);
          const feeShare = feesLeft * (q / remaining);
          const openFee = lot.fees * (q / lot.qty);
          trades.push({
            id: newId(),
            symbol,
            direction: "long",
            entryDate: lot.date,
            exitDate: tx.date,
            entryPrice: lot.price,
            exitPrice: tx.price,
            quantity: q,
            fees: Number((openFee + feeShare).toFixed(2)),
            strategy: "swing",
          });
          lot.qty -= q;
          lot.fees -= openFee;
          remaining -= q;
          feesLeft -= feeShare;
          if (lot.qty <= 1e-9) longs.shift();
        }
        if (remaining > 0) {
          shorts.push({ qty: remaining, price: tx.price, date: tx.date, fees: feesLeft });
        }
      }
    }
  }
  return trades;
}

export function dedupeAgainst(existing: Trade[], candidates: Trade[]): Trade[] {
  const seen = new Set(existing.map((t) => `${t.symbol}|${t.entryDate}|${t.entryPrice}|${t.quantity}`));
  return candidates.filter((t) => {
    const key = `${t.symbol}|${t.entryDate}|${t.entryPrice}|${t.quantity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
