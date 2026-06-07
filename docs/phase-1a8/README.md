# Phase 1A.8 — Transport Session Foundation (Reviewable Artifact)

**Status:** REVIEW ONLY. NOT APPLIED. No `supabase/migrations/*.sql` file created.
No SQL has been executed against the database from this artifact.

## Purpose

Phase 1A.8 introduces the database foundation for transport sessions:

- `public.transport_sesje` — one row per physical transport (auto/session)
- `public.dostawy.sesja_id` — links N dostawy to one session
- RPCs to create a session together with N dostawy and to set the preliminary
  transport cost
- View `public.v_koszt_wlasny_pozycji` — per-position own cost in EUR
  (purchase + transport share + 0.02 fixed addition)
- RLS aligned with current role keys

This artifact replaces the drifted Phase 1A that was rolled back. The schema,
RPC signatures, role keys and column names below are the **target model** and
must be applied byte-for-byte.

## Files (apply order)

| # | File | Purpose | Mutates DB? |
|---|------|---------|-------------|
| 1 | `01_preflight.sql`    | Pre-apply guards: required absent / required present | No (read-only, raises) |
| 2 | `02_migration.sql`    | Sequence, `transport_sesje`, `dostawy.sesja_id`, trigger fns, RLS ENABLE | Yes |
| 3 | `03_rpc.sql`          | `tt_next_numer_sesji`, `utworz_sesje_z_dostawami`, `ustaw_wstepny_koszt_transportu` | Yes |
| 4 | `04_cost_view.sql`    | `v_koszt_wlasny_pozycji` with SQL-level role guard | Yes |
| 5 | `05_rls.sql`          | Policies on `transport_sesje` (no DELETE, no FOR ALL) | Yes |
| 6 | `06_verification.sql` | Object-by-object verification, no shortcuts | No (read-only, raises) |
| 7 | `07_rollback.sql`     | Exact inverse of 02–05, no CASCADE | Yes (only if instructed) |

## Apply protocol

1. Run `01_preflight.sql`. If it raises, **STOP** — do not proceed.
2. With explicit owner approval, run `02_migration.sql` → `03_rpc.sql` →
   `04_cost_view.sql` → `05_rls.sql`, in that order, as separate transactions.
3. Run `06_verification.sql`. If any check raises, **STOP** and run
   `07_rollback.sql`.
4. `07_rollback.sql` runs only if explicitly instructed.

### Process rule (non-negotiable)

Approved files are applied **byte-for-byte**. No rewriting "by meaning". If
any change is needed during apply (column rename, signature change, missing
role, etc.), **STOP and submit a REVISION REQUEST** — do not improvise.

## Role keys (current project)

Only these are valid:

- `super_admin`
- `kierownik`
- `asystent_kierownika`
- `import_manager`
- `logistyk`

Use existing helpers: `public.has_role(text)`, `public.has_any_role(text[])`,
`public.current_uzytkownik_id()`, `public.my_role_keys()`.

## Target model — `public.transport_sesje`

| Column | Type | Notes |
|---|---|---|
| `sesja_id` | uuid PK | `default gen_random_uuid()` |
| `numer_sesji` | text NOT NULL UNIQUE | from `tt_next_numer_sesji(year)` |
| `numer_auta` | text NULL | |
| `przewoznik_id` | text NULL | FK `przewoznicy(przewoznik_id)` |
| `etd` | date NULL | |
| `eta` | date NULL | |
| `preliminary_transport_cost_eur` | numeric NULL | EUR only |
| `final_transport_cost_eur` | numeric NULL | EUR only |
| `final_locked_at` | timestamptz NULL | set when final cost locked |
| `waluta` | text NOT NULL DEFAULT `'EUR'` | EUR only in Phase 1A |
| `status` | text NOT NULL DEFAULT `'draft'` | `'draft' | 'planned' | 'in_transit' | 'delivered'` |
| `notes` | text NULL | |
| `import_manager_id` | text NOT NULL | FK `uzytkownicy(uzytkownik_id)` |
| `created_by` | uuid NULL | `auth.uid()` at creation |
| `created_at` | timestamptz NOT NULL DEFAULT `now()` | |
| `updated_at` | timestamptz NOT NULL DEFAULT `now()` | maintained by `tt_touch_updated_at` |

`dostawy` gains a single column: `sesja_id uuid NULL`,
FK → `transport_sesje(sesja_id)` `ON DELETE SET NULL`, with index
`idx_dostawy_sesja_id`.

## Cost formula (Phase 1A)

```
transport_cost_auto       = COALESCE(final_transport_cost_eur, preliminary_transport_cost_eur)
transport_share_position  = transport_cost_auto * (brutto_position / total_brutto_session)
transport_per_net_kg      = transport_share_position / netto_position
koszt_wlasny_1kg          = cena_zakupu + transport_per_net_kg + 0.02
```

Rules:

- If `transport_cost_auto IS NULL` → `koszt_wlasny_1kg IS NULL` (no 0 fallback).
- EUR only. If any pozycja in the session has `waluta <> 'EUR'`, that
  pozycja's `koszt_wlasny_1kg` is NULL.
- No FX, no customs, no pallet allocation, no supplier allocation in Phase 1A.

## Session capacity guards

`utworz_sesje_z_dostawami` rejects with `RAISE EXCEPTION` when:

- `SUM(pozycje_dostawy.palety) > 26`
- `SUM(pozycje_dostawy.brutto_kg) > 21500`

## Grants policy

- No DELETE granted on `public.transport_sesje` to `authenticated`, `anon`,
  or `PUBLIC`. Only `service_role` has full access.
- No DELETE policy. No `FOR ALL` policy.
- Public RPCs (`utworz_sesje_z_dostawami`, `ustaw_wstepny_koszt_transportu`):
  REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated.
- Internal helper `tt_next_numer_sesji(int)`: REVOKE ALL FROM PUBLIC, anon,
  authenticated. Used only inside SECURITY DEFINER RPCs.

## Cost view access (SQL-level guard)

`v_koszt_wlasny_pozycji` returns rows only when the caller is one of
`super_admin`, `kierownik`, `asystent_kierownika`. `import_manager` and
`logistyk` receive 0 rows in Phase 1A. The guard lives in the view body
(not the frontend) to keep denominators correct under RLS. An
import-manager preview will arrive in Phase 1B/1C via a SECURITY DEFINER RPC.

## Out of scope

- No frontend changes
- No seed changes
- No auth / users / roles changes
- No `position_id` lifecycle changes
- No `supabase/migrations/*.sql` file
- No storage bucket, no transport documents, no supplier balance, no
  transport balance, no payments
- No Phase 1B, no Phase 1C, no UI

## Deliverable

This `docs/phase-1a8/` folder is the deliverable. Owner inspects the SQL
files in the repo before any apply.
