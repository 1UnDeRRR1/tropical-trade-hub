-- =====================================================================
-- Phase 1A.8 — 07_rollback.sql
-- Exact inverse of 02–05. One transaction. NO CASCADE.
-- Drops only Phase 1A.8-owned objects. Preserves pre-Phase-1A functions,
-- reference tables, dostawy / pozycje / pozycje_dostawy data, Winogrona seed.
-- Run ONLY when explicitly instructed.
-- =====================================================================

BEGIN;

-- Safety: refuse rollback if any session exists or any dostawa is linked
DO $$
DECLARE
  v_sessions int := 0;
  v_linked   int := 0;
BEGIN
  IF to_regclass('public.transport_sesje') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.transport_sesje' INTO v_sessions;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dostawy' AND column_name='sesja_id'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM public.dostawy WHERE sesja_id IS NOT NULL' INTO v_linked;
  END IF;
  IF v_sessions > 0 OR v_linked > 0 THEN
    RAISE EXCEPTION 'Rollback GUARD: transport_sesje=% linked_dostawy=%; refuse rollback', v_sessions, v_linked;
  END IF;
END
$$;

-- 1. View
DROP VIEW IF EXISTS public.v_koszt_wlasny_pozycji;

-- 2. Policies
DROP POLICY IF EXISTS transport_sesje_select_full                ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_select_import_manager_own  ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_insert_staff               ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_insert_import_manager_own  ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_update_staff               ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_update_import_manager_own  ON public.transport_sesje;

-- 3. Public RPCs
DROP FUNCTION IF EXISTS public.ustaw_wstepny_koszt_transportu(uuid, numeric);
DROP FUNCTION IF EXISTS public.utworz_sesje_z_dostawami(jsonb, jsonb);

-- 4. Internal helper
DROP FUNCTION IF EXISTS public.tt_next_numer_sesji(integer);

-- 5. dostawy: drop FK, index, column (no CASCADE)
ALTER TABLE public.dostawy DROP CONSTRAINT IF EXISTS dostawy_sesja_id_fkey;
DROP INDEX IF EXISTS public.idx_dostawy_sesja_id;
ALTER TABLE public.dostawy DROP COLUMN IF EXISTS sesja_id;

-- 6. Triggers on transport_sesje (explicit, then drop table)
DROP TRIGGER IF EXISTS trg_transport_sesje_protect_invariants ON public.transport_sesje;
DROP TRIGGER IF EXISTS trg_transport_sesje_lock_final_cost    ON public.transport_sesje;
DROP TRIGGER IF EXISTS trg_transport_sesje_touch_updated_at   ON public.transport_sesje;

-- Indexes on transport_sesje (will go with the table; explicit for clarity)
DROP INDEX IF EXISTS public.idx_transport_sesje_status;
DROP INDEX IF EXISTS public.idx_transport_sesje_etd;
DROP INDEX IF EXISTS public.idx_transport_sesje_przewoznik;
DROP INDEX IF EXISTS public.idx_transport_sesje_import_manager;

-- 7. Table
DROP TABLE IF EXISTS public.transport_sesje;

-- 8. Phase 1A.8-owned trigger functions
DROP FUNCTION IF EXISTS public.tt_transport_sesje_protect_invariants();
DROP FUNCTION IF EXISTS public.tt_lock_final_cost();
DROP FUNCTION IF EXISTS public.tt_touch_updated_at();

-- 9. Sequence
DROP SEQUENCE IF EXISTS public.seq_numer_sesji;

-- Preserved (DO NOT DROP):
--   tt_set_updated_at, utworz_dostawe_z_pozycjami, aktualizuj_dostawe_z_pozycjami,
--   has_role, has_any_role, current_uzytkownik_id, my_role_keys, my_profile,
--   next_yearly_seq, _supplier_code, _kraj_iso3, _gen_business_numer,
--   reference tables, pozycje/pozycje_dostawy/dostawy data, Winogrona seed.

COMMIT;
