import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, BarChart3, Eye, LogOut, Plus, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearLocalCache } from "@/lib/trade-store";

const NAV = [
  { to: "/", label: "דשבורד", icon: BarChart3 },
  { to: "/trades", label: "עסקאות", icon: Activity },
  { to: "/watchlist", label: "מעקב", icon: Eye },
  { to: "/import", label: "ייבוא", icon: Upload },
  { to: "/insights", label: "תובנות", icon: Sparkles },
] as const;

async function signOut() {
  await supabase.auth.signOut();
  clearLocalCache();
  window.location.href = "/auth";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
          <nav aria-label="ניווט ראשי" className="flex flex-1 items-center justify-end gap-1 overflow-x-auto">
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
                    "flex min-h-11 items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium transition-all md:px-3 md:text-sm shrink-0 active:scale-95 " +
                    (active
                      ? "neon-border bg-primary/10 text-neon"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden xs:inline sm:inline">{n.label}</span>
                </Link>
              );
            })}
            <button
              onClick={signOut}
              aria-label="התנתקות"
              title="התנתקות"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 py-2 text-muted-foreground transition-all hover:bg-white/5 hover:text-loss shrink-0 active:scale-95"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 pb-32 md:px-8 md:py-10 md:pb-10">{children}</main>
      <footer className="mx-auto max-w-7xl px-3 pb-24 pt-4 text-center text-[10px] text-muted-foreground md:px-8 md:pb-8 md:text-xs">
        <span dir="ltr">TRADE·OS 2050</span> — סינכרון ענן פעיל
      </footer>
      <Link
        to="/trades"
        hash="new"
        aria-label="עסקה חדשה"
        className="fixed z-50 flex items-center gap-2 rounded-full neon-border bg-primary/25 px-5 py-4 text-sm font-bold text-neon shadow-[0_10px_30px_-10px_oklch(0.82_0.18_200/0.5)] backdrop-blur-md transition-all hover:bg-primary/35 active:scale-95"
        style={{
          insetInlineStart: "1rem",
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          minHeight: "3.5rem",
        }}
      >
        <Plus className="h-5 w-5" />
        <span>עסקה חדשה</span>
      </Link>
    </div>
  );
}
