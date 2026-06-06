import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ====================================================================
// Vehicle capacity hard limits
// ====================================================================
const MAX_PALETY = 26;
const MAX_BRUTTO_KG = 21500;

// ====================================================================
// Types
// ====================================================================
interface RefItem {
  id: string;
  label: string;
  search?: string;
}

interface ProduktItem extends RefItem {
  aliases: string;
}

interface OpakItem extends RefItem {
  material_canonical: "karton" | "drewno" | "plastik" | null;
}

interface OdmianaItem extends RefItem {
  produkt_id: string | null;
}

interface DostawcaItem extends RefItem {
  kraj_id: string | null;
}

interface KrajItem extends RefItem {
  iso3: string | null;
}

interface StandardRow {
  produkt_id: string;
  opakowanie_id: string;
  iso3_kraju: string | null;
  liczba_opakowan_na_palecie: number | null;
  waga_netto_opakowania_kg: number | null;
  waga_brutto_opakowania_kg: number | null;
  waga_netto_palety_kg: number | null;
  waga_brutto_palety_z_paleta_kg: number | null;
}

type MaterialTary = "" | "karton" | "drewno" | "plastik";
type OpakSource = "catalog" | "custom" | "none";

interface PozycjaForm {
  produkt_id: string;
  produkt_query: string;
  kraj_id: string;
  kraj_query: string;
  odmiana_id: string;
  opakowanie_source: OpakSource;
  opakowanie_id: string;
  opakowanie_query: string;
  opakowanie_custom_text: string;
  material_tary: MaterialTary;
  material_autofilled: boolean;
  palety: string;
  ilosc_opakowan: string;
  netto_kg: string;
  brutto_kg: string;
  weights_autofilled: boolean;
  cena_zakupu: string;
  waluta: string;
  notes: string;
}

const EMPTY_POZ: PozycjaForm = {
  produkt_id: "",
  produkt_query: "",
  kraj_id: "",
  kraj_query: "",
  odmiana_id: "",
  opakowanie_source: "none",
  opakowanie_id: "",
  opakowanie_query: "",
  opakowanie_custom_text: "",
  material_tary: "",
  material_autofilled: false,
  palety: "0",
  ilosc_opakowan: "",
  netto_kg: "",
  brutto_kg: "",
  weights_autofilled: false,
  cena_zakupu: "",
  waluta: "EUR",
  notes: "",
};

// ====================================================================
// Helpers
// ====================================================================
function canonicalMaterial(raw: string | null | undefined): "karton" | "drewno" | "plastik" | null {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v) return null;
  if (["karton", "carton", "cardboard", "tektura", "tekturowa", "tekturowe"].includes(v)) return "karton";
  if (["drewno", "wood", "drewniana", "drewniane", "wooden"].includes(v)) return "drewno";
  if (
    ["plastik", "plastic", "plastikowa", "plastikowe", "pp", "pet", "hdpe", "ldpe", "ps", "eps", "styropian", "folia"].includes(v)
  )
    return "plastik";
  return null;
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l");
}

/** Word-prefix match: query matches start of any word in target. */
function startsWithWord(target: string, query: string): boolean {
  const t = " " + normalize(target);
  const q = normalize(query);
  if (q.length < 2) return false;
  return t.includes(" " + q);
}

function toNum(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(String(s).replace(",", "."));
  return isFinite(n) ? n : null;
}

function isBlank(s: string): boolean {
  return s === null || s === undefined || String(s).trim() === "";
}

// ====================================================================
// Calculation engine — one logical chain per position
// ====================================================================
type ChangedField =
  | "produkt"
  | "kraj"
  | "odmiana"
  | "opakowanie"
  | "material_tary"
  | "palety"
  | "ilosc_opakowan"
  | "netto_kg"
  | "brutto_kg"
  | "cena_zakupu"
  | "waluta"
  | "notes";

interface PositionCalculation {
  next: PozycjaForm;
  standard: StandardRow | null;
  warnings: string[];
}

function fmtAmount(n: number, fractionDigits = 2): string {
  return Number.isInteger(n) && fractionDigits === 0 ? String(n) : n.toFixed(fractionDigits);
}

function differsFromExpected(actual: string, expected: number | null): boolean {
  const a = toNum(actual);
  if (a === null || expected === null) return false;
  return Math.abs(a - expected) > 0.01;
}

function calculatePositionLine(
  input: PozycjaForm,
  changedField: ChangedField,
  standard: StandardRow | null,
): PositionCalculation {
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

  const expectedBoxes = palety !== null && boxesPerPallet !== null ? Math.max(0, palety) * boxesPerPallet : null;
  const expectedNet = expectedBoxes !== null && netPerBox !== null ? expectedBoxes * netPerBox : null;
  const expectedGross = expectedBoxes !== null && grossPerBox !== null ? expectedBoxes * grossPerBox : null;
  if (
    !next.weights_autofilled &&
    (differsFromExpected(next.ilosc_opakowan, expectedBoxes) ||
      differsFromExpected(next.netto_kg, expectedNet) ||
      differsFromExpected(next.brutto_kg, expectedGross))
  ) {
    warnings.push("Ręczna korekta wartości względem standardu palety");
  }

  return { next, standard, warnings };
}

// ====================================================================
// Field-level errors
// ====================================================================
type FieldErrors = Partial<Record<keyof PozycjaForm | "opakowanie", string>>;

function validatePosition(p: PozycjaForm, standard: StandardRow | null = null): FieldErrors {
  const e: FieldErrors = {};
  if (!p.produkt_id) e.produkt_id = "Produkt wymagany (wybierz z listy)";
  if (!p.kraj_id) e.kraj_id = "Kraj pochodzenia wymagany (wybierz z listy)";
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
  if (isBlank(p.palety) || palety === null || palety < 0) e.palety = "Palety >= 0";
  if (!isBlank(p.ilosc_opakowan) && (ilosc === null || ilosc < 0)) e.ilosc_opakowan = "Ilość opakowań >= 0";
  if (isBlank(p.netto_kg)) e.netto_kg = "Netto kg wymagane";
  else if (netto === null || netto <= 0) e.netto_kg = "Netto kg musi być > 0";
  if (isBlank(p.brutto_kg)) e.brutto_kg = "Brutto kg wymagane";
  else if (brutto === null || brutto <= 0) e.brutto_kg = "Brutto kg musi być > 0";
  else if (netto !== null && brutto < netto)
    e.brutto_kg = "Brutto kg nie może być mniejsze niż netto kg";
  if (isBlank(p.cena_zakupu)) e.cena_zakupu = "Cena zakupu wymagana";
  else if (cena === null || cena < 0) e.cena_zakupu = "Cena zakupu >= 0";
  if (!["PLN", "EUR", "USD"].includes(p.waluta)) e.waluta = "PLN/EUR/USD";
  if (p.opakowanie_source === "catalog" && standard && standard.liczba_opakowan_na_palecie !== null) {
    const expectedBoxes = palety !== null ? palety * standard.liczba_opakowan_na_palecie : null;
    if (differsFromExpected(p.ilosc_opakowan, expectedBoxes)) {
      e.ilosc_opakowan = `Standard wymaga ${fmtAmount(expectedBoxes ?? 0, 0)} opak. dla ${p.palety || 0} palet`;
    }
  }
  return e;
}

// ====================================================================
// Combobox
// ====================================================================
interface ComboProps {
  items: RefItem[];
  value: string;
  query: string;
  onQuery: (s: string) => void;
  onPick: (id: string, label: string) => void;
  onBlurInput?: () => void;
  placeholder?: string;
  minChars?: number;
  extraTop?: React.ReactNode;
  showInitialItems?: boolean;
  maxItems?: number;
  filterFn?: (item: RefItem, query: string) => boolean;
  invalid?: boolean;
}

function Combobox({
  items,
  value,
  query,
  onQuery,
  onPick,
  onBlurInput,
  placeholder,
  minChars = 2,
  extraTop,
  showInitialItems = false,
  maxItems = 50,
  filterFn,
  invalid,
}: ComboProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (query.trim().length < minChars) return showInitialItems ? items.slice(0, maxItems) : [];
    const fn = filterFn ?? ((it: RefItem, q: string) => startsWithWord(it.search ?? it.label, q));
    return items.filter((it) => fn(it, query)).slice(0, maxItems);
  }, [items, query, minChars, showInitialItems, filterFn, maxItems]);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex gap-1">
        <Input
          value={query}
          placeholder={placeholder}
          className={cn(invalid && "border-destructive focus-visible:ring-destructive")}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={onBlurInput}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onPick("", "");
              onQuery("");
            }}
            title="Wyczyść"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-auto">
          {extraTop}
          {query.trim().length < minChars && !showInitialItems ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Wpisz co najmniej {minChars} znaki…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Brak wyników</div>
          ) : (
            filtered.map((it) => (
              <button
                key={it.id}
                type="button"
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  onPick(it.id, it.label);
                  setOpen(false);
                }}
              >
                {it.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Small inline error message
function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 text-xs text-destructive flex items-center gap-1">
      <AlertCircle className="h-3 w-3" /> {msg}
    </p>
  );
}

// ====================================================================
// Page
// ====================================================================
function Page() {
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

  const today = new Date().toISOString().slice(0, 10);
  const [dataZaladunku, setDataZaladunku] = useState(today);
  const [dataDostawy, setDataDostawy] = useState(today);
  const [dostawcaId, setDostawcaId] = useState("");
  const [krajId, setKrajId] = useState("");
  const [krajManuallySet, setKrajManuallySet] = useState(false);
  const [krajAutofilledFromSupplier, setKrajAutofilledFromSupplier] = useState<string | null>(null);
  const [managerId, setManagerId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "planned">("draft");
  const [pozycje, setPozycje] = useState<PozycjaForm[]>([{ ...EMPTY_POZ }]);
  const [saving, setSaving] = useState(false);
  const [submitTried, setSubmitTried] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // -----------------------------------------------------------------
  // Load reference data
  // -----------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const [d, k, p, o, op, st, u] = await Promise.all([
        supabase
          .from("dostawcy")
          .select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy, kraj_id")
          .order("nazwa_dostawcy_original"),
        supabase.from("kraje").select("kraj_id, nazwa_pl, iso3").order("nazwa_pl"),
        supabase.from("produkty").select("produkt_id, nazwa_pl, aliasy_pl").order("nazwa_pl"),
        supabase
          .from("odmiany")
          .select("odmiana_id, odmiana_original, nazwa_produktu_pl, produkt_id")
          .order("odmiana_original"),
        supabase
          .from("opakowania")
          .select("opakowanie_id, typ_opakowania_pl, wariant_opakowania_pl, material_tary")
          .order("typ_opakowania_pl"),
        supabase
          .from("standardy_palet")
          .select(
            "produkt_id, opakowanie_id, iso3_kraju, liczba_opakowan_na_palecie, waga_netto_opakowania_kg, waga_brutto_opakowania_kg, waga_netto_palety_kg, waga_brutto_palety_z_paleta_kg",
          ),
        isSuper
          ? supabase
              .from("uzytkownicy")
              .select("uzytkownik_id, imie_nazwisko, klucz_roli, status")
              .eq("klucz_roli", "import_manager")
              .eq("status", "aktywny")
          : Promise.resolve({ data: [] as Array<{ uzytkownik_id: string; imie_nazwisko: string | null }> }),
      ]);
      setDostawcy(
        (d.data ?? []).map((x) => {
          const primary = x.nazwa_dostawcy_original || x.alias_dostawcy || x.dostawca_id;
          const alias = x.alias_dostawcy && x.alias_dostawcy !== primary ? ` (${x.alias_dostawcy})` : "";
          return {
            id: x.dostawca_id,
            label: primary + alias,
            search: `${primary} ${x.alias_dostawcy ?? ""}`,
            kraj_id: x.kraj_id ?? null,
          };
        }),
      );
      setKraje(
        (k.data ?? []).map((x) => ({
          id: x.kraj_id,
          label: x.nazwa_pl || x.kraj_id,
          search: `${x.nazwa_pl ?? ""} ${x.iso3 ?? ""}`,
          iso3: x.iso3 ?? null,
        })),
      );
      setProdukty(
        (p.data ?? []).map((x) => ({
          id: x.produkt_id,
          label: x.nazwa_pl || x.produkt_id,
          aliases: x.aliasy_pl || "",
          search: `${x.nazwa_pl ?? ""} ${x.aliasy_pl ?? ""}`,
        })),
      );
      setOdmiany(
        (o.data ?? []).map((x) => ({
          id: x.odmiana_id,
          label: x.odmiana_original ?? x.odmiana_id,
          produkt_id: x.produkt_id ?? null,
        })),
      );
      setOpakowania(
        (op.data ?? []).map((x) => ({
          id: x.opakowanie_id,
          label: [x.typ_opakowania_pl, x.wariant_opakowania_pl].filter(Boolean).join(" / ") || x.opakowanie_id,
          search: `${x.typ_opakowania_pl ?? ""} ${x.wariant_opakowania_pl ?? ""}`,
          material_canonical: canonicalMaterial(x.material_tary),
        })),
      );
      setStandardy(
        ((st.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          produkt_id: String(r.produkt_id ?? ""),
          opakowanie_id: String(r.opakowanie_id ?? ""),
          iso3_kraju: r.iso3_kraju ? String(r.iso3_kraju) : null,
          liczba_opakowan_na_palecie: toNum(r.liczba_opakowan_na_palecie as string),
          waga_netto_opakowania_kg: toNum(r.waga_netto_opakowania_kg as string),
          waga_brutto_opakowania_kg: toNum(r.waga_brutto_opakowania_kg as string),
          waga_netto_palety_kg: toNum(r.waga_netto_palety_kg as string),
          waga_brutto_palety_z_paleta_kg: toNum(r.waga_brutto_palety_z_paleta_kg as string),
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

  // Auto-fill loading country from supplier (unless user overrode it).
  useEffect(() => {
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

  const onKrajManualChange = (v: string) => {
    setKrajManuallySet(true);
    setKrajAutofilledFromSupplier(null);
    setKrajId(v);
  };

  const insertSupplierCountry = () => {
    const d = dostawcy.find((x) => x.id === dostawcaId);
    if (d?.kraj_id) {
      setKrajId(d.kraj_id);
      setKrajManuallySet(false);
      setKrajAutofilledFromSupplier(d.kraj_id);
    }
  };

  // -----------------------------------------------------------------
  // Row operations & calculation engine plumbing
  // -----------------------------------------------------------------
  const addRow = () => setPozycje((p) => [...p, { ...EMPTY_POZ }]);
  const removeRow = (i: number) => setPozycje((p) => p.filter((_, idx) => idx !== i));
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

  const suggestedOpakIds = (produkt_id: string, kraj_id: string): Set<string> => {
    const s = new Set<string>();
    if (!produkt_id) return s;
    const iso3 = kraje.find((k) => k.id === kraj_id)?.iso3 ?? null;
    for (const r of standardy) {
      if (r.produkt_id !== produkt_id) continue;
      if (iso3 && r.iso3_kraju && r.iso3_kraju.toUpperCase() !== iso3.toUpperCase()) continue;
      s.add(r.opakowanie_id);
    }
    return s;
  };

  /** Apply patch + one calculation pass for the whole position chain. */
  const applyChainedPatch = (i: number, patch: Partial<PozycjaForm>, changedField: ChangedField) => {
    const merged: PozycjaForm = { ...pozycje[i], ...patch };
    const std = findStandard(merged.produkt_id, merged.opakowanie_id, merged.kraj_id);
    updateRow(i, calculatePositionLine(merged, changedField, std).next);
  };

  const onPickProdukt = (i: number, id: string, label: string) => {
    const cur = pozycje[i];
    // Reset odmiana if it doesn't match new produkt
    const od = odmiany.find((x) => x.id === cur.odmiana_id);
    const odmiana_id = od && od.produkt_id !== id ? "" : cur.odmiana_id;
    applyChainedPatch(i, { produkt_id: id, produkt_query: label, odmiana_id }, "produkt");
  };

  const onPickKrajPoch = (i: number, id: string, label: string) => {
    applyChainedPatch(i, { kraj_id: id, kraj_query: label }, "kraj");
  };

  const onPickOpakowanie = (i: number, id: string, label: string) => {
    if (!id) {
      onOpakowanieQuery(i, "");
      return;
    }
    const cur = pozycje[i];
    const opak = opakowania.find((x) => x.id === id);
    const patch: Partial<PozycjaForm> = {
      opakowanie_source: "catalog",
      opakowanie_id: id,
      opakowanie_query: label,
      opakowanie_custom_text: "",
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
      opakowanie_query: raw,
      opakowanie_id: "",
      opakowanie_custom_text: text,
      opakowanie_source: text ? "custom" : "none",
      material_autofilled: false,
      weights_autofilled: false,
    });
  };

  const onPaletyChange = (i: number, v: string) => {
    applyChainedPatch(i, { palety: v }, "palety");
  };

  const onIloscOpakowanChange = (i: number, v: string) => {
    applyChainedPatch(i, { ilosc_opakowan: v }, "ilosc_opakowan");
  };

  const onMaterialChange = (i: number, v: "karton" | "drewno" | "plastik") => {
    updateRow(i, { material_tary: v, material_autofilled: false });
  };

  // -----------------------------------------------------------------
  // Derived: per-line errors, totals, capacity
  // -----------------------------------------------------------------
  const lineErrors: FieldErrors[] = useMemo(
    () => pozycje.map((p) => validatePosition(p, findStandard(p.produkt_id, p.opakowanie_id, p.kraj_id))),
    [pozycje, standardy, kraje],
  );
  const lineWarnings: string[][] = useMemo(
    () =>
      pozycje.map((p) =>
        calculatePositionLine(p, "notes", findStandard(p.produkt_id, p.opakowanie_id, p.kraj_id)).warnings,
      ),
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
    if (totals.palety > MAX_PALETY)
      errs.push(`Łączna liczba palet ${totals.palety} przekracza limit auta (${MAX_PALETY}).`);
    if (totals.brutto > MAX_BRUTTO_KG)
      errs.push(`Łączna waga brutto ${totals.brutto.toFixed(2)} kg przekracza limit auta (${MAX_BRUTTO_KG} kg).`);
    return errs;
  }, [totals]);

  const headerErrors: string[] = useMemo(() => {
    const errs: string[] = [];
    if (!dataZaladunku) errs.push("Data załadunku wymagana");
    if (!dataDostawy) errs.push("Data dostawy / przyjazdu wymagana");
    if (!dostawcaId) errs.push("Dostawca wymagany");
    if (!managerId) errs.push("Manager importu wymagany");
    return errs;
  }, [dataZaladunku, dataDostawy, dostawcaId, managerId]);

  const hasAnyError =
    headerErrors.length > 0 ||
    capacityErrors.length > 0 ||
    lineErrors.some((e) => Object.keys(e).length > 0);

  // -----------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------
  const submit = async (s: "draft" | "planned") => {
    setSubmitError(null);
    setSubmitTried(true);
    setStatus(s);
    if (hasAnyError) {
      setSubmitError("Formularz zawiera błędy. Popraw zaznaczone pola.");
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
      brutto_kg: Number(p.brutto_kg),
      cena_zakupu: Number(p.cena_zakupu),
      waluta: p.waluta,
      notes: p.notes || null,
    }));
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
    if (rpcErr) {
      setSubmitError(rpcErr.message);
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
  const supplierKrajLabel = selectedDostawca?.kraj_id
    ? kraje.find((k) => k.id === selectedDostawca.kraj_id)?.label ?? selectedDostawca.kraj_id
    : null;

  return (
    <RoleGuard path="/dostawy">
      <div className="space-y-4 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold">Nowa dostawa</h1>
          <p className="text-sm text-muted-foreground">
            Każda pozycja otrzymuje własny, unikalny identyfikator wewnętrzny.
          </p>
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
          <CardHeader>
            <CardTitle>Dane dostawy</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data załadunku *</Label>
              <Input
                type="date"
                value={dataZaladunku}
                onChange={(e) => setDataZaladunku(e.target.value)}
                className={cn(submitTried && !dataZaladunku && "border-destructive")}
              />
            </div>
            <div>
              <Label>Data dostawy / przyjazdu *</Label>
              <Input
                type="date"
                value={dataDostawy}
                onChange={(e) => setDataDostawy(e.target.value)}
                className={cn(submitTried && !dataDostawy && "border-destructive")}
              />
            </div>
            <div>
              <Label>Dostawca *</Label>
              <Select value={dostawcaId} onValueChange={setDostawcaId}>
                <SelectTrigger className={cn(submitTried && !dostawcaId && "border-destructive")}>
                  <SelectValue placeholder="Wybierz dostawcę" />
                </SelectTrigger>
                <SelectContent>
                  {dostawcy.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supplierKrajLabel && (
                <p className="mt-1 text-xs text-muted-foreground">Kraj dostawcy: {supplierKrajLabel}</p>
              )}
            </div>
            <div>
              <Label>Kraj załadunku</Label>
              <Select value={krajId} onValueChange={onKrajManualChange}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {kraje.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDostawca?.kraj_id && krajId !== selectedDostawca.kraj_id && (
                <Button type="button" variant="link" size="sm" className="px-0 h-auto" onClick={insertSupplierCountry}>
                  Wstaw kraj dostawcy ({supplierKrajLabel})
                </Button>
              )}
            </div>
            <div>
              <Label>Manager importu *</Label>
              <Select value={managerId} onValueChange={setManagerId} disabled={isImportMgr && !isSuper}>
                <SelectTrigger className={cn(submitTried && !managerId && "border-destructive")}>
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
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

        {/* Capacity preview */}
        <Card className={cn(capacityErrors.length > 0 && "border-destructive")}>
          <CardHeader>
            <CardTitle>Wykorzystanie auta</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Palety</div>
              <div className={cn("font-semibold", totals.palety > MAX_PALETY && "text-destructive")}>
                {totals.palety} / {MAX_PALETY}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Wolne palety</div>
              <div className="font-semibold">{Math.max(0, MAX_PALETY - totals.palety)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Brutto kg</div>
              <div className={cn("font-semibold", totals.brutto > MAX_BRUTTO_KG && "text-destructive")}>
                {totals.brutto.toFixed(2)} / {MAX_BRUTTO_KG}
              </div>
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
              const odmianyForProdukt = p.produkt_id
                ? odmiany.filter((o) => o.produkt_id === p.produkt_id)
                : [];
              const suggested = suggestedOpakIds(p.produkt_id, p.kraj_id);
              const opakSorted: OpakItem[] = p.produkt_id
                ? [
                    ...opakowania.filter((o) => suggested.has(o.id)),
                    ...opakowania.filter((o) => !suggested.has(o.id)),
                  ]
                : opakowania;
              const opakSelectedLabel = p.opakowanie_query;
              const warnings = lineWarnings[i] ?? [];
              const produktLabel =
                p.produkt_query || (p.produkt_id ? produkty.find((x) => x.id === p.produkt_id)?.label ?? "" : "");
              const krajLabel =
                p.kraj_query || (p.kraj_id ? kraje.find((x) => x.id === p.kraj_id)?.label ?? "" : "");

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
                    {/* 1. Produkt */}
                    <div>
                      <Label>Produkt * (wpisz min. 2 znaki)</Label>
                      <Combobox
                        items={produkty}
                        value={p.produkt_id}
                        query={produktLabel}
                        onQuery={(s) =>
                          updateRow(i, {
                            produkt_query: s,
                            produkt_id: "",
                            odmiana_id: "",
                            opakowanie_id: "",
                            opakowanie_source: p.opakowanie_query.trim() ? "custom" : "none",
                            weights_autofilled: false,
                          })
                        }
                        onPick={(id, label) => onPickProdukt(i, id, label)}
                        placeholder="Np. banan, ananas…"
                        invalid={showErrs && !!errs.produkt_id}
                      />
                      {showErrs && <FieldErr msg={errs.produkt_id} />}
                    </div>

                    {/* 2. Kraj pochodzenia */}
                    <div>
                      <Label>Kraj pochodzenia (wpisz min. 2 znaki)</Label>
                      <Combobox
                        items={kraje}
                        value={p.kraj_id}
                        query={krajLabel}
                        onQuery={(s) => updateRow(i, { kraj_query: s, kraj_id: "", weights_autofilled: false })}
                        onPick={(id, label) => onPickKrajPoch(i, id, label)}
                        placeholder="Np. Hiszpania, Maroko…"
                        invalid={showErrs && !!errs.kraj_id}
                      />
                      {showErrs && <FieldErr msg={errs.kraj_id} />}
                    </div>

                    {/* 3. Odmiana */}
                    <div>
                      <Label>Odmiana</Label>
                      {!p.produkt_id ? (
                        <p className="text-xs text-muted-foreground py-2">
                          Najpierw wybierz produkt.
                        </p>
                      ) : odmianyForProdukt.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          Brak odmian dla wybranego produktu
                        </p>
                      ) : (
                        <Select value={p.odmiana_id} onValueChange={(v) => applyChainedPatch(i, { odmiana_id: v }, "odmiana")}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {odmianyForProdukt.map((x) => (
                              <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* 4. Opakowanie — one adaptive business input */}
                    <div className="md:col-span-2">
                      <Label>Opakowanie</Label>
                      <Combobox
                        items={opakSorted}
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
                        showInitialItems={!!p.produkt_id}
                        invalid={showErrs && !!errs.opakowanie_custom_text}
                      />
                      {p.produkt_id && suggested.size > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Najpierw widoczne są opakowania znane dla tego produktu ({suggested.size}).
                        </p>
                      )}
                      {p.opakowanie_source === "custom" && p.opakowanie_custom_text && (
                        <p className="mt-1 text-xs text-muted-foreground">Własne opakowanie — wagi wpisz ręcznie.</p>
                      )}
                      {warnings.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">{warnings[0]}</p>
                      )}
                      {showErrs && <FieldErr msg={errs.opakowanie ?? errs.opakowanie_custom_text} />}
                    </div>

                    {/* 5. Materiał tary */}
                    <div className="md:col-span-2">
                      <Label>Materiał tary *</Label>
                      <div className="flex gap-2 mt-1">
                        {(["karton", "drewno", "plastik"] as const).map((m) => (
                          <Button
                            key={m}
                            type="button"
                            size="sm"
                            variant={p.material_tary === m ? "default" : "outline"}
                            onClick={() => onMaterialChange(i, m)}
                            className={cn(showErrs && errs.material_tary && !p.material_tary && "border-destructive")}
                          >
                            {m === "karton" ? "Karton" : m === "drewno" ? "Drewno" : "Plastik"}
                          </Button>
                        ))}
                      </div>
                      {showErrs && <FieldErr msg={errs.material_tary} />}
                    </div>

                    {/* 6. Palety */}
                    <div>
                      <Label>Palety</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={p.palety}
                        onChange={(e) => onPaletyChange(i, e.target.value)}
                        className={cn(showErrs && (errs.palety || totals.palety > MAX_PALETY) && "border-destructive")}
                      />
                      {showErrs && <FieldErr msg={errs.palety ?? (totals.palety > MAX_PALETY ? "Przekroczono limit auta 26 palet" : undefined)} />}
                    </div>

                    {/* 7. Ilość opakowań */}
                    <div>
                      <Label>Ilość opakowań</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={p.ilosc_opakowan}
                        onChange={(e) => onIloscOpakowanChange(i, e.target.value)}
                        className={cn(showErrs && errs.ilosc_opakowan && "border-destructive")}
                      />
                      {showErrs && <FieldErr msg={errs.ilosc_opakowan} />}
                    </div>

                    {/* 8. Netto */}
                    <div>
                      <Label>Netto (kg) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.netto_kg}
                        onChange={(e) =>
                          applyChainedPatch(i, { netto_kg: e.target.value }, "netto_kg")
                        }
                        className={cn(showErrs && errs.netto_kg && "border-destructive")}
                      />
                      {showErrs && <FieldErr msg={errs.netto_kg} />}
                    </div>

                    {/* 9. Brutto */}
                    <div>
                      <Label>Brutto (kg) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.brutto_kg}
                        onChange={(e) =>
                          applyChainedPatch(i, { brutto_kg: e.target.value }, "brutto_kg")
                        }
                        className={cn(showErrs && (errs.brutto_kg || totals.brutto > MAX_BRUTTO_KG) && "border-destructive")}
                      />
                      {showErrs && <FieldErr msg={errs.brutto_kg ?? (totals.brutto > MAX_BRUTTO_KG ? "Przekroczono limit auta 21500 kg" : undefined)} />}
                    </div>

                    {/* 10. Cena zakupu */}
                    <div>
                      <Label>Cena zakupu *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.cena_zakupu}
                        onChange={(e) => updateRow(i, { cena_zakupu: e.target.value })}
                        className={cn(showErrs && errs.cena_zakupu && "border-destructive")}
                      />
                      {showErrs && <FieldErr msg={errs.cena_zakupu} />}
                    </div>

                    {/* 11. Waluta */}
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

                    {/* 12. Notatki */}
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
            <div>Razem palet: <strong>{totals.palety}</strong> / {MAX_PALETY}</div>
            <div>Razem netto (kg): <strong>{totals.netto.toFixed(2)}</strong></div>
            <div>Razem brutto (kg): <strong>{totals.brutto.toFixed(2)}</strong> / {MAX_BRUTTO_KG}</div>
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
