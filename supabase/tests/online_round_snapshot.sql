begin;

select plan(11);

select has_function(
  'public',
  'get_friend_round_snapshot',
  ARRAY['uuid', 'integer'],
  'get_friend_round_snapshot exists'
);

select ok(
  has_function_privilege('authenticated', 'public.get_friend_round_snapshot(uuid, integer)', 'EXECUTE'),
  'authenticated can execute get_friend_round_snapshot'
);
select ok(
  not has_function_privilege('anon', 'public.get_friend_round_snapshot(uuid, integer)', 'EXECUTE'),
  'anon cannot execute get_friend_round_snapshot'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.create_friend_room('SNAPFLOW1', 2::smallint, 60::smallint, true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select public.join_friend_room('SNAPFLOW1');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.start_friend_round((select id from public.rooms where invite_code = 'SNAPFLOW1'));
reset role;

create temp table snapshot_fixture as
select r.id as round_id,
       p1.player_id as player_one_id,
       p2.player_id as player_two_id
  from public.rounds r
  join public.round_players p1
    on p1.round_id = r.id
   and p1.auth_user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  join public.round_players p2
    on p2.round_id = r.id
   and p2.auth_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
 where r.room_id = (select id from public.rooms where invite_code = 'SNAPFLOW1');

grant select on snapshot_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select is(
  (public.get_friend_round_snapshot((select round_id from snapshot_fixture), null)->>'round_id'),
  (select round_id::text from snapshot_fixture),
  'snapshot returns requested round id'
);

select is(
  (public.get_friend_round_snapshot((select round_id from snapshot_fixture), null)->>'player_id'),
  (select player_one_id::text from snapshot_fixture),
  'snapshot returns caller player id'
);

select is(
  jsonb_array_length(public.get_friend_round_snapshot((select round_id from snapshot_fixture), null)->'hand'),
  18,
  'snapshot includes only caller current hand'
);

select is(
  jsonb_array_length(public.get_friend_round_snapshot((select round_id from snapshot_fixture), null)->'skills'),
  1,
  'snapshot includes caller skill'
);

select is(
  jsonb_array_length(public.get_friend_round_snapshot((select round_id from snapshot_fixture), null)->'events'),
  1,
  'snapshot includes current event log when no cursor is given'
);

select is(
  jsonb_array_length(public.get_friend_round_snapshot((select round_id from snapshot_fixture), 0)->'events'),
  0,
  'snapshot filters events after the requested state version'
);

select ok(
  not exists (
    select 1
      from jsonb_array_elements(public.get_friend_round_snapshot((select round_id from snapshot_fixture), null)->'hand') h
      join public.round_hands rh
        on rh.round_id = (select round_id from snapshot_fixture)
       and rh.player_id = (select player_two_id from snapshot_fixture)
       and rh.card_id = h->>'card_id'
  ),
  'snapshot does not expose another player hand'
);

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);

select throws_ok(
  $$select public.get_friend_round_snapshot((select round_id from snapshot_fixture), null)$$,
  'P0001',
  NULL,
  'non participant cannot fetch snapshot'
);

select * from finish();

rollback;
