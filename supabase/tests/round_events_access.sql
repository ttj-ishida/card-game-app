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
