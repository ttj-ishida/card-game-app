-- M4-EX-02 follow-up: create_friend_room がすでに使われている招待コードで呼ばれると
-- rooms.invite_code の一意制約違反（23505）がそのままクライアントへ 409 で漏れていた。
-- 他の失敗と同じく P0001 の 'INVITE_CODE_TAKEN' として返す。

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

  begin
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
  exception when unique_violation then
    raise exception 'INVITE_CODE_TAKEN' using errcode = 'P0001';
  end;

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
