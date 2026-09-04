begin;

select plan(8);

select ok(
  exists (select 1 from pg_publication where pubname = 'supabase_realtime'),
  'supabase_realtime publication exists'
);

select ok(
  exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'online_round_public_state'
  ),
  'online_round_public_state is published for realtime'
);

select ok(
  exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'online_round_events'
  ),
  'online_round_events is published for realtime'
);

select ok(
  exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'round_hands'
  ),
  'round_hands is published for realtime'
);

select ok(
  exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'round_skills'
  ),
  'round_skills is published for realtime'
);

select is(
  (select relreplident from pg_class where oid = 'public.online_round_public_state'::regclass),
  'f',
  'online_round_public_state uses replica identity full'
);

select is(
  (select relreplident from pg_class where oid = 'public.round_hands'::regclass),
  'f',
  'round_hands uses replica identity full'
);

select is(
  (select relreplident from pg_class where oid = 'public.round_skills'::regclass),
  'f',
  'round_skills uses replica identity full'
);

select * from finish();

rollback;
