begin;

select plan(15);

select has_function(
  'public',
  'leave_friend_round',
  ARRAY['uuid', 'boolean'],
  'leave_friend_round exists'
);
select ok(
  has_function_privilege('authenticated', 'public.leave_friend_round(uuid, boolean)', 'EXECUTE'),
  'authenticated can execute leave_friend_round'
);
select ok(
  not has_function_privilege('anon', 'public.leave_friend_round(uuid, boolean)', 'EXECUTE'),
  'anon cannot execute leave_friend_round'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.create_friend_room('LEAVECPU1', 2::smallint, 60::smallint, true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select public.join_friend_room('LEAVECPU1');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.start_friend_round((select id from public.rooms where invite_code = 'LEAVECPU1'));

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select public.create_friend_room('LEAVEOUT1', 2::smallint, 60::smallint, false);
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select public.join_friend_room('LEAVEOUT1');
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select public.start_friend_round((select id from public.rooms where invite_code = 'LEAVEOUT1'));
reset role;

create temp table leave_fixture as
select cpu_room.id as cpu_room_id,
       cpu_round.id as cpu_round_id,
       cpu_guest.player_id as cpu_guest_player_id,
       out_room.id as out_room_id,
       out_round.id as out_round_id,
       out_host.player_id as out_host_player_id,
       out_guest.player_id as out_guest_player_id
  from public.rooms cpu_room
  join public.rounds cpu_round on cpu_round.room_id = cpu_room.id
  join public.round_players cpu_guest
    on cpu_guest.round_id = cpu_round.id
   and cpu_guest.auth_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
  join public.rooms out_room on out_room.invite_code = 'LEAVEOUT1'
  join public.rounds out_round on out_round.room_id = out_room.id
  join public.round_players out_host
    on out_host.round_id = out_round.id
   and out_host.auth_user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
  join public.round_players out_guest
    on out_guest.round_id = out_round.id
   and out_guest.auth_user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
 where cpu_room.invite_code = 'LEAVECPU1';

grant select on leave_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

select is(
  public.leave_friend_round((select cpu_round_id from leave_fixture), true)->>'status',
  'CPU_TAKEOVER',
  'leaver can hand their seat to CPU'
);

reset role;

select is(
  (select status from public.round_players where round_id = (select cpu_round_id from leave_fixture) and player_id = (select cpu_guest_player_id from leave_fixture)),
  'CPU_TAKEOVER',
  'round player is marked CPU takeover'
);
select is(
  (select seat_kind from public.round_players where round_id = (select cpu_round_id from leave_fixture) and player_id = (select cpu_guest_player_id from leave_fixture)),
  'CPU',
  'round player seat becomes CPU'
);
select is(
  (select status from public.rounds where id = (select cpu_round_id from leave_fixture)),
  'IN_PROGRESS',
  'CPU takeover keeps the round in progress'
);
select is(
  (select event_kind from public.online_round_events where round_id = (select cpu_round_id from leave_fixture) order by event_seq desc limit 1),
  'PLAYER_LEFT_CPU_TAKEOVER',
  'CPU takeover appends a public event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);

select is(
  public.leave_friend_round((select out_round_id from leave_fixture), false)->>'status',
  'OUT',
  'leaver can forfeit without CPU takeover'
);

reset role;

select is(
  (select status from public.round_players where round_id = (select out_round_id from leave_fixture) and player_id = (select out_guest_player_id from leave_fixture)),
  'OUT',
  'forfeiting player is out'
);
select is(
  (select count(*)::int from public.round_hands where round_id = (select out_round_id from leave_fixture) and player_id = (select out_guest_player_id from leave_fixture) and card_state = 'IN_HAND'),
  0,
  'forfeiting player hand is discarded'
);
select is(
  (select status from public.rounds where id = (select out_round_id from leave_fixture)),
  'COMPLETED',
  'two-player forfeit completes the round'
);
select ok(
  (select is_winner from public.round_players where round_id = (select out_round_id from leave_fixture) and player_id = (select out_host_player_id from leave_fixture)),
  'remaining player is winner after two-player forfeit'
);
select is(
  (select event_kind from public.online_round_events where round_id = (select out_round_id from leave_fixture) order by event_seq desc limit 1),
  'PLAYER_FORFEITED',
  'forfeit appends a public event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

select throws_ok(
  $$select public.leave_friend_round((select out_round_id from leave_fixture), true)$$,
  'P0001',
  NULL,
  'non participant cannot leave the round'
);

select * from finish();

rollback;
