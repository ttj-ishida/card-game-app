begin;

select plan(27);

select has_table('public', 'online_round_public_state', 'online_round_public_state table exists');
select has_column('public', 'online_round_public_state', 'round_id', 'public_state has round_id');
select has_column('public', 'online_round_public_state', 'state_version', 'public_state has state_version');
select col_default_is('public', 'online_round_public_state', 'state_version', '0', 'state_version defaults to 0');
select has_column('public', 'online_round_public_state', 'day_night', 'public_state has day_night');
select col_default_is('public', 'online_round_public_state', 'day_night', 'DAY', 'day_night defaults to DAY');
select has_column('public', 'online_round_public_state', 'active_player_id', 'public_state has active_player_id');
select has_column('public', 'online_round_public_state', 'active_field', 'public_state has active_field');
select col_default_is('public', 'online_round_public_state', 'active_field', '{}', 'active_field defaults to object');
select has_column('public', 'online_round_public_state', 'hand_counts', 'public_state has hand_counts');
select col_default_is('public', 'online_round_public_state', 'hand_counts', '{}', 'hand_counts defaults to object');
select is(
  (select relrowsecurity from pg_class where oid = 'public.online_round_public_state'::regclass),
  true,
  'online_round_public_state row level security is enabled'
);

select has_table('public', 'online_round_events', 'online_round_events table exists');
select has_column('public', 'online_round_events', 'round_id', 'online_round_events has round_id');
select has_column('public', 'online_round_events', 'event_seq', 'online_round_events has event_seq');
select has_column('public', 'online_round_events', 'state_version', 'online_round_events has state_version');
select has_column('public', 'online_round_events', 'event_kind', 'online_round_events has event_kind');
select has_column('public', 'online_round_events', 'actor_player_id', 'online_round_events has actor_player_id');
select has_column('public', 'online_round_events', 'public_payload', 'online_round_events has public_payload');
select is(
  (select relrowsecurity from pg_class where oid = 'public.online_round_events'::regclass),
  true,
  'online_round_events row level security is enabled'
);

select has_function('public', 'is_round_member', ARRAY['uuid'], 'round member helper exists');

set local role postgres;

select lives_ok(
  $$
  with p1 as (
    insert into public.players (anon_player_id)
    values ('m4-public-p1')
    returning id
  ),
  p2 as (
    insert into public.players (anon_player_id)
    values ('m4-public-p2')
    returning id
  ),
  room as (
    insert into public.rooms (invite_code, host_player_id, max_players)
    select 'PUBLICSTATE1', id, 2 from p1
    returning id
  ),
  round as (
    insert into public.rounds (room_id, player_count)
    select id, 2 from room
    returning id
  ),
  seats as (
    insert into public.round_players (round_id, player_id, seat_index, auth_user_id)
    select round.id, p1.id, 0, '11111111-1111-1111-1111-111111111111'::uuid from round, p1
    union all
    select round.id, p2.id, 1, '22222222-2222-2222-2222-222222222222'::uuid from round, p2
    returning round_id, player_id, seat_index
  ),
  state as (
    insert into public.online_round_public_state
      (round_id, state_version, active_player_id, active_field, hand_counts)
    select
      round.id,
      0,
      (select player_id from seats where seat_index = 0),
      '{"combination": null}'::jsonb,
      '{"0": 18, "1": 18}'::jsonb
    from round
  )
  insert into public.online_round_events
    (round_id, event_seq, state_version, event_kind, actor_player_id, public_payload)
  select
    seats.round_id,
    1,
    0,
    'ROUND_STARTED',
    null,
    '{"hand_counts": {"0": 18, "1": 18}}'::jsonb
  from seats
  limit 1
  $$,
  'public state and event insert'
);

select throws_ok(
  $$insert into public.online_round_public_state (round_id, active_field)
    select id, '[]'::jsonb from public.rounds limit 1$$,
  '23514',
  NULL,
  'public_state rejects non-object active_field'
);

select throws_ok(
  $$insert into public.online_round_events (round_id, event_seq, state_version, event_kind, public_payload)
    select id, 0, 0, 'BAD', '{}'::jsonb from public.rounds limit 1$$,
  '23514',
  NULL,
  'online_round_events rejects event_seq below 1'
);

select throws_ok(
  $$insert into public.online_round_events (round_id, event_seq, state_version, event_kind, public_payload)
    select id, 2, -1, 'BAD', '{}'::jsonb from public.rounds limit 1$$,
  '23514',
  NULL,
  'online_round_events rejects negative state_version'
);

select throws_ok(
  $$insert into public.online_round_events (round_id, event_seq, state_version, event_kind, public_payload)
    select id, 2, 0, 'BAD', '[]'::jsonb from public.rounds limit 1$$,
  '23514',
  NULL,
  'online_round_events rejects non-object payload'
);

select throws_ok(
  $$insert into public.online_round_events (round_id, event_seq, state_version, event_kind, public_payload)
    select id, 1, 0, 'DUPLICATE', '{}'::jsonb from public.rounds where id in (select round_id from public.online_round_events limit 1)$$,
  '23505',
  NULL,
  'online_round_events rejects duplicate sequence'
);

select * from finish();

rollback;

