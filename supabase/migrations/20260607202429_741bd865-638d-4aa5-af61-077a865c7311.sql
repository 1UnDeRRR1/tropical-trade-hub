
-- 1) Schema patch: nullable business columns
ALTER TABLE public.dostawy
  ADD COLUMN IF NOT EXISTS adres_zaladunku        text,
  ADD COLUMN IF NOT EXISTS numer_zaladunku        text,
  ADD COLUMN IF NOT EXISTS temperatura_transportu text;

ALTER TABLE public.transport_sesje
  ADD COLUMN IF NOT EXISTS dane_kierowcy text;

-- 2) Extend utworz_sesje_z_dostawami — signature unchanged.
--    Only changes vs current body:
--    - dane_kierowcy parsed from p_sesja and written to transport_sesje INSERT
--    - after each utworz_dostawe_z_pozycjami(), UPDATE dostawy with
--      adres_zaladunku / numer_zaladunku / temperatura_transportu from
--      the dostawa JSON payload (alongside existing sesja_id link).
CREATE OR REPLACE FUNCTION public.utworz_sesje_z_dostawami(
  p_sesja   jsonb,
  p_dostawy jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_keys                       text[];
  v_current_user                    text;

  v_sesja_id                        uuid := gen_random_uuid();
  v_numer_sesji                     text;
  v_import_manager_id               text;
  v_owner_status                    text;
  v_owner_role                      text;
  v_year                            int;

  v_preliminary                     numeric;
  v_final                           numeric;
  v_waluta                          text;
  v_status                          text;
  v_numer_auta                      text;
  v_przewoznik_id                   text;
  v_etd                             date;
  v_eta                             date;
  v_notes                           text;
  v_dane_kierowcy                   text;

  v_total_palety                    numeric := 0;
  v_total_brutto                    numeric := 0;

  v_dostawa                         jsonb;
  v_dostawa_id                      uuid;
  v_dostawa_numer                   text;
  v_dostawa_count                   int;
  v_results                         jsonb := '[]'::jsonb;

  v_p_data_dostawy                  date;
  v_p_data_zaladunku                date;
  v_p_dostawca_id                   text;
  v_p_kraj_id                       text;
  v_p_status                        text;
  v_p_notes                         text;
  v_p_pozycje                       jsonb;
  v_p_adres_zaladunku               text;
  v_p_numer_zaladunku               text;
  v_p_temperatura_transportu        text;

  v_pozycja                         jsonb;
  v_pozycja_waluta                  text;
  v_pozycja_palety                  numeric;
  v_pozycja_brutto                  numeric;
BEGIN
  v_role_keys    := public.my_role_keys();
  v_current_user := public.current_uzytkownik_id();

  IF v_role_keys IS NULL OR array_length(v_role_keys, 1) IS NULL THEN
    RAISE EXCEPTION 'Brak roli użytkownika';
  END IF;

  IF NOT (
        'super_admin'         = ANY(v_role_keys)
     OR 'kierownik'           = ANY(v_role_keys)
     OR 'asystent_kierownika' = ANY(v_role_keys)
     OR 'import_manager'      = ANY(v_role_keys)
  ) THEN
    RAISE EXCEPTION 'Brak uprawnień do tworzenia sesji transportowej';
  END IF;

  IF p_sesja IS NULL OR jsonb_typeof(p_sesja) <> 'object' THEN
    RAISE EXCEPTION 'p_sesja musi być obiektem JSON';
  END IF;
  IF p_dostawy IS NULL OR jsonb_typeof(p_dostawy) <> 'array' OR jsonb_array_length(p_dostawy) < 1 THEN
    RAISE EXCEPTION 'p_dostawy musi być niepustą tablicą JSON';
  END IF;

  v_import_manager_id := NULLIF(p_sesja->>'import_manager_id', '');
  v_preliminary       := NULLIF(p_sesja->>'preliminary_transport_cost_eur','')::numeric;
  v_final             := NULLIF(p_sesja->>'final_transport_cost_eur','')::numeric;
  v_waluta            := COALESCE(NULLIF(p_sesja->>'waluta',''), 'EUR');
  v_status            := COALESCE(NULLIF(p_sesja->>'status',''), 'draft');
  v_numer_auta        := NULLIF(p_sesja->>'numer_auta','');
  v_przewoznik_id     := NULLIF(p_sesja->>'przewoznik_id','');
  v_etd               := NULLIF(p_sesja->>'etd','')::date;
  v_eta               := NULLIF(p_sesja->>'eta','')::date;
  v_notes             := NULLIF(p_sesja->>'notes','');
  v_dane_kierowcy     := NULLIF(p_sesja->>'dane_kierowcy','');

  IF v_import_manager_id IS NULL THEN
    RAISE EXCEPTION 'p_sesja.import_manager_id wymagane';
  END IF;
  IF v_waluta <> 'EUR' THEN
    RAISE EXCEPTION 'Phase 1A: dozwolona waluta sesji tylko EUR (otrzymano %)', v_waluta;
  END IF;
  IF v_status NOT IN ('draft','planned','in_transit','delivered') THEN
    RAISE EXCEPTION 'Nieprawidłowy status sesji: %', v_status;
  END IF;
  IF v_etd IS NOT NULL AND v_eta IS NOT NULL AND v_eta < v_etd THEN
    RAISE EXCEPTION 'eta (%) wcześniejsza niż etd (%)', v_eta, v_etd;
  END IF;

  SELECT u.status, u.klucz_roli
    INTO v_owner_status, v_owner_role
    FROM public.uzytkownicy u
   WHERE u.uzytkownik_id = v_import_manager_id;

  IF v_owner_status IS NULL THEN
    RAISE EXCEPTION 'import_manager_id % nie istnieje', v_import_manager_id;
  END IF;
  IF v_owner_role IS DISTINCT FROM 'import_manager' THEN
    RAISE EXCEPTION 'Użytkownik % nie ma roli import_manager (klucz_roli=%)', v_import_manager_id, v_owner_role;
  END IF;
  IF v_owner_status <> 'aktywny' THEN
    RAISE EXCEPTION 'import_manager % nie jest aktywny (status=%)', v_import_manager_id, v_owner_status;
  END IF;

  IF 'import_manager' = ANY(v_role_keys)
     AND NOT (
          'super_admin'         = ANY(v_role_keys)
       OR 'kierownik'           = ANY(v_role_keys)
       OR 'asystent_kierownika' = ANY(v_role_keys)
     )
     AND v_import_manager_id IS DISTINCT FROM v_current_user
  THEN
    RAISE EXCEPTION 'Import manager może tworzyć tylko własne sesje';
  END IF;

  IF v_preliminary IS NOT NULL AND v_preliminary < 0 THEN
    RAISE EXCEPTION 'preliminary_transport_cost_eur musi być >= 0';
  END IF;
  IF v_final IS NOT NULL AND v_final < 0 THEN
    RAISE EXCEPTION 'final_transport_cost_eur musi być >= 0';
  END IF;

  IF 'import_manager' = ANY(v_role_keys)
     AND NOT (
          'super_admin'         = ANY(v_role_keys)
       OR 'kierownik'           = ANY(v_role_keys)
       OR 'asystent_kierownika' = ANY(v_role_keys)
     )
  THEN
    IF COALESCE(v_preliminary, 0) <= 0 AND COALESCE(v_final, 0) <= 0 THEN
      RAISE EXCEPTION 'import_manager musi podać preliminary_transport_cost_eur > 0 lub final_transport_cost_eur > 0';
    END IF;
  END IF;

  v_dostawa_count := 0;
  FOR v_dostawa IN SELECT jsonb_array_elements(p_dostawy)
  LOOP
    v_dostawa_count := v_dostawa_count + 1;
    v_p_pozycje := v_dostawa->'pozycje';
    IF v_p_pozycje IS NULL OR jsonb_typeof(v_p_pozycje) <> 'array' OR jsonb_array_length(v_p_pozycje) < 1 THEN
      RAISE EXCEPTION 'dostawa[%] musi mieć niepustą tablicę pozycje', v_dostawa_count;
    END IF;

    FOR v_pozycja IN SELECT jsonb_array_elements(v_p_pozycje)
    LOOP
      v_pozycja_waluta := COALESCE(NULLIF(v_pozycja->>'waluta',''), '');
      v_pozycja_palety := COALESCE(NULLIF(v_pozycja->>'palety','')::numeric, 0);
      v_pozycja_brutto := COALESCE(NULLIF(v_pozycja->>'brutto_kg','')::numeric, 0);

      IF v_pozycja_waluta <> 'EUR' THEN
        RAISE EXCEPTION 'Phase 1A: pozycja waluty EUR wymagana (otrzymano %)', v_pozycja_waluta;
      END IF;

      v_total_palety := v_total_palety + v_pozycja_palety;
      v_total_brutto := v_total_brutto + v_pozycja_brutto;
    END LOOP;
  END LOOP;

  IF v_total_palety > 26 THEN
    RAISE EXCEPTION 'Capacity FAIL: suma palet=% > 26', v_total_palety;
  END IF;
  IF v_total_brutto > 21500 THEN
    RAISE EXCEPTION 'Capacity FAIL: suma brutto_kg=% > 21500', v_total_brutto;
  END IF;

  v_year := COALESCE(EXTRACT(YEAR FROM v_etd)::int, EXTRACT(YEAR FROM now())::int);
  v_numer_sesji := public.tt_next_numer_sesji(v_year);

  INSERT INTO public.transport_sesje (
    sesja_id, numer_sesji, numer_auta, przewoznik_id, etd, eta,
    preliminary_transport_cost_eur, final_transport_cost_eur,
    waluta, status, notes, import_manager_id, created_by, dane_kierowcy
  ) VALUES (
    v_sesja_id, v_numer_sesji, v_numer_auta, v_przewoznik_id, v_etd, v_eta,
    v_preliminary, v_final,
    v_waluta, v_status, v_notes, v_import_manager_id, auth.uid(), v_dane_kierowcy
  );

  FOR v_dostawa IN SELECT jsonb_array_elements(p_dostawy)
  LOOP
    v_p_data_dostawy           := NULLIF(v_dostawa->>'data_dostawy','')::date;
    v_p_data_zaladunku         := NULLIF(v_dostawa->>'data_zaladunku','')::date;
    v_p_dostawca_id            := NULLIF(v_dostawa->>'dostawca_id','');
    v_p_kraj_id                := NULLIF(v_dostawa->>'kraj_id','');
    v_p_status                 := COALESCE(NULLIF(v_dostawa->>'status',''), 'draft');
    v_p_notes                  := NULLIF(v_dostawa->>'notes','');
    v_p_pozycje                := v_dostawa->'pozycje';
    v_p_adres_zaladunku        := NULLIF(v_dostawa->>'adres_zaladunku','');
    v_p_numer_zaladunku        := NULLIF(v_dostawa->>'numer_zaladunku','');
    v_p_temperatura_transportu := NULLIF(v_dostawa->>'temperatura_transportu','');

    IF v_p_data_dostawy   IS NULL THEN RAISE EXCEPTION 'dostawa.data_dostawy wymagane';   END IF;
    IF v_p_data_zaladunku IS NULL THEN RAISE EXCEPTION 'dostawa.data_zaladunku wymagane'; END IF;
    IF v_p_dostawca_id    IS NULL THEN RAISE EXCEPTION 'dostawa.dostawca_id wymagane';    END IF;

    v_dostawa_id := public.utworz_dostawe_z_pozycjami(
      p_data_dostawy    => v_p_data_dostawy,
      p_dostawca_id     => v_p_dostawca_id,
      p_kraj_id         => v_p_kraj_id,
      p_import_manager_id => v_import_manager_id,
      p_status          => v_p_status,
      p_notes           => v_p_notes,
      p_pozycje         => v_p_pozycje,
      p_data_zaladunku  => v_p_data_zaladunku
    );

    UPDATE public.dostawy
       SET sesja_id               = v_sesja_id,
           adres_zaladunku        = v_p_adres_zaladunku,
           numer_zaladunku        = v_p_numer_zaladunku,
           temperatura_transportu = v_p_temperatura_transportu
     WHERE id = v_dostawa_id;

    SELECT numer_dostawy INTO v_dostawa_numer FROM public.dostawy WHERE id = v_dostawa_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id',            v_dostawa_id,
      'numer_dostawy', v_dostawa_numer
    ));
  END LOOP;

  SELECT
    COALESCE(SUM(pd.palety), 0),
    COALESCE(SUM(pd.brutto_kg), 0)
  INTO
    v_total_palety,
    v_total_brutto
  FROM public.pozycje_dostawy pd
  JOIN public.dostawy d ON d.id = pd.dostawa_id
  WHERE d.sesja_id = v_sesja_id;

  IF v_total_palety > 26 THEN
    RAISE EXCEPTION 'Capacity FAIL (persisted): suma palet=% > 26', v_total_palety;
  END IF;
  IF v_total_brutto > 21500 THEN
    RAISE EXCEPTION 'Capacity FAIL (persisted): suma brutto_kg=% > 21500', v_total_brutto;
  END IF;

  RETURN jsonb_build_object(
    'sesja_id',       v_sesja_id,
    'numer_sesji',    v_numer_sesji,
    'dostawy',        v_results,
    'total_palety',   v_total_palety,
    'total_brutto_kg',v_total_brutto
  );
END
$$;
