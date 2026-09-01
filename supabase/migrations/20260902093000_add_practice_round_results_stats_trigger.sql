-- M3-SB-01 / M3-SB-02: practice_round_results への insert から
-- players / player_mode_stats を自動更新するトリガ。
-- insert が成功した行にのみ発火するため、client_result_id UNIQUE 違反による
-- 再送（2回目の insert 失敗）では発火せず、統計は二重加算されない（M3-SB-02）。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md §5

create or replace function public.record_practice_round_result_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  insert into public.players (anon_player_id)
  values (new.anon_player_id)
  on conflict (anon_player_id)
  do update set last_seen_at = new.recorded_at
  returning id into v_player_id;

  insert into public.player_mode_stats (player_id, mode, rounds_played, rounds_won, last_played_at)
  values (v_player_id, new.mode, 1, case when new.local_won then 1 else 0 end, new.recorded_at)
  on conflict (player_id, mode)
  do update set
    rounds_played  = public.player_mode_stats.rounds_played + 1,
    rounds_won     = public.player_mode_stats.rounds_won + case when new.local_won then 1 else 0 end,
    last_played_at = new.recorded_at;

  return new;
end;
$$;

comment on function public.record_practice_round_result_stats() is
  'practice_round_results への insert 成功時に players / player_mode_stats を upsert する。security definer のため anon は直接の書込権限を必要としない。insert 自体が client_result_id UNIQUE で弾かれれば発火しないため、再送で二重加算されない（M3-SB-02）。';

create trigger practice_round_results_stats_trigger
  after insert on public.practice_round_results
  for each row
  execute function public.record_practice_round_result_stats();

create or replace function public.get_player_mode_stats(
  p_anon_player_id text,
  p_mode text default 'CPU_PRACTICE'
)
returns table (
  rounds_played  integer,
  rounds_won     integer,
  win_rate       numeric,
  last_played_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.rounds_played,
    s.rounds_won,
    case when s.rounds_played > 0
      then round(s.rounds_won::numeric / s.rounds_played, 4)
      else null
    end as win_rate,
    s.last_played_at
  from public.player_mode_stats s
  join public.players p on p.id = s.player_id
  where p.anon_player_id = p_anon_player_id
    and s.mode = p_mode
$$;

revoke all on function public.get_player_mode_stats(text, text) from public;
grant execute on function public.get_player_mode_stats(text, text) to anon, authenticated;
