begin;

select plan(18);

select has_function(
  'public',
  'create_friend_room',
  ARRAY['text', 'smallint', 'smallint', 'boolean'],
  'create_friend_room exists'
);
select has_function(
  'public',
  'join_friend_room',
  ARRAY['text'],
  'join_friend_room exists'
);
select has_function(
  'public',
  'leave_friend_room',
  ARRAY['uuid'],
  'leave_friend_room exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_friend_room(text, smallint, smallint, boolean)',
    'EXECUTE'
  ),
  'authenticated can execute create_friend_room'
);
select ok(
  has_function_privilege(
    'anon',
    'public.create_friend_room(text, smallint, smallint, boolean)',
    'EXECUTE'
  ),
  'anon reaches the RPC auth guard'
);

set local role anon;

select throws_ok(
  $$select public.create_friend_room('ANONCREATE', 2::smallint, 60::smallint, true)$$,
  'P0001',
  NULL,
  'anon cannot create a room without auth.uid()'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select lives_ok(
  $$select public.create_friend_room('ROOMFLOW1', 2::smallint, 60::smallint, true)$$,
  'authenticated host creates a room'
);

select is(
  (select count(*)::int from public.rooms),
  1,
  'host can see their created room through RLS'
);

select is(
  (select (public.create_friend_room('ROOMFLOW1', 2::smallint, 60::smallint, true)->>'seat_index')::int),
  0,
  'creating the same invite code by the same host is idempotent'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

select is(
  (select (public.join_friend_room('ROOMFLOW1')->>'seat_index')::int),
  1,
  'guest joins the next open seat'
);

select is(
  (select count(*)::int from public.room_players),
  2,
  'duplicate join does not create a third seat'
);

select is(
  (select (public.join_friend_room('ROOMFLOW1')->>'seat_index')::int),
  1,
  'joining the same room again returns the existing seat'
);

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);

select throws_ok(
  $$select public.join_friend_room('ROOMFLOW1')$$,
  'P0001',
  NULL,
  'joining a full room is rejected'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

select is(
  (select public.leave_friend_room(id)->>'status' from public.rooms where invite_code = 'ROOMFLOW1'),
  'LEFT',
  'guest leaves the room'
);

reset role;
set local role postgres;

select is(
  (select count(*)::int from public.room_players where status = 'LEFT'),
  1,
  'one room player is marked left'
);

reset role;
set local role authenticated;

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);

select throws_ok(
  $$select public.leave_friend_room((select id from public.rooms where invite_code = 'ROOMFLOW1'))$$,
  'P0001',
  NULL,
  'non member cannot leave the room'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

select is(
  (select (public.join_friend_room('ROOMFLOW1')->>'seat_index')::int),
  1,
  'left player can rejoin their previous room seat while waiting'
);

select is(
  (select count(*)::int from public.room_players),
  2,
  'rejoin reuses the previous row'
);

reset role;

select * from finish();

rollback;


