revoke all on table public.rulesets from public, anon, authenticated;
revoke all on table public.terms from public, anon, authenticated;
revoke all on table public.number_cards from public, anon, authenticated;
revoke all on table public.skill_cards from public, anon, authenticated;

grant select on table public.rulesets to anon, authenticated;
grant select on table public.terms to anon, authenticated;
grant select on table public.number_cards to anon, authenticated;
grant select on table public.skill_cards to anon, authenticated;

grant all on table public.rulesets to service_role;
grant all on table public.terms to service_role;
grant all on table public.number_cards to service_role;
grant all on table public.skill_cards to service_role;

create policy select_rulesets_public_master
on public.rulesets
for select
to anon, authenticated
using (true);

create policy select_terms_public_master
on public.terms
for select
to anon, authenticated
using (true);

create policy select_number_cards_public_master
on public.number_cards
for select
to anon, authenticated
using (true);

create policy select_skill_cards_public_master
on public.skill_cards
for select
to anon, authenticated
using (true);
