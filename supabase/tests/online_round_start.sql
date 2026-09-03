begin;

select plan(20);

select has_function('public', 'start_friend_round', ARRAY['uuid'], 'start_friend_round exists');
select ok(
  has_function_privilege('authenticated', 'public.start_friend_round(uuid)', 'EXECUTE'),
  'authenticated can execute start_friend_round'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select public.create_friend_room('STARTFLOW1', 3::smallint, 60::smallint, true);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select public.join_friend_room('STARTFLOW1');

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select public.join_friend_room('STARTFLOW1');

select throws_ok(
  $$select public.start_friend_round((select id from public.rooms where invite_code = 'STARTFLOW1'))$$,
  'P0001',
  NULL,
  'non host cannot start the round'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select lives_ok(
  $$select public.start_friend_round((select id from public.rooms where invite_code = 'STARTFLOW1'))$$,
  'host starts the round'
);

reset role;
set local role postgres;

select is((select status from public.rooms where invite_code = 'STARTFLOW1'), 'IN_ROUND', 'room moves to IN_ROUND');
select is((select count(*)::int from public.rounds), 1, 'one round is created');
select is((select player_count::int from public.rounds), 3, 'round records player count');
select is((select count(*)::int from public.round_players), 3, 'round seats are copied');
select is((select count(*)::int from public.round_hands), 36, 'all number cards are dealt');
select is((select count(distinct card_id)::int from public.round_hands), 36, 'each number card is dealt once');
select is((select count(*)::int from public.round_skills), 3, 'each player receives one skill');
select is((select count(*)::int from public.online_round_public_state), 1, 'public state is created');
select is((select day_night from public.online_round_public_state), 'DAY', 'round starts in DAY');
select is(
  (select count(*)::int from public.online_round_public_state, jsonb_each(hand_counts)),
  3,
  'public state exposes one hand count per player'
);
select is((select count(*)::int from public.online_round_events), 1, 'round started event is created');
select is((select event_kind from public.online_round_events), 'ROUND_STARTED', 'event kind is ROUND_STARTED');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select lives_ok(
  $$select public.start_friend_round((select id from public.rooms where invite_code = 'STARTFLOW1'))$$,
  'start round is idempotent after retry'
);
select is((select count(*)::int from public.rounds), 1, 'retry does not create another round');

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select public.create_friend_room('STARTNEED2', 3::smallint, 60::smallint, true);

select throws_ok(
  $$select public.start_friend_round((select id from public.rooms where invite_code = 'STARTNEED2'))$$,
  'P0001',
  NULL,
  'cannot start until the room is full'
);

select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

select throws_ok(
  $$select public.start_friend_round((select id from public.rooms where invite_code = 'STARTFLOW1'))$$,
  'P0001',
  NULL,
  'non member cannot start any round'
);

reset role;

select * from finish();

rollback;




