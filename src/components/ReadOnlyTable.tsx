import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ColumnDef<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  table: string;
  columns: ColumnDef<T>[];
  orderBy?: string;
  searchFields?: string[];
  /** Optional row transform, e.g. to mask auth_user_id */
  transform?: (rows: any[]) => T[];
}

export function ReadOnlyTable<T extends Record<string, any>>({
  table,
  columns,
  orderBy,
  searchFields,
  transform,
}: Props<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabase as any).from(table).select("*");
      if (orderBy) query = query.order(orderBy, { ascending: true });
      const { data, error } = await query.limit(5000);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        const list = Array.isArray(data) ? data : [];
        setRows(transform ? transform(list) : (list as T[]));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [table, orderBy, transform]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    const fields = searchFields ?? columns.map((c) => c.key);
    return rows.filter((r) =>
      fields.some((f) => {
        const v = r?.[f];
        return v != null && String(v).toLowerCase().includes(term);
      }),
    );
  }, [rows, q, searchFields, columns]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <Input
          placeholder="Szukaj…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="text-xs text-muted-foreground flex items-center gap-3">
          <span className="rounded bg-muted px-2 py-0.5">Tylko podgląd</span>
          <span>
            Liczba rekordów: {loading ? "…" : filtered.length}
            {!loading && rows && q && filtered.length !== rows.length ? ` / ${rows.length}` : ""}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Nie udało się pobrać danych</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak danych</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="text-left font-medium px-3 py-2 whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 align-top ${c.className ?? ""}`}>
                        {c.render ? c.render(r) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((r, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-1">
                  {columns.map((c) => (
                    <div key={c.key} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground min-w-[110px] shrink-0">
                        {c.label}
                      </span>
                      <span className="break-words">
                        {c.render ? c.render(r) : (r[c.key] ?? "—")}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
