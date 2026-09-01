begin;

select plan(20);

-- policy 構成: insert / select のみ、他は 0
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'practice_round_results' and cmd = 'INSERT'),
  1,
  'exactly one INSERT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'practice_round_results' and cmd = 'SELECT'),
  1,
  'exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'practice_round_results' and cmd not in ('INSERT', 'SELECT')),
  0,
  'no UPDATE / DELETE / ALL policies'
);

-- テーブル権限
select ok(has_table_privilege('anon', 'public.practice_round_results', 'SELECT'), 'anon has SELECT');
select ok(has_table_privilege('anon', 'public.practice_round_results', 'INSERT'), 'anon has INSERT');
select ok(not has_table_privilege('anon', 'public.practice_round_results', 'UPDATE'), 'anon has no UPDATE');
select ok(not has_table_privilege('anon', 'public.practice_round_results', 'DELETE'), 'anon has no DELETE');
select ok(has_table_privilege('authenticated', 'public.practice_round_results', 'SELECT'), 'authenticated has SELECT');
select ok(has_table_privilege('authenticated', 'public.practice_round_results', 'INSERT'), 'authenticated has INSERT');
select ok(not has_table_privilege('authenticated', 'public.practice_round_results', 'UPDATE'), 'authenticated has no UPDATE');
select ok(not has_table_privilege('authenticated', 'public.practice_round_results', 'DELETE'), 'authenticated has no DELETE');
select ok(has_table_privilege('service_role', 'public.practice_round_results', 'DELETE'), 'service_role has DELETE');

-- anon の実操作
set local role anon;

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      ('11111111-1111-4111-8111-111111111111', 'test-device-1', 3, 0, 0, true, 20, 30000)$$,
  'anon can insert a valid result'
);

select is(
  (select count(*)::int from public.practice_round_results where anon_player_id = 'test-device-1'),
  1,
  'anon can select the row it inserted'
);

select throws_ok(
  $$update public.practice_round_results set turn_count = 99 where anon_player_id = 'test-device-1'$$,
  '42501',
  NULL,
  'anon cannot update'
);

select throws_ok(
  $$delete from public.practice_round_results where anon_player_id = 'test-device-1'$$,
  '42501',
  NULL,
  'anon cannot delete'
);

select throws_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      ('11111111-1111-4111-8111-111111111111', 'test-device-1', 4, 1, 1, true, 25, 40000)$$,
  '23505',
  NULL,
  'a duplicate client_result_id is rejected'
);

reset role;

-- service_role は全操作可
set local role service_role;

select lives_ok(
  $$insert into public.practice_round_results
      (client_result_id, anon_player_id, player_count, local_player_seat, winner_seat, local_won, turn_count, duration_ms)
    values
      ('22222222-2222-4222-8222-222222222222', 'test-device-2', 5, 2, 3, false, 30, 50000)$$,
  'service_role can insert'
);
select lives_ok(
  $$update public.practice_round_results set turn_count = 31 where anon_player_id = 'test-device-2'$$,
  'service_role can update'
);
select lives_ok(
  $$delete from public.practice_round_results where anon_player_id = 'test-device-2'$$,
  'service_role can delete'
);

reset role;

select * from finish();

rollback;
