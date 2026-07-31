import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  Briefcase,
  Eye,
  LogOut,
  Newspaper,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearLocalCache } from "@/lib/trade-store";
import { refreshAll } from "@/lib/refresh";

const NAV = [
  { to: "/", label: "דשבורד", short: "דשבורד", icon: BarChart3 },
  { to: "/open", label: "עסקאות בעבודה", short: "בעבודה", icon: Briefcase },
  { to: "/trades", label: "יומן עסקאות", short: "יומן", icon: Activity },
  { to: "/news", label: "חדשות חמות", short: "חדשות", icon: Newspaper },
  { to: "/insights", label: "תובנות על התיק", short: "תובנות", icon: Sparkles },
  { to: "/watchlist", label: "מעקב מניות", short: "מעקב", icon: Eye },
] as const;

// Bottom-bar height + spacing reserved for content so nothing hides behind it.
const BOTTOM_BAR_RESERVE = "6.5rem"; // ~104px covers tabs + safe-area

const PULL_TRIGGER = 70; // px of pull needed to fire a refresh
const PULL_MAX = 110;
const AWAY_MS = 60_000; // refresh on return after being hidden this long

async function signOut() {
  await supabase.auth.signOut();
  clearLocalCache();
  window.location.href = "/auth";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const refreshingRef = useRef(false);
  const startYRef = useRef<number | null>(null);

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await refreshAll();
      toast.success("הנתונים עודכנו");
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      toast.error("הרענון נכשל", { description: reason });
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
    }
  }, []);

  // Refresh when returning to the app after it was backgrounded for a while.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) {
        hiddenAt = 0;
        void doRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [doRefresh]);

  // Pull-to-refresh (mobile). Purely additive: never blocks normal scrolling.
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      startYRef.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingRef.current) return;
      if (window.scrollY > 0) {
        startYRef.current = null;
        setPull(0);
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      setPull(delta > 0 ? Math.min(delta * 0.5, PULL_MAX) : 0);
    };
    const onEnd = () => {
      if (startYRef.current !== null && pull >= PULL_TRIGGER) void doRefresh();
      else setPull(0);
      startYRef.current = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [doRefresh, pull]);

  const pullActive = pull > 0 || refreshing;


  return (
    <div className="min-h-dvh" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="sticky top-0 z-40 glass-strong border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 md:px-8 md:py-3">
          <Link to="/" aria-label="TRADE·OS דף הבית" className="flex min-h-11 items-center gap-2 shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-lg neon-border bg-background/40">
              <span className="text-neon text-base md:text-lg font-black" dir="ltr">◆</span>
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-neon text-xs md:text-sm font-bold tracking-widest" dir="ltr">
                TRADE·OS
              </div>
              <div className="text-[10px] text-muted-foreground">יומן מסחר</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="ניווט ראשי"
            className="hidden flex-1 items-center justify-end gap-1 md:flex"
          >
            {NAV.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-label={n.label}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all shrink-0 active:scale-95 " +
                    (active
                      ? "neon-border bg-primary/10 text-neon"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            onClick={signOut}
            aria-label="התנתקות"
            title="התנתקות"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 py-2 text-muted-foreground transition-all hover:bg-white/5 hover:text-loss shrink-0 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main
        className="mx-auto max-w-7xl px-3 py-4 md:px-8 md:py-10"
        style={{ paddingBottom: `calc(${BOTTOM_BAR_RESERVE} + env(safe-area-inset-bottom))` }}
      >
        {children}
      </main>

      <footer
        className="mx-auto max-w-7xl px-3 pt-4 text-center text-[10px] text-muted-foreground md:px-8 md:text-xs"
        style={{ paddingBottom: `calc(${BOTTOM_BAR_RESERVE} + env(safe-area-inset-bottom))` }}
      >
        <span dir="ltr">TRADE·OS 2050</span> — סינכרון ענן פעיל
      </footer>

      {/* FAB — floats above the bottom bar */}
      <Link
        to="/trades"
        hash="new"
        aria-label="עסקה חדשה"
        className="fixed z-50 flex items-center gap-2 rounded-full neon-border bg-primary/25 px-5 py-4 text-sm font-bold text-neon shadow-[0_10px_30px_-10px_oklch(0.82_0.18_200/0.5)] backdrop-blur-md transition-all hover:bg-primary/35 active:scale-95"
        style={{
          insetInlineStart: "1rem",
          bottom: `calc(${BOTTOM_BAR_RESERVE} + 0.75rem + env(safe-area-inset-bottom))`,
          minHeight: "3.5rem",
        }}
      >
        <Plus className="h-5 w-5" />
        <span>עסקה חדשה</span>
      </Link>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="ניווט תחתון"
        className="fixed inset-x-0 bottom-0 z-40 glass-strong border-t border-white/10 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-3xl items-stretch justify-between px-1">
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <li key={n.to} className="flex-1">
                <Link
                  to={n.to}
                  aria-label={n.label}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition-all active:scale-95 " +
                    (active
                      ? "text-neon bg-primary/15"
                      : "text-muted-foreground hover:bg-white/5")
                  }
                  style={{ minHeight: "3rem" }}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-neon" : ""}`} />
                  <span className="leading-none">{n.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
