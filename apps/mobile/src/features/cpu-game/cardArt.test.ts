import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cardArtKey, resolveCardArt } from './cardArt.ts';

const SUITS = ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH'] as const;

test('cardArtKey builds card-<rank>-<suit-slug>', () => {
  assert.equal(cardArtKey(1, 'SUIT_FIRE'), 'card-1-fire');
  assert.equal(cardArtKey(9, 'SUIT_EARTH'), 'card-9-earth');
  assert.equal(cardArtKey(5, 'SUIT_WATER'), 'card-5-water');
  assert.equal(cardArtKey(6, 'SUIT_WIND'), 'card-6-wind');
});

test('cardArtKey covers all 36 number cards with distinct keys', () => {
  const keys = new Set<string>();
  for (let rank = 1; rank <= 9; rank += 1) for (const s of SUITS) keys.add(cardArtKey(rank, s));
  assert.equal(keys.size, 36);
});

test('resolveCardArt returns the mapped require id, or null when absent', () => {
  assert.equal(resolveCardArt(3, 'SUIT_FIRE', {}), null);
  assert.equal(resolveCardArt(3, 'SUIT_FIRE', { 'card-3-fire': 4242 }), 4242);
});

test('resolveCardArt defaults to the generated map (empty in SP4a)', () => {
  assert.equal(resolveCardArt(1, 'SUIT_FIRE'), null);
});
