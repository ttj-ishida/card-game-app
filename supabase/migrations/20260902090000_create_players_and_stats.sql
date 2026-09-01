-- M3-SB-01: プレイヤー別統計の土台。players は匿名IDのみ（認証前）。
-- player_mode_stats はモード別の対局数・勝利数を保持する（勝率は読取時計算）。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md

create table public.players (
  id             uuid primary key default extensions.gen_random_uuid(),
  anon_player_id text not null,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  constraint players_anon_player_id_key unique (anon_player_id),
  constraint players_anon_player_id_check check (anon_player_id <> '')
);

create table public.player_mode_stats (
  player_id      uuid not null references public.players(id) on delete cascade,
  mode           text not null,
  rounds_played  integer not null default 0,
  rounds_won     integer not null default 0,
  last_played_at timestamptz,
  constraint player_mode_stats_pkey primary key (player_id, mode),
  constraint player_mode_stats_mode_check check (mode in ('CPU_PRACTICE')),
  constraint player_mode_stats_rounds_played_check check (rounds_played >= 0),
  constraint player_mode_stats_rounds_won_check
    check (rounds_won >= 0 and rounds_won <= rounds_played)
);

comment on table public.players is
  '匿名プレイヤーID（端末生成）の台帳。M3 は認証前のため anon_player_id だけで識別する。認証導入時に auth.uid() へ移行。';
comment on table public.player_mode_stats is
  'モード別の対局数・勝利数。practice_round_results への insert 時にトリガで自動更新される（クライアントは直接書き込まない）。勝率は読取時に計算する。';

alter table public.players enable row level security;
alter table public.player_mode_stats enable row level security;

revoke all on table public.players from public, anon, authenticated;
revoke all on table public.player_mode_stats from public, anon, authenticated;

grant select on table public.players to anon, authenticated;
grant select on table public.player_mode_stats to anon, authenticated;
grant all on table public.players to service_role;
grant all on table public.player_mode_stats to service_role;

create policy players_select_client
  on public.players
  for select
  to anon, authenticated
  using (true);

create policy player_mode_stats_select_client
  on public.player_mode_stats
  for select
  to anon, authenticated
  using (true);
