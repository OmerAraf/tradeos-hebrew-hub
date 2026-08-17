import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABLE = "news_muted_symbols";

let cache: string[] = [];
const listeners = new Set<(s: string[]) => void>();

function emit() {
  for (const l of listeners) l(cache);
}

export async function loadMutedSymbols(): Promise<string[]> {
  const { data, error } = await supabase.from(TABLE).select("symbol");
  if (error) throw error;
  cache = Array.from(
    new Set((data ?? []).map((r) => String(r.symbol).toUpperCase())),
  ).sort((a, b) => a.localeCompare(b));
  emit();
  return cache;
}

export async function muteSymbol(symbolRaw: string): Promise<void> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) return;
  if (!cache.includes(symbol)) {
    cache = [...cache, symbol].sort((a, b) => a.localeCompare(b));
    emit();
  }
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("לא מחובר");
  const { error } = await supabase.from(TABLE).insert({ user_id: uid, symbol });
  if (error && !/duplicate/i.test(error.message)) {
    await loadMutedSymbols().catch(() => {});
    throw error;
  }
}

export async function unmuteSymbol(symbolRaw: string): Promise<void> {
  const symbol = symbolRaw.trim().toUpperCase();
  cache = cache.filter((s) => s !== symbol);
  emit();
  const { error } = await supabase.from(TABLE).delete().eq("symbol", symbol);
  if (error) {
    await loadMutedSymbols().catch(() => {});
    throw error;
  }
}

/** Subscribe to the muted-symbols list for the current user. */
export function useMutedSymbols() {
  const [muted, setMuted] = useState<string[]>(cache);

  useEffect(() => {
    listeners.add(setMuted);
    loadMutedSymbols().catch(() => {});
    return () => {
      listeners.delete(setMuted);
    };
  }, []);

  const mute = useCallback((s: string) => muteSymbol(s), []);
  const unmute = useCallback((s: string) => unmuteSymbol(s), []);
  const reload = useCallback(() => loadMutedSymbols(), []);

  return { muted, mute, unmute, reload };
}
