-- M4-SB-08: request_id によるプレイ要求の冪等性。

create table public.online_play_requests (
  round_id               uuid not null references public.rounds(id) on delete cascade,
  request_id             text not null,
  actor_player_id        uuid not null references public.players(id) on delete restrict,
  expected_state_version integer not null,
  status                 text not null default 'PROCESSING',
  result_payload         jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint online_play_requests_pkey primary key (round_id, request_id),
  constraint online_play_requests_request_id_check check (request_id <> '' and length(request_id) <= 128),
  constraint online_play_requests_expected_state_version_check check (expected_state_version >= 0),
  constraint online_play_requests_status_check check (status in ('PROCESSING', 'ACCEPTED', 'REJECTED')),
  constraint online_play_requests_result_payload_check check (
    result_payload is null or jsonb_typeof(result_payload) = 'object'
  )
);

create index online_play_requests_actor_idx
  on public.online_play_requests (actor_player_id, created_at desc);

comment on table public.online_play_requests is
  'M4オンライン対戦のプレイ要求台帳。同一round_id/request_idの再送を同じ結果として返す。';

alter table public.online_play_requests enable row level security;

revoke all on table public.online_play_requests from public, anon, authenticated;
grant all on table public.online_play_requests to service_role;

create or replace function public.commit_friend_play(
  target_round_id uuid,
  expected_state_version integer,
  actor_player_id uuid,
  played_card_ids text[],
  used_skill_id text,
  next_public_state jsonb,
  event_payload jsonb,
  round_completed boolean,
  winner_player_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  affected integer;
  stored_result jsonb;
  commit_result jsonb;
begin
  if p_request_id is null or p_request_id = '' or length(p_request_id) > 128 then
    raise exception 'request_id is required';
  end if;

  insert into public.online_play_requests (
    round_id,
    request_id,
    actor_player_id,
    expected_state_version
  ) values (
    target_round_id,
    p_request_id,
    actor_player_id,
    expected_state_version
  ) on conflict (round_id, request_id) do nothing;

  get diagnostics affected = row_count;

  if affected = 0 then
    select result_payload
      into stored_result
      from public.online_play_requests opr
     where opr.round_id = target_round_id
       and opr.request_id = p_request_id
     for update;

    if stored_result is null then
      raise exception 'request is already processing';
    end if;

    return stored_result;
  end if;

  commit_result := public.commit_friend_play(
    target_round_id,
    expected_state_version,
    actor_player_id,
    played_card_ids,
    used_skill_id,
    next_public_state,
    event_payload,
    round_completed,
    winner_player_id
  );

  update public.online_play_requests opr
     set status = case when (commit_result->>'ok')::boolean then 'ACCEPTED' else 'REJECTED' end,
         result_payload = commit_result,
         updated_at = now()
   where opr.round_id = target_round_id
     and opr.request_id = p_request_id;

  return commit_result;
end;
$$;

revoke all on function public.commit_friend_play(uuid, integer, uuid, text[], text, jsonb, jsonb, boolean, uuid, text) from public;
grant execute on function public.commit_friend_play(uuid, integer, uuid, text[], text, jsonb, jsonb, boolean, uuid, text) to service_role;