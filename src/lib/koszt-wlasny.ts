// Shared "Koszt własny" (€/kg) — owner formula, frontend-only.
// Returns null when inputs are insufficient or invalid.

export function computeKosztWlasnyPerKg(args: {
  cena_zakupu_per_kg: number;
  netto_kg: number;
  brutto_kg: number;
  palety: number;
  transport_cost_eur: number;
}): number | null {
  const { cena_zakupu_per_kg, netto_kg, brutto_kg, palety, transport_cost_eur } = args;
  if (!(palety > 0) || !(netto_kg > 0) || !(brutto_kg > 0) || !(transport_cost_eur > 0)) return null;
  const netto_per_pallet = netto_kg / palety;
  const brutto_per_pallet = brutto_kg / palety;
  if (!(netto_per_pallet > 0)) return null;
  let transport_per_kg: number;
  if (brutto_per_pallet <= 826) {
    const max_net_kg_in_auto = netto_per_pallet * 26;
    if (!(max_net_kg_in_auto > 0)) return null;
    transport_per_kg = transport_cost_eur / max_net_kg_in_auto;
  } else {
    const pallets_by_weight = Math.floor(21500 / brutto_per_pallet);
    const pallets_fit = Math.min(26, pallets_by_weight);
    if (!(pallets_fit > 0)) return null;
    const transport_per_pallet = transport_cost_eur / pallets_fit;
    transport_per_kg = transport_per_pallet / netto_per_pallet;
  }
  return cena_zakupu_per_kg + transport_per_kg + 0.02;
}

export function formatKosztWlasny(n: number | null): string {
  if (n === null || !isFinite(n)) return "—";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
