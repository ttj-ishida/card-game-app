-- M4-SB-03: オンライン対局の公開状態と公開イベントログ。
-- M3のCPU戦用 round_events と用途が異なるため、M4オンラインは online_* 名にする。

create table public.online_round_public_state (
  round_id         uuid primary key references public.rounds(id) on delete cascade,
  state_version    integer not null default 0,
  day_night        text not null default 'DAY',
  active_player_id uuid references public.players(id) on delete restrict,
  active_field     jsonb not null default '{}'::jsonb,
  hand_counts      jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now(),
  constraint online_round_public_state_version_check check (state_version >= 0),
  constraint online_round_public_state_day_night_check check (day_night in ('DAY', 'NIGHT')),
  constraint online_round_public_state_active_field_check check (jsonb_typeof(active_field) = 'object'),
  constraint online_round_public_state_hand_counts_check check (jsonb_typeof(hand_counts) = 'object')
);

create table public.online_round_events (
  round_id       uuid not null references public.rounds(id) on delete cascade,
  event_seq      integer not null,
  state_version  integer not null,
  event_kind     text not null,
  actor_player_id uuid references public.players(id) on delete restrict,
  public_payload jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  constraint online_round_events_pkey primary key (round_id, event_seq),
  constraint online_round_events_state_version_key unique (round_id, state_version),
  constraint online_round_events_event_seq_check check (event_seq > 0),
  constraint online_round_events_state_version_check check (state_version >= 0),
  constraint online_round_events_event_kind_check check (event_kind = upper(event_kind) and event_kind <> ''),
  constraint online_round_events_public_payload_check check (jsonb_typeof(public_payload) = 'object')
);

create index online_round_events_round_id_state_version_idx
  on public.online_round_events (round_id, state_version);
create index online_round_events_actor_player_id_idx
  on public.online_round_events (actor_player_id);

comment on table public.online_round_public_state is
  'M4オンライン対局の公開スナップショット。場、昼夜、手番、手札枚数など全参加者に見せてよい情報だけを保持する。';
comment on table public.online_round_events is
  'M4オンライン対局の公開イベントログ。非公開手札・未使用スキルを含めない。Realtime通知と再接続復旧に使う。';

create or replace function public.is_round_member(target_round_id uuid)
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
      and rp.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.is_round_member(uuid) from public;
grant execute on function public.is_round_member(uuid) to authenticated;

alter table public.online_round_public_state enable row level security;
alter table public.online_round_events enable row level security;

revoke all on table public.online_round_public_state from public, anon, authenticated;
revoke all on table public.online_round_events from public, anon, authenticated;

grant select on table public.online_round_public_state to authenticated;
grant select on table public.online_round_events to authenticated;
grant all on table public.online_round_public_state to service_role;
grant all on table public.online_round_events to service_role;

create policy online_round_public_state_select_member
  on public.online_round_public_state
  for select
  to authenticated
  using (public.is_round_member(round_id));

create policy online_round_events_select_member
  on public.online_round_events
  for select
  to authenticated
  using (public.is_round_member(round_id));
