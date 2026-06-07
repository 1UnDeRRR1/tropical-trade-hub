import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SesjaCapacityMeter } from "@/components/SesjaCapacityMeter";

interface Sesja {
  sesja_id: string;
  numer_sesji: string;
  numer_auta: string | null;
  przewoznik_id: string | null;
  etd: string | null;
  eta: string | null;
  status: string;
  notes: string | null;
  preliminary_transport_cost_eur: number | null;
  final_transport_cost_eur: number | null;
  final_locked_at: string | null;
  waluta: string;
  import_manager_id: string;
}

interface DostawaLite {
  id: string;
  numer_dostawy: string;
  data_zaladunku: string;
  data_dostawy: string;
  status: string;
  dostawca_id: string;
  kraj_id: string | null;
  dostawca_nazwa?: string;
  kraj_nazwa?: string | null;
  palety_sum?: number;
  brutto_sum?: number;
}

function statusLabel(s: string): string {
  return ({ draft: "Szkic", planned: "Zaplanowana", in_transit: "W drodze", delivered: "Dostarczona" } as Record<string, string>)[s] ?? s;
}

function fmtEur(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "EUR" }).format(Number(v));
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground sm:w-44 sm:shrink-0 sm:pt-0.5">
        {label}
      </div>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");

  const [sesja, setSesja] = useState<Sesja | null>(null);
  const [dostawy, setDostawy] = useState<DostawaLite[]>([]);
  const [dostawyVisible, setDostawyVisible] = useState<boolean>(true);
  const [pozycjeVisible, setPozycjeVisible] = useState<boolean>(true);
  const [paletySum, setPaletySum] = useState<number | null>(null);
  const [bruttoSum, setBruttoSum] = useState<number | null>(null);
  const [przewoznikNazwa, setPrzewoznikNazwa] = useState<string | null>(null);
  const [managerNazwa, setManagerNazwa] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);

      const { data: sData, error: sErr } = await supabase
        .from("transport_sesje")
        .select(
          "sesja_id, numer_sesji, numer_auta, przewoznik_id, etd, eta, status, notes, preliminary_transport_cost_eur, final_transport_cost_eur, final_locked_at, waluta, import_manager_id",
        )
        .eq("sesja_id", id)
        .maybeSingle();
      if (cancelled) return;
      if (sErr) {
        setError(sErr.message);
        setLoading(false);
        return;
      }
      if (!sData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const s = sData as Sesja;
      setSesja(s);

      // przewoznik lookup
      if (s.przewoznik_id) {
        const { data: pData } = await supabase
          .from("przewoznicy")
          .select("przewoznik_id, nazwa_firmy, nazwa_firmy_oryginalna")
          .eq("przewoznik_id", s.przewoznik_id)
          .maybeSingle();
        if (!cancelled && pData) {
          const p = pData as { nazwa_firmy: string | null; nazwa_firmy_oryginalna: string | null };
          setPrzewoznikNazwa(p.nazwa_firmy_oryginalna || p.nazwa_firmy || s.przewoznik_id);
        }
      }

      // manager lookup
      if (isSuper) {
        const { data: uData } = await supabase
          .from("uzytkownicy")
          .select("uzytkownik_id, imie_nazwisko")
          .eq("uzytkownik_id", s.import_manager_id)
          .maybeSingle();
        if (!cancelled && uData) {
          const u = uData as { imie_nazwisko: string | null };
          setManagerNazwa(u.imie_nazwisko || s.import_manager_id);
        }
      } else if (isImportMgr && profile?.uzytkownik_id === s.import_manager_id && profile.imie_nazwisko) {
        setManagerNazwa(profile.imie_nazwisko);
      } else {
        setManagerNazwa(s.import_manager_id);
      }

      // dostawy
      const { data: dRows, error: dErr } = await supabase
        .from("dostawy")
        .select("id, numer_dostawy, data_zaladunku, data_dostawy, status, dostawca_id, kraj_id")
        .eq("sesja_id", id)
        .order("data_dostawy", { ascending: false });

      if (cancelled) return;

      if (dErr) {
        setDostawyVisible(false);
        setPaletySum(null);
        setBruttoSum(null);
        setLoading(false);
        return;
      }
      const dList = (dRows ?? []) as DostawaLite[];
      setDostawyVisible(true);

      if (dList.length === 0) {
        setDostawy([]);
        // Brak widocznych dostaw — pojemność nieznana (nie wiemy: pusta sesja czy RLS)
        setPaletySum(null);
        setBruttoSum(null);
        setLoading(false);
        return;
      }

      const dIds = dList.map((d) => d.id);
      const dostawcaIds = [...new Set(dList.map((d) => d.dostawca_id))];
      const krajIds = [...new Set(dList.map((d) => d.kraj_id).filter(Boolean) as string[])];

      const [dostRes, krajRes, pozRes] = await Promise.all([
        dostawcaIds.length
          ? supabase
              .from("dostawcy")
              .select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy")
              .in("dostawca_id", dostawcaIds)
          : Promise.resolve({ data: [], error: null }),
        krajIds.length
          ? supabase.from("kraje").select("kraj_id, nazwa_pl").in("kraj_id", krajIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("pozycje_dostawy").select("dostawa_id, palety, brutto_kg").in("dostawa_id", dIds),
      ]);
      if (cancelled) return;

      const dostMap = new Map<string, string>();
      ((dostRes.data ?? []) as Array<{ dostawca_id: string; nazwa_dostawcy_original: string | null; alias_dostawcy: string | null }>).forEach(
        (d) => dostMap.set(d.dostawca_id, d.nazwa_dostawcy_original || d.alias_dostawcy || d.dostawca_id),
      );
      const krajMap = new Map<string, string>();
      ((krajRes.data ?? []) as Array<{ kraj_id: string; nazwa_pl: string | null }>).forEach((k) =>
        krajMap.set(k.kraj_id, k.nazwa_pl || k.kraj_id),
      );

      const perDostawaPal = new Map<string, number>();
      const perDostawaBrt = new Map<string, number>();
      let totalPal = 0;
      let totalBrt = 0;

      if (pozRes.error) {
        setPozycjeVisible(false);
        setPaletySum(null);
        setBruttoSum(null);
      } else {
        setPozycjeVisible(true);
        ((pozRes.data ?? []) as Array<{ dostawa_id: string; palety: number | null; brutto_kg: number | null }>).forEach((p) => {
          const pal = Number(p.palety ?? 0);
          const brt = Number(p.brutto_kg ?? 0);
          perDostawaPal.set(p.dostawa_id, (perDostawaPal.get(p.dostawa_id) ?? 0) + pal);
          perDostawaBrt.set(p.dostawa_id, (perDostawaBrt.get(p.dostawa_id) ?? 0) + brt);
          totalPal += pal;
          totalBrt += brt;
        });
        setPaletySum(totalPal);
        setBruttoSum(totalBrt);
      }

      setDostawy(
        dList.map((d) => ({
          ...d,
          dostawca_nazwa: dostMap.get(d.dostawca_id) ?? d.dostawca_id,
          kraj_nazwa: d.kraj_id ? (krajMap.get(d.kraj_id) ?? d.kraj_id) : null,
          palety_sum: perDostawaPal.get(d.id) ?? 0,
          brutto_sum: perDostawaBrt.get(d.id) ?? 0,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isSuper, isImportMgr, profile?.uzytkownik_id, profile?.imie_nazwisko]);

  return (
    <RoleGuard path="/sesje">
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/sesje" className="hover:underline">
            ← Sesje transportowe
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : error ? (
          <Card>
            <CardContent className="py-4 text-sm text-destructive break-words">{error}</CardContent>
          </Card>
        ) : notFound || !sesja ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Sesja nie istnieje albo brak dostępu.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-bold break-all font-mono">{sesja.numer_sesji}</h1>
              <Badge variant="secondary">{statusLabel(sesja.status)}</Badge>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Metadane sesji</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <MetaRow label="Numer auta">
                  <span className="font-mono">{sesja.numer_auta ?? "—"}</span>
                </MetaRow>
                <MetaRow label="Przewoźnik">{przewoznikNazwa ?? "—"}</MetaRow>
                <MetaRow label="ETD">{sesja.etd ?? "—"}</MetaRow>
                <MetaRow label="ETA">{sesja.eta ?? "—"}</MetaRow>
                <MetaRow label="Status">{statusLabel(sesja.status)}</MetaRow>
                <MetaRow label="Notatki">
                  <span className="whitespace-pre-wrap">{sesja.notes ?? "—"}</span>
                </MetaRow>
                <MetaRow label="Manager importu">{managerNazwa ?? sesja.import_manager_id}</MetaRow>
                <MetaRow label="Waluta">{sesja.waluta}</MetaRow>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Koszt transportu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <MetaRow label="Wstępny">
                    <span className="tabular-nums">{fmtEur(sesja.preliminary_transport_cost_eur)}</span>
                  </MetaRow>
                  <MetaRow label="Final">
                    <span className="tabular-nums">{fmtEur(sesja.final_transport_cost_eur)}</span>
                  </MetaRow>
                  <MetaRow label="Final zablokowany">
                    {sesja.final_locked_at ? new Date(sesja.final_locked_at).toLocaleString("pl-PL") : "—"}
                  </MetaRow>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pojemność sesji</CardTitle>
                </CardHeader>
                <CardContent>
                  <SesjaCapacityMeter
                    palety={paletySum}
                    bruttoKg={bruttoSum}
                    unknown={!dostawyVisible || !pozycjeVisible}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Powiązane dostawy</CardTitle>
              </CardHeader>
              <CardContent>
                {!dostawyVisible ? (
                  <p className="text-sm text-muted-foreground">Dane dostaw niedostępne w tym widoku.</p>
                ) : dostawy.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Brak dostępu do dostaw albo brak powiązanych dostaw.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {dostawy.map((d) => (
                      <li key={d.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="min-w-0">
                          <Link
                            to="/dostawy/$id"
                            params={{ id: d.id }}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {d.numer_dostawy}
                          </Link>
                          <div className="text-sm truncate">{d.dostawca_nazwa}</div>
                          <div className="text-xs text-muted-foreground">
                            Załad.: {d.data_zaladunku} · Dost.: {d.data_dostawy} · {d.kraj_nazwa ?? "—"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums sm:text-right">
                          {pozycjeVisible
                            ? `${d.palety_sum ?? 0} pal. · ${(d.brutto_sum ?? 0).toLocaleString("pl-PL")} kg`
                            : "pozycje: —"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/sesje/$id/")({
  head: () => ({ meta: [{ title: "Sesja transportowa — Tropical Trade Platform" }] }),
  component: Page,
});
