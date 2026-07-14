import { useEffect, useRef } from "react";

/**
 * TradingView widgets are embedded via <script> tags inside a container div.
 * Using an inner iframe-like re-init pattern by clearing the container on symbol change.
 */

function useTvWidget(
  containerRef: React.RefObject<HTMLDivElement | null>,
  scriptSrc: string,
  config: Record<string, unknown>,
  deps: unknown[],
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.width = "100%";
    inner.style.height = "100%";
    el.appendChild(inner);
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify(config);
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function TickerTape({ symbols }: { symbols: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = symbols.join(",");
  useTvWidget(
    ref,
    "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js",
    {
      symbols: symbols.map((s) => ({ proName: s, title: s })),
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    },
    [key],
  );
  return (
    <div dir="ltr" className="glass rounded-2xl overflow-hidden">
      <div ref={ref} className="tradingview-widget-container" style={{ height: 46 }} />
    </div>
  );
}

export function MiniSymbolOverview({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useTvWidget(
    ref,
    "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js",
    {
      symbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange: "1M",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
      trendLineColor: "rgba(56, 189, 248, 1)",
      underLineColor: "rgba(56, 189, 248, 0.15)",
      underLineBottomColor: "rgba(56, 189, 248, 0)",
    },
    [symbol],
  );
  return (
    <div dir="ltr" className="w-full" style={{ height: 180 }}>
      <div ref={ref} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}

export function AdvancedChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useTvWidget(
    ref,
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
    {
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(10, 14, 26, 0)",
      gridColor: "rgba(255, 255, 255, 0.06)",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    },
    [symbol],
  );
  return (
    <div dir="ltr" className="w-full" style={{ height: 480 }}>
      <div ref={ref} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
