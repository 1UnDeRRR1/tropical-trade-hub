import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      if (hash.includes("type=recovery")) {
        window.location.replace("/reset-password" + hash);
        return;
      }
    }
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/panel" : "/auth" });
  },
  component: () => null,
});
