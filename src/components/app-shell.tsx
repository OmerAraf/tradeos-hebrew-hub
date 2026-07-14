import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, BarChart3, Eye, LogOut, Sparkles, Upload } from "lucide-react";
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
    <div className="min-h-screen" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="sticky top-0 z-40 glass-strong border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 md:px-8 md:py-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="grid h-8 w-8 md:h-9 md:w-9 place-items-center rounded-lg neon-border bg-background/40">
              <span className="text-neon text-base md:text-lg font-black" dir="ltr">◆</span>
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-neon text-xs md:text-sm font-bold tracking-widest" dir="ltr">
                TRADE·OS
              </div>
              <div className="text-[10px] text-muted-foreground">יומן מסחר</div>
            </div>
          </Link>
          <nav className="flex flex-1 items-center justify-end gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={
                    "flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all md:px-3 md:py-2 md:text-sm shrink-0 " +
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
              title="התנתקות"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-loss md:px-3 md:py-2 md:text-sm shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 md:px-8 md:py-10">{children}</main>
      <footer className="mx-auto max-w-7xl px-3 pb-8 pt-4 text-center text-[10px] text-muted-foreground md:px-8 md:text-xs">
        <span dir="ltr">TRADE·OS 2050</span> — סינכרון ענן פעיל
      </footer>
    </div>
  );
}
