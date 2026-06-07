import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { AutoTransportForm } from "@/components/AutoTransportForm";

function Page() {
  const { roleKeys, loading } = useCurrentProfile();
  if (loading) {
    return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  }
  const allowed =
    roleKeys.includes("super_admin") ||
    roleKeys.includes("kierownik") ||
    roleKeys.includes("asystent_kierownika") ||
    roleKeys.includes("import_manager");
  if (!allowed) {
    return (
      <RoleGuard path="/dostawy">
        <div className="mx-auto max-w-md text-center py-16">
          <h1 className="text-2xl font-bold">Brak dostępu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tylko Kierownik, Asystent kierownika, Import manager lub Superadministrator może utworzyć auto.
          </p>
        </div>
      </RoleGuard>
    );
  }
  return (
    <RoleGuard path="/dostawy">
      <AutoTransportForm />
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/dostawy/auto/nowe")({
  head: () => ({ meta: [{ title: "Utwórz auto — Tropical Trade Platform" }] }),
  component: Page,
});
