-- M2-SB-01: CPU練習1局の結果を保存するテーブル。
-- 設計書: docs/superpowers/specs/2026-09-01-m2-practice-round-results-design.md
-- pgcrypto は 20260828130000_create_card_masters.sql で extensions スキーマに作成済み。

create table public.practice_round_results (
  id                uuid primary key default extensions.gen_random_uuid(),
  client_result_id  uuid not null,
  anon_player_id    text not null,
  mode              text not null default 'CPU_PRACTICE',
  player_count      smallint not null,
  local_player_seat smallint not null,
  winner_seat       smallint not null,
  local_won         boolean not null,
  turn_count        integer not null,
  duration_ms       integer not null,
  round_seed        bigint,
  recorded_at       timestamptz not null default now(),

  constraint practice_round_results_client_result_id_key unique (client_result_id),
  constraint practice_round_results_mode_check
    check (mode in ('CPU_PRACTICE')),
  constraint practice_round_results_player_count_check
    check (player_count between 2 and 6),
  constraint practice_round_results_local_seat_check
    check (local_player_seat >= 0 and local_player_seat < player_count),
  constraint practice_round_results_winner_seat_check
    check (winner_seat >= 0 and winner_seat < player_count),
  constraint practice_round_results_local_won_check
    check (local_won = (winner_seat = local_player_seat)),
  constraint practice_round_results_turn_count_check
    check (turn_count >= 0),
  constraint practice_round_results_duration_ms_check
    check (duration_ms >= 0),
  constraint practice_round_results_anon_player_id_check
    check (anon_player_id <> '')
);

create index practice_round_results_anon_player_id_idx
  on public.practice_round_results (anon_player_id, recorded_at desc);

comment on table public.practice_round_results is
  'CPU練習1局の結果（集計値のみ）。手札・カードIDは保存しない。M2はゲスト運用のため行レベルのプレイヤー隔離なし。';
comment on column public.practice_round_results.client_result_id is
  'クライアント生成の冪等キー。オフライン再送で二重登録を防ぐ（M2-EX-09）。';
comment on column public.practice_round_results.anon_player_id is
  '端末生成の匿名プレイヤーID（M2-SB-02）。M3で players テーブルへ移行予定。';
comment on column public.practice_round_results.round_seed is
  'playRound の seed。局面の完全再現用。M2では nullable。';

-- アクセス制御: 既存マスタ表と同じ流儀。
alter table public.practice_round_results enable row level security;

revoke all on table public.practice_round_results from public, anon, authenticated;

grant select, insert on table public.practice_round_results to anon, authenticated;
grant all on table public.practice_round_results to service_role;

-- M2 は認証前のため、行を送信元プレイヤーに縛れない（auth.uid() が無い）。
-- with check (true) / using (true) は M2 の意図的な割り切り。認証導入時に狭める。
create policy practice_round_results_insert_client
  on public.practice_round_results
  for insert
  to anon, authenticated
  with check (true);

create policy practice_round_results_select_client
  on public.practice_round_results
  for select
  to anon, authenticated
  using (true);
