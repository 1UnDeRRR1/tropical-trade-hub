import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const PALETY_MAX = 26;
export const BRUTTO_MAX_KG = 21500;

interface Props {
  /** suma palet z widocznych pozycji_dostawy; null = brak danych (RLS / loading) */
  palety: number | null;
  /** suma brutto_kg z widocznych pozycji_dostawy; null = brak danych */
  bruttoKg: number | null;
  /** true = dane mogą być niekompletne z powodu RLS / braku widocznych dostaw */
  unknown?: boolean;
  className?: string;
}

function toneClass(pct: number): string {
  if (pct > 100) return "text-destructive";
  if (pct > 80) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function fmt(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n);
}

export function SesjaCapacityMeter({ palety, bruttoKg, unknown, className }: Props) {
  if (unknown || palety === null || bruttoKg === null) {
    return (
      <div className={cn("rounded-md border border-dashed p-3 text-sm text-muted-foreground", className)}>
        Pojemność: brak danych
      </div>
    );
  }

  const paletyPct = Math.min(999, (palety / PALETY_MAX) * 100);
  const bruttoPct = Math.min(999, (bruttoKg / BRUTTO_MAX_KG) * 100);

  return (
    <div className={cn("rounded-md border p-3 space-y-3", className)}>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">Palety</span>
          <span className={cn("tabular-nums", toneClass(paletyPct))}>
            {fmt(palety)} / {PALETY_MAX}
          </span>
        </div>
        <Progress value={Math.min(100, paletyPct)} className="h-2" />
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">Brutto</span>
          <span className={cn("tabular-nums", toneClass(bruttoPct))}>
            {fmt(bruttoKg)} / {fmt(BRUTTO_MAX_KG)} kg
          </span>
        </div>
        <Progress value={Math.min(100, bruttoPct)} className="h-2" />
      </div>
    </div>
  );
}
