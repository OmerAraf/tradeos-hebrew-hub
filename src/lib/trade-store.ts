import { supabase } from "@/integrations/supabase/client";
import type { Direction, Strategy, Trade } from "./trade-types";

const CACHE_KEY = "tradeos_cache_v2";
const LEGACY_KEY = "tradeos_v1";
const MIGRATED_FLAG = "tradeos_migrated_v1";
const EVENT = "tradeos:change";

interface Row {
  id: string;
  user_id: string;
  symbol: string;
  direction: Direction;
  entry_date: string;
  exit_date: string | null;
  entry_price: number | string;
  exit_price: number | string | null;
  quantity: number | string;
  fees: number | string;
  stop_price: number | string | null;
  strategy: Strategy;
  notes: string | null;
}

function rowToTrade(r: Row): Trade {
  return {
    id: r.id,
    symbol: r.symbol,
    direction: r.direction,
    entryDate: r.entry_date,
    exitDate: r.exit_date ?? undefined,
    entryPrice: Number(r.entry_price),
    exitPrice: r.exit_price == null ? undefined : Number(r.exit_price),
    quantity: Number(r.quantity),
    fees: Number(r.fees) || 0,
    stopPrice: r.stop_price == null ? undefined : Number(r.stop_price),
    strategy: r.strategy,
    notes: r.notes ?? undefined,
  };
}

function tradeToRow(t: Trade, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    symbol: t.symbol,
    direction: t.direction,
    entry_date: t.entryDate,
    exit_date: t.exitDate ?? null,
    entry_price: t.entryPrice,
    exit_price: t.exitPrice ?? null,
    quantity: t.quantity,
    fees: t.fees,
    stop_price: t.stopPrice ?? null,
    strategy: t.strategy,
    notes: t.notes ?? null,
  };
}

function readCache(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Trade[]) : [];
  } catch {
    return [];
  }
}

function writeCache(trades: Trade[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(trades));
  window.dispatchEvent(new Event(EVENT));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function getTrades(): Trade[] {
  return readCache();
}

export async function refreshFromCloud(): Promise<Trade[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("entry_date", { ascending: false });
  if (error) throw error;
  const trades = (data as unknown as Row[]).map(rowToTrade);
  writeCache(trades);
  return trades;
}

export async function initSync(): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;

  // One-time migration of legacy localStorage trades
  if (typeof window !== "undefined" && !localStorage.getItem(MIGRATED_FLAG)) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as { trades?: Trade[] };
        const list = parsed?.trades ?? [];
        if (list.length > 0) {
          // Skip seed-only migration: seed IDs start with "s"
          const real = list.filter((t) => !/^s\d+$/.test(t.id));
          if (real.length > 0) {
            const rows = real.map((t) => tradeToRow(t, uid));
            await supabase.from("trades").upsert(rows, { onConflict: "id" });
          }
        }
      }
    } catch (e) {
      console.warn("legacy migration failed", e);
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  }

  await refreshFromCloud();
}

export async function upsertTrade(t: Trade): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("לא מחובר");
  const { error } = await supabase.from("trades").upsert(tradeToRow(t, uid), { onConflict: "id" });
  if (error) throw error;
  // Optimistic cache update
  const cur = readCache();
  const idx = cur.findIndex((x) => x.id === t.id);
  if (idx >= 0) cur[idx] = t;
  else cur.unshift(t);
  writeCache(cur);
}

export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;
  writeCache(readCache().filter((t) => t.id !== id));
}

export async function addTrades(list: Trade[]): Promise<void> {
  if (!list.length) return;
  const uid = await currentUserId();
  if (!uid) throw new Error("לא מחובר");
  const rows = list.map((t) => tradeToRow(t, uid));
  const { error } = await supabase.from("trades").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  await refreshFromCloud();
}

export async function replaceAllTrades(list: Trade[]): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("לא מחובר");
  const { error: delErr } = await supabase.from("trades").delete().eq("user_id", uid);
  if (delErr) throw delErr;
  if (list.length) {
    const rows = list.map((t) => tradeToRow(t, uid));
    const { error } = await supabase.from("trades").insert(rows);
    if (error) throw error;
  }
  await refreshFromCloud();
}

// Legacy alias kept for backwards compat if anything imports it.
export async function saveTrades(list: Trade[]): Promise<void> {
  await replaceAllTrades(list);
}

export function exportJson(): string {
  return JSON.stringify({ trades: readCache() }, null, 2);
}

export async function importJson(text: string): Promise<number> {
  const parsed = JSON.parse(text) as { trades?: Trade[] };
  if (!parsed || !Array.isArray(parsed.trades)) throw new Error("קובץ לא תקין");
  await replaceAllTrades(parsed.trades);
  return parsed.trades.length;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // fallback
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clearLocalCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
  window.dispatchEvent(new Event(EVENT));
}
