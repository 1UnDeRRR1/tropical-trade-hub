import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { ReadOnlyTable, type ColumnDef } from "@/components/ReadOnlyTable";

interface Dostawca {
  dostawca_id: string;
  nazwa_dostawcy_original: string | null;
  alias_dostawcy: string | null;
  kraj_pl: string | null;
  status: string | null;
}

const columns: ColumnDef<Dostawca>[] = [
  { key: "dostawca_id", label: "ID" },
  { key: "nazwa_dostawcy_original", label: "Nazwa" },
  { key: "alias_dostawcy", label: "Alias" },
  { key: "kraj_pl", label: "Kraj" },
  { key: "status", label: "Status" },
];

function Page() {
  return (
    <RoleGuard path="/dostawcy">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Dostawcy</h1>
        <ReadOnlyTable<Dostawca>
          table="dostawcy"
          columns={columns}
          orderBy="dostawca_id"
          searchFields={["dostawca_id", "nazwa_dostawcy_original", "alias_dostawcy", "kraj_pl"]}
        />
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/dostawcy")({
  head: () => ({ meta: [{ title: "Dostawcy — Tropical Trade Platform" }] }),
  component: Page,
});
