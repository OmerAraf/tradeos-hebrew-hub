import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const REMEMBER_KEY = "tradeos_remember_me";

function installEphemeralSignOut() {
  if (typeof window === "undefined") return;
  const handler = () => {
    try {
      void supabase.auth.signOut();
    } catch {}
  };
  window.addEventListener("pagehide", handler, { once: true });
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "התחברות — TRADE·OS 2050" },
      { name: "description", content: "התחבר או צור חשבון ליומן המסחר" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(REMEMBER_KEY);
    return v === null ? true : v === "1";
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("החשבון נוצר. בדוק את המייל לאישור אם נדרש.");
        const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!sErr) {
          if (!remember) installEphemeralSignOut();
          nav({ to: "/" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!remember) installEphemeralSignOut();
        nav({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl neon-border bg-background/40">
            <span className="text-neon text-2xl font-black" dir="ltr">◆</span>
          </div>
          <div className="text-neon text-lg font-bold tracking-widest" dir="ltr">
            TRADE·OS 2050
          </div>
          <div className="text-xs text-muted-foreground">יומן מסחר עתידני</div>
        </div>

        <GlassCard>
          <div className="mb-4 flex gap-1 rounded-lg border border-white/10 bg-background/40 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "signin" ? "bg-primary/20 text-neon" : "text-muted-foreground"
              }`}
            >
              התחברות
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-primary/20 text-neon" : "text-muted-foreground"
              }`}
            >
              הרשמה
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3" method="post" action="#">
            <div>
              <Label htmlFor="auth-email" className="text-xs">אימייל</Label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                required
                dir="ltr"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="auth-password" className="text-xs">סיסמה</Label>
              <Input
                id="auth-password"
                name="password"
                type="password"
                required
                minLength={6}
                dir="ltr"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
              />
              <span>זכור אותי במכשיר הזה</span>
            </label>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "רגע…" : mode === "signin" ? "התחבר" : "צור חשבון"}
            </Button>
          </form>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            הנתונים מסונכרנים בענן וזמינים בכל המכשירים שלך
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
