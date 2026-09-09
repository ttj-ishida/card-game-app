import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CARD_ASPECT,
  CARD_METRICS,
  cardHeight,
  OVERLAY_BELOW_WIDTH,
  SUIT_SLUG,
  SUIT_SYMBOL,
} from './cardMetrics.ts';

test('cardHeight keeps the 5:7 ratio, rounded', () => {
  assert.equal(cardHeight(100), 140);
  assert.equal(
    cardHeight(CARD_METRICS.hand.width),
    Math.round(CARD_METRICS.hand.width * CARD_ASPECT),
  );
});

test('every CardFaceSize has a positive width; sizes are ordered mini < hand < field < catalog', () => {
  for (const size of ['catalog', 'hand', 'field', 'mini'] as const) {
    assert.ok(CARD_METRICS[size].width > 0, `${size} width`);
  }
  assert.ok(CARD_METRICS.mini.width < CARD_METRICS.hand.width);
  assert.ok(CARD_METRICS.hand.width < CARD_METRICS.field.width);
  assert.ok(CARD_METRICS.field.width < CARD_METRICS.catalog.width);
});

test('battle sizes sit below the overlay threshold and catalog above it', () => {
  assert.ok(CARD_METRICS.hand.width < OVERLAY_BELOW_WIDTH);
  assert.ok(CARD_METRICS.field.width < OVERLAY_BELOW_WIDTH);
  assert.ok(CARD_METRICS.mini.width < OVERLAY_BELOW_WIDTH);
  assert.ok(CARD_METRICS.catalog.width >= OVERLAY_BELOW_WIDTH);
});

test('each suit has a distinct symbol', () => {
  assert.equal(new Set(Object.values(SUIT_SYMBOL)).size, 4);
});

test('SUIT_SLUG maps each suit to a distinct lowercase slug', () => {
  const slugs = Object.values(SUIT_SLUG);
  assert.equal(new Set(slugs).size, 4);
  assert.ok(slugs.every((s) => /^[a-z]+$/.test(s)));
});
