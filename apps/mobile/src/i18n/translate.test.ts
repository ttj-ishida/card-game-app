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

test('jaDictionary includes rule sandbox keys for every reason and action code', () => {
  const reasonCodes = [
    'INVALID_COMBINATION',
    'SHAPE_MISMATCH',
    'NOT_STRONGER',
    'EXTENSION_SEALED',
    'SUIT_LOCKED',
    'NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL',
    'DUPLICATE_JOKER_DECLARATION',
    'JOKER_TRANSFORM_LAST_NUMBER_WIN',
    'ROUND_FINISHED',
    'NOT_ACTIVE_PLAYER',
    'CARD_NOT_IN_HAND',
    'SKILL_NOT_AVAILABLE',
    'FIELD_EMPTY',
    'MUST_LEAD',
    'NO_FIELD_TO_CLEAR',
    'TRANSFORM_JOKER_GO_OUT',
  ];
  const actionCodes = ['LEAD', 'EXTEND', 'REPLACE', 'PASS'];

  for (const code of reasonCodes) {
    assert.equal(typeof jaDictionary[`sandbox.reason.${code}` as TranslationKey], 'string');
  }
  for (const code of actionCodes) {
    assert.equal(typeof jaDictionary[`sandbox.action.${code}` as TranslationKey], 'string');
  }
  for (const key of [
    'sandbox.title',
    'sandbox.devLabel',
    'sandbox.section.board',
    'sandbox.section.play',
    'sandbox.section.result',
    'sandbox.section.history',
    'sandbox.result.legal',
    'sandbox.result.illegal',
    'sandbox.badge.naturalRevolution',
    'sandbox.badge.fieldCleared',
    'sandbox.badge.winner',
    'sandbox.field.empty',
    'sandbox.field.invalid',
    'sandbox.history.empty',
    'sandbox.preset.replace-stronger',
    'sandbox.preset.forbidden-joker-go-out',
    'sandbox.preset.pass-clears-field',
  ] as TranslationKey[]) {
    assert.notEqual(jaDictionary[key].length, 0);
  }
});
