import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
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

interface PozycjaForm {
  produkt_id: string;
  produkt_query: string;
  odmiana_id: string;
  opakowanie_source: "catalog" | "custom";
  opakowanie_id: string;
  opakowanie_query: string;
  opakowanie_custom_text: string;
  material_tary: MaterialTary;
  material_autofilled: boolean;
  kraj_id: string;
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
  odmiana_id: "",
  opakowanie_source: "catalog",
  opakowanie_id: "",
  opakowanie_query: "",
  opakowanie_custom_text: "",
  material_tary: "",
  material_autofilled: false,
  kraj_id: "",
  palety: "0",
  ilosc_opakowan: "",
  netto_kg: "",
  brutto_kg: "",
  weights_autofilled: false,
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

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l");
}

/** Word-prefix match: query matches start of any word in target (after normalize). */
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

interface ComboProps {
  items: RefItem[];
  value: string;
  query: string;
  onQuery: (s: string) => void;
  onPick: (id: string, label: string) => void;
  placeholder?: string;
  minChars?: number;
  extraTop?: React.ReactNode;
  maxItems?: number;
  filterFn?: (item: RefItem, query: string) => boolean;
}

function Combobox({
  items,
  value,
  query,
  onQuery,
  onPick,
  placeholder,
  minChars = 2,
  extraTop,
  maxItems = 50,
  filterFn,
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
    if (query.trim().length < minChars) return [];
    const fn = filterFn ?? ((it: RefItem, q: string) => startsWithWord(it.search ?? it.label, q));
    return items.filter((it) => fn(it, query)).slice(0, maxItems);
  }, [items, query, minChars, filterFn, maxItems]);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex gap-1">
        <Input
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpen(true);
          }}
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
          {query.trim().length < minChars ? (
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

function Page() {
  const navigate = useNavigate();
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");

  const [dostawcy, setDostawcy] = useState<DostawcaItem[]>([]);
  const [kraje, setKraje] = useState<KrajItem[]>([]);
  const [produkty, setProdukty] = useState<ProduktItem[]>([]);
  const [odmiany, setOdmiany] = useState<RefItem[]>([]);
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [d, k, p, o, op, st, u] = await Promise.all([
        supabase
          .from("dostawcy")
          .select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy, kraj_id")
          .order("nazwa_dostawcy_original"),
        supabase.from("kraje").select("kraj_id, nazwa_pl, iso3").order("nazwa_pl"),
        supabase.from("produkty").select("produkt_id, nazwa_pl, aliasy_pl").order("nazwa_pl"),
        supabase.from("odmiany").select("odmiana_id, odmiana_original, nazwa_produktu_pl").order("odmiana_original"),
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
      setKraje((k.data ?? []).map((x) => ({ id: x.kraj_id, label: x.nazwa_pl || x.kraj_id, iso3: x.iso3 ?? null })));
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
          label: `${x.odmiana_original ?? x.odmiana_id} (${x.nazwa_produktu_pl ?? "—"})`,
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

  // Auto-fill kraj załadunku from selected dostawca.
  // Rules: if user manually set it, never overwrite. If empty OR was auto-filled
  // from previous supplier, update to new supplier kraj_id.
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

  /** Find a standardy_palet row for (produkt_id, opakowanie_id, kraj_id-via-iso3). */
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

  /** Get suggested opakowanie_ids for given product (from standardy_palet). */
  const suggestedOpakIds = (produkt_id: string): Set<string> => {
    const s = new Set<string>();
    if (!produkt_id) return s;
    for (const r of standardy) if (r.produkt_id === produkt_id) s.add(r.opakowanie_id);
    return s;
  };

  const autofillWeights = (i: number, patchBase: Partial<PozycjaForm>) => {
    const merged: PozycjaForm = { ...pozycje[i], ...patchBase };
    if (merged.opakowanie_source !== "catalog") return;
    const std = findStandard(merged.produkt_id, merged.opakowanie_id, merged.kraj_id);
    if (!std) return;
    let palety = Number(merged.palety) || 0;
    if (!palety) palety = 1;
    const ilosc = std.liczba_opakowan_na_palecie ? std.liczba_opakowan_na_palecie * palety : null;
    const netto = std.waga_netto_opakowania_kg && ilosc ? std.waga_netto_opakowania_kg * ilosc : null;
    const brutto = std.waga_brutto_opakowania_kg && ilosc ? std.waga_brutto_opakowania_kg * ilosc : null;
    updateRow(i, {
      ...patchBase,
      palety: String(palety),
      ilosc_opakowan: ilosc !== null ? String(Math.round(ilosc)) : merged.ilosc_opakowan,
      netto_kg: netto !== null ? netto.toFixed(2) : merged.netto_kg,
      brutto_kg: brutto !== null ? brutto.toFixed(2) : merged.brutto_kg,
      weights_autofilled: true,
    });
  };

  const onPickProdukt = (i: number, id: string, label: string) => {
    const cur = pozycje[i];
    const patch: Partial<PozycjaForm> = { produkt_id: id, produkt_query: label };
    // If selected opakowanie no longer relevant, do not force-reset; user can change it.
    updateRow(i, patch);
    if (id && cur.opakowanie_source === "catalog" && cur.opakowanie_id) {
      autofillWeights(i, patch);
    }
  };

  const onPickOpakowanie = (i: number, id: string, label: string) => {
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
    updateRow(i, patch);
    if (id) autofillWeights(i, patch);
  };

  const onUseCustomOpakowanie = (i: number) => {
    updateRow(i, {
      opakowanie_source: "custom",
      opakowanie_id: "",
      opakowanie_query: "",
      material_autofilled: false,
      weights_autofilled: false,
    });
  };

  const onPaletyChange = (i: number, v: string) => {
    const cur = pozycje[i];
    if (cur.opakowanie_source === "catalog" && cur.weights_autofilled) {
      const std = findStandard(cur.produkt_id, cur.opakowanie_id, cur.kraj_id);
      if (std) {
        const palety = Number(v) || 0;
        const ilosc = std.liczba_opakowan_na_palecie ? std.liczba_opakowan_na_palecie * palety : null;
        const netto = std.waga_netto_opakowania_kg && ilosc ? std.waga_netto_opakowania_kg * ilosc : null;
        const brutto = std.waga_brutto_opakowania_kg && ilosc ? std.waga_brutto_opakowania_kg * ilosc : null;
        updateRow(i, {
          palety: v,
          ilosc_opakowan: ilosc !== null ? String(Math.round(ilosc)) : cur.ilosc_opakowan,
          netto_kg: netto !== null ? netto.toFixed(2) : cur.netto_kg,
          brutto_kg: brutto !== null ? brutto.toFixed(2) : cur.brutto_kg,
        });
        return;
      }
    }
    updateRow(i, { palety: v });
  };

  const onPickKraj = (i: number, id: string) => {
    const patch: Partial<PozycjaForm> = { kraj_id: id };
    updateRow(i, patch);
    autofillWeights(i, patch);
  };

  const onMaterialChange = (i: number, v: "karton" | "drewno" | "plastik") => {
    updateRow(i, { material_tary: v, material_autofilled: false });
  };

  const validate = (): string | null => {
    if (!dataZaladunku) return "Data załadunku wymagana";
    if (!dataDostawy) return "Data dostawy / przyjazdu wymagana";
    if (!dostawcaId) return "Dostawca wymagany";
    if (!managerId) return "Manager importu wymagany";
    if (pozycje.length === 0) return "Co najmniej jedna pozycja wymagana";
    for (let i = 0; i < pozycje.length; i++) {
      const p = pozycje[i];
      const n = i + 1;
      if (!p.produkt_id) return `Pozycja ${n}: produkt wymagany (wybierz z listy)`;
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
  const supplierKrajLabel =
    selectedDostawca?.kraj_id
      ? kraje.find((k) => k.id === selectedDostawca.kraj_id)?.label ?? selectedDostawca.kraj_id
      : null;

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
              <Label>Data załadunku *</Label>
              <Input type="date" value={dataZaladunku} onChange={(e) => setDataZaladunku(e.target.value)} />
            </div>
            <div>
              <Label>Data dostawy / przyjazdu *</Label>
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
              const suggested = suggestedOpakIds(p.produkt_id);
              // Sorted opakowania: suggested first, then rest
              const opakSorted: OpakItem[] = p.produkt_id
                ? [
                    ...opakowania.filter((o) => suggested.has(o.id)),
                    ...opakowania.filter((o) => !suggested.has(o.id)),
                  ]
                : opakowania;
              const opakSelectedLabel = p.opakowanie_source === "catalog" && p.opakowanie_id
                ? (opakowania.find((o) => o.id === p.opakowanie_id)?.label ?? "")
                : p.opakowanie_query;

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
                      <Label>Produkt * (wpisz min. 2 znaki)</Label>
                      <Combobox
                        items={produkty}
                        value={p.produkt_id}
                        query={p.produkt_query || (p.produkt_id ? produkty.find((x) => x.id === p.produkt_id)?.label ?? "" : "")}
                        onQuery={(s) => updateRow(i, { produkt_query: s, produkt_id: "" })}
                        onPick={(id, label) => onPickProdukt(i, id, label)}
                        placeholder="Np. banan, ananas…"
                      />
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
                    <div className="md:col-span-2">
                      <Label>Opakowanie *</Label>
                      {p.opakowanie_source === "custom" ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Wpisz nazwę własnego opakowania (max 200 znaków)"
                            maxLength={200}
                            value={p.opakowanie_custom_text}
                            onChange={(e) => updateRow(i, { opakowanie_custom_text: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateRow(i, {
                                opakowanie_source: "catalog",
                                opakowanie_custom_text: "",
                              })
                            }
                          >
                            Wróć do katalogu
                          </Button>
                        </div>
                      ) : (
                        <Combobox
                          items={opakSorted}
                          value={p.opakowanie_id}
                          query={opakSelectedLabel}
                          onQuery={(s) => updateRow(i, { opakowanie_query: s, opakowanie_id: "" })}
                          onPick={(id, label) => onPickOpakowanie(i, id, label)}
                          placeholder={p.produkt_id ? "Wyszukaj opakowanie…" : "Wybierz najpierw produkt, lub wyszukaj"}
                          minChars={2}
                          extraTop={
                            <button
                              type="button"
                              className="block w-full text-left px-3 py-2 text-sm bg-accent/40 hover:bg-accent border-b font-medium"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                onUseCustomOpakowanie(i);
                              }}
                            >
                              ➕ Wpisz własne opakowanie
                            </button>
                          }
                          filterFn={(it, q) => {
                            if (q.trim().length < 1) return suggested.has(it.id);
                            return startsWithWord(it.search ?? it.label, q);
                          }}
                        />
                      )}
                      {p.produkt_id && p.opakowanie_source === "catalog" && suggested.size > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pokazujemy najpierw opakowania znane dla tego produktu ({suggested.size}).
                        </p>
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
                      <Select value={p.kraj_id} onValueChange={(v) => onPickKraj(i, v)}>
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
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={p.palety}
                        onChange={(e) => onPaletyChange(i, e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Ilość opakowań</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={p.ilosc_opakowan}
                        onChange={(e) => updateRow(i, { ilosc_opakowan: e.target.value, weights_autofilled: false })}
                      />
                    </div>
                    <div>
                      <Label>Netto (kg) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.netto_kg}
                        onChange={(e) => updateRow(i, { netto_kg: e.target.value, weights_autofilled: false })}
                      />
                    </div>
                    <div>
                      <Label>Brutto (kg)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.brutto_kg}
                        onChange={(e) => updateRow(i, { brutto_kg: e.target.value, weights_autofilled: false })}
                      />
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
