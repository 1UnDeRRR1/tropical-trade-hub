-- Phase 1B-C corrective: add Klasa / Kaliber / Marka to pozycje_dostawy
-- and extend create/update RPCs to persist them. No other schema changes.

ALTER TABLE public.pozycje_dostawy
  ADD COLUMN IF NOT EXISTS klasa text,
  ADD COLUMN IF NOT EXISTS kaliber text,
  ADD COLUMN IF NOT EXISTS marka text;

-- Recreate utworz_dostawe_z_pozycjami: read klasa/kaliber/marka from each pozycja JSON.
CREATE OR REPLACE FUNCTION public.utworz_dostawe_z_pozycjami(
  p_data_dostawy date,
  p_dostawca_id text,
  p_kraj_id text,
  p_import_manager_id text,
  p_status text,
  p_notes text,
  p_pozycje jsonb,
  p_data_zaladunku date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dostawa_id uuid;
  v_numer text;
  v_year int := extract(year from p_data_dostawy)::int;
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
  v_total_palety numeric := 0;
  v_total_brutto numeric := 0;
  v_netto numeric;
  v_brutto numeric;
  v_klasa text;
  v_kaliber text;
  v_marka text;
BEGIN
  v_role_keys := public.my_role_keys();
  v_current_user := public.current_uzytkownik_id();

  IF NOT (
       'super_admin'         = ANY(v_role_keys)
    OR 'import_manager'      = ANY(v_role_keys)
    OR 'kierownik'           = ANY(v_role_keys)
    OR 'asystent_kierownika' = ANY(v_role_keys)
  ) THEN
    RAISE EXCEPTION 'Brak uprawnień do tworzenia dostaw';
  END IF;
  IF 'import_manager' = ANY(v_role_keys)
     AND NOT ('super_admin' = ANY(v_role_keys) OR 'kierownik' = ANY(v_role_keys) OR 'asystent_kierownika' = ANY(v_role_keys))
     AND p_import_manager_id IS DISTINCT FROM v_current_user THEN
    RAISE EXCEPTION 'Import manager może tworzyć tylko własne dostawy';
  END IF;
  IF p_status NOT IN ('draft','planned') THEN RAISE EXCEPTION 'Nieprawidłowy status: %', p_status; END IF;
  IF p_pozycje IS NULL OR jsonb_array_length(p_pozycje) < 1 THEN RAISE EXCEPTION 'Co najmniej jedna pozycja wymagana'; END IF;
  IF p_dostawca_id IS NULL OR btrim(p_dostawca_id) = '' THEN RAISE EXCEPTION 'Dostawca wymagany'; END IF;
  IF p_kraj_id IS NULL OR btrim(p_kraj_id) = '' THEN RAISE EXCEPTION 'Kraj załadunku wymagany'; END IF;

  PERFORM public._kraj_iso3(p_kraj_id);
  v_numer := public._gen_business_numer(p_dostawca_id, p_kraj_id);

  INSERT INTO public.dostawy(
    numer_dostawy, data_dostawy, data_zaladunku, dostawca_id, kraj_id,
    import_manager_id, status, notes, created_by
  ) VALUES (
    v_numer, p_data_dostawy, COALESCE(p_data_zaladunku, p_data_dostawy),
    p_dostawca_id, p_kraj_id, p_import_manager_id, p_status, NULLIF(p_notes,''), auth.uid()
  ) RETURNING id INTO v_dostawa_id;

  FOR v_pozycja IN SELECT * FROM jsonb_array_elements(p_pozycje) LOOP
    v_opak_source := lower(btrim(COALESCE(v_pozycja->>'opakowanie_source','catalog')));
    IF v_opak_source NOT IN ('catalog','custom','none') THEN
      RAISE EXCEPTION 'Pozycja: opakowanie_source musi być catalog/custom/none';
    END IF;
    IF v_opak_source = 'catalog' THEN
      v_opak_id := NULLIF(v_pozycja->>'opakowanie_id',''); v_opak_custom := NULL;
      IF v_opak_id IS NULL THEN RAISE EXCEPTION 'Pozycja: opakowanie_id wymagane dla source=catalog'; END IF;
    ELSIF v_opak_source = 'custom' THEN
      v_opak_id := NULL;
      v_opak_custom := NULLIF(btrim(COALESCE(v_pozycja->>'opakowanie_custom_text','')),'');
      IF v_opak_custom IS NULL THEN RAISE EXCEPTION 'Pozycja: opakowanie_custom_text wymagane dla source=custom'; END IF;
      IF length(v_opak_custom) > 200 THEN RAISE EXCEPTION 'Pozycja: opakowanie_custom_text max 200 znaków'; END IF;
    ELSE v_opak_id := NULL; v_opak_custom := NULL; END IF;

    v_material := lower(btrim(COALESCE(v_pozycja->>'material_tary','')));
    IF v_material NOT IN ('karton','drewno','plastik') THEN
      RAISE EXCEPTION 'Pozycja: material_tary wymagany (karton/drewno/plastik)';
    END IF;

    IF v_pozycja->>'produkt_id' IS NULL OR btrim(v_pozycja->>'produkt_id') = '' THEN
      RAISE EXCEPTION 'Pozycja: produkt wymagany';
    END IF;
    IF v_pozycja->>'kraj_id' IS NULL OR btrim(v_pozycja->>'kraj_id') = '' THEN
      RAISE EXCEPTION 'Pozycja: kraj pochodzenia wymagany';
    END IF;

    v_netto := NULLIF(v_pozycja->>'netto_kg','')::numeric;
    IF v_netto IS NULL OR v_netto <= 0 THEN RAISE EXCEPTION 'Pozycja: netto_kg wymagane i > 0'; END IF;

    v_brutto := NULLIF(v_pozycja->>'brutto_kg','')::numeric;
    IF v_brutto IS NULL OR v_brutto <= 0 THEN RAISE EXCEPTION 'Pozycja: brutto_kg wymagane i > 0'; END IF;
    IF v_brutto < v_netto THEN RAISE EXCEPTION 'Pozycja: brutto_kg nie może być mniejsze niż netto_kg'; END IF;

    IF (v_pozycja->>'cena_zakupu') IS NULL OR btrim(v_pozycja->>'cena_zakupu') = '' THEN
      RAISE EXCEPTION 'Pozycja: cena_zakupu wymagana';
    END IF;
    IF (v_pozycja->>'cena_zakupu')::numeric < 0 THEN
      RAISE EXCEPTION 'Pozycja: cena_zakupu musi być >= 0';
    END IF;
    v_waluta := v_pozycja->>'waluta';
    IF v_waluta NOT IN ('PLN','EUR','USD') THEN RAISE EXCEPTION 'Pozycja: waluta musi być PLN/EUR/USD'; END IF;

    v_total_palety := v_total_palety + coalesce((v_pozycja->>'palety')::numeric, 0);
    v_total_brutto := v_total_brutto + v_brutto;

    v_klasa   := NULLIF(btrim(COALESCE(v_pozycja->>'klasa','')),'');
    v_kaliber := NULLIF(btrim(COALESCE(v_pozycja->>'kaliber','')),'');
    v_marka   := NULLIF(btrim(COALESCE(v_pozycja->>'marka','')),'');
    IF v_klasa IS NOT NULL AND length(v_klasa) > 100 THEN RAISE EXCEPTION 'Pozycja: klasa max 100 znaków'; END IF;
    IF v_kaliber IS NOT NULL AND length(v_kaliber) > 100 THEN RAISE EXCEPTION 'Pozycja: kaliber max 100 znaków'; END IF;
    IF v_marka IS NOT NULL AND length(v_marka) > 100 THEN RAISE EXCEPTION 'Pozycja: marka max 100 znaków'; END IF;

    v_pos_seq := public.next_yearly_seq('pozycje', v_year);
    v_position_id := format('P/%s/%s', v_year, lpad(v_pos_seq::text, 6, '0'));

    INSERT INTO public.pozycje_dostawy(
      dostawa_id, position_id, produkt_id, odmiana_id,
      opakowanie_id, opakowanie_source, opakowanie_custom_text, material_tary,
      kraj_id, palety, ilosc_opakowan, netto_kg, brutto_kg, cena_zakupu, waluta, notes,
      klasa, kaliber, marka
    ) VALUES (
      v_dostawa_id, v_position_id,
      v_pozycja->>'produkt_id', NULLIF(v_pozycja->>'odmiana_id',''),
      v_opak_id, v_opak_source, v_opak_custom, v_material,
      NULLIF(v_pozycja->>'kraj_id',''),
      coalesce((v_pozycja->>'palety')::numeric, 0),
      NULLIF(v_pozycja->>'ilosc_opakowan','')::numeric,
      v_netto, v_brutto, (v_pozycja->>'cena_zakupu')::numeric, v_waluta,
      NULLIF(v_pozycja->>'notes',''),
      v_klasa, v_kaliber, v_marka
    ) RETURNING id INTO v_pozycja_dostawy_id;

    INSERT INTO public.pozycje(position_id, dostawa_id, pozycja_dostawy_id)
    VALUES (v_position_id, v_dostawa_id, v_pozycja_dostawy_id);
  END LOOP;

  IF v_total_palety > 26 THEN RAISE EXCEPTION 'Przekroczono limit auta: palety %/26', v_total_palety; END IF;
  IF v_total_brutto > 21500 THEN RAISE EXCEPTION 'Przekroczono limit auta: brutto % kg / 21500', v_total_brutto; END IF;

  RETURN v_dostawa_id;
END $function$;

-- Recreate aktualizuj_dostawe_z_pozycjami: read/write klasa/kaliber/marka.
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
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_is_new_format boolean;
  v_total_palety numeric := 0;
  v_total_brutto numeric := 0;
  v_netto numeric;
  v_brutto numeric;
  v_klasa text;
  v_kaliber text;
  v_marka text;
BEGIN
  v_role_keys := public.my_role_keys();
  v_current_user := public.current_uzytkownik_id();

  SELECT * INTO v_existing FROM public.dostawy WHERE id = p_dostawa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dostawa nie istnieje'; END IF;

  IF NOT ('super_admin' = ANY(v_role_keys)
       OR 'kierownik' = ANY(v_role_keys)
       OR 'asystent_kierownika' = ANY(v_role_keys)
       OR ('import_manager' = ANY(v_role_keys) AND v_existing.import_manager_id = v_current_user)) THEN
    RAISE EXCEPTION 'Brak uprawnień do edycji tej dostawy';
  END IF;
  IF v_existing.status NOT IN ('draft','planned') THEN
    RAISE EXCEPTION 'Edycja możliwa tylko dla statusu draft lub planned (obecny: %)', v_existing.status;
  END IF;
  IF p_status NOT IN ('draft','planned') THEN RAISE EXCEPTION 'Nieprawidłowy status: %', p_status; END IF;
  IF NOT ('super_admin' = ANY(v_role_keys) OR 'kierownik' = ANY(v_role_keys) OR 'asystent_kierownika' = ANY(v_role_keys))
     AND p_import_manager_id IS DISTINCT FROM v_existing.import_manager_id THEN
    RAISE EXCEPTION 'Import manager nie może zmienić właściciela dostawy';
  END IF;
  IF p_pozycje IS NULL OR jsonb_array_length(p_pozycje) < 1 THEN RAISE EXCEPTION 'Co najmniej jedna pozycja wymagana'; END IF;
  IF p_dostawca_id IS NULL OR btrim(p_dostawca_id) = '' THEN RAISE EXCEPTION 'Dostawca wymagany'; END IF;
  IF p_kraj_id IS NULL OR btrim(p_kraj_id) = '' THEN RAISE EXCEPTION 'Kraj załadunku wymagany'; END IF;

  v_is_new_format := v_existing.numer_dostawy ~ '^[A-Z0-9]+/[0-9]{3}/[A-Z]{3}/[0-9]{3}$';
  IF v_is_new_format THEN
    IF p_dostawca_id IS DISTINCT FROM v_existing.dostawca_id THEN
      RAISE EXCEPTION 'Nie można zmienić dostawcy w dostawie z nowym numerem (%). Utwórz nową dostawę.', v_existing.numer_dostawy;
    END IF;
    IF p_kraj_id IS DISTINCT FROM v_existing.kraj_id THEN
      RAISE EXCEPTION 'Nie można zmienić kraju załadunku w dostawie z nowym numerem (%). Utwórz nową dostawę.', v_existing.numer_dostawy;
    END IF;
  END IF;

  v_year := extract(year from p_data_dostawy)::int;

  UPDATE public.dostawy
  SET data_dostawy = p_data_dostawy,
      data_zaladunku = COALESCE(p_data_zaladunku, p_data_dostawy),
      dostawca_id = p_dostawca_id,
      kraj_id = p_kraj_id,
      import_manager_id = p_import_manager_id,
      status = p_status,
      notes = NULLIF(p_notes,''),
      updated_at = now()
  WHERE id = p_dostawa_id;

  FOR v_pozycja IN SELECT * FROM jsonb_array_elements(p_pozycje) LOOP
    v_opak_source := lower(btrim(COALESCE(v_pozycja->>'opakowanie_source','catalog')));
    IF v_opak_source NOT IN ('catalog','custom','none') THEN
      RAISE EXCEPTION 'Pozycja: opakowanie_source musi być catalog/custom/none';
    END IF;
    IF v_opak_source = 'catalog' THEN
      v_opak_id := NULLIF(v_pozycja->>'opakowanie_id',''); v_opak_custom := NULL;
      IF v_opak_id IS NULL THEN RAISE EXCEPTION 'Pozycja: opakowanie_id wymagane dla source=catalog'; END IF;
    ELSIF v_opak_source = 'custom' THEN
      v_opak_id := NULL;
      v_opak_custom := NULLIF(btrim(COALESCE(v_pozycja->>'opakowanie_custom_text','')),'');
      IF v_opak_custom IS NULL THEN RAISE EXCEPTION 'Pozycja: opakowanie_custom_text wymagane dla source=custom'; END IF;
      IF length(v_opak_custom) > 200 THEN RAISE EXCEPTION 'Pozycja: opakowanie_custom_text max 200 znaków'; END IF;
    ELSE v_opak_id := NULL; v_opak_custom := NULL; END IF;

    v_material := lower(btrim(COALESCE(v_pozycja->>'material_tary','')));
    IF v_material NOT IN ('karton','drewno','plastik') THEN
      RAISE EXCEPTION 'Pozycja: material_tary wymagany (karton/drewno/plastik)';
    END IF;

    IF v_pozycja->>'produkt_id' IS NULL OR btrim(v_pozycja->>'produkt_id') = '' THEN
      RAISE EXCEPTION 'Pozycja: produkt wymagany';
    END IF;
    IF v_pozycja->>'kraj_id' IS NULL OR btrim(v_pozycja->>'kraj_id') = '' THEN
      RAISE EXCEPTION 'Pozycja: kraj pochodzenia wymagany';
    END IF;

    v_netto := NULLIF(v_pozycja->>'netto_kg','')::numeric;
    IF v_netto IS NULL OR v_netto <= 0 THEN RAISE EXCEPTION 'Pozycja: netto_kg wymagane i > 0'; END IF;

    v_brutto := NULLIF(v_pozycja->>'brutto_kg','')::numeric;
    IF v_brutto IS NULL OR v_brutto <= 0 THEN RAISE EXCEPTION 'Pozycja: brutto_kg wymagane i > 0'; END IF;
    IF v_brutto < v_netto THEN RAISE EXCEPTION 'Pozycja: brutto_kg nie może być mniejsze niż netto_kg'; END IF;

    IF (v_pozycja->>'cena_zakupu') IS NULL OR btrim(v_pozycja->>'cena_zakupu') = '' THEN
      RAISE EXCEPTION 'Pozycja: cena_zakupu wymagana';
    END IF;
    IF (v_pozycja->>'cena_zakupu')::numeric < 0 THEN
      RAISE EXCEPTION 'Pozycja: cena_zakupu musi być >= 0';
    END IF;
    v_waluta := v_pozycja->>'waluta';
    IF v_waluta NOT IN ('PLN','EUR','USD') THEN RAISE EXCEPTION 'Pozycja: waluta musi być PLN/EUR/USD'; END IF;

    v_total_palety := v_total_palety + coalesce((v_pozycja->>'palety')::numeric, 0);
    v_total_brutto := v_total_brutto + v_brutto;

    v_klasa   := NULLIF(btrim(COALESCE(v_pozycja->>'klasa','')),'');
    v_kaliber := NULLIF(btrim(COALESCE(v_pozycja->>'kaliber','')),'');
    v_marka   := NULLIF(btrim(COALESCE(v_pozycja->>'marka','')),'');
    IF v_klasa IS NOT NULL AND length(v_klasa) > 100 THEN RAISE EXCEPTION 'Pozycja: klasa max 100 znaków'; END IF;
    IF v_kaliber IS NOT NULL AND length(v_kaliber) > 100 THEN RAISE EXCEPTION 'Pozycja: kaliber max 100 znaków'; END IF;
    IF v_marka IS NOT NULL AND length(v_marka) > 100 THEN RAISE EXCEPTION 'Pozycja: marka max 100 znaków'; END IF;

    v_pos_id := NULLIF(v_pozycja->>'id','')::uuid;

    IF v_pos_id IS NOT NULL THEN
      UPDATE public.pozycje_dostawy
      SET produkt_id = v_pozycja->>'produkt_id',
          odmiana_id = NULLIF(v_pozycja->>'odmiana_id',''),
          opakowanie_id = v_opak_id, opakowanie_source = v_opak_source,
          opakowanie_custom_text = v_opak_custom, material_tary = v_material,
          kraj_id = NULLIF(v_pozycja->>'kraj_id',''),
          palety = coalesce((v_pozycja->>'palety')::numeric, 0),
          ilosc_opakowan = NULLIF(v_pozycja->>'ilosc_opakowan','')::numeric,
          netto_kg = v_netto, brutto_kg = v_brutto,
          cena_zakupu = (v_pozycja->>'cena_zakupu')::numeric, waluta = v_waluta,
          notes = NULLIF(v_pozycja->>'notes',''),
          klasa = v_klasa, kaliber = v_kaliber, marka = v_marka,
          updated_at = now()
      WHERE id = v_pos_id AND dostawa_id = p_dostawa_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Pozycja % nie należy do tej dostawy', v_pos_id; END IF;
      v_kept_ids := array_append(v_kept_ids, v_pos_id);
    ELSE
      v_pos_seq := public.next_yearly_seq('pozycje', v_year);
      v_position_id := format('P/%s/%s', v_year, lpad(v_pos_seq::text, 6, '0'));
      INSERT INTO public.pozycje_dostawy(
        dostawa_id, position_id, produkt_id, odmiana_id,
        opakowanie_id, opakowanie_source, opakowanie_custom_text, material_tary,
        kraj_id, palety, ilosc_opakowan, netto_kg, brutto_kg, cena_zakupu, waluta, notes,
        klasa, kaliber, marka
      ) VALUES (
        p_dostawa_id, v_position_id, v_pozycja->>'produkt_id', NULLIF(v_pozycja->>'odmiana_id',''),
        v_opak_id, v_opak_source, v_opak_custom, v_material,
        NULLIF(v_pozycja->>'kraj_id',''),
        coalesce((v_pozycja->>'palety')::numeric, 0),
        NULLIF(v_pozycja->>'ilosc_opakowan','')::numeric,
        v_netto, v_brutto, (v_pozycja->>'cena_zakupu')::numeric, v_waluta,
        NULLIF(v_pozycja->>'notes',''),
        v_klasa, v_kaliber, v_marka
      ) RETURNING id INTO v_pos_id;
      INSERT INTO public.pozycje(position_id, dostawa_id, pozycja_dostawy_id)
      VALUES (v_position_id, p_dostawa_id, v_pos_id);
      v_kept_ids := array_append(v_kept_ids, v_pos_id);
    END IF;
  END LOOP;

  IF v_total_palety > 26 THEN RAISE EXCEPTION 'Przekroczono limit auta: palety %/26', v_total_palety; END IF;
  IF v_total_brutto > 21500 THEN RAISE EXCEPTION 'Przekroczono limit auta: brutto % kg / 21500', v_total_brutto; END IF;

  SELECT id INTO v_missing FROM public.pozycje_dostawy
  WHERE dostawa_id = p_dostawa_id AND NOT (id = ANY(v_kept_ids)) LIMIT 1;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Usuwanie istniejących pozycji nie jest jeszcze obsługiwane (pozycja %)', v_missing;
  END IF;

  RETURN p_dostawa_id;
END $function$;