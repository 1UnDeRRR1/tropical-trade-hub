-- =====================================================================
-- Phase 1A.8 — 01_preflight.sql
-- Read-only pre-apply guards. Raises on any unexpected state.
-- NO DDL, NO DML.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_missing text;
  v_present text;
BEGIN
  -- ---------------------------------------------------------------
  -- A. Phase 1A.8 target objects must be ABSENT
  -- ---------------------------------------------------------------

  IF to_regclass('public.transport_sesje') IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight FAIL: public.transport_sesje already exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dostawy' AND column_name = 'sesja_id'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: public.dostawy.sesja_id already exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND n.nspname = 'public' AND c.relname = 'seq_numer_sesji'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: sequence public.seq_numer_sesji already exists';
  END IF;

  IF to_regclass('public.v_koszt_wlasny_pozycji') IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight FAIL: view public.v_koszt_wlasny_pozycji already exists';
  END IF;

  FOR v_present IN
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND proname IN (
        'utworz_sesje_z_dostawami',
        'ustaw_wstepny_koszt_transportu',
        'tt_next_numer_sesji',
        'tt_lock_final_cost',
        'tt_touch_updated_at',
        'tt_transport_sesje_protect_invariants'
      )
  LOOP
    RAISE EXCEPTION 'Preflight FAIL: Phase 1A.8 function already exists: %', v_present;
  END LOOP;

  -- ---------------------------------------------------------------
  -- B. Pre-Phase-1A functions must be PRESENT (untouched)
  -- ---------------------------------------------------------------

  FOR v_missing IN
    SELECT expected FROM unnest(ARRAY[
      'has_role',
      'has_any_role',
      'current_uzytkownik_id',
      'my_role_keys',
      'my_profile',
      'next_yearly_seq',
      'tt_set_updated_at',
      '_supplier_code',
      '_kraj_iso3',
      '_gen_business_numer',
      'utworz_dostawe_z_pozycjami',
      'aktualizuj_dostawe_z_pozycjami'
    ]) AS expected
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = expected
    )
  LOOP
    RAISE EXCEPTION 'Preflight FAIL: pre-Phase-1A function missing: %', v_missing;
  END LOOP;

  -- ---------------------------------------------------------------
  -- C. Required role keys must exist in public.role
  -- ---------------------------------------------------------------

  FOR v_missing IN
    SELECT expected FROM unnest(ARRAY[
      'super_admin',
      'kierownik',
      'asystent_kierownika',
      'import_manager',
      'logistyk'
    ]) AS expected
    WHERE NOT EXISTS (
      SELECT 1 FROM public.role r WHERE r.klucz_roli = expected
    )
  LOOP
    RAISE EXCEPTION 'Preflight FAIL: required role key missing in public.role: %', v_missing;
  END LOOP;

  -- ---------------------------------------------------------------
  -- D. Required columns on existing tables
  -- ---------------------------------------------------------------

  -- uzytkownicy
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='uzytkownicy' AND column_name='uzytkownik_id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: uzytkownicy.uzytkownik_id missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='uzytkownicy' AND column_name='klucz_roli'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: uzytkownicy.klucz_roli missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='uzytkownicy' AND column_name='status'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: uzytkownicy.status missing'; END IF;

  -- przewoznicy
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='przewoznicy' AND column_name='przewoznik_id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: przewoznicy.przewoznik_id missing'; END IF;

  -- dostawy
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dostawy' AND column_name='id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: dostawy.id missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dostawy' AND column_name='numer_dostawy'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: dostawy.numer_dostawy missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dostawy' AND column_name='import_manager_id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: dostawy.import_manager_id missing'; END IF;

  -- pozycje_dostawy
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.id missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='position_id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.position_id missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='dostawa_id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.dostawa_id missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='palety'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.palety missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='brutto_kg'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.brutto_kg missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='netto_kg'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.netto_kg missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='cena_zakupu'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.cena_zakupu missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje_dostawy' AND column_name='waluta'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje_dostawy.waluta missing'; END IF;

  -- pozycje
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje' AND column_name='position_id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje.position_id missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pozycje' AND column_name='pozycja_dostawy_id'
  ) THEN RAISE EXCEPTION 'Preflight FAIL: pozycje.pozycja_dostawy_id missing'; END IF;

  RAISE NOTICE 'Preflight OK: ready to apply Phase 1A.8';
END
$$;

-- Snapshot counts for post-apply comparison
SELECT 'dostawy_count'         AS metric, COUNT(*)::bigint AS value FROM public.dostawy
UNION ALL
SELECT 'pozycje_count'         AS metric, COUNT(*)::bigint AS value FROM public.pozycje
UNION ALL
SELECT 'pozycje_dostawy_count' AS metric, COUNT(*)::bigint AS value FROM public.pozycje_dostawy;

COMMIT;
