import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { ReadOnlyTable, type ColumnDef } from "@/components/ReadOnlyTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Produkt {
  produkt_id: string;
  nazwa_pl: string | null;
  grupa_pl: string | null;
  status_asortymentu: string | null;
}
interface Kraj {
  kraj_id: string;
  nazwa_pl: string | null;
  iso2: string | null;
  iso3: string | null;
}
interface Opakowanie {
  opakowanie_id: string;
  typ_opakowania_pl: string | null;
  wariant_opakowania_pl: string | null;
  material_tary: string | null;
  srednia_waga_netto_opakowania_kg: string | null;
}
interface StandardPalety {
  standard_palety_id: string;
  nazwa_produktu_pl: string | null;
  kraj_lub_grupa_pochodzenia_pl: string | null;
  typ_palety_pl: string | null;
  rozmiar_palety_cm: string | null;
  wariant_opakowania_pl: string | null;
  material_tary: string | null;
  liczba_opakowan_na_palecie: string | null;
  waga_netto_palety_kg: string | null;
  waga_brutto_palety_z_paleta_kg: string | null;
  status_mapowania: string | null;
}

const produktyCols: ColumnDef<Produkt>[] = [
  { key: "produkt_id", label: "ID" },
  { key: "nazwa_pl", label: "Nazwa (PL)" },
  { key: "grupa_pl", label: "Grupa (PL)" },
  { key: "status_asortymentu", label: "Status" },
];
const krajeCols: ColumnDef<Kraj>[] = [
  { key: "kraj_id", label: "ID" },
  { key: "nazwa_pl", label: "Nazwa (PL)" },
  { key: "iso2", label: "ISO2" },
  { key: "iso3", label: "ISO3" },
];
const opakowaniaCols: ColumnDef<Opakowanie>[] = [
  { key: "opakowanie_id", label: "ID" },
  { key: "typ_opakowania_pl", label: "Typ (PL)" },
  { key: "wariant_opakowania_pl", label: "Wariant (PL)" },
  { key: "material_tary", label: "Materiał tary" },
  { key: "srednia_waga_netto_opakowania_kg", label: "Waga netto (kg)" },
];
const standardyCols: ColumnDef<StandardPalety>[] = [
  { key: "standard_palety_id", label: "ID" },
  { key: "nazwa_produktu_pl", label: "Produkt (PL)" },
  { key: "kraj_lub_grupa_pochodzenia_pl", label: "Pochodzenie" },
  { key: "typ_palety_pl", label: "Typ palety" },
  { key: "rozmiar_palety_cm", label: "Rozmiar (cm)" },
  { key: "wariant_opakowania_pl", label: "Opakowanie (PL)" },
  { key: "material_tary", label: "Materiał tary" },
  { key: "liczba_opakowan_na_palecie", label: "Opak./paleta" },
  { key: "waga_netto_palety_kg", label: "Waga netto (kg)" },
  { key: "waga_brutto_palety_z_paleta_kg", label: "Waga brutto (kg)" },
  { key: "status_mapowania", label: "Status" },
];

function Page() {
  return (
    <RoleGuard path="/ustawienia">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Ustawienia — słowniki</h1>
        <Tabs defaultValue="produkty">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="produkty">Produkty</TabsTrigger>
            <TabsTrigger value="kraje">Kraje</TabsTrigger>
            <TabsTrigger value="opakowania">Opakowania</TabsTrigger>
            <TabsTrigger value="standardy">Standardy palet</TabsTrigger>
          </TabsList>
          <TabsContent value="produkty" className="mt-4">
            <ReadOnlyTable<Produkt>
              table="produkty"
              columns={produktyCols}
              orderBy="produkt_id"
              searchFields={["produkt_id", "nazwa_pl", "grupa_pl"]}
            />
          </TabsContent>
          <TabsContent value="kraje" className="mt-4">
            <ReadOnlyTable<Kraj>
              table="kraje"
              columns={krajeCols}
              orderBy="kraj_id"
              searchFields={["kraj_id", "nazwa_pl", "iso2", "iso3"]}
            />
          </TabsContent>
          <TabsContent value="opakowania" className="mt-4">
            <ReadOnlyTable<Opakowanie>
              table="opakowania"
              columns={opakowaniaCols}
              orderBy="opakowanie_id"
              searchFields={["opakowanie_id", "typ_opakowania_pl", "wariant_opakowania_pl", "material_tary"]}
            />
          </TabsContent>
          <TabsContent value="standardy" className="mt-4">
            <ReadOnlyTable<StandardPalety>
              table="standardy_palet"
              columns={standardyCols}
              orderBy="standard_palety_id"
              searchFields={["standard_palety_id", "nazwa_produktu_pl", "wariant_opakowania_pl", "typ_palety_pl"]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/ustawienia")({
  head: () => ({ meta: [{ title: "Ustawienia — Tropical Trade Platform" }] }),
  component: Page,
});
