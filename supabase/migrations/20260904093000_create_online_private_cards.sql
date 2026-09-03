-- M4-SB-02: オンライン対局の本人手札・本人スキルを所有者別に保存する。
-- auth_user_id を round_players に持たせ、RLS は本人の private rows だけを開ける。

alter table public.room_players
  add column auth_user_id uuid;

alter table public.round_players
  add column auth_user_id uuid;

create unique index room_players_room_auth_user_id_idx
  on public.room_players (room_id, auth_user_id)
  where auth_user_id is not null;

create unique index round_players_round_auth_user_id_idx
  on public.round_players (round_id, auth_user_id)
  where auth_user_id is not null;

create table public.round_hands (
  round_id   uuid not null,
  player_id  uuid not null,
  card_id    text not null references public.number_cards(card_id) on delete restrict,
  position   smallint not null,
  card_state text not null default 'IN_HAND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint round_hands_pkey primary key (round_id, player_id, card_id),
  constraint round_hands_round_player_fkey
    foreign key (round_id, player_id)
    references public.round_players(round_id, player_id)
    on delete cascade,
  constraint round_hands_position_check check (position >= 0),
  constraint round_hands_card_state_check check (card_state in ('IN_HAND', 'PLAYED', 'DISCARDED'))
);

create table public.round_skills (
  round_id    uuid not null,
  player_id   uuid not null,
  skill_id    text not null references public.skill_cards(skill_id) on delete restrict,
  used        boolean not null default false,
  consumed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint round_skills_pkey primary key (round_id, player_id, skill_id),
  constraint round_skills_round_player_fkey
    foreign key (round_id, player_id)
    references public.round_players(round_id, player_id)
    on delete cascade,
  constraint round_skills_one_skill_per_player_key unique (round_id, player_id),
  constraint round_skills_consumed_at_check check (
    (used and consumed_at is not null)
    or (not used and consumed_at is null)
  )
);

create index round_hands_player_id_idx on public.round_hands (player_id);
create index round_skills_player_id_idx on public.round_skills (player_id);

comment on column public.room_players.auth_user_id is
  'M4オンライン参加者のSupabase Auth user id。待機室で本人判定に使う。CPU席はnull。';
comment on column public.round_players.auth_user_id is
  'M4オンライン対局席のSupabase Auth user id。本人手札・スキルのRLS判定に使う。CPU席はnull。';
comment on table public.round_hands is
  'M4オンライン対局の本人手札。所有者本人またはservice_roleだけが読める。';
comment on table public.round_skills is
  'M4オンライン対局の本人スキル。所有者本人またはservice_roleだけが読める。';

create or replace function public.is_round_player_owner(
  target_round_id uuid,
  target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.round_players rp
    where rp.round_id = target_round_id
      and rp.player_id = target_player_id
      and rp.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.is_round_player_owner(uuid, uuid) from public;
grant execute on function public.is_round_player_owner(uuid, uuid) to authenticated;

alter table public.round_hands enable row level security;
alter table public.round_skills enable row level security;

revoke all on table public.round_hands from public, anon, authenticated;
revoke all on table public.round_skills from public, anon, authenticated;

grant select on table public.round_hands to authenticated;
grant select on table public.round_skills to authenticated;
grant all on table public.round_hands to service_role;
grant all on table public.round_skills to service_role;

create policy round_hands_select_owner
  on public.round_hands
  for select
  to authenticated
  using (public.is_round_player_owner(round_id, player_id));

create policy round_skills_select_owner
  on public.round_skills
  for select
  to authenticated
  using (public.is_round_player_owner(round_id, player_id));
