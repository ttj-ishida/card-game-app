create extension if not exists pgcrypto with schema extensions;

create table public.rulesets (
  id uuid primary key default extensions.gen_random_uuid(),
  internal_code text not null,
  version integer not null,
  status text not null default 'draft',
  display_name_resource_key text not null,
  description_resource_key text,
  effective_from timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rulesets_internal_code_version_key unique (internal_code, version),
  constraint rulesets_version_check check (version > 0),
  constraint rulesets_status_check check (status in ('draft', 'active', 'deprecated')),
  constraint rulesets_internal_code_check check (internal_code = upper(internal_code))
);

create table public.terms (
  term_id text primary key,
  internal_code text not null,
  japanese_name text not null,
  english_name text not null,
  definition text,
  status text not null default 'draft',
  term_version integer not null default 1,
  name_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_internal_code_key unique (internal_code),
  constraint terms_term_id_check check (term_id ~ '^TERM-[0-9]{3}$'),
  constraint terms_status_check check (status in ('draft', 'confirmed', 'deprecated')),
  constraint terms_term_version_check check (term_version > 0),
  constraint terms_internal_code_check check (internal_code = upper(internal_code)),
  constraint terms_name_history_check check (jsonb_typeof(name_history) = 'array')
);

create table public.number_cards (
  card_id text primary key,
  ruleset_id uuid not null,
  rank_code text not null,
  suit_code text not null,
  display_resource_key text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint number_cards_ruleset_id_fkey foreign key (ruleset_id) references public.rulesets(id) on delete restrict,
  constraint number_cards_ruleset_id_rank_code_suit_code_key unique (ruleset_id, rank_code, suit_code),
  constraint number_cards_rank_code_check check (rank_code ~ '^RANK_[1-9]$'),
  constraint number_cards_suit_code_check check (suit_code in ('SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH')),
  constraint number_cards_sort_order_check check (sort_order > 0),
  constraint number_cards_display_resource_key_check check (display_resource_key <> '')
);

create table public.skill_cards (
  skill_id text primary key,
  ruleset_id uuid not null,
  effect_code text not null,
  display_resource_key text not null,
  description_resource_key text,
  card_count integer not null,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skill_cards_ruleset_id_fkey foreign key (ruleset_id) references public.rulesets(id) on delete restrict,
  constraint skill_cards_ruleset_id_effect_code_key unique (ruleset_id, effect_code),
  constraint skill_cards_effect_code_check check (effect_code = upper(effect_code)),
  constraint skill_cards_count_check check (card_count between 1 and 6),
  constraint skill_cards_sort_order_check check (sort_order > 0),
  constraint skill_cards_display_resource_key_check check (display_resource_key <> '')
);

create index idx_rulesets_status on public.rulesets (status);
create index idx_number_cards_ruleset_id on public.number_cards (ruleset_id);
create index idx_skill_cards_ruleset_id on public.skill_cards (ruleset_id);

alter table public.rulesets enable row level security;
alter table public.terms enable row level security;
alter table public.number_cards enable row level security;
alter table public.skill_cards enable row level security;
