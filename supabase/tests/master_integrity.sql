begin;

select plan(12);

select is((select count(*)::int from public.number_cards), 36, 'number master contains exactly 36 cards');
select is((select count(*)::int from public.skill_cards), 4, 'skill master contains exactly 4 skill definitions');
select is((select coalesce(sum(card_count), 0)::int from public.skill_cards), 6, 'skill master expands to 6 physical cards');

select is(
  (select count(*)::int from public.number_cards group by ruleset_id),
  36,
  'initial ruleset owns all 36 number cards'
);

select is(
  (select count(*)::int from (select rank_code, suit_code from public.number_cards group by rank_code, suit_code having count(*) > 1) duplicated_number_cards),
  0,
  'number cards have no duplicated rank and suit pair'
);

select is(
  (select count(*)::int from (select card_id from public.number_cards group by card_id having count(*) > 1) duplicated_number_ids),
  0,
  'number card ids are globally unique'
);

select is(
  (select count(*)::int from (select skill_id from public.skill_cards group by skill_id having count(*) > 1) duplicated_skill_ids),
  0,
  'skill ids are globally unique'
);

select is(
  (select count(distinct rank_code)::int from public.number_cards),
  9,
  'number cards cover 9 ranks'
);

select is(
  (select count(distinct suit_code)::int from public.number_cards),
  4,
  'number cards cover 4 suits'
);

select is(
  (select count(*)::int from public.number_cards where display_resource_key is null or display_resource_key = ''),
  0,
  'number cards all have display resource keys'
);

select is(
  (select count(*)::int from public.skill_cards where display_resource_key is null or display_resource_key = '' or description_resource_key is null or description_resource_key = ''),
  0,
  'skill cards all have display and description resource keys'
);

select is(
  (select coalesce(sum(duplicate_count), 0)::int from (
    select count(*) as duplicate_count
    from (
      select display_resource_key from public.number_cards
      union all
      select display_resource_key from public.skill_cards
    ) display_keys
    group by display_resource_key
    having count(*) > 1
  ) duplicated_display_keys),
  0,
  'display resource keys are not duplicated across master cards'
);

select * from finish();

rollback;
