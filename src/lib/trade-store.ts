import type { Trade } from "./trade-types";

const KEY = "tradeos_v1";

interface Store {
  trades: Trade[];
}

const SEED: Trade[] = [
  {
    id: "s1",
    symbol: "AAPL",
    direction: "long",
    entryDate: "2025-01-08T14:30:00Z",
    exitDate: "2025-01-22T20:00:00Z",
    entryPrice: 224.5,
    exitPrice: 238.1,
    quantity: 50,
    fees: 2,
    stopPrice: 218,
    strategy: "swing",
    notes: "פריצה מעל התנגדות",
  },
  {
    id: "s2",
    symbol: "TSLA",
    direction: "short",
    entryDate: "2025-02-03T15:00:00Z",
    exitDate: "2025-02-11T19:00:00Z",
    entryPrice: 402.0,
    exitPrice: 378.5,
    quantity: 20,
    fees: 3,
    stopPrice: 415,
    strategy: "swing",
    notes: "דיברגנס שלילי",
  },
  {
    id: "s3",
    symbol: "NVDA",
    direction: "long",
    entryDate: "2025-02-18T14:35:00Z",
    exitDate: "2025-03-02T20:00:00Z",
    entryPrice: 132.0,
    exitPrice: 125.4,
    quantity: 40,
    fees: 2,
    stopPrice: 128,
    strategy: "swing",
    notes: "סטופ נשבר",
  },
  {
    id: "s4",
    symbol: "MSFT",
    direction: "long",
    entryDate: "2025-03-10T14:40:00Z",
    exitDate: "2025-06-15T20:00:00Z",
    entryPrice: 388.0,
    exitPrice: 442.3,
    quantity: 15,
    fees: 2,
    strategy: "long-term",
    notes: "החזקה ארוכה",
  },
  {
    id: "s5",
    symbol: "AMD",
    direction: "long",
    entryDate: "2025-04-02T15:00:00Z",
    exitDate: "2025-04-09T20:00:00Z",
    entryPrice: 148.0,
    exitPrice: 141.2,
    quantity: 30,
    fees: 2,
    stopPrice: 145,
    strategy: "swing",
    notes: "סטופ הודק מוקדם",
  },
  {
    id: "s6",
    symbol: "META",
    direction: "long",
    entryDate: "2025-05-06T14:45:00Z",
    exitDate: "2025-05-20T20:00:00Z",
    entryPrice: 512.0,
    exitPrice: 548.9,
    quantity: 10,
    fees: 2,
    stopPrice: 495,
    strategy: "swing",
  },
  {
    id: "s7",
    symbol: "AMD",
    direction: "short",
    entryDate: "2025-06-11T15:10:00Z",
    exitDate: "2025-06-18T19:30:00Z",
    entryPrice: 168.0,
    exitPrice: 172.5,
    quantity: 25,
    fees: 2,
    stopPrice: 172,
    strategy: "swing",
    notes: "לא כובד הסטופ",
  },
  {
    id: "s8",
    symbol: "GOOGL",
    direction: "long",
    entryDate: "2025-07-01T14:35:00Z",
    exitDate: "2026-01-10T20:00:00Z",
    entryPrice: 176.5,
    exitPrice: 208.4,
    quantity: 25,
    fees: 3,
    strategy: "long-term",
  },
];

function read(): Store {
  if (typeof window === "undefined") return { trades: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seed = { trades: SEED };
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as Store;
  } catch {
    return { trades: [] };
  }
}

function write(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("tradeos:change"));
}

export function getTrades(): Trade[] {
  return read().trades;
}

export function saveTrades(trades: Trade[]) {
  write({ trades });
}

export function upsertTrade(t: Trade) {
  const s = read();
  const idx = s.trades.findIndex((x) => x.id === t.id);
  if (idx >= 0) s.trades[idx] = t;
  else s.trades.push(t);
  write(s);
}

export function deleteTrade(id: string) {
  const s = read();
  s.trades = s.trades.filter((t) => t.id !== id);
  write(s);
}

export function exportJson(): string {
  return JSON.stringify(read(), null, 2);
}

export function importJson(text: string): number {
  const parsed = JSON.parse(text) as Store;
  if (!parsed || !Array.isArray(parsed.trades)) throw new Error("קובץ לא תקין");
  write({ trades: parsed.trades });
  return parsed.trades.length;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
