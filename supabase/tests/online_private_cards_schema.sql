begin;

select plan(27);

select has_column('public', 'room_players', 'auth_user_id', 'room_players has auth_user_id');
select col_type_is('public', 'room_players', 'auth_user_id', 'uuid', 'room_players auth_user_id is uuid');
select has_column('public', 'round_players', 'auth_user_id', 'round_players has auth_user_id');
select col_type_is('public', 'round_players', 'auth_user_id', 'uuid', 'round_players auth_user_id is uuid');

select has_table('public', 'round_hands', 'round_hands table exists');
select has_column('public', 'round_hands', 'round_id', 'round_hands has round_id');
select has_column('public', 'round_hands', 'player_id', 'round_hands has player_id');
select has_column('public', 'round_hands', 'card_id', 'round_hands has card_id');
select col_type_is('public', 'round_hands', 'card_id', 'text', 'round_hands card_id is text');
select has_column('public', 'round_hands', 'position', 'round_hands has position');
select col_type_is('public', 'round_hands', 'position', 'smallint', 'round_hands position is smallint');
select has_column('public', 'round_hands', 'card_state', 'round_hands has card_state');
select col_default_is('public', 'round_hands', 'card_state', 'IN_HAND', 'card_state defaults to IN_HAND');
select is(
  (select relrowsecurity from pg_class where oid = 'public.round_hands'::regclass),
  true,
  'round_hands row level security is enabled'
);

select has_table('public', 'round_skills', 'round_skills table exists');
select has_column('public', 'round_skills', 'round_id', 'round_skills has round_id');
select has_column('public', 'round_skills', 'player_id', 'round_skills has player_id');
select has_column('public', 'round_skills', 'skill_id', 'round_skills has skill_id');
select col_type_is('public', 'round_skills', 'skill_id', 'text', 'round_skills skill_id is text');
select has_column('public', 'round_skills', 'used', 'round_skills has used');
select col_default_is('public', 'round_skills', 'used', 'false', 'round_skills used defaults to false');
select is(
  (select relrowsecurity from pg_class where oid = 'public.round_skills'::regclass),
  true,
  'round_skills row level security is enabled'
);

select has_function(
  'public',
  'is_round_player_owner',
  ARRAY['uuid', 'uuid'],
  'owner check helper exists'
);

set local role postgres;

select lives_ok(
  $$
  with host as (
    insert into public.players (anon_player_id)
    values ('m4-private-host')
    returning id
  ),
  room as (
    insert into public.rooms (invite_code, host_player_id, max_players)
    select 'PRIVATE1', id, 2 from host
    returning id
  ),
  round as (
    insert into public.rounds (room_id, player_count)
    select id, 2 from room
    returning id
  ),
  seat as (
    insert into public.round_players (round_id, player_id, seat_index, auth_user_id)
    select round.id, host.id, 0, '11111111-1111-1111-1111-111111111111'::uuid from round, host
    returning round_id, player_id
  ),
  hand as (
    insert into public.round_hands (round_id, player_id, card_id, position)
    select seat.round_id, seat.player_id, nc.card_id, 0
    from seat, public.number_cards nc
    order by nc.sort_order
    limit 1
  )
  insert into public.round_skills (round_id, player_id, skill_id)
  select seat.round_id, seat.player_id, sc.skill_id
  from seat, public.skill_cards sc
  order by sc.sort_order
  limit 1
  $$,
  'a private hand and skill insert'
);

select throws_ok(
  $$
  insert into public.round_hands (round_id, player_id, card_id, position)
  select round_id, player_id, card_id, -1 from public.round_hands limit 1
  $$,
  '23514',
  NULL,
  'round_hands rejects a negative position'
);

select throws_ok(
  $$
  insert into public.round_skills (round_id, player_id, skill_id, used, consumed_at)
  select round_id, player_id, skill_id, false, now() from public.round_skills limit 1
  $$,
  '23514',
  NULL,
  'round_skills rejects consumed_at while unused'
);

select throws_ok(
  $$
  insert into public.round_skills (round_id, player_id, skill_id)
  select round_id, player_id, skill_id from public.round_skills limit 1
  $$,
  '23505',
  NULL,
  'round_skills rejects duplicate skill ownership'
);

select * from finish();

rollback;
