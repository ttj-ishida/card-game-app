begin;

select plan(16);

select has_function(
  'public',
  'commit_friend_play',
  ARRAY['uuid', 'integer', 'uuid', 'text[]', 'text', 'jsonb', 'jsonb', 'boolean', 'uuid'],
  'commit_friend_play exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.commit_friend_play(uuid, integer, uuid, text[], text, jsonb, jsonb, boolean, uuid)',
    'EXECUTE'
  ),
  'service_role can execute commit_friend_play'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.create_friend_room('COMMITFLOW1', 2::smallint, 60::smallint, true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select public.join_friend_room('COMMITFLOW1');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.start_friend_round((select id from public.rooms where invite_code = 'COMMITFLOW1'));
reset role;

create temp table commit_fixture as
select
  r.id as round_id,
  ps.active_player_id as actor_player_id,
  ps.state_version as state_version,
  (
    select h.card_id
    from public.round_hands h
    where h.round_id = r.id
      and h.player_id = ps.active_player_id
      and h.card_state = 'IN_HAND'
    order by h.position
    limit 1
  ) as card_id
from public.rooms room
join public.rounds r on r.room_id = room.id
join public.online_round_public_state ps on ps.round_id = r.id
where room.invite_code = 'COMMITFLOW1';

select lives_ok(
  $$
    create temp table commit_result as
    select public.commit_friend_play(
      (select round_id from commit_fixture),
      0,
      (select actor_player_id from commit_fixture),
      ARRAY[(select card_id from commit_fixture)]::text[],
      null::text,
      jsonb_build_object(
        'day_night', 'DAY',
        'active_player_id', (select actor_player_id::text from commit_fixture),
        'active_field', '{}'::jsonb,
        'hand_counts', jsonb_build_object((select actor_player_id::text from commit_fixture), 17)
      ),
      jsonb_build_object('event_kind', 'PLAY_ACCEPTED', 'card_count', 1),
      false,
      null::uuid
    ) as result
  $$,
  'state-version matched play commits atomically'
);

select is((select result->>'ok' from commit_result), 'true', 'commit result is ok');
select is((select state_version from public.online_round_public_state where round_id = (select round_id from commit_fixture)), 1, 'public state version increments');
select is((select state_version from public.rounds where id = (select round_id from commit_fixture)), 1, 'round state version mirrors public state');
select is(
  (select card_state from public.round_hands where round_id = (select round_id from commit_fixture) and card_id = (select card_id from commit_fixture)),
  'PLAYED',
  'played card leaves the hand'
);
select is((select count(*)::int from public.online_round_events where round_id = (select round_id from commit_fixture)), 2, 'accepted play appends one event after ROUND_STARTED');
select is((select event_kind from public.online_round_events where round_id = (select round_id from commit_fixture) and state_version = 1), 'PLAY_ACCEPTED', 'event kind is stored');
select is((select actor_player_id from public.online_round_events where round_id = (select round_id from commit_fixture) and state_version = 1), (select actor_player_id from commit_fixture), 'event actor is stored');

create temp table stale_fixture as
select h.card_id
from public.round_hands h
where h.round_id = (select round_id from commit_fixture)
  and h.player_id = (select actor_player_id from commit_fixture)
  and h.card_state = 'IN_HAND'
order by h.position
limit 1;

select lives_ok(
  $$
    create temp table stale_result as
    select public.commit_friend_play(
      (select round_id from commit_fixture),
      0,
      (select actor_player_id from commit_fixture),
      ARRAY[(select card_id from stale_fixture)]::text[],
      null::text,
      jsonb_build_object(
        'day_night', 'DAY',
        'active_player_id', (select actor_player_id::text from commit_fixture),
        'active_field', '{}'::jsonb,
        'hand_counts', '{}'::jsonb
      ),
      jsonb_build_object('event_kind', 'STALE_SHOULD_NOT_WRITE'),
      false,
      null::uuid
    ) as result
  $$,
  'stale state-version request returns without writes'
);

select is((select result->>'ok' from stale_result), 'false', 'stale result is not ok');
select is((select result->>'reason' from stale_result), 'STALE_STATE_VERSION', 'stale result reports state version conflict');
select is((select state_version from public.online_round_public_state where round_id = (select round_id from commit_fixture)), 1, 'stale request leaves public state version unchanged');
select is((select card_state from public.round_hands where round_id = (select round_id from commit_fixture) and card_id = (select card_id from stale_fixture)), 'IN_HAND', 'stale request does not consume another card');
select is((select count(*)::int from public.online_round_events where round_id = (select round_id from commit_fixture)), 2, 'stale request appends no event');

select * from finish();

rollback;