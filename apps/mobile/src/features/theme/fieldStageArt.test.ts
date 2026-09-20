import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fieldStageKey, resolveFieldStageArt, resolveFieldStageLayers } from './fieldStageArt.ts';

test('fieldStageKey builds field-stage-<scheme>', () => {
  assert.equal(fieldStageKey('dark'), 'field-stage-dark');
  assert.equal(fieldStageKey('light'), 'field-stage-light');
});

test('resolveFieldStageArt returns the mapped require id, or null when absent', () => {
  assert.equal(resolveFieldStageArt('dark', {}), null);
  assert.equal(resolveFieldStageArt('dark', { 'field-stage-dark': () => 4242 }), 4242);
});

test('resolveFieldStageArt defaults to the generated map (filled after SP4b)', () => {
  assert.equal(resolveFieldStageArt('dark'), 0);
  assert.equal(resolveFieldStageArt('light'), 0);
});

test('resolveFieldStageLayers: dark scheme bases on dark, flips to light', () => {
  const assets = { 'field-stage-dark': () => 1, 'field-stage-light': () => 2 };
  assert.deepEqual(resolveFieldStageLayers('dark', assets), { base: 1, flip: 2 });
});

test('resolveFieldStageLayers: light scheme bases on light, flips to dark', () => {
  const assets = { 'field-stage-dark': () => 1, 'field-stage-light': () => 2 };
  assert.deepEqual(resolveFieldStageLayers('light', assets), { base: 2, flip: 1 });
});

test('resolveFieldStageLayers: both null when neither asset exists (fallback to vector ellipse)', () => {
  assert.deepEqual(resolveFieldStageLayers('dark', {}), { base: null, flip: null });
});
