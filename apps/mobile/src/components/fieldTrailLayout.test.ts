import assert from 'node:assert/strict';
import { test } from 'node:test';

import { centerLatestOffset, stepWidth } from './fieldTrailLayout.ts';

test('stepWidth grows with card count and is wider for the latest step', () => {
  assert.equal(stepWidth(0, true), 0);
  assert.ok(stepWidth(2, true) > stepWidth(2, false));
  assert.ok(stepWidth(3, false) > stepWidth(1, false));
});

test('a single step is centred (offset puts its middle at containerWidth/2)', () => {
  const w = stepWidth(2, true);
  assert.equal(centerLatestOffset([2], 600), Math.round(600 / 2 - w / 2));
});

test('more/earlier steps push the offset further negative (row slides left)', () => {
  const one = centerLatestOffset([2], 600);
  const three = centerLatestOffset([2, 3, 2], 600);
  assert.ok(three < one);
});

test('empty trail yields no offset', () => {
  assert.equal(centerLatestOffset([], 600), 0);
});
