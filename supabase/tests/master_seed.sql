begin;

select plan(19);

select is((select count(*)::int from public.rulesets where internal_code = 'INITIAL' and version = 1 and status = 'active'), 1, 'initial active ruleset exists once');
select is((select count(*)::int from public.terms), 16, 'initial terms contain 16 glossary entries');
select is((select count(*)::int from public.number_cards), 36, 'number card seed contains 36 cards');
select is((select count(distinct rank_code)::int from public.number_cards), 9, 'number cards contain 9 ranks');
select is((select count(distinct suit_code)::int from public.number_cards), 4, 'number cards contain 4 suits');
select is((select count(*)::int from (select rank_code, suit_code from public.number_cards group by rank_code, suit_code having count(*) > 1) duplicates), 0, 'number cards have no duplicate rank and suit pairs');
select is((select count(*)::int from public.skill_cards), 4, 'skill card seed contains 4 skill definitions');
select is((select coalesce(sum(card_count), 0)::int from public.skill_cards), 6, 'skill card seed contains 6 total cards');

select is((select count(*)::int from public.number_cards where rank_code in ('RANK_1','RANK_2','RANK_3','RANK_4','RANK_5','RANK_6','RANK_7','RANK_8','RANK_9')), 36, 'all number cards use fixed rank codes');
select is((select count(*)::int from public.number_cards where suit_code in ('SUIT_FIRE','SUIT_WATER','SUIT_WIND','SUIT_EARTH')), 36, 'all number cards use fixed suit codes');

select is((select card_count from public.skill_cards where effect_code = 'SKILL_JOKER_HERO'), 1, '勇者Joker has one card');
select is((select card_count from public.skill_cards where effect_code = 'SKILL_JOKER_SAINT'), 1, '聖女Joker has one card');
select is((select card_count from public.skill_cards where effect_code = 'SKILL_EXTENSION_SEAL'), 2, '追加封印 has two cards');
select is((select card_count from public.skill_cards where effect_code = 'SKILL_REVOLUTION'), 2, '革命 has two cards');

select is((select japanese_name from public.terms where internal_code = 'RANK'), '数字', 'RANK term has Japanese name');
select is((select japanese_name from public.terms where internal_code = 'SUIT'), '属性', 'SUIT term has Japanese name');
select is((select english_name from public.terms where internal_code = 'ROUND'), 'Round', 'ROUND term has provisional English name');

select is((select count(*)::int from public.number_cards where display_resource_key ~ '^card\.number\.rank_[1-9]\.suit_(fire|water|wind|earth)$'), 36, 'number cards have stable display resource keys');
select is((select count(*)::int from public.skill_cards where display_resource_key ~ '^card\.skill\.' and description_resource_key ~ '^card\.skill\..+\.description$'), 4, 'skill cards have stable display and description resource keys');

select * from finish();

rollback;
