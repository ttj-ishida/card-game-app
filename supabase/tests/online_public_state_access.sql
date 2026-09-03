begin;

select plan(17);

select ok(not has_table_privilege('anon', 'public.online_round_public_state', 'SELECT'), 'anon has no SELECT on public state');
select ok(not has_table_privilege('anon', 'public.online_round_events', 'SELECT'), 'anon has no SELECT on events');
select ok(has_table_privilege('authenticated', 'public.online_round_public_state', 'SELECT'), 'authenticated can SELECT public state through RLS');
select ok(has_table_privilege('authenticated', 'public.online_round_events', 'SELECT'), 'authenticated can SELECT events through RLS');
select ok(not has_table_privilege('authenticated', 'public.online_round_public_state', 'INSERT'), 'authenticated cannot INSERT public state');
select ok(not has_table_privilege('authenticated', 'public.online_round_events', 'INSERT'), 'authenticated cannot INSERT events');
select ok(has_table_privilege('service_role', 'public.online_round_public_state', 'UPDATE'), 'service_role can UPDATE public state');
select ok(has_table_privilege('service_role', 'public.online_round_events', 'INSERT'), 'service_role can INSERT events');

set local role postgres;

with
  p1 as (
    insert into public.players (anon_player_id)
    values ('m4-public-access-p1')
    returning id
  ),
  p2 as (
    insert into public.players (anon_player_id)
    values ('m4-public-access-p2')
    returning id
  ),
  outsider as (
    insert into public.players (anon_player_id)
    values ('m4-public-access-outsider')
    returning id
  ),
  room as (
    insert into public.rooms (invite_code, host_player_id, max_players)
    select 'PUBLICACCESS1', id, 2 from p1
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
    union all
    select round.id, outsider.id, 5, null from round, outsider
    returning round_id, player_id, seat_index
  ),
  state as (
    insert into public.online_round_public_state
      (round_id, state_version, active_player_id, hand_counts)
    select
      round.id,
      0,
      (select player_id from seats where seat_index = 0),
      '{"0": 18, "1": 18}'::jsonb
    from round
  )
insert into public.online_round_events
  (round_id, event_seq, state_version, event_kind, public_payload)
select seats.round_id, 1, 0, 'ROUND_STARTED', '{"hand_counts": {"0": 18, "1": 18}}'::jsonb
from seats
limit 1;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is((select count(*)::int from public.online_round_public_state), 1, 'participant sees public state');
select is((select count(*)::int from public.online_round_events), 1, 'participant sees public events');
select ok((select bool_and(jsonb_typeof(hand_counts) = 'object') from public.online_round_public_state), 'hand_counts are public object counts');
select ok((select bool_and(not public_payload ? 'hands') from public.online_round_events), 'public events do not expose private hands key');

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select is((select count(*)::int from public.online_round_public_state), 0, 'non participant sees no public state');
select is((select count(*)::int from public.online_round_events), 0, 'non participant sees no events');

select throws_ok(
  $$insert into public.online_round_events (round_id, event_seq, state_version, event_kind, public_payload)
    values (extensions.gen_random_uuid(), 1, 0, 'CHEAT', '{}'::jsonb)$$,
  '42501',
  NULL,
  'authenticated cannot insert public events'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.online_round_public_state$$,
  '42501',
  NULL,
  'anon cannot select public state'
);
select throws_ok(
  $$select * from public.online_round_events$$,
  '42501',
  NULL,
  'anon cannot select public events'
);

reset role;

select * from finish();

rollback;

