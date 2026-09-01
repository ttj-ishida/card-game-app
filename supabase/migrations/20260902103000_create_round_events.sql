-- M3-SB-04: 公開対局イベント（使用カード・効果・勝者を再生できる形式）を保存する。
-- round_result_id への UNIQUE により、再送も practice_round_results と同じ冪等性パターンを持つ。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md §4.5

create table public.round_events (
  id              uuid primary key default extensions.gen_random_uuid(),
  round_result_id uuid not null references public.practice_round_results(id) on delete cascade,
  events          jsonb not null,
  created_at      timestamptz not null default now(),
  constraint round_events_round_result_id_key unique (round_result_id),
  constraint round_events_events_check check (jsonb_typeof(events) = 'array')
);

comment on table public.round_events is
  '1局分の公開対局イベント（使用カード・使用スキル効果・場流し・昼夜・席）。非公開手札・未使用スキルは含めない（VIS-202）。practice_round_results と1:1。';
comment on column public.round_events.events is
  '手番ごとの公開イベント配列。各要素: index, seat_id, seat_kind, kind(PLAY/PASS), action_kind, cards[](rank_code/suit_code), skill_effect, field_cleared, day_night_after, hand_counts_after。';

alter table public.round_events enable row level security;

revoke all on table public.round_events from public, anon, authenticated;

grant select, insert on table public.round_events to anon, authenticated;
grant all on table public.round_events to service_role;

create policy round_events_insert_client
  on public.round_events
  for insert
  to anon, authenticated
  with check (true);

create policy round_events_select_client
  on public.round_events
  for select
  to anon, authenticated
  using (true);
