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
