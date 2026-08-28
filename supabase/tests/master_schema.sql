begin;

select plan(20);

select has_table('public', 'rulesets', 'rulesets master table exists');
select has_table('public', 'terms', 'terms master table exists');
select has_table('public', 'number_cards', 'number_cards master table exists');
select has_table('public', 'skill_cards', 'skill_cards master table exists');

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'rulesets'
      and c.contype = 'p'
  ),
  'rulesets has a primary key'
);
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'terms'
      and c.contype = 'p'
  ),
  'terms has a primary key'
);
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'number_cards'
      and c.contype = 'p'
  ),
  'number_cards has a primary key'
);
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'skill_cards'
      and c.contype = 'p'
  ),
  'skill_cards has a primary key'
);

select ok(exists (select 1 from pg_constraint where conname = 'terms_internal_code_key' and contype = 'u'), 'terms internal_code is unique');
select ok(exists (select 1 from pg_constraint where conname = 'number_cards_ruleset_id_rank_code_suit_code_key' and contype = 'u'), 'number cards are unique within a ruleset');
select ok(exists (select 1 from pg_constraint where conname = 'skill_cards_ruleset_id_effect_code_key' and contype = 'u'), 'skill effects are unique within a ruleset');

select ok(exists (select 1 from pg_constraint where conname = 'number_cards_ruleset_id_fkey' and contype = 'f'), 'number_cards references rulesets');
select ok(exists (select 1 from pg_constraint where conname = 'skill_cards_ruleset_id_fkey' and contype = 'f'), 'skill_cards references rulesets');

select ok(exists (select 1 from pg_class where oid = to_regclass('public.rulesets') and relrowsecurity), 'rulesets has RLS enabled');
select ok(exists (select 1 from pg_class where oid = to_regclass('public.terms') and relrowsecurity), 'terms has RLS enabled');
select ok(exists (select 1 from pg_class where oid = to_regclass('public.number_cards') and relrowsecurity), 'number_cards has RLS enabled');
select ok(exists (select 1 from pg_class where oid = to_regclass('public.skill_cards') and relrowsecurity), 'skill_cards has RLS enabled');

select ok(exists (select 1 from pg_constraint where conname = 'terms_status_check'), 'terms status is constrained');
select ok(exists (select 1 from pg_constraint where conname = 'number_cards_rank_code_check'), 'number card rank_code is constrained');
select ok(exists (select 1 from pg_constraint where conname = 'skill_cards_count_check'), 'skill card count is constrained');

select * from finish();

rollback;
