-- M4-SB-01: フレンド対戦のルーム、参加者、対局、対局席の土台。
-- サーバー権威方式のため、この段階ではクライアント直アクセスを開けず、
-- Edge Function/service_role からの更新を前提にする。

create table public.rooms (
  id                   uuid primary key default extensions.gen_random_uuid(),
  invite_code          text not null,
  host_player_id       uuid not null references public.players(id) on delete restrict,
  status               text not null default 'WAITING',
  max_players          smallint not null,
  turn_seconds         smallint not null default 60,
  cpu_takeover_enabled boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  closed_at            timestamptz,
  constraint rooms_invite_code_key unique (invite_code),
  constraint rooms_invite_code_check check (invite_code <> ''),
  constraint rooms_status_check check (status in ('WAITING', 'IN_ROUND', 'CLOSED')),
  constraint rooms_max_players_check check (max_players between 2 and 6),
  constraint rooms_turn_seconds_check check (turn_seconds between 15 and 300),
  constraint rooms_closed_at_check check (
    (status = 'CLOSED' and closed_at is not null)
    or (status <> 'CLOSED' and closed_at is null)
  )
);

create table public.room_players (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  seat_index smallint not null,
  role       text not null default 'GUEST',
  status     text not null default 'JOINED',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  constraint room_players_pkey primary key (room_id, player_id),
  constraint room_players_room_seat_key unique (room_id, seat_index),
  constraint room_players_seat_index_check check (seat_index between 0 and 5),
  constraint room_players_role_check check (role in ('HOST', 'GUEST', 'CPU')),
  constraint room_players_status_check check (status in ('JOINED', 'READY', 'LEFT')),
  constraint room_players_left_at_check check (
    (status = 'LEFT' and left_at is not null)
    or (status <> 'LEFT' and left_at is null)
  )
);

create table public.rounds (
  id              uuid primary key default extensions.gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  round_number    integer not null default 1,
  status          text not null default 'DEALING',
  ruleset_code    text not null default 'INITIAL',
  ruleset_version integer not null default 1,
  player_count    smallint not null,
  state_version   integer not null default 0,
  round_seed      bigint,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint rounds_room_round_number_key unique (room_id, round_number),
  constraint rounds_round_number_check check (round_number > 0),
  constraint rounds_status_check check (status in ('DEALING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  constraint rounds_ruleset_check check (ruleset_code = 'INITIAL' and ruleset_version = 1),
  constraint rounds_player_count_check check (player_count between 2 and 6),
  constraint rounds_state_version_check check (state_version >= 0),
  constraint rounds_completed_at_check check (
    (status in ('COMPLETED', 'CANCELLED') and completed_at is not null)
    or (status not in ('COMPLETED', 'CANCELLED') and completed_at is null)
  )
);

create table public.round_players (
  round_id     uuid not null references public.rounds(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete restrict,
  seat_index   smallint not null,
  seat_kind    text not null default 'HUMAN',
  status       text not null default 'ACTIVE',
  finish_order smallint,
  is_winner    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint round_players_pkey primary key (round_id, player_id),
  constraint round_players_round_seat_key unique (round_id, seat_index),
  constraint round_players_seat_index_check check (seat_index between 0 and 5),
  constraint round_players_seat_kind_check check (seat_kind in ('HUMAN', 'CPU')),
  constraint round_players_status_check check (status in ('ACTIVE', 'LEFT', 'CPU_TAKEOVER', 'OUT')),
  constraint round_players_finish_order_check check (finish_order is null or finish_order between 1 and 6)
);

create unique index round_players_one_winner_idx
  on public.round_players (round_id)
  where is_winner;

create index rooms_host_player_id_idx on public.rooms (host_player_id);
create index rooms_status_idx on public.rooms (status);
create index room_players_player_id_idx on public.room_players (player_id);
create index rounds_room_id_idx on public.rounds (room_id);
create index round_players_player_id_idx on public.round_players (player_id);

comment on table public.rooms is
  'M4フレンド対戦のルーム。招待コード、ホスト、人数、CPU引継ぎ設定を保持する。';
comment on table public.room_players is
  'M4フレンド対戦ルームの参加者と席。待機室の参加状態を保持する。';
comment on table public.rounds is
  'M4フレンド対戦の1局単位。サーバー権威のstate_versionを保持する。';
comment on table public.round_players is
  'M4フレンド対戦の1局に参加する席。対局開始時点の席順と人間/CPU状態を保持する。';

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.rounds enable row level security;
alter table public.round_players enable row level security;

revoke all on table public.rooms from public, anon, authenticated;
revoke all on table public.room_players from public, anon, authenticated;
revoke all on table public.rounds from public, anon, authenticated;
revoke all on table public.round_players from public, anon, authenticated;

grant all on table public.rooms to service_role;
grant all on table public.room_players to service_role;
grant all on table public.rounds to service_role;
grant all on table public.round_players to service_role;
