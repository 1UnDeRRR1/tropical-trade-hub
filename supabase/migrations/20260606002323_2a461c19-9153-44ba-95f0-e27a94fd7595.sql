
-- =====================================================================
-- Dostawy module: first operational core
-- =====================================================================

-- ---------- 1. Add PRIMARY KEY constraints on reference tables ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.dostawcy'::regclass AND contype='p') THEN
    ALTER TABLE public.dostawcy ADD CONSTRAINT dostawcy_pkey PRIMARY KEY (dostawca_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.produkty'::regclass AND contype='p') THEN
    ALTER TABLE public.produkty ADD CONSTRAINT produkty_pkey PRIMARY KEY (produkt_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.odmiany'::regclass AND contype='p') THEN
    ALTER TABLE public.odmiany ADD CONSTRAINT odmiany_pkey PRIMARY KEY (odmiana_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.opakowania'::regclass AND contype='p') THEN
    ALTER TABLE public.opakowania ADD CONSTRAINT opakowania_pkey PRIMARY KEY (opakowanie_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.kraje'::regclass AND contype='p') THEN
    ALTER TABLE public.kraje ADD CONSTRAINT kraje_pkey PRIMARY KEY (kraj_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.uzytkownicy'::regclass AND contype='p') THEN
    ALTER TABLE public.uzytkownicy ADD CONSTRAINT uzytkownicy_pkey PRIMARY KEY (uzytkownik_id);
  END IF;
END$$;

-- ---------- 2. Generic updated_at trigger function ----------
CREATE OR REPLACE FUNCTION public.tt_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- 3. Yearly sequence helper ----------
CREATE OR REPLACE FUNCTION public.next_yearly_seq(_prefix text, _year int)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seq_name text := format('seq_%s_%s', _prefix, _year);
  v bigint;
BEGIN
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I', seq_name);
  EXECUTE format('SELECT nextval(''public.%I'')', seq_name) INTO v;
  RETURN v;
END;
$$;

-- ---------- 4. dostawy ----------
CREATE TABLE public.dostawy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numer_dostawy text NOT NULL UNIQUE,
  data_dostawy date NOT NULL,
  dostawca_id text NOT NULL REFERENCES public.dostawcy(dostawca_id) ON DELETE RESTRICT,
  kraj_id text REFERENCES public.kraje(kraj_id) ON DELETE RESTRICT,
  import_manager_id text NOT NULL REFERENCES public.uzytkownicy(uzytkownik_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dostawy_import_manager ON public.dostawy(import_manager_id);
CREATE INDEX idx_dostawy_dostawca ON public.dostawy(dostawca_id);
CREATE INDEX idx_dostawy_data ON public.dostawy(data_dostawy DESC);

GRANT SELECT, INSERT, UPDATE ON public.dostawy TO authenticated;
GRANT ALL ON public.dostawy TO service_role;

ALTER TABLE public.dostawy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dostawy_select_full" ON public.dostawy
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']));

CREATE POLICY "dostawy_select_import_manager_own" ON public.dostawy
  FOR SELECT TO authenticated
  USING (
    public.has_role('import_manager')
    AND import_manager_id = public.current_uzytkownik_id()
  );

CREATE POLICY "dostawy_super_admin_write" ON public.dostawy
  FOR ALL TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

CREATE TRIGGER trg_dostawy_updated_at
  BEFORE UPDATE ON public.dostawy
  FOR EACH ROW EXECUTE FUNCTION public.tt_set_updated_at();

-- ---------- 5. pozycje_dostawy ----------
CREATE TABLE public.pozycje_dostawy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dostawa_id uuid NOT NULL REFERENCES public.dostawy(id) ON DELETE RESTRICT,
  position_id text NOT NULL UNIQUE,
  produkt_id text NOT NULL REFERENCES public.produkty(produkt_id) ON DELETE RESTRICT,
  odmiana_id text REFERENCES public.odmiany(odmiana_id) ON DELETE RESTRICT,
  opakowanie_id text NOT NULL REFERENCES public.opakowania(opakowanie_id) ON DELETE RESTRICT,
  kraj_id text REFERENCES public.kraje(kraj_id) ON DELETE RESTRICT,
  palety numeric NOT NULL DEFAULT 0 CHECK (palety >= 0),
  ilosc_opakowan numeric CHECK (ilosc_opakowan IS NULL OR ilosc_opakowan >= 0),
  netto_kg numeric NOT NULL CHECK (netto_kg > 0),
  brutto_kg numeric,
  cena_zakupu numeric NOT NULL CHECK (cena_zakupu >= 0),
  waluta text NOT NULL CHECK (waluta IN ('PLN','EUR','USD')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pozycje_dostawy_dostawa ON public.pozycje_dostawy(dostawa_id);
CREATE INDEX idx_pozycje_dostawy_produkt ON public.pozycje_dostawy(produkt_id);

GRANT SELECT, INSERT, UPDATE ON public.pozycje_dostawy TO authenticated;
GRANT ALL ON public.pozycje_dostawy TO service_role;

ALTER TABLE public.pozycje_dostawy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pozycje_dostawy_select_full" ON public.pozycje_dostawy
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']));

CREATE POLICY "pozycje_dostawy_select_import_manager_own" ON public.pozycje_dostawy
  FOR SELECT TO authenticated
  USING (
    public.has_role('import_manager')
    AND EXISTS (
      SELECT 1 FROM public.dostawy d
      WHERE d.id = pozycje_dostawy.dostawa_id
        AND d.import_manager_id = public.current_uzytkownik_id()
    )
  );

CREATE POLICY "pozycje_dostawy_super_admin_write" ON public.pozycje_dostawy
  FOR ALL TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

CREATE TRIGGER trg_pozycje_dostawy_updated_at
  BEFORE UPDATE ON public.pozycje_dostawy
  FOR EACH ROW EXECUTE FUNCTION public.tt_set_updated_at();

-- ---------- 6. pozycje (lifecycle anchor) ----------
CREATE TABLE public.pozycje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id text NOT NULL UNIQUE,
  dostawa_id uuid NOT NULL REFERENCES public.dostawy(id) ON DELETE RESTRICT,
  pozycja_dostawy_id uuid NOT NULL UNIQUE REFERENCES public.pozycje_dostawy(id) ON DELETE RESTRICT,
  stock_status text NOT NULL DEFAULT 'planned'
    CHECK (stock_status IN ('planned','received','in_stock','partially_sold','sold_out','written_off','closed_stock')),
  settlement_status text NOT NULL DEFAULT 'not_sold'
    CHECK (settlement_status IN ('not_sold','sold_unpaid','partially_paid','paid','closed_financially')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pozycje_dostawa ON public.pozycje(dostawa_id);

GRANT SELECT, INSERT, UPDATE ON public.pozycje TO authenticated;
GRANT ALL ON public.pozycje TO service_role;

ALTER TABLE public.pozycje ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pozycje_select_full" ON public.pozycje
  FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika']));

CREATE POLICY "pozycje_select_import_manager_own" ON public.pozycje
  FOR SELECT TO authenticated
  USING (
    public.has_role('import_manager')
    AND EXISTS (
      SELECT 1 FROM public.dostawy d
      WHERE d.id = pozycje.dostawa_id
        AND d.import_manager_id = public.current_uzytkownik_id()
    )
  );

CREATE POLICY "pozycje_super_admin_write" ON public.pozycje
  FOR ALL TO authenticated
  USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));

CREATE TRIGGER trg_pozycje_updated_at
  BEFORE UPDATE ON public.pozycje
  FOR EACH ROW EXECUTE FUNCTION public.tt_set_updated_at();

-- ---------- 7. RPC: utworz_dostawe_z_pozycjami ----------
CREATE OR REPLACE FUNCTION public.utworz_dostawe_z_pozycjami(
  p_data_dostawy date,
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
AS $$
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
    RAISE EXCEPTION 'Dostawa musi zawierać co najmniej jedną pozycję';
  END IF;

  v_seq := public.next_yearly_seq('dostawy', v_year);
  v_numer := format('D/%s/%s', v_year, lpad(v_seq::text, 6, '0'));

  INSERT INTO public.dostawy(numer_dostawy, data_dostawy, dostawca_id, kraj_id, import_manager_id, status, notes, created_by)
  VALUES (v_numer, p_data_dostawy, p_dostawca_id, NULLIF(p_kraj_id,''), p_import_manager_id, p_status, NULLIF(p_notes,''), auth.uid())
  RETURNING id INTO v_dostawa_id;

  FOR v_pozycja IN SELECT * FROM jsonb_array_elements(p_pozycje)
  LOOP
    IF (v_pozycja->>'produkt_id') IS NULL OR (v_pozycja->>'produkt_id') = '' THEN
      RAISE EXCEPTION 'Pozycja: produkt_id wymagany';
    END IF;
    IF (v_pozycja->>'opakowanie_id') IS NULL OR (v_pozycja->>'opakowanie_id') = '' THEN
      RAISE EXCEPTION 'Pozycja: opakowanie_id wymagany';
    END IF;
    IF coalesce((v_pozycja->>'netto_kg')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Pozycja: netto_kg musi być > 0';
    END IF;
    IF coalesce((v_pozycja->>'cena_zakupu')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Pozycja: cena_zakupu wymagana i >= 0';
    END IF;
    v_waluta := v_pozycja->>'waluta';
    IF v_waluta NOT IN ('PLN','EUR','USD') THEN
      RAISE EXCEPTION 'Pozycja: waluta musi być PLN/EUR/USD';
    END IF;

    v_pos_seq := public.next_yearly_seq('pozycje', v_year);
    v_position_id := format('P/%s/%s', v_year, lpad(v_pos_seq::text, 6, '0'));

    INSERT INTO public.pozycje_dostawy(
      dostawa_id, position_id, produkt_id, odmiana_id, opakowanie_id, kraj_id,
      palety, ilosc_opakowan, netto_kg, brutto_kg, cena_zakupu, waluta, notes
    )
    VALUES (
      v_dostawa_id,
      v_position_id,
      v_pozycja->>'produkt_id',
      NULLIF(v_pozycja->>'odmiana_id',''),
      v_pozycja->>'opakowanie_id',
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

    INSERT INTO public.pozycje(position_id, dostawa_id, pozycja_dostawy_id, stock_status, settlement_status)
    VALUES (v_position_id, v_dostawa_id, v_pozycja_dostawy_id, 'planned', 'not_sold');
  END LOOP;

  RETURN v_dostawa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.utworz_dostawe_z_pozycjami(date, text, text, text, text, text, jsonb) TO authenticated;
