begin;

select plan(10);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.create_friend_room('RLSROOMA', 2::smallint, 60::smallint, true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select public.join_friend_room('RLSROOMA');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.start_friend_round((select id from public.rooms where invite_code = 'RLSROOMA'));

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select public.create_friend_room('RLSROOMB', 2::smallint, 60::smallint, true);
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select public.join_friend_room('RLSROOMB');
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select public.start_friend_round((select id from public.rooms where invite_code = 'RLSROOMB'));
reset role;

create temp table rls_fixture as
select a.id as room_a_id,
       b.id as room_b_id,
       ra.id as round_a_id,
       rb.id as round_b_id,
       a_player.player_id as room_a_actor_player_id,
       b_player.player_id as room_a_other_player_id
  from public.rooms a
  join public.rooms b on b.invite_code = 'RLSROOMB'
  join public.rounds ra on ra.room_id = a.id
  join public.rounds rb on rb.room_id = b.id
  join public.round_players a_player
    on a_player.round_id = ra.id
   and a_player.auth_user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  join public.round_players b_player
    on b_player.round_id = ra.id
   and b_player.auth_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
 where a.invite_code = 'RLSROOMA';

grant select on rls_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select is(
  (select count(*)::int from public.rooms where id in ((select room_a_id from rls_fixture), (select room_b_id from rls_fixture))),
  1,
  'participant sees only their own room'
);

select is(
  (select invite_code from public.rooms where id in ((select room_a_id from rls_fixture), (select room_b_id from rls_fixture))),
  'RLSROOMA',
  'participant does not see another room invite code'
);

select is(
  (select count(*)::int from public.room_players where room_id in ((select room_a_id from rls_fixture), (select room_b_id from rls_fixture))),
  2,
  'participant sees only players in their room'
);

select is(
  (select count(*)::int from public.rounds where id in ((select round_a_id from rls_fixture), (select round_b_id from rls_fixture))),
  1,
  'participant sees only their own round'
);

select is(
  (select count(*)::int from public.round_players where round_id in ((select round_a_id from rls_fixture), (select round_b_id from rls_fixture))),
  2,
  'participant sees only seats in their round'
);

select is(
  (select count(*)::int from public.online_round_public_state where round_id in ((select round_a_id from rls_fixture), (select round_b_id from rls_fixture))),
  1,
  'participant sees only their round public state'
);

select is(
  (select count(*)::int from public.online_round_events where round_id in ((select round_a_id from rls_fixture), (select round_b_id from rls_fixture))),
  1,
  'participant sees only their round events'
);

select is(
  (select count(*)::int from public.round_hands where round_id = (select round_a_id from rls_fixture)),
  18,
  'participant sees only their own hand within the room'
);

select is(
  (select count(*)::int from public.round_skills where round_id = (select round_a_id from rls_fixture)),
  1,
  'participant sees only their own skill within the room'
);

select throws_ok(
  $$select public.get_friend_round_snapshot((select round_b_id from rls_fixture), null)$$,
  'P0001',
  NULL,
  'participant cannot fetch another round snapshot'
);

select * from finish();

rollback;
