
ALTER TABLE public.pozycje_dostawy DROP CONSTRAINT IF EXISTS ck_pd_opakowanie_source;
ALTER TABLE public.pozycje_dostawy DROP CONSTRAINT IF EXISTS ck_pd_opakowanie_consistency;

ALTER TABLE public.pozycje_dostawy
  ADD CONSTRAINT ck_pd_opakowanie_source
  CHECK (opakowanie_source IN ('catalog','custom','none'));

ALTER TABLE public.pozycje_dostawy
  ADD CONSTRAINT ck_pd_opakowanie_consistency CHECK (
    (opakowanie_source = 'catalog' AND opakowanie_id IS NOT NULL AND opakowanie_custom_text IS NULL)
    OR (opakowanie_source = 'custom'  AND opakowanie_id IS NULL
         AND opakowanie_custom_text IS NOT NULL
         AND length(btrim(opakowanie_custom_text)) BETWEEN 1 AND 200)
    OR (opakowanie_source = 'none'    AND opakowanie_id IS NULL AND opakowanie_custom_text IS NULL)
  );

DROP FUNCTION IF EXISTS public.utworz_dostawe_z_pozycjami(date,text,text,text,text,text,jsonb,date);
DROP FUNCTION IF EXISTS public.utworz_dostawe_z_pozycjami(date,text,text,text,text,text,jsonb);

CREATE OR REPLACE FUNCTION public.utworz_dostawe_z_pozycjami(
  p_data_dostawy date,
  p_dostawca_id text,
  p_kraj_id text,
  p_import_manager_id text,
  p_status text,
  p_notes text,
  p_pozycje jsonb,
  p_data_zaladunku date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dostawa_id uuid;
  v_numer text;
  v_year int := extract(year from p_data_dostawy)::int;
  v_seq bigint;
  v_pozycja jsonb;
  v_pozycja_dostawy_id uuid;
  v_position_id text;
  v_pos_seq bigint;
  v_current_user text;
  v_role_keys text[];
  v_waluta text;
  v_opak_source text;
  v_opak_id text;
  v_opak_custom text;
  v_material text;
BEGIN
  v_role_keys := public.my_role_keys();
  v_current_user := public.current_uzytkownik_id();

  IF NOT ('super_admin' = ANY(v_role_keys) OR 'import_manager' = ANY(v_role_keys)) THEN
    RAISE EXCEPTION 'Brak uprawnień do tworzenia dostaw';
  END IF;

  IF NOT ('super_admin' = ANY(v_role_keys)) THEN
    IF p_import_manager_id IS DISTINCT FROM v_current_user THEN
      RAISE EXCEPTION 'Import manager może tworzyć tylko własne dostawy';
    END IF;
  END IF;

  IF p_status NOT IN ('draft','planned') THEN
    RAISE EXCEPTION 'Nieprawidłowy status: %', p_status;
  END IF;

  IF p_pozycje IS NULL OR jsonb_array_length(p_pozycje) < 1 THEN
    RAISE EXCEPTION 'Co najmniej jedna pozycja wymagana';
  END IF;

  v_seq := public.next_yearly_seq('dostawy', v_year);
  v_numer := format('D/%s/%s', v_year, lpad(v_seq::text, 5, '0'));

  INSERT INTO public.dostawy(
    numer_dostawy, data_dostawy, data_zaladunku, dostawca_id, kraj_id,
    import_manager_id, status, notes, created_by
  )
  VALUES (
    v_numer,
    p_data_dostawy,
    COALESCE(p_data_zaladunku, p_data_dostawy),
    p_dostawca_id,
    NULLIF(p_kraj_id,''),
    p_import_manager_id,
    p_status,
    NULLIF(p_notes,''),
    auth.uid()
  )
  RETURNING id INTO v_dostawa_id;

  FOR v_pozycja IN SELECT * FROM jsonb_array_elements(p_pozycje)
  LOOP
    v_opak_source := lower(btrim(COALESCE(v_pozycja->>'opakowanie_source','catalog')));
    IF v_opak_source NOT IN ('catalog','custom','none') THEN
      RAISE EXCEPTION 'Pozycja: opakowanie_source musi być catalog/custom/none';
    END IF;

    IF v_opak_source = 'catalog' THEN
      v_opak_id := NULLIF(v_pozycja->>'opakowanie_id','');
      v_opak_custom := NULL;
      IF v_opak_id IS NULL THEN
        RAISE EXCEPTION 'Pozycja: opakowanie_id wymagane dla source=catalog';
      END IF;
    ELSIF v_opak_source = 'custom' THEN
      v_opak_id := NULL;
      v_opak_custom := NULLIF(btrim(COALESCE(v_pozycja->>'opakowanie_custom_text','')),'');
      IF v_opak_custom IS NULL THEN
        RAISE EXCEPTION 'Pozycja: opakowanie_custom_text wymagane dla source=custom';
      END IF;
      IF length(v_opak_custom) > 200 THEN
        RAISE EXCEPTION 'Pozycja: opakowanie_custom_text max 200 znaków';
      END IF;
    ELSE
      v_opak_id := NULL;
      v_opak_custom := NULL;
    END IF;

    v_material := lower(btrim(COALESCE(v_pozycja->>'material_tary','')));
    IF v_material NOT IN ('karton','drewno','plastik') THEN
      RAISE EXCEPTION 'Pozycja: material_tary wymagany (karton/drewno/plastik)';
    END IF;

    IF coalesce((v_pozycja->>'netto_kg')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Pozycja: netto_kg musi być > 0';
    END IF;
    IF (v_pozycja->>'cena_zakupu') IS NULL OR btrim(v_pozycja->>'cena_zakupu') = '' THEN
      RAISE EXCEPTION 'Pozycja: cena_zakupu wymagana';
    END IF;
    IF (v_pozycja->>'cena_zakupu')::numeric < 0 THEN
      RAISE EXCEPTION 'Pozycja: cena_zakupu musi być >= 0';
    END IF;
    v_waluta := v_pozycja->>'waluta';
    IF v_waluta NOT IN ('PLN','EUR','USD') THEN
      RAISE EXCEPTION 'Pozycja: waluta musi być PLN/EUR/USD';
    END IF;

    v_pos_seq := public.next_yearly_seq('pozycje', v_year);
    v_position_id := format('P/%s/%s', v_year, lpad(v_pos_seq::text, 6, '0'));

    INSERT INTO public.pozycje_dostawy(
      dostawa_id, position_id, produkt_id, odmiana_id,
      opakowanie_id, opakowanie_source, opakowanie_custom_text, material_tary,
      kraj_id, palety, ilosc_opakowan, netto_kg, brutto_kg, cena_zakupu, waluta, notes
    )
    VALUES (
      v_dostawa_id,
      v_position_id,
      v_pozycja->>'produkt_id',
      NULLIF(v_pozycja->>'odmiana_id',''),
      v_opak_id,
      v_opak_source,
      v_opak_custom,
      v_material,
      NULLIF(v_pozycja->>'kraj_id',''),
      coalesce((v_pozycja->>'palety')::numeric, 0),
      NULLIF(v_pozycja->>'ilosc_opakowan','')::numeric,
      (v_pozycja->>'netto_kg')::numeric,
      NULLIF(v_pozycja->>'brutto_kg','')::numeric,
      (v_pozycja->>'cena_zakupu')::numeric,
      v_waluta,
      NULLIF(v_pozycja->>'notes','')
    )
    RETURNING id INTO v_pozycja_dostawy_id;

    INSERT INTO public.pozycje(position_id, dostawa_id, pozycja_dostawy_id)
    VALUES (v_position_id, v_dostawa_id, v_pozycja_dostawy_id);
  END LOOP;

  RETURN v_dostawa_id;
END;
$function$;
