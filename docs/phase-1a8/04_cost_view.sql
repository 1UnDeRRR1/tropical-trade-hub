-- =====================================================================
-- Phase 1A.8 — 04_cost_view.sql
-- Creates v_koszt_wlasny_pozycji with SQL-level role guard.
-- One transaction. No DML.
--
-- Formula (Phase 1A, EUR-only):
--   transport_cost_auto      = COALESCE(final_transport_cost_eur,
--                                       preliminary_transport_cost_eur)
--   transport_share_position = transport_cost_auto * (brutto_pos / total_brutto_session)
--   transport_per_net_kg     = transport_share_position / netto_pos
--   koszt_wlasny_1kg         = cena_zakupu + transport_per_net_kg + 0.02
--
-- Returns NULL koszt_wlasny_1kg when:
--   - transport_cost_auto IS NULL (no 0 fallback)
--   - pozycja.waluta <> 'EUR'
--   - total_brutto_session = 0 or netto_pos = 0
--
-- Access (rationale — not confidentiality):
--   View body returns rows only for super_admin / kierownik /
--   asystent_kierownika. import_manager and logistyk see 0 rows in
--   Phase 1A. This is a denominator-correctness restriction:
--   total_brutto_session must be computed across the FULL session, and
--   an RLS filter applied through this view would skew that denominator.
--   Transport cost itself is NOT secret from import_manager — they see
--   it on transport_sesje. Phase 1B/1C will add a SECURITY DEFINER RPC
--   that computes total_brutto_session across the full session and
--   returns only the caller's own positions (import_manager preview).
-- =====================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_koszt_wlasny_pozycji AS
WITH
allowed AS (
  SELECT public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']) AS ok
),
session_totals AS (
  SELECT
    d.sesja_id,
    SUM(pd.brutto_kg) AS total_brutto_session
  FROM public.pozycje_dostawy pd
  JOIN public.dostawy d ON d.id = pd.dostawa_id
  WHERE d.sesja_id IS NOT NULL
  GROUP BY d.sesja_id
)
SELECT
  p.position_id,
  p.pozycja_dostawy_id,
  pd.dostawa_id,
  d.sesja_id,
  ts.numer_sesji,
  pd.waluta,
  pd.palety,
  pd.brutto_kg,
  pd.netto_kg,
  pd.cena_zakupu,
  ts.preliminary_transport_cost_eur,
  ts.final_transport_cost_eur,
  COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur) AS transport_cost_auto,
  st.total_brutto_session,
  CASE
    WHEN pd.waluta <> 'EUR' THEN NULL
    WHEN COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur) IS NULL THEN NULL
    WHEN st.total_brutto_session IS NULL OR st.total_brutto_session = 0 THEN NULL
    ELSE COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur)
         * (pd.brutto_kg / st.total_brutto_session)
  END AS transport_share_position,
  CASE
    WHEN pd.waluta <> 'EUR' THEN NULL
    WHEN COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur) IS NULL THEN NULL
    WHEN st.total_brutto_session IS NULL OR st.total_brutto_session = 0 THEN NULL
    WHEN pd.netto_kg IS NULL OR pd.netto_kg = 0 THEN NULL
    ELSE (COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur)
          * (pd.brutto_kg / st.total_brutto_session)) / pd.netto_kg
  END AS transport_per_net_kg,
  CASE
    WHEN pd.waluta <> 'EUR' THEN NULL
    WHEN COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur) IS NULL THEN NULL
    WHEN st.total_brutto_session IS NULL OR st.total_brutto_session = 0 THEN NULL
    WHEN pd.netto_kg IS NULL OR pd.netto_kg = 0 THEN NULL
    ELSE pd.cena_zakupu
         + ((COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur)
             * (pd.brutto_kg / st.total_brutto_session)) / pd.netto_kg)
         + 0.02
  END AS koszt_wlasny_1kg
FROM public.pozycje p
JOIN public.pozycje_dostawy pd ON pd.id = p.pozycja_dostawy_id
JOIN public.dostawy         d  ON d.id  = pd.dostawa_id
LEFT JOIN public.transport_sesje ts ON ts.sesja_id = d.sesja_id
LEFT JOIN session_totals         st ON st.sesja_id = d.sesja_id
CROSS JOIN allowed
WHERE allowed.ok = true;

-- Access: no DELETE, no INSERT/UPDATE (it's a view; PG won't allow anyway)
REVOKE ALL ON public.v_koszt_wlasny_pozycji FROM PUBLIC;
GRANT  SELECT ON public.v_koszt_wlasny_pozycji TO authenticated;
GRANT  SELECT ON public.v_koszt_wlasny_pozycji TO service_role;

COMMENT ON VIEW public.v_koszt_wlasny_pozycji IS
  'Phase 1A.8 cost view. EUR-only. brutto-share allocation. +0.02 fixed. '
  'SQL-level role guard: rows visible only to super_admin/kierownik/asystent_kierownika.';

COMMIT;
