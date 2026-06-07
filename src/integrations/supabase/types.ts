export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aliasy_dostawcow: {
        Row: {
          alias: string | null
          alias_dostawcy_id: string
          alias_znormalizowany: string | null
          created_at: string
          dostawca_id: string | null
          nazwa_dostawcy_original: string | null
          typ_aliasu: string | null
          updated_at: string
          zrodlo: string | null
        }
        Insert: {
          alias?: string | null
          alias_dostawcy_id: string
          alias_znormalizowany?: string | null
          created_at?: string
          dostawca_id?: string | null
          nazwa_dostawcy_original?: string | null
          typ_aliasu?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Update: {
          alias?: string | null
          alias_dostawcy_id?: string
          alias_znormalizowany?: string | null
          created_at?: string
          dostawca_id?: string | null
          nazwa_dostawcy_original?: string | null
          typ_aliasu?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aliasy_dostawcow_dostawca_id_fk"
            columns: ["dostawca_id"]
            isOneToOne: false
            referencedRelation: "dostawcy"
            referencedColumns: ["dostawca_id"]
          },
        ]
      }
      aliasy_krajow: {
        Row: {
          alias: string | null
          alias_kraju_id: string
          alias_znormalizowany: string | null
          created_at: string
          czy_niejednoznaczny: string | null
          iso2: string | null
          iso3: string | null
          jezyk_hint: string | null
          kraj_id: string | null
          nazwa_kraju_pl: string | null
          priorytet_dopasowania: string | null
          typ_aliasu: string | null
          updated_at: string
          zrodlo: string | null
        }
        Insert: {
          alias?: string | null
          alias_kraju_id: string
          alias_znormalizowany?: string | null
          created_at?: string
          czy_niejednoznaczny?: string | null
          iso2?: string | null
          iso3?: string | null
          jezyk_hint?: string | null
          kraj_id?: string | null
          nazwa_kraju_pl?: string | null
          priorytet_dopasowania?: string | null
          typ_aliasu?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Update: {
          alias?: string | null
          alias_kraju_id?: string
          alias_znormalizowany?: string | null
          created_at?: string
          czy_niejednoznaczny?: string | null
          iso2?: string | null
          iso3?: string | null
          jezyk_hint?: string | null
          kraj_id?: string | null
          nazwa_kraju_pl?: string | null
          priorytet_dopasowania?: string | null
          typ_aliasu?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aliasy_krajow_kraj_id_fk"
            columns: ["kraj_id"]
            isOneToOne: false
            referencedRelation: "kraje"
            referencedColumns: ["kraj_id"]
          },
        ]
      }
      aliasy_opakowan: {
        Row: {
          alias_lub_skrot: string | null
          alias_opakowania_id: string
          alias_znormalizowany: string | null
          created_at: string
          kategoria_pl: string | null
          kod_kategorii: string | null
          oczekiwany_typ_wartosci_pl: string | null
          poziom_niejednoznacznosci_pl: string | null
          poziom_obiektu: string | null
          przyklad_wzorca: string | null
          regula_kontekstowa_pl: string | null
          sugerowane_pole_systemowe: string | null
          updated_at: string
          znaczenie_kanoniczne_pl: string | null
          zrodlo: string | null
        }
        Insert: {
          alias_lub_skrot?: string | null
          alias_opakowania_id: string
          alias_znormalizowany?: string | null
          created_at?: string
          kategoria_pl?: string | null
          kod_kategorii?: string | null
          oczekiwany_typ_wartosci_pl?: string | null
          poziom_niejednoznacznosci_pl?: string | null
          poziom_obiektu?: string | null
          przyklad_wzorca?: string | null
          regula_kontekstowa_pl?: string | null
          sugerowane_pole_systemowe?: string | null
          updated_at?: string
          znaczenie_kanoniczne_pl?: string | null
          zrodlo?: string | null
        }
        Update: {
          alias_lub_skrot?: string | null
          alias_opakowania_id?: string
          alias_znormalizowany?: string | null
          created_at?: string
          kategoria_pl?: string | null
          kod_kategorii?: string | null
          oczekiwany_typ_wartosci_pl?: string | null
          poziom_niejednoznacznosci_pl?: string | null
          poziom_obiektu?: string | null
          przyklad_wzorca?: string | null
          regula_kontekstowa_pl?: string | null
          sugerowane_pole_systemowe?: string | null
          updated_at?: string
          znaczenie_kanoniczne_pl?: string | null
          zrodlo?: string | null
        }
        Relationships: []
      }
      aliasy_produktow: {
        Row: {
          alias: string | null
          alias_id: string
          alias_znormalizowany: string | null
          created_at: string
          jezyk_hint: string | null
          nazwa_produktu_pl: string | null
          produkt_id: string | null
          typ_aliasu: string | null
          updated_at: string
          zrodlo: string | null
        }
        Insert: {
          alias?: string | null
          alias_id: string
          alias_znormalizowany?: string | null
          created_at?: string
          jezyk_hint?: string | null
          nazwa_produktu_pl?: string | null
          produkt_id?: string | null
          typ_aliasu?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Update: {
          alias?: string | null
          alias_id?: string
          alias_znormalizowany?: string | null
          created_at?: string
          jezyk_hint?: string | null
          nazwa_produktu_pl?: string | null
          produkt_id?: string | null
          typ_aliasu?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aliasy_produktow_produkt_id_fk"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkty"
            referencedColumns: ["produkt_id"]
          },
        ]
      }
      dostawcy: {
        Row: {
          alias_dostawcy: string | null
          created_at: string
          dostawca_id: string
          kod_zrodlowy: string | null
          kraj_id: string | null
          kraj_oryginalny_en: string | null
          kraj_oryginalny_ua: string | null
          kraj_pl: string | null
          nazwa_dostawcy_original: string | null
          status: string | null
          updated_at: string
          zrodlo: string | null
        }
        Insert: {
          alias_dostawcy?: string | null
          created_at?: string
          dostawca_id: string
          kod_zrodlowy?: string | null
          kraj_id?: string | null
          kraj_oryginalny_en?: string | null
          kraj_oryginalny_ua?: string | null
          kraj_pl?: string | null
          nazwa_dostawcy_original?: string | null
          status?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Update: {
          alias_dostawcy?: string | null
          created_at?: string
          dostawca_id?: string
          kod_zrodlowy?: string | null
          kraj_id?: string | null
          kraj_oryginalny_en?: string | null
          kraj_oryginalny_ua?: string | null
          kraj_pl?: string | null
          nazwa_dostawcy_original?: string | null
          status?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dostawcy_kraj_id_fk"
            columns: ["kraj_id"]
            isOneToOne: false
            referencedRelation: "kraje"
            referencedColumns: ["kraj_id"]
          },
        ]
      }
      dostawy: {
        Row: {
          created_at: string
          created_by: string | null
          data_dostawy: string
          data_zaladunku: string
          dostawca_id: string
          id: string
          import_manager_id: string
          kraj_id: string | null
          notes: string | null
          numer_dostawy: string
          sesja_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_dostawy: string
          data_zaladunku: string
          dostawca_id: string
          id?: string
          import_manager_id: string
          kraj_id?: string | null
          notes?: string | null
          numer_dostawy: string
          sesja_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_dostawy?: string
          data_zaladunku?: string
          dostawca_id?: string
          id?: string
          import_manager_id?: string
          kraj_id?: string | null
          notes?: string | null
          numer_dostawy?: string
          sesja_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dostawy_dostawca_id_fkey"
            columns: ["dostawca_id"]
            isOneToOne: false
            referencedRelation: "dostawcy"
            referencedColumns: ["dostawca_id"]
          },
          {
            foreignKeyName: "dostawy_import_manager_id_fkey"
            columns: ["import_manager_id"]
            isOneToOne: false
            referencedRelation: "uzytkownicy"
            referencedColumns: ["uzytkownik_id"]
          },
          {
            foreignKeyName: "dostawy_kraj_id_fkey"
            columns: ["kraj_id"]
            isOneToOne: false
            referencedRelation: "kraje"
            referencedColumns: ["kraj_id"]
          },
          {
            foreignKeyName: "dostawy_sesja_id_fkey"
            columns: ["sesja_id"]
            isOneToOne: false
            referencedRelation: "transport_sesje"
            referencedColumns: ["sesja_id"]
          },
        ]
      }
      eksport_menedzerowie: {
        Row: {
          created_at: string
          czy_placeholder: string | null
          email: string | null
          export_manager_id: string
          imie_nazwisko: string | null
          klucz_roli: string | null
          rola_id: string | null
          status: string | null
          updated_at: string
          uwagi_pl: string | null
          uzytkownik_id: string | null
          zakres_pl: string | null
        }
        Insert: {
          created_at?: string
          czy_placeholder?: string | null
          email?: string | null
          export_manager_id: string
          imie_nazwisko?: string | null
          klucz_roli?: string | null
          rola_id?: string | null
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          uzytkownik_id?: string | null
          zakres_pl?: string | null
        }
        Update: {
          created_at?: string
          czy_placeholder?: string | null
          email?: string | null
          export_manager_id?: string
          imie_nazwisko?: string | null
          klucz_roli?: string | null
          rola_id?: string | null
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          uzytkownik_id?: string | null
          zakres_pl?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eksport_menedzerowie_rola_id_fk"
            columns: ["rola_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["rola_id"]
          },
          {
            foreignKeyName: "eksport_menedzerowie_uzytkownik_id_fk"
            columns: ["uzytkownik_id"]
            isOneToOne: false
            referencedRelation: "uzytkownicy"
            referencedColumns: ["uzytkownik_id"]
          },
        ]
      }
      klienci_eksportowi: {
        Row: {
          adres: string | null
          created_at: string
          czy_aktywny: string | null
          email: string | null
          eori: string | null
          incoterms: string | null
          klient_export_id: string
          kod_pocztowy: string | null
          kraj_id: string | null
          kraj_nazwa_pl: string | null
          miasto: string | null
          nazwa_firmy: string | null
          nazwa_firmy_oryginalna: string | null
          nip_vat: string | null
          osoba_kontaktowa: string | null
          przypisany_export_manager_id: string | null
          status: string | null
          telefon: string | null
          typ_klienta: string | null
          updated_at: string
          uwagi_pl: string | null
          waluta: string | null
          warunki_platnosci: string | null
          zrodlo: string | null
        }
        Insert: {
          adres?: string | null
          created_at?: string
          czy_aktywny?: string | null
          email?: string | null
          eori?: string | null
          incoterms?: string | null
          klient_export_id: string
          kod_pocztowy?: string | null
          kraj_id?: string | null
          kraj_nazwa_pl?: string | null
          miasto?: string | null
          nazwa_firmy?: string | null
          nazwa_firmy_oryginalna?: string | null
          nip_vat?: string | null
          osoba_kontaktowa?: string | null
          przypisany_export_manager_id?: string | null
          status?: string | null
          telefon?: string | null
          typ_klienta?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          waluta?: string | null
          warunki_platnosci?: string | null
          zrodlo?: string | null
        }
        Update: {
          adres?: string | null
          created_at?: string
          czy_aktywny?: string | null
          email?: string | null
          eori?: string | null
          incoterms?: string | null
          klient_export_id?: string
          kod_pocztowy?: string | null
          kraj_id?: string | null
          kraj_nazwa_pl?: string | null
          miasto?: string | null
          nazwa_firmy?: string | null
          nazwa_firmy_oryginalna?: string | null
          nip_vat?: string | null
          osoba_kontaktowa?: string | null
          przypisany_export_manager_id?: string | null
          status?: string | null
          telefon?: string | null
          typ_klienta?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          waluta?: string | null
          warunki_platnosci?: string | null
          zrodlo?: string | null
        }
        Relationships: []
      }
      klienci_polska: {
        Row: {
          adres: string | null
          created_at: string
          czy_aktywny: string | null
          email: string | null
          klient_polska_id: string
          kod_pocztowy: string | null
          miasto: string | null
          nazwa_firmy: string | null
          nip: string | null
          osoba_kontaktowa: string | null
          przypisany_sales_manager_id: string | null
          regon: string | null
          status: string | null
          telefon: string | null
          typ_klienta: string | null
          updated_at: string
          uwagi_pl: string | null
          waluta: string | null
          warunki_platnosci: string | null
          wojewodztwo: string | null
          zrodlo: string | null
        }
        Insert: {
          adres?: string | null
          created_at?: string
          czy_aktywny?: string | null
          email?: string | null
          klient_polska_id: string
          kod_pocztowy?: string | null
          miasto?: string | null
          nazwa_firmy?: string | null
          nip?: string | null
          osoba_kontaktowa?: string | null
          przypisany_sales_manager_id?: string | null
          regon?: string | null
          status?: string | null
          telefon?: string | null
          typ_klienta?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          waluta?: string | null
          warunki_platnosci?: string | null
          wojewodztwo?: string | null
          zrodlo?: string | null
        }
        Update: {
          adres?: string | null
          created_at?: string
          czy_aktywny?: string | null
          email?: string | null
          klient_polska_id?: string
          kod_pocztowy?: string | null
          miasto?: string | null
          nazwa_firmy?: string | null
          nip?: string | null
          osoba_kontaktowa?: string | null
          przypisany_sales_manager_id?: string | null
          regon?: string | null
          status?: string | null
          telefon?: string | null
          typ_klienta?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          waluta?: string | null
          warunki_platnosci?: string | null
          wojewodztwo?: string | null
          zrodlo?: string | null
        }
        Relationships: []
      }
      kraje: {
        Row: {
          aliasy_w_jednej_komorce: string | null
          created_at: string
          iso2: string | null
          iso3: string | null
          kraj_id: string
          nazwa_oryginalna_en: string | null
          nazwa_oryginalna_ua: string | null
          nazwa_pl: string | null
          standard: string | null
          updated_at: string
          zrodlo: string | null
        }
        Insert: {
          aliasy_w_jednej_komorce?: string | null
          created_at?: string
          iso2?: string | null
          iso3?: string | null
          kraj_id: string
          nazwa_oryginalna_en?: string | null
          nazwa_oryginalna_ua?: string | null
          nazwa_pl?: string | null
          standard?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Update: {
          aliasy_w_jednej_komorce?: string | null
          created_at?: string
          iso2?: string | null
          iso3?: string | null
          kraj_id?: string
          nazwa_oryginalna_en?: string | null
          nazwa_oryginalna_ua?: string | null
          nazwa_pl?: string | null
          standard?: string | null
          updated_at?: string
          zrodlo?: string | null
        }
        Relationships: []
      }
      materialy_tary: {
        Row: {
          created_at: string
          czy_dopuszczalny: string | null
          kolejnosc: string | null
          material_tary: string
          nazwa_pl: string | null
          opis_pl: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          czy_dopuszczalny?: string | null
          kolejnosc?: string | null
          material_tary: string
          nazwa_pl?: string | null
          opis_pl?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          czy_dopuszczalny?: string | null
          kolejnosc?: string | null
          material_tary?: string
          nazwa_pl?: string | null
          opis_pl?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notatki_rynkowe: {
        Row: {
          created_at: string
          nota_id: string
          obszar: string | null
          produkty_dotyczace: string | null
          temat_pl: string | null
          updated_at: string
          wniosek_pl: string | null
          zrodlo_url: string | null
        }
        Insert: {
          created_at?: string
          nota_id: string
          obszar?: string | null
          produkty_dotyczace?: string | null
          temat_pl?: string | null
          updated_at?: string
          wniosek_pl?: string | null
          zrodlo_url?: string | null
        }
        Update: {
          created_at?: string
          nota_id?: string
          obszar?: string | null
          produkty_dotyczace?: string | null
          temat_pl?: string | null
          updated_at?: string
          wniosek_pl?: string | null
          zrodlo_url?: string | null
        }
        Relationships: []
      }
      odmiany: {
        Row: {
          created_at: string
          czy_uzupelnienie_pl: string | null
          nazwa_produktu_pl: string | null
          odmiana_id: string
          odmiana_original: string | null
          odmiana_znormalizowana: string | null
          produkt_id: string | null
          source_product_variety_id: string | null
          status: string | null
          updated_at: string
          uwagi_pl: string | null
          zrodlo: string | null
          zrodlo_url: string | null
        }
        Insert: {
          created_at?: string
          czy_uzupelnienie_pl?: string | null
          nazwa_produktu_pl?: string | null
          odmiana_id: string
          odmiana_original?: string | null
          odmiana_znormalizowana?: string | null
          produkt_id?: string | null
          source_product_variety_id?: string | null
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          zrodlo?: string | null
          zrodlo_url?: string | null
        }
        Update: {
          created_at?: string
          czy_uzupelnienie_pl?: string | null
          nazwa_produktu_pl?: string | null
          odmiana_id?: string
          odmiana_original?: string | null
          odmiana_znormalizowana?: string | null
          produkt_id?: string | null
          source_product_variety_id?: string | null
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          zrodlo?: string | null
          zrodlo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odmiany_produkt_id_fk"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkty"
            referencedColumns: ["produkt_id"]
          },
        ]
      }
      opakowania: {
        Row: {
          created_at: string
          liczba_wierszy_standardow: string | null
          material_tary: string | null
          material_tary_pewnosc: string | null
          opakowanie_id: string
          regula_materialu_tary: string | null
          srednia_liczba_opakowan_na_palecie: string | null
          srednia_waga_brutto_opakowania_kg: string | null
          srednia_waga_netto_opakowania_kg: string | null
          typ_opakowania_pl: string | null
          updated_at: string
          uwagi_pl: string | null
          wariant_opakowania_oryginalny: string | null
          wariant_opakowania_pl: string | null
          zrodlo: string | null
          zrodlo_url: string | null
        }
        Insert: {
          created_at?: string
          liczba_wierszy_standardow?: string | null
          material_tary?: string | null
          material_tary_pewnosc?: string | null
          opakowanie_id: string
          regula_materialu_tary?: string | null
          srednia_liczba_opakowan_na_palecie?: string | null
          srednia_waga_brutto_opakowania_kg?: string | null
          srednia_waga_netto_opakowania_kg?: string | null
          typ_opakowania_pl?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          wariant_opakowania_oryginalny?: string | null
          wariant_opakowania_pl?: string | null
          zrodlo?: string | null
          zrodlo_url?: string | null
        }
        Update: {
          created_at?: string
          liczba_wierszy_standardow?: string | null
          material_tary?: string | null
          material_tary_pewnosc?: string | null
          opakowanie_id?: string
          regula_materialu_tary?: string | null
          srednia_liczba_opakowan_na_palecie?: string | null
          srednia_waga_brutto_opakowania_kg?: string | null
          srednia_waga_netto_opakowania_kg?: string | null
          typ_opakowania_pl?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          wariant_opakowania_oryginalny?: string | null
          wariant_opakowania_pl?: string | null
          zrodlo?: string | null
          zrodlo_url?: string | null
        }
        Relationships: []
      }
      opakowania_material_audit: {
        Row: {
          created_at: string
          metryka: string
          updated_at: string
          uwagi_pl: string | null
          wartosc: string | null
        }
        Insert: {
          created_at?: string
          metryka: string
          updated_at?: string
          uwagi_pl?: string | null
          wartosc?: string | null
        }
        Update: {
          created_at?: string
          metryka?: string
          updated_at?: string
          uwagi_pl?: string | null
          wartosc?: string | null
        }
        Relationships: []
      }
      pozycje: {
        Row: {
          created_at: string
          dostawa_id: string
          id: string
          position_id: string
          pozycja_dostawy_id: string
          settlement_status: string
          stock_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dostawa_id: string
          id?: string
          position_id: string
          pozycja_dostawy_id: string
          settlement_status?: string
          stock_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dostawa_id?: string
          id?: string
          position_id?: string
          pozycja_dostawy_id?: string
          settlement_status?: string
          stock_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pozycje_dostawa_id_fkey"
            columns: ["dostawa_id"]
            isOneToOne: false
            referencedRelation: "dostawy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pozycje_pozycja_dostawy_id_fkey"
            columns: ["pozycja_dostawy_id"]
            isOneToOne: true
            referencedRelation: "pozycje_dostawy"
            referencedColumns: ["id"]
          },
        ]
      }
      pozycje_dostawy: {
        Row: {
          brutto_kg: number | null
          cena_zakupu: number
          created_at: string
          dostawa_id: string
          id: string
          ilosc_opakowan: number | null
          kraj_id: string | null
          material_tary: string
          netto_kg: number
          notes: string | null
          odmiana_id: string | null
          opakowanie_custom_text: string | null
          opakowanie_id: string | null
          opakowanie_source: string
          palety: number
          position_id: string
          produkt_id: string
          updated_at: string
          waluta: string
        }
        Insert: {
          brutto_kg?: number | null
          cena_zakupu: number
          created_at?: string
          dostawa_id: string
          id?: string
          ilosc_opakowan?: number | null
          kraj_id?: string | null
          material_tary: string
          netto_kg: number
          notes?: string | null
          odmiana_id?: string | null
          opakowanie_custom_text?: string | null
          opakowanie_id?: string | null
          opakowanie_source?: string
          palety?: number
          position_id: string
          produkt_id: string
          updated_at?: string
          waluta: string
        }
        Update: {
          brutto_kg?: number | null
          cena_zakupu?: number
          created_at?: string
          dostawa_id?: string
          id?: string
          ilosc_opakowan?: number | null
          kraj_id?: string | null
          material_tary?: string
          netto_kg?: number
          notes?: string | null
          odmiana_id?: string | null
          opakowanie_custom_text?: string | null
          opakowanie_id?: string | null
          opakowanie_source?: string
          palety?: number
          position_id?: string
          produkt_id?: string
          updated_at?: string
          waluta?: string
        }
        Relationships: [
          {
            foreignKeyName: "pozycje_dostawy_dostawa_id_fkey"
            columns: ["dostawa_id"]
            isOneToOne: false
            referencedRelation: "dostawy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pozycje_dostawy_kraj_id_fkey"
            columns: ["kraj_id"]
            isOneToOne: false
            referencedRelation: "kraje"
            referencedColumns: ["kraj_id"]
          },
          {
            foreignKeyName: "pozycje_dostawy_odmiana_id_fkey"
            columns: ["odmiana_id"]
            isOneToOne: false
            referencedRelation: "odmiany"
            referencedColumns: ["odmiana_id"]
          },
          {
            foreignKeyName: "pozycje_dostawy_opakowanie_id_fkey"
            columns: ["opakowanie_id"]
            isOneToOne: false
            referencedRelation: "opakowania"
            referencedColumns: ["opakowanie_id"]
          },
          {
            foreignKeyName: "pozycje_dostawy_produkt_id_fkey"
            columns: ["produkt_id"]
            isOneToOne: false
            referencedRelation: "produkty"
            referencedColumns: ["produkt_id"]
          },
        ]
      }
      produkty: {
        Row: {
          aliasy_pl: string | null
          created_at: string
          czy_ma_odmiany: string | null
          grupa_pl: string | null
          kod_grupy: string | null
          liczba_odmian: string | null
          nazwa_oryginalna_en: string | null
          nazwa_oryginalna_ua: string | null
          nazwa_pl: string | null
          priorytet_rynku_pl: string | null
          produkt_id: string
          status_asortymentu: string | null
          updated_at: string
          uwaga_rynkowa_pl: string | null
          zrodlo: string | null
        }
        Insert: {
          aliasy_pl?: string | null
          created_at?: string
          czy_ma_odmiany?: string | null
          grupa_pl?: string | null
          kod_grupy?: string | null
          liczba_odmian?: string | null
          nazwa_oryginalna_en?: string | null
          nazwa_oryginalna_ua?: string | null
          nazwa_pl?: string | null
          priorytet_rynku_pl?: string | null
          produkt_id: string
          status_asortymentu?: string | null
          updated_at?: string
          uwaga_rynkowa_pl?: string | null
          zrodlo?: string | null
        }
        Update: {
          aliasy_pl?: string | null
          created_at?: string
          czy_ma_odmiany?: string | null
          grupa_pl?: string | null
          kod_grupy?: string | null
          liczba_odmian?: string | null
          nazwa_oryginalna_en?: string | null
          nazwa_oryginalna_ua?: string | null
          nazwa_pl?: string | null
          priorytet_rynku_pl?: string | null
          produkt_id?: string
          status_asortymentu?: string | null
          updated_at?: string
          uwaga_rynkowa_pl?: string | null
          zrodlo?: string | null
        }
        Relationships: []
      }
      przewoznicy: {
        Row: {
          adres: string | null
          created_at: string
          czy_aktywny: string | null
          email: string | null
          eori: string | null
          kod_pocztowy: string | null
          kraj_id: string | null
          kraj_nazwa_pl: string | null
          miasto: string | null
          nazwa_firmy: string | null
          nazwa_firmy_oryginalna: string | null
          nip_vat: string | null
          osoba_kontaktowa: string | null
          przewoznik_id: string
          rodzaj_transportu: string | null
          status: string | null
          strona_www: string | null
          telefon: string | null
          temperatura_max_c: string | null
          temperatura_min_c: string | null
          tryb_temperatury: string | null
          typ_transportu: string | null
          updated_at: string
          uwagi_pl: string | null
          zrodlo: string | null
        }
        Insert: {
          adres?: string | null
          created_at?: string
          czy_aktywny?: string | null
          email?: string | null
          eori?: string | null
          kod_pocztowy?: string | null
          kraj_id?: string | null
          kraj_nazwa_pl?: string | null
          miasto?: string | null
          nazwa_firmy?: string | null
          nazwa_firmy_oryginalna?: string | null
          nip_vat?: string | null
          osoba_kontaktowa?: string | null
          przewoznik_id: string
          rodzaj_transportu?: string | null
          status?: string | null
          strona_www?: string | null
          telefon?: string | null
          temperatura_max_c?: string | null
          temperatura_min_c?: string | null
          tryb_temperatury?: string | null
          typ_transportu?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          zrodlo?: string | null
        }
        Update: {
          adres?: string | null
          created_at?: string
          czy_aktywny?: string | null
          email?: string | null
          eori?: string | null
          kod_pocztowy?: string | null
          kraj_id?: string | null
          kraj_nazwa_pl?: string | null
          miasto?: string | null
          nazwa_firmy?: string | null
          nazwa_firmy_oryginalna?: string | null
          nip_vat?: string | null
          osoba_kontaktowa?: string | null
          przewoznik_id?: string
          rodzaj_transportu?: string | null
          status?: string | null
          strona_www?: string | null
          telefon?: string | null
          temperatura_max_c?: string | null
          temperatura_min_c?: string | null
          tryb_temperatury?: string | null
          typ_transportu?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          zrodlo?: string | null
        }
        Relationships: []
      }
      przypisania_dostawcow: {
        Row: {
          created_at: string
          dostawca_id: string | null
          email_import_managera: string | null
          import_manager: string | null
          nazwa_dostawcy_original: string | null
          przypisanie_id: string
          status: string | null
          updated_at: string
          uwagi_pl: string | null
          uzytkownik_id: string | null
          zakres: string | null
        }
        Insert: {
          created_at?: string
          dostawca_id?: string | null
          email_import_managera?: string | null
          import_manager?: string | null
          nazwa_dostawcy_original?: string | null
          przypisanie_id: string
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          uzytkownik_id?: string | null
          zakres?: string | null
        }
        Update: {
          created_at?: string
          dostawca_id?: string | null
          email_import_managera?: string | null
          import_manager?: string | null
          nazwa_dostawcy_original?: string | null
          przypisanie_id?: string
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          uzytkownik_id?: string | null
          zakres?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "przypisania_dostawcow_dostawca_id_fk"
            columns: ["dostawca_id"]
            isOneToOne: false
            referencedRelation: "dostawcy"
            referencedColumns: ["dostawca_id"]
          },
          {
            foreignKeyName: "przypisania_dostawcow_uzytkownik_id_fk"
            columns: ["uzytkownik_id"]
            isOneToOne: false
            referencedRelation: "uzytkownicy"
            referencedColumns: ["uzytkownik_id"]
          },
        ]
      }
      reguly_materialu_tary: {
        Row: {
          created_at: string
          logika_autouzupelniania_pl: string | null
          material_tary: string | null
          przyklady_tary: string | null
          regula_id: string
          slowa_trigger_pl: string | null
          slowa_trigger_techniczne: string | null
          updated_at: string
          uwagi_pl: string | null
        }
        Insert: {
          created_at?: string
          logika_autouzupelniania_pl?: string | null
          material_tary?: string | null
          przyklady_tary?: string | null
          regula_id: string
          slowa_trigger_pl?: string | null
          slowa_trigger_techniczne?: string | null
          updated_at?: string
          uwagi_pl?: string | null
        }
        Update: {
          created_at?: string
          logika_autouzupelniania_pl?: string | null
          material_tary?: string | null
          przyklady_tary?: string | null
          regula_id?: string
          slowa_trigger_pl?: string | null
          slowa_trigger_techniczne?: string | null
          updated_at?: string
          uwagi_pl?: string | null
        }
        Relationships: []
      }
      role: {
        Row: {
          created_at: string
          czy_zarezerwowana: string | null
          klucz_roli: string | null
          liczba_miejsc: string | null
          nazwa_roli_pl: string | null
          opis_pl: string | null
          rola_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          czy_zarezerwowana?: string | null
          klucz_roli?: string | null
          liczba_miejsc?: string | null
          nazwa_roli_pl?: string | null
          opis_pl?: string | null
          rola_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          czy_zarezerwowana?: string | null
          klucz_roli?: string | null
          liczba_miejsc?: string | null
          nazwa_roli_pl?: string | null
          opis_pl?: string | null
          rola_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      standardy_kody: {
        Row: {
          created_at: string
          kod_standardu: string | null
          nazwa_pl: string | null
          obszar: string | null
          standard_id: string
          updated_at: string
          uwagi_pl: string | null
          wartosc_kluczowa: string | null
          zastosowanie_pl: string | null
          zrodlo_url: string | null
        }
        Insert: {
          created_at?: string
          kod_standardu?: string | null
          nazwa_pl?: string | null
          obszar?: string | null
          standard_id: string
          updated_at?: string
          uwagi_pl?: string | null
          wartosc_kluczowa?: string | null
          zastosowanie_pl?: string | null
          zrodlo_url?: string | null
        }
        Update: {
          created_at?: string
          kod_standardu?: string | null
          nazwa_pl?: string | null
          obszar?: string | null
          standard_id?: string
          updated_at?: string
          uwagi_pl?: string | null
          wartosc_kluczowa?: string | null
          zastosowanie_pl?: string | null
          zrodlo_url?: string | null
        }
        Relationships: []
      }
      standardy_palet: {
        Row: {
          created_at: string
          grupa_pl: string | null
          iso3_kraju: string | null
          kod_grupy: string | null
          kraj_lub_grupa_pochodzenia_oryginal_en: string | null
          kraj_lub_grupa_pochodzenia_pl: string | null
          liczba_opakowan_na_palecie: string | null
          liczba_wierszy_zrodlowych: string | null
          material_tary: string | null
          material_tary_pewnosc: string | null
          metoda_wyboru_wagi: string | null
          nazwa_produktu_oryginalna_ua: string | null
          nazwa_produktu_pl: string | null
          opakowanie_id: string | null
          pewnosc_pl: string | null
          produkt_id: string | null
          region_logistyczny_pl: string | null
          rozmiar_palety_cm: string | null
          standard_palety_id: string
          status_mapowania: string | null
          typ_palety_pl: string | null
          typ_pochodzenia: string | null
          updated_at: string
          uwagi_pl: string | null
          waga_brutto_opakowania_kg: string | null
          waga_brutto_palety_z_paleta_kg: string | null
          waga_netto_opakowania_kg: string | null
          waga_netto_palety_kg: string | null
          wariant_opakowania_oryginalny: string | null
          wariant_opakowania_pl: string | null
          zrodlo_url_lub_podstawa: string | null
        }
        Insert: {
          created_at?: string
          grupa_pl?: string | null
          iso3_kraju?: string | null
          kod_grupy?: string | null
          kraj_lub_grupa_pochodzenia_oryginal_en?: string | null
          kraj_lub_grupa_pochodzenia_pl?: string | null
          liczba_opakowan_na_palecie?: string | null
          liczba_wierszy_zrodlowych?: string | null
          material_tary?: string | null
          material_tary_pewnosc?: string | null
          metoda_wyboru_wagi?: string | null
          nazwa_produktu_oryginalna_ua?: string | null
          nazwa_produktu_pl?: string | null
          opakowanie_id?: string | null
          pewnosc_pl?: string | null
          produkt_id?: string | null
          region_logistyczny_pl?: string | null
          rozmiar_palety_cm?: string | null
          standard_palety_id: string
          status_mapowania?: string | null
          typ_palety_pl?: string | null
          typ_pochodzenia?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          waga_brutto_opakowania_kg?: string | null
          waga_brutto_palety_z_paleta_kg?: string | null
          waga_netto_opakowania_kg?: string | null
          waga_netto_palety_kg?: string | null
          wariant_opakowania_oryginalny?: string | null
          wariant_opakowania_pl?: string | null
          zrodlo_url_lub_podstawa?: string | null
        }
        Update: {
          created_at?: string
          grupa_pl?: string | null
          iso3_kraju?: string | null
          kod_grupy?: string | null
          kraj_lub_grupa_pochodzenia_oryginal_en?: string | null
          kraj_lub_grupa_pochodzenia_pl?: string | null
          liczba_opakowan_na_palecie?: string | null
          liczba_wierszy_zrodlowych?: string | null
          material_tary?: string | null
          material_tary_pewnosc?: string | null
          metoda_wyboru_wagi?: string | null
          nazwa_produktu_oryginalna_ua?: string | null
          nazwa_produktu_pl?: string | null
          opakowanie_id?: string | null
          pewnosc_pl?: string | null
          produkt_id?: string | null
          region_logistyczny_pl?: string | null
          rozmiar_palety_cm?: string | null
          standard_palety_id?: string
          status_mapowania?: string | null
          typ_palety_pl?: string | null
          typ_pochodzenia?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          waga_brutto_opakowania_kg?: string | null
          waga_brutto_palety_z_paleta_kg?: string | null
          waga_netto_opakowania_kg?: string | null
          waga_netto_palety_kg?: string | null
          wariant_opakowania_oryginalny?: string | null
          wariant_opakowania_pl?: string | null
          zrodlo_url_lub_podstawa?: string | null
        }
        Relationships: []
      }
      terminy_opakowan: {
        Row: {
          aliasy_w_jednej_komorce: string | null
          created_at: string
          kategoria_pl: string | null
          kod_kategorii: string | null
          oczekiwany_typ_wartosci_pl: string | null
          poziom_niejednoznacznosci_pl: string | null
          poziom_obiektu: string | null
          przyklad_wzorca: string | null
          regula_kontekstowa_pl: string | null
          sugerowane_pole_systemowe: string | null
          termin_id: string
          updated_at: string
          znaczenie_kanoniczne_pl: string | null
          znaczenie_oryginalne_en: string | null
          zrodlo: string | null
        }
        Insert: {
          aliasy_w_jednej_komorce?: string | null
          created_at?: string
          kategoria_pl?: string | null
          kod_kategorii?: string | null
          oczekiwany_typ_wartosci_pl?: string | null
          poziom_niejednoznacznosci_pl?: string | null
          poziom_obiektu?: string | null
          przyklad_wzorca?: string | null
          regula_kontekstowa_pl?: string | null
          sugerowane_pole_systemowe?: string | null
          termin_id: string
          updated_at?: string
          znaczenie_kanoniczne_pl?: string | null
          znaczenie_oryginalne_en?: string | null
          zrodlo?: string | null
        }
        Update: {
          aliasy_w_jednej_komorce?: string | null
          created_at?: string
          kategoria_pl?: string | null
          kod_kategorii?: string | null
          oczekiwany_typ_wartosci_pl?: string | null
          poziom_niejednoznacznosci_pl?: string | null
          poziom_obiektu?: string | null
          przyklad_wzorca?: string | null
          regula_kontekstowa_pl?: string | null
          sugerowane_pole_systemowe?: string | null
          termin_id?: string
          updated_at?: string
          znaczenie_kanoniczne_pl?: string | null
          znaczenie_oryginalne_en?: string | null
          zrodlo?: string | null
        }
        Relationships: []
      }
      transport_sesje: {
        Row: {
          created_at: string
          created_by: string | null
          eta: string | null
          etd: string | null
          final_locked_at: string | null
          final_transport_cost_eur: number | null
          import_manager_id: string
          notes: string | null
          numer_auta: string | null
          numer_sesji: string
          preliminary_transport_cost_eur: number | null
          przewoznik_id: string | null
          sesja_id: string
          status: string
          updated_at: string
          waluta: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eta?: string | null
          etd?: string | null
          final_locked_at?: string | null
          final_transport_cost_eur?: number | null
          import_manager_id: string
          notes?: string | null
          numer_auta?: string | null
          numer_sesji: string
          preliminary_transport_cost_eur?: number | null
          przewoznik_id?: string | null
          sesja_id?: string
          status?: string
          updated_at?: string
          waluta?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eta?: string | null
          etd?: string | null
          final_locked_at?: string | null
          final_transport_cost_eur?: number | null
          import_manager_id?: string
          notes?: string | null
          numer_auta?: string | null
          numer_sesji?: string
          preliminary_transport_cost_eur?: number | null
          przewoznik_id?: string | null
          sesja_id?: string
          status?: string
          updated_at?: string
          waluta?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_sesje_import_manager_id_fkey"
            columns: ["import_manager_id"]
            isOneToOne: false
            referencedRelation: "uzytkownicy"
            referencedColumns: ["uzytkownik_id"]
          },
          {
            foreignKeyName: "transport_sesje_przewoznik_id_fkey"
            columns: ["przewoznik_id"]
            isOneToOne: false
            referencedRelation: "przewoznicy"
            referencedColumns: ["przewoznik_id"]
          },
        ]
      }
      typy_palet: {
        Row: {
          created_at: string
          czy_typowe_100x120: string | null
          material_palety: string | null
          rozmiar_palety_cm: string | null
          standard: string | null
          typ_palety_id: string
          typ_palety_pl: string | null
          updated_at: string
          uwagi_pl: string | null
          zrodlo_url: string | null
        }
        Insert: {
          created_at?: string
          czy_typowe_100x120?: string | null
          material_palety?: string | null
          rozmiar_palety_cm?: string | null
          standard?: string | null
          typ_palety_id: string
          typ_palety_pl?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          zrodlo_url?: string | null
        }
        Update: {
          created_at?: string
          czy_typowe_100x120?: string | null
          material_palety?: string | null
          rozmiar_palety_cm?: string | null
          standard?: string | null
          typ_palety_id?: string
          typ_palety_pl?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          zrodlo_url?: string | null
        }
        Relationships: []
      }
      uzytkownicy: {
        Row: {
          auth_user_id: string | null
          created_at: string
          czy_placeholder: string | null
          email: string | null
          imie_nazwisko: string | null
          klucz_roli: string | null
          rola_id: string | null
          status: string | null
          updated_at: string
          uwagi_pl: string | null
          uzytkownik_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          czy_placeholder?: string | null
          email?: string | null
          imie_nazwisko?: string | null
          klucz_roli?: string | null
          rola_id?: string | null
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          uzytkownik_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          czy_placeholder?: string | null
          email?: string | null
          imie_nazwisko?: string | null
          klucz_roli?: string | null
          rola_id?: string | null
          status?: string | null
          updated_at?: string
          uwagi_pl?: string | null
          uzytkownik_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uzytkownicy_rola_id_fk"
            columns: ["rola_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["rola_id"]
          },
        ]
      }
      uzytkownik_role: {
        Row: {
          created_at: string
          klucz_roli: string | null
          rola_id: string | null
          status: string | null
          updated_at: string
          user_role_id: string
          uzytkownik_id: string | null
          zrodlo: string | null
        }
        Insert: {
          created_at?: string
          klucz_roli?: string | null
          rola_id?: string | null
          status?: string | null
          updated_at?: string
          user_role_id: string
          uzytkownik_id?: string | null
          zrodlo?: string | null
        }
        Update: {
          created_at?: string
          klucz_roli?: string | null
          rola_id?: string | null
          status?: string | null
          updated_at?: string
          user_role_id?: string
          uzytkownik_id?: string | null
          zrodlo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uzytkownik_role_rola_id_fk"
            columns: ["rola_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["rola_id"]
          },
          {
            foreignKeyName: "uzytkownik_role_uzytkownik_id_fk"
            columns: ["uzytkownik_id"]
            isOneToOne: false
            referencedRelation: "uzytkownicy"
            referencedColumns: ["uzytkownik_id"]
          },
        ]
      }
    }
    Views: {
      v_koszt_wlasny_pozycji: {
        Row: {
          brutto_kg: number | null
          cena_zakupu: number | null
          dostawa_id: string | null
          final_transport_cost_eur: number | null
          koszt_wlasny_1kg: number | null
          netto_kg: number | null
          numer_sesji: string | null
          palety: number | null
          position_id: string | null
          pozycja_dostawy_id: string | null
          preliminary_transport_cost_eur: number | null
          sesja_id: string | null
          total_brutto_session: number | null
          transport_cost_auto: number | null
          transport_per_net_kg: number | null
          transport_share_position: number | null
          waluta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dostawy_sesja_id_fkey"
            columns: ["sesja_id"]
            isOneToOne: false
            referencedRelation: "transport_sesje"
            referencedColumns: ["sesja_id"]
          },
          {
            foreignKeyName: "pozycje_dostawy_dostawa_id_fkey"
            columns: ["dostawa_id"]
            isOneToOne: false
            referencedRelation: "dostawy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pozycje_pozycja_dostawy_id_fkey"
            columns: ["pozycja_dostawy_id"]
            isOneToOne: true
            referencedRelation: "pozycje_dostawy"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _gen_business_numer: {
        Args: { _dostawca_id: string; _kraj_id: string }
        Returns: string
      }
      _kraj_iso3: { Args: { _kraj_id: string }; Returns: string }
      _supplier_code: { Args: { _dostawca_id: string }; Returns: string }
      aktualizuj_dostawe_z_pozycjami: {
        Args: {
          p_data_dostawy: string
          p_data_zaladunku: string
          p_dostawa_id: string
          p_dostawca_id: string
          p_import_manager_id: string
          p_kraj_id: string
          p_notes: string
          p_pozycje: Json
          p_status: string
        }
        Returns: string
      }
      current_uzytkownik_id: { Args: never; Returns: string }
      has_any_role: { Args: { _klucze: string[] }; Returns: boolean }
      has_role: { Args: { _klucz: string }; Returns: boolean }
      my_profile: {
        Args: never
        Returns: {
          email: string
          imie_nazwisko: string
          klucze_rol: string[]
          status: string
          uzytkownik_id: string
        }[]
      }
      my_role_keys: { Args: never; Returns: string[] }
      next_yearly_seq: {
        Args: { _prefix: string; _year: number }
        Returns: number
      }
      tt_next_numer_sesji: { Args: { p_year: number }; Returns: string }
      ustaw_wstepny_koszt_transportu: {
        Args: { p_koszt: number; p_sesja_id: string }
        Returns: Json
      }
      utworz_dostawe_z_pozycjami: {
        Args: {
          p_data_dostawy: string
          p_data_zaladunku?: string
          p_dostawca_id: string
          p_import_manager_id: string
          p_kraj_id: string
          p_notes: string
          p_pozycje: Json
          p_status: string
        }
        Returns: string
      }
      utworz_sesje_z_dostawami: {
        Args: { p_dostawy: Json; p_sesja: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
