begin;

select plan(24);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('rulesets', 'terms', 'number_cards', 'skill_cards') and cmd = 'SELECT'),
  4,
  'each master table has one public read policy'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('rulesets', 'terms', 'number_cards', 'skill_cards') and cmd <> 'SELECT'),
  0,
  'master tables do not expose write policies to clients'
);

select ok(has_table_privilege('anon', 'public.rulesets', 'SELECT'), 'anon has select privilege on rulesets');
select ok(has_table_privilege('anon', 'public.terms', 'SELECT'), 'anon has select privilege on terms');
select ok(has_table_privilege('anon', 'public.number_cards', 'SELECT'), 'anon has select privilege on number_cards');
select ok(has_table_privilege('anon', 'public.skill_cards', 'SELECT'), 'anon has select privilege on skill_cards');
select ok(not has_table_privilege('anon', 'public.terms', 'INSERT'), 'anon has no insert privilege on terms');
select ok(not has_table_privilege('anon', 'public.terms', 'UPDATE'), 'anon has no update privilege on terms');
select ok(not has_table_privilege('anon', 'public.terms', 'DELETE'), 'anon has no delete privilege on terms');

select ok(has_table_privilege('authenticated', 'public.rulesets', 'SELECT'), 'authenticated has select privilege on rulesets');
select ok(has_table_privilege('authenticated', 'public.terms', 'SELECT'), 'authenticated has select privilege on terms');
select ok(has_table_privilege('authenticated', 'public.number_cards', 'SELECT'), 'authenticated has select privilege on number_cards');
select ok(has_table_privilege('authenticated', 'public.skill_cards', 'SELECT'), 'authenticated has select privilege on skill_cards');
select ok(not has_table_privilege('authenticated', 'public.skill_cards', 'INSERT'), 'authenticated has no insert privilege on skill_cards');
select ok(not has_table_privilege('authenticated', 'public.skill_cards', 'UPDATE'), 'authenticated has no update privilege on skill_cards');
select ok(not has_table_privilege('authenticated', 'public.skill_cards', 'DELETE'), 'authenticated has no delete privilege on skill_cards');

set local role anon;
select is((select count(*)::int from public.rulesets), 1, 'anon can read rulesets');
select is((select count(*)::int from public.terms), 16, 'anon can read terms');
select is((select count(*)::int from public.number_cards), 36, 'anon can read number_cards');
select is((select count(*)::int from public.skill_cards), 4, 'anon can read skill_cards');
reset role;

set local role authenticated;
select is((select count(*)::int from public.rulesets), 1, 'authenticated can read rulesets');
select is((select count(*)::int from public.terms), 16, 'authenticated can read terms');
select is((select count(*)::int from public.number_cards), 36, 'authenticated can read number_cards');
select is((select count(*)::int from public.skill_cards), 4, 'authenticated can read skill_cards');
reset role;

select * from finish();

rollback;
