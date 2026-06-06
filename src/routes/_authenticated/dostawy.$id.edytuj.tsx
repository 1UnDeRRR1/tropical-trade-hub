import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { DostawaForm, type ExistingDostawa } from "@/components/DostawaForm";

function Page() {
  const { id } = Route.useParams();
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");
  const isKierownik = roleKeys.includes("kierownik");

  const [data, setData] = useState<ExistingDostawa | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: d, error: dErr } = await supabase.from("dostawy").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (dErr || !d) { setErr(dErr?.message ?? "Nie znaleziono dostawy."); setLoading(false); return; }
      if (d.status !== "draft" && d.status !== "planned") {
        setErr(`Edycja możliwa tylko dla statusu draft / planned (obecny: ${d.status})`);
        setLoading(false); return;
      }
      if (!isSuper && !isKierownik && !(isImportMgr && d.import_manager_id === profile?.uzytkownik_id)) {
        setErr("Brak uprawnień do edycji tej dostawy.");
        setLoading(false); return;
      }
      const { data: pz, error: pErr } = await supabase
        .from("pozycje_dostawy").select("*").eq("dostawa_id", id).order("position_id");
      if (cancelled) return;
      if (pErr) { setErr(pErr.message); setLoading(false); return; }
      setData({
        id: d.id,
        numer_dostawy: d.numer_dostawy,
        data_dostawy: d.data_dostawy,
        data_zaladunku: d.data_zaladunku,
        status: d.status as "draft" | "planned",
        dostawca_id: d.dostawca_id,
        kraj_id: d.kraj_id,
        import_manager_id: d.import_manager_id,
        notes: d.notes,
        positions: (pz ?? []).map((p) => ({
          id: p.id,
          produkt_id: p.produkt_id,
          odmiana_id: p.odmiana_id,
          opakowanie_id: p.opakowanie_id,
          opakowanie_source: (p.opakowanie_source as "catalog"|"custom"|"none") ?? "none",
          opakowanie_custom_text: p.opakowanie_custom_text,
          material_tary: (p.material_tary as "karton"|"drewno"|"plastik"),
          kraj_id: p.kraj_id,
          palety: Number(p.palety ?? 0),
          ilosc_opakowan: p.ilosc_opakowan == null ? null : Number(p.ilosc_opakowan),
          netto_kg: Number(p.netto_kg),
          brutto_kg: p.brutto_kg == null ? null : Number(p.brutto_kg),
          cena_zakupu: Number(p.cena_zakupu),
          waluta: p.waluta,
          notes: p.notes,
        })),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, isSuper, isImportMgr, isKierownik, profile?.uzytkownik_id]);

  return (
    <RoleGuard path="/dostawy">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dostawy/$id" params={{ id }}>
            <ArrowLeft className="h-4 w-4" /> Powrót do dostawy
          </Link>
        </Button>
        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : err ? (
          <Card><CardContent className="py-4 text-sm text-destructive">{err}</CardContent></Card>
        ) : data ? (
          <DostawaForm mode="edit" existing={data} />
        ) : null}
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/dostawy/$id/edytuj")({
  head: () => ({ meta: [{ title: "Edycja dostawy — Tropical Trade Platform" }] }),
  component: Page,
});
