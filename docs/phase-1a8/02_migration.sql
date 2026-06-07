-- =====================================================================
-- Phase 1A.8 — 02_migration.sql
-- Creates: seq_numer_sesji, transport_sesje, dostawy.sesja_id,
--          trigger functions, triggers, indexes, GRANTs (no DELETE),
--          ENABLE RLS immediately.
-- One transaction. No CASCADE. No DML.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Sequence used by tt_next_numer_sesji(int)
-- ---------------------------------------------------------------------

CREATE SEQUENCE public.seq_numer_sesji
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

REVOKE ALL ON SEQUENCE public.seq_numer_sesji FROM PUBLIC;
GRANT  USAGE, SELECT, UPDATE ON SEQUENCE public.seq_numer_sesji TO service_role;
-- Authenticated/anon must NOT touch the sequence directly; it is used only
-- inside SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------
-- 2. Trigger helper functions (Phase 1A.8-owned)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tt_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.tt_touch_updated_at() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tt_lock_final_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Once final_transport_cost_eur is set (non-null) and final_locked_at is
  -- recorded, it cannot be changed via direct UPDATE. Setting it from NULL
  -- to a value is allowed and stamps final_locked_at automatically.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.final_transport_cost_eur IS NOT NULL
       AND OLD.final_locked_at IS NOT NULL
       AND NEW.final_transport_cost_eur IS DISTINCT FROM OLD.final_transport_cost_eur THEN
      RAISE EXCEPTION 'transport_sesje.final_transport_cost_eur is locked (sesja_id=%)', OLD.sesja_id;
    END IF;

    IF NEW.final_transport_cost_eur IS NOT NULL
       AND OLD.final_transport_cost_eur IS NULL
       AND NEW.final_locked_at IS NULL THEN
      NEW.final_locked_at := now();
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.final_transport_cost_eur IS NOT NULL AND NEW.final_locked_at IS NULL THEN
      NEW.final_locked_at := now();
    END IF;
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.tt_lock_final_cost() FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 3. public.transport_sesje
-- ---------------------------------------------------------------------

CREATE TABLE public.transport_sesje (
  sesja_id                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  numer_sesji                    text                     NOT NULL,
  numer_auta                     text                     NULL,
  przewoznik_id                  text                     NULL,
  etd                            date                     NULL,
  eta                            date                     NULL,
  preliminary_transport_cost_eur numeric                  NULL,
  final_transport_cost_eur       numeric                  NULL,
  final_locked_at                timestamptz              NULL,
  waluta                         text                     NOT NULL DEFAULT 'EUR',
  status                         text                     NOT NULL DEFAULT 'draft',
  notes                          text                     NULL,
  import_manager_id              text                     NOT NULL,
  created_by                     uuid                     NULL,
  created_at                     timestamptz              NOT NULL DEFAULT now(),
  updated_at                     timestamptz              NOT NULL DEFAULT now(),

  CONSTRAINT transport_sesje_pkey                 PRIMARY KEY (sesja_id),
  CONSTRAINT transport_sesje_numer_sesji_key      UNIQUE (numer_sesji),
  CONSTRAINT transport_sesje_waluta_check         CHECK (waluta = 'EUR'),
  CONSTRAINT transport_sesje_status_check         CHECK (status IN ('draft','planned','in_transit','delivered')),
  CONSTRAINT transport_sesje_preliminary_nonneg   CHECK (preliminary_transport_cost_eur IS NULL OR preliminary_transport_cost_eur >= 0),
  CONSTRAINT transport_sesje_final_nonneg         CHECK (final_transport_cost_eur       IS NULL OR final_transport_cost_eur       >= 0),
  CONSTRAINT transport_sesje_final_locked_consistency
    CHECK (
      (final_transport_cost_eur IS NULL AND final_locked_at IS NULL)
      OR (final_transport_cost_eur IS NOT NULL AND final_locked_at IS NOT NULL)
    ),
  CONSTRAINT transport_sesje_eta_after_etd        CHECK (etd IS NULL OR eta IS NULL OR eta >= etd),

  CONSTRAINT transport_sesje_przewoznik_id_fkey
    FOREIGN KEY (przewoznik_id) REFERENCES public.przewoznicy(przewoznik_id) ON DELETE RESTRICT,
  CONSTRAINT transport_sesje_import_manager_id_fkey
    FOREIGN KEY (import_manager_id) REFERENCES public.uzytkownicy(uzytkownik_id) ON DELETE RESTRICT
);

-- GRANTs (no DELETE for app users)
GRANT SELECT, INSERT, UPDATE ON public.transport_sesje TO authenticated;
GRANT ALL                   ON public.transport_sesje TO service_role;
-- anon: no grants

-- Enable RLS IMMEDIATELY (policies in 05_rls.sql)
ALTER TABLE public.transport_sesje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_sesje FORCE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_transport_sesje_import_manager ON public.transport_sesje(import_manager_id);
CREATE INDEX idx_transport_sesje_przewoznik     ON public.transport_sesje(przewoznik_id);
CREATE INDEX idx_transport_sesje_etd            ON public.transport_sesje(etd);
CREATE INDEX idx_transport_sesje_status         ON public.transport_sesje(status);

-- Triggers
CREATE TRIGGER trg_transport_sesje_touch_updated_at
  BEFORE UPDATE ON public.transport_sesje
  FOR EACH ROW EXECUTE FUNCTION public.tt_touch_updated_at();

CREATE TRIGGER trg_transport_sesje_lock_final_cost
  BEFORE INSERT OR UPDATE ON public.transport_sesje
  FOR EACH ROW EXECUTE FUNCTION public.tt_lock_final_cost();

-- ---------------------------------------------------------------------
-- 4. public.dostawy.sesja_id  (single new column, FK, index)
-- ---------------------------------------------------------------------

ALTER TABLE public.dostawy
  ADD COLUMN sesja_id uuid NULL;

ALTER TABLE public.dostawy
  ADD CONSTRAINT dostawy_sesja_id_fkey
  FOREIGN KEY (sesja_id) REFERENCES public.transport_sesje(sesja_id) ON DELETE SET NULL;

CREATE INDEX idx_dostawy_sesja_id ON public.dostawy(sesja_id);

COMMIT;
