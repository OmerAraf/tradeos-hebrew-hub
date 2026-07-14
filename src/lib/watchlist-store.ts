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
  return data as WatchlistItem[];
}

export async function addSymbol(symbolRaw: string): Promise<void> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) throw new Error("סימבול ריק");
  if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) throw new Error("סימבול לא תקין");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("לא מחובר");
  const { error } = await supabase
    .from("watchlist")
    .insert({ user_id: uid, symbol });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function removeSymbol(id: string): Promise<void> {
  const { error } = await supabase.from("watchlist").delete().eq("id", id);
  if (error) throw error;
}
