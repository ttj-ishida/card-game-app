begin;

select plan(42);

select has_table('public', 'rooms', 'rooms table exists');
select has_column('public', 'rooms', 'invite_code', 'rooms has invite_code');
select col_not_null('public', 'rooms', 'invite_code', 'rooms invite_code is not null');
select has_column('public', 'rooms', 'host_player_id', 'rooms has host_player_id');
select col_type_is('public', 'rooms', 'host_player_id', 'uuid', 'host_player_id is uuid');
select has_column('public', 'rooms', 'status', 'rooms has status');
select col_default_is('public', 'rooms', 'status', 'WAITING', 'rooms status defaults to WAITING');
select has_column('public', 'rooms', 'max_players', 'rooms has max_players');
select col_type_is('public', 'rooms', 'max_players', 'smallint', 'rooms max_players is smallint');
select has_column('public', 'rooms', 'cpu_takeover_enabled', 'rooms has cpu_takeover_enabled');
select col_default_is('public', 'rooms', 'cpu_takeover_enabled', 'true', 'cpu takeover defaults to true');
select is(
  (select relrowsecurity from pg_class where oid = 'public.rooms'::regclass),
  true,
  'rooms row level security is enabled'
);

select has_table('public', 'room_players', 'room_players table exists');
select has_column('public', 'room_players', 'room_id', 'room_players has room_id');
select col_type_is('public', 'room_players', 'room_id', 'uuid', 'room_id is uuid');
select has_column('public', 'room_players', 'player_id', 'room_players has player_id');
select has_column('public', 'room_players', 'seat_index', 'room_players has seat_index');
select col_type_is('public', 'room_players', 'seat_index', 'smallint', 'seat_index is smallint');
select has_column('public', 'room_players', 'role', 'room_players has role');
select col_default_is('public', 'room_players', 'role', 'GUEST', 'role defaults to GUEST');
select is(
  (select relrowsecurity from pg_class where oid = 'public.room_players'::regclass),
  true,
  'room_players row level security is enabled'
);

select has_table('public', 'rounds', 'rounds table exists');
select has_column('public', 'rounds', 'room_id', 'rounds has room_id');
select has_column('public', 'rounds', 'round_number', 'rounds has round_number');
select col_default_is('public', 'rounds', 'round_number', '1', 'round_number defaults to 1');
select has_column('public', 'rounds', 'state_version', 'rounds has state_version');
select col_default_is('public', 'rounds', 'state_version', '0', 'state_version defaults to 0');
select has_column('public', 'rounds', 'player_count', 'rounds has player_count');
select col_type_is('public', 'rounds', 'player_count', 'smallint', 'rounds player_count is smallint');
select is(
  (select relrowsecurity from pg_class where oid = 'public.rounds'::regclass),
  true,
  'rounds row level security is enabled'
);

select has_table('public', 'round_players', 'round_players table exists');
select has_column('public', 'round_players', 'round_id', 'round_players has round_id');
select has_column('public', 'round_players', 'player_id', 'round_players has player_id');
select has_column('public', 'round_players', 'seat_index', 'round_players has seat_index');
select has_column('public', 'round_players', 'seat_kind', 'round_players has seat_kind');
select col_default_is('public', 'round_players', 'seat_kind', 'HUMAN', 'seat_kind defaults to HUMAN');
select is(
  (select relrowsecurity from pg_class where oid = 'public.round_players'::regclass),
  true,
  'round_players row level security is enabled'
);

set local role postgres;

select lives_ok(
  $$
  with host as (
    insert into public.players (anon_player_id)
    values ('m4-schema-host')
    returning id
  ),
  guest as (
    insert into public.players (anon_player_id)
    values ('m4-schema-guest')
    returning id
  ),
  room as (
    insert into public.rooms (invite_code, host_player_id, max_players)
    select 'ROOMSCHEMA1', id, 2 from host
    returning id
  ),
  seat1 as (
    insert into public.room_players (room_id, player_id, seat_index, role)
    select room.id, host.id, 0, 'HOST' from room, host
  ),
  seat2 as (
    insert into public.room_players (room_id, player_id, seat_index)
    select room.id, guest.id, 1 from room, guest
  ),
  round as (
    insert into public.rounds (room_id, player_count)
    select id, 2 from room
    returning id
  )
  insert into public.round_players (round_id, player_id, seat_index)
  select round.id, host.id, 0 from round, host
  union all
  select round.id, guest.id, 1 from round, guest
  $$,
  'a room and one round seating insert'
);

select throws_ok(
  $$
  insert into public.rooms (invite_code, host_player_id, max_players)
  select 'ROOMBADCOUNT', id, 1 from public.players where anon_player_id = 'm4-schema-host'
  $$,
  '23514',
  NULL,
  'rooms rejects max_players below 2'
);

select throws_ok(
  $$
  insert into public.room_players (room_id, player_id, seat_index)
  select r.id, p.id, 6 from public.rooms r, public.players p
  where r.invite_code = 'ROOMSCHEMA1' and p.anon_player_id = 'm4-schema-host'
  $$,
  '23514',
  NULL,
  'room_players rejects seat_index above 5'
);

select throws_ok(
  $$
  insert into public.room_players (room_id, player_id, seat_index)
  select r.id, p.id, 1 from public.rooms r, public.players p
  where r.invite_code = 'ROOMSCHEMA1' and p.anon_player_id = 'm4-schema-host'
  $$,
  '23505',
  NULL,
  'room_players rejects duplicate room seat'
);

select throws_ok(
  $$
  insert into public.rounds (room_id, player_count)
  select id, 7 from public.rooms where invite_code = 'ROOMSCHEMA1'
  $$,
  '23514',
  NULL,
  'rounds rejects player_count above 6'
);

select * from finish();

rollback;

