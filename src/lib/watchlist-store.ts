import { supabase } from "@/integrations/supabase/client";

export interface WatchlistItem {
  id: string;
  symbol: string;
  created_at: string;
}

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, symbol, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as WatchlistItem[];
  // Dedupe by symbol (case-insensitive), keep earliest, delete duplicates in bg
  const seen = new Map<string, WatchlistItem>();
  const dupIds: string[] = [];
  for (const r of rows) {
    const key = r.symbol.toUpperCase();
    if (seen.has(key)) dupIds.push(r.id);
    else seen.set(key, { ...r, symbol: key });
  }
  if (dupIds.length) {
    void supabase.from("watchlist").delete().in("id", dupIds);
  }
  return Array.from(seen.values());
}

export class DuplicateSymbolError extends Error {
  constructor() {
    super("duplicate");
    this.name = "DuplicateSymbolError";
  }
}

export async function addSymbol(symbolRaw: string): Promise<void> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) throw new Error("סימבול ריק");
  if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) throw new Error("סימבול לא תקין");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("לא מחובר");
  // Check existing (case-insensitive)
  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", uid)
    .ilike("symbol", symbol)
    .limit(1);
  if (existing && existing.length > 0) throw new DuplicateSymbolError();
  const { error } = await supabase
    .from("watchlist")
    .insert({ user_id: uid, symbol });
  if (error) {
    if (/duplicate/i.test(error.message)) throw new DuplicateSymbolError();
    throw error;
  }
}


export async function removeSymbol(id: string): Promise<void> {
  const { error } = await supabase.from("watchlist").delete().eq("id", id);
  if (error) throw error;
}
