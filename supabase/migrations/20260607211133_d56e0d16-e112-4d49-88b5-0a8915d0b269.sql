CREATE POLICY uzytkownicy_select_active_import_managers
ON public.uzytkownicy
FOR SELECT
TO authenticated
USING (
  klucz_roli = 'import_manager'
  AND status = 'aktywny'
  AND public.has_any_role(ARRAY[
    'super_admin',
    'kierownik',
    'asystent_kierownika',
    'import_manager'
  ])
);