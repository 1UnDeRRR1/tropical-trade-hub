-- Tropical Trade Platform reference schema bootstrap
BEGIN;
CREATE TABLE public."role" (
  "rola_id" text PRIMARY KEY,
  "klucz_roli" text,
  "nazwa_roli_pl" text,
  "opis_pl" text,
  "czy_zarezerwowana" text,
  "liczba_miejsc" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."uzytkownicy" (
  "uzytkownik_id" text PRIMARY KEY,
  "imie_nazwisko" text,
  "email" text,
  "auth_user_id" uuid,
  "rola_id" text,
  "klucz_roli" text,
  "status" text,
  "czy_placeholder" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."uzytkownik_role" (
  "user_role_id" text PRIMARY KEY,
  "uzytkownik_id" text,
  "rola_id" text,
  "klucz_roli" text,
  "status" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."eksport_menedzerowie" (
  "export_manager_id" text PRIMARY KEY,
  "uzytkownik_id" text,
  "imie_nazwisko" text,
  "email" text,
  "rola_id" text,
  "klucz_roli" text,
  "status" text,
  "czy_placeholder" text,
  "zakres_pl" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."produkty" (
  "produkt_id" text PRIMARY KEY,
  "kod_grupy" text,
  "grupa_pl" text,
  "nazwa_pl" text,
  "nazwa_oryginalna_ua" text,
  "nazwa_oryginalna_en" text,
  "status_asortymentu" text,
  "czy_ma_odmiany" text,
  "liczba_odmian" text,
  "priorytet_rynku_pl" text,
  "uwaga_rynkowa_pl" text,
  "aliasy_pl" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."aliasy_produktow" (
  "alias_id" text PRIMARY KEY,
  "produkt_id" text,
  "nazwa_produktu_pl" text,
  "alias" text,
  "alias_znormalizowany" text,
  "typ_aliasu" text,
  "jezyk_hint" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."kraje" (
  "kraj_id" text PRIMARY KEY,
  "iso2" text,
  "iso3" text,
  "nazwa_pl" text,
  "nazwa_oryginalna_en" text,
  "nazwa_oryginalna_ua" text,
  "aliasy_w_jednej_komorce" text,
  "standard" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."aliasy_krajow" (
  "alias_kraju_id" text PRIMARY KEY,
  "kraj_id" text,
  "nazwa_kraju_pl" text,
  "iso2" text,
  "iso3" text,
  "alias" text,
  "alias_znormalizowany" text,
  "typ_aliasu" text,
  "jezyk_hint" text,
  "priorytet_dopasowania" text,
  "czy_niejednoznaczny" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."odmiany" (
  "odmiana_id" text PRIMARY KEY,
  "produkt_id" text,
  "nazwa_produktu_pl" text,
  "odmiana_original" text,
  "odmiana_znormalizowana" text,
  "status" text,
  "czy_uzupelnienie_pl" text,
  "zrodlo_url" text,
  "zrodlo" text,
  "uwagi_pl" text,
  "source_product_variety_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."opakowania" (
  "opakowanie_id" text PRIMARY KEY,
  "wariant_opakowania_pl" text,
  "wariant_opakowania_oryginalny" text,
  "typ_opakowania_pl" text,
  "material_tary" text,
  "material_tary_pewnosc" text,
  "regula_materialu_tary" text,
  "srednia_waga_netto_opakowania_kg" text,
  "srednia_waga_brutto_opakowania_kg" text,
  "srednia_liczba_opakowan_na_palecie" text,
  "liczba_wierszy_standardow" text,
  "zrodlo" text,
  "uwagi_pl" text,
  "zrodlo_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."terminy_opakowan" (
  "termin_id" text PRIMARY KEY,
  "kod_kategorii" text,
  "kategoria_pl" text,
  "poziom_obiektu" text,
  "znaczenie_kanoniczne_pl" text,
  "znaczenie_oryginalne_en" text,
  "aliasy_w_jednej_komorce" text,
  "sugerowane_pole_systemowe" text,
  "oczekiwany_typ_wartosci_pl" text,
  "poziom_niejednoznacznosci_pl" text,
  "regula_kontekstowa_pl" text,
  "przyklad_wzorca" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."aliasy_opakowan" (
  "alias_opakowania_id" text PRIMARY KEY,
  "kod_kategorii" text,
  "kategoria_pl" text,
  "poziom_obiektu" text,
  "znaczenie_kanoniczne_pl" text,
  "alias_lub_skrot" text,
  "alias_znormalizowany" text,
  "sugerowane_pole_systemowe" text,
  "oczekiwany_typ_wartosci_pl" text,
  "poziom_niejednoznacznosci_pl" text,
  "regula_kontekstowa_pl" text,
  "przyklad_wzorca" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."materialy_tary" (
  "material_tary" text PRIMARY KEY,
  "nazwa_pl" text,
  "opis_pl" text,
  "czy_dopuszczalny" text,
  "kolejnosc" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."reguly_materialu_tary" (
  "regula_id" text PRIMARY KEY,
  "material_tary" text,
  "slowa_trigger_pl" text,
  "slowa_trigger_techniczne" text,
  "logika_autouzupelniania_pl" text,
  "przyklady_tary" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."typy_palet" (
  "typ_palety_id" text PRIMARY KEY,
  "typ_palety_pl" text,
  "rozmiar_palety_cm" text,
  "material_palety" text,
  "standard" text,
  "czy_typowe_100x120" text,
  "zrodlo_url" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."standardy_palet" (
  "standard_palety_id" text PRIMARY KEY,
  "produkt_id" text,
  "nazwa_produktu_pl" text,
  "nazwa_produktu_oryginalna_ua" text,
  "kod_grupy" text,
  "grupa_pl" text,
  "kraj_lub_grupa_pochodzenia_pl" text,
  "kraj_lub_grupa_pochodzenia_oryginal_en" text,
  "typ_pochodzenia" text,
  "iso3_kraju" text,
  "region_logistyczny_pl" text,
  "rozmiar_palety_cm" text,
  "typ_palety_pl" text,
  "opakowanie_id" text,
  "wariant_opakowania_pl" text,
  "wariant_opakowania_oryginalny" text,
  "material_tary" text,
  "material_tary_pewnosc" text,
  "liczba_opakowan_na_palecie" text,
  "waga_netto_opakowania_kg" text,
  "waga_brutto_opakowania_kg" text,
  "waga_netto_palety_kg" text,
  "waga_brutto_palety_z_paleta_kg" text,
  "metoda_wyboru_wagi" text,
  "liczba_wierszy_zrodlowych" text,
  "pewnosc_pl" text,
  "status_mapowania" text,
  "zrodlo_url_lub_podstawa" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."opakowania_material_audit" (
  "metryka" text PRIMARY KEY,
  "wartosc" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."standardy_kody" (
  "standard_id" text PRIMARY KEY,
  "obszar" text,
  "kod_standardu" text,
  "nazwa_pl" text,
  "zastosowanie_pl" text,
  "wartosc_kluczowa" text,
  "zrodlo_url" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."notatki_rynkowe" (
  "nota_id" text PRIMARY KEY,
  "obszar" text,
  "temat_pl" text,
  "wniosek_pl" text,
  "produkty_dotyczace" text,
  "zrodlo_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."dostawcy" (
  "dostawca_id" text PRIMARY KEY,
  "nazwa_dostawcy_original" text,
  "alias_dostawcy" text,
  "kod_zrodlowy" text,
  "kraj_id" text,
  "kraj_pl" text,
  "kraj_oryginalny_en" text,
  "kraj_oryginalny_ua" text,
  "status" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."aliasy_dostawcow" (
  "alias_dostawcy_id" text PRIMARY KEY,
  "dostawca_id" text,
  "nazwa_dostawcy_original" text,
  "alias" text,
  "alias_znormalizowany" text,
  "typ_aliasu" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."przypisania_dostawcow" (
  "przypisanie_id" text PRIMARY KEY,
  "dostawca_id" text,
  "nazwa_dostawcy_original" text,
  "uzytkownik_id" text,
  "import_manager" text,
  "email_import_managera" text,
  "zakres" text,
  "status" text,
  "uwagi_pl" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."przewoznicy" (
  "przewoznik_id" text PRIMARY KEY,
  "nazwa_firmy" text,
  "nazwa_firmy_oryginalna" text,
  "kraj_id" text,
  "kraj_nazwa_pl" text,
  "nip_vat" text,
  "eori" text,
  "typ_transportu" text,
  "rodzaj_transportu" text,
  "tryb_temperatury" text,
  "temperatura_min_c" text,
  "temperatura_max_c" text,
  "osoba_kontaktowa" text,
  "email" text,
  "telefon" text,
  "strona_www" text,
  "adres" text,
  "miasto" text,
  "kod_pocztowy" text,
  "status" text,
  "czy_aktywny" text,
  "uwagi_pl" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."klienci_polska" (
  "klient_polska_id" text PRIMARY KEY,
  "nazwa_firmy" text,
  "nip" text,
  "regon" text,
  "typ_klienta" text,
  "osoba_kontaktowa" text,
  "email" text,
  "telefon" text,
  "adres" text,
  "miasto" text,
  "kod_pocztowy" text,
  "wojewodztwo" text,
  "warunki_platnosci" text,
  "waluta" text,
  "przypisany_sales_manager_id" text,
  "status" text,
  "czy_aktywny" text,
  "uwagi_pl" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."klienci_eksportowi" (
  "klient_export_id" text PRIMARY KEY,
  "nazwa_firmy" text,
  "nazwa_firmy_oryginalna" text,
  "kraj_id" text,
  "kraj_nazwa_pl" text,
  "nip_vat" text,
  "eori" text,
  "typ_klienta" text,
  "osoba_kontaktowa" text,
  "email" text,
  "telefon" text,
  "adres" text,
  "miasto" text,
  "kod_pocztowy" text,
  "warunki_platnosci" text,
  "incoterms" text,
  "waluta" text,
  "przypisany_export_manager_id" text,
  "status" text,
  "czy_aktywny" text,
  "uwagi_pl" text,
  "zrodlo" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uzytkownicy_auth_user_id_uq ON public.uzytkownicy(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX uzytkownik_role_user_rola_uq ON public.uzytkownik_role(uzytkownik_id, rola_id);
ALTER TABLE public."uzytkownicy" ADD CONSTRAINT "uzytkownicy_rola_id_fk" FOREIGN KEY ("rola_id") REFERENCES public."role"("rola_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."uzytkownik_role" ADD CONSTRAINT "uzytkownik_role_uzytkownik_id_fk" FOREIGN KEY ("uzytkownik_id") REFERENCES public."uzytkownicy"("uzytkownik_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."uzytkownik_role" ADD CONSTRAINT "uzytkownik_role_rola_id_fk" FOREIGN KEY ("rola_id") REFERENCES public."role"("rola_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."eksport_menedzerowie" ADD CONSTRAINT "eksport_menedzerowie_uzytkownik_id_fk" FOREIGN KEY ("uzytkownik_id") REFERENCES public."uzytkownicy"("uzytkownik_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."eksport_menedzerowie" ADD CONSTRAINT "eksport_menedzerowie_rola_id_fk" FOREIGN KEY ("rola_id") REFERENCES public."role"("rola_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."aliasy_produktow" ADD CONSTRAINT "aliasy_produktow_produkt_id_fk" FOREIGN KEY ("produkt_id") REFERENCES public."produkty"("produkt_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."aliasy_krajow" ADD CONSTRAINT "aliasy_krajow_kraj_id_fk" FOREIGN KEY ("kraj_id") REFERENCES public."kraje"("kraj_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."odmiany" ADD CONSTRAINT "odmiany_produkt_id_fk" FOREIGN KEY ("produkt_id") REFERENCES public."produkty"("produkt_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."dostawcy" ADD CONSTRAINT "dostawcy_kraj_id_fk" FOREIGN KEY ("kraj_id") REFERENCES public."kraje"("kraj_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."aliasy_dostawcow" ADD CONSTRAINT "aliasy_dostawcow_dostawca_id_fk" FOREIGN KEY ("dostawca_id") REFERENCES public."dostawcy"("dostawca_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."przypisania_dostawcow" ADD CONSTRAINT "przypisania_dostawcow_dostawca_id_fk" FOREIGN KEY ("dostawca_id") REFERENCES public."dostawcy"("dostawca_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."przypisania_dostawcow" ADD CONSTRAINT "przypisania_dostawcow_uzytkownik_id_fk" FOREIGN KEY ("uzytkownik_id") REFERENCES public."uzytkownicy"("uzytkownik_id") ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION public.current_uzytkownik_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.uzytkownik_id FROM public.uzytkownicy u
  WHERE u.auth_user_id = auth.uid() AND u.status = 'aktywny'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.my_role_keys()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT ur.klucz_roli), ARRAY[]::text[])
  FROM public.uzytkownik_role ur
  JOIN public.uzytkownicy u ON u.uzytkownik_id = ur.uzytkownik_id
  WHERE u.auth_user_id = auth.uid() AND u.status = 'aktywny' AND ur.status = 'aktywny'
$$;

CREATE OR REPLACE FUNCTION public.has_role(_klucz text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _klucz = ANY(public.my_role_keys())
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_klucze text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM unnest(_klucze) k WHERE k = ANY(public.my_role_keys()))
$$;

CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS TABLE(uzytkownik_id text, imie_nazwisko text, email text, status text, klucze_rol text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.uzytkownik_id, u.imie_nazwisko, u.email, u.status, public.my_role_keys()
  FROM public.uzytkownicy u
  WHERE u.auth_user_id = auth.uid() AND u.status = 'aktywny'
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_uzytkownik_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;

ALTER TABLE public."role" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."role" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."role" TO authenticated;
ALTER TABLE public."uzytkownicy" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."uzytkownicy" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."uzytkownicy" TO authenticated;
ALTER TABLE public."uzytkownik_role" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."uzytkownik_role" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."uzytkownik_role" TO authenticated;
ALTER TABLE public."eksport_menedzerowie" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."eksport_menedzerowie" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."eksport_menedzerowie" TO authenticated;
ALTER TABLE public."produkty" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."produkty" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."produkty" TO authenticated;
ALTER TABLE public."aliasy_produktow" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."aliasy_produktow" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."aliasy_produktow" TO authenticated;
ALTER TABLE public."kraje" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."kraje" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."kraje" TO authenticated;
ALTER TABLE public."aliasy_krajow" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."aliasy_krajow" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."aliasy_krajow" TO authenticated;
ALTER TABLE public."odmiany" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."odmiany" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."odmiany" TO authenticated;
ALTER TABLE public."opakowania" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."opakowania" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."opakowania" TO authenticated;
ALTER TABLE public."terminy_opakowan" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."terminy_opakowan" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."terminy_opakowan" TO authenticated;
ALTER TABLE public."aliasy_opakowan" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."aliasy_opakowan" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."aliasy_opakowan" TO authenticated;
ALTER TABLE public."materialy_tary" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."materialy_tary" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."materialy_tary" TO authenticated;
ALTER TABLE public."reguly_materialu_tary" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."reguly_materialu_tary" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."reguly_materialu_tary" TO authenticated;
ALTER TABLE public."typy_palet" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."typy_palet" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."typy_palet" TO authenticated;
ALTER TABLE public."standardy_palet" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."standardy_palet" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."standardy_palet" TO authenticated;
ALTER TABLE public."opakowania_material_audit" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."opakowania_material_audit" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."opakowania_material_audit" TO authenticated;
ALTER TABLE public."standardy_kody" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."standardy_kody" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."standardy_kody" TO authenticated;
ALTER TABLE public."notatki_rynkowe" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."notatki_rynkowe" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."notatki_rynkowe" TO authenticated;
ALTER TABLE public."dostawcy" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."dostawcy" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."dostawcy" TO authenticated;
ALTER TABLE public."aliasy_dostawcow" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."aliasy_dostawcow" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."aliasy_dostawcow" TO authenticated;
ALTER TABLE public."przypisania_dostawcow" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."przypisania_dostawcow" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."przypisania_dostawcow" TO authenticated;
ALTER TABLE public."przewoznicy" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."przewoznicy" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."przewoznicy" TO authenticated;
ALTER TABLE public."klienci_polska" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."klienci_polska" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."klienci_polska" TO authenticated;
ALTER TABLE public."klienci_eksportowi" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."klienci_eksportowi" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."klienci_eksportowi" TO authenticated;
CREATE POLICY "produkty_select_linked" ON public."produkty" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "produkty_write_super_admin" ON public."produkty" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "aliasy_produktow_select_linked" ON public."aliasy_produktow" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "aliasy_produktow_write_super_admin" ON public."aliasy_produktow" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "kraje_select_linked" ON public."kraje" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "kraje_write_super_admin" ON public."kraje" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "aliasy_krajow_select_linked" ON public."aliasy_krajow" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "aliasy_krajow_write_super_admin" ON public."aliasy_krajow" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "odmiany_select_linked" ON public."odmiany" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "odmiany_write_super_admin" ON public."odmiany" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "opakowania_select_linked" ON public."opakowania" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "opakowania_write_super_admin" ON public."opakowania" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "terminy_opakowan_select_linked" ON public."terminy_opakowan" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "terminy_opakowan_write_super_admin" ON public."terminy_opakowan" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "aliasy_krajow_select_linked2" ON public."aliasy_opakowan" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "aliasy_opakowan_write_super_admin" ON public."aliasy_opakowan" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "materialy_tary_select_linked" ON public."materialy_tary" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "materialy_tary_write_super_admin" ON public."materialy_tary" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "reguly_materialu_tary_select_linked" ON public."reguly_materialu_tary" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "reguly_materialu_tary_write_super_admin" ON public."reguly_materialu_tary" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "typy_palet_select_linked" ON public."typy_palet" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "typy_palet_write_super_admin" ON public."typy_palet" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "standardy_palet_select_linked" ON public."standardy_palet" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "standardy_palet_write_super_admin" ON public."standardy_palet" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "opakowania_material_audit_select_linked" ON public."opakowania_material_audit" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "opakowania_material_audit_write_super_admin" ON public."opakowania_material_audit" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "standardy_kody_select_linked" ON public."standardy_kody" FOR SELECT TO authenticated USING (public.current_uzytkownik_id() IS NOT NULL);
CREATE POLICY "standardy_kody_write_super_admin" ON public."standardy_kody" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "notatki_rynkowe_select_role" ON public."notatki_rynkowe" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','import_manager','sales_manager']::text[]));
CREATE POLICY "notatki_rynkowe_write_super_admin" ON public."notatki_rynkowe" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "dostawcy_select_role" ON public."dostawcy" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','import_manager']::text[]));
CREATE POLICY "dostawcy_write_super_admin" ON public."dostawcy" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "aliasy_dostawcow_select_role" ON public."aliasy_dostawcow" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','import_manager']::text[]));
CREATE POLICY "aliasy_dostawcow_write_super_admin" ON public."aliasy_dostawcow" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "przypisania_dostawcow_select_role" ON public."przypisania_dostawcow" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','import_manager']::text[]));
CREATE POLICY "przypisania_dostawcow_write_super_admin" ON public."przypisania_dostawcow" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "przewoznicy_select_role" ON public."przewoznicy" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','logistyk']::text[]));
CREATE POLICY "przewoznicy_write_super_admin" ON public."przewoznicy" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "klienci_polska_select_role" ON public."klienci_polska" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','sales_manager','fakturowanie']::text[]));
CREATE POLICY "klienci_polska_write_super_admin" ON public."klienci_polska" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "klienci_eksportowi_select_role" ON public."klienci_eksportowi" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','asystent_kierownika','fakturowanie','export_manager']::text[]));
CREATE POLICY "klienci_eksportowi_write_super_admin" ON public."klienci_eksportowi" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "klienci_eksportowi_select_role2" ON public."eksport_menedzerowie" FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['super_admin','kierownik','export_manager']::text[]));
CREATE POLICY "eksport_menedzerowie_write_super_admin" ON public."eksport_menedzerowie" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "role_super_admin_all" ON public."role" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "uzytkownicy_super_admin_all" ON public."uzytkownicy" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE POLICY "uzytkownik_role_super_admin_all" ON public."uzytkownik_role" FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
COMMIT;