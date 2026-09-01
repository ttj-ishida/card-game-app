begin;

select plan(25);

-- players: 存在・列・制約
select has_table('public', 'players', 'players table exists');
select has_column('public', 'players', 'anon_player_id', 'has anon_player_id');
select col_type_is('public', 'players', 'anon_player_id', 'text', 'anon_player_id is text');
select col_not_null('public', 'players', 'anon_player_id', 'anon_player_id is not null');
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'players'
      and c.contype = 'u'
      and c.conkey = array[
        (select attnum from pg_attribute
         where attrelid = 'public.players'::regclass
           and attname = 'anon_player_id')
      ]
  ),
  'anon_player_id has a unique constraint'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.players'::regclass),
  true,
  'players row level security is enabled'
);

-- player_mode_stats: 存在・列・制約
select has_table('public', 'player_mode_stats', 'player_mode_stats table exists');
select has_column('public', 'player_mode_stats', 'player_id', 'has player_id');
select col_type_is('public', 'player_mode_stats', 'player_id', 'uuid', 'player_id is uuid');
select col_not_null('public', 'player_mode_stats', 'player_id', 'player_id is not null');
select has_column('public', 'player_mode_stats', 'mode', 'has mode');
select col_not_null('public', 'player_mode_stats', 'mode', 'mode is not null');
select col_type_is('public', 'player_mode_stats', 'rounds_played', 'integer', 'rounds_played is integer');
select col_default_is('public', 'player_mode_stats', 'rounds_played', '0', 'rounds_played defaults to 0');
select col_type_is('public', 'player_mode_stats', 'rounds_won', 'integer', 'rounds_won is integer');
select col_default_is('public', 'player_mode_stats', 'rounds_won', '0', 'rounds_won defaults to 0');
select col_type_is('public', 'player_mode_stats', 'last_played_at', 'timestamp with time zone', 'last_played_at is timestamptz');
select col_is_null('public', 'player_mode_stats', 'last_played_at', 'last_played_at is nullable');
select is(
  (select relrowsecurity from pg_class where oid = 'public.player_mode_stats'::regclass),
  true,
  'player_mode_stats row level security is enabled'
);

-- CHECK 制約と PK の挙動（テーブル所有者で RLS を迂回）
set local role postgres;

select lives_ok(
  $$insert into public.players (anon_player_id) values ('schema-fixture-player')$$,
  'a player row inserts'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', 5, 6 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23514',
  NULL,
  'rounds_won greater than rounds_played is rejected'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', -1, 0 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23514',
  NULL,
  'negative rounds_played is rejected'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'PVP', 1, 0 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23514',
  NULL,
  'an unknown mode is rejected'
);

select lives_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', 3, 1 from public.players where anon_player_id = 'schema-fixture-player'$$,
  'a valid stats row inserts'
);

select throws_ok(
  $$insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won)
    select id, 'CPU_PRACTICE', 1, 0 from public.players where anon_player_id = 'schema-fixture-player'$$,
  '23505',
  NULL,
  'duplicate (player_id, mode) is rejected by the primary key'
);

reset role;

select * from finish();

rollback;
