import assert from 'node:assert/strict';
import test from 'node:test';

import { jaDictionary, translate, type TranslationKey } from './translate';

test('translate returns Japanese text for an existing key', () => {
  assert.equal(translate('app.title'), '大貧民2000');
});

test('translate rejects missing keys so display strings are not silently lost', () => {
  assert.throws(() => translate('missing.key'), /Missing translation key/);
});

test('jaDictionary includes M0 screen and card catalog keys', () => {
  const requiredKeys: TranslationKey[] = [
    'app.title',
    'home.subtitle',
    'home.openCatalog',
    'catalog.title',
    'catalog.placeholder',
    'catalog.error.network',
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof jaDictionary[key], 'string');
    assert.notEqual(jaDictionary[key].length, 0);
  }
});
