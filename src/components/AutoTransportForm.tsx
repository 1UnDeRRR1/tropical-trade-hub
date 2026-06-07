// AutoTransportForm — business-facing "Auto / Transport" create flow.
// Internally calls existing RPC utworz_sesje_z_dostawami(p_sesja, p_dostawy).
// Does NOT expose: "Sesje transportowe", transport_sesje, sesja_id.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DostawaBlock,
  emptyBlock,
  validateBlock,
  blockTotals,
  buildPozycjaPayload,
  type BlockData,
  type RefOption,
  type OpakRefOption,
  type OdmianaRefOption,
  type MaterialTary,
} from "@/components/DostawaBlock";

const MAX_PALETY = 26;
const MAX_BRUTTO = 21500;

function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function canonicalMaterial(raw: string | null | undefined): MaterialTary {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v) return "";
  if (["karton","carton","cardboard","tektura","tekturowa","tekturowe"].includes(v)) return "karton";
  if (["drewno","wood","drewniana","drewniane","wooden"].includes(v)) return "drewno";
  if (["plastik","plastic","plastikowa","plastikowe","pp","pet","hdpe","ldpe","ps","eps","styropian","folia"].includes(v)) return "plastik";
  return "";
}

export function AutoTransportForm() {
  const navigate = useNavigate();
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isKierownik = roleKeys.includes("kierownik");
  const isAsystent = roleKeys.includes("asystent_kierownika");
  const isImportMgr = roleKeys.includes("import_manager");
  const isStaff = isSuper || isKierownik || isAsystent;

  const today = localTodayStr();

  // ---------- Reference data ----------
  const [dostawcy, setDostawcy] = useState<RefOption[]>([]);
  const [kraje, setKraje] = useState<RefOption[]>([]);
  const [produkty, setProdukty] = useState<RefOption[]>([]);
  const [odmiany, setOdmiany] = useState<OdmianaRefOption[]>([]);
  const [opakowania, setOpakowania] = useState<OpakRefOption[]>([]);
  const [managers, setManagers] = useState<RefOption[]>([]);
  const [przewoznicy, setPrzewoznicy] = useState<RefOption[]>([]);

  // ---------- Auto header state ----------
  const [importManagerId, setImportManagerId] = useState("");
  const [przewoznikId, setPrzewoznikId] = useState("");
  const [numerAuta, setNumerAuta] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [preliminary, setPreliminary] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [headerNotes, setHeaderNotes] = useState("");

  // ---------- Dostawy ----------
  const [blocks, setBlocks] = useState<BlockData[]>(() => [emptyBlock(today)]);

  const [submitTried, setSubmitTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---------- Load references ----------
  useEffect(() => {
    (async () => {
      const canLoadManagers = isSuper || isKierownik || isAsystent;
      const [d, k, p, o, op, u, pr] = await Promise.all([
        supabase.from("dostawcy").select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy").order("nazwa_dostawcy_original"),
        supabase.from("kraje").select("kraj_id, nazwa_pl").order("nazwa_pl"),
        supabase.from("produkty").select("produkt_id, nazwa_pl").order("nazwa_pl"),
        supabase.from("odmiany").select("odmiana_id, odmiana_original, produkt_id").order("odmiana_original"),
        supabase.from("opakowania").select("opakowanie_id, typ_opakowania_pl, wariant_opakowania_pl, material_tary").order("typ_opakowania_pl"),
        canLoadManagers
          ? supabase.from("uzytkownicy").select("uzytkownik_id, imie_nazwisko").eq("klucz_roli","import_manager").eq("status","aktywny")
          : Promise.resolve({ data: [] as Array<{ uzytkownik_id: string; imie_nazwisko: string | null }> }),
        supabase.from("przewoznicy").select("przewoznik_id, nazwa_firmy_oryginalna, nazwa_firmy").order("nazwa_firmy_oryginalna"),
      ]);
      setDostawcy((d.data ?? []).map((x) => ({
        id: x.dostawca_id,
        label: x.nazwa_dostawcy_original || x.alias_dostawcy || x.dostawca_id,
      })));
      setKraje((k.data ?? []).map((x) => ({ id: x.kraj_id, label: x.nazwa_pl || x.kraj_id })));
      setProdukty((p.data ?? []).map((x) => ({ id: x.produkt_id, label: x.nazwa_pl || x.produkt_id })));
      setOdmiany((o.data ?? []).map((x) => ({
        id: x.odmiana_id,
        label: x.odmiana_original || x.odmiana_id,
        produkt_id: x.produkt_id ?? null,
      })));
      setOpakowania((op.data ?? []).map((x) => ({
        id: x.opakowanie_id,
        label: [x.typ_opakowania_pl, x.wariant_opakowania_pl].filter(Boolean).join(" / ") || x.opakowanie_id,
        material: canonicalMaterial(x.material_tary),
      })));
      if (canLoadManagers) {
        setManagers((u.data ?? []).map((x) => ({ id: x.uzytkownik_id, label: x.imie_nazwisko || x.uzytkownik_id })));
      } else if (isImportMgr && profile?.uzytkownik_id) {
        setManagers([{ id: profile.uzytkownik_id, label: profile.imie_nazwisko || profile.uzytkownik_id }]);
      }
      setPrzewoznicy((pr.data ?? []).map((x) => ({
        id: x.przewoznik_id,
        label: x.nazwa_firmy_oryginalna || x.nazwa_firmy || x.przewoznik_id,
      })));
    })();
  }, [isSuper, isKierownik, isAsystent, isImportMgr, profile?.uzytkownik_id, profile?.imie_nazwisko]);

  // Default import_manager_id for import_manager role
  useEffect(() => {
    if (!importManagerId && isImportMgr && profile?.uzytkownik_id) {
      setImportManagerId(profile.uzytkownik_id);
    } else if (!importManagerId && managers.length === 1) {
      setImportManagerId(managers[0].id);
    }
  }, [importManagerId, isImportMgr, profile?.uzytkownik_id, managers]);

  // ---------- Capacity ----------
  const totals = useMemo(() => blockTotals(blocks), [blocks]);
  const overPalety = totals.palety > MAX_PALETY;
  const overBrutto = totals.brutto > MAX_BRUTTO;
  const overCapacity = overPalety || overBrutto;

  // ---------- Header validation ----------
  const headerErrors = useMemo(() => {
    const errs: string[] = [];
    if (!importManagerId) errs.push("Import manager wymagany");
    if ((numerAuta ?? "").length > 50) errs.push("Numer auta: max 50 znaków");
    if (etd && eta && eta < etd) errs.push("ETA wcześniejsza niż ETD");
    const prel = preliminary ? Number(preliminary.replace(",", ".")) : null;
    const fin = finalCost ? Number(finalCost.replace(",", ".")) : null;
    if (preliminary && (prel === null || isNaN(prel) || prel < 0))
      errs.push("Koszt transportu wstępny musi być liczbą ≥ 0");
    if (finalCost && (fin === null || isNaN(fin) || fin < 0))
      errs.push("Koszt transportu końcowy musi być liczbą ≥ 0");
    if (!isStaff && isImportMgr) {
      const prelOk = prel !== null && !isNaN(prel) && prel > 0;
      const finOk = fin !== null && !isNaN(fin) && fin > 0;
      if (!prelOk && !finOk)
        errs.push("Wymagany koszt transportu wstępny > 0 lub końcowy > 0");
    }
    if ((headerNotes ?? "").length > 200) errs.push("Uwagi: max 200 znaków");
    return errs;
  }, [importManagerId, numerAuta, etd, eta, preliminary, finalCost, headerNotes, isStaff, isImportMgr]);

  const blockErrors = useMemo(
    () => blocks.map((b) => validateBlock(b, today)),
    [blocks, today],
  );

  const hasAnyError =
    headerErrors.length > 0 ||
    overCapacity ||
    blockErrors.some((e) => e.length > 0);

  const addBlock = () => setBlocks((bs) => [...bs, emptyBlock(today)]);
  const removeBlock = (i: number) => {
    if (blocks.length <= 1) return;
    setBlocks((bs) => bs.filter((_, idx) => idx !== i));
  };
  const updateBlock = (i: number, next: BlockData) =>
    setBlocks((bs) => bs.map((b, idx) => (idx === i ? next : b)));

  const onSubmit = async () => {
    setSubmitTried(true);
    setSubmitError(null);
    if (hasAnyError) {
      toast.error("Formularz zawiera błędy. Popraw zaznaczone pola.");
      return;
    }
    setSaving(true);

    const p_sesja = {
      import_manager_id: importManagerId,
      numer_auta: numerAuta.trim() || null,
      przewoznik_id: przewoznikId || null,
      etd: etd || null,
      eta: eta || null,
      preliminary_transport_cost_eur: preliminary ? Number(preliminary.replace(",", ".")) : null,
      final_transport_cost_eur: finalCost ? Number(finalCost.replace(",", ".")) : null,
      waluta: "EUR",
      status: "draft",
      notes: headerNotes.trim() || null,
    };

    const p_dostawy = blocks.map((b) => ({
      data_dostawy: b.data_dostawy,
      data_zaladunku: b.data_zaladunku,
      dostawca_id: b.dostawca_id,
      kraj_id: b.kraj_id || null,
      status: "draft",
      notes: b.notes || null,
      pozycje: b.pozycje.map(buildPozycjaPayload),
    }));

    const { data, error } = await supabase.rpc("utworz_sesje_z_dostawami", {
      p_sesja,
      p_dostawy,
    });
    setSaving(false);

    if (error) {
      setSubmitError(error.message);
      toast.error(error.message);
      return;
    }

    const result = data as {
      numer_sesji?: string;
      dostawy?: Array<{ numer_dostawy?: string }>;
    } | null;
    const numerSesji = result?.numer_sesji ?? "—";
    const dostawyList = (result?.dostawy ?? [])
      .map((d) => d.numer_dostawy)
      .filter(Boolean)
      .join(", ");
    toast.success(
      `Utworzono auto ${numerSesji}${dostawyList ? ` • Dostawy: ${dostawyList}` : ""}`,
    );
    navigate({ to: "/dostawy" });
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold">Utwórz auto</h1>

      {/* ---------- Capacity meter (sticky) ---------- */}
      <div
        className={cn(
          "sticky top-14 z-20 -mx-4 px-4 py-2 md:-mx-6 md:px-6 bg-background/95 backdrop-blur border-b",
          overCapacity && "ring-1 ring-destructive",
        )}
      >
        <div className="text-xs sm:text-sm">
          <div className="font-medium">Pojemność auta</div>
          <div className="flex flex-wrap gap-3 mt-1">
            <span className={cn("tabular-nums", overPalety && "text-destructive font-semibold")}>
              {totals.palety} / {MAX_PALETY} palet
            </span>
            <span className={cn("tabular-nums", overBrutto && "text-destructive font-semibold")}>
              {totals.brutto.toFixed(0)} / {MAX_BRUTTO} kg brutto
            </span>
          </div>
          {overCapacity && (
            <div className="mt-1 text-destructive text-xs flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Przekroczono pojemność auta. Zmniejsz palety lub brutto.
            </div>
          )}
        </div>
      </div>

      {/* ---------- Auto header ---------- */}
      <Card>
        <CardHeader><CardTitle>Auto / Transport</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Import manager *</Label>
              {managers.length === 1 ? (
                <Input value={managers[0].label} readOnly className="bg-muted/40" />
              ) : (
                <Select value={importManagerId} onValueChange={setImportManagerId} disabled={isImportMgr && !isStaff}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Przewoźnik</Label>
              <Select value={przewoznikId || "__none__"} onValueChange={(v) => setPrzewoznikId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="— brak —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— brak —</SelectItem>
                  {przewoznicy.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numer auta</Label>
              <Input value={numerAuta} maxLength={50} onChange={(e) => setNumerAuta(e.target.value)} placeholder="np. WX 12345" />
            </div>
            <div /> {/* spacer */}
            <div>
              <Label>ETD</Label>
              <Input type="date" value={etd} onChange={(e) => setEtd(e.target.value)} />
            </div>
            <div>
              <Label>ETA</Label>
              <Input type="date" value={eta} min={etd || undefined} onChange={(e) => setEta(e.target.value)} />
            </div>
            <div>
              <Label>Koszt transportu wstępny (EUR)</Label>
              <Input inputMode="decimal" value={preliminary} onChange={(e) => setPreliminary(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Koszt transportu końcowy (EUR)</Label>
              <Input inputMode="decimal" value={finalCost} onChange={(e) => setFinalCost(e.target.value)} placeholder="0.00" />
            </div>
            <div className="md:col-span-2">
              <Label>Uwagi</Label>
              <Input value={headerNotes} maxLength={200} onChange={(e) => setHeaderNotes(e.target.value)} />
            </div>
          </div>

          {submitTried && headerErrors.length > 0 && (
            <div className="text-xs text-destructive space-y-0.5">
              {headerErrors.map((e, i) => (
                <div key={i} className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {e}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Dostawy ---------- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Dostawy w aucie ({blocks.length})</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addBlock}>
            <Plus className="h-4 w-4" /> Dodaj dostawę do auta
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {blocks.map((b, i) => (
            <DostawaBlock
              key={i}
              index={i}
              value={b}
              onChange={(next) => updateBlock(i, next)}
              onRemove={() => removeBlock(i)}
              removable={blocks.length > 1}
              showErrors={submitTried}
              dostawcy={dostawcy}
              kraje={kraje}
              produkty={produkty}
              odmiany={odmiany}
              opakowania={opakowania}
              todayStr={today}
            />
          ))}
        </CardContent>
      </Card>

      {submitError && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive break-words">{submitError}</CardContent>
        </Card>
      )}

      <div className="flex gap-2 justify-end sticky bottom-0 -mx-4 px-4 py-3 md:-mx-6 md:px-6 bg-background/95 backdrop-blur border-t">
        <Button variant="outline" type="button" onClick={() => navigate({ to: "/dostawy" })} disabled={saving}>
          Anuluj
        </Button>
        <Button type="button" onClick={onSubmit} disabled={saving || (submitTried && hasAnyError)}>
          {saving ? "Zapisywanie…" : "Utwórz auto"}
        </Button>
      </div>
    </div>
  );
}
