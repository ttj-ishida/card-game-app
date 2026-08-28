insert into public.rulesets (
  id,
  internal_code,
  version,
  status,
  display_name_resource_key,
  description_resource_key,
  effective_from
)
values (
  '00000000-0000-4000-8000-000000000001',
  'INITIAL',
  1,
  'active',
  'ruleset.initial.name',
  'ruleset.initial.description',
  '2026-08-28T00:00:00Z'
)
on conflict (internal_code, version) do update set
  status = excluded.status,
  display_name_resource_key = excluded.display_name_resource_key,
  description_resource_key = excluded.description_resource_key,
  effective_from = excluded.effective_from,
  updated_at = now();

insert into public.terms (
  term_id,
  internal_code,
  japanese_name,
  english_name,
  definition,
  status,
  term_version
)
values
  ('TERM-001', 'RANK', '数字', 'Rank', 'カードに記載された1から9の数字。内部設計で使うランクと同義。', 'confirmed', 1),
  ('TERM-002', 'SUIT', '属性', 'Element / Suit', '数字カードが持つ火、水、風、土の分類。', 'confirmed', 1),
  ('TERM-003', 'FIELD', '場', 'Field', '現在のカード比較と効果判定の対象となる領域。', 'confirmed', 1),
  ('TERM-004', 'ACTIVE_SET', 'アクティブセット', 'Active Set', '現在の場に残っている比較対象カードのまとまり。', 'confirmed', 1),
  ('TERM-005', 'RANK_SET', '同数セット', 'Rank Set', '同じ数字のカードで作るセット。', 'confirmed', 1),
  ('TERM-006', 'SEQUENCE', '連番セット', 'Sequence', '連続する数字のカードで作るセット。', 'confirmed', 1),
  ('TERM-007', 'EXTEND', '追加', 'Extension', '現在の場へカードを追加する行動。', 'confirmed', 1),
  ('TERM-008', 'REPLACE', '更新', 'Replacement', '現在の場を新しいカードで上書きする行動。', 'confirmed', 1),
  ('TERM-009', 'CLEAR_FIELD', '場流し', 'Clear Field', '場を空にして次の先頭を決める処理。', 'confirmed', 1),
  ('TERM-010', 'SUIT_LOCK', '属性ロック', 'Suit Lock', '以降に出せる属性を制限する状態。', 'confirmed', 1),
  ('TERM-011', 'EXTENSION_SEAL', '追加封印', 'Extension Seal', '同数字追加と連番拡張を禁止する効果。', 'confirmed', 1),
  ('TERM-012', 'REVOLUTION', '革命', 'Revolution', '昼夜を反転して数字の強弱を変える効果。', 'confirmed', 1),
  ('TERM-013', 'NATURAL_REVOLUTION', '自然革命', 'Natural Revolution', 'カード構成によって自然に発生する革命。', 'confirmed', 1),
  ('TERM-014', 'TRANSFORM_JOKER', '変化Joker', 'Transform Joker', 'Jokerが数字カードとして変化する効果。', 'confirmed', 1),
  ('TERM-015', 'GO_OUT', '上がり', 'Going Out', '数字カードが0枚になり局を抜けること。', 'confirmed', 1),
  ('TERM-016', 'ROUND', '1局', 'Round', 'カードの配布から勝者決定または対局終了までの単位。', 'confirmed', 1)
on conflict (term_id) do update set
  internal_code = excluded.internal_code,
  japanese_name = excluded.japanese_name,
  english_name = excluded.english_name,
  definition = excluded.definition,
  status = excluded.status,
  term_version = excluded.term_version,
  updated_at = now();

with ranks(rank_code, rank_order) as (
  values
    ('RANK_1', 1),
    ('RANK_2', 2),
    ('RANK_3', 3),
    ('RANK_4', 4),
    ('RANK_5', 5),
    ('RANK_6', 6),
    ('RANK_7', 7),
    ('RANK_8', 8),
    ('RANK_9', 9)
),
suits(suit_code, suit_order, suit_key) as (
  values
    ('SUIT_FIRE', 1, 'fire'),
    ('SUIT_WATER', 2, 'water'),
    ('SUIT_WIND', 3, 'wind'),
    ('SUIT_EARTH', 4, 'earth')
)
insert into public.number_cards (
  card_id,
  ruleset_id,
  rank_code,
  suit_code,
  display_resource_key,
  sort_order,
  is_active
)
select
  'CARD_NUMBER_' || ranks.rank_code || '_' || suits.suit_code,
  '00000000-0000-4000-8000-000000000001'::uuid,
  ranks.rank_code,
  suits.suit_code,
  'card.number.rank_' || ranks.rank_order || '.suit_' || suits.suit_key,
  ((ranks.rank_order - 1) * 4) + suits.suit_order,
  true
from ranks
cross join suits
on conflict (card_id) do update set
  ruleset_id = excluded.ruleset_id,
  rank_code = excluded.rank_code,
  suit_code = excluded.suit_code,
  display_resource_key = excluded.display_resource_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.skill_cards (
  skill_id,
  ruleset_id,
  effect_code,
  display_resource_key,
  description_resource_key,
  card_count,
  sort_order,
  is_active
)
values
  ('SKILL_CARD_JOKER_HERO', '00000000-0000-4000-8000-000000000001', 'SKILL_JOKER_HERO', 'card.skill.joker_hero', 'card.skill.joker_hero.description', 1, 1, true),
  ('SKILL_CARD_JOKER_SAINT', '00000000-0000-4000-8000-000000000001', 'SKILL_JOKER_SAINT', 'card.skill.joker_saint', 'card.skill.joker_saint.description', 1, 2, true),
  ('SKILL_CARD_EXTENSION_SEAL', '00000000-0000-4000-8000-000000000001', 'SKILL_EXTENSION_SEAL', 'card.skill.extension_seal', 'card.skill.extension_seal.description', 2, 3, true),
  ('SKILL_CARD_REVOLUTION', '00000000-0000-4000-8000-000000000001', 'SKILL_REVOLUTION', 'card.skill.revolution', 'card.skill.revolution.description', 2, 4, true)
on conflict (skill_id) do update set
  ruleset_id = excluded.ruleset_id,
  effect_code = excluded.effect_code,
  display_resource_key = excluded.display_resource_key,
  description_resource_key = excluded.description_resource_key,
  card_count = excluded.card_count,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
