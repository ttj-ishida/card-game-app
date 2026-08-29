create or replace function public.get_active_ruleset()
returns table (
  ruleset_id uuid,
  internal_code text,
  ruleset_version integer,
  status text,
  display_name_resource_key text,
  description_resource_key text,
  effective_from timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    rulesets.id as ruleset_id,
    rulesets.internal_code,
    rulesets.version as ruleset_version,
    rulesets.status,
    rulesets.display_name_resource_key,
    rulesets.description_resource_key,
    rulesets.effective_from
  from public.rulesets
  where rulesets.status = 'active'
  order by rulesets.effective_from desc nulls last, rulesets.version desc, rulesets.created_at desc
  limit 1
$$;

revoke all on function public.get_active_ruleset() from public;
grant execute on function public.get_active_ruleset() to anon, authenticated;
