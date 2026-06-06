import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Vehicle capacity hard limits
const MAX_PALETY = 26;
const MAX_BRUTTO_KG = 21500;

// Local (not UTC) YYYY-MM-DD for date validation
function localTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const INT_RE = /^\d+$/;
const DEC_RE = /^\d+([.,]\d+)?$/;


// ---------- Types ----------
interface RefItem { id: string; label: string; search?: string; }
interface ProduktItem extends RefItem {}
interface OpakItem extends RefItem {
  material_canonical: "karton" | "drewno" | "plastik" | null;
}
interface OdmianaItem extends RefItem { produkt_id: string | null; }
interface DostawcaItem extends RefItem { kraj_id: string | null; }
interface KrajItem extends RefItem { iso3: string | null; }
interface StandardRow {
  produkt_id: string; opakowanie_id: string; iso3_kraju: string | null;
  liczba_opakowan_na_palecie: number | null;
  waga_netto_opakowania_kg: number | null;
  waga_brutto_opakowania_kg: number | null;
}

type MaterialTary = "" | "karton" | "drewno" | "plastik";
type OpakSource = "catalog" | "custom" | "none";

interface PozycjaForm {
  id?: string; // present on edit-mode rows from DB
  produkt_id: string; produkt_query: string;
  kraj_id: string; kraj_query: string;
  odmiana_id: string;
  opakowanie_source: OpakSource;
  opakowanie_id: string; opakowanie_query: string; opakowanie_custom_text: string;
  material_tary: MaterialTary; material_autofilled: boolean;
  palety: string; ilosc_opakowan: string;
  netto_kg: string; brutto_kg: string; weights_autofilled: boolean;
  cena_zakupu: string; waluta: string; notes: string;
}

const EMPTY_POZ: PozycjaForm = {
  produkt_id: "", produkt_query: "",
  kraj_id: "", kraj_query: "",
  odmiana_id: "",
  opakowanie_source: "none",
  opakowanie_id: "", opakowanie_query: "", opakowanie_custom_text: "",
  material_tary: "", material_autofilled: false,
  palety: "", ilosc_opakowan: "",
  netto_kg: "", brutto_kg: "", weights_autofilled: false,
  cena_zakupu: "", waluta: "EUR", notes: "",
};

// ---------- Helpers ----------
function canonicalMaterial(raw: string | null | undefined): "karton" | "drewno" | "plastik" | null {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v) return null;
  if (["karton","carton","cardboard","tektura","tekturowa","tekturowe"].includes(v)) return "karton";
  if (["drewno","wood","drewniana","drewniane","wooden"].includes(v)) return "drewno";
  if (["plastik","plastic","plastikowa","plastikowe","pp","pet","hdpe","ldpe","ps","eps","styropian","folia"].includes(v)) return "plastik";
  return null;
}
function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g,"l").replace(/Ł/g,"l");
}
function startsWithWord(target: string, query: string): boolean {
  const t = " " + normalize(target);
  const q = normalize(query);
  if (q.length < 2) return false;
  return t.includes(" " + q);
}
function toNum(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(String(s).replace(",","."));
  return isFinite(n) ? n : null;
}
function isBlank(s: string): boolean {
  return s === null || s === undefined || String(s).trim() === "";
}

// ---------- Calculation engine ----------
type ChangedField = "produkt"|"kraj"|"odmiana"|"opakowanie"|"material_tary"|"palety"|"ilosc_opakowan"|"netto_kg"|"brutto_kg"|"cena_zakupu"|"waluta"|"notes";
interface PositionCalculation { next: PozycjaForm; standard: StandardRow | null; warnings: string[]; }

function fmtAmount(n: number, frac = 2): string {
  return Number.isInteger(n) && frac === 0 ? String(n) : n.toFixed(frac);
}
function differsFromExpected(actual: string, expected: number | null): boolean {
  const a = toNum(actual);
  if (a === null || expected === null) return false;
  return Math.abs(a - expected) > 0.01;
}

function calculatePositionLine(input: PozycjaForm, changedField: ChangedField, standard: StandardRow | null): PositionCalculation {
  const next: PozycjaForm = { ...input };
  const warnings: string[] = [];
  if (next.opakowanie_source !== "catalog" || !standard) {
    if (changedField === "opakowanie" || changedField === "produkt" || changedField === "kraj") {
      next.weights_autofilled = false;
    }
    return { next, standard: null, warnings };
  }
  const boxesPerPallet = standard.liczba_opakowan_na_palecie;
  const netPerBox = standard.waga_netto_opakowania_kg;
  const grossPerBox = standard.waga_brutto_opakowania_kg;
  const palety = toNum(next.palety);
  const boxes = toNum(next.ilosc_opakowan);

  const recalcFromBoxes = (boxCount: number) => {
    next.ilosc_opakowan = fmtAmount(boxCount, 0);
    if (netPerBox !== null) next.netto_kg = fmtAmount(boxCount * netPerBox);
    if (grossPerBox !== null) next.brutto_kg = fmtAmount(boxCount * grossPerBox);
    next.weights_autofilled = true;
  };

  if (changedField === "palety" || changedField === "opakowanie" || changedField === "produkt" || changedField === "kraj") {
    if (palety !== null && boxesPerPallet !== null) {
      recalcFromBoxes(Math.max(0, palety) * boxesPerPallet);
    } else if (boxes !== null) {
      recalcFromBoxes(Math.max(0, boxes));
    }
  } else if (changedField === "ilosc_opakowan" && boxes !== null) {
    recalcFromBoxes(Math.max(0, boxes));
  } else if (changedField === "netto_kg" || changedField === "brutto_kg") {
    next.weights_autofilled = false;
  }

  const expectedBoxes = palety !== null && boxesPerPallet !== null ? Math.max(0,palety)*boxesPerPallet : null;
  const expectedNet = expectedBoxes !== null && netPerBox !== null ? expectedBoxes*netPerBox : null;
  const expectedGross = expectedBoxes !== null && grossPerBox !== null ? expectedBoxes*grossPerBox : null;
  if (!next.weights_autofilled &&
      (differsFromExpected(next.ilosc_opakowan, expectedBoxes) ||
       differsFromExpected(next.netto_kg, expectedNet) ||
       differsFromExpected(next.brutto_kg, expectedGross))) {
    warnings.push("Ręczna korekta wartości względem standardu palety");
  }
  return { next, standard, warnings };
}

// ---------- Field validation ----------
// Letters (incl. Polish), spaces, hyphen only — for combobox typed search text
const LETTERS_RE = /^[A-Za-zÀ-ÖØ-öø-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻż\s-]*$/;
function lettersOnlyError(q: string): string | undefined {
  return q && !LETTERS_RE.test(q) ? "Dozwolone są tylko litery" : undefined;
}

type FieldErrors = Partial<Record<keyof PozycjaForm | "opakowanie", string>>;
function validatePosition(p: PozycjaForm): FieldErrors {
  const e: FieldErrors = {};
  if (!p.produkt_id) {
    const le = lettersOnlyError(p.produkt_query);
    e.produkt_id = le ?? (p.produkt_query.trim() ? "Wybierz produkt z listy" : "Produkt wymagany");
  }
  if (!p.kraj_id) {
    const le = lettersOnlyError(p.kraj_query);
    e.kraj_id = le ?? (p.kraj_query.trim() ? "Wybierz kraj z listy" : "Kraj pochodzenia wymagany");
  }
  if (p.opakowanie_source === "custom") {
    const t = p.opakowanie_custom_text.trim();
    if (t.length > 200) e.opakowanie_custom_text = "Max 200 znaków";
  }
  if (!p.material_tary) e.material_tary = "Materiał tary wymagany";
  const palety = toNum(p.palety);
  const ilosc = toNum(p.ilosc_opakowan);
  const netto = toNum(p.netto_kg);
  const brutto = toNum(p.brutto_kg);
  const cena = toNum(p.cena_zakupu);
  if (isBlank(p.palety)) e.palety = "Liczba palet wymagana";
  else if (!INT_RE.test(p.palety.trim())) e.palety = "Dozwolone są tylko cyfry";
  else if (palety === null || palety <= 0) e.palety = "Liczba palet musi być większa niż 0";
  if (isBlank(p.ilosc_opakowan)) e.ilosc_opakowan = "Ilość opakowań wymagana";
  else if (!INT_RE.test(p.ilosc_opakowan.trim())) e.ilosc_opakowan = "Dozwolone są tylko cyfry";
  else if (ilosc === null || ilosc <= 0) e.ilosc_opakowan = "Ilość opakowań musi być większa niż 0";
  if (isBlank(p.netto_kg)) e.netto_kg = "Netto kg wymagane";
  else if (!DEC_RE.test(p.netto_kg.trim())) e.netto_kg = "Dozwolone są tylko cyfry, przecinek lub kropka";
  else if (netto === null || netto <= 0) e.netto_kg = "Netto kg musi być większe niż 0";
  if (isBlank(p.brutto_kg)) e.brutto_kg = "Brutto kg wymagane";
  else if (!DEC_RE.test(p.brutto_kg.trim())) e.brutto_kg = "Dozwolone są tylko cyfry, przecinek lub kropka";
  else if (brutto === null || brutto <= 0) e.brutto_kg = "Brutto kg musi być większe niż 0";
  else if (netto !== null && brutto < netto) e.brutto_kg = "Brutto kg nie może być mniejsze niż netto kg";
  if (isBlank(p.cena_zakupu)) e.cena_zakupu = "Cena za 1 kg wymagana";
  else if (!DEC_RE.test(p.cena_zakupu.trim())) e.cena_zakupu = "Dozwolone są tylko cyfry, przecinek lub kropka";
  else if (cena === null || cena <= 0) e.cena_zakupu = "Cena za 1 kg musi być większa niż 0";
  if ((p.notes ?? "").length > 100) e.notes = "Maksymalnie 100 znaków";
  // standardy_palet are helper-only. Do NOT block save on mismatch.
  return e;
}


// ---------- Combobox ----------
interface ComboProps {
  items: RefItem[]; value: string; query: string;
  onQuery: (s: string) => void;
  onPick: (id: string, label: string) => void;
  onBlurInput?: () => void;
  placeholder?: string; minChars?: number;
  extraTop?: React.ReactNode; showInitialItems?: boolean; maxItems?: number;
  filterFn?: (item: RefItem, query: string) => boolean;
  invalid?: boolean;
  initialItems?: RefItem[];
  emptyInitialMessage?: string;
}
function Combobox({ items, value, query, onQuery, onPick, onBlurInput, placeholder, minChars = 2,
                   extraTop, showInitialItems = false, maxItems = 20, filterFn, invalid,
                   initialItems, emptyInitialMessage }: ComboProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const isInitial = query.trim().length < minChars;
  const filtered = useMemo(() => {
    if (isInitial) {
      if (!showInitialItems) return [];
      return (initialItems ?? items).slice(0, maxItems);
    }
    const fn = filterFn ?? ((it: RefItem, q: string) => startsWithWord(it.search ?? it.label, q));
    return items.filter((it) => fn(it, query)).slice(0, maxItems);
  }, [items, initialItems, query, isInitial, showInitialItems, filterFn, maxItems]);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex gap-1">
        <Input value={query} placeholder={placeholder}
          className={cn(invalid && "border-destructive focus-visible:ring-destructive field-invalid-pulse")}
          aria-invalid={invalid || undefined}
          onFocus={() => setOpen(true)}
          onChange={(e) => { onQuery(e.target.value); setOpen(true); }}
          onBlur={onBlurInput} />
        {value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => { onPick("",""); onQuery(""); }} title="Wyczyść">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-auto">
          {extraTop}
          {isInitial && !showInitialItems ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Zacznij wpisywać…</div>
          ) : isInitial && filtered.length === 0 && emptyInitialMessage ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{emptyInitialMessage}</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Brak wyników</div>
          ) : (
            filtered.map((it) => (
              <button key={it.id} type="button"
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
                onClick={() => { onPick(it.id, it.label); setOpen(false); }}>
                {it.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {msg}</p>;
}

// ====================================================================
// Main Form Component
// ====================================================================
export interface ExistingDostawa {
  id: string;
  numer_dostawy: string;
  data_dostawy: string;
  data_zaladunku: string | null;
  status: "draft" | "planned";
  dostawca_id: string;
  kraj_id: string | null;
  import_manager_id: string;
  notes: string | null;
  positions: Array<{
    id: string;
    produkt_id: string;
    odmiana_id: string | null;
    opakowanie_id: string | null;
    opakowanie_source: OpakSource;
    opakowanie_custom_text: string | null;
    material_tary: "karton"|"drewno"|"plastik";
    kraj_id: string | null;
    palety: number;
    ilosc_opakowan: number | null;
    netto_kg: number;
    brutto_kg: number | null;
    cena_zakupu: number;
    waluta: string;
    notes: string | null;
  }>;
}

interface DostawaFormProps {
  mode: "create" | "edit";
  existing?: ExistingDostawa;
}

export function DostawaForm({ mode, existing }: DostawaFormProps) {
  const navigate = useNavigate();
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");

  const [dostawcy, setDostawcy] = useState<DostawcaItem[]>([]);
  const [kraje, setKraje] = useState<KrajItem[]>([]);
  const [produkty, setProdukty] = useState<ProduktItem[]>([]);
  const [odmiany, setOdmiany] = useState<OdmianaItem[]>([]);
  const [opakowania, setOpakowania] = useState<OpakItem[]>([]);
  const [managers, setManagers] = useState<RefItem[]>([]);
  const [standardy, setStandardy] = useState<StandardRow[]>([]);
  // alias index: normalized alias -> Set of produkt_id / kraj_id / dostawca_id
  const [produktAliases, setProduktAliases] = useState<Map<string, Set<string>>>(new Map());
  const [krajAliases, setKrajAliases] = useState<Map<string, Set<string>>>(new Map());
  const [dostawcaAliases, setDostawcaAliases] = useState<Map<string, Set<string>>>(new Map());

  const today = localTodayStr();
  const [dataZaladunku, setDataZaladunku] = useState(existing?.data_zaladunku ?? today);
  const [dataDostawy, setDataDostawy] = useState(existing?.data_dostawy ?? today);
  const [dostawcaId, setDostawcaId] = useState(existing?.dostawca_id ?? "");
  const [dostawcaQuery, setDostawcaQuery] = useState("");
  const [krajId, setKrajId] = useState(existing?.kraj_id ?? "");
  const [krajZaladunkuQuery, setKrajZaladunkuQuery] = useState("");
  const [krajManuallySet, setKrajManuallySet] = useState(mode === "edit");
  const [krajAutofilledFromSupplier, setKrajAutofilledFromSupplier] = useState<string | null>(null);
  const [managerId, setManagerId] = useState(existing?.import_manager_id ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState<"draft" | "planned">(existing?.status ?? "draft");
  const [pozycje, setPozycje] = useState<PozycjaForm[]>(
    existing
      ? existing.positions.map((p) => ({
          id: p.id,
          produkt_id: p.produkt_id, produkt_query: "",
          kraj_id: p.kraj_id ?? "", kraj_query: "",
          odmiana_id: p.odmiana_id ?? "",
          opakowanie_source: p.opakowanie_source,
          opakowanie_id: p.opakowanie_id ?? "",
          opakowanie_query: p.opakowanie_custom_text ?? "",
          opakowanie_custom_text: p.opakowanie_custom_text ?? "",
          material_tary: p.material_tary,
          material_autofilled: false,
          palety: String(p.palety ?? 0),
          ilosc_opakowan: p.ilosc_opakowan == null ? "" : String(p.ilosc_opakowan),
          netto_kg: String(p.netto_kg ?? ""),
          brutto_kg: p.brutto_kg == null ? "" : String(p.brutto_kg),
          weights_autofilled: false,
          cena_zakupu: String(p.cena_zakupu ?? ""),
          waluta: p.waluta || "EUR",
          notes: p.notes ?? "",
        }))
      : [{ ...EMPTY_POZ }],
  );
  const [saving, setSaving] = useState(false);
  const [submitTried, setSubmitTried] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const triggerShake = () => {
    setShakeKey((k) => k + 1);
    try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([60, 40, 60]); } catch { /* noop */ }
  };

  // -----------------------------------------------------------------
  // Load reference data + aliases
  // -----------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const [d, k, p, o, op, st, u, ap, ak, ad] = await Promise.all([
        supabase.from("dostawcy").select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy, kraj_id").order("nazwa_dostawcy_original"),
        supabase.from("kraje").select("kraj_id, nazwa_pl, iso3").order("nazwa_pl"),
        supabase.from("produkty").select("produkt_id, nazwa_pl, aliasy_pl").order("nazwa_pl"),
        supabase.from("odmiany").select("odmiana_id, odmiana_original, nazwa_produktu_pl, produkt_id").order("odmiana_original"),
        supabase.from("opakowania").select("opakowanie_id, typ_opakowania_pl, wariant_opakowania_pl, material_tary").order("typ_opakowania_pl"),
        supabase.from("standardy_palet").select("produkt_id, opakowanie_id, iso3_kraju, liczba_opakowan_na_palecie, waga_netto_opakowania_kg, waga_brutto_opakowania_kg, waga_netto_palety_kg, waga_brutto_palety_z_paleta_kg"),
        isSuper
          ? supabase.from("uzytkownicy").select("uzytkownik_id, imie_nazwisko, klucz_roli, status").eq("klucz_roli","import_manager").eq("status","aktywny")
          : Promise.resolve({ data: [] as Array<{ uzytkownik_id: string; imie_nazwisko: string | null }> }),
        supabase.from("aliasy_produktow").select("alias, produkt_id").not("produkt_id","is",null),
        supabase.from("aliasy_krajow").select("alias, kraj_id").not("kraj_id","is",null),
        supabase.from("aliasy_dostawcow").select("alias, dostawca_id").not("dostawca_id","is",null),
      ]);
      setDostawcy((d.data ?? []).map((x) => {
        const primary = x.nazwa_dostawcy_original || x.alias_dostawcy || x.dostawca_id;
        const alias = x.alias_dostawcy && x.alias_dostawcy !== primary ? ` (${x.alias_dostawcy})` : "";
        return { id: x.dostawca_id, label: primary + alias, search: `${primary} ${x.alias_dostawcy ?? ""}`, kraj_id: x.kraj_id ?? null };
      }));
      setKraje((k.data ?? []).map((x) => ({ id: x.kraj_id, label: x.nazwa_pl || x.kraj_id, search: `${x.nazwa_pl ?? ""} ${x.iso3 ?? ""}`, iso3: x.iso3 ?? null })));
      setProdukty((p.data ?? []).map((x) => ({ id: x.produkt_id, label: x.nazwa_pl || x.produkt_id, search: `${x.nazwa_pl ?? ""} ${x.aliasy_pl ?? ""}` })));
      setOdmiany((o.data ?? []).map((x) => ({ id: x.odmiana_id, label: x.odmiana_original ?? x.odmiana_id, produkt_id: x.produkt_id ?? null })));
      setOpakowania((op.data ?? []).map((x) => ({
        id: x.opakowanie_id,
        label: [x.typ_opakowania_pl, x.wariant_opakowania_pl].filter(Boolean).join(" / ") || x.opakowanie_id,
        search: `${x.typ_opakowania_pl ?? ""} ${x.wariant_opakowania_pl ?? ""}`,
        material_canonical: canonicalMaterial(x.material_tary),
      })));
      setStandardy(((st.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        produkt_id: String(r.produkt_id ?? ""),
        opakowanie_id: String(r.opakowanie_id ?? ""),
        iso3_kraju: r.iso3_kraju ? String(r.iso3_kraju) : null,
        liczba_opakowan_na_palecie: toNum(r.liczba_opakowan_na_palecie as string),
        waga_netto_opakowania_kg: toNum(r.waga_netto_opakowania_kg as string),
        waga_brutto_opakowania_kg: toNum(r.waga_brutto_opakowania_kg as string),
      })));
      if (isSuper) {
        setManagers((u.data ?? []).map((x) => ({ id: x.uzytkownik_id, label: x.imie_nazwisko || x.uzytkownik_id })));
      } else if (isImportMgr && profile?.uzytkownik_id) {
        setManagers([{ id: profile.uzytkownik_id, label: profile.imie_nazwisko || profile.uzytkownik_id }]);
      } else {
        setManagers([]);
      }

      // Build alias indexes
      const pa = new Map<string, Set<string>>();
      for (const row of (ap.data ?? []) as Array<{ alias: string | null; produkt_id: string | null }>) {
        if (!row.alias || !row.produkt_id) continue;
        const key = normalize(row.alias);
        if (!key) continue;
        if (!pa.has(key)) pa.set(key, new Set());
        pa.get(key)!.add(row.produkt_id);
      }
      setProduktAliases(pa);

      const ka = new Map<string, Set<string>>();
      for (const row of (ak.data ?? []) as Array<{ alias: string | null; kraj_id: string | null }>) {
        if (!row.alias || !row.kraj_id) continue;
        const key = normalize(row.alias);
        if (!key) continue;
        if (!ka.has(key)) ka.set(key, new Set());
        ka.get(key)!.add(row.kraj_id);
      }
      setKrajAliases(ka);

      const da = new Map<string, Set<string>>();
      for (const row of (ad.data ?? []) as Array<{ alias: string | null; dostawca_id: string | null }>) {
        if (!row.alias || !row.dostawca_id) continue;
        const key = normalize(row.alias);
        if (!key) continue;
        if (!da.has(key)) da.set(key, new Set());
        da.get(key)!.add(row.dostawca_id);
      }
      setDostawcaAliases(da);
    })();
  }, [isSuper, isImportMgr, profile?.uzytkownik_id, profile?.imie_nazwisko]);

  // Hydrate produkt_query / kraj_query / opakowanie_query after labels load (edit mode)
  useEffect(() => {
    if (mode !== "edit" || !existing) return;
    if (!produkty.length && !kraje.length && !opakowania.length) return;
    setPozycje((prev) =>
      prev.map((row) => {
        const next = { ...row };
        if (!next.produkt_query && next.produkt_id) {
          next.produkt_query = produkty.find((x) => x.id === next.produkt_id)?.label ?? "";
        }
        if (!next.kraj_query && next.kraj_id) {
          next.kraj_query = kraje.find((x) => x.id === next.kraj_id)?.label ?? "";
        }
        if (!next.opakowanie_query && next.opakowanie_source === "catalog" && next.opakowanie_id) {
          next.opakowanie_query = opakowania.find((x) => x.id === next.opakowanie_id)?.label ?? "";
        }
        return next;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produkty, kraje, opakowania]);

  // Hydrate header combobox queries from loaded labels
  useEffect(() => {
    if (!dostawcaQuery && dostawcaId && dostawcy.length) {
      const d = dostawcy.find((x) => x.id === dostawcaId);
      if (d) setDostawcaQuery(d.label);
    }
    if (!krajZaladunkuQuery && krajId && kraje.length) {
      const k = kraje.find((x) => x.id === krajId);
      if (k) setKrajZaladunkuQuery(k.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dostawcy, kraje, dostawcaId, krajId]);

  useEffect(() => {
    if (mode !== "create" || managerId) return;
    if (isImportMgr && profile?.uzytkownik_id) { setManagerId(profile.uzytkownik_id); return; }
    if (managers.length === 1) { setManagerId(managers[0].id); }
  }, [profile, isImportMgr, managerId, mode, managers]);


  // Auto-fill loading country from supplier (only create mode)
  useEffect(() => {
    if (mode !== "create") return;
    if (!dostawcaId) return;
    const d = dostawcy.find((x) => x.id === dostawcaId);
    if (!d?.kraj_id) return;
    if (krajManuallySet) return;
    if (!krajId || krajAutofilledFromSupplier === krajId) {
      setKrajId(d.kraj_id);
      setKrajAutofilledFromSupplier(d.kraj_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dostawcaId, dostawcy]);


  const insertSupplierCountry = () => {
    const d = dostawcy.find((x) => x.id === dostawcaId);
    if (d?.kraj_id) {
      setKrajId(d.kraj_id);
      setKrajManuallySet(false);
      setKrajAutofilledFromSupplier(d.kraj_id);
    }
  };

  // ---------- Alias-aware filters ----------
  const produktFilter = (item: RefItem, q: string): boolean => {
    if (startsWithWord(item.search ?? item.label, q)) return true;
    const norm = normalize(q);
    if (norm.length < 2) return false;
    for (const [aliasKey, ids] of produktAliases) {
      if (aliasKey.startsWith(norm) && ids.has(item.id)) return true;
    }
    return false;
  };
  const krajFilter = (item: RefItem, q: string): boolean => {
    if (startsWithWord(item.search ?? item.label, q)) return true;
    const norm = normalize(q);
    if (norm.length < 2) return false;
    for (const [aliasKey, ids] of krajAliases) {
      if (aliasKey.startsWith(norm) && ids.has(item.id)) return true;
    }
    return false;
  };
  const dostawcaFilter = (item: RefItem, q: string): boolean => {
    if (startsWithWord(item.search ?? item.label, q)) return true;
    const norm = normalize(q);
    if (norm.length < 2) return false;
    for (const [aliasKey, ids] of dostawcaAliases) {
      if (aliasKey.startsWith(norm) && ids.has(item.id)) return true;
    }
    return false;
  };

  // ---------- Row ops ----------
  const addRow = () => setPozycje((p) => [...p, { ...EMPTY_POZ }]);
  const removeRow = (i: number) => {
    const target = pozycje[i];
    if (mode === "edit" && target?.id) {
      alert("Usuwanie zapisanych pozycji nie jest jeszcze obsługiwane. Możesz tylko dodawać nowe lub zmieniać istniejące.");
      return;
    }
    setPozycje((p) => p.filter((_, idx) => idx !== i));
  };
  const updateRow = (i: number, patch: Partial<PozycjaForm>) =>
    setPozycje((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const findStandard = (produkt_id: string, opakowanie_id: string, kraj_id: string): StandardRow | null => {
    if (!produkt_id || !opakowanie_id) return null;
    const iso3 = kraje.find((k) => k.id === kraj_id)?.iso3 ?? null;
    const matches = standardy.filter((s) => s.produkt_id === produkt_id && s.opakowanie_id === opakowanie_id);
    if (matches.length === 0) return null;
    if (iso3) {
      const exact = matches.find((m) => (m.iso3_kraju ?? "").toUpperCase() === iso3.toUpperCase());
      if (exact) return exact;
    }
    return matches[0];
  };

  // Initial Opakowanie suggestions: based on Produkt + row Kraj pochodzenia (NOT Kraj załadunku).
  // Exact ISO3 standards first, then generic (null iso3_kraju). Standards for other country-specific ISO3 excluded.
  const suggestedOpakIdsOrdered = (produkt_id: string, kraj_id: string): { exact: string[]; generic: string[]; hasAnyStandard: boolean } => {
    if (!produkt_id) return { exact: [], generic: [], hasAnyStandard: false };
    const iso3 = kraje.find((k) => k.id === kraj_id)?.iso3 ?? null;
    const exact = new Set<string>();
    const generic = new Set<string>();
    let hasAnyStandard = false;
    for (const r of standardy) {
      if (r.produkt_id !== produkt_id) continue;
      hasAnyStandard = true;
      const rIso = r.iso3_kraju ? r.iso3_kraju.toUpperCase() : null;
      if (!iso3) {
        // No country picked yet — show all standards for product
        if (rIso) exact.add(r.opakowanie_id);
        else generic.add(r.opakowanie_id);
      } else {
        if (rIso === iso3.toUpperCase()) exact.add(r.opakowanie_id);
        else if (!rIso) generic.add(r.opakowanie_id);
        // other country-specific standards excluded from initial list
      }
    }
    return { exact: [...exact], generic: [...generic].filter((id) => !exact.has(id)), hasAnyStandard };
  };


  const applyChainedPatch = (i: number, patch: Partial<PozycjaForm>, changedField: ChangedField) => {
    const merged: PozycjaForm = { ...pozycje[i], ...patch };
    const std = findStandard(merged.produkt_id, merged.opakowanie_id, merged.kraj_id);
    updateRow(i, calculatePositionLine(merged, changedField, std).next);
  };

  const onPickProdukt = (i: number, id: string, label: string) => {
    const cur = pozycje[i];
    const od = odmiany.find((x) => x.id === cur.odmiana_id);
    const odmiana_id = od && od.produkt_id !== id ? "" : cur.odmiana_id;
    applyChainedPatch(i, {
      produkt_id: id, produkt_query: label, odmiana_id,
      opakowanie_source: "none", opakowanie_id: "", opakowanie_query: "", opakowanie_custom_text: "",
      material_autofilled: false, weights_autofilled: false,
    }, "produkt");
  };

  const onPickKrajPoch = (i: number, id: string, label: string) => {
    applyChainedPatch(i, { kraj_id: id, kraj_query: label }, "kraj");
  };

  const onPickOpakowanie = (i: number, id: string, label: string) => {
    if (!id) { onOpakowanieQuery(i, ""); return; }
    const cur = pozycje[i];
    const opak = opakowania.find((x) => x.id === id);
    const patch: Partial<PozycjaForm> = {
      opakowanie_source: "catalog", opakowanie_id: id, opakowanie_query: label, opakowanie_custom_text: "",
    };
    if (opak?.material_canonical && (!cur.material_tary || cur.material_autofilled)) {
      patch.material_tary = opak.material_canonical;
      patch.material_autofilled = true;
    }
    applyChainedPatch(i, patch, "opakowanie");
  };

  const onOpakowanieQuery = (i: number, raw: string) => {
    const text = raw.trim();
    updateRow(i, {
      opakowanie_query: raw, opakowanie_id: "",
      opakowanie_custom_text: text,
      opakowanie_source: text ? "custom" : "none",
      material_autofilled: false, weights_autofilled: false,
    });
  };

  const onPaletyChange = (i: number, v: string) => applyChainedPatch(i, { palety: v }, "palety");
  const onIloscOpakowanChange = (i: number, v: string) => applyChainedPatch(i, { ilosc_opakowan: v }, "ilosc_opakowan");
  const onMaterialChange = (i: number, v: "karton"|"drewno"|"plastik") => updateRow(i, { material_tary: v, material_autofilled: false });

  // ---------- Errors, totals, capacity ----------
  const lineErrors: FieldErrors[] = useMemo(
    () => pozycje.map((p) => validatePosition(p)),
    [pozycje],
  );
  const lineWarnings: string[][] = useMemo(
    () => pozycje.map((p) => calculatePositionLine(p, "notes", findStandard(p.produkt_id, p.opakowanie_id, p.kraj_id)).warnings),
    [pozycje, standardy, kraje],
  );

  const totals = useMemo(() => {
    const palety = pozycje.reduce((s, p) => s + (Number(p.palety) || 0), 0);
    const netto = pozycje.reduce((s, p) => s + (Number(p.netto_kg) || 0), 0);
    const brutto = pozycje.reduce((s, p) => s + (Number(p.brutto_kg) || 0), 0);
    const byWal = new Map<string, number>();
    for (const p of pozycje) {
      const val = (Number(p.netto_kg) || 0) * (Number(p.cena_zakupu) || 0);
      byWal.set(p.waluta, (byWal.get(p.waluta) || 0) + val);
    }
    return { palety, netto, brutto, byWal };
  }, [pozycje]);

  const capacityErrors: string[] = useMemo(() => {
    const errs: string[] = [];
    if (totals.palety > MAX_PALETY) errs.push(`Łączna liczba palet ${totals.palety} przekracza limit auta (${MAX_PALETY}).`);
    if (totals.brutto > MAX_BRUTTO_KG) errs.push(`Łączna waga brutto ${totals.brutto.toFixed(2)} kg przekracza limit auta (${MAX_BRUTTO_KG} kg).`);
    return errs;
  }, [totals]);

  const todayStr = localTodayStr();
  const headerErrors: string[] = useMemo(() => {
    const errs: string[] = [];
    if (!dostawcaId) errs.push(dostawcaQuery.trim() ? "Wybierz dostawcę z listy" : "Dostawca wymagany");
    if (!krajId) errs.push(krajZaladunkuQuery.trim() ? "Wybierz kraj z listy" : "Kraj załadunku wymagany");
    if (!dataZaladunku) errs.push("Data załadunku wymagana");
    else if (dataZaladunku < todayStr) errs.push("Data załadunku nie może być wcześniejsza niż dzisiaj");
    if (!dataDostawy) errs.push("Data dostawy wymagana");
    else if (dataZaladunku && dataDostawy <= dataZaladunku) errs.push("Data dostawy musi być późniejsza niż data załadunku");
    if (!managerId) errs.push("Import manager wymagany");
    if ((notes ?? "").length > 100) errs.push("Komentarz: maksymalnie 100 znaków");

    return errs;
  }, [dataZaladunku, dataDostawy, dostawcaId, dostawcaQuery, krajId, krajZaladunkuQuery, managerId, notes, todayStr]);

  const hasAnyError =
    headerErrors.length > 0 ||
    capacityErrors.length > 0 ||
    lineErrors.some((e) => Object.keys(e).length > 0);

  // ---------- Submit ----------
  const submit = async (s: "draft" | "planned") => {
    setSubmitError(null);
    setSubmitTried(true);
    setStatus(s);
    if (hasAnyError) {
      setSubmitError("Formularz zawiera błędy. Popraw zaznaczone pola.");
      triggerShake();
      return;
    }
    setSaving(true);
    const payload = pozycje.map((p) => ({
      id: p.id ?? null,
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
      brutto_kg: Number(p.brutto_kg),
      cena_zakupu: Number(p.cena_zakupu),
      waluta: p.waluta,
      notes: p.notes || null,
    }));

    if (mode === "edit" && existing) {
      const { data, error: rpcErr } = await supabase.rpc("aktualizuj_dostawe_z_pozycjami", {
        p_dostawa_id: existing.id,
        p_data_dostawy: dataDostawy,
        p_data_zaladunku: dataZaladunku,
        p_dostawca_id: dostawcaId,
        p_kraj_id: krajId || "",
        p_import_manager_id: managerId,
        p_status: s,
        p_notes: notes || "",
        p_pozycje: payload,
      });
      setSaving(false);
      if (rpcErr) { setSubmitError(rpcErr.message); return; }
      navigate({ to: "/dostawy/$id", params: { id: data as string } });
    } else {
      const { data, error: rpcErr } = await supabase.rpc("utworz_dostawe_z_pozycjami", {
        p_data_dostawy: dataDostawy,
        p_data_zaladunku: dataZaladunku,
        p_dostawca_id: dostawcaId,
        p_kraj_id: krajId || "",
        p_import_manager_id: managerId,
        p_status: s,
        p_notes: notes || "",
        p_pozycje: payload,
      });
      setSaving(false);
      if (rpcErr) { setSubmitError(rpcErr.message); return; }
      navigate({ to: "/dostawy/$id", params: { id: data as string } });
    }
  };

  const selectedDostawca = dostawcy.find((x) => x.id === dostawcaId);
  const supplierKrajLabel = selectedDostawca?.kraj_id
    ? kraje.find((k) => k.id === selectedDostawca.kraj_id)?.label ?? selectedDostawca.kraj_id
    : null;

  return (
    <div key={shakeKey} className={cn("space-y-4 max-w-5xl", shakeKey > 0 && "form-shake")}>
      <div>
        <h1 className="text-2xl font-bold">
          {mode === "edit" ? `Edycja dostawy` : "Nowa dostawa"}
        </h1>
        {mode === "edit" && existing && /^[A-Z0-9]+\/[0-9]{3}\/[A-Z]{3}\/[0-9]{3}$/.test(existing.numer_dostawy) && (
          <p className="text-xs text-muted-foreground">
            Numer dostawy: <span className="font-mono">{existing.numer_dostawy}</span>
          </p>
        )}

      </div>

      {submitTried && (headerErrors.length > 0 || capacityErrors.length > 0 || submitError) && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive space-y-1">
            {headerErrors.map((m, i) => <div key={`h${i}`}>• {m}</div>)}
            {capacityErrors.map((m, i) => <div key={`c${i}`}>• {m}</div>)}
            {submitError && <div>• {submitError}</div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Dane dostawy</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Dostawca *</Label>
            <Combobox
              items={dostawcy}
              value={dostawcaId}
              query={dostawcaQuery}
              filterFn={dostawcaFilter}
              onQuery={(s) => { setDostawcaQuery(s); setDostawcaId(""); }}
              onPick={(id, label) => {
                setDostawcaId(id);
                setDostawcaQuery(label);
                if (!id) return;
                const d = dostawcy.find((x) => x.id === id);
                if (d?.kraj_id && (!krajManuallySet || !krajId || krajAutofilledFromSupplier === krajId)) {
                  setKrajId(d.kraj_id);
                  setKrajAutofilledFromSupplier(d.kraj_id);
                  setKrajManuallySet(false);
                  const k = kraje.find((x) => x.id === d.kraj_id);
                  if (k) setKrajZaladunkuQuery(k.label);
                }
              }}
              onBlurInput={() => {
                setTimeout(() => {
                  if (!dostawcaId && dostawcaQuery.trim()) {
                    setDostawcaQuery("");
                    triggerShake();
                  }
                }, 220);
              }}
              placeholder="Wpisz nazwę dostawcy"
              invalid={submitTried && !dostawcaId}
            />
            {submitTried && !dostawcaId && (
              <FieldErr msg={dostawcaQuery.trim() ? "Wybierz dostawcę z listy" : "Dostawca wymagany"} />
            )}
            {supplierKrajLabel && (
              <p className="mt-1 text-xs text-muted-foreground">Kraj dostawcy: {supplierKrajLabel}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label>Kraj załadunku *</Label>
            <Combobox
              items={kraje}
              value={krajId}
              query={krajZaladunkuQuery}
              filterFn={krajFilter}
              onQuery={(s) => {
                setKrajZaladunkuQuery(s);
                setKrajId("");
                setKrajManuallySet(true);
                setKrajAutofilledFromSupplier(null);
              }}
              onPick={(id, label) => {
                setKrajId(id);
                setKrajZaladunkuQuery(label);
                setKrajManuallySet(true);
                setKrajAutofilledFromSupplier(null);
              }}
              onBlurInput={() => {
                setTimeout(() => {
                  if (!krajId && krajZaladunkuQuery.trim()) {
                    setKrajZaladunkuQuery("");
                    triggerShake();
                  }
                }, 220);
              }}
              placeholder="Wpisz nazwę kraju"
              invalid={submitTried && !krajId}
            />
            {submitTried && !krajId && (
              <FieldErr msg={krajZaladunkuQuery.trim() ? "Wybierz kraj z listy" : "Kraj załadunku wymagany"} />
            )}
            {lettersOnlyError(krajZaladunkuQuery) && !krajId && (
              <FieldErr msg="Dozwolone są tylko litery" />
            )}
            {selectedDostawca?.kraj_id && krajId !== selectedDostawca.kraj_id && (
              <Button type="button" variant="link" size="sm" className="px-0 h-auto" onClick={() => {
                insertSupplierCountry();
                const k = kraje.find((x) => x.id === selectedDostawca.kraj_id);
                if (k) setKrajZaladunkuQuery(k.label);
              }}>
                Wstaw kraj dostawcy ({supplierKrajLabel})
              </Button>
            )}
          </div>

          <div>
            <Label>Data załadunku *</Label>
            <Input type="date" min={todayStr} value={dataZaladunku} onChange={(e) => setDataZaladunku(e.target.value)}
                   className={cn(submitTried && (!dataZaladunku || dataZaladunku < todayStr) && "border-destructive field-invalid-pulse")} />
            {submitTried && !dataZaladunku && <FieldErr msg="Data załadunku wymagana" />}
            {submitTried && dataZaladunku && dataZaladunku < todayStr && (
              <FieldErr msg="Data załadunku nie może być wcześniejsza niż dzisiaj" />
            )}
          </div>

          <div>
            <Label>Data dostawy *</Label>
            <Input type="date" min={dataZaladunku || todayStr} value={dataDostawy} onChange={(e) => setDataDostawy(e.target.value)}
                   className={cn(submitTried && (!dataDostawy || (dataZaladunku && dataDostawy <= dataZaladunku)) && "border-destructive field-invalid-pulse")} />
            {submitTried && !dataDostawy && <FieldErr msg="Data dostawy wymagana" />}
            {submitTried && dataDostawy && dataZaladunku && dataDostawy <= dataZaladunku && (
              <FieldErr msg="Data dostawy musi być późniejsza niż data załadunku" />
            )}
          </div>

          <div className="md:col-span-2">
            <Label>Import manager *</Label>
            {managers.length === 1 ? (
              <Input value={managers[0].label} readOnly className="bg-muted/40" />
            ) : (
              <Select value={managerId} onValueChange={setManagerId} disabled={isImportMgr && !isSuper}>
                <SelectTrigger className={cn(submitTried && !managerId && "border-destructive field-invalid-pulse")}>
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {submitTried && !managerId && <FieldErr msg="Import manager wymagany" />}
          </div>

          <div className="md:col-span-2">
            <Label>Komentarz</Label>
            <Input value={notes} maxLength={100} onChange={(e) => setNotes(e.target.value)}
              className={cn(submitTried && (notes ?? "").length > 100 && "border-destructive field-invalid-pulse")} />
            <p className="mt-1 text-xs text-muted-foreground">{(notes ?? "").length}/100</p>
            {submitTried && (notes ?? "").length > 100 && <FieldErr msg="Maksymalnie 100 znaków" />}
          </div>

        </CardContent>
      </Card>


      <Card className={cn("sticky top-2 z-20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80", capacityErrors.length > 0 && "border-destructive")}>
        <CardHeader><CardTitle>Wykorzystanie auta</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Palety</div>
            <div className={cn("font-semibold", totals.palety > MAX_PALETY && "text-destructive")}>{totals.palety} / {MAX_PALETY}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Wolne palety</div>
            <div className="font-semibold">{Math.max(0, MAX_PALETY - totals.palety)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Brutto kg</div>
            <div className={cn("font-semibold", totals.brutto > MAX_BRUTTO_KG && "text-destructive")}>{totals.brutto.toFixed(2)} / {MAX_BRUTTO_KG}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Wolne kg</div>
            <div className="font-semibold">{Math.max(0, MAX_BRUTTO_KG - totals.brutto).toFixed(2)}</div>
          </div>
          {capacityErrors.length > 0 && (
            <div className="col-span-2 md:col-span-4 text-destructive text-xs space-y-1">
              {capacityErrors.map((m, i) => (
                <div key={i} className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {m}</div>
              ))}
            </div>
          )}
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
            const errs = lineErrors[i];
            const showErrs = true;
            const odmianyForProdukt = p.produkt_id ? odmiany.filter((o) => o.produkt_id === p.produkt_id) : [];
            const sugg = suggestedOpakIdsOrdered(p.produkt_id, p.kraj_id);
            const opakById = new Map(opakowania.map((o) => [o.id, o] as const));
            // Initial list = ONLY standard-relevant options (exact ISO3 first, generic last). No full catalog dump.
            const initialOpakItems: OpakItem[] = [
              ...sugg.exact.map((id) => opakById.get(id)).filter(Boolean) as OpakItem[],
              ...sugg.generic.map((id) => opakById.get(id)).filter(Boolean) as OpakItem[],
            ];
            const opakSelectedLabel = p.opakowanie_query;
            const warnings = lineWarnings[i] ?? [];
            const produktLabel = p.produkt_query || (p.produkt_id ? produkty.find((x) => x.id === p.produkt_id)?.label ?? "" : "");
            const krajLabel = p.kraj_query || (p.kraj_id ? kraje.find((x) => x.id === p.kraj_id)?.label ?? "" : "");

            return (
              <div key={i} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pozycja {i + 1}</span>
                  {pozycje.length > 1 && !p.id && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Produkt *</Label>
                    <Combobox
                      items={produkty}
                      value={p.produkt_id}
                      query={produktLabel}
                      filterFn={produktFilter}
                      onQuery={(s) => updateRow(i, {
                        produkt_query: s, produkt_id: "", odmiana_id: "",
                        opakowanie_id: "", opakowanie_source: p.opakowanie_query.trim() ? "custom" : "none",
                        weights_autofilled: false,
                      })}
                      onPick={(id, label) => onPickProdukt(i, id, label)}
                      onBlurInput={() => {
                        setTimeout(() => {
                          const cur = pozycje[i];
                          if (cur && !cur.produkt_id && cur.produkt_query.trim()) {
                            updateRow(i, { produkt_query: "" });
                            triggerShake();
                          }
                        }, 220);
                      }}
                      placeholder="Np. cebula, onion, ananas…"
                      invalid={showErrs && !!errs.produkt_id}
                    />
                    {showErrs && <FieldErr msg={errs.produkt_id} />}
                  </div>

                  <div>
                    <Label>Kraj pochodzenia *</Label>
                    <Combobox
                      items={kraje}
                      value={p.kraj_id}
                      query={krajLabel}
                      filterFn={krajFilter}
                      onQuery={(s) => updateRow(i, { kraj_query: s, kraj_id: "", weights_autofilled: false })}
                      onPick={(id, label) => onPickKrajPoch(i, id, label)}
                      onBlurInput={() => {
                        setTimeout(() => {
                          const cur = pozycje[i];
                          if (cur && !cur.kraj_id && cur.kraj_query.trim()) {
                            updateRow(i, { kraj_query: "" });
                            triggerShake();
                          }
                        }, 220);
                      }}
                      placeholder="Np. Hiszpania, Spain, Maroko…"
                      invalid={showErrs && !!errs.kraj_id}
                    />
                    {showErrs && <FieldErr msg={errs.kraj_id} />}
                  </div>

                  <div className="md:col-span-2">
                    <Label>Odmiana / Sort</Label>
                    {!p.produkt_id ? (
                      <p className="text-xs text-muted-foreground py-2">Najpierw wybierz produkt.</p>
                    ) : odmianyForProdukt.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Brak odmian dla wybranego produktu</p>
                    ) : (
                      <Select value={p.odmiana_id} onValueChange={(v) => applyChainedPatch(i, { odmiana_id: v }, "odmiana")}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {odmianyForProdukt.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label>Opakowanie</Label>
                    <Combobox
                      items={opakowania}
                      initialItems={initialOpakItems}
                      value={p.opakowanie_id}
                      query={opakSelectedLabel}
                      onQuery={(s) => onOpakowanieQuery(i, s)}
                      onPick={(id, label) => onPickOpakowanie(i, id, label)}
                      onBlurInput={() => {
                        const text = p.opakowanie_query.trim();
                        if (!p.opakowanie_id && text !== p.opakowanie_custom_text) onOpakowanieQuery(i, text);
                      }}
                      placeholder={p.produkt_id ? "Wybierz z listy, wpisz własne albo zostaw puste" : "Najpierw wybierz produkt"}
                      minChars={2}
                      maxItems={20}
                      showInitialItems={!!p.produkt_id}
                      emptyInitialMessage={p.produkt_id && !sugg.hasAnyStandard
                        ? "Brak standardów palet dla tego produktu — wpisz tekst, aby wyszukać opakowanie"
                        : undefined}
                      invalid={showErrs && !!errs.opakowanie_custom_text}
                    />
                    {warnings.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">{warnings[0]}</p>
                    )}
                    {showErrs && <FieldErr msg={errs.opakowanie ?? errs.opakowanie_custom_text} />}
                  </div>

                  <div className="md:col-span-2">
                    <Label>Materiał tary *</Label>
                    <div className="flex gap-2 mt-1">
                      {(["karton","drewno","plastik"] as const).map((m) => (
                        <Button key={m} type="button" size="sm"
                          variant={p.material_tary === m ? "default" : "outline"}
                          onClick={() => onMaterialChange(i, m)}
                          className={cn(showErrs && errs.material_tary && !p.material_tary && "border-destructive field-invalid-pulse")}>
                          {m === "karton" ? "Karton" : m === "drewno" ? "Drewno" : "Plastik"}
                        </Button>
                      ))}
                    </div>
                    {showErrs && <FieldErr msg={errs.material_tary} />}
                  </div>

                  <div>
                    <Label>Palety *</Label>
                    <Input type="text" inputMode="numeric" pattern="\d*" value={p.palety}
                      onChange={(e) => onPaletyChange(i, e.target.value)}
                      className={cn(showErrs && (errs.palety || totals.palety > MAX_PALETY) && "border-destructive field-invalid-pulse")} />
                    {showErrs && <FieldErr msg={errs.palety ?? (totals.palety > MAX_PALETY ? "Przekroczono limit auta 26 palet" : undefined)} />}
                  </div>

                  <div>
                    <Label>Ilość opakowań *</Label>
                    <Input type="text" inputMode="numeric" pattern="\d*" value={p.ilosc_opakowan}
                      onChange={(e) => onIloscOpakowanChange(i, e.target.value)}
                      className={cn(showErrs && errs.ilosc_opakowan && "border-destructive field-invalid-pulse")} />
                    {showErrs && <FieldErr msg={errs.ilosc_opakowan} />}
                  </div>

                  <div>
                    <Label>Netto (kg) *</Label>
                    <Input type="text" inputMode="decimal" value={p.netto_kg}
                      onChange={(e) => applyChainedPatch(i, { netto_kg: e.target.value }, "netto_kg")}
                      className={cn(showErrs && errs.netto_kg && "border-destructive field-invalid-pulse")} />
                    {showErrs && <FieldErr msg={errs.netto_kg} />}
                  </div>

                  <div>
                    <Label>Brutto (kg) *</Label>
                    <Input type="text" inputMode="decimal" value={p.brutto_kg}
                      onChange={(e) => applyChainedPatch(i, { brutto_kg: e.target.value }, "brutto_kg")}
                      className={cn(showErrs && (errs.brutto_kg || totals.brutto > MAX_BRUTTO_KG) && "border-destructive field-invalid-pulse")} />
                    {showErrs && <FieldErr msg={errs.brutto_kg ?? (totals.brutto > MAX_BRUTTO_KG ? "Przekroczono limit auta 21500 kg" : undefined)} />}
                  </div>

                  <div>
                    <Label>Cena za 1 kg (€) *</Label>
                    <Input type="text" inputMode="decimal" value={p.cena_zakupu}
                      onChange={(e) => updateRow(i, { cena_zakupu: e.target.value })}
                      className={cn(showErrs && errs.cena_zakupu && "border-destructive field-invalid-pulse")} />
                    {showErrs && <FieldErr msg={errs.cena_zakupu} />}
                  </div>

                  {(() => {
                    const netto = toNum(p.netto_kg);
                    const cena = toNum(p.cena_zakupu);
                    const ilosc = toNum(p.ilosc_opakowan);
                    const cenaZaOpak = netto !== null && cena !== null && ilosc !== null && ilosc > 0
                      ? (netto / ilosc) * cena : null;
                    return (
                      <div>
                        <Label>Cena za opakowanie (€)</Label>
                        <Input disabled value={cenaZaOpak === null ? "" : cenaZaOpak.toFixed(2)} placeholder="—" />
                      </div>
                    );
                  })()}

                  <div className="md:col-span-2">
                    <Label>Komentarz</Label>
                    <Input value={p.notes} maxLength={100}
                      onChange={(e) => updateRow(i, { notes: e.target.value })}
                      className={cn(showErrs && errs.notes && "border-destructive field-invalid-pulse")} />
                    <p className="mt-1 text-xs text-muted-foreground">{(p.notes ?? "").length}/100</p>
                    {showErrs && <FieldErr msg={errs.notes} />}
                  </div>

                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Podsumowanie</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Liczba pozycji: <strong>{pozycje.length}</strong></div>
          <div>Razem palet: <strong>{totals.palety}</strong> / {MAX_PALETY}</div>
          <div>Razem netto (kg): <strong>{totals.netto.toFixed(2)}</strong></div>
          <div>Razem brutto (kg): <strong>{totals.brutto.toFixed(2)}</strong> / {MAX_BRUTTO_KG}</div>
          <div>Razem wartość (€): <strong>{(totals.byWal.get("EUR") ?? 0).toFixed(2)}</strong></div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => submit("draft")}>
              {mode === "edit" ? "Zapisz zmiany (szkic)" : "Zapisz jako szkic"}
            </Button>
            <Button type="button" disabled={saving} onClick={() => submit("planned")}>
              {mode === "edit" ? "Zapisz zmiany (zaplanowana)" : "Zapisz jako zaplanowana"}
            </Button>
            <Button type="button" variant="ghost" disabled={saving}
              onClick={() => mode === "edit" && existing
                ? navigate({ to: "/dostawy/$id", params: { id: existing.id } })
                : navigate({ to: "/dostawy" })}>
              Anuluj
            </Button>
          </div>
          {saving && <p className="text-xs text-muted-foreground">Zapisywanie… status: {status}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
