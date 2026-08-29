import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addCardToHand,
  setFieldCards,
  makeSandboxCard,
  setActivePlayer,
  setPlayerCount,
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

test('undo also restores the play draft recorded in history', () => {
  const store = createRuleSandboxStore();
  store
    .getState()
    .editRound((round) => setFieldCards(round, [makeSandboxCard('RANK_6', 'SUIT_WATER')], 'P2'));
  store.getState().editRound((round) => addCardToHand(round, 'P1', 'RANK_8', 'SUIT_FIRE'));
  store.getState().setPlayDraft({ kind: 'PLAY', cardIds: ['SBX_RANK_8_SUIT_FIRE'] });
  store.getState().applyPlay();
  assert.deepEqual(store.getState().playDraft, { kind: 'PLAY', cardIds: [] });
  store.getState().undo();
  assert.deepEqual(store.getState().playDraft, { kind: 'PLAY', cardIds: ['SBX_RANK_8_SUIT_FIRE'] });
});

test('loadPreset seeds the field draft from the preset field so the last-player selector is accurate', () => {
  const store = createRuleSandboxStore();
  store.getState().loadPreset('replace-stronger');
  const { fieldDraft, draft } = store.getState();
  assert.equal(fieldDraft.lastPlayerId, draft.activeField?.lastPlayerId);
  assert.equal(fieldDraft.lastPlayerId, 'P2');
  assert.deepEqual(
    fieldDraft.cards.map((card) => card.cardId),
    draft.activeField?.combination.cards.map((card) => card.cardId),
  );
});

test('reset clears the field draft back to the initial round', () => {
  const store = createRuleSandboxStore();
  store.getState().loadPreset('replace-stronger');
  store.getState().reset();
  assert.deepEqual(store.getState().fieldDraft, { cards: [], lastPlayerId: 'P1' });
});

test('commitFieldDraft places a valid combination and clears the draft', () => {
  const store = createRuleSandboxStore();
  store.getState().setFieldDraftCards([makeSandboxCard('RANK_6', 'SUIT_WATER')]);
  store.getState().setFieldDraftLastPlayer('P2');
  store.getState().commitFieldDraft();
  assert.equal(store.getState().draft.activeField?.combination.ranks[0], 6);
  assert.equal(store.getState().draft.activeField?.lastPlayerId, 'P2');
  assert.deepEqual(store.getState().fieldDraft.cards, []);
});

test('commitFieldDraft is a no-op for an invalid combination', () => {
  const store = createRuleSandboxStore();
  const before = store.getState().draft;
  store
    .getState()
    .setFieldDraftCards([
      makeSandboxCard('RANK_6', 'SUIT_FIRE'),
      makeSandboxCard('RANK_8', 'SUIT_WATER'),
    ]);
  store.getState().commitFieldDraft();
  assert.equal(store.getState().draft, before);
});

test('commitFieldDraft clamps a stale last-player id to a current player', () => {
  const store = createRuleSandboxStore();
  store.getState().editRound((round) => setPlayerCount(round, 4));
  store.getState().setFieldDraftLastPlayer('P4');
  store.getState().editRound((round) => setPlayerCount(round, 2));
  store.getState().setFieldDraftCards([makeSandboxCard('RANK_6', 'SUIT_WATER')]);
  store.getState().commitFieldDraft();
  assert.equal(store.getState().draft.activeField?.lastPlayerId, 'P1');
  assert.equal(store.getState().fieldDraft.lastPlayerId, 'P1');
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
