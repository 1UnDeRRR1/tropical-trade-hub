
CREATE SEQUENCE IF NOT EXISTS public.seq_numer_sesji START 1;

CREATE TABLE public.transport_sesje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numer_sesji text NOT NULL UNIQUE,
  przewoznik_id text NOT NULL REFERENCES public.przewoznicy(przewoznik_id),
  import_manager_id text NOT NULL REFERENCES public.uzytkownicy(uzytkownik_id),
  data_zaladunku date NOT NULL,
  data_rozladunku date,
  status text NOT NULL DEFAULT 'draft',
  total_palety numeric NOT NULL DEFAULT 0,
  total_brutto_kg numeric NOT NULL DEFAULT 0,
  preliminary_transport_cost_eur numeric,
  final_transport_cost_eur numeric,
  final_locked boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transport_sesje_status_check CHECK (status IN ('draft','planned','in_transit','delivered','final_locked','cancelled')),
  CONSTRAINT transport_sesje_capacity_palety CHECK (total_palety >= 0 AND total_palety <= 26),
  CONSTRAINT transport_sesje_capacity_brutto CHECK (total_brutto_kg >= 0 AND total_brutto_kg <= 21500),
  CONSTRAINT transport_sesje_prelim_nonneg CHECK (preliminary_transport_cost_eur IS NULL OR preliminary_transport_cost_eur >= 0),
  CONSTRAINT transport_sesje_final_nonneg  CHECK (final_transport_cost_eur     IS NULL OR final_transport_cost_eur     >= 0)
);

REVOKE ALL ON public.transport_sesje FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transport_sesje TO authenticated;
GRANT ALL ON public.transport_sesje TO service_role;

ALTER TABLE public.transport_sesje ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dostawy ADD COLUMN sesja_id uuid REFERENCES public.transport_sesje(id) ON DELETE SET NULL;
CREATE INDEX idx_dostawy_sesja_id ON public.dostawy(sesja_id);
CREATE INDEX idx_transport_sesje_status ON public.transport_sesje(status);
CREATE INDEX idx_transport_sesje_import_manager ON public.transport_sesje(import_manager_id);
CREATE INDEX idx_transport_sesje_przewoznik ON public.transport_sesje(przewoznik_id);

CREATE OR REPLACE FUNCTION public.tt_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_transport_sesje_touch
BEFORE UPDATE ON public.transport_sesje
FOR EACH ROW EXECUTE FUNCTION public.tt_touch_updated_at();

CREATE OR REPLACE FUNCTION public.tt_next_numer_sesji()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n bigint;
BEGIN
  v_n := nextval('public.seq_numer_sesji');
  RETURN 'TS-' || to_char(now(),'YYYYMMDD') || '-' || lpad(v_n::text, 5, '0');
END $$;
REVOKE ALL ON FUNCTION public.tt_next_numer_sesji() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tt_lock_final_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.final_locked = true THEN
    IF NEW.final_transport_cost_eur IS DISTINCT FROM OLD.final_transport_cost_eur THEN
      RAISE EXCEPTION 'final_transport_cost_eur is locked';
    END IF;
  END IF;
  IF NEW.status = 'final_locked' AND OLD.status <> 'final_locked' THEN
    NEW.final_locked := true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_transport_sesje_lock_final
BEFORE UPDATE ON public.transport_sesje
FOR EACH ROW EXECUTE FUNCTION public.tt_lock_final_cost();

CREATE OR REPLACE FUNCTION public.utworz_sesje_z_dostawami(p_sesja jsonb, p_dostawy jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sesja_id uuid; v_numer text;
  v_user_id text := public.current_uzytkownik_id();
  v_caller_is_im boolean := public.has_role('import_manager');
  v_caller_full  boolean := public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']);
  v_owner_id text; v_owner_active boolean;
  v_przewoznik text; v_data_zaladunku date; v_data_rozladunku date;
  v_notes text; v_prelim numeric;
  v_total_palety numeric := 0; v_total_brutto numeric := 0;
  v_dostawa jsonb; v_d_result jsonb; v_d_id uuid;
  v_dostawy_out jsonb := '[]'::jsonb; v_bad_waluta int;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (v_caller_is_im OR v_caller_full) THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_owner_id        := COALESCE(p_sesja->>'import_manager_id', v_user_id);
  v_przewoznik      := p_sesja->>'przewoznik_id';
  v_data_zaladunku  := NULLIF(p_sesja->>'data_zaladunku','')::date;
  v_data_rozladunku := NULLIF(p_sesja->>'data_rozladunku','')::date;
  v_notes           := p_sesja->>'notes';
  v_prelim          := NULLIF(p_sesja->>'preliminary_transport_cost_eur','')::numeric;

  IF v_przewoznik IS NULL THEN RAISE EXCEPTION 'przewoznik_id required'; END IF;
  IF v_data_zaladunku IS NULL THEN RAISE EXCEPTION 'data_zaladunku required'; END IF;
  IF jsonb_typeof(p_dostawy) <> 'array' OR jsonb_array_length(p_dostawy) = 0 THEN
    RAISE EXCEPTION 'at least one dostawa required';
  END IF;

  IF v_caller_is_im AND NOT v_caller_full THEN
    v_owner_id := v_user_id;
    IF v_prelim IS NULL OR v_prelim <= 0 THEN
      RAISE EXCEPTION 'preliminary_transport_cost_eur > 0 required for import_manager';
    END IF;
  END IF;

  SELECT (u.status = 'active'), u.uzytkownik_id
    INTO v_owner_active, v_owner_id
    FROM public.uzytkownicy u
    JOIN public.uzytkownik_role ur ON ur.uzytkownik_id = u.uzytkownik_id
   WHERE u.uzytkownik_id = v_owner_id AND ur.klucz_roli = 'import_manager'
   LIMIT 1;
  IF v_owner_id IS NULL OR v_owner_active IS NOT TRUE THEN
    RAISE EXCEPTION 'owner must be active import_manager';
  END IF;

  v_numer := public.tt_next_numer_sesji();

  INSERT INTO public.transport_sesje(
    numer_sesji, przewoznik_id, import_manager_id,
    data_zaladunku, data_rozladunku, status,
    preliminary_transport_cost_eur, notes, created_by
  ) VALUES (
    v_numer, v_przewoznik, v_owner_id,
    v_data_zaladunku, v_data_rozladunku, COALESCE(p_sesja->>'status','draft'),
    v_prelim, v_notes, auth.uid()
  ) RETURNING id INTO v_sesja_id;

  FOR v_dostawa IN SELECT * FROM jsonb_array_elements(p_dostawy) LOOP
    v_d_result := public.utworz_dostawe_z_pozycjami(v_dostawa->'dostawa', v_dostawa->'pozycje');
    v_d_id := (v_d_result->>'dostawa_id')::uuid;
    IF v_d_id IS NULL THEN RAISE EXCEPTION 'utworz_dostawe_z_pozycjami did not return dostawa_id'; END IF;
    UPDATE public.dostawy SET sesja_id = v_sesja_id WHERE id = v_d_id;
    v_dostawy_out := v_dostawy_out || jsonb_build_object('dostawa_id', v_d_id, 'numer_dostawy', v_d_result->>'numer_dostawy');
  END LOOP;

  SELECT count(*) INTO v_bad_waluta
    FROM public.pozycje_dostawy pd JOIN public.dostawy d ON d.id = pd.dostawa_id
   WHERE d.sesja_id = v_sesja_id AND COALESCE(pd.waluta,'') <> 'EUR';
  IF v_bad_waluta > 0 THEN
    RAISE EXCEPTION 'all bound positions must be EUR (found % non-EUR)', v_bad_waluta;
  END IF;

  SELECT COALESCE(SUM(pd.palety),0), COALESCE(SUM(pd.brutto_kg),0)
    INTO v_total_palety, v_total_brutto
    FROM public.pozycje_dostawy pd JOIN public.dostawy d ON d.id = pd.dostawa_id
   WHERE d.sesja_id = v_sesja_id;

  IF v_total_palety > 26 THEN RAISE EXCEPTION 'FTL pallet capacity exceeded: % > 26', v_total_palety; END IF;
  IF v_total_brutto > 21500 THEN RAISE EXCEPTION 'FTL gross weight capacity exceeded: % > 21500', v_total_brutto; END IF;

  UPDATE public.transport_sesje SET total_palety = v_total_palety, total_brutto_kg = v_total_brutto WHERE id = v_sesja_id;

  RETURN jsonb_build_object(
    'sesja_id', v_sesja_id, 'numer_sesji', v_numer, 'dostawy', v_dostawy_out,
    'total_palety', v_total_palety, 'total_brutto_kg', v_total_brutto
  );
END $$;

REVOKE ALL ON FUNCTION public.utworz_sesje_z_dostawami(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.utworz_sesje_z_dostawami(jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ustaw_wstepny_koszt_transportu(p_sesja_id uuid, p_cost_eur numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id text := public.current_uzytkownik_id();
  v_owner text;
  v_full boolean := public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']);
  v_im   boolean := public.has_role('import_manager');
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (v_full OR v_im) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_cost_eur IS NULL OR p_cost_eur < 0 THEN RAISE EXCEPTION 'preliminary cost must be >= 0'; END IF;
  SELECT import_manager_id INTO v_owner FROM public.transport_sesje WHERE id = p_sesja_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'sesja not found'; END IF;
  IF v_im AND NOT v_full THEN
    IF v_owner <> v_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF p_cost_eur <= 0 THEN RAISE EXCEPTION 'preliminary cost must be > 0 for import_manager'; END IF;
  END IF;
  UPDATE public.transport_sesje SET preliminary_transport_cost_eur = p_cost_eur WHERE id = p_sesja_id;
END $$;
REVOKE ALL ON FUNCTION public.ustaw_wstepny_koszt_transportu(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ustaw_wstepny_koszt_transportu(uuid, numeric) TO authenticated;

CREATE VIEW public.v_koszt_wlasny_pozycji WITH (security_invoker = true) AS
WITH session_totals AS (
  SELECT d.sesja_id, SUM(pd.brutto_kg) AS total_brutto_session
    FROM public.pozycje_dostawy pd JOIN public.dostawy d ON d.id = pd.dostawa_id
   WHERE d.sesja_id IS NOT NULL GROUP BY d.sesja_id
),
session_eur AS (
  SELECT d.sesja_id, bool_and(COALESCE(pd.waluta,'') = 'EUR') AS waluta_spojna_eur
    FROM public.pozycje_dostawy pd JOIN public.dostawy d ON d.id = pd.dostawa_id
   WHERE d.sesja_id IS NOT NULL GROUP BY d.sesja_id
)
SELECT p.position_id, p.id AS pozycja_id, pd.id AS pozycja_dostawy_id, pd.dostawa_id, d.sesja_id,
  pd.cena_zakupu, pd.waluta, pd.netto_kg, pd.brutto_kg,
  ts.preliminary_transport_cost_eur, ts.final_transport_cost_eur,
  COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur) AS transport_cost_eur,
  st.total_brutto_session, se.waluta_spojna_eur,
  CASE WHEN public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika'])
         AND COALESCE(se.waluta_spojna_eur, false) = true
         AND pd.netto_kg > 0 AND st.total_brutto_session > 0
         AND COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur) IS NOT NULL
       THEN pd.cena_zakupu
            + (COALESCE(ts.final_transport_cost_eur, ts.preliminary_transport_cost_eur)
               * (pd.brutto_kg / st.total_brutto_session)) / pd.netto_kg + 0.02
       ELSE NULL END AS koszt_wlasny_1kg
FROM public.pozycje p
JOIN public.pozycje_dostawy pd ON pd.id = p.pozycja_dostawy_id
JOIN public.dostawy d ON d.id = pd.dostawa_id
LEFT JOIN public.transport_sesje ts ON ts.id = d.sesja_id
LEFT JOIN session_totals st ON st.sesja_id = d.sesja_id
LEFT JOIN session_eur se ON se.sesja_id = d.sesja_id
WHERE public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']);

GRANT SELECT ON public.v_koszt_wlasny_pozycji TO authenticated;

CREATE POLICY transport_sesje_select_full ON public.transport_sesje FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','logistyk']));

CREATE POLICY transport_sesje_select_im_own ON public.transport_sesje FOR SELECT TO authenticated
USING (public.has_role('import_manager') AND import_manager_id = public.current_uzytkownik_id());

CREATE POLICY transport_sesje_insert_super_admin ON public.transport_sesje FOR INSERT TO authenticated
WITH CHECK (public.has_role('super_admin'));

CREATE POLICY transport_sesje_update_super_admin ON public.transport_sesje FOR UPDATE TO authenticated
USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));

DO $$
DECLARE v_fail text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transport_sesje') THEN v_fail := v_fail || ' T01'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dostawy' AND column_name='sesja_id') THEN v_fail := v_fail || ' T02'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_koszt_wlasny_pozycji') THEN v_fail := v_fail || ' T03'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='utworz_sesje_z_dostawami') THEN v_fail := v_fail || ' T04'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='ustaw_wstepny_koszt_transportu') THEN v_fail := v_fail || ' T05'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='tt_next_numer_sesji') THEN v_fail := v_fail || ' T06'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='transport_sesje' AND relrowsecurity=true) THEN v_fail := v_fail || ' T07'; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='transport_sesje'
       AND privilege_type='DELETE' AND grantee IN ('authenticated','anon','PUBLIC')
  ) THEN v_fail := v_fail || ' T08_DELETE_GRANT'; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE routine_schema='public' AND routine_name='tt_next_numer_sesji'
       AND grantee IN ('PUBLIC','authenticated','anon')
  ) THEN v_fail := v_fail || ' T09_NEXT_SESJI_PUBLIC'; END IF;
  IF length(v_fail) > 0 THEN RAISE EXCEPTION 'VERIFICATION FAILED:%', v_fail; END IF;
  RAISE NOTICE 'VERIFICATION PASS';
END $$;
