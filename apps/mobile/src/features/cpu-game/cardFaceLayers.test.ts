import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cardFaceLayers } from './cardFaceLayers.ts';

test('no art: vector base, no overlay; name line only at catalog size', () => {
  assert.deepEqual(cardFaceLayers('catalog', false), {
    base: 'vector',
    overlay: false,
    showName: true,
  });
  assert.deepEqual(cardFaceLayers('hand', false), {
    base: 'vector',
    overlay: false,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers('mini', false), {
    base: 'vector',
    overlay: false,
    showName: false,
  });
});

test('with art: image base; overlay only below the width threshold; never a name line', () => {
  assert.deepEqual(cardFaceLayers('catalog', true), {
    base: 'image',
    overlay: false,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers('hand', true), {
    base: 'image',
    overlay: true,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers('field', true), {
    base: 'image',
    overlay: true,
    showName: false,
  });
  assert.deepEqual(cardFaceLayers('mini', true), {
    base: 'image',
    overlay: true,
    showName: false,
  });
});
