import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { DostawaForm } from "@/components/DostawaForm";

function Page() {
  const { roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");
  if (!isSuper && !isImportMgr) {
    return (
      <RoleGuard path="/dostawy">
        <div className="mx-auto max-w-md text-center py-16">
          <h1 className="text-2xl font-bold">Brak dostępu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tylko Import manager lub Superadministrator może tworzyć dostawy.
          </p>
        </div>
      </RoleGuard>
    );
  }
  return (
    <RoleGuard path="/dostawy">
      <DostawaForm mode="create" />
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/dostawy/nowa")({
  head: () => ({ meta: [{ title: "Nowa dostawa — Tropical Trade Platform" }] }),
  component: Page,
});
