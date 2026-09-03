begin;

select plan(17);

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'rooms' and cmd = 'SELECT'),
  1,
  'rooms has one participant SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'room_players' and cmd = 'SELECT'),
  1,
  'room_players has one participant SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'rounds' and cmd = 'SELECT'),
  1,
  'rounds has one participant SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'round_players' and cmd = 'SELECT'),
  1,
  'round_players has one participant SELECT policy'
);

select ok(not has_table_privilege('anon', 'public.rooms', 'SELECT'), 'anon has no SELECT on rooms');
select ok(not has_table_privilege('anon', 'public.rooms', 'INSERT'), 'anon has no INSERT on rooms');
select ok(not has_table_privilege('anon', 'public.room_players', 'SELECT'), 'anon has no SELECT on room_players');
select ok(not has_table_privilege('anon', 'public.room_players', 'INSERT'), 'anon has no INSERT on room_players');
select ok(not has_table_privilege('anon', 'public.rounds', 'SELECT'), 'anon has no SELECT on rounds');
select ok(not has_table_privilege('anon', 'public.rounds', 'INSERT'), 'anon has no INSERT on rounds');
select ok(not has_table_privilege('anon', 'public.round_players', 'SELECT'), 'anon has no SELECT on round_players');
select ok(not has_table_privilege('anon', 'public.round_players', 'INSERT'), 'anon has no INSERT on round_players');

select ok(has_table_privilege('service_role', 'public.rooms', 'INSERT'), 'service_role can insert rooms');
select ok(has_table_privilege('service_role', 'public.room_players', 'INSERT'), 'service_role can insert room_players');
select ok(has_table_privilege('service_role', 'public.rounds', 'INSERT'), 'service_role can insert rounds');
select ok(has_table_privilege('service_role', 'public.round_players', 'INSERT'), 'service_role can insert round_players');

set local role anon;

select throws_ok(
  $$insert into public.rooms (invite_code, host_player_id, max_players)
    values ('ANONROOM', extensions.gen_random_uuid(), 2)$$,
  '42501',
  NULL,
  'anon cannot insert rooms'
);

reset role;

select * from finish();

rollback;
