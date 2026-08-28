import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertCompleteM0Catalog, buildCatalogItems, placeholderManifest } from './cardCatalog';

const suits = ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH'] as const;
const numberCards = Array.from({ length: 9 }, (_, rankIndex) =>
  suits.map((suitCode, suitIndex) => ({
    card_id: `CARD_NUMBER_RANK_${rankIndex + 1}_${suitCode}`,
    rank_code: `RANK_${rankIndex + 1}`,
    suit_code: suitCode,
    display_resource_key: `card.number.rank_${rankIndex + 1}.suit_${suitCode.toLowerCase()}`,
    sort_order: rankIndex * 4 + suitIndex + 1,
  })),
).flat();

const skillCards = [
  {
    skill_id: 'SKILL_CARD_JOKER_HERO',
    effect_code: 'SKILL_JOKER_HERO',
    display_resource_key: 'card.skill.joker_hero',
    description_resource_key: 'card.skill.joker_hero.description',
    card_count: 1,
    sort_order: 1,
  },
  {
    skill_id: 'SKILL_CARD_JOKER_SAINT',
    effect_code: 'SKILL_JOKER_SAINT',
    display_resource_key: 'card.skill.joker_saint',
    description_resource_key: 'card.skill.joker_saint.description',
    card_count: 1,
    sort_order: 2,
  },
  {
    skill_id: 'SKILL_CARD_EXTENSION_SEAL',
    effect_code: 'SKILL_EXTENSION_SEAL',
    display_resource_key: 'card.skill.extension_seal',
    description_resource_key: 'card.skill.extension_seal.description',
    card_count: 2,
    sort_order: 3,
  },
  {
    skill_id: 'SKILL_CARD_REVOLUTION',
    effect_code: 'SKILL_REVOLUTION',
    display_resource_key: 'card.skill.revolution',
    description_resource_key: 'card.skill.revolution.description',
    card_count: 2,
    sort_order: 4,
  },
];

test('buildCatalogItems expands M0 masters to 42 display items with assets', () => {
  const items = buildCatalogItems(numberCards, skillCards);
  assert.equal(items.length, 42);
  assert.equal(items.length, placeholderManifest.physicalDeckCount);
  assertCompleteM0Catalog(items);
  assert.equal(items[0].id, 'CARD_NUMBER_RANK_1_SUIT_FIRE');
  assert.equal(items.at(-1)?.id, 'SKILL_CARD_REVOLUTION#2');
});

test('buildCatalogItems fails when a master row has no placeholder asset', () => {
  assert.throws(
    () => buildCatalogItems([{ ...numberCards[0], card_id: 'CARD_NUMBER_RANK_0_SUIT_FIRE' }], []),
    /Missing number asset/,
  );
});
