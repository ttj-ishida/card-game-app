-- M4-SB-04: ルーム作成・参加・退出のサーバー処理。
-- authenticated は RPC 経由だけで状態を変え、テーブル直書きは引き続き禁止する。

create or replace function public.ensure_online_player()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  user_id uuid := auth.uid();
  player_uuid uuid;
begin
  if user_id is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;

  insert into public.players (anon_player_id)
  values ('auth:' || user_id::text)
  on conflict (anon_player_id) do update
    set last_seen_at = now()
  returning id into player_uuid;

  return player_uuid;
end;
$$;

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_players rp
    where rp.room_id = target_room_id
      and rp.auth_user_id = auth.uid()
      and rp.status <> 'LEFT'
  );
$$;

create or replace function public.create_friend_room(
  requested_invite_code text,
  requested_max_players smallint,
  requested_turn_seconds smallint default 60,
  requested_cpu_takeover_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_auth_id uuid := auth.uid();
  actor_player_id uuid;
  existing_room record;
  created_room_id uuid;
begin
  if actor_auth_id is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;
  if requested_invite_code is null or btrim(requested_invite_code) = '' then
    raise exception 'invite code required' using errcode = 'P0001';
  end if;
  if requested_max_players < 2 or requested_max_players > 6 then
    raise exception 'max players out of range' using errcode = 'P0001';
  end if;
  if requested_turn_seconds < 15 or requested_turn_seconds > 300 then
    raise exception 'turn seconds out of range' using errcode = 'P0001';
  end if;

  actor_player_id := public.ensure_online_player();

  select r.id, rp.seat_index, rp.status
    into existing_room
  from public.rooms r
  join public.room_players rp on rp.room_id = r.id
  where r.invite_code = upper(btrim(requested_invite_code))
    and r.host_player_id = actor_player_id
    and rp.auth_user_id = actor_auth_id
  for update of r, rp;

  if found then
    if existing_room.status = 'LEFT' then
      update public.room_players
         set status = 'JOINED', left_at = null
       where room_id = existing_room.id
         and auth_user_id = actor_auth_id;
    end if;

    return jsonb_build_object(
      'room_id', existing_room.id,
      'player_id', actor_player_id,
      'invite_code', upper(btrim(requested_invite_code)),
      'seat_index', existing_room.seat_index,
      'status', 'JOINED'
    );
  end if;

  insert into public.rooms (
    invite_code,
    host_player_id,
    max_players,
    turn_seconds,
    cpu_takeover_enabled
  )
  values (
    upper(btrim(requested_invite_code)),
    actor_player_id,
    requested_max_players,
    requested_turn_seconds,
    requested_cpu_takeover_enabled
  )
  returning id into created_room_id;

  insert into public.room_players (
    room_id,
    player_id,
    auth_user_id,
    seat_index,
    role,
    status
  )
  values (
    created_room_id,
    actor_player_id,
    actor_auth_id,
    0,
    'HOST',
    'JOINED'
  );

  return jsonb_build_object(
    'room_id', created_room_id,
    'player_id', actor_player_id,
    'invite_code', upper(btrim(requested_invite_code)),
    'seat_index', 0,
    'status', 'JOINED'
  );
end;
$$;

create or replace function public.join_friend_room(requested_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_auth_id uuid := auth.uid();
  actor_player_id uuid;
  target_room record;
  existing_seat record;
  next_seat smallint;
begin
  if actor_auth_id is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;
  if requested_invite_code is null or btrim(requested_invite_code) = '' then
    raise exception 'invite code required' using errcode = 'P0001';
  end if;

  actor_player_id := public.ensure_online_player();

  select *
    into target_room
  from public.rooms
  where invite_code = upper(btrim(requested_invite_code))
  for update;

  if not found then
    raise exception 'room not found' using errcode = 'P0001';
  end if;
  if target_room.status <> 'WAITING' then
    raise exception 'room is not waiting' using errcode = 'P0001';
  end if;

  select *
    into existing_seat
  from public.room_players
  where room_id = target_room.id
    and auth_user_id = actor_auth_id
  for update;

  if found then
    if existing_seat.status = 'LEFT' then
      update public.room_players
         set status = 'JOINED', left_at = null
       where room_id = target_room.id
         and auth_user_id = actor_auth_id;
    end if;

    return jsonb_build_object(
      'room_id', target_room.id,
      'player_id', actor_player_id,
      'invite_code', target_room.invite_code,
      'seat_index', existing_seat.seat_index,
      'status', 'JOINED'
    );
  end if;

  select seat
    into next_seat
  from generate_series(0, target_room.max_players - 1) as seat
  where not exists (
    select 1
    from public.room_players rp
    where rp.room_id = target_room.id
      and rp.seat_index = seat
      and rp.status <> 'LEFT'
  )
  order by seat
  limit 1;

  if next_seat is null then
    raise exception 'room is full' using errcode = 'P0001';
  end if;

  insert into public.room_players (
    room_id,
    player_id,
    auth_user_id,
    seat_index,
    role,
    status
  )
  values (
    target_room.id,
    actor_player_id,
    actor_auth_id,
    next_seat,
    'GUEST',
    'JOINED'
  );

  return jsonb_build_object(
    'room_id', target_room.id,
    'player_id', actor_player_id,
    'invite_code', target_room.invite_code,
    'seat_index', next_seat,
    'status', 'JOINED'
  );
end;
$$;

create or replace function public.leave_friend_room(target_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_auth_id uuid := auth.uid();
  leaving record;
begin
  if actor_auth_id is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;

  select rp.room_id, rp.player_id, rp.seat_index, rp.status
    into leaving
  from public.room_players rp
  join public.rooms r on r.id = rp.room_id
  where rp.room_id = target_room_id
    and rp.auth_user_id = actor_auth_id
    and r.status = 'WAITING'
  for update of rp;

  if not found then
    raise exception 'active waiting room membership not found' using errcode = 'P0001';
  end if;

  update public.room_players
     set status = 'LEFT', left_at = now()
   where room_id = leaving.room_id
     and player_id = leaving.player_id;

  return jsonb_build_object(
    'room_id', leaving.room_id,
    'player_id', leaving.player_id,
    'seat_index', leaving.seat_index,
    'status', 'LEFT'
  );
end;
$$;

revoke all on function public.ensure_online_player() from public;
revoke all on function public.is_room_member(uuid) from public;
revoke all on function public.create_friend_room(text, smallint, smallint, boolean) from public;
revoke all on function public.join_friend_room(text) from public;
revoke all on function public.leave_friend_room(uuid) from public;

grant execute on function public.create_friend_room(text, smallint, smallint, boolean) to authenticated;
grant execute on function public.join_friend_room(text) to authenticated;
grant execute on function public.leave_friend_room(uuid) to authenticated;

grant select on table public.rooms to authenticated;
grant select on table public.room_players to authenticated;

create policy rooms_select_member
  on public.rooms
  for select
  to authenticated
  using (public.is_room_member(id));

create policy room_players_select_member
  on public.room_players
  for select
  to authenticated
  using (public.is_room_member(room_id));
