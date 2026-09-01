# M2-SB-01 `practice_round_results` Implementation Plan

> **For agentic workers:** small SQL-only change. Execute inline (author has full context from the spec) or via superpowers:subagent-driven-development as one task. Steps use checkbox syntax.

**Goal:** Add the `public.practice_round_results` Postgres table (CPU practice round results: mode / player count / winner / duration), its minimal RLS (anon `select`+`insert` only), and pgTAP coverage.

**Architecture:** One additive migration in `supabase/migrations/`, two pgTAP test files in `supabase/tests/`, following the existing card-master pattern (`20260828140000_separate_master_read_and_write_access.sql`, `master_access.sql`). Verified against the running local Supabase.

**Tech Stack:** Postgres 17, Supabase CLI, pgTAP.

## Global Constraints

- Additive only: new migration file `<UTC ts>_create_practice_round_results.sql` (timestamp after the current max `20260829090000`); do not edit existing migrations.
- `extensions.gen_random_uuid()` (pgcrypto already created in `extensions` schema by `20260828130000_create_card_masters.sql`).
- Access pattern: `revoke all from public, anon, authenticated` → `grant select, insert` to `anon, authenticated` → `grant all` to `service_role` → `enable row level security` → `create policy` for `insert` and `select` only (no update/delete policy).
- No secrets committed. No display strings / resource keys / hand contents in the table.
- pgTAP files: `begin; select plan(N); ...; select * from finish(); rollback;` — same shape as `supabase/tests/master_access.sql`.
- All existing DB tests must still pass.

**Authoritative detail:** `docs/superpowers/specs/2026-09-01-m2-practice-round-results-design.md` §3 (table), §4 (access), §5 (tests). This plan does not restate the full SQL — the spec is the source of the exact column list, constraints, and assertions.

---

## Task 1: migration + pgTAP for `practice_round_results`

**Files:**
- Create: `supabase/migrations/20260901120000_create_practice_round_results.sql`
- Create: `supabase/tests/practice_round_results_schema.sql`
- Create: `supabase/tests/practice_round_results_access.sql`
- Create: `docs/progress/M2-SB-01.md`

- [ ] **Step 1: Write the two pgTAP test files first** (they will fail — table doesn't exist yet). Contents per spec §5.1 and §5.2:
  - `practice_round_results_schema.sql`: `has_table`; `has_column` + `col_type_is` + `col_not_null` / `col_is_null` for every column in spec §3; `col_default_is` for `mode` (`'CPU_PRACTICE'`) and `recorded_at` (`now()`); unique on `client_result_id` (`col_is_unique` if available, else assert via `pg_constraint`); `has_index` for `practice_round_results_anon_player_id_idx`; CHECK behaviour via `set local role postgres` + `throws_ok`/`lives_ok` for: `player_count` 1 and 7 fail / 3 ok; `local_won` inconsistent with `winner_seat = local_player_seat` fails; negative `turn_count` / `duration_ms` fail; empty `anon_player_id` fails; RLS enabled (`select relrowsecurity from pg_class where oid = 'public.practice_round_results'::regclass` is true).
  - `practice_round_results_access.sql`: policy counts via `pg_policies` (1 INSERT policy + 1 SELECT policy, 0 others); `has_table_privilege('anon', ..., 'SELECT'/'INSERT')` true, `'UPDATE'/'DELETE'` false; same for `authenticated`; `set local role anon` → insert a valid row `lives_ok`, select `lives_ok`, `update`/`delete` `throws_ok`; duplicate `client_result_id` → second insert `throws_ok` with SQLSTATE `23505`; `set local role service_role` → insert/select/update/delete all `lives_ok`. Use a valid fixture row: `player_count=3, local_player_seat=0, winner_seat=0, local_won=true, turn_count=20, duration_ms=30000, anon_player_id='test-device-1', client_result_id=extensions.gen_random_uuid()`.
  - Count `plan(N)` accurately (N = number of `select ok/is/throws_ok/lives_ok` calls).

- [ ] **Step 2: Run the tests, confirm they fail** — `npx supabase test db supabase/tests/practice_round_results_schema.sql` → FAIL (relation does not exist).

- [ ] **Step 3: Write the migration** `20260901120000_create_practice_round_results.sql` — exactly the `create table` + `create index` + `comment on` from spec §3, then the access block from spec §4.

- [ ] **Step 4: Apply and re-test**
  - `npm run db:reset` (re-applies all migrations + seed; new table created without error)
  - `npx supabase test db supabase/tests/practice_round_results_schema.sql` → PASS
  - `npx supabase test db supabase/tests/practice_round_results_access.sql` → PASS
  - `npx supabase test db supabase/tests/master_access.sql supabase/tests/master_integrity.sql supabase/tests/master_schema.sql supabase/tests/master_seed.sql supabase/tests/ruleset_version.sql` → all PASS (no regression)

- [ ] **Step 5: Progress doc** `docs/progress/M2-SB-01.md` — Japanese, style of `docs/progress/M1-SB-02.md`: 状態=完了 / 日付 2026-09-01 / 概要 / 成果物の表（migration + 2 test files）/ 確認（コマンドと結果）/ メモ（M2 は認証前のため行レベル隔離なし＝意図的な割り切り、`client_result_id` unique が M2-EX-09 の再送冪等の土台、匿名ID生成とキューはサブプロジェクト2）。

- [ ] **Step 6: Verify and commit**
  - `git diff --check`
  - `git add supabase/migrations/20260901120000_create_practice_round_results.sql supabase/tests/practice_round_results_schema.sql supabase/tests/practice_round_results_access.sql docs/progress/M2-SB-01.md`
  - `git commit -m "feat(supabase): [M2-SB-01] add practice_round_results table"` (+ Co-Authored-By trailer)

---

## Self-Review

- **Spec coverage:** table (§3) → Step 3; access (§4) → Step 3; tests (§5) → Steps 1–2; acceptance (§6) → Step 4. All covered.
- **Placeholders:** `plan(N)` is intentionally author-counted; all other content is concrete (spec-referenced).
- **Type consistency:** column names/types come verbatim from spec §3; the fixture row in the access test satisfies every CHECK.
- **Regression risk:** additive migration, new table only; no change to existing tables/policies. `db:reset` + existing test files in Step 4 guard it.
