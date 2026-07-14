import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, BarChart3, Sparkles, Upload } from "lucide-react";

const NAV = [
  { to: "/", label: "דשבורד", icon: BarChart3 },
  { to: "/trades", label: "יומן עסקאות", icon: Activity },
  { to: "/import", label: "ייבוא/גיבוי", icon: Upload },
  { to: "/insights", label: "תובנות", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass-strong border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg neon-border bg-background/40">
              <span className="text-neon text-lg font-black" dir="ltr">◆</span>
            </div>
            <div className="leading-tight">
              <div className="text-neon text-sm font-bold tracking-widest" dir="ltr">
                TRADE·OS 2050
              </div>
              <div className="text-[10px] text-muted-foreground">יומן מסחר עתידני</div>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 md:gap-2">
            {NAV.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all md:px-3 md:py-2 md:text-sm " +
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
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-center text-xs text-muted-foreground md:px-8">
        <span dir="ltr">TRADE·OS 2050</span> — הנתונים נשמרים מקומית בדפדפן שלך
      </footer>
    </div>
  );
}
