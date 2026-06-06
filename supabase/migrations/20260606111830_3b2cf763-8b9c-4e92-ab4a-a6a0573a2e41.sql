
CREATE OR REPLACE FUNCTION public.aktualizuj_dostawe_z_pozycjami(
  p_dostawa_id uuid,
  p_data_dostawy date,
  p_data_zaladunku date,
  p_dostawca_id text,
  p_kraj_id text,
  p_import_manager_id text,
  p_status text,
  p_notes text,
  p_pozycje jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_existing record;
  v_role_keys text[];
  v_current_user text;
  v_pozycja jsonb;
  v_pos_id uuid;
  v_position_id text;
  v_pos_seq bigint;
  v_year int;
  v_waluta text;
  v_opak_source text;
  v_opak_id text;
  v_opak_custom text;
  v_material text;
  v_kept_ids uuid[] := ARRAY[]::uuid[];
  v_missing uuid;
BEGIN
  v_role_keys := public.my_role_keys();
  v_current_user := public.current_uzytkownik_id();

  SELECT * INTO v_existing FROM public.dostawy WHERE id = p_dostawa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dostawa nie istnieje';
  END IF;

  IF NOT ('super_admin' = ANY(v_role_keys)
          OR ('import_manager' = ANY(v_role_keys) AND v_existing.import_manager_id = v_current_user)) THEN
    RAISE EXCEPTION 'Brak uprawnień do edycji tej dostawy';
  END IF;

  IF v_existing.status NOT IN ('draft','planned') THEN
    RAISE EXCEPTION 'Edycja możliwa tylko dla statusu draft lub planned (obecny: %)', v_existing.status;
  END IF;

  IF p_status NOT IN ('draft','planned') THEN
    RAISE EXCEPTION 'Nieprawidłowy status: %', p_status;
  END IF;

  IF NOT ('super_admin' = ANY(v_role_keys)) THEN
    IF p_import_manager_id IS DISTINCT FROM v_existing.import_manager_id THEN
      RAISE EXCEPTION 'Import manager nie może zmienić właściciela dostawy';
    END IF;
  END IF;

  IF p_pozycje IS NULL OR jsonb_array_length(p_pozycje) < 1 THEN
    RAISE EXCEPTION 'Co najmniej jedna pozycja wymagana';
  END IF;

  v_year := extract(year from p_data_dostawy)::int;

  UPDATE public.dostawy
  SET data_dostawy = p_data_dostawy,
      data_zaladunku = COALESCE(p_data_zaladunku, p_data_dostawy),
      dostawca_id = p_dostawca_id,
      kraj_id = NULLIF(p_kraj_id,''),
      import_manager_id = p_import_manager_id,
      status = p_status,
      notes = NULLIF(p_notes,''),
      updated_at = now()
  WHERE id = p_dostawa_id;

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

    v_pos_id := NULLIF(v_pozycja->>'id','')::uuid;

    IF v_pos_id IS NOT NULL THEN
      -- Update existing line, preserve position_id
      UPDATE public.pozycje_dostawy
      SET produkt_id = v_pozycja->>'produkt_id',
          odmiana_id = NULLIF(v_pozycja->>'odmiana_id',''),
          opakowanie_id = v_opak_id,
          opakowanie_source = v_opak_source,
          opakowanie_custom_text = v_opak_custom,
          material_tary = v_material,
          kraj_id = NULLIF(v_pozycja->>'kraj_id',''),
          palety = coalesce((v_pozycja->>'palety')::numeric, 0),
          ilosc_opakowan = NULLIF(v_pozycja->>'ilosc_opakowan','')::numeric,
          netto_kg = (v_pozycja->>'netto_kg')::numeric,
          brutto_kg = NULLIF(v_pozycja->>'brutto_kg','')::numeric,
          cena_zakupu = (v_pozycja->>'cena_zakupu')::numeric,
          waluta = v_waluta,
          notes = NULLIF(v_pozycja->>'notes',''),
          updated_at = now()
      WHERE id = v_pos_id AND dostawa_id = p_dostawa_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Pozycja % nie należy do tej dostawy', v_pos_id;
      END IF;
      v_kept_ids := array_append(v_kept_ids, v_pos_id);
    ELSE
      -- New line: allocate new position_id
      v_pos_seq := public.next_yearly_seq('pozycje', v_year);
      v_position_id := format('P/%s/%s', v_year, lpad(v_pos_seq::text, 6, '0'));
      INSERT INTO public.pozycje_dostawy(
        dostawa_id, position_id, produkt_id, odmiana_id,
        opakowanie_id, opakowanie_source, opakowanie_custom_text, material_tary,
        kraj_id, palety, ilosc_opakowan, netto_kg, brutto_kg, cena_zakupu, waluta, notes
      ) VALUES (
        p_dostawa_id, v_position_id,
        v_pozycja->>'produkt_id',
        NULLIF(v_pozycja->>'odmiana_id',''),
        v_opak_id, v_opak_source, v_opak_custom, v_material,
        NULLIF(v_pozycja->>'kraj_id',''),
        coalesce((v_pozycja->>'palety')::numeric, 0),
        NULLIF(v_pozycja->>'ilosc_opakowan','')::numeric,
        (v_pozycja->>'netto_kg')::numeric,
        NULLIF(v_pozycja->>'brutto_kg','')::numeric,
        (v_pozycja->>'cena_zakupu')::numeric,
        v_waluta,
        NULLIF(v_pozycja->>'notes','')
      ) RETURNING id INTO v_pos_id;
      INSERT INTO public.pozycje(position_id, dostawa_id, pozycja_dostawy_id)
      VALUES (v_position_id, p_dostawa_id, v_pos_id);
      v_kept_ids := array_append(v_kept_ids, v_pos_id);
    END IF;
  END LOOP;

  -- Reject deletions: bail if any existing row was not present in payload
  SELECT id INTO v_missing FROM public.pozycje_dostawy
  WHERE dostawa_id = p_dostawa_id AND NOT (id = ANY(v_kept_ids))
  LIMIT 1;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Usuwanie istniejących pozycji nie jest jeszcze obsługiwane (pozycja %)', v_missing;
  END IF;

  RETURN p_dostawa_id;
END;
$function$;
