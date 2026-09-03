begin;

select plan(16);

select ok(not has_table_privilege('anon', 'public.round_hands', 'SELECT'), 'anon has no SELECT on round_hands');
select ok(not has_table_privilege('anon', 'public.round_skills', 'SELECT'), 'anon has no SELECT on round_skills');
select ok(has_table_privilege('authenticated', 'public.round_hands', 'SELECT'), 'authenticated can SELECT round_hands through RLS');
select ok(has_table_privilege('authenticated', 'public.round_skills', 'SELECT'), 'authenticated can SELECT round_skills through RLS');
select ok(not has_table_privilege('authenticated', 'public.round_hands', 'INSERT'), 'authenticated cannot INSERT round_hands');
select ok(not has_table_privilege('authenticated', 'public.round_skills', 'UPDATE'), 'authenticated cannot UPDATE round_skills');
select ok(has_table_privilege('service_role', 'public.round_hands', 'INSERT'), 'service_role can INSERT round_hands');
select ok(has_table_privilege('service_role', 'public.round_skills', 'UPDATE'), 'service_role can UPDATE round_skills');

set local role postgres;

with
  p1 as (
    insert into public.players (anon_player_id)
    values ('m4-private-access-p1')
    returning id
  ),
  p2 as (
    insert into public.players (anon_player_id)
    values ('m4-private-access-p2')
    returning id
  ),
  room as (
    insert into public.rooms (invite_code, host_player_id, max_players)
    select 'PRIVATEACCESS1', id, 2 from p1
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
  cards as (
    select card_id, row_number() over (order by sort_order) - 1 as rn
    from public.number_cards
    order by sort_order
    limit 2
  ),
  skills as (
    select skill_id, row_number() over (order by sort_order) - 1 as rn
    from public.skill_cards
    order by sort_order
    limit 2
  ),
  hand_insert as (
    insert into public.round_hands (round_id, player_id, card_id, position)
    select seats.round_id, seats.player_id, cards.card_id, 0
    from seats
    join cards on cards.rn = seats.seat_index
  )
insert into public.round_skills (round_id, player_id, skill_id)
select seats.round_id, seats.player_id, skills.skill_id
from seats
join skills on skills.rn = seats.seat_index;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is((select count(*)::int from public.round_hands), 1, 'player 1 sees only their hand');
select is((select count(*)::int from public.round_skills), 1, 'player 1 sees only their skill');
select ok(
  (select bool_and(public.is_round_player_owner(round_id, player_id)) from public.round_hands),
  'player 1 hand rows belong to player 1'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select is((select count(*)::int from public.round_hands), 1, 'player 2 sees only their hand');
select is((select count(*)::int from public.round_skills), 1, 'player 2 sees only their skill');

select throws_ok(
  $$insert into public.round_hands (round_id, player_id, card_id, position)
    values (extensions.gen_random_uuid(), extensions.gen_random_uuid(), 'N1', 0)$$,
  '42501',
  NULL,
  'authenticated cannot insert hand rows'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.round_hands$$,
  '42501',
  NULL,
  'anon cannot select hand rows'
);
select throws_ok(
  $$select * from public.round_skills$$,
  '42501',
  NULL,
  'anon cannot select skill rows'
);

reset role;

select * from finish();

rollback;


