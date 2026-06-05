import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Ustaw hasło — Tropical Trade Platform" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);

  useEffect(() => {
    let active = true;

    const enableIfRecoverySessionExists = async () => {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const linkType = hashParams.get("type") || url.searchParams.get("type");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setHasRecovery(Boolean(data.session) && (!linkType || linkType === "recovery"));
      setCheckingLink(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
    });
    enableIfRecoverySessionExists().catch(() => {
      if (active) setCheckingLink(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Nie udało się zapisać hasła");
      return;
    }
    toast.success("Hasło zapisane");
    navigate({ to: "/panel", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Ustaw nowe hasło</CardTitle>
          <CardDescription>
            {checkingLink
              ? "Sprawdzanie linku odzyskiwania…"
              : hasRecovery
                ? "Wprowadź nowe hasło dla swojego konta."
                : "Otwórz link odzyskiwania z wiadomości, aby kontynuować."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nowe hasło</Label>
              <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={!hasRecovery || checkingLink} />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !hasRecovery || checkingLink}>
              {loading ? "Zapisywanie…" : "Zapisz hasło"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
