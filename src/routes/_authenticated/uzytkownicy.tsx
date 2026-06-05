import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { ReadOnlyTable, type ColumnDef } from "@/components/ReadOnlyTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Uzytkownik {
  uzytkownik_id: string;
  imie_nazwisko: string | null;
  email: string | null;
  status: string | null;
  auth: string;
}

interface Rola {
  rola_id: string;
  klucz_roli: string | null;
  nazwa_roli_pl: string | null;
}

const userColumns: ColumnDef<Uzytkownik>[] = [
  { key: "uzytkownik_id", label: "ID" },
  { key: "imie_nazwisko", label: "Imię i nazwisko" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "auth", label: "Auth" },
];

const roleColumns: ColumnDef<Rola>[] = [
  { key: "rola_id", label: "ID" },
  { key: "klucz_roli", label: "Klucz" },
  { key: "nazwa_roli_pl", label: "Nazwa" },
];

function Page() {
  return (
    <RoleGuard path="/uzytkownicy">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Użytkownicy i role</h1>
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Użytkownicy</TabsTrigger>
            <TabsTrigger value="roles">Role</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4">
            <ReadOnlyTable<Uzytkownik>
              table="uzytkownicy"
              columns={userColumns}
              orderBy="uzytkownik_id"
              searchFields={["uzytkownik_id", "imie_nazwisko", "email", "status"]}
              transform={(rows) =>
                rows.map((r) => ({
                  uzytkownik_id: r.uzytkownik_id,
                  imie_nazwisko: r.imie_nazwisko,
                  email: r.email,
                  status: r.status,
                  auth: r.auth_user_id ? "Tak" : "Nie",
                }))
              }
            />
          </TabsContent>
          <TabsContent value="roles" className="mt-4">
            <ReadOnlyTable<Rola>
              table="role"
              columns={roleColumns}
              orderBy="rola_id"
              searchFields={["rola_id", "klucz_roli", "nazwa_roli_pl"]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/uzytkownicy")({
  head: () => ({ meta: [{ title: "Użytkownicy — Tropical Trade Platform" }] }),
  component: Page,
});
