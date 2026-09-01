import assert from 'node:assert/strict';
import test from 'node:test';

import { type PlayRejectionReason } from '@card-game-app/game-core';

import { jaDictionary, translate, type TranslationKey } from './translate';

// Exhaustive map of every game-core rejection reason. `satisfies` makes `tsc`
// fail here (not at render time inside describeResolution -> translate) if
// game-core adds or renames a PlayRejectionReason member.
const REASON_CODES = {
  INVALID_COMBINATION: true,
  SHAPE_MISMATCH: true,
  NOT_STRONGER: true,
  EXTENSION_SEALED: true,
  COUNT_LOCKED: true,
  SUIT_FIXED_MISMATCH: true,
  SUIT_UNIFORM_REQUIRED: true,
  NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL: true,
  DUPLICATE_JOKER_DECLARATION: true,
  JOKER_TRANSFORM_LAST_NUMBER_WIN: true,
  ROUND_FINISHED: true,
  NOT_ACTIVE_PLAYER: true,
  CARD_NOT_IN_HAND: true,
  SKILL_NOT_AVAILABLE: true,
  FIELD_EMPTY: true,
  MUST_LEAD: true,
  NO_FIELD_TO_CLEAR: true,
  TRANSFORM_JOKER_GO_OUT: true,
} satisfies Record<PlayRejectionReason, true>;

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
  const reasonCodes = Object.keys(REASON_CODES);
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
    'sandbox.fieldLock.count',
    'sandbox.fieldLock.suitUniform',
    'sandbox.fieldLock.suitFixed',
    'sandbox.preset.count-locked-add-rejected',
    'sandbox.preset.suit-uniform-update',
  ] as TranslationKey[]) {
    assert.notEqual(jaDictionary[key].length, 0);
  }
});

test('jaDictionary includes every cpu-game screen key required by the M2 flow', () => {
  const requiredKeys: TranslationKey[] = [
    'home.cpuGame',
    'cpuGame.setup.title',
    'cpuGame.setup.players',
    'cpuGame.setup.start',
    'cpuGame.seat.you',
    'cpuGame.seat.cpu',
    'cpuGame.phase.yourTurn',
    'cpuGame.phase.cpuThinking',
    'cpuGame.phase.roundOver',
    'cpuGame.action.submit',
    'cpuGame.action.pass',
    'cpuGame.action.clear',
    'cpuGame.field.empty',
    'cpuGame.field.lastPlayer',
    'cpuGame.lock.count',
    'cpuGame.lock.suitFixed',
    'cpuGame.lock.suitUniform',
    'cpuGame.lock.seal',
    'cpuGame.dayNight.day',
    'cpuGame.dayNight.night',
    'cpuGame.dayNight.strengthOrder',
    'cpuGame.opponent.cardsSuffix',
    'cpuGame.opponent.hasSkill',
    'cpuGame.opponent.status.PASSED',
    'cpuGame.opponent.status.OUT',
    'cpuGame.skill.heldNote',
    'cpuGame.invalid',
    'cpuGame.result.title',
    'cpuGame.result.youWin',
    'cpuGame.result.youLose',
    'cpuGame.result.winnerIs',
    'cpuGame.result.turns',
    'cpuGame.result.duration',
    'cpuGame.result.rematch',
    'cpuGame.result.home',
    'cpuGame.result.saveOk',
    'cpuGame.result.saveQueued',
    'cpuGame.exit.confirmTitle',
    'cpuGame.exit.confirmOk',
    'cpuGame.exit.confirmCancel',
    'cpuGame.history',
    'cpuGame.seatShort.you',
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof jaDictionary[key], 'string');
    assert.notEqual(jaDictionary[key].length, 0);
    assert.equal(translate(key), jaDictionary[key]);
  }

  // Every cpuGame.* key in the dictionary must resolve through translate().
  for (const key of Object.keys(jaDictionary)) {
    if (key.startsWith('cpuGame.')) {
      assert.equal(translate(key), jaDictionary[key as TranslationKey]);
    }
  }
});
