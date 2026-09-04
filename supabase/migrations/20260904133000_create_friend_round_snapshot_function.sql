-- M4-SB-10: 再接続時に最新スナップショットを取得するRPC。

create or replace function public.get_friend_round_snapshot(
  target_round_id uuid,
  after_state_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_auth_id uuid := auth.uid();
  actor_player_id uuid;
  current_state public.online_round_public_state%rowtype;
  own_hand jsonb;
  own_skills jsonb;
  event_log jsonb;
  latest_event_seq integer;
begin
  if actor_auth_id is null then
    raise exception 'Authentication required';
  end if;

  if after_state_version is not null and after_state_version < 0 then
    raise exception 'after_state_version must be null or >= 0';
  end if;

  select rp.player_id
    into actor_player_id
    from public.round_players rp
   where rp.round_id = target_round_id
     and rp.auth_user_id = actor_auth_id
     and rp.status <> 'LEFT';

  if actor_player_id is null then
    raise exception 'Round not found or not joined';
  end if;

  select *
    into current_state
    from public.online_round_public_state ps
   where ps.round_id = target_round_id;

  if not found then
    raise exception 'Round snapshot not found';
  end if;

  select coalesce(max(e.event_seq), 0)
    into latest_event_seq
    from public.online_round_events e
   where e.round_id = target_round_id;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'event_seq', e.event_seq,
               'state_version', e.state_version,
               'event_kind', e.event_kind,
               'actor_player_id', e.actor_player_id,
               'public_payload', e.public_payload,
               'created_at', e.created_at
             )
             order by e.event_seq
           ),
           '[]'::jsonb
         )
    into event_log
    from public.online_round_events e
   where e.round_id = target_round_id
     and (after_state_version is null or e.state_version > after_state_version);

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'card_id', h.card_id,
               'position', h.position,
               'card_state', h.card_state
             )
             order by h.position, h.card_id
           ),
           '[]'::jsonb
         )
    into own_hand
    from public.round_hands h
   where h.round_id = target_round_id
     and h.player_id = actor_player_id
     and h.card_state = 'IN_HAND';

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'skill_id', s.skill_id,
               'used', s.used,
               'consumed_at', s.consumed_at
             )
             order by s.skill_id
           ),
           '[]'::jsonb
         )
    into own_skills
    from public.round_skills s
   where s.round_id = target_round_id
     and s.player_id = actor_player_id;

  return jsonb_build_object(
    'ok', true,
    'round_id', target_round_id,
    'player_id', actor_player_id,
    'state_version', current_state.state_version,
    'latest_event_seq', latest_event_seq,
    'public_state', jsonb_build_object(
      'state_version', current_state.state_version,
      'day_night', current_state.day_night,
      'active_player_id', current_state.active_player_id,
      'active_field', current_state.active_field,
      'hand_counts', current_state.hand_counts
    ),
    'hand', own_hand,
    'skills', own_skills,
    'events', event_log
  );
end;
$$;

revoke all on function public.get_friend_round_snapshot(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_friend_round_snapshot(uuid, integer) to authenticated;
