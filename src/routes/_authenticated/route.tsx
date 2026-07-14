import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initSync, clearLocalCache } from "@/lib/trade-store";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  useEffect(() => {
    initSync().catch((e) => console.error("sync failed", e));
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearLocalCache();
        window.location.href = "/auth";
      }
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
