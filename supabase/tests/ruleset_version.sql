begin;

select plan(7);

select has_function('public', 'get_active_ruleset', array[]::name[], 'active ruleset lookup function exists');

select results_eq(
  $$ select internal_code from public.get_active_ruleset() $$,
  $$ values ('INITIAL'::text) $$,
  'active ruleset exposes stable internal code'
);

select results_eq(
  $$ select ruleset_version from public.get_active_ruleset() $$,
  $$ values (1::integer) $$,
  'active ruleset exposes ruleset_version'
);

select results_eq(
  $$ select display_name_resource_key from public.get_active_ruleset() $$,
  $$ values ('ruleset.initial.name'::text) $$,
  'active ruleset exposes display resource key, not display text'
);

select is(
  (select count(*)::int from public.get_active_ruleset()),
  1,
  'exactly one active ruleset is returned'
);

select ok(has_function_privilege('anon', 'public.get_active_ruleset()', 'EXECUTE'), 'anon can execute active ruleset lookup');
select ok(has_function_privilege('authenticated', 'public.get_active_ruleset()', 'EXECUTE'), 'authenticated can execute active ruleset lookup');

select * from finish();

rollback;
