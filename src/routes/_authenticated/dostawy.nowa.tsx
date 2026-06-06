import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_OPAK = "__custom__";

interface RefItem {
  id: string;
  label: string;
}

interface OpakItem extends RefItem {
  material_canonical: "karton" | "drewno" | "plastik" | null;
}

interface DostawcaItem extends RefItem {
  kraj_id: string | null;
}

type MaterialTary = "" | "karton" | "drewno" | "plastik";

interface PozycjaForm {
  produkt_id: string;
  odmiana_id: string;
  opakowanie_source: "catalog" | "custom";
  opakowanie_id: string;
  opakowanie_custom_text: string;
  material_tary: MaterialTary;
  material_autofilled: boolean;
  kraj_id: string;
  palety: string;
  ilosc_opakowan: string;
  netto_kg: string;
  brutto_kg: string;
  cena_zakupu: string;
  waluta: string;
  notes: string;
}

const EMPTY_POZ: PozycjaForm = {
  produkt_id: "",
  odmiana_id: "",
  opakowanie_source: "catalog",
  opakowanie_id: "",
  opakowanie_custom_text: "",
  material_tary: "",
  material_autofilled: false,
  kraj_id: "",
  palety: "0",
  ilosc_opakowan: "",
  netto_kg: "",
  brutto_kg: "",
  cena_zakupu: "",
  waluta: "EUR",
  notes: "",
};

function canonicalMaterial(raw: string | null | undefined): "karton" | "drewno" | "plastik" | null {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v) return null;
  if (["karton", "carton", "cardboard", "tektura", "tekturowa", "tekturowe"].includes(v)) return "karton";
  if (["drewno", "wood", "drewniana", "drewniane", "wooden"].includes(v)) return "drewno";
  if (["plastik", "plastic", "plastikowa", "plastikowe", "pp", "pet", "hdpe", "ldpe", "ps", "eps", "styropian", "folia"].includes(v))
    return "plastik";
  return null;
}

function Page() {
  const navigate = useNavigate();
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");

  const [dostawcy, setDostawcy] = useState<DostawcaItem[]>([]);
  const [kraje, setKraje] = useState<RefItem[]>([]);
  const [produkty, setProdukty] = useState<RefItem[]>([]);
  const [odmiany, setOdmiany] = useState<RefItem[]>([]);
  const [opakowania, setOpakowania] = useState<OpakItem[]>([]);
  const [managers, setManagers] = useState<RefItem[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const [dataDostawy, setDataDostawy] = useState(today);
  const [dostawcaId, setDostawcaId] = useState("");
  const [krajId, setKrajId] = useState("");
  const [krajTouched, setKrajTouched] = useState(false);
  const [managerId, setManagerId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "planned">("draft");
  const [pozycje, setPozycje] = useState<PozycjaForm[]>([{ ...EMPTY_POZ }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [d, k, p, o, op, u] = await Promise.all([
        supabase
          .from("dostawcy")
          .select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy, kraj_id")
          .order("nazwa_dostawcy_original"),
        supabase.from("kraje").select("kraj_id, nazwa_pl").order("nazwa_pl"),
        supabase.from("produkty").select("produkt_id, nazwa_pl").order("nazwa_pl"),
        supabase.from("odmiany").select("odmiana_id, odmiana_original, nazwa_produktu_pl").order("odmiana_original"),
        supabase
          .from("opakowania")
          .select("opakowanie_id, typ_opakowania_pl, wariant_opakowania_pl, material_tary")
          .order("typ_opakowania_pl"),
        isSuper
          ? supabase
              .from("uzytkownicy")
              .select("uzytkownik_id, imie_nazwisko, klucz_roli, status")
              .eq("klucz_roli", "import_manager")
              .eq("status", "aktywny")
          : Promise.resolve({ data: [] as Array<{ uzytkownik_id: string; imie_nazwisko: string | null }> }),
      ]);
      setDostawcy(
        (d.data ?? []).map((x) => ({
          id: x.dostawca_id,
          label: x.alias_dostawcy || x.nazwa_dostawcy_original || x.dostawca_id,
          kraj_id: x.kraj_id ?? null,
        })),
      );
      setKraje((k.data ?? []).map((x) => ({ id: x.kraj_id, label: x.nazwa_pl || x.kraj_id })));
      setProdukty((p.data ?? []).map((x) => ({ id: x.produkt_id, label: x.nazwa_pl || x.produkt_id })));
      setOdmiany(
        (o.data ?? []).map((x) => ({
          id: x.odmiana_id,
          label: `${x.odmiana_original ?? x.odmiana_id} (${x.nazwa_produktu_pl ?? "—"})`,
        })),
      );
      setOpakowania(
        (op.data ?? []).map((x) => ({
          id: x.opakowanie_id,
          label: [x.typ_opakowania_pl, x.wariant_opakowania_pl].filter(Boolean).join(" / ") || x.opakowanie_id,
          material_canonical: canonicalMaterial(x.material_tary),
        })),
      );
      if (isSuper) {
        setManagers((u.data ?? []).map((x) => ({ id: x.uzytkownik_id, label: x.imie_nazwisko || x.uzytkownik_id })));
      } else if (isImportMgr && profile?.uzytkownik_id) {
        setManagers([{ id: profile.uzytkownik_id, label: profile.imie_nazwisko || profile.uzytkownik_id }]);
      } else {
        setManagers([]);
      }
    })();
  }, [isSuper, isImportMgr, profile?.uzytkownik_id, profile?.imie_nazwisko]);

  useEffect(() => {
    if (!managerId && isImportMgr && profile?.uzytkownik_id) {
      setManagerId(profile.uzytkownik_id);
    }
  }, [profile, isImportMgr, managerId]);

  // Auto-fill kraj załadunku from selected dostawca (only if field still empty and user hasn't touched it)
  useEffect(() => {
    if (!dostawcaId) return;
    if (krajTouched || krajId) return;
    const d = dostawcy.find((x) => x.id === dostawcaId);
    if (d?.kraj_id) setKrajId(d.kraj_id);
  }, [dostawcaId, dostawcy, krajId, krajTouched]);

  const totals = useMemo(() => {
    const palety = pozycje.reduce((s, p) => s + (Number(p.palety) || 0), 0);
    const netto = pozycje.reduce((s, p) => s + (Number(p.netto_kg) || 0), 0);
    const byWal = new Map<string, number>();
    for (const p of pozycje) {
      const val = (Number(p.netto_kg) || 0) * (Number(p.cena_zakupu) || 0);
      byWal.set(p.waluta, (byWal.get(p.waluta) || 0) + val);
    }
    return { palety, netto, byWal };
  }, [pozycje]);

  const addRow = () => setPozycje((p) => [...p, { ...EMPTY_POZ }]);
  const removeRow = (i: number) => setPozycje((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<PozycjaForm>) =>
    setPozycje((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onOpakowanieChange = (i: number, v: string) => {
    if (v === CUSTOM_OPAK) {
      updateRow(i, {
        opakowanie_source: "custom",
        opakowanie_id: "",
        opakowanie_custom_text: pozycje[i].opakowanie_custom_text,
        // for custom: do not auto-set material — manager must choose;
        // keep current value if manager already chose, else clear autofilled flag.
        material_autofilled: false,
      });
      return;
    }
    const opak = opakowania.find((x) => x.id === v);
    const patch: Partial<PozycjaForm> = {
      opakowanie_source: "catalog",
      opakowanie_id: v,
      opakowanie_custom_text: "",
    };
    // Auto-fill material only if empty OR previously autofilled
    const current = pozycje[i];
    if (opak?.material_canonical && (!current.material_tary || current.material_autofilled)) {
      patch.material_tary = opak.material_canonical;
      patch.material_autofilled = true;
    }
    updateRow(i, patch);
  };

  const onMaterialChange = (i: number, v: "karton" | "drewno" | "plastik") => {
    updateRow(i, { material_tary: v, material_autofilled: false });
  };

  const validate = (): string | null => {
    if (!dataDostawy) return "Data dostawy wymagana";
    if (!dostawcaId) return "Dostawca wymagany";
    if (!managerId) return "Manager importu wymagany";
    if (pozycje.length === 0) return "Co najmniej jedna pozycja wymagana";
    for (let i = 0; i < pozycje.length; i++) {
      const p = pozycje[i];
      const n = i + 1;
      if (!p.produkt_id) return `Pozycja ${n}: produkt wymagany`;
      if (p.opakowanie_source === "catalog") {
        if (!p.opakowanie_id) return `Pozycja ${n}: opakowanie wymagane`;
      } else {
        const t = p.opakowanie_custom_text.trim();
        if (!t) return `Pozycja ${n}: wpisz własne opakowanie`;
        if (t.length > 200) return `Pozycja ${n}: opakowanie max 200 znaków`;
      }
      if (!p.material_tary) return `Pozycja ${n}: materiał tary wymagany`;
      if (!(Number(p.netto_kg) > 0)) return `Pozycja ${n}: netto kg musi być > 0`;
      if (!(Number(p.palety) >= 0)) return `Pozycja ${n}: palety >= 0`;
      if (!(Number(p.cena_zakupu) >= 0)) return `Pozycja ${n}: cena zakupu >= 0`;
      if (!["PLN", "EUR", "USD"].includes(p.waluta)) return `Pozycja ${n}: waluta PLN/EUR/USD`;
    }
    return null;
  };

  const submit = async (s: "draft" | "planned") => {
    setError(null);
    setStatus(s);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    const payload = pozycje.map((p) => ({
      produkt_id: p.produkt_id,
      odmiana_id: p.odmiana_id || null,
      opakowanie_source: p.opakowanie_source,
      opakowanie_id: p.opakowanie_source === "catalog" ? p.opakowanie_id : null,
      opakowanie_custom_text: p.opakowanie_source === "custom" ? p.opakowanie_custom_text.trim() : null,
      material_tary: p.material_tary,
      kraj_id: p.kraj_id || null,
      palety: Number(p.palety) || 0,
      ilosc_opakowan: p.ilosc_opakowan === "" ? null : Number(p.ilosc_opakowan),
      netto_kg: Number(p.netto_kg),
      brutto_kg: p.brutto_kg === "" ? null : Number(p.brutto_kg),
      cena_zakupu: Number(p.cena_zakupu),
      waluta: p.waluta,
      notes: p.notes || null,
    }));
    const { data, error: rpcErr } = await supabase.rpc("utworz_dostawe_z_pozycjami", {
      p_data_dostawy: dataDostawy,
      p_dostawca_id: dostawcaId,
      p_kraj_id: krajId || "",
      p_import_manager_id: managerId,
      p_status: s,
      p_notes: notes || "",
      p_pozycje: payload,
    });
    setSaving(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    navigate({ to: "/dostawy/$id", params: { id: data as string } });
  };

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

  const selectedDostawca = dostawcy.find((x) => x.id === dostawcaId);

  return (
    <RoleGuard path="/dostawy">
      <div className="space-y-4 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold">Nowa dostawa</h1>
          <p className="text-sm text-muted-foreground">
            Każda pozycja otrzymuje własny, unikalny identyfikator (position_id).
          </p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dane dostawy</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data dostawy *</Label>
              <Input type="date" value={dataDostawy} onChange={(e) => setDataDostawy(e.target.value)} />
            </div>
            <div>
              <Label>Dostawca *</Label>
              <Select value={dostawcaId} onValueChange={setDostawcaId}>
                <SelectTrigger><SelectValue placeholder="Wybierz dostawcę" /></SelectTrigger>
                <SelectContent>
                  {dostawcy.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDostawca?.kraj_id && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Kraj dostawcy: {kraje.find((k) => k.id === selectedDostawca.kraj_id)?.label ?? selectedDostawca.kraj_id}
                </p>
              )}
            </div>
            <div>
              <Label>Kraj załadunku</Label>
              <Select
                value={krajId}
                onValueChange={(v) => { setKrajTouched(true); setKrajId(v); }}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {kraje.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Manager importu *</Label>
              <Select value={managerId} onValueChange={setManagerId} disabled={isImportMgr && !isSuper}>
                <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {managers.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Notatki</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Pozycje</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" /> Dodaj pozycję
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {pozycje.map((p, i) => {
              const opakSelectValue = p.opakowanie_source === "custom" ? CUSTOM_OPAK : p.opakowanie_id;
              return (
                <div key={i} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pozycja {i + 1}</span>
                    {pozycje.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Produkt *</Label>
                      <Select value={p.produkt_id} onValueChange={(v) => updateRow(i, { produkt_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Wybierz produkt" /></SelectTrigger>
                        <SelectContent>
                          {produkty.map((x) => (
                            <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Odmiana</Label>
                      <Select value={p.odmiana_id} onValueChange={(v) => updateRow(i, { odmiana_id: v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {odmiany.slice(0, 200).map((x) => (
                            <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Opakowanie *</Label>
                      <Select value={opakSelectValue} onValueChange={(v) => onOpakowanieChange(i, v)}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>
                          {opakowania.map((x) => (
                            <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_OPAK}>➕ Wpisz własne opakowanie</SelectItem>
                        </SelectContent>
                      </Select>
                      {p.opakowanie_source === "custom" && (
                        <Input
                          className="mt-2"
                          placeholder="Wpisz nazwę opakowania (max 200 znaków)"
                          maxLength={200}
                          value={p.opakowanie_custom_text}
                          onChange={(e) => updateRow(i, { opakowanie_custom_text: e.target.value })}
                        />
                      )}
                    </div>
                    <div>
                      <Label>Materiał tary *</Label>
                      <div className="flex gap-2 mt-1">
                        {(["karton", "drewno", "plastik"] as const).map((m) => (
                          <Button
                            key={m}
                            type="button"
                            size="sm"
                            variant={p.material_tary === m ? "default" : "outline"}
                            onClick={() => onMaterialChange(i, m)}
                          >
                            {m === "karton" ? "Karton" : m === "drewno" ? "Drewno" : "Plastik"}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Kraj pochodzenia</Label>
                      <Select value={p.kraj_id} onValueChange={(v) => updateRow(i, { kraj_id: v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {kraje.map((x) => (
                            <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Palety</Label>
                      <Input type="number" min="0" step="1" value={p.palety} onChange={(e) => updateRow(i, { palety: e.target.value })} />
                    </div>
                    <div>
                      <Label>Ilość opakowań</Label>
                      <Input type="number" min="0" step="1" value={p.ilosc_opakowan} onChange={(e) => updateRow(i, { ilosc_opakowan: e.target.value })} />
                    </div>
                    <div>
                      <Label>Netto (kg) *</Label>
                      <Input type="number" min="0" step="0.01" value={p.netto_kg} onChange={(e) => updateRow(i, { netto_kg: e.target.value })} />
                    </div>
                    <div>
                      <Label>Brutto (kg)</Label>
                      <Input type="number" min="0" step="0.01" value={p.brutto_kg} onChange={(e) => updateRow(i, { brutto_kg: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cena zakupu *</Label>
                      <Input type="number" min="0" step="0.01" value={p.cena_zakupu} onChange={(e) => updateRow(i, { cena_zakupu: e.target.value })} />
                    </div>
                    <div>
                      <Label>Waluta *</Label>
                      <Select value={p.waluta} onValueChange={(v) => updateRow(i, { waluta: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PLN">PLN</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Notatki</Label>
                      <Input value={p.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Podsumowanie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Liczba pozycji: <strong>{pozycje.length}</strong></div>
            <div>Razem palet: <strong>{totals.palety}</strong></div>
            <div>Razem netto (kg): <strong>{totals.netto.toFixed(2)}</strong></div>
            {[...totals.byWal.entries()].map(([w, v]) => (
              <div key={w}>Wartość ({w}): <strong>{v.toFixed(2)}</strong></div>
            ))}
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button type="button" variant="outline" disabled={saving} onClick={() => submit("draft")}>
                Zapisz jako szkic
              </Button>
              <Button type="button" disabled={saving} onClick={() => submit("planned")}>
                Zapisz jako zaplanowana
              </Button>
              <Button type="button" variant="ghost" disabled={saving} onClick={() => navigate({ to: "/dostawy" })}>
                Anuluj
              </Button>
            </div>
            {saving && (
              <p className="text-xs text-muted-foreground">Zapisywanie… status: {status}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/dostawy/nowa")({
  head: () => ({ meta: [{ title: "Nowa dostawa — Tropical Trade Platform" }] }),
  component: Page,
});
