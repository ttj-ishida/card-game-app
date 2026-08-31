import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePlay } from '@card-game-app/game-core';
import { jaDictionary } from '../../i18n/translate';

import { buildPlayInput } from './sandboxModel';
import { SANDBOX_PRESETS } from './sandboxPresets';

test('there are thirteen presets with unique ids and existing title keys', () => {
  assert.equal(SANDBOX_PRESETS.length, 13);
  const ids = SANDBOX_PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const preset of SANDBOX_PRESETS) {
    assert.equal(preset.titleKey, `sandbox.preset.${preset.id}`);
    assert.equal(typeof jaDictionary[preset.titleKey as keyof typeof jaDictionary], 'string');
  }
});

test('the replace-stronger preset is a legal REPLACE', () => {
  const preset = SANDBOX_PRESETS.find((entry) => entry.id === 'replace-stronger');
  assert.ok(preset);
  const result = resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.outcome.actionKind, 'REPLACE');
});

test('the forbidden-joker-go-out preset is rejected without consuming cards', () => {
  const preset = SANDBOX_PRESETS.find((entry) => entry.id === 'forbidden-joker-go-out');
  assert.ok(preset);
  const result = resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'TRANSFORM_JOKER_GO_OUT');
});

test('the pass-clears-field preset clears the field', () => {
  const preset = SANDBOX_PRESETS.find((entry) => entry.id === 'pass-clears-field');
  assert.ok(preset);
  const result = resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.outcome.fieldCleared, true);
});

test('every preset resolves to the outcome encoded in its id', () => {
  const byId = new Map(SANDBOX_PRESETS.map((preset) => [preset.id, preset]));
  const run = (id: string) => {
    const preset = byId.get(id);
    assert.ok(preset, `missing preset ${id}`);
    return resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  };

  const replaceStronger = run('replace-stronger');
  assert.equal(replaceStronger.ok && replaceStronger.outcome.actionKind, 'REPLACE');

  const nightWeakerWins = run('night-weaker-wins');
  assert.equal(nightWeakerWins.ok && nightWeakerWins.outcome.actionKind, 'REPLACE');

  const extendTo666 = run('extend-to-666');
  assert.equal(extendTo666.ok && extendTo666.outcome.actionKind, 'EXTEND');

  const sequenceNaturalRevolution = run('sequence-natural-revolution');
  assert.equal(sequenceNaturalRevolution.ok, true);
  assert.equal(
    sequenceNaturalRevolution.ok && sequenceNaturalRevolution.outcome.naturalRevolution,
    true,
  );

  const suitLock = run('suit-lock');
  assert.equal(suitLock.ok, true);
  assert.equal(suitLock.ok && suitLock.outcome.actionKind, 'REPLACE');
  assert.equal(suitLock.ok && suitLock.state.activeField?.lock.suitUniform, true);

  const extensionSealed = run('extension-sealed');
  assert.equal(extensionSealed.ok, false);
  assert.equal(extensionSealed.ok === false && extensionSealed.reason, 'EXTENSION_SEALED');

  const revolutionCard = run('revolution-card');
  assert.equal(revolutionCard.ok, true);
  assert.equal(revolutionCard.ok && revolutionCard.outcome.actionKind, 'REPLACE');
  assert.equal(revolutionCard.ok && revolutionCard.state.dayNight, 'NIGHT');

  const jokerClearWin = run('joker-clear-win');
  assert.equal(jokerClearWin.ok, true);
  assert.equal(jokerClearWin.ok && jokerClearWin.outcome.fieldCleared, true);
  assert.equal(jokerClearWin.ok && jokerClearWin.outcome.winnerId, 'P1');

  const forbiddenJokerGoOut = run('forbidden-joker-go-out');
  assert.equal(forbiddenJokerGoOut.ok, false);
  assert.equal(
    forbiddenJokerGoOut.ok === false && forbiddenJokerGoOut.reason,
    'TRANSFORM_JOKER_GO_OUT',
  );

  const passClearsField = run('pass-clears-field');
  assert.equal(passClearsField.ok, true);
  assert.equal(passClearsField.ok && passClearsField.outcome.fieldCleared, true);

  const countLockedAddRejected = run('count-locked-add-rejected');
  assert.equal(countLockedAddRejected.ok, false);
  assert.equal(
    countLockedAddRejected.ok === false && countLockedAddRejected.reason,
    'COUNT_LOCKED',
  );

  const suitFixedMismatch = run('suit-fixed-mismatch');
  assert.equal(suitFixedMismatch.ok, false);
  assert.equal(suitFixedMismatch.ok === false && suitFixedMismatch.reason, 'SUIT_FIXED_MISMATCH');

  const suitUniformUpdate = run('suit-uniform-update');
  assert.equal(suitUniformUpdate.ok, true);
  assert.equal(suitUniformUpdate.ok && suitUniformUpdate.outcome.actionKind, 'REPLACE');
});

test('the three field-lock presets resolve to their encoded lock outcomes', () => {
  const byId = new Map(SANDBOX_PRESETS.map((preset) => [preset.id, preset]));
  const run = (id: string) => {
    const preset = byId.get(id);
    assert.ok(preset, `missing preset ${id}`);
    return resolvePlay(preset.round, buildPlayInput(preset.round, preset.play));
  };

  const countLocked = run('count-locked-add-rejected');
  assert.equal(countLocked.ok === false && countLocked.reason, 'COUNT_LOCKED');

  const suitFixed = run('suit-fixed-mismatch');
  assert.equal(suitFixed.ok === false && suitFixed.reason, 'SUIT_FIXED_MISMATCH');

  const suitUniform = run('suit-uniform-update');
  assert.equal(suitUniform.ok, true);
  assert.equal(suitUniform.ok && suitUniform.outcome.actionKind, 'REPLACE');
  assert.equal(suitUniform.ok && suitUniform.state.activeField?.lock.suitUniform, true);
});
