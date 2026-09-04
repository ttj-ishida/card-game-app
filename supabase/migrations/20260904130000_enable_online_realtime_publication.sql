-- M4-SB-09: オンライン対局の同期対象をSupabase Realtimeへ登録する。

alter table public.online_round_public_state replica identity full;
alter table public.online_round_events replica identity full;
alter table public.round_hands replica identity full;
alter table public.round_skills replica identity full;

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'online_round_public_state'
  ) then
    alter publication supabase_realtime add table public.online_round_public_state;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'online_round_events'
  ) then
    alter publication supabase_realtime add table public.online_round_events;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'round_hands'
  ) then
    alter publication supabase_realtime add table public.round_hands;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'round_skills'
  ) then
    alter publication supabase_realtime add table public.round_skills;
  end if;
end;
$$;
