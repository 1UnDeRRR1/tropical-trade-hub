REVOKE ALL ON public.transport_sesje FROM PUBLIC;
REVOKE ALL ON public.transport_sesje FROM anon;
REVOKE ALL ON public.transport_sesje FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transport_sesje TO authenticated;
GRANT ALL ON public.transport_sesje TO service_role;