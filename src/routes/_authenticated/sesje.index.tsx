import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SesjaRow {
  sesja_id: string;
  numer_sesji: string;
  numer_auta: string | null;
  przewoznik_id: string | null;
  etd: string | null;
  eta: string | null;
  status: string;
  preliminary_transport_cost_eur: number | null;
  final_transport_cost_eur: number | null;
  final_locked_at: string | null;
  import_manager_id: string;
  przewoznik_nazwa?: string | null;
  manager_nazwa?: string | null;
  dostaw_count?: number;
  dostaw_visible?: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    draft: { label: "Szkic", variant: "secondary" },
    planned: { label: "Zaplanowana", variant: "default" },
    in_transit: { label: "W drodze", variant: "default" },
    delivered: { label: "Dostarczona", variant: "outline" },
  };
  const e = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={e.variant}>{e.label}</Badge>;
}

function fmtEur(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "EUR" }).format(Number(v));
}

function Page() {
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");

  const [rows, setRows] = useState<SesjaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const { data: sesje, error: sErr } = await supabase
        .from("transport_sesje")
        .select(
          "sesja_id, numer_sesji, numer_auta, przewoznik_id, etd, eta, status, preliminary_transport_cost_eur, final_transport_cost_eur, final_locked_at, import_manager_id",
        )
        .order("etd", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (sErr) {
        setError(sErr.message);
        setLoading(false);
        return;
      }

      const list = (sesje ?? []) as SesjaRow[];
      const sesjaIds = list.map((s) => s.sesja_id);
      const przIds = [...new Set(list.map((s) => s.przewoznik_id).filter(Boolean) as string[])];
      const mgrIds = [...new Set(list.map((s) => s.import_manager_id))];

      const [przRes, mgrRes, dostRes] = await Promise.all([
        przIds.length
          ? supabase.from("przewoznicy").select("przewoznik_id, nazwa_firmy, nazwa_firmy_oryginalna").in("przewoznik_id", przIds)
          : Promise.resolve({ data: [], error: null }),
        isSuper && mgrIds.length
          ? supabase.from("uzytkownicy").select("uzytkownik_id, imie_nazwisko").in("uzytkownik_id", mgrIds)
          : Promise.resolve({ data: [], error: null }),
        sesjaIds.length
          ? supabase.from("dostawy").select("id, sesja_id").in("sesja_id", sesjaIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancelled) return;

      const przMap = new Map<string, string>();
      ((przRes.data ?? []) as Array<{ przewoznik_id: string; nazwa_firmy: string | null; nazwa_firmy_oryginalna: string | null }>).forEach(
        (p) => przMap.set(p.przewoznik_id, p.nazwa_firmy_oryginalna || p.nazwa_firmy || p.przewoznik_id),
      );
      const mgrMap = new Map<string, string>();
      ((mgrRes.data ?? []) as Array<{ uzytkownik_id: string; imie_nazwisko: string | null }>).forEach(
        (u) => mgrMap.set(u.uzytkownik_id, u.imie_nazwisko || u.uzytkownik_id),
      );
      if (!isSuper && isImportMgr && profile?.uzytkownik_id && profile.imie_nazwisko) {
        mgrMap.set(profile.uzytkownik_id, profile.imie_nazwisko);
      }
      const countMap = new Map<string, number>();
      ((dostRes.data ?? []) as Array<{ id: string; sesja_id: string }>).forEach((d) =>
        countMap.set(d.sesja_id, (countMap.get(d.sesja_id) ?? 0) + 1),
      );
      const dostavyVisible = !dostRes.error;

      setRows(
        list.map((s) => ({
          ...s,
          przewoznik_nazwa: s.przewoznik_id ? (przMap.get(s.przewoznik_id) ?? s.przewoznik_id) : null,
          manager_nazwa: mgrMap.get(s.import_manager_id) ?? s.import_manager_id,
          dostaw_count: countMap.get(s.sesja_id) ?? 0,
          dostaw_visible: dostavyVisible,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuper, isImportMgr, profile?.uzytkownik_id, profile?.imie_nazwisko]);

  return (
    <RoleGuard path="/sesje">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Sesje transportowe</h1>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive break-words">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Brak sesji transportowych dostępnych w tym widoku.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer sesji</TableHead>
                    <TableHead>Auto</TableHead>
                    <TableHead>Przewoźnik</TableHead>
                    <TableHead>ETD / ETA</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Dostawy</TableHead>
                    <TableHead className="text-right">Wstępny</TableHead>
                    <TableHead className="text-right">Final</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.sesja_id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          to="/sesje/$id"
                          params={{ id: r.sesja_id }}
                          className="text-primary hover:underline"
                        >
                          {r.numer_sesji}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.numer_auta ?? "—"}</TableCell>
                      <TableCell>{r.przewoznik_nazwa ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-xs leading-tight">
                          <div>ETD: {r.etd ?? "—"}</div>
                          <div className="text-muted-foreground">ETA: {r.eta ?? "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{r.manager_nazwa}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.dostaw_visible ? r.dostaw_count : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtEur(r.preliminary_transport_cost_eur)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtEur(r.final_transport_cost_eur)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {rows.map((r) => (
                <Link
                  key={r.sesja_id}
                  to="/sesje/$id"
                  params={{ id: r.sesja_id }}
                  className="block"
                >
                  <Card>
                    <CardContent className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs truncate">{r.numer_sesji}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-sm font-medium truncate">{r.przewoznik_nazwa ?? "Brak przewoźnika"}</div>
                      <div className="text-xs text-muted-foreground">
                        Auto: <span className="font-mono">{r.numer_auta ?? "—"}</span> · ETD: {r.etd ?? "—"} · ETA: {r.eta ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground flex justify-between gap-2">
                        <span>{r.dostaw_visible ? `${r.dostaw_count} dost.` : "dost.: —"}</span>
                        <span className="tabular-nums">
                          {fmtEur(r.preliminary_transport_cost_eur)} / {fmtEur(r.final_transport_cost_eur)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{r.manager_nazwa}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/_authenticated/sesje/")({
  head: () => ({ meta: [{ title: "Sesje transportowe — Tropical Trade Platform" }] }),
  component: Page,
});
