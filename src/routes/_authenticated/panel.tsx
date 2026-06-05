import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel główny — Tropical Trade Platform" }] }),
  component: PanelPage,
});

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Superadministrator",
  kierownik: "Kierownik",
  asystent_kierownika: "Asystent Kierownika",
  import_manager: "Import Manager",
  export_manager: "Export Manager",
  sales_manager: "Sales Manager",
  fakturowanie: "Fakturowanie",
  logistyk: "Logistyk",
};

interface Profile {
  uzytkownik_id: string;
  imie_nazwisko: string;
  email: string;
  status: string;
  klucze_rol: string[];
}

function PanelPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: profData }, { data: rolesData }] = await Promise.all([
        supabase.rpc("my_profile"),
        supabase.rpc("my_role_keys"),
      ]);
      if (profData && profData.length > 0) setProfile(profData[0] as Profile);
      if (rolesData) setRoleKeys(rolesData as string[]);
      setLoading(false);
    })();
  }, []);

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const primaryRole = roleKeys[0];
  const roleLabel = primaryRole ? (ROLE_LABELS[primaryRole] ?? primaryRole) : "—";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Panel główny</h1>
          <Button variant="outline" onClick={onLogout}>Wyloguj</Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Profil użytkownika</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {loading ? (
              <p className="text-muted-foreground">Ładowanie…</p>
            ) : profile ? (
              <>
                <div><span className="text-muted-foreground">Użytkownik: </span>{profile.imie_nazwisko}</div>
                <div><span className="text-muted-foreground">Email: </span>{profile.email}</div>
                <div><span className="text-muted-foreground">ID: </span>{profile.uzytkownik_id}</div>
                <div><span className="text-muted-foreground">Rola: </span><strong>{roleLabel}</strong></div>
                <div><span className="text-muted-foreground">Klucze ról: </span>{roleKeys.join(", ") || "—"}</div>
              </>
            ) : (
              <p className="text-destructive">Profil niedostępny.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
