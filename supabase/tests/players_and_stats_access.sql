begin;

select plan(13);

-- policy 構成: SELECT のみ、他は 0
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'players' and cmd = 'SELECT'),
  1,
  'players: exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'players' and cmd <> 'SELECT'),
  0,
  'players: no INSERT / UPDATE / DELETE policies'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'player_mode_stats' and cmd = 'SELECT'),
  1,
  'player_mode_stats: exactly one SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'player_mode_stats' and cmd <> 'SELECT'),
  0,
  'player_mode_stats: no INSERT / UPDATE / DELETE policies'
);

-- テーブル権限
select ok(has_table_privilege('anon', 'public.players', 'SELECT'), 'anon has SELECT on players');
select ok(not has_table_privilege('anon', 'public.players', 'INSERT'), 'anon has no INSERT on players');
select ok(not has_table_privilege('anon', 'public.players', 'UPDATE'), 'anon has no UPDATE on players');
select ok(has_table_privilege('anon', 'public.player_mode_stats', 'SELECT'), 'anon has SELECT on player_mode_stats');
select ok(not has_table_privilege('anon', 'public.player_mode_stats', 'INSERT'), 'anon has no INSERT on player_mode_stats');
select ok(has_table_privilege('service_role', 'public.players', 'INSERT'), 'service_role has INSERT on players');
select ok(has_table_privilege('service_role', 'public.player_mode_stats', 'UPDATE'), 'service_role has UPDATE on player_mode_stats');

-- anon の実操作
set local role anon;

select throws_ok(
  $$insert into public.players (anon_player_id) values ('anon-cannot-insert')$$,
  '42501',
  NULL,
  'anon cannot insert into players'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode) values (extensions.gen_random_uuid(), 'CPU_PRACTICE')$$,
  '42501',
  NULL,
  'anon cannot insert into player_mode_stats'
);

reset role;

select * from finish();

rollback;
