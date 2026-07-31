import { useEffect, useRef } from "react";
import { refreshFromCloud } from "./trade-store";

type Handler = () => void | Promise<void>;

const handlers = new Set<Handler>();

/** Register an extra refetch to run whenever the app-wide refresh is triggered. */
export function subscribeRefresh(fn: Handler): () => void {
  handlers.add(fn);
  return () => {
    handlers.delete(fn);
  };
}

/** Hook version — keeps the latest closure without re-subscribing. */
export function useRefreshHandler(fn: Handler) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribeRefresh(() => ref.current()), []);
}

/**
 * Re-fetch every data source: trades (shared cache used by dashboard, open
 * positions, journal and insights) plus any screen-level handlers registered
 * by the currently mounted screens (watchlist, news).
 */
export async function refreshAll(): Promise<void> {
  const results = await Promise.allSettled([
    refreshFromCloud(),
    ...Array.from(handlers).map((h) => Promise.resolve().then(h)),
  ]);
  const failed = results.find((r) => r.status === "rejected") as
    | PromiseRejectedResult
    | undefined;
  if (failed) {
    const reason = failed.reason;
    throw reason instanceof Error ? reason : new Error(String(reason));
  }
}
