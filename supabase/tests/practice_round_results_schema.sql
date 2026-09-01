begin;

select plan(35);

-- テーブル存在
select has_table('public', 'practice_round_results', 'practice_round_results table exists');

-- 列と型
select has_column('public', 'practice_round_results', 'id', 'has id');
select col_type_is('public', 'practice_round_results', 'id', 'uuid', 'id is uuid');
select col_type_is('public', 'practice_round_results', 'client_result_id', 'uuid', 'client_result_id is uuid');
select col_not_null('public', 'practice_round_results', 'client_result_id', 'client_result_id is not null');
select col_type_is('public', 'practice_round_results', 'anon_player_id', 'text', 'anon_player_id is text');
select col_not_null('public', 'practice_round_results', 'anon_player_id', 'anon_player_id is not null');
select col_type_is('public', 'practice_round_results', 'mode', 'text', 'mode is text');
select col_not_null('public', 'practice_round_results', 'mode', 'mode is not null');
select col_type_is('public', 'practice_round_results', 'player_count', 'smallint', 'player_count is smallint');
select col_not_null('public', 'practice_round_results', 'player_count', 'player_count is not null');
select col_type_is('public', 'practice_round_results', 'local_player_seat', 'smallint', 'local_player_seat is smallint');
select col_type_is('public', 'practice_round_results', 'winner_seat', 'smallint', 'winner_seat is smallint');
select col_type_is('public', 'practice_round_results', 'local_won', 'boolean', 'local_won is boolean');
select col_not_null('public', 'practice_round_results', 'local_won', 'local_won is not null');
select col_type_is('public', 'practice_round_results', 'turn_count', 'integer', 'turn_count is integer');
select col_type_is('public', 'practice_round_results', 'duration_ms', 'integer', 'duration_ms is integer');
select col_type_is('public', 'practice_round_results', 'round_seed', 'bigint', 'round_seed is bigint');
select col_is_null('public', 'practice_round_results', 'round_seed', 'round_seed is nullable');
select col_type_is('public', 'practice_round_results', 'recorded_at', 'timestamp with time zone', 'recorded_at is timestamptz');
select col_not_null('public', 'practice_round_results', 'recorded_at', 'recorded_at is not null');

-- 既定値
select col_default_is('public', 'practice_round_results', 'mode', 'CPU_PRACTICE', 'mode defaults to CPU_PRACTICE');

-- unique 制約
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'practice_round_results'
      and c.contype = 'u'
      and c.conkey = array[
        (select attnum from pg_attribute
         where attrelid = 'public.practice_round_results'::regclass
           and attname = 'client_result_id')
      ]
  ),
  'client_result_id has a unique constraint'
);

-- 索引
select has_index(
  'public', 'practice_round_results', 'practice_round_results_anon_player_id_idx',
  'anon_player_id index exists'
);

-- RLS 有効
select is(
  (select relrowsecurity from pg_class where oid = 'public.practice_round_results'::regclass),
  true,
  'row level security is enabled'
);

-- CHECK 制約の挙動（postgres ロールで直接検証。RLS を跨がない）
set local role postgres;

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 3, 0, 0, true, 20, 30000)$$,
  'a valid row inserts'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 1, 0, 0, true, 20, 30000)$$,
  '23514',
  NULL,
  'player_count below 2 is rejected'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 7, 0, 0, true, 20, 30000)$$,
  '23514',
  NULL,
  'player_count above 6 is rejected'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 4, 0, 4, false, 20, 30000)$$,
  '23514',
  NULL,
  'winner_seat outside 0..player_count-1 is rejected'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 3, 0, 1, true, 20, 30000)$$,
  '23514',
  NULL,
  'local_won inconsistent with winner_seat = local_player_seat is rejected'
);

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 3, 0, 1, false, 20, 30000)$$,
  'local_won=false with a different winner_seat inserts'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 3, 0, 0, true, -1, 30000)$$,
  '23514',
  NULL,
  'negative turn_count is rejected'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 3, 0, 0, true, 20, -1)$$,
  '23514',
  NULL,
  'negative duration_ms is rejected'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      (extensions.gen_random_uuid(), '', 3, 0, 0, true, 20, 30000)$$,
  '23514',
  NULL,
  'empty anon_player_id is rejected'
);

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms, round_seed)
    values
      (extensions.gen_random_uuid(), 'schema-fixture', 2, 1, 1, true, 15, 12000, 987654321)$$,
  'round_seed accepts a bigint value'
);

reset role;

select * from finish();

rollback;
