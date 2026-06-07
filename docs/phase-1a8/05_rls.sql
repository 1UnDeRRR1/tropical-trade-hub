-- =====================================================================
-- Phase 1A.8 — 05_rls.sql
-- Policies on public.transport_sesje.
-- RLS is already ENABLED + FORCED in 02_migration.sql; re-asserted here.
-- No DELETE policy. No FOR ALL policy.
-- One transaction.
-- =====================================================================

BEGIN;

ALTER TABLE public.transport_sesje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_sesje FORCE  ROW LEVEL SECURITY;

-- ---------- SELECT: full visibility for staff + logistyk ----------
CREATE POLICY transport_sesje_select_full
  ON public.transport_sesje
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(ARRAY[
      'super_admin',
      'kierownik',
      'asystent_kierownika',
      'logistyk'
    ])
  );

-- ---------- SELECT: import_manager sees only own sessions ----------
CREATE POLICY transport_sesje_select_import_manager_own
  ON public.transport_sesje
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('import_manager')
    AND import_manager_id = public.current_uzytkownik_id()
  );

-- ---------- INSERT: super_admin / kierownik / asystent_kierownika ----------
CREATE POLICY transport_sesje_insert_staff
  ON public.transport_sesje
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika'])
  );

-- ---------- INSERT: import_manager only as himself ----------
CREATE POLICY transport_sesje_insert_import_manager_own
  ON public.transport_sesje
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('import_manager')
    AND import_manager_id = public.current_uzytkownik_id()
  );

-- ---------- UPDATE: super_admin / kierownik / asystent_kierownika ----------
CREATE POLICY transport_sesje_update_staff
  ON public.transport_sesje
  FOR UPDATE
  TO authenticated
  USING      (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']))
  WITH CHECK (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']));

-- ---------- UPDATE: import_manager on own session, owner unchanged ----------
CREATE POLICY transport_sesje_update_import_manager_own
  ON public.transport_sesje
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('import_manager')
    AND import_manager_id = public.current_uzytkownik_id()
  )
  WITH CHECK (
    public.has_role('import_manager')
    AND import_manager_id = public.current_uzytkownik_id()
  );

-- NO DELETE policy. NO FOR ALL policy.

COMMIT;
