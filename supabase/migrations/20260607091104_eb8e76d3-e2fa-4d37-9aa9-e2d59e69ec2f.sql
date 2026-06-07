-- Phase 1A drift rollback (approved scope)

DO $guard$
DECLARE
  v_sesje_count int := 0;
  v_linked_dostawy_count int := 0;
BEGIN
  IF to_regclass('public.transport_sesje') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.transport_sesje' INTO v_sesje_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dostawy' AND column_name='sesja_id'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.dostawy WHERE sesja_id IS NOT NULL'
      INTO v_linked_dostawy_count;
  END IF;
  IF v_sesje_count <> 0 OR v_linked_dostawy_count <> 0 THEN
    RAISE EXCEPTION 'Rollback blocked: transport_sesje rows=%, linked dostawy=%',
      v_sesje_count, v_linked_dostawy_count;
  END IF;
END $guard$;

-- Cost view
DROP VIEW IF EXISTS public.v_koszt_wlasny_pozycji;

-- RLS policies on transport_sesje
DROP POLICY IF EXISTS transport_sesje_select_full        ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_select_im_own      ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_insert_super_admin ON public.transport_sesje;
DROP POLICY IF EXISTS transport_sesje_update_super_admin ON public.transport_sesje;

-- Business RPC
DROP FUNCTION IF EXISTS public.ustaw_wstepny_koszt_transportu(uuid, numeric);
DROP FUNCTION IF EXISTS public.utworz_sesje_z_dostawami(jsonb, jsonb);

-- Helper
DROP FUNCTION IF EXISTS public.tt_next_numer_sesji();

-- dostawy: FK + index + column
ALTER TABLE public.dostawy DROP CONSTRAINT IF EXISTS dostawy_sesja_id_fkey;
DROP INDEX IF EXISTS public.idx_dostawy_sesja_id;
ALTER TABLE public.dostawy DROP COLUMN IF EXISTS sesja_id;

-- transport_sesje (cascading internal triggers/indexes/constraints)
DROP TABLE IF EXISTS public.transport_sesje;

-- Phase 1A trigger functions (only used by transport_sesje, now gone)
DROP FUNCTION IF EXISTS public.tt_lock_final_cost();
DROP FUNCTION IF EXISTS public.tt_touch_updated_at();

-- Sequence
DROP SEQUENCE IF EXISTS public.seq_numer_sesji;
