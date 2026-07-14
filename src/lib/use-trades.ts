import { useEffect, useState } from "react";
import { getTrades } from "./trade-store";
import type { Trade } from "./trade-types";

export function useTrades(): Trade[] {
  const [trades, setTrades] = useState<Trade[]>([]);
  useEffect(() => {
    const load = () => setTrades(getTrades());
    load();
    const onChange = () => load();
    window.addEventListener("tradeos:change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("tradeos:change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return trades;
}
