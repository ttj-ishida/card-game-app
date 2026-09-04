-- M4-SB-07: 条件付きコミットを1つのPostgres関数内で行う。

create or replace function public.commit_friend_play(
  target_round_id uuid,
  expected_state_version integer,
  actor_player_id uuid,
  played_card_ids text[],
  used_skill_id text,
  next_public_state jsonb,
  event_payload jsonb,
  round_completed boolean default false,
  winner_player_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_state public.online_round_public_state%rowtype;
  round_row public.rounds%rowtype;
  next_version integer;
  next_event_seq integer;
  affected integer;
  requested_card_count integer;
begin
  if target_round_id is null or actor_player_id is null then
    raise exception 'round and actor are required';
  end if;

  if expected_state_version is null or expected_state_version < 0 then
    raise exception 'expected_state_version must be non-negative';
  end if;

  if jsonb_typeof(coalesce(next_public_state, '{}'::jsonb)) <> 'object' then
    raise exception 'next_public_state must be an object';
  end if;

  if jsonb_typeof(coalesce(event_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'event_payload must be an object';
  end if;

  select *
    into round_row
    from public.rounds
   where id = target_round_id
   for update;

  if not found then
    raise exception 'round not found';
  end if;

  if round_row.status <> 'IN_PROGRESS' then
    raise exception 'round is not in progress';
  end if;

  select *
    into current_state
    from public.online_round_public_state
   where round_id = target_round_id
   for update;

  if not found then
    raise exception 'public state not found';
  end if;

  if current_state.state_version <> expected_state_version then
    return jsonb_build_object(
      'ok', false,
      'reason', 'STALE_STATE_VERSION',
      'current_state_version', current_state.state_version
    );
  end if;

  if not exists (
    select 1
      from public.round_players rp
     where rp.round_id = target_round_id
       and rp.player_id = actor_player_id
       and rp.status in ('ACTIVE', 'CPU_TAKEOVER')
  ) then
    raise exception 'actor is not an active round player';
  end if;

  played_card_ids := coalesce(played_card_ids, ARRAY[]::text[]);
  select count(*)
    into requested_card_count
    from unnest(played_card_ids) as card_id
   where card_id is not null and card_id <> '';

  if requested_card_count <> cardinality(played_card_ids) then
    raise exception 'played_card_ids contains empty values';
  end if;

  if requested_card_count <> (select count(distinct card_id) from unnest(played_card_ids) as card_id) then
    raise exception 'played_card_ids contains duplicates';
  end if;

  update public.round_hands
     set card_state = 'PLAYED',
         updated_at = now()
   where round_id = target_round_id
     and player_id = actor_player_id
     and card_id = any(played_card_ids)
     and card_state = 'IN_HAND';

  get diagnostics affected = row_count;
  if affected <> requested_card_count then
    raise exception 'played card count mismatch';
  end if;

  if used_skill_id is not null then
    update public.round_skills
       set used = true,
           consumed_at = now(),
           updated_at = now()
     where round_id = target_round_id
       and player_id = actor_player_id
       and skill_id = used_skill_id
       and used = false;

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'skill use mismatch';
    end if;
  end if;

  next_version := expected_state_version + 1;

  update public.online_round_public_state
     set state_version = next_version,
         day_night = coalesce(next_public_state->>'day_night', current_state.day_night),
         active_player_id = coalesce((next_public_state->>'active_player_id')::uuid, current_state.active_player_id),
         active_field = coalesce(next_public_state->'active_field', current_state.active_field),
         hand_counts = coalesce(next_public_state->'hand_counts', current_state.hand_counts),
         updated_at = now()
   where round_id = target_round_id;

  update public.rounds
     set state_version = next_version,
         status = case when round_completed then 'COMPLETED' else status end,
         completed_at = case when round_completed then now() else completed_at end,
         updated_at = now()
   where id = target_round_id;

  if round_completed and winner_player_id is not null then
    update public.round_players
       set is_winner = (player_id = winner_player_id),
           status = case when player_id = winner_player_id then 'OUT' else status end,
           finish_order = case when player_id = winner_player_id then 1 else finish_order end
     where round_id = target_round_id;
  end if;

  select coalesce(max(event_seq), 0) + 1
    into next_event_seq
    from public.online_round_events
   where round_id = target_round_id;

  insert into public.online_round_events (
    round_id,
    event_seq,
    state_version,
    event_kind,
    actor_player_id,
    public_payload
  ) values (
    target_round_id,
    next_event_seq,
    next_version,
    coalesce(nullif(upper(event_payload->>'event_kind'), ''), 'PLAY_ACCEPTED'),
    actor_player_id,
    event_payload
  );

  return jsonb_build_object(
    'ok', true,
    'round_id', target_round_id,
    'state_version', next_version,
    'event_seq', next_event_seq
  );
end;
$$;

revoke all on function public.commit_friend_play(uuid, integer, uuid, text[], text, jsonb, jsonb, boolean, uuid) from public;
grant execute on function public.commit_friend_play(uuid, integer, uuid, text[], text, jsonb, jsonb, boolean, uuid) to service_role;