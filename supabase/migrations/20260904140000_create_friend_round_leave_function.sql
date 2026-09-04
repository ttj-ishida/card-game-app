-- M4-SB-12: 対局中の退出・棄権・CPU引継ぎ。

create or replace function public.leave_friend_round(
  target_round_id uuid,
  requested_cpu_takeover boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_auth_id uuid := auth.uid();
  target_round public.rounds%rowtype;
  target_room public.rooms%rowtype;
  leaving_player public.round_players%rowtype;
  remaining_count integer;
  remaining_winner_id uuid;
  next_active_player_id uuid;
  next_version integer;
  next_event_seq integer;
  event_kind text;
  cpu_takeover boolean;
begin
  if actor_auth_id is null then
    raise exception 'Authentication required';
  end if;

  select *
    into target_round
    from public.rounds r
   where r.id = target_round_id
   for update;

  if not found then
    raise exception 'Round not found';
  end if;

  if target_round.status <> 'IN_PROGRESS' then
    raise exception 'Round is not in progress';
  end if;

  select *
    into target_room
    from public.rooms r
   where r.id = target_round.room_id
   for update;

  select *
    into leaving_player
    from public.round_players rp
   where rp.round_id = target_round_id
     and rp.auth_user_id = actor_auth_id
     and rp.seat_kind = 'HUMAN'
     and rp.status = 'ACTIVE'
   for update;

  if not found then
    raise exception 'Round player not found or already left';
  end if;

  cpu_takeover := requested_cpu_takeover and target_room.cpu_takeover_enabled;
  next_version := target_round.state_version + 1;

  select coalesce(max(e.event_seq), 0) + 1
    into next_event_seq
    from public.online_round_events e
   where e.round_id = target_round_id;

  if cpu_takeover then
    event_kind := 'PLAYER_LEFT_CPU_TAKEOVER';

    update public.round_players
       set status = 'CPU_TAKEOVER',
           seat_kind = 'CPU',
           auth_user_id = null,
           updated_at = now()
     where round_id = target_round_id
       and player_id = leaving_player.player_id;

    update public.room_players
       set status = 'LEFT',
           left_at = now()
     where room_id = target_room.id
       and player_id = leaving_player.player_id;

    update public.rounds
       set state_version = next_version,
           updated_at = now()
     where id = target_round_id;

    update public.online_round_public_state
       set state_version = next_version,
           updated_at = now()
     where round_id = target_round_id;
  else
    event_kind := 'PLAYER_FORFEITED';

    update public.round_hands
       set card_state = 'DISCARDED',
           updated_at = now()
     where round_id = target_round_id
       and player_id = leaving_player.player_id
       and card_state = 'IN_HAND';

    update public.round_players
       set status = 'OUT',
           finish_order = coalesce(finish_order, target_round.player_count),
           updated_at = now()
     where round_id = target_round_id
       and player_id = leaving_player.player_id;

    update public.room_players
       set status = 'LEFT',
           left_at = now()
     where room_id = target_room.id
       and player_id = leaving_player.player_id;

    select count(*)::int
      into remaining_count
      from public.round_players rp
     where rp.round_id = target_round_id
       and rp.player_id <> leaving_player.player_id
       and rp.status in ('ACTIVE', 'CPU_TAKEOVER');

    if remaining_count = 1 then
      select rp.player_id
        into remaining_winner_id
        from public.round_players rp
       where rp.round_id = target_round_id
         and rp.player_id <> leaving_player.player_id
         and rp.status in ('ACTIVE', 'CPU_TAKEOVER')
       limit 1;

      update public.round_players
         set is_winner = (player_id = remaining_winner_id),
             finish_order = case when player_id = remaining_winner_id then 1 else finish_order end,
             updated_at = now()
       where round_id = target_round_id;
    else
      select rp.player_id
        into next_active_player_id
        from public.round_players rp
       where rp.round_id = target_round_id
         and rp.player_id <> leaving_player.player_id
         and rp.status in ('ACTIVE', 'CPU_TAKEOVER')
       order by rp.seat_index
       limit 1;
    end if;

    update public.rounds
       set state_version = next_version,
           status = case when remaining_count = 1 then 'COMPLETED' else status end,
           completed_at = case when remaining_count = 1 then now() else completed_at end,
           updated_at = now()
     where id = target_round_id;

    update public.online_round_public_state ps
       set state_version = next_version,
           active_player_id = case
             when remaining_count = 1 then remaining_winner_id
             when ps.active_player_id = leaving_player.player_id then next_active_player_id
             else ps.active_player_id
           end,
           hand_counts = jsonb_set(
             ps.hand_counts,
             ARRAY[leaving_player.player_id::text],
             '0'::jsonb,
             true
           ),
           updated_at = now()
     where ps.round_id = target_round_id;
  end if;

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
    event_kind,
    leaving_player.player_id,
    jsonb_build_object(
      'player_id', leaving_player.player_id,
      'cpu_takeover', cpu_takeover,
      'winner_player_id', remaining_winner_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'round_id', target_round_id,
    'player_id', leaving_player.player_id,
    'status', case when cpu_takeover then 'CPU_TAKEOVER' else 'OUT' end,
    'cpu_takeover', cpu_takeover,
    'state_version', next_version,
    'event_seq', next_event_seq,
    'winner_player_id', remaining_winner_id
  );
end;
$$;

revoke all on function public.leave_friend_round(uuid, boolean) from public, anon, authenticated;
grant execute on function public.leave_friend_round(uuid, boolean) to authenticated;
