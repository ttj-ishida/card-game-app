-- M4-SB-05: シャッフル、配布、先攻決定をサーバー側で行う。
-- クライアントからデッキ順、スキル順、先攻プレイヤーは受け取らない。

create or replace function public.start_friend_round(target_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_auth_id uuid := auth.uid();
  target_room record;
  active_seat_count integer;
  existing_round record;
  created_round_id uuid;
  server_seed bigint;
  first_player uuid;
begin
  if actor_auth_id is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;

  select *
    into target_room
  from public.rooms
  where id = target_room_id
  for update;

  if not found then
    raise exception 'room not found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.room_players rp
    where rp.room_id = target_room.id
      and rp.auth_user_id = actor_auth_id
      and rp.role = 'HOST'
      and rp.status <> 'LEFT'
  ) then
    raise exception 'only host can start the round' using errcode = 'P0001';
  end if;

  select r.id, r.state_version
    into existing_round
  from public.rounds r
  where r.room_id = target_room.id
    and r.round_number = 1
  for update;

  if found then
    return jsonb_build_object(
      'room_id', target_room.id,
      'round_id', existing_round.id,
      'state_version', existing_round.state_version,
      'status', 'IN_ROUND'
    );
  end if;

  if target_room.status <> 'WAITING' then
    raise exception 'room is not waiting' using errcode = 'P0001';
  end if;

  select count(*)::int
    into active_seat_count
  from public.room_players rp
  where rp.room_id = target_room.id
    and rp.status <> 'LEFT';

  if active_seat_count <> target_room.max_players then
    raise exception 'room is not full' using errcode = 'P0001';
  end if;

  server_seed := floor(random() * 2147483647)::bigint;

  insert into public.rounds (
    room_id,
    round_number,
    status,
    player_count,
    state_version,
    round_seed,
    started_at
  )
  values (
    target_room.id,
    1,
    'IN_PROGRESS',
    active_seat_count::smallint,
    0,
    server_seed,
    now()
  )
  returning id into created_round_id;

  insert into public.round_players (
    round_id,
    player_id,
    auth_user_id,
    seat_index,
    seat_kind,
    status
  )
  select
    created_round_id,
    rp.player_id,
    rp.auth_user_id,
    rp.seat_index,
    case when rp.role = 'CPU' then 'CPU' else 'HUMAN' end,
    'ACTIVE'
  from public.room_players rp
  where rp.room_id = target_room.id
    and rp.status <> 'LEFT'
  order by rp.seat_index;

  with ordered_seats as (
    select
      rp.player_id,
      rp.seat_index,
      row_number() over (order by rp.seat_index) - 1 as seat_ord
    from public.round_players rp
    where rp.round_id = created_round_id
  ),
  shuffled_cards as (
    select
      nc.card_id,
      row_number() over (order by md5(server_seed::text || ':' || nc.card_id)) - 1 as card_ord
    from public.number_cards nc
    where nc.is_active
  )
  insert into public.round_hands (round_id, player_id, card_id, position)
  select
    created_round_id,
    os.player_id,
    sc.card_id,
    (sc.card_ord / active_seat_count)::smallint
  from shuffled_cards sc
  join ordered_seats os on os.seat_ord = sc.card_ord % active_seat_count;

  with ordered_seats as (
    select
      rp.player_id,
      row_number() over (order by rp.seat_index) - 1 as seat_ord
    from public.round_players rp
    where rp.round_id = created_round_id
  ),
  physical_skills as (
    select
      sc.skill_id,
      row_number() over (
        order by md5(server_seed::text || ':skill:' || sc.skill_id || ':' || copies.copy_index::text)
      ) - 1 as skill_ord
    from public.skill_cards sc
    cross join lateral generate_series(1, sc.card_count) as copies(copy_index)
    where sc.is_active
  )
  insert into public.round_skills (round_id, player_id, skill_id)
  select
    created_round_id,
    os.player_id,
    ps.skill_id
  from ordered_seats os
  join physical_skills ps on ps.skill_ord = os.seat_ord;

  select rp.player_id
    into first_player
  from public.round_players rp
  where rp.round_id = created_round_id
  order by md5(server_seed::text || ':first:' || rp.player_id::text)
  limit 1;

  insert into public.online_round_public_state (
    round_id,
    state_version,
    day_night,
    active_player_id,
    active_field,
    hand_counts
  )
  select
    created_round_id,
    0,
    'DAY',
    first_player,
    '{}'::jsonb,
    jsonb_object_agg(rp.seat_index::text, counts.hand_count order by rp.seat_index)
  from public.round_players rp
  join (
    select player_id, count(*)::int as hand_count
    from public.round_hands
    where round_id = created_round_id
    group by player_id
  ) counts on counts.player_id = rp.player_id
  where rp.round_id = created_round_id;

  insert into public.online_round_events (
    round_id,
    event_seq,
    state_version,
    event_kind,
    actor_player_id,
    public_payload
  )
  values (
    created_round_id,
    1,
    0,
    'ROUND_STARTED',
    target_room.host_player_id,
    jsonb_build_object(
      'player_count', active_seat_count,
      'active_player_id', first_player,
      'day_night', 'DAY'
    )
  );

  update public.rooms
     set status = 'IN_ROUND',
         updated_at = now()
   where id = target_room.id;

  return jsonb_build_object(
    'room_id', target_room.id,
    'round_id', created_round_id,
    'state_version', 0,
    'status', 'IN_ROUND'
  );
end;
$$;

revoke all on function public.start_friend_round(uuid) from public;
grant execute on function public.start_friend_round(uuid) to authenticated;

grant select on table public.rounds to authenticated;
grant select on table public.round_players to authenticated;

create policy rounds_select_member
  on public.rounds
  for select
  to authenticated
  using (public.is_room_member(room_id));

create policy round_players_select_member
  on public.round_players
  for select
  to authenticated
  using (public.is_round_member(round_id));
