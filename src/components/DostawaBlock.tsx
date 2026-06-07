// Controlled "one dostawa inside auto" block used ONLY by AutoTransportForm.
// Intentionally SEPARATE from src/components/DostawaForm.tsx — the standalone
// DostawaForm flow (/dostawy/nowa, /dostawy/$id/edytuj) is NOT touched.
// No own RPC, no own submit, no own navigation. Emits state via onChange.

import { Trash2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MaterialTary = "" | "karton" | "drewno" | "plastik";

export interface BlockPozycja {
  produkt_id: string;
  kraj_id: string;            // kraj pochodzenia
  odmiana_id: string;
  opakowanie_id: string;      // catalog id ("" = none/custom)
  opakowanie_custom_text: string;
  material_tary: MaterialTary;
  palety: string;
  ilosc_opakowan: string;
  netto_kg: string;
  brutto_kg: string;
  cena_zakupu: string;
  notes: string;
}

export interface BlockData {
  dostawca_id: string;
  kraj_id: string;            // kraj załadunku
  data_zaladunku: string;
  data_dostawy: string;
  notes: string;
  pozycje: BlockPozycja[];
}

export const EMPTY_POZYCJA: BlockPozycja = {
  produkt_id: "",
  kraj_id: "",
  odmiana_id: "",
  opakowanie_id: "",
  opakowanie_custom_text: "",
  material_tary: "",
  palety: "",
  ilosc_opakowan: "",
  netto_kg: "",
  brutto_kg: "",
  cena_zakupu: "",
  notes: "",
};

export function emptyBlock(today: string): BlockData {
  return {
    dostawca_id: "",
    kraj_id: "",
    data_zaladunku: today,
    data_dostawy: today,
    notes: "",
    pozycje: [{ ...EMPTY_POZYCJA }],
  };
}

export interface RefOption { id: string; label: string }
export interface OpakRefOption extends RefOption { material: MaterialTary }
export interface OdmianaRefOption extends RefOption { produkt_id: string | null }

interface Props {
  index: number;
  value: BlockData;
  onChange: (next: BlockData) => void;
  onRemove?: () => void;
  removable: boolean;
  showErrors: boolean;

  dostawcy: RefOption[];
  kraje: RefOption[];
  produkty: RefOption[];
  odmiany: OdmianaRefOption[];
  opakowania: OpakRefOption[];
  todayStr: string;
}

const INT_RE = /^\d+$/;
const DEC_RE = /^\d+([.,]\d+)?$/;

function toNumOrNull(s: string): number | null {
  if (!s || !s.trim()) return null;
  const v = s.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 text-xs text-destructive flex items-center gap-1">
      <AlertCircle className="h-3 w-3" /> {msg}
    </p>
  );
}

export function validateBlock(b: BlockData, todayStr: string): string[] {
  const errs: string[] = [];
  if (!b.dostawca_id) errs.push("Dostawca wymagany");
  if (!b.kraj_id) errs.push("Kraj załadunku wymagany");
  if (!b.data_zaladunku) errs.push("Data załadunku wymagana");
  else if (b.data_zaladunku < todayStr) errs.push("Data załadunku nie może być wcześniejsza niż dzisiaj");
  if (!b.data_dostawy) errs.push("Data dostawy wymagana");
  else if (b.data_zaladunku && b.data_dostawy <= b.data_zaladunku)
    errs.push("Data dostawy musi być późniejsza niż data załadunku");
  if ((b.notes ?? "").length > 100) errs.push("Komentarz: max 100 znaków");
  if (!b.pozycje.length) errs.push("Minimum 1 pozycja");
  b.pozycje.forEach((p, i) => {
    const tag = `Pozycja ${i + 1}: `;
    if (!p.produkt_id) errs.push(tag + "produkt wymagany");
    if (!p.kraj_id) errs.push(tag + "kraj pochodzenia wymagany");
    if (!p.material_tary) errs.push(tag + "materiał tary wymagany");
    if (!INT_RE.test(p.palety.trim()) || (toNumOrNull(p.palety) ?? 0) <= 0)
      errs.push(tag + "palety muszą być > 0");
    if (!INT_RE.test(p.ilosc_opakowan.trim()) || (toNumOrNull(p.ilosc_opakowan) ?? 0) <= 0)
      errs.push(tag + "ilość opakowań > 0");
    if (!DEC_RE.test(p.netto_kg.trim()) || (toNumOrNull(p.netto_kg) ?? 0) <= 0)
      errs.push(tag + "netto kg > 0");
    const netto = toNumOrNull(p.netto_kg);
    const brutto = toNumOrNull(p.brutto_kg);
    if (!DEC_RE.test(p.brutto_kg.trim()) || (brutto ?? 0) <= 0)
      errs.push(tag + "brutto kg > 0");
    else if (netto !== null && brutto !== null && brutto < netto)
      errs.push(tag + "brutto nie może być mniejsze niż netto");
    if (!DEC_RE.test(p.cena_zakupu.trim()) || (toNumOrNull(p.cena_zakupu) ?? 0) <= 0)
      errs.push(tag + "cena za 1 kg > 0");
    if ((p.notes ?? "").length > 100) errs.push(tag + "komentarz max 100 znaków");
  });
  return errs;
}

export function DostawaBlock({
  index, value, onChange, onRemove, removable, showErrors,
  dostawcy, kraje, produkty, odmiany, opakowania, todayStr,
}: Props) {
  const errs = showErrors ? validateBlock(value, todayStr) : [];
  const update = (patch: Partial<BlockData>) => onChange({ ...value, ...patch });
  const updatePoz = (i: number, patch: Partial<BlockPozycja>) =>
    onChange({ ...value, pozycje: value.pozycje.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const addPoz = () => onChange({ ...value, pozycje: [...value.pozycje, { ...EMPTY_POZYCJA }] });
  const removePoz = (i: number) => {
    if (value.pozycje.length <= 1) return;
    onChange({ ...value, pozycje: value.pozycje.filter((_, idx) => idx !== i) });
  };

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Dostawa #{index + 1}</CardTitle>
        {removable && onRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} title="Usuń dostawę">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Dostawca *</Label>
            <Select value={value.dostawca_id} onValueChange={(v) => update({ dostawca_id: v })}>
              <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
              <SelectContent>
                {dostawcy.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kraj załadunku *</Label>
            <Select value={value.kraj_id} onValueChange={(v) => update({ kraj_id: v })}>
              <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
              <SelectContent>
                {kraje.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data załadunku *</Label>
            <Input type="date" min={todayStr} value={value.data_zaladunku}
              onChange={(e) => update({ data_zaladunku: e.target.value })} />
          </div>
          <div>
            <Label>Data dostawy *</Label>
            <Input type="date" min={value.data_zaladunku || todayStr} value={value.data_dostawy}
              onChange={(e) => update({ data_dostawy: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Komentarz</Label>
            <Input value={value.notes} maxLength={100}
              onChange={(e) => update({ notes: e.target.value })} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Pozycje ({value.pozycje.length})</h4>
            <Button type="button" variant="outline" size="sm" onClick={addPoz}>
              <Plus className="h-4 w-4" /> Dodaj pozycję
            </Button>
          </div>

          {value.pozycje.map((p, i) => {
            const odmianyForProdukt = p.produkt_id
              ? odmiany.filter((o) => o.produkt_id === p.produkt_id)
              : [];
            return (
              <Card key={i} className="bg-muted/30">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Pozycja #{i + 1}</span>
                    {value.pozycje.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePoz(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Produkt *</Label>
                      <Select value={p.produkt_id} onValueChange={(v) => updatePoz(i, { produkt_id: v, odmiana_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>
                          {produkty.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Kraj pochodzenia *</Label>
                      <Select value={p.kraj_id} onValueChange={(v) => updatePoz(i, { kraj_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>
                          {kraje.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {odmianyForProdukt.length > 0 && (
                      <div>
                        <Label>Odmiana / Sort</Label>
                        <Select value={p.odmiana_id || "__none__"} onValueChange={(v) => updatePoz(i, { odmiana_id: v === "__none__" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— brak —</SelectItem>
                            {odmianyForProdukt.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Opakowanie</Label>
                      <Select
                        value={p.opakowanie_id || "__none__"}
                        onValueChange={(v) => {
                          if (v === "__none__") {
                            updatePoz(i, { opakowanie_id: "", opakowanie_custom_text: "" });
                          } else {
                            const op = opakowania.find((o) => o.id === v);
                            updatePoz(i, {
                              opakowanie_id: v,
                              opakowanie_custom_text: "",
                              material_tary: p.material_tary || (op?.material ?? ""),
                            });
                          }
                        }}>
                        <SelectTrigger><SelectValue placeholder="Brak / własne" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— brak —</SelectItem>
                          {opakowania.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Materiał tary *</Label>
                      <Select value={p.material_tary || "__none__"} onValueChange={(v) => updatePoz(i, { material_tary: (v === "__none__" ? "" : v) as MaterialTary })}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="karton">karton</SelectItem>
                          <SelectItem value="drewno">drewno</SelectItem>
                          <SelectItem value="plastik">plastik</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Palety *</Label>
                      <Input inputMode="numeric" value={p.palety} onChange={(e) => updatePoz(i, { palety: e.target.value })} />
                    </div>
                    <div>
                      <Label>Ilość opakowań *</Label>
                      <Input inputMode="numeric" value={p.ilosc_opakowan} onChange={(e) => updatePoz(i, { ilosc_opakowan: e.target.value })} />
                    </div>
                    <div>
                      <Label>Netto kg *</Label>
                      <Input inputMode="decimal" value={p.netto_kg} onChange={(e) => updatePoz(i, { netto_kg: e.target.value })} />
                    </div>
                    <div>
                      <Label>Brutto kg *</Label>
                      <Input inputMode="decimal" value={p.brutto_kg} onChange={(e) => updatePoz(i, { brutto_kg: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cena za 1 kg (EUR) *</Label>
                      <Input inputMode="decimal" value={p.cena_zakupu} onChange={(e) => updatePoz(i, { cena_zakupu: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Komentarz pozycji</Label>
                      <Input value={p.notes} maxLength={100} onChange={(e) => updatePoz(i, { notes: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {showErrors && errs.length > 0 && (
          <div className="text-xs text-destructive space-y-0.5">
            {errs.map((e, i) => <FieldErr key={i} msg={e} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Build the per-dostawa pozycja payload exactly as utworz_dostawe_z_pozycjami
// expects it (mirror of DostawaForm.tsx submit shape).
export function buildPozycjaPayload(p: BlockPozycja) {
  return {
    id: null,
    produkt_id: p.produkt_id,
    odmiana_id: p.odmiana_id || null,
    opakowanie_source: p.opakowanie_id ? "catalog" : (p.opakowanie_custom_text.trim() ? "custom" : "none"),
    opakowanie_id: p.opakowanie_id || null,
    opakowanie_custom_text: p.opakowanie_id ? null : (p.opakowanie_custom_text.trim() || null),
    material_tary: p.material_tary,
    kraj_id: p.kraj_id || null,
    palety: toNumOrNull(p.palety) ?? 0,
    ilosc_opakowan: toNumOrNull(p.ilosc_opakowan),
    netto_kg: toNumOrNull(p.netto_kg) as number,
    brutto_kg: toNumOrNull(p.brutto_kg) as number,
    cena_zakupu: toNumOrNull(p.cena_zakupu) as number,
    waluta: "EUR",
    notes: p.notes || null,
  };
}

export function blockTotals(blocks: BlockData[]): { palety: number; brutto: number } {
  let palety = 0;
  let brutto = 0;
  for (const b of blocks) {
    for (const p of b.pozycje) {
      palety += toNumOrNull(p.palety) ?? 0;
      brutto += toNumOrNull(p.brutto_kg) ?? 0;
    }
  }
  return { palety, brutto };
}
