import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addCardToHand,
  setFieldCards,
  makeSandboxCard,
  setActivePlayer,
} from '../features/rule-sandbox/sandboxModel';
import { createRuleSandboxStore } from './rule-sandbox-store';

test('the store starts from the initial round with empty history', () => {
  const store = createRuleSandboxStore();
  assert.equal(store.getState().draft.players.length, 2);
  assert.deepEqual(store.getState().history, []);
  assert.equal(store.getState().lastResult, null);
});

test('editRound replaces the draft through a pure editor', () => {
  const store = createRuleSandboxStore();
  store.getState().editRound((round) => setActivePlayer(round, 'P2'));
  assert.equal(store.getState().draft.activePlayerId, 'P2');
});

test('applyPlay advances the draft and records history on a legal play', () => {
  const store = createRuleSandboxStore();
  store
    .getState()
    .editRound((round) => setFieldCards(round, [makeSandboxCard('RANK_6', 'SUIT_WATER')], 'P2'));
  store.getState().editRound((round) => addCardToHand(round, 'P1', 'RANK_8', 'SUIT_FIRE'));
  store.getState().setPlayDraft({ kind: 'PLAY', cardIds: ['SBX_RANK_8_SUIT_FIRE'] });
  store.getState().applyPlay();

  assert.equal(store.getState().lastResult?.ok, true);
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().draft.activeField?.combination.ranks[0], 8);
  assert.deepEqual(store.getState().playDraft, { kind: 'PLAY', cardIds: [] });
});

test('applyPlay keeps the draft and reports the reason on an illegal play', () => {
  const store = createRuleSandboxStore();
  const before = store.getState().draft;
  store.getState().setPlayDraft({ kind: 'PASS', cardIds: [] });
  store.getState().applyPlay();

  assert.equal(store.getState().lastResult?.ok, false);
  assert.equal(store.getState().lastResult?.reasonKey, 'sandbox.reason.FIELD_EMPTY');
  assert.equal(store.getState().draft, before);
  assert.equal(store.getState().history.length, 0);
});

test('undo restores the round from before the last applied play', () => {
  const store = createRuleSandboxStore();
  store
    .getState()
    .editRound((round) => setFieldCards(round, [makeSandboxCard('RANK_6', 'SUIT_WATER')], 'P2'));
  store.getState().editRound((round) => addCardToHand(round, 'P1', 'RANK_8', 'SUIT_FIRE'));
  const beforePlay = store.getState().draft;
  store.getState().setPlayDraft({ kind: 'PLAY', cardIds: ['SBX_RANK_8_SUIT_FIRE'] });
  store.getState().applyPlay();
  store.getState().undo();

  assert.equal(store.getState().draft, beforePlay);
  assert.equal(store.getState().history.length, 0);
});

test('reset returns to the initial round', () => {
  const store = createRuleSandboxStore();
  store.getState().editRound((round) => setActivePlayer(round, 'P2'));
  store.getState().reset();
  assert.equal(store.getState().draft.activePlayerId, 'P1');
});

test('loadPreset installs the preset round and play draft', () => {
  const store = createRuleSandboxStore();
  store.getState().loadPreset('replace-stronger');
  assert.equal(store.getState().draft.activeField?.combination.ranks[0], 6);
  assert.equal(store.getState().playDraft.kind, 'PLAY');
  assert.deepEqual(store.getState().history, []);
});
