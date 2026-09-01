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
