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

## Business access model (owner-confirmed)

`import_manager` is the **operational owner** of the Dostawy / transport
session workflow. The model is intentionally broad on the import_manager
side and only restricts system/structural fields and unrelated data.

`import_manager` CAN, for own data:

- create own transport session and own dostawy
- edit own dostawy while operationally open
- add/edit/remove own pozycje while operationally open
- set and see purchase price (`cena_zakupu`)
- see transport cost (preliminary and final) for own session
- set `preliminary_transport_cost_eur` for own session
- set `final_transport_cost_eur` for own session when the workflow requires
  (logistyk will also be able to set it in Phase 1C; the two roles cooperate)
- in Phase 1B/1C: see koszt własny for own positions via a SECURITY DEFINER
  RPC, and see supplier balance for own suppliers

`import_manager` MUST NOT:

- change system/internal identifiers (`sesja_id`, `numer_sesji`,
  `import_manager_id`, `created_by`, `created_at`)
- reassign a session to another import_manager
- delete a transport session as a DB object
- access sales / client money / margin / client balances
- access another import_manager's purchase details

Role split is intentionally **simple**, not finely sliced:

- `import_manager` — own buying / transport / session data
- `logistyk` — transport operation and final transport data
- `asystent_kierownika` — payments / balances (Phase 1B+)
- `kierownik` / `super_admin` — full business oversight
- sales / client money — outside `import_manager` scope

Transport cost is **not** secret from `import_manager`. The Phase 1A
restriction on `v_koszt_wlasny_pozycji` (see §"Cost view access") is a
denominator-correctness concern under RLS, not a confidentiality concern.

## Files (apply order)

| # | File | Purpose | Mutates DB? |
|---|------|---------|-------------|
| 1 | `01_preflight.sql`    | Pre-apply guards: required absent / required present | No (read-only, raises) |
| 2 | `02_migration.sql`    | Sequence, `transport_sesje`, `dostawy.sesja_id`, trigger fns (incl. invariants), RLS ENABLE | Yes |
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
| `numer_auta` | text NULL | editable by owner / staff |
| `przewoznik_id` | text NULL | FK `przewoznicy(przewoznik_id)`; editable |
| `etd` | date NULL | editable |
| `eta` | date NULL | editable |
| `preliminary_transport_cost_eur` | numeric NULL | EUR only; editable by owner / staff |
| `final_transport_cost_eur` | numeric NULL | EUR only; settable by owner / logistyk / staff |
| `final_locked_at` | timestamptz NULL | stamped when final cost first set; further change blocked by `tt_lock_final_cost` |
| `waluta` | text NOT NULL DEFAULT `'EUR'` | EUR only in Phase 1A |
| `status` | text NOT NULL DEFAULT `'draft'` | `'draft' \| 'planned' \| 'in_transit' \| 'delivered'` |
| `notes` | text NULL | editable |
| `import_manager_id` | text NOT NULL | FK `uzytkownicy(uzytkownik_id)`; **immutable after insert** (see invariants) |
| `created_by` | uuid NULL | `auth.uid()` at creation; immutable |
| `created_at` | timestamptz NOT NULL DEFAULT `now()` | immutable |
| `updated_at` | timestamptz NOT NULL DEFAULT `now()` | maintained by `tt_touch_updated_at` |

`dostawy` gains a single column: `sesja_id uuid NULL`,
FK → `transport_sesje(sesja_id)` `ON DELETE SET NULL`, with index
`idx_dostawy_sesja_id`.

### Write model & invariants

`import_manager` creates a transport session **only through the RPC**
`utworz_sesje_z_dostawami(p_sesja, p_dostawy)`. Direct `INSERT` into
`public.transport_sesje` is not granted to `import_manager` — an empty/orphan
session would bypass the complete workflow (N dostawy, numer_dostawy,
capacity check, EUR validation, linked totals).

Direct `UPDATE` of own session is allowed for operational business fields
(`numer_auta`, `przewoznik_id`, `etd`, `eta`, `preliminary_transport_cost_eur`,
`final_transport_cost_eur` first set only, `notes`, `status`).
Structural / system fields are protected at the DB level by trigger
`tt_transport_sesje_protect_invariants` (BEFORE UPDATE) so that direct
`UPDATE` cannot change any of:

- `sesja_id`
- `numer_sesji`
- `import_manager_id`
- `created_by`
- `created_at`
- `waluta` (EUR-only in Phase 1A)
- `final_locked_at` (system-managed; only stamped automatically by
  `tt_lock_final_cost` when `final_transport_cost_eur` goes from NULL to a
  value)

The protection trigger applies to ALL non-`service_role` callers (import_manager,
logistyk, staff). Operational corrections that need to bypass it use
`service_role` explicitly.

Fields `import_manager` (and staff) MAY change directly on own session
(subject to RLS): `numer_auta`, `przewoznik_id`, `etd`, `eta`,
`preliminary_transport_cost_eur`, `final_transport_cost_eur` (first set
only — locked thereafter by `tt_lock_final_cost`), `notes`, `status`
(within `'draft' | 'planned' | 'in_transit' | 'delivered'`).

No DELETE is granted to `authenticated` or `anon`. No `FOR ALL` policy.

## Cost formula (Phase 1A)

```
transport_cost_auto       = COALESCE(final_transport_cost_eur, preliminary_transport_cost_eur)
transport_share_position  = transport_cost_auto * (brutto_position / total_brutto_session)
transport_per_net_kg      = transport_share_position / netto_position
koszt_wlasny_1kg          = cena_zakupu + transport_per_net_kg + 0.02
```

Rules:

- If `transport_cost_auto IS NULL` → `koszt_wlasny_1kg IS NULL` (no 0 fallback).
- EUR only. If any pozycja has `waluta <> 'EUR'`, its `koszt_wlasny_1kg` is NULL.
- No FX, no customs, no pallet allocation, no supplier allocation in Phase 1A.

## Session capacity guards

`utworz_sesje_z_dostawami` rejects with `RAISE EXCEPTION` when:

- `SUM(pozycje_dostawy.palety) > 26`
- `SUM(pozycje_dostawy.brutto_kg) > 21500`

The authoritative capacity check is performed **after** all dostawy are
created and linked to `sesja_id`, by aggregating the persisted
`public.pozycje_dostawy` rows (joined on `dostawy.sesja_id = v_sesja_id`).
The input-JSON pre-check is a fast-fail guard only; the final, binding
totals come from what was actually written by
`utworz_dostawe_z_pozycjami`. The RPC returns these DB-derived totals as
`total_palety` and `total_brutto_kg`.

## Cost rule for `import_manager` at creation (Option A)

`utworz_sesje_z_dostawami` accepts both `preliminary_transport_cost_eur`
and `final_transport_cost_eur` in `p_sesja`. Both, if present, must be
`>= 0`. For an `import_manager`-owned creation, **at least one** of
`preliminary > 0` or `final > 0` is required (final does not "fake"
preliminary; if final is set at creation it is recorded as-is and
`final_locked_at` is stamped by `tt_lock_final_cost`).
`super_admin` / `kierownik` / `asystent_kierownika` may create a session
with neither value (back-office case).

## Grants policy

- No DELETE granted on `public.transport_sesje` to `authenticated`, `anon`,
  or `PUBLIC`. Only `service_role` has full access.
- No DELETE policy. No `FOR ALL` policy.
- Public RPCs (`utworz_sesje_z_dostawami`, `ustaw_wstepny_koszt_transportu`):
  REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated.
- Internal helper `tt_next_numer_sesji(int)`: REVOKE ALL FROM PUBLIC, anon,
  authenticated. Used only inside SECURITY DEFINER RPCs.

## Cost view access (SQL-level guard) — rationale

`v_koszt_wlasny_pozycji` returns rows only when the caller is one of
`super_admin`, `kierownik`, `asystent_kierownika`. `import_manager` and
`logistyk` receive 0 rows from this view in Phase 1A.

This is **not** a confidentiality restriction (transport cost is not secret
from import_manager). It is a **denominator-correctness** restriction: the
view computes `total_brutto_session` across the full session and any RLS
filter applied through this view would skew the denominator. Phase 1B/1C
will expose a `SECURITY DEFINER` RPC that computes `total_brutto_session`
across the full session and returns only the caller's own positions — that
is the supported import_manager preview path.

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
