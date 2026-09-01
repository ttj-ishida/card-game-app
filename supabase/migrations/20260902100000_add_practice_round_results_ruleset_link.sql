-- M3-SB-03: 対局結果に適用ルール版を関連付ける。
-- nullable: クライアント送信配線（次サブプロジェクト）完了までの間、
-- 既存クライアントは値を送らないため、既存の insert を壊さない。
-- 設計書: docs/superpowers/specs/2026-09-02-m3-supabase-stats-events-design.md §4.4

alter table public.practice_round_results
  add column ruleset_id uuid references public.rulesets(id) on delete restrict;

comment on column public.practice_round_results.ruleset_id is
  '対局時点の適用ルール版。nullable：クライアント配線（M3-EX-04/05 サブプロジェクト）完了までの既存クライアントは送らない。配線後は常に送信される想定。';
