import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { ROLE_LABELS } from "@/lib/navigation";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel główny — Tropical Trade Platform" }] }),
  component: PanelPage,
});

function PanelPage() {
  const { profile, roleKeys, loading } = useCurrentProfile();
  const primaryRole = roleKeys.includes("super_admin") ? "super_admin" : roleKeys[0];
  const roleLabel = primaryRole ? (ROLE_LABELS[primaryRole] ?? primaryRole) : "—";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Panel główny</h1>
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
  );
}
