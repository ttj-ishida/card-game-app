begin;

select plan(9);

select has_table('public', 'online_play_requests', 'online_play_requests table exists');
select has_column('public', 'online_play_requests', 'request_id', 'online_play_requests has request_id');
select has_function(
  'public',
  'commit_friend_play',
  ARRAY['uuid', 'integer', 'uuid', 'text[]', 'text', 'jsonb', 'jsonb', 'boolean', 'uuid', 'text'],
  'request_id overload exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.create_friend_room('IDEMFLOW1', 2::smallint, 60::smallint, true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select public.join_friend_room('IDEMFLOW1');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select public.start_friend_round((select id from public.rooms where invite_code = 'IDEMFLOW1'));
reset role;

create temp table idem_fixture as
select
  r.id as round_id,
  ps.active_player_id as actor_player_id,
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
where room.invite_code = 'IDEMFLOW1';

select lives_ok(
  $$
    create temp table first_result as
    select public.commit_friend_play(
      (select round_id from idem_fixture),
      0,
      (select actor_player_id from idem_fixture),
      ARRAY[(select card_id from idem_fixture)]::text[],
      null::text,
      jsonb_build_object(
        'day_night', 'DAY',
        'active_player_id', (select actor_player_id::text from idem_fixture),
        'active_field', '{}'::jsonb,
        'hand_counts', jsonb_build_object((select actor_player_id::text from idem_fixture), 17)
      ),
      jsonb_build_object('event_kind', 'PLAY_ACCEPTED', 'request_id', 'idem-request-1'),
      false,
      null::uuid,
      'idem-request-1'
    ) as result
  $$,
  'first request is committed'
);

select lives_ok(
  $$
    create temp table retry_result as
    select public.commit_friend_play(
      (select round_id from idem_fixture),
      0,
      (select actor_player_id from idem_fixture),
      ARRAY[(select card_id from idem_fixture)]::text[],
      null::text,
      jsonb_build_object(
        'day_night', 'DAY',
        'active_player_id', (select actor_player_id::text from idem_fixture),
        'active_field', '{}'::jsonb,
        'hand_counts', '{}'::jsonb
      ),
      jsonb_build_object('event_kind', 'PLAY_ACCEPTED', 'request_id', 'idem-request-1'),
      false,
      null::uuid,
      'idem-request-1'
    ) as result
  $$,
  'retry with the same request id returns stored result'
);

select is((select result from retry_result), (select result from first_result), 'retry returns the original result payload');
select is((select count(*)::int from public.online_play_requests where round_id = (select round_id from idem_fixture)), 1, 'only one request ledger row exists');
select is((select count(*)::int from public.online_round_events where round_id = (select round_id from idem_fixture) and event_kind = 'PLAY_ACCEPTED'), 1, 'retry appends no duplicate event');
select is((select count(*)::int from public.round_hands where round_id = (select round_id from idem_fixture) and player_id = (select actor_player_id from idem_fixture) and card_state = 'PLAYED'), 1, 'retry consumes the card once');

select * from finish();

rollback;