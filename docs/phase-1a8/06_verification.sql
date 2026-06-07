-- =====================================================================
-- Phase 1A.8 — 06_verification.sql
-- Object-by-object verification. Read-only. Raises on first mismatch.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_count int;
  v_text  text;
BEGIN
  ------------------------------------------------------------------
  -- 1. transport_sesje exists, PK = sesja_id
  ------------------------------------------------------------------
  IF to_regclass('public.transport_sesje') IS NULL THEN
    RAISE EXCEPTION 'VERIFY FAIL: public.transport_sesje missing';
  END IF;

  SELECT a.attname INTO v_text
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
   WHERE i.indrelid = 'public.transport_sesje'::regclass AND i.indisprimary;
  IF v_text IS DISTINCT FROM 'sesja_id' THEN
    RAISE EXCEPTION 'VERIFY FAIL: PK of transport_sesje is %, expected sesja_id', v_text;
  END IF;

  ------------------------------------------------------------------
  -- 2. All target columns present (and drift columns absent)
  ------------------------------------------------------------------
  FOR v_text IN
    SELECT expected FROM unnest(ARRAY[
      'sesja_id','numer_sesji','numer_auta','przewoznik_id','etd','eta',
      'preliminary_transport_cost_eur','final_transport_cost_eur','final_locked_at',
      'waluta','status','notes','import_manager_id','created_by','created_at','updated_at'
    ]) AS expected
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='transport_sesje' AND column_name=expected
    )
  LOOP
    RAISE EXCEPTION 'VERIFY FAIL: transport_sesje column missing: %', v_text;
  END LOOP;

  FOR v_text IN
    SELECT bad FROM unnest(ARRAY[
      'id','owner_id','koszt_wstepny','koszt_final','waluta_kosztu',
      'data_zaladunku','data_rozladunku','total_palety','total_brutto_kg','final_locked'
    ]) AS bad
    WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='transport_sesje' AND column_name=bad
    )
  LOOP
    RAISE EXCEPTION 'VERIFY FAIL: drift column present on transport_sesje: %', v_text;
  END LOOP;

  ------------------------------------------------------------------
  -- 3. FK dostawy.sesja_id → transport_sesje.sesja_id ON DELETE SET NULL
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dostawy' AND column_name='sesja_id'
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: dostawy.sesja_id missing'; END IF;

  SELECT confdeltype INTO v_text
    FROM pg_constraint WHERE conname='dostawy_sesja_id_fkey';
  IF v_text IS NULL THEN
    RAISE EXCEPTION 'VERIFY FAIL: dostawy_sesja_id_fkey missing';
  END IF;
  IF v_text <> 'n' THEN
    RAISE EXCEPTION 'VERIFY FAIL: dostawy_sesja_id_fkey ON DELETE is %, expected SET NULL (n)', v_text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='dostawy' AND indexname='idx_dostawy_sesja_id'
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: idx_dostawy_sesja_id missing'; END IF;

  -- drift check on dostawy
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dostawy' AND column_name='liczba_palet'
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: drift column dostawy.liczba_palet present'; END IF;

  ------------------------------------------------------------------
  -- 4. Sequence
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='S' AND n.nspname='public' AND c.relname='seq_numer_sesji'
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: seq_numer_sesji missing'; END IF;

  ------------------------------------------------------------------
  -- 5. Functions: signatures + SECURITY DEFINER
  ------------------------------------------------------------------
  -- Function existence + SECURITY DEFINER, looked up by regprocedure
  -- (avoids fragile equality on pg_get_function_identity_arguments which
  --  includes parameter names on some Postgres versions).
  DECLARE
    v_fn_oid oid;
    v_secdef boolean;
  BEGIN
    -- tt_next_numer_sesji(integer)
    v_fn_oid := to_regprocedure('public.tt_next_numer_sesji(integer)')::oid;
    IF v_fn_oid IS NULL THEN
      RAISE EXCEPTION 'VERIFY FAIL: tt_next_numer_sesji(integer) missing';
    END IF;
    SELECT p.prosecdef INTO v_secdef FROM pg_proc p WHERE p.oid = v_fn_oid;
    IF v_secdef IS NOT TRUE THEN
      RAISE EXCEPTION 'VERIFY FAIL: tt_next_numer_sesji(integer) is not SECURITY DEFINER';
    END IF;

    -- utworz_sesje_z_dostawami(jsonb,jsonb)
    v_fn_oid := to_regprocedure('public.utworz_sesje_z_dostawami(jsonb,jsonb)')::oid;
    IF v_fn_oid IS NULL THEN
      RAISE EXCEPTION 'VERIFY FAIL: utworz_sesje_z_dostawami(jsonb,jsonb) missing';
    END IF;
    SELECT p.prosecdef INTO v_secdef FROM pg_proc p WHERE p.oid = v_fn_oid;
    IF v_secdef IS NOT TRUE THEN
      RAISE EXCEPTION 'VERIFY FAIL: utworz_sesje_z_dostawami(jsonb,jsonb) is not SECURITY DEFINER';
    END IF;

    -- ustaw_wstepny_koszt_transportu(uuid,numeric)
    v_fn_oid := to_regprocedure('public.ustaw_wstepny_koszt_transportu(uuid,numeric)')::oid;
    IF v_fn_oid IS NULL THEN
      RAISE EXCEPTION 'VERIFY FAIL: ustaw_wstepny_koszt_transportu(uuid,numeric) missing';
    END IF;
    SELECT p.prosecdef INTO v_secdef FROM pg_proc p WHERE p.oid = v_fn_oid;
    IF v_secdef IS NOT TRUE THEN
      RAISE EXCEPTION 'VERIFY FAIL: ustaw_wstepny_koszt_transportu(uuid,numeric) is not SECURITY DEFINER';
    END IF;
  END;

  -- trigger fns present
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='tt_touch_updated_at')
    THEN RAISE EXCEPTION 'VERIFY FAIL: tt_touch_updated_at missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='tt_lock_final_cost')
    THEN RAISE EXCEPTION 'VERIFY FAIL: tt_lock_final_cost missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='tt_transport_sesje_protect_invariants')
    THEN RAISE EXCEPTION 'VERIFY FAIL: tt_transport_sesje_protect_invariants missing'; END IF;

  -- invariant-protection trigger bound to transport_sesje
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.transport_sesje'::regclass
      AND tgname  = 'trg_transport_sesje_protect_invariants'
      AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: trg_transport_sesje_protect_invariants missing on transport_sesje'; END IF;

  -- invariant function body covers all protected columns (text check)
  FOR v_text IN
    SELECT col FROM unnest(ARRAY[
      'sesja_id','numer_sesji','import_manager_id','created_by','created_at','waluta','final_locked_at'
    ]) AS col
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='tt_transport_sesje_protect_invariants'
        AND pg_get_functiondef(p.oid) LIKE '%NEW.'||col||' IS DISTINCT FROM OLD.'||col||'%'
    )
  LOOP
    RAISE EXCEPTION 'VERIFY FAIL: tt_transport_sesje_protect_invariants does not guard column %', v_text;
  END LOOP;

  ------------------------------------------------------------------
  -- 6. Grants
  -- 6a. No DELETE grant on transport_sesje for authenticated/anon/PUBLIC
  ------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='transport_sesje'
      AND privilege_type='DELETE'
      AND grantee IN ('authenticated','anon','PUBLIC')
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: DELETE grant on transport_sesje to app role'; END IF;

  -- 6b. authenticated has SELECT/INSERT/UPDATE
  FOR v_text IN
    SELECT need FROM unnest(ARRAY['SELECT','INSERT','UPDATE']) AS need
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='transport_sesje'
        AND privilege_type=need AND grantee='authenticated'
    )
  LOOP
    RAISE EXCEPTION 'VERIFY FAIL: authenticated missing % on transport_sesje', v_text;
  END LOOP;

  -- 6c/6d. Function EXECUTE grants verified via pg_proc + has_function_privilege
  -- (information_schema specific_name casting is fragile; this is authoritative).
  DECLARE
    v_fn_oid oid;
  BEGIN
    -- tt_next_numer_sesji(int): internal helper — NOT callable by app users
    SELECT p.oid INTO v_fn_oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'tt_next_numer_sesji'
       AND pg_get_function_identity_arguments(p.oid) = 'integer';
    IF v_fn_oid IS NULL THEN
      RAISE EXCEPTION 'VERIFY FAIL: tt_next_numer_sesji(int) not found for grant check';
    END IF;
    IF has_function_privilege('public',        v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: PUBLIC has EXECUTE on tt_next_numer_sesji(int)';
    END IF;
    IF has_function_privilege('anon',          v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: anon has EXECUTE on tt_next_numer_sesji(int)';
    END IF;
    IF has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: authenticated has EXECUTE on tt_next_numer_sesji(int)';
    END IF;

    -- utworz_sesje_z_dostawami(jsonb,jsonb): public RPC — authenticated only
    SELECT p.oid INTO v_fn_oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'utworz_sesje_z_dostawami'
       AND pg_get_function_identity_arguments(p.oid) = 'jsonb, jsonb';
    IF v_fn_oid IS NULL THEN
      RAISE EXCEPTION 'VERIFY FAIL: utworz_sesje_z_dostawami(jsonb,jsonb) not found for grant check';
    END IF;
    IF has_function_privilege('public', v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: PUBLIC has EXECUTE on utworz_sesje_z_dostawami(jsonb,jsonb)';
    END IF;
    IF has_function_privilege('anon', v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: anon has EXECUTE on utworz_sesje_z_dostawami(jsonb,jsonb)';
    END IF;
    IF NOT has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: authenticated missing EXECUTE on utworz_sesje_z_dostawami(jsonb,jsonb)';
    END IF;

    -- ustaw_wstepny_koszt_transportu(uuid,numeric): public RPC — authenticated only
    SELECT p.oid INTO v_fn_oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'ustaw_wstepny_koszt_transportu'
       AND pg_get_function_identity_arguments(p.oid) = 'uuid, numeric';
    IF v_fn_oid IS NULL THEN
      RAISE EXCEPTION 'VERIFY FAIL: ustaw_wstepny_koszt_transportu(uuid,numeric) not found for grant check';
    END IF;
    IF has_function_privilege('public', v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: PUBLIC has EXECUTE on ustaw_wstepny_koszt_transportu(uuid,numeric)';
    END IF;
    IF has_function_privilege('anon', v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: anon has EXECUTE on ustaw_wstepny_koszt_transportu(uuid,numeric)';
    END IF;
    IF NOT has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAIL: authenticated missing EXECUTE on ustaw_wstepny_koszt_transportu(uuid,numeric)';
    END IF;
  END;


  ------------------------------------------------------------------
  -- 7. RLS enabled, expected policies present, no DELETE / no FOR ALL
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='transport_sesje' AND c.relrowsecurity = true
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: RLS not enabled on transport_sesje'; END IF;

  FOR v_text IN
    SELECT expected FROM unnest(ARRAY[
      'transport_sesje_select_full',
      'transport_sesje_select_import_manager_own',
      'transport_sesje_insert_staff',
      'transport_sesje_update_staff',
      'transport_sesje_update_import_manager_own'
    ]) AS expected
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='transport_sesje' AND policyname=expected
    )
  LOOP
    RAISE EXCEPTION 'VERIFY FAIL: policy missing: %', v_text;
  END LOOP;

  -- import_manager direct INSERT must NOT exist (creation is RPC-only)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='transport_sesje'
      AND policyname = 'transport_sesje_insert_import_manager_own'
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: transport_sesje_insert_import_manager_own must not exist'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='transport_sesje'
      AND (cmd = 'DELETE' OR cmd = 'ALL')
  ) THEN RAISE EXCEPTION 'VERIFY FAIL: DELETE or FOR ALL policy present on transport_sesje'; END IF;

  ------------------------------------------------------------------
  -- 8. View exists, uses correct columns, includes formula tokens
  ------------------------------------------------------------------
  IF to_regclass('public.v_koszt_wlasny_pozycji') IS NULL THEN
    RAISE EXCEPTION 'VERIFY FAIL: v_koszt_wlasny_pozycji missing';
  END IF;

  SELECT pg_get_viewdef('public.v_koszt_wlasny_pozycji', true) INTO v_text;

  IF v_text NOT LIKE '%pozycje_dostawy%' THEN RAISE EXCEPTION 'VERIFY FAIL: view does not reference pozycje_dostawy'; END IF;
  IF v_text NOT LIKE '%pozycja_dostawy_id%' THEN RAISE EXCEPTION 'VERIFY FAIL: view does not use pozycje.pozycja_dostawy_id'; END IF;
  IF v_text NOT LIKE '%brutto_kg%' THEN RAISE EXCEPTION 'VERIFY FAIL: view does not reference brutto_kg'; END IF;
  IF v_text NOT LIKE '%netto_kg%'  THEN RAISE EXCEPTION 'VERIFY FAIL: view does not reference netto_kg';  END IF;
  IF v_text NOT LIKE '%cena_zakupu%' THEN RAISE EXCEPTION 'VERIFY FAIL: view does not reference cena_zakupu'; END IF;
  IF v_text NOT LIKE '%0.02%' THEN RAISE EXCEPTION 'VERIFY FAIL: view missing fixed +0.02 addition'; END IF;
  IF v_text NOT LIKE '%has_any_role%' THEN RAISE EXCEPTION 'VERIFY FAIL: view missing SQL-level role guard'; END IF;
  IF v_text LIKE '%cena_zakupu_eur%' THEN RAISE EXCEPTION 'VERIFY FAIL: view uses drift column cena_zakupu_eur'; END IF;
  IF v_text LIKE '%transport_sesje.id %' THEN RAISE EXCEPTION 'VERIFY FAIL: view uses drift transport_sesje.id'; END IF;

  RAISE NOTICE 'Phase 1A.8 verification OK';
END
$$;

-- Snapshot for owner comparison
SELECT 'transport_sesje_count' AS metric, COUNT(*)::bigint AS value FROM public.transport_sesje
UNION ALL
SELECT 'dostawy_count'         AS metric, COUNT(*)::bigint AS value FROM public.dostawy
UNION ALL
SELECT 'pozycje_count'         AS metric, COUNT(*)::bigint AS value FROM public.pozycje
UNION ALL
SELECT 'pozycje_dostawy_count' AS metric, COUNT(*)::bigint AS value FROM public.pozycje_dostawy;

COMMIT;
