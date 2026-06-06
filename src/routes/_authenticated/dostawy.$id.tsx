import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

interface Dostawa {
  id: string;
  numer_dostawy: string;
  data_dostawy: string;
  data_zaladunku: string | null;
  status: string;
  dostawca_id: string;
  kraj_id: string | null;
  import_manager_id: string;
  notes: string | null;
  created_at: string;
}

interface Pozycja {
  id: string;
  position_id: string;
  produkt_id: string;
  odmiana_id: string | null;
  opakowanie_id: string | null;
  opakowanie_source: "catalog" | "custom" | "none";
  opakowanie_custom_text: string | null;
  material_tary: "karton" | "drewno" | "plastik";
  kraj_id: string | null;
  palety: number;
  ilosc_opakowan: number | null;
  netto_kg: number;
  brutto_kg: number | null;
  cena_zakupu: number;
  waluta: string;
  notes: string | null;
}

function materialLabel(m: string): string {
  if (m === "karton") return "Karton";
  if (m === "drewno") return "Drewno";
  if (m === "plastik") return "Plastik";
  return m;
}

function opakLabel(p: Pozycja, catalogMap: Map<string, string>): string {
  if (p.opakowanie_source === "none") return "Bez opakowania";
  if (p.opakowanie_source === "custom") return p.opakowanie_custom_text || "—";
  if (p.opakowanie_id) return catalogMap.get(p.opakowanie_id) ?? p.opakowanie_id;
  return "—";
}

interface PozycjaStatus {
  position_id: string;
  stock_status: string;
  settlement_status: string;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "planned" ? "Zaplanowana" : "Szkic";
  return <Badge variant={status === "planned" ? "default" : "secondary"}>{label}</Badge>;
}

function Page() {
  const { id } = Route.useParams();
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");
  const canSeeFinance =
    isSuper ||
    roleKeys.includes("kierownik") ||
    roleKeys.includes("asystent_kierownika") ||
    isImportMgr;


  const [dostawa, setDostawa] = useState<Dostawa | null>(null);
  const [pozycje, setPozycje] = useState<Pozycja[]>([]);
  const [statuses, setStatuses] = useState<Map<string, PozycjaStatus>>(new Map());
  const [labels, setLabels] = useState<{
    dostawca: string;
    kraj: string;
    manager: string;
    produkty: Map<string, string>;
    odmiany: Map<string, string>;
    opakowania: Map<string, string>;
    kraje: Map<string, string>;
  }>({
    dostawca: "",
    kraj: "",
    manager: "",
    produkty: new Map(),
    odmiany: new Map(),
    opakowania: new Map(),
    kraje: new Map(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: d, error: dErr } = await supabase
        .from("dostawy")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (dErr) {
        setError(dErr.message);
        setLoading(false);
        return;
      }
      if (!d) {
        setError("Nie znaleziono dostawy.");
        setLoading(false);
        return;
      }
      setDostawa(d as Dostawa);

      const { data: pz } = await supabase
        .from("pozycje_dostawy")
        .select("*")
        .eq("dostawa_id", id)
        .order("position_id");
      if (cancelled) return;
      const list = (pz ?? []) as Pozycja[];
      setPozycje(list);

      const positionIds = list.map((p) => p.position_id);
      const [pst, dRef, kRef, mRef, prodRef, odmRef, opakRef, krajPochRef] = await Promise.all([
        positionIds.length
          ? supabase.from("pozycje").select("position_id, stock_status, settlement_status").in("position_id", positionIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("dostawcy")
          .select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy")
          .eq("dostawca_id", d.dostawca_id)
          .maybeSingle(),
        d.kraj_id
          ? supabase.from("kraje").select("kraj_id, nazwa_pl").eq("kraj_id", d.kraj_id).maybeSingle()
          : Promise.resolve({ data: null }),
        isSuper
          ? supabase
              .from("uzytkownicy")
              .select("uzytkownik_id, imie_nazwisko")
              .eq("uzytkownik_id", d.import_manager_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),

        list.length
          ? supabase
              .from("produkty")
              .select("produkt_id, nazwa_pl")
              .in("produkt_id", [...new Set(list.map((p) => p.produkt_id))])
          : Promise.resolve({ data: [] }),
        list.length
          ? supabase
              .from("odmiany")
              .select("odmiana_id, odmiana_original")
              .in("odmiana_id", [...new Set(list.map((p) => p.odmiana_id).filter(Boolean) as string[])])
          : Promise.resolve({ data: [] }),
        list.length
          ? supabase
              .from("opakowania")
              .select("opakowanie_id, typ_opakowania_pl, wariant_opakowania_pl")
              .in("opakowanie_id", [...new Set(list.map((p) => p.opakowanie_id).filter(Boolean) as string[])])
          : Promise.resolve({ data: [] }),
        list.length
          ? supabase
              .from("kraje")
              .select("kraj_id, nazwa_pl")
              .in("kraj_id", [...new Set(list.map((p) => p.kraj_id).filter(Boolean) as string[])])
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const sMap = new Map<string, PozycjaStatus>();
      ((pst.data ?? []) as PozycjaStatus[]).forEach((s) => sMap.set(s.position_id, s));
      setStatuses(sMap);

      const dostawcaLabel = dRef.data
        ? ((dRef.data as { nazwa_dostawcy_original: string | null }).nazwa_dostawcy_original ||
            (dRef.data as { alias_dostawcy: string | null }).alias_dostawcy ||
            d.dostawca_id)
        : d.dostawca_id;
      const krajLabel = kRef.data
        ? ((kRef.data as { nazwa_pl: string | null }).nazwa_pl || d.kraj_id || "")
        : d.kraj_id || "";
      const mgrLabel = mRef.data
        ? ((mRef.data as { imie_nazwisko: string | null }).imie_nazwisko || d.import_manager_id)
        : !isSuper && isImportMgr && profile?.uzytkownik_id === d.import_manager_id && profile?.imie_nazwisko
          ? profile.imie_nazwisko
          : d.import_manager_id;


      const produktyMap = new Map<string, string>();
      ((prodRef.data ?? []) as Array<{ produkt_id: string; nazwa_pl: string | null }>).forEach((x) =>
        produktyMap.set(x.produkt_id, x.nazwa_pl || x.produkt_id),
      );
      const odmianyMap = new Map<string, string>();
      ((odmRef.data ?? []) as Array<{ odmiana_id: string; odmiana_original: string | null }>).forEach((x) =>
        odmianyMap.set(x.odmiana_id, x.odmiana_original || x.odmiana_id),
      );
      const opakowaniaMap = new Map<string, string>();
      ((opakRef.data ?? []) as Array<{ opakowanie_id: string; typ_opakowania_pl: string | null; wariant_opakowania_pl: string | null }>).forEach(
        (x) =>
          opakowaniaMap.set(
            x.opakowanie_id,
            [x.typ_opakowania_pl, x.wariant_opakowania_pl].filter(Boolean).join(" / ") || x.opakowanie_id,
          ),
      );
      const krajeMap = new Map<string, string>();
      ((krajPochRef.data ?? []) as Array<{ kraj_id: string; nazwa_pl: string | null }>).forEach((x) =>
        krajeMap.set(x.kraj_id, x.nazwa_pl || x.kraj_id),
      );

      setLabels({
        dostawca: dostawcaLabel,
        kraj: krajLabel,
        manager: mgrLabel,
        produkty: produktyMap,
        odmiany: odmianyMap,
        opakowania: opakowaniaMap,
        kraje: krajeMap,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <RoleGuard path="/dostawy">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dostawy">
            <ArrowLeft className="h-4 w-4" /> Powrót do listy
          </Link>
        </Button>

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : error ? (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : dostawa ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold font-mono">{dostawa.numer_dostawy}</h1>
                <p className="text-sm text-muted-foreground">Widok tylko do odczytu</p>
              </div>
              <StatusBadge status={dostawa.status} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Dane dostawy</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Data załadunku:</span> <strong>{dostawa.data_zaladunku ?? "—"}</strong></div>
                <div><span className="text-muted-foreground">Data dostawy / przyjazdu:</span> <strong>{dostawa.data_dostawy}</strong></div>
                <div><span className="text-muted-foreground">Dostawca:</span> <strong>{labels.dostawca}</strong></div>
                <div><span className="text-muted-foreground">Kraj załadunku:</span> <strong>{labels.kraj || "—"}</strong></div>
                <div><span className="text-muted-foreground">Manager importu:</span> <strong>{labels.manager}</strong></div>
                {dostawa.notes && (
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Notatki:</span> {dostawa.notes}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pozycje ({pozycje.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead>Odmiana</TableHead>
                        <TableHead>Opakowanie</TableHead>
                        <TableHead>Materiał tary</TableHead>
                        <TableHead>Kraj poch.</TableHead>
                        <TableHead className="text-right">Palety</TableHead>
                        <TableHead className="text-right">Netto kg</TableHead>
                        {canSeeFinance && <TableHead className="text-right">Cena</TableHead>}
                        {canSeeFinance && <TableHead>Waluta</TableHead>}
                        <TableHead>Stock</TableHead>
                        <TableHead>Settlement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pozycje.map((p, idx) => {
                        const st = statuses.get(p.position_id);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>{labels.produkty.get(p.produkt_id) ?? p.produkt_id}</TableCell>
                            <TableCell>{p.odmiana_id ? (labels.odmiany.get(p.odmiana_id) ?? p.odmiana_id) : "—"}</TableCell>
                            <TableCell>
                              {opakLabel(p, labels.opakowania)}
                              {p.opakowanie_source === "custom" && (
                                <Badge variant="secondary" className="ml-2">własne</Badge>
                              )}
                            </TableCell>
                            <TableCell>{materialLabel(p.material_tary)}</TableCell>
                            <TableCell>{p.kraj_id ? (labels.kraje.get(p.kraj_id) ?? p.kraj_id) : "—"}</TableCell>
                            <TableCell className="text-right">{p.palety}</TableCell>
                            <TableCell className="text-right">{Number(p.netto_kg).toFixed(2)}</TableCell>
                            {canSeeFinance && <TableCell className="text-right">{Number(p.cena_zakupu).toFixed(2)}</TableCell>}
                            {canSeeFinance && <TableCell>{p.waluta}</TableCell>}
                            <TableCell><Badge variant="outline">{st?.stock_status ?? "—"}</Badge></TableCell>
                            <TableCell><Badge variant="outline">{st?.settlement_status ?? "—"}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: cards */}
                <div className="md:hidden p-3 space-y-2">
                  {pozycje.map((p, idx) => {
                    const st = statuses.get(p.position_id);
                    return (
                      <div key={p.id} className="rounded-md border p-3 space-y-1 text-sm">
                        <div className="text-xs text-muted-foreground">Pozycja {idx + 1}</div>
                        <div className="font-medium">{labels.produkty.get(p.produkt_id) ?? p.produkt_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.odmiana_id ? (labels.odmiany.get(p.odmiana_id) ?? p.odmiana_id) : "—"}
                          {" · "}
                          {p.opakowanie_source === "custom"
                            ? `${p.opakowanie_custom_text || "—"} (własne)`
                            : p.opakowanie_source === "none"
                              ? "Bez opakowania"
                              : opakLabel(p, labels.opakowania)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Materiał tary: <strong>{materialLabel(p.material_tary)}</strong>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Kraj poch.: {p.kraj_id ? (labels.kraje.get(p.kraj_id) ?? p.kraj_id) : "—"}
                        </div>
                        <div className="text-xs">
                          Palety: <strong>{p.palety}</strong> · Netto: <strong>{Number(p.netto_kg).toFixed(2)} kg</strong>
                        </div>
                        {canSeeFinance && (
                          <div className="text-xs">
                            Cena: <strong>{Number(p.cena_zakupu).toFixed(2)} {p.waluta}</strong>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          <Badge variant="outline">stock: {st?.stock_status ?? "—"}</Badge>
                          <Badge variant="outline">settlement: {st?.settlement_status ?? "—"}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

          </>
        ) : null}
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/dostawy/$id")({
  head: () => ({ meta: [{ title: "Dostawa — Tropical Trade Platform" }] }),
  component: Page,
});
