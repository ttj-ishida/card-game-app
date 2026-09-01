# M3 サブプロジェクト2: Supabase 統計・イベント基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M3-SB-01〜04 を実装する — プレイヤー別統計（`players`/`player_mode_stats`）、二重登録防止の証明、ルール版の関連付け（`ruleset_id`）、公開対局イベントの保存形式（`round_events`）と、それらへ送るペイロードを組み立てる純クライアント関数。

**Architecture:** `practice_round_results`（既存）への insert を核に、`players`/`player_mode_stats` は AFTER INSERT トリガ（security definer）で自動更新する派生テーブルとする。`round_events` は別テーブルへの2本目の insert とし、`round_result_id` の UNIQUE で `practice_round_results` と同じ冪等パターンを持つ。クライアント側は今回、送信ペイロードを組み立てる pure 関数までを実装し、実際のネットワーク配線（`cpuGameStore`）と画面は次サブプロジェクトへ送る。

**Tech Stack:** Postgres（Supabase、ローカル Docker）、pgTAP、TypeScript（`apps/mobile/src/features/cpu-game/`）、`node:test` + `tsx`。

## Global Constraints

- マイグレーションは `supabase/migrations/` に追記のみ。既存マイグレーションは編集しない。ファイル名は `<UTC timestamp>_<description>.sql`、既存最大値（`20260901120000`）より後。
- 秘匿情報をリポジトリに置かない。
- 既存マスタ表・`practice_round_results` と同じアクセス流儀：`revoke all ... from public, anon, authenticated` → 必要な権限だけ `grant` → `enable row level security` → `create policy`。`update`/`delete` の policy は作らない。
- pgTAP テストは `supabase/tests/*.sql`、`begin; select plan(N); ...; select * from finish(); rollback;` 形式（既存 `master_*.sql`/`practice_round_results_*.sql` と同形式）。`npx supabase test db supabase/tests/<file>.sql` で単体実行。
- 表示名・日本語文言・resource key を保存しない。
- 非公開手札・未使用スキルを保存しない（VIS-202）。
- クライアント側の新規コードは既存パターンに従う：純ロジックは `fetch`/`AsyncStorage`/`Date.now`/`Math.random` を直接 import しない。
- モバイルテストは `npm run mobile:test`（`tsx --test` ベース、`.test.ts` のみ）。
- 実装場所：`supabase/migrations/`、`supabase/tests/`、`apps/mobile/src/features/cpu-game/`。
- 参照 spec：`docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md`。

---

### Task 1: `players` / `player_mode_stats` スキーマとアクセス制御（M3-SB-01）

**Files:**
- Create: `supabase/migrations/20260902090000_create_players_and_stats.sql`
- Create: `supabase/tests/players_and_stats_schema.sql`
- Create: `supabase/tests/players_and_stats_access.sql`

**Interfaces:**
- Consumes: なし（新規テーブル）。`extensions.gen_random_uuid()`（既存 `pgcrypto` extension、`20260828130000_create_card_masters.sql` で作成済み）。
- Produces: テーブル `public.players(id uuid PK, anon_player_id text UNIQUE NOT NULL, created_at, last_seen_at)`。テーブル `public.player_mode_stats(player_id uuid FK→players, mode text, rounds_played integer, rounds_won integer, last_played_at, PK(player_id, mode))`。Task 2 がこれらへ書き込むトリガを追加する。

- [ ] **Step 1: pgTAP スキーマテストを書く**

`supabase/tests/players_and_stats_schema.sql`:

```sql
begin;

select plan(25);

-- players: 存在・列・制約
select has_table('public', 'players', 'players table exists');
select has_column('public', 'players', 'anon_player_id', 'has anon_player_id');
select col_type_is('public', 'players', 'anon_player_id', 'text', 'anon_player_id is text');
select col_not_null('public', 'players', 'anon_player_id', 'anon_player_id is not null');
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'players'
      and c.contype = 'u'
      and c.conkey = array[
        (select attnum from pg_attribute
         where attrelid = 'public.players'::regclass
           and attname = 'anon_player_id')
      ]
  ),
  'anon_player_id has a unique constraint'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.players'::regclass),
  true,
  'players row level security is enabled'
);

-- player_mode_stats: 存在・列・制約
select has_table('public', 'player_mode_stats', 'player_mode_stats table exists');
select has_column('public', 'player_mode_stats', 'player_id', 'has player_id');
select col_type_is('public', 'player_mode_stats', 'player_id', 'uuid', 'player_id is uuid');
select col_not_null('public', 'player_mode_stats', 'player_id', 'player_id is not null');
select has_column('public', 'player_mode_stats', 'mode', 'has mode');
select col_not_null('public', 'player_mode_stats', 'mode', 'mode is not null');
select col_type_is('public', 'player_mode_stats', 'rounds_played', 'integer', 'rounds_played is integer');
select col_default_is('public', 'player_mode_stats', 'rounds_played', '0', 'rounds_played defaults to 0');
select col_type_is('public', 'player_mode_stats', 'rounds_won', 'integer', 'rounds_won is integer');
select col_default_is('public', 'player_mode_stats', 'rounds_won', '0', 'rounds_won defaults to 0');
select col_type_is('public', 'player_mode_stats', 'last_played_at', 'timestamp with time zone', 'last_played_at is timestamptz');
select col_is_null('public', 'player_mode_stats', 'last_played_at', 'last_played_at is nullable');
select is(
  (select relrowsecurity from pg_class where oid = 'public.player_mode_stats'::regclass),
  true,
  'player_mode_stats row level security is enabled'
);

-- CHECK 制約と PK の挙動（テーブル所有者で RLS を迂回）
set local role postgres;

select lives_ok(
  $$insert into public.players (anon_player_id) values ('schema-fixture-player')$$,
  'a player row inserts'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', 5, 6 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23514',
  NULL,
  'rounds_won greater than rounds_played is rejected'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', -1, 0 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23514',
  NULL,
  'negative rounds_played is rejected'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'PVP', 1, 0 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23514',
  NULL,
  'an unknown mode is rejected'
);

select lives_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', 3, 1 from public.players where anon_player_id = 'schema-fixture-player'$$,
  'a valid stats row inserts'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', 1, 0 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23505',
  NULL,
  'duplicate (player_id, mode) is rejected by the primary key'
);

reset role;

select * from finish();

rollback;
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx supabase test db supabase/tests/players_and_stats_schema.sql`
Expected: FAIL（`relation "public.players" does not exist` 等）

- [ ] **Step 3: アクセス制御テストを書く**

`supabase/tests/players_and_stats_access.sql`:

```sql
begin;

select plan(13);

-- policy 構成: SELECT のみ、他は 0
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'players' and cmd = 'SELECT'),
  1,
  'players: exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'players' and cmd <> 'SELECT'),
  0,
  'players: no INSERT / UPDATE / DELETE policies'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'player_mode_stats' and cmd = 'SELECT'),
  1,
  'player_mode_stats: exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'player_mode_stats' and cmd <> 'SELECT'),
  0,
  'player_mode_stats: no INSERT / UPDATE / DELETE policies'
);

-- テーブル権限
select ok(has_table_privilege('anon', 'public.players', 'SELECT'), 'anon has SELECT on players');
select ok(not has_table_privilege('anon', 'public.players', 'INSERT'), 'anon has no INSERT on players');
select ok(not has_table_privilege('anon', 'public.players', 'UPDATE'), 'anon has no UPDATE on players');
select ok(has_table_privilege('anon', 'public.player_mode_stats', 'SELECT'), 'anon has SELECT on player_mode_stats');
select ok(not has_table_privilege('anon', 'public.player_mode_stats', 'INSERT'), 'anon has no INSERT on player_mode_stats');
select ok(has_table_privilege('service_role', 'public.players', 'INSERT'), 'service_role has INSERT on players');
select ok(has_table_privilege('service_role', 'public.player_mode_stats', 'UPDATE'), 'service_role has UPDATE on player_mode_stats');

-- anon の実操作
set local role anon;

select throws_ok(
  $$insert into public.players (anon_player_id) values ('anon-cannot-insert')$$,
  '42501',
  NULL,
  'anon cannot insert into players'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode) values (extensions.gen_random_uuid(), 'CPU_PRACTICE')$$,
  '42501',
  NULL,
  'anon cannot insert into player_mode_stats'
);

reset role;

select * from finish();

rollback;
```

- [ ] **Step 4: マイグレーションを書く**

`supabase/migrations/20260902090000_create_players_and_stats.sql`:

```sql
-- M3-SB-01: プレイヤー別統計の土台。players は匿名IDのみ（認証前）。
-- player_mode_stats はモード別の対局数・勝利数を保持する（勝率は読取時計算）。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md

create table public.players (
  id             uuid primary key default extensions.gen_random_uuid(),
  anon_player_id text not null,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  constraint players_anon_player_id_key unique (anon_player_id),
  constraint players_anon_player_id_check check (anon_player_id <> '')
);

create table public.player_mode_stats (
  player_id      uuid not null references public.players(id) on delete cascade,
  mode           text not null,
  rounds_played  integer not null default 0,
  rounds_won     integer not null default 0,
  last_played_at timestamptz,
  constraint player_mode_stats_pkey primary key (player_id, mode),
  constraint player_mode_stats_mode_check check (mode in ('CPU_PRACTICE')),
  constraint player_mode_stats_rounds_played_check check (rounds_played >= 0),
  constraint player_mode_stats_rounds_won_check
    check (rounds_won >= 0 and rounds_won <= rounds_played)
);

comment on table public.players is
  '匿名プレイヤーID（端末生成）の台帳。M3 は認証前のため anon_player_id だけで識別する。認証導入時に auth.uid() へ移行。';
comment on table public.player_mode_stats is
  'モード別の対局数・勝利数。practice_round_results への insert 時にトリガで自動更新される（クライアントは直接書き込まない）。勝率は読取時に計算する。';

alter table public.players enable row level security;
alter table public.player_mode_stats enable row level security;

revoke all on table public.players from public, anon, authenticated;
revoke all on table public.player_mode_stats from public, anon, authenticated;

grant select on table public.players to anon, authenticated;
grant select on table public.player_mode_stats to anon, authenticated;
grant all on table public.players to service_role;
grant all on table public.player_mode_stats to service_role;

create policy players_select_client
  on public.players
  for select
  to anon, authenticated
  using (true);

create policy player_mode_stats_select_client
  on public.player_mode_stats
  for select
  to anon, authenticated
  using (true);
```

- [ ] **Step 5: マイグレーションを適用してテストを確認する**

Run: `npm run db:reset`
Expected: 全マイグレーション成功

Run: `npx supabase test db supabase/tests/players_and_stats_schema.sql`
Expected: PASS、25 tests

Run: `npx supabase test db supabase/tests/players_and_stats_access.sql`
Expected: PASS、13 tests

- [ ] **Step 6: 既存 DB テストに回帰がないことを確認する**

Run: `npx supabase test db supabase/tests/master_schema.sql supabase/tests/master_access.sql supabase/tests/master_integrity.sql supabase/tests/master_seed.sql supabase/tests/ruleset_version.sql supabase/tests/practice_round_results_schema.sql supabase/tests/practice_round_results_access.sql`
Expected: 全 PASS（回帰なし）

- [ ] **Step 7: コミット**

```bash
git add supabase/migrations/20260902090000_create_players_and_stats.sql supabase/tests/players_and_stats_schema.sql supabase/tests/players_and_stats_access.sql
git commit -m "feat(db): [M3-SB-01] add players and player_mode_stats tables"
```

---

### Task 2: 統計トリガ + `get_player_mode_stats()`（M3-SB-01 完結 / M3-SB-02）

**Files:**
- Create: `supabase/migrations/20260902093000_add_practice_round_results_stats_trigger.sql`
- Create: `supabase/tests/practice_round_results_stats_trigger.sql`

**Interfaces:**
- Consumes: `public.players`/`public.player_mode_stats`（Task 1）。`public.practice_round_results`（既存、M2-SB-01：列 `client_result_id`/`anon_player_id`/`mode`/`local_won`/`recorded_at`）。
- Produces: 関数 `public.get_player_mode_stats(p_anon_player_id text, p_mode text default 'CPU_PRACTICE') returns table(rounds_played integer, rounds_won integer, win_rate numeric, last_played_at timestamptz)`（`anon`/`authenticated` に EXECUTE 権限）。トリガ `practice_round_results_stats_trigger`（`practice_round_results` への insert のたびに `players`/`player_mode_stats` を自動更新）。

- [ ] **Step 1: pgTAP テストを書く**

`supabase/tests/practice_round_results_stats_trigger.sql`:

```sql
begin;

select plan(9);

select has_function(
  'public', 'get_player_mode_stats', array['text','text']::name[],
  'get_player_mode_stats function exists'
);
select ok(
  has_function_privilege('anon', 'public.get_player_mode_stats(text, text)', 'EXECUTE'),
  'anon can execute get_player_mode_stats'
);

set local role anon;

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      ('33333333-3333-4333-8333-333333333333', 'trigger-fixture', 3, 0, 0, true, 20, 30000)$$,
  'first result inserts'
);

select results_eq(
  $$select rounds_played, rounds_won from public.get_player_mode_stats('trigger-fixture')$$,
  $$values (1, 1)$$,
  'first win is recorded as 1 played / 1 won'
);

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      ('44444444-4444-4444-8444-444444444444', 'trigger-fixture', 4, 1, 0, false, 25, 40000)$$,
  'second result (a loss) inserts'
);

select results_eq(
  $$select rounds_played, rounds_won from public.get_player_mode_stats('trigger-fixture')$$,
  $$values (2, 1)$$,
  'second, losing round adds to rounds_played but not rounds_won'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      ('33333333-3333-4333-8333-333333333333', 'trigger-fixture', 5, 2, 2, true, 30, 50000)$$,
  '23505',
  NULL,
  'resending the first client_result_id is rejected'
);

select results_eq(
  $$select rounds_played, rounds_won from public.get_player_mode_stats('trigger-fixture')$$,
  $$values (2, 1)$$,
  'resend does not change stats (M3-SB-02: no double counting)'
);

select results_eq(
  $$select win_rate from public.get_player_mode_stats('trigger-fixture')$$,
  $$values (0.5000::numeric)$$,
  'win_rate is rounds_won / rounds_played'
);

reset role;

select * from finish();

rollback;
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx supabase test db supabase/tests/practice_round_results_stats_trigger.sql`
Expected: FAIL（`get_player_mode_stats` 関数が無い）

- [ ] **Step 3: マイグレーションを書く**

`supabase/migrations/20260902093000_add_practice_round_results_stats_trigger.sql`:

```sql
-- M3-SB-01 / M3-SB-02: practice_round_results への insert から
-- players / player_mode_stats を自動更新するトリガ。
-- insert が成功した行にのみ発火するため、client_result_id UNIQUE 違反による
-- 再送（2回目の insert 失敗）では発火せず、統計は二重加算されない（M3-SB-02）。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md §5

create or replace function public.record_practice_round_result_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  insert into public.players (anon_player_id)
  values (new.anon_player_id)
  on conflict (anon_player_id)
  do update set last_seen_at = new.recorded_at
  returning id into v_player_id;

  insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won, last_played_at)
  values (v_player_id, new.mode, 1, case when new.local_won then 1 else 0 end, new.recorded_at)
  on conflict (player_id, mode)
  do update set
    rounds_played  = public.player_mode_stats.rounds_played + 1,
    rounds_won     = public.player_mode_stats.rounds_won + case when new.local_won then 1 else 0 end,
    last_played_at = new.recorded_at;

  return new;
end;
$$;

comment on function public.record_practice_round_result_stats() is
  'practice_round_results への insert 成功時に players / player_mode_stats を upsert する。security definer のため anon は直接の書込権限を必要としない。insert 自体が client_result_id UNIQUE で弾かれれば発火しないため、再送で二重加算されない（M3-SB-02）。';

create trigger practice_round_results_stats_trigger
  after insert on public.practice_round_results
  for each row
  execute function public.record_practice_round_result_stats();

create or replace function public.get_player_mode_stats(
  p_anon_player_id text,
  p_mode text default 'CPU_PRACTICE'
)
returns table (
  rounds_played  integer,
  rounds_won     integer,
  win_rate       numeric,
  last_played_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.rounds_played,
    s.rounds_won,
    case when s.rounds_played > 0
      then round(s.rounds_won::numeric / s.rounds_played, 4)
      else null
    end as win_rate,
    s.last_played_at
  from public.player_mode_stats s
  join public.players p on p.id = s.player_id
  where p.anon_player_id = p_anon_player_id
    and s.mode = p_mode
$$;

revoke all on function public.get_player_mode_stats(text, text) from public;
grant execute on function public.get_player_mode_stats(text, text) to anon, authenticated;
```

- [ ] **Step 4: マイグレーションを適用してテストを確認する**

Run: `npm run db:reset`
Expected: 全マイグレーション成功

Run: `npx supabase test db supabase/tests/practice_round_results_stats_trigger.sql`
Expected: PASS、9 tests

- [ ] **Step 5: 既存 DB テストに回帰がないことを確認する**

Run: `npx supabase test db supabase/tests/practice_round_results_schema.sql supabase/tests/practice_round_results_access.sql supabase/tests/players_and_stats_schema.sql supabase/tests/players_and_stats_access.sql`
Expected: 全 PASS（回帰なし）

- [ ] **Step 6: コミット**

```bash
git add supabase/migrations/20260902093000_add_practice_round_results_stats_trigger.sql supabase/tests/practice_round_results_stats_trigger.sql
git commit -m "feat(db): [M3-SB-01][M3-SB-02] add stats trigger and get_player_mode_stats()"
```

---

### Task 3: `practice_round_results.ruleset_id`（M3-SB-03 DB 部分）

**Files:**
- Create: `supabase/migrations/20260902100000_add_practice_round_results_ruleset_link.sql`
- Create: `supabase/tests/practice_round_results_ruleset_link.sql`

**Interfaces:**
- Consumes: `public.rulesets(id)`（既存、`20260828130000_create_card_masters.sql`）。
- Produces: 列 `public.practice_round_results.ruleset_id uuid`（nullable、`references public.rulesets(id) on delete restrict`）。

- [ ] **Step 1: pgTAP テストを書く**

`supabase/tests/practice_round_results_ruleset_link.sql`:

```sql
begin;

select plan(5);

select has_column('public', 'practice_round_results', 'ruleset_id', 'has ruleset_id');
select col_type_is('public', 'practice_round_results', 'ruleset_id', 'uuid', 'ruleset_id is uuid');
select col_is_null('public', 'practice_round_results', 'ruleset_id', 'ruleset_id is nullable');

set local role postgres;

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms, ruleset_id)
    values
      (extensions.gen_random_uuid(), 'ruleset-fixture', 3, 0, 0, true, 20, 30000,
       (select id from public.rulesets where status = 'active' limit 1))$$,
  'a valid ruleset_id inserts'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms, ruleset_id)
    values
      (extensions.gen_random_uuid(), 'ruleset-fixture', 3, 0, 0, true, 20, 30000, '00000000-0000-4000-8000-000000000000')$$,
  '23503',
  NULL,
  'a nonexistent ruleset_id is rejected by the foreign key'
);

reset role;

select * from finish();

rollback;
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx supabase test db supabase/tests/practice_round_results_ruleset_link.sql`
Expected: FAIL（`ruleset_id` 列が無い）

- [ ] **Step 3: マイグレーションを書く**

`supabase/migrations/20260902100000_add_practice_round_results_ruleset_link.sql`:

```sql
-- M3-SB-03: 対局結果に適用ルール版を関連付ける。
-- nullable: クライアント送信配線（次サブプロジェクト）完了までの間、
-- 既存クライアントは値を送らないため、既存の insert を壊さない。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md §4.4

alter table public.practice_round_results
  add column ruleset_id uuid references public.rulesets(id) on delete restrict;

comment on column public.practice_round_results.ruleset_id is
  '対局時点の適用ルール版。nullable：クライアント配線（M3-EX-04/05 サブプロジェクト）完了までの既存クライアントは送らない。配線後は常に送信される想定。';
```

- [ ] **Step 4: マイグレーションを適用してテストを確認する**

Run: `npm run db:reset`
Expected: 全マイグレーション成功

Run: `npx supabase test db supabase/tests/practice_round_results_ruleset_link.sql`
Expected: PASS、5 tests

- [ ] **Step 5: 既存 DB テストに回帰がないことを確認する**

Run: `npx supabase test db supabase/tests/practice_round_results_schema.sql supabase/tests/practice_round_results_access.sql`
Expected: 全 PASS（回帰なし）

- [ ] **Step 6: コミット**

```bash
git add supabase/migrations/20260902100000_add_practice_round_results_ruleset_link.sql supabase/tests/practice_round_results_ruleset_link.sql
git commit -m "feat(db): [M3-SB-03] add practice_round_results.ruleset_id"
```

---

### Task 4: `round_events` テーブルとアクセス制御（M3-SB-04 DB 部分）

**Files:**
- Create: `supabase/migrations/20260902103000_create_round_events.sql`
- Create: `supabase/tests/round_events_schema.sql`
- Create: `supabase/tests/round_events_access.sql`

**Interfaces:**
- Consumes: `public.practice_round_results(id)`（既存）。
- Produces: テーブル `public.round_events(id uuid PK, round_result_id uuid UNIQUE NOT NULL FK→practice_round_results, events jsonb NOT NULL, created_at)`。

- [ ] **Step 1: pgTAP スキーマテストを書く**

`supabase/tests/round_events_schema.sql`:

```sql
begin;

select plan(10);

select has_table('public', 'round_events', 'round_events table exists');
select has_column('public', 'round_events', 'round_result_id', 'has round_result_id');
select col_type_is('public', 'round_events', 'round_result_id', 'uuid', 'round_result_id is uuid');
select col_not_null('public', 'round_events', 'round_result_id', 'round_result_id is not null');
select has_column('public', 'round_events', 'events', 'has events');
select col_type_is('public', 'round_events', 'events', 'jsonb', 'events is jsonb');
select col_not_null('public', 'round_events', 'events', 'events is not null');
select is(
  (select relrowsecurity from pg_class where oid = 'public.round_events'::regclass),
  true,
  'row level security is enabled'
);

set local role postgres;

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'round-events-schema-fixture', 3, 0, 0, true, 20, 30000)$$,
  'a practice_round_results fixture row inserts'
);

select throws_ok(
  $$insert into public.round_events (round_result_id, events)
    select id, '{"not":"an array"}'::jsonb
    from public.practice_round_results where anon_player_id = 'round-events-schema-fixture'$$,
  '23514',
  NULL,
  'a non-array events value is rejected'
);

reset role;

select * from finish();

rollback;
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx supabase test db supabase/tests/round_events_schema.sql`
Expected: FAIL（`relation "public.round_events" does not exist`）

- [ ] **Step 3: アクセス制御テストを書く**

`supabase/tests/round_events_access.sql`:

```sql
begin;

select plan(10);

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'round_events' and cmd = 'INSERT'),
  1,
  'exactly one INSERT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'round_events' and cmd = 'SELECT'),
  1,
  'exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'round_events' and cmd not in ('INSERT', 'SELECT')),
  0,
  'no UPDATE / DELETE / ALL policies'
);

select ok(has_table_privilege('anon', 'public.round_events', 'SELECT'), 'anon has SELECT');
select ok(has_table_privilege('anon', 'public.round_events', 'INSERT'), 'anon has INSERT');
select ok(not has_table_privilege('anon', 'public.round_events', 'UPDATE'), 'anon has no UPDATE');
select ok(not has_table_privilege('anon', 'public.round_events', 'DELETE'), 'anon has no DELETE');

set local role anon;

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      ('55555555-5555-4555-8555-555555555555', 'round-events-access-fixture', 2, 0, 0, true, 10, 15000)$$,
  'a practice_round_results fixture row inserts'
);

select lives_ok(
  $$insert into public.round_events (round_result_id, events)
    select id, '[{"index":0,"kind":"PASS"}]'::jsonb
    from public.practice_round_results where anon_player_id = 'round-events-access-fixture'$$,
  'anon can insert round_events for its own result'
);

select throws_ok(
  $$insert into public.round_events (round_result_id, events)
    select id, '[]'::jsonb
    from public.practice_round_results where anon_player_id = 'round-events-access-fixture'$$,
  '23505',
  NULL,
  'a second insert for the same round_result_id is rejected (idempotent resend)'
);

reset role;

select * from finish();

rollback;
```

- [ ] **Step 4: マイグレーションを書く**

`supabase/migrations/20260902103000_create_round_events.sql`:

```sql
-- M3-SB-04: 公開対局イベント（使用カード・効果・勝者を再生できる形式）を保存する。
-- round_result_id への UNIQUE により、再送も practice_round_results と同じ冪等性パターンを持つ。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md §4.5

create table public.round_events (
  id              uuid primary key default extensions.gen_random_uuid(),
  round_result_id uuid not null references public.practice_round_results(id) on delete cascade,
  events          jsonb not null,
  created_at      timestamptz not null default now(),
  constraint round_events_round_result_id_key unique (round_result_id),
  constraint round_events_events_check check (jsonb_typeof(events) = 'array')
);

comment on table public.round_events is
  '1局分の公開対局イベント（使用カード・使用スキル効果・場流し・昼夜・席）。非公開手札・未使用スキルは含めない（VIS-202）。practice_round_results と1:1。';
comment on column public.round_events.events is
  '手番ごとの公開イベント配列。各要素: index, seat_id, seat_kind, kind(PLAY/PASS), action_kind, cards[](rank_code/suit_code), skill_effect, field_cleared, day_night_after, hand_counts_after。';

alter table public.round_events enable row level security;

revoke all on table public.round_events from public, anon, authenticated;

grant select, insert on table public.round_events to anon, authenticated;
grant all on table public.round_events to service_role;

create policy round_events_insert_client
  on public.round_events
  for insert
  to anon, authenticated
  with check (true);

create policy round_events_select_client
  on public.round_events
  for select
  to anon, authenticated
  using (true);
```

- [ ] **Step 5: マイグレーションを適用してテストを確認する**

Run: `npm run db:reset`
Expected: 全マイグレーション成功

Run: `npx supabase test db supabase/tests/round_events_schema.sql`
Expected: PASS、10 tests

Run: `npx supabase test db supabase/tests/round_events_access.sql`
Expected: PASS、10 tests

- [ ] **Step 6: 既存 DB テストに回帰がないことを確認する**

Run: `npx supabase test db supabase/tests/practice_round_results_schema.sql supabase/tests/practice_round_results_access.sql supabase/tests/practice_round_results_ruleset_link.sql`
Expected: 全 PASS（回帰なし）

- [ ] **Step 7: コミット**

```bash
git add supabase/migrations/20260902103000_create_round_events.sql supabase/tests/round_events_schema.sql supabase/tests/round_events_access.sql
git commit -m "feat(db): [M3-SB-04] add round_events table"
```

---

### Task 5: `resultModel.ts` に `ruleset_id` を追加（M3-SB-03 クライアント部分）

**Files:**
- Modify: `apps/mobile/src/features/cpu-game/resultModel.ts`
- Test: `apps/mobile/src/features/cpu-game/resultModel.test.ts`

**Interfaces:**
- Consumes: 既存 `PracticeResultPayload`、`buildPracticeResultPayload()`（`resultModel.ts`）。
- Produces: `PracticeResultPayload.ruleset_id: string | null`。`buildPracticeResultPayload(input: { view; state; anonPlayerId; clientResultId; rulesetId?: string | null })`（`rulesetId` 省略時は `null`）。既存呼び出し元（`apps/mobile/src/state/cpuGameStore.ts`）は変更不要（オプショナル引数のため後方互換）。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/cpu-game/resultModel.test.ts` の既存 `'buildPracticeResultPayload carries every practice_round_results column with the right type'` テストを次のように変更する（`Object.keys` の期待配列に `'ruleset_id'` を追加）：

```ts
  assert.deepEqual(Object.keys(payload).sort(), [
    'anon_player_id',
    'client_result_id',
    'duration_ms',
    'local_player_seat',
    'local_won',
    'mode',
    'player_count',
    'round_seed',
    'ruleset_id',
    'turn_count',
    'winner_seat',
  ]);
```

同ファイル末尾に新しいテストを2件追加する：

```ts
test('ruleset_id defaults to null when not provided', () => {
  const view = describeRoundResult(HUMAN_WINS, 0, 1000);
  const payload = buildPracticeResultPayload({
    view,
    state: HUMAN_WINS,
    anonPlayerId: 'd',
    clientResultId: 'c',
  });
  assert.equal(payload.ruleset_id, null);
});

test('ruleset_id carries the provided value through', () => {
  const view = describeRoundResult(HUMAN_WINS, 0, 1000);
  const payload = buildPracticeResultPayload({
    view,
    state: HUMAN_WINS,
    anonPlayerId: 'd',
    clientResultId: 'c',
    rulesetId: 'ruleset-uuid-123',
  });
  assert.equal(payload.ruleset_id, 'ruleset-uuid-123');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/resultModel.test.ts`
Expected: FAIL（`ruleset_id` が payload に無い / 型エラー）

- [ ] **Step 3: `resultModel.ts` を変更する**

`apps/mobile/src/features/cpu-game/resultModel.ts` の `PracticeResultPayload` 型に1行追加：

```ts
export type PracticeResultPayload = {
  client_result_id: string;
  anon_player_id: string;
  mode: 'CPU_PRACTICE';
  player_count: number;
  local_player_seat: number;
  winner_seat: number;
  local_won: boolean;
  turn_count: number;
  duration_ms: number;
  round_seed: number;
  ruleset_id: string | null;
};
```

`buildPracticeResultPayload` のシグネチャと戻り値を変更：

```ts
export function buildPracticeResultPayload(input: {
  view: RoundResultView;
  state: DriverState;
  anonPlayerId: string;
  clientResultId: string;
  rulesetId?: string | null;
}): PracticeResultPayload {
  const { view, state, anonPlayerId, clientResultId, rulesetId } = input;
  const localPlayerSeat = humanSeatIndex(state.config);
  const winnerSeat = state.config.seats.findIndex((s) => s.seatId === view.winnerSeatId);
  if (winnerSeat < 0) {
    throw new Error(
      `buildPracticeResultPayload: winner seat "${view.winnerSeatId}" is not in the config`,
    );
  }
  if (view.localWon !== (winnerSeat === localPlayerSeat)) {
    throw new Error(
      `buildPracticeResultPayload: localWon (${view.localWon}) disagrees with ` +
        `winner_seat === local_player_seat (${winnerSeat} === ${localPlayerSeat})`,
    );
  }
  return {
    client_result_id: clientResultId,
    anon_player_id: anonPlayerId,
    mode: 'CPU_PRACTICE',
    player_count: view.playerCount,
    local_player_seat: localPlayerSeat,
    winner_seat: winnerSeat,
    local_won: view.localWon,
    turn_count: view.turnCount,
    duration_ms: view.durationMs,
    round_seed: state.seed,
    ruleset_id: rulesetId ?? null,
  };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/resultModel.test.ts`
Expected: PASS（全テスト）

- [ ] **Step 5: モバイルの全テストに回帰がないことを確認する**

Run: `npm run mobile:test`
Expected: PASS（回帰なし）

- [ ] **Step 6: コミット**

```bash
git add apps/mobile/src/features/cpu-game/resultModel.ts apps/mobile/src/features/cpu-game/resultModel.test.ts
git commit -m "feat(mobile): [M3-SB-03] add ruleset_id to PracticeResultPayload"
```

---

### Task 6: `turnDriver.ts` に公開イベント記録を追加（M3-SB-04 クライアント部分・1）

**Files:**
- Modify: `apps/mobile/src/features/cpu-game/turnDriver.ts`
- Test: `apps/mobile/src/features/cpu-game/turnDriver.test.ts`

**Interfaces:**
- Consumes: `@card-game-app/game-core` の `RankCode`/`SuitCode`/`PlaySkillUse`/`NumberCard`（型）、既存 `DriverState`/`appendTurn`/`humanPlay`/`cpuStep`。
- Produces: 型 `PublicRoundEvent`（`index`/`seatId`/`seatKind`/`kind`/`actionKind`/`cards: { rankCode; suitCode }[]`/`skillEffect: PlaySkillUse | null`/`fieldCleared`/`dayNightAfter`/`handCountsAfter`）。`DriverState.publicEvents: PublicRoundEvent[]`（`humanPlay`/`cpuStep` の両方が更新する）。Task 7 がこれを消費する。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/cpu-game/turnDriver.test.ts` の import に `type PublicRoundEvent` を追加し、ファイル末尾に次のテストを追加する：

```ts
test('publicEvents has one entry per turn, matching turnLog', () => {
  const s = playToEnd(5, 5 * 7919 + 13);
  assert.equal(s.publicEvents.length, s.turnLog.length);
  s.publicEvents.forEach((event, i) => {
    assert.equal(event.index, i);
    assert.equal(event.seatId, s.turnLog[i].seatId);
    assert.equal(event.seatKind, s.turnLog[i].seatKind);
    assert.equal(event.kind, s.turnLog[i].kind);
    assert.equal(event.fieldCleared, s.turnLog[i].fieldCleared);
    assert.equal(event.dayNightAfter, s.turnLog[i].dayNightAfter);
    assert.deepEqual(event.handCountsAfter, s.turnLog[i].handCountsAfter);
  });
});

test('a PASS event carries no cards and no skill effect', () => {
  const s = playToEnd(5, 5 * 7919 + 13);
  for (const event of s.publicEvents) {
    if (event.kind === 'PASS') {
      assert.deepEqual(event.cards, []);
      assert.equal(event.skillEffect, null);
    }
  }
});

test('a PLAY event carries at least one public card', () => {
  const s = playToEnd(5, 5 * 7919 + 13);
  for (const event of s.publicEvents) {
    if (event.kind === 'PLAY') {
      assert.ok(event.cards.length > 0, `turn ${event.index} PLAY has no cards`);
    }
  }
});

test('publicEvents surface every skill effect across the standard sweep, with cards attached', () => {
  const seen = new Set<string>();
  let transformHasCards = false;
  for (let n = 2; n <= 6; n += 1) {
    for (let seed = 0; seed < 50; seed += 1) {
      const s = playToEnd(n, seed);
      for (const event of s.publicEvents) {
        if (!event.skillEffect) continue;
        seen.add(event.skillEffect);
        if (event.skillEffect === 'JOKER_TRANSFORM' && event.cards.length > 0) {
          transformHasCards = true;
        }
      }
    }
  }
  for (const effect of ['JOKER_CLEAR', 'JOKER_TRANSFORM', 'EXTENSION_SEAL', 'REVOLUTION']) {
    assert.ok(seen.has(effect), `${effect} never appeared in publicEvents across the sweep`);
  }
  assert.ok(transformHasCards, 'a JOKER_TRANSFORM event should carry at least one public card');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/turnDriver.test.ts`
Expected: FAIL（`publicEvents` プロパティが `DriverState` に無い）

- [ ] **Step 3: `turnDriver.ts` を変更する**

import ブロックを次のように変更する（`NumberCard`/`PlaySkillUse`/`RankCode`/`SuitCode` を追加）：

```ts
import {
  createRng,
  createRoundState,
  dealRound,
  enumerateLegalPlays,
  INITIAL_RULESET_VERSION,
  resolveCpuPolicy,
  resolvePlay,
  rollThinkDelayMillis,
  type DayNight,
  type LegalPlay,
  type NumberCard,
  type PlayInput,
  type PlayRejectionReason,
  type PlayResolution,
  type PlaySkillUse,
  type RankCode,
  type RoundState,
  type Rng,
  type SuitCode,
} from '@card-game-app/game-core';
```

`TurnActionKind` の直後に `PublicRoundEvent` 型を追加する：

```ts
/**
 * 局のトレース1手ぶん（公開対局イベント版）。行動時点で公開された情報のみを持つ：
 * 場に出たカードの rank/suit（変化Jokerは宣言内容も含む）、使用したスキル効果。
 * 非公開手札・未使用スキルは含めない（VIS-202）。M3-SB-04 `round_events` の送信元。
 */
export type PublicRoundEvent = {
  index: number;
  seatId: string;
  seatKind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS';
  actionKind: TurnActionKind;
  cards: { rankCode: RankCode; suitCode: SuitCode }[];
  skillEffect: PlaySkillUse | null;
  fieldCleared: boolean;
  dayNightAfter: DayNight;
  handCountsAfter: Record<string, number>;
};
```

`DriverState` に `publicEvents` を追加する：

```ts
export type DriverState = {
  config: MatchConfig;
  seed: number;
  rematchIndex: number;
  baselineFirstSeatId: string;
  round: RoundState;
  phase: GamePhase;
  turnLog: TurnLogEntry[];
  publicEvents: PublicRoundEvent[];
  winnerSeatId: string | null;
};
```

`initGame` の戻り値に `publicEvents: []` を追加する（`turnLog: [],` の直後）：

```ts
    turnLog: [],
    publicEvents: [],
    winnerSeatId: round.winnerId,
```

`appendTurn` の直前に、公開カード抽出のヘルパーを追加する：

```ts
/**
 * プレイ前の手札と PlayInput から、公開される（場へ出る）カードの rank/suit を抽出する。
 * 実カードは cardIds → 手札引き当て。変化Joker の宣言（jokerDeclarations）は
 * hand に無いので別途加える。PASS は空配列。
 */
function publicCardsPlayed(
  handBefore: NumberCard[],
  input: PlayInput,
): { rankCode: RankCode; suitCode: SuitCode }[] {
  if (input.kind === 'PASS') return [];
  const byId = new Map(handBefore.map((card) => [card.cardId, card]));
  const realCards = input.cardIds.map((cardId) => {
    const card = byId.get(cardId);
    if (!card) {
      throw new Error(`publicCardsPlayed: card "${cardId}" not found in hand before the play`);
    }
    return { rankCode: card.rankCode, suitCode: card.suitCode };
  });
  const declaredCards = (input.jokerDeclarations ?? []).map((declaration) => ({
    rankCode: declaration.rankCode,
    suitCode: declaration.suitCode,
  }));
  return [...realCards, ...declaredCards];
}
```

`appendTurn` を次のように変更する（`publicEvent` の組み立てと `publicEvents` の追記を追加）：

```ts
function appendTurn(
  state: DriverState,
  seatId: string,
  input: PlayInput,
  res: ResolvedPlay,
): DriverState {
  const seatKind = isHumanSeat(state.config, seatId) ? 'HUMAN' : 'CPU';
  const handBefore = state.round.players.find((p) => p.playerId === seatId)?.hand ?? [];
  const entry: TurnLogEntry = {
    index: state.turnLog.length,
    seatId,
    seatKind,
    kind: input.kind === 'PASS' ? 'PASS' : 'PLAY',
    cardCount: input.kind === 'PASS' ? 0 : input.cardIds.length,
    actionKind: res.outcome.actionKind,
    fieldCleared: res.outcome.fieldCleared,
    dayNightAfter: res.outcome.dayNightAfter,
    handCountsAfter: Object.fromEntries(res.state.players.map((p) => [p.playerId, p.hand.length])),
  };
  const publicEvent: PublicRoundEvent = {
    index: state.publicEvents.length,
    seatId,
    seatKind,
    kind: entry.kind,
    actionKind: entry.actionKind,
    cards: publicCardsPlayed(handBefore, input),
    skillEffect: input.kind === 'PLAY' ? (input.useSkill ?? null) : null,
    fieldCleared: entry.fieldCleared,
    dayNightAfter: entry.dayNightAfter,
    handCountsAfter: entry.handCountsAfter,
  };
  return {
    ...state,
    round: res.state,
    turnLog: [...state.turnLog, entry],
    publicEvents: [...state.publicEvents, publicEvent],
    phase: phaseFor(state.config, res.state),
    winnerSeatId: res.state.winnerId,
  };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/turnDriver.test.ts`
Expected: PASS（既存テスト含め全件。既存の `assert.deepEqual(a, b)` による決定性テストは `publicEvents` も含めて成立する — 同じ seed・同じ人間選択なら常に同じ値になるため）

- [ ] **Step 5: モバイルの全テストに回帰がないことを確認する**

Run: `npm run mobile:test`
Expected: PASS（回帰なし。`resultModel.test.ts` は Task 5 で既に対応済み）

- [ ] **Step 6: コミット**

```bash
git add apps/mobile/src/features/cpu-game/turnDriver.ts apps/mobile/src/features/cpu-game/turnDriver.test.ts
git commit -m "feat(mobile): [M3-SB-04] record public round events in turnDriver"
```

---

### Task 7: `roundEventsPayload.ts`（M3-SB-04 クライアント部分・2）

**Files:**
- Create: `apps/mobile/src/features/cpu-game/roundEventsPayload.ts`
- Create: `apps/mobile/src/features/cpu-game/roundEventsPayload.test.ts`

**Interfaces:**
- Consumes: `PublicRoundEvent`（Task 6、`./turnDriver`）。
- Produces: `RoundEventsPayload`、`RoundEventPayloadEntry`、`buildRoundEventsPayload(roundResultId: string, publicEvents: PublicRoundEvent[]): RoundEventsPayload`。ネットワーク配線（次サブプロジェクト）が `round_result_id` を渡して呼ぶ想定。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/cpu-game/roundEventsPayload.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig } from './matchConfig';
import {
  cpuStep,
  humanPlay,
  initGame,
  isHumanTurn,
  legalPlaysForHuman,
  type DriverState,
} from './turnDriver';
import { buildRoundEventsPayload } from './roundEventsPayload';

function playToEnd(n: number, seed: number): DriverState {
  let s = initGame({ config: buildMatchConfig(n), seed });
  let guard = 0;
  while (s.phase !== 'ROUND_OVER') {
    if (++guard > 500) throw new Error(`no progress n=${n} seed=${seed}`);
    if (isHumanTurn(s)) {
      const res = humanPlay(s, legalPlaysForHuman(s)[0].input);
      if (!res.ok) throw new Error(`human illegal n=${n} seed=${seed}: ${res.reason}`);
      s = res.next;
    } else {
      s = cpuStep(s).next;
    }
  }
  return s;
}

const GAME = playToEnd(3, 6);

test('buildRoundEventsPayload carries the round_result_id through unchanged', () => {
  const payload = buildRoundEventsPayload('result-uuid-1', GAME.publicEvents);
  assert.equal(payload.round_result_id, 'result-uuid-1');
});

test('buildRoundEventsPayload produces one entry per publicEvents item, snake_case', () => {
  const payload = buildRoundEventsPayload('result-uuid-1', GAME.publicEvents);
  assert.equal(payload.events.length, GAME.publicEvents.length);
  payload.events.forEach((entry, i) => {
    const source = GAME.publicEvents[i];
    assert.equal(entry.index, source.index);
    assert.equal(entry.seat_id, source.seatId);
    assert.equal(entry.seat_kind, source.seatKind);
    assert.equal(entry.kind, source.kind);
    assert.equal(entry.action_kind, source.actionKind);
    assert.equal(entry.skill_effect, source.skillEffect);
    assert.equal(entry.field_cleared, source.fieldCleared);
    assert.equal(entry.day_night_after, source.dayNightAfter);
    assert.deepEqual(entry.hand_counts_after, source.handCountsAfter);
    assert.deepEqual(
      entry.cards,
      source.cards.map((c) => ({ rank_code: c.rankCode, suit_code: c.suitCode })),
    );
  });
});

test('buildRoundEventsPayload is pure: it does not mutate the input array', () => {
  const before = JSON.stringify(GAME.publicEvents);
  buildRoundEventsPayload('result-uuid-1', GAME.publicEvents);
  assert.equal(JSON.stringify(GAME.publicEvents), before);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/roundEventsPayload.test.ts`
Expected: FAIL（`./roundEventsPayload` モジュールが存在しない）

- [ ] **Step 3: `roundEventsPayload.ts` を実装する**

`apps/mobile/src/features/cpu-game/roundEventsPayload.ts`:

```ts
import type { PublicRoundEvent } from './turnDriver';

/** M3-SB-04 `round_events` の列に対応するペイロード。 */
export type RoundEventsPayload = {
  round_result_id: string;
  events: RoundEventPayloadEntry[];
};

export type RoundEventPayloadEntry = {
  index: number;
  seat_id: string;
  seat_kind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS';
  action_kind: PublicRoundEvent['actionKind'];
  cards: { rank_code: string; suit_code: string }[];
  skill_effect: PublicRoundEvent['skillEffect'];
  field_cleared: boolean;
  day_night_after: PublicRoundEvent['dayNightAfter'];
  hand_counts_after: Record<string, number>;
};

/**
 * `turnDriver` の `publicEvents`（内部の camelCase 表現）から
 * `round_events.events`（DB のスネークケース JSON 表現）へ変換する。
 * pure 関数。`round_result_id` は呼び出し側が `practice_round_results` への
 * insert 成功後に得る値を渡す（ネットワーク配線は次サブプロジェクト）。
 */
export function buildRoundEventsPayload(
  roundResultId: string,
  publicEvents: PublicRoundEvent[],
): RoundEventsPayload {
  return {
    round_result_id: roundResultId,
    events: publicEvents.map((event) => ({
      index: event.index,
      seat_id: event.seatId,
      seat_kind: event.seatKind,
      kind: event.kind,
      action_kind: event.actionKind,
      cards: event.cards.map((card) => ({ rank_code: card.rankCode, suit_code: card.suitCode })),
      skill_effect: event.skillEffect,
      field_cleared: event.fieldCleared,
      day_night_after: event.dayNightAfter,
      hand_counts_after: event.handCountsAfter,
    })),
  };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/roundEventsPayload.test.ts`
Expected: PASS（全テスト）

- [ ] **Step 5: モバイルの全テストに回帰がないことを確認する**

Run: `npm run mobile:test`
Expected: PASS（回帰なし）

- [ ] **Step 6: コミット**

```bash
git add apps/mobile/src/features/cpu-game/roundEventsPayload.ts apps/mobile/src/features/cpu-game/roundEventsPayload.test.ts
git commit -m "feat(mobile): [M3-SB-04] add buildRoundEventsPayload"
```

---

### Task 8: 進捗記録とフル確認（M3-SB-01〜04）

**Files:**
- Create: `docs/progress/M3-SB-01.md`
- Create: `docs/progress/M3-SB-02.md`
- Create: `docs/progress/M3-SB-03.md`
- Create: `docs/progress/M3-SB-04.md`

**Interfaces:**
- Consumes: Task 1〜7 の全成果物（マイグレーション・pgTAP・クライアントコード）。
- Produces: 進捗ドキュメント（既存 `docs/progress/M2-SB-01.md` と同じ書式：見出し・状態・日付・概要・成果物・確認・メモ）。

- [ ] **Step 1: フルスイートを実行する**

Run: `npm run db:reset`
Expected: 全マイグレーション成功

Run: `npx supabase test db supabase/tests/master_schema.sql supabase/tests/master_access.sql supabase/tests/master_integrity.sql supabase/tests/master_seed.sql supabase/tests/ruleset_version.sql supabase/tests/practice_round_results_schema.sql supabase/tests/practice_round_results_access.sql supabase/tests/players_and_stats_schema.sql supabase/tests/players_and_stats_access.sql supabase/tests/practice_round_results_stats_trigger.sql supabase/tests/practice_round_results_ruleset_link.sql supabase/tests/round_events_schema.sql supabase/tests/round_events_access.sql`
Expected: 全 PASS

Run: `npm run mobile:test`
Expected: 全 PASS

Run: `npm run game-core:test`
Expected: 全 PASS（回帰なし。game-core は今回変更していない）

- [ ] **Step 2: `docs/progress/M3-SB-01.md` を書く**

```markdown
# M3-SB-01 進捗

- TODO: M3-SB-01
- 状態: 完了
- 日付: 2026-09-02

## 概要

プレイヤー別のモード別統計（対局数・勝利数）を保持する `public.players` / `public.player_mode_stats` を追加した。`players` は匿名IDのみで識別する（M3 は認証前）。書き込みは `practice_round_results` への insert から自動発火するトリガのみ（クライアントは直接書けない）。読取は `get_player_mode_stats(anon_player_id, mode)` 関数経由。設計書 `docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md`。

## 成果物

| 種別 | パス |
| --- | --- |
| マイグレーション | `supabase/migrations/20260902090000_create_players_and_stats.sql` |
| マイグレーション | `supabase/migrations/20260902093000_add_practice_round_results_stats_trigger.sql` |
| DB test | `supabase/tests/players_and_stats_schema.sql` |
| DB test | `supabase/tests/players_and_stats_access.sql` |
| DB test | `supabase/tests/practice_round_results_stats_trigger.sql` |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run db:reset` | 全マイグレーション成功 |
| `npx supabase test db supabase/tests/players_and_stats_schema.sql` | PASS、25 tests |
| `npx supabase test db supabase/tests/players_and_stats_access.sql` | PASS、13 tests |
| `npx supabase test db supabase/tests/practice_round_results_stats_trigger.sql` | PASS、9 tests |

## メモ

- CPU の統計は集計しない（`local_won` はローカル人間視点の勝敗のみ）。CPU用の統計が必要になれば別設計が要る。
- クライアントからの読取配線・統計画面は M3-EX-05（次サブプロジェクト）。
```

- [ ] **Step 3: `docs/progress/M3-SB-02.md` を書く**

```markdown
# M3-SB-02 進捗

- TODO: M3-SB-02
- 状態: 完了
- 日付: 2026-09-02

## 概要

対局結果の二重登録防止キーは M2-SB-01 の `practice_round_results.client_result_id` UNIQUE 制約がそのまま担う。M3 で追加したのは、その保証が派生データ（`player_mode_stats`）にも及ぶことの証明である：統計更新トリガは `practice_round_results` への **insert が成功した行にのみ** 発火するため、`client_result_id` の重複による2回目の insert 失敗はトリガを発火させず、統計は二重加算されない。新規スキーマは追加していない。設計書 `docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md` §5。

## 成果物

| 種別 | パス |
| --- | --- |
| pgTAP による証明 | `supabase/tests/practice_round_results_stats_trigger.sql`（同一 `client_result_id` 再送で `player_mode_stats` が変化しないことを assert） |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npx supabase test db supabase/tests/practice_round_results_stats_trigger.sql` | PASS、9 tests（うち「resend does not change stats」がこの完了条件を直接検証） |

## メモ

- 新規テーブルなし。M3-SB-01 のトリガ実装（`20260902093000_add_practice_round_results_stats_trigger.sql`）が this TODO の実装そのもの。
```

- [ ] **Step 4: `docs/progress/M3-SB-03.md` を書く**

```markdown
# M3-SB-03 進捗

- TODO: M3-SB-03
- 状態: 完了（DB + クライアント整形関数。ネットワーク配線は次サブプロジェクト）
- 日付: 2026-09-02

## 概要

`practice_round_results` に適用ルール版を関連付ける `ruleset_id uuid`（`references public.rulesets(id)`）を追加した。既存クライアントを壊さないよう nullable のままとし、送信配線が完了してから NOT NULL 化を検討する。クライアント側は `buildPracticeResultPayload` が任意の `rulesetId` を受け取り `PracticeResultPayload.ruleset_id` へ渡す純関数を用意した（実際の `get_active_ruleset()` 呼び出しと配線は次サブプロジェクト）。設計書 `docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md` §4.4、§8.1。

## 成果物

| 種別 | パス |
| --- | --- |
| マイグレーション | `supabase/migrations/20260902100000_add_practice_round_results_ruleset_link.sql` |
| DB test | `supabase/tests/practice_round_results_ruleset_link.sql` |
| クライアント | `apps/mobile/src/features/cpu-game/resultModel.ts`（`ruleset_id` 追加） |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npx supabase test db supabase/tests/practice_round_results_ruleset_link.sql` | PASS、5 tests |
| `npm run mobile:test` | PASS（`resultModel.test.ts` に `ruleset_id` のケースを追加） |

## メモ

- `ruleset_id` は nullable。次サブプロジェクトで送信配線が完了した後、NOT NULL 化を別マイグレーションで検討する。
- DATA-M-006（ルール版変更後も過去対局を当時の意味で再現）に対応：カードマスタは既に `ruleset_id` で版管理済みのため、この列で対局結果からルール版を追跡できる。
```

- [ ] **Step 5: `docs/progress/M3-SB-04.md` を書く**

```markdown
# M3-SB-04 進捗

- TODO: M3-SB-04
- 状態: 完了（DB + クライアント整形関数。ネットワーク配線は次サブプロジェクト）
- 日付: 2026-09-02

## 概要

公開対局イベント（使用カード・使用スキル効果・場流し・昼夜）を1局1行の JSONB 配列で保存する `public.round_events` を追加した。`round_result_id` の UNIQUE により、`practice_round_results` と同じ冪等パターン（再送は 23505 で失敗＝クライアントは保存済み扱い）を持つ。非公開手札・未使用スキルは含めない（VIS-202）。クライアント側は `turnDriver.ts` に `publicEvents` の逐次記録を追加し、`roundEventsPayload.ts` が DB 送信形式へ変換する純関数を提供する（実際のネットワーク配線は次サブプロジェクト）。設計書 `docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md` §4.5、§8.2〜8.3。

## 成果物

| 種別 | パス |
| --- | --- |
| マイグレーション | `supabase/migrations/20260902103000_create_round_events.sql` |
| DB test | `supabase/tests/round_events_schema.sql` |
| DB test | `supabase/tests/round_events_access.sql` |
| クライアント | `apps/mobile/src/features/cpu-game/turnDriver.ts`（`PublicRoundEvent`、`DriverState.publicEvents`） |
| クライアント | `apps/mobile/src/features/cpu-game/roundEventsPayload.ts`（`buildRoundEventsPayload`） |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npx supabase test db supabase/tests/round_events_schema.sql` | PASS、10 tests |
| `npx supabase test db supabase/tests/round_events_access.sql` | PASS、10 tests |
| `npm run mobile:test` | PASS（`turnDriver.test.ts`／`roundEventsPayload.test.ts` に新規ケース） |

## メモ

- VIS-005／VIS-104／VIS-202 に対応：場が流れた後も使用済みカード・使用済みスキルを確認でき、行動時点で公開された情報だけを保持する。
- 履歴画面（M3-EX-04）・ネットワーク配線（`cpuGameStore` から `round_events`／`ruleset_id` 付き `practice_round_results` の POST）は次サブプロジェクトへ。
```

- [ ] **Step 6: `git diff --check` を確認する**

Run: `git diff --check`
Expected: 出力なし（末尾空白等の問題なし）

- [ ] **Step 7: コミット**

```bash
git add docs/progress/M3-SB-01.md docs/progress/M3-SB-02.md docs/progress/M3-SB-03.md docs/progress/M3-SB-04.md
git commit -m "docs(progress): [M3-SB-01..04] record Supabase stats/events sub-project completion"
```
