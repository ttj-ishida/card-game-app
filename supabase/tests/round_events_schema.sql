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
