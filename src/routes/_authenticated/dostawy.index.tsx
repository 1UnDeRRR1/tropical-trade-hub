import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Card, CardContent } from "@/components/ui/card";

interface Row {
  id: string;
  numer_dostawy: string;
  data_dostawy: string;
  status: string;
  dostawca_id: string;
  kraj_id: string | null;
  import_manager_id: string;
  dostawca_nazwa?: string | null;
  kraj_nazwa?: string | null;
  manager_nazwa?: string | null;
  pozycji?: number;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "planned" ? "default" : "secondary";
  const label = status === "planned" ? "Zaplanowana" : "Szkic";
  return <Badge variant={variant}>{label}</Badge>;
}

function Page() {
  const { profile, roleKeys } = useCurrentProfile();
  const isSuper = roleKeys.includes("super_admin");
  const isImportMgr = roleKeys.includes("import_manager");
  const canCreate = isSuper || isImportMgr;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: dostawy, error: dErr } = await supabase
        .from("dostawy")
        .select("id, numer_dostawy, data_dostawy, status, dostawca_id, kraj_id, import_manager_id")
        .order("data_dostawy", { ascending: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (dErr) {
        setError(dErr.message);
        setLoading(false);
        return;
      }
      const list = (dostawy ?? []) as Row[];
      const dostawcaIds = [...new Set(list.map((r) => r.dostawca_id))];
      const krajIds = [...new Set(list.map((r) => r.kraj_id).filter(Boolean) as string[])];
      const managerIds = [...new Set(list.map((r) => r.import_manager_id))];
      const ids = list.map((r) => r.id);

      const [dostRes, krajRes, mgrRes, pozRes] = await Promise.all([
        dostawcaIds.length
          ? supabase
              .from("dostawcy")
              .select("dostawca_id, nazwa_dostawcy_original, alias_dostawcy")
              .in("dostawca_id", dostawcaIds)
          : Promise.resolve({ data: [], error: null }),
        krajIds.length
          ? supabase.from("kraje").select("kraj_id, nazwa_pl").in("kraj_id", krajIds)
          : Promise.resolve({ data: [], error: null }),
        // Only Superadministrator reads uzytkownicy directly.
        // Import manager uses own profile name. Other roles see the id.
        isSuper && managerIds.length
          ? supabase
              .from("uzytkownicy")
              .select("uzytkownik_id, imie_nazwisko")
              .in("uzytkownik_id", managerIds)
          : Promise.resolve({ data: [], error: null }),
        ids.length
          ? supabase.from("pozycje_dostawy").select("dostawa_id").in("dostawa_id", ids)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancelled) return;

      const dostMap = new Map<string, string>();
      ((dostRes.data ?? []) as Array<{ dostawca_id: string; nazwa_dostawcy_original: string | null; alias_dostawcy: string | null }>).forEach((d) =>
        dostMap.set(d.dostawca_id, d.alias_dostawcy || d.nazwa_dostawcy_original || d.dostawca_id),
      );
      const krajMap = new Map<string, string>();
      ((krajRes.data ?? []) as Array<{ kraj_id: string; nazwa_pl: string | null }>).forEach((k) =>
        krajMap.set(k.kraj_id, k.nazwa_pl || k.kraj_id),
      );
      const mgrMap = new Map<string, string>();
      ((mgrRes.data ?? []) as Array<{ uzytkownik_id: string; imie_nazwisko: string | null }>).forEach(
        (u) => mgrMap.set(u.uzytkownik_id, u.imie_nazwisko || u.uzytkownik_id),
      );
      // Self-name fallback for Import manager (his/her own rows).
      if (!isSuper && isImportMgr && profile?.uzytkownik_id && profile.imie_nazwisko) {
        mgrMap.set(profile.uzytkownik_id, profile.imie_nazwisko);
      }
      const countMap = new Map<string, number>();
      ((pozRes.data ?? []) as Array<{ dostawa_id: string }>).forEach((p) =>
        countMap.set(p.dostawa_id, (countMap.get(p.dostawa_id) ?? 0) + 1),
      );

      setRows(
        list.map((r) => ({
          ...r,
          dostawca_nazwa: dostMap.get(r.dostawca_id) ?? r.dostawca_id,
          kraj_nazwa: r.kraj_id ? (krajMap.get(r.kraj_id) ?? r.kraj_id) : null,
          manager_nazwa: mgrMap.get(r.import_manager_id) ?? r.import_manager_id,
          pozycji: countMap.get(r.id) ?? 0,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuper, isImportMgr, profile?.uzytkownik_id, profile?.imie_nazwisko]);


  return (
    <RoleGuard path="/dostawy">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Dostawy</h1>
          <Button asChild>
            <Link to="/dostawy/nowa">
              <Plus className="h-4 w-4" /> Utwórz dostawę
            </Link>
          </Button>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Brak dostaw. Kliknij „Utwórz dostawę", aby dodać pierwszą.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Dostawca</TableHead>
                    <TableHead>Kraj</TableHead>
                    <TableHead>Manager importu</TableHead>
                    <TableHead className="text-right">Pozycji</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer">
                      <TableCell className="font-mono text-xs">
                        <Link
                          to="/dostawy/$id"
                          params={{ id: r.id }}
                          className="text-primary hover:underline"
                        >
                          {r.numer_dostawy}
                        </Link>
                      </TableCell>
                      <TableCell>{r.data_dostawy}</TableCell>
                      <TableCell>{r.dostawca_nazwa}</TableCell>
                      <TableCell>{r.kraj_nazwa ?? "—"}</TableCell>
                      <TableCell>{r.manager_nazwa}</TableCell>
                      <TableCell className="text-right">{r.pozycji}</TableCell>
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
                  key={r.id}
                  to="/dostawy/$id"
                  params={{ id: r.id }}
                  className="block"
                >
                  <Card>
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{r.numer_dostawy}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-sm font-medium">{r.dostawca_nazwa}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.data_dostawy} · {r.kraj_nazwa ?? "—"} · {r.pozycji} poz.
                      </div>
                      <div className="text-xs text-muted-foreground">{r.manager_nazwa}</div>
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

export const Route = createFileRoute("/_authenticated/dostawy/")({
  head: () => ({ meta: [{ title: "Dostawy — Tropical Trade Platform" }] }),
  component: Page,
});
