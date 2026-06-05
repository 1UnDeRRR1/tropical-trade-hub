import type { ReactNode } from "react";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { canAccess } from "@/lib/navigation";

export function RoleGuard({ path, children }: { path: string; children: ReactNode }) {
  const { roleKeys, loading } = useCurrentProfile();
  if (loading) {
    return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  }
  if (!canAccess(path, roleKeys)) {
    return (
      <div className="mx-auto max-w-md text-center py-16">
        <h1 className="text-2xl font-bold">Brak dostępu</h1>
        <p className="mt-2 text-sm text-muted-foreground">Nie masz uprawnień do tego modułu.</p>
      </div>
    );
  }
  return <>{children}</>;
}
