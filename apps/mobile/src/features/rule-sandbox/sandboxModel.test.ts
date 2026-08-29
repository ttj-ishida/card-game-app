import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SANDBOX_MAX_PLAYERS,
  SANDBOX_MIN_PLAYERS,
  addDiscard,
  clearField,
  createInitialRound,
  isValidFieldCards,
  makeSandboxCard,
  removeDiscard,
  sandboxCardId,
  setActivePlayer,
  setConsecutivePasses,
  setDayNight,
  setExtensionSealed,
  setFieldCards,
  setFieldLastPlayer,
  setLockedSuit,
} from './sandboxModel';

test('sandboxCardId is stable and encodes rank and suit', () => {
  assert.equal(sandboxCardId('RANK_3', 'SUIT_FIRE'), 'SBX_RANK_3_SUIT_FIRE');
});

test('makeSandboxCard builds a number card with the stable id', () => {
  assert.deepEqual(makeSandboxCard('RANK_3', 'SUIT_FIRE'), {
    kind: 'NUMBER',
    cardId: 'SBX_RANK_3_SUIT_FIRE',
    rankCode: 'RANK_3',
    suitCode: 'SUIT_FIRE',
  });
});

test('createInitialRound returns a playable two-player day round with no field', () => {
  const round = createInitialRound();

  assert.equal(round.players.length, SANDBOX_MIN_PLAYERS);
  assert.ok(SANDBOX_MAX_PLAYERS > SANDBOX_MIN_PLAYERS);
  assert.equal(round.dayNight, 'DAY');
  assert.equal(round.activeField, null);
  assert.equal(round.activePlayerId, round.players[0].playerId);
  assert.equal(round.consecutivePasses, 0);
  assert.equal(round.winnerId, null);
  assert.ok(round.players.every((player) => player.hand.length > 0));
  assert.equal(
    new Set(round.players.flatMap((p) => p.hand.map((c) => c.cardId))).size,
    round.players.flatMap((p) => p.hand).length,
  );
});

test('setDayNight flips the strength orientation', () => {
  assert.equal(setDayNight(createInitialRound(), 'NIGHT').dayNight, 'NIGHT');
});

test('setActivePlayer ignores unknown player ids', () => {
  const round = createInitialRound();
  assert.equal(setActivePlayer(round, 'GHOST').activePlayerId, 'P1');
  assert.equal(setActivePlayer(round, 'P2').activePlayerId, 'P2');
});

test('setConsecutivePasses clamps to a non-negative integer', () => {
  const round = createInitialRound();
  assert.equal(setConsecutivePasses(round, -3).consecutivePasses, 0);
  assert.equal(setConsecutivePasses(round, 2.9).consecutivePasses, 2);
});

test('setLockedSuit and setExtensionSealed set the field effects', () => {
  const round = createInitialRound();
  assert.equal(setLockedSuit(round, 'SUIT_WATER').lockedSuitCode, 'SUIT_WATER');
  assert.equal(setLockedSuit(round, null).lockedSuitCode, null);
  assert.equal(setExtensionSealed(round, true).extensionSealed, true);
});

test('isValidFieldCards rejects combinations parseNumberCombination cannot read', () => {
  assert.equal(isValidFieldCards([makeSandboxCard('RANK_6', 'SUIT_FIRE')]), true);
  assert.equal(
    isValidFieldCards([
      makeSandboxCard('RANK_6', 'SUIT_FIRE'),
      makeSandboxCard('RANK_8', 'SUIT_WATER'),
    ]),
    false,
  );
});

test('setFieldCards places a valid combination and pulls those ids out of hands', () => {
  let round = createInitialRound();
  round = setFieldCards(round, [makeSandboxCard('RANK_3', 'SUIT_FIRE')], 'P2');
  assert.equal(round.activeField?.combination.kind, 'SINGLE');
  assert.equal(round.activeField?.lastPlayerId, 'P2');
  assert.ok(
    round.players
      .find((p) => p.playerId === 'P1')
      ?.hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'),
  );
});

test('setFieldCards leaves the round untouched for an invalid combination', () => {
  const round = createInitialRound();
  const next = setFieldCards(
    round,
    [makeSandboxCard('RANK_6', 'SUIT_FIRE'), makeSandboxCard('RANK_8', 'SUIT_WATER')],
    'P2',
  );
  assert.equal(next, round);
});

test('clearField and setFieldLastPlayer operate on the field', () => {
  let round = setFieldCards(createInitialRound(), [makeSandboxCard('RANK_6', 'SUIT_FIRE')], 'P2');
  assert.equal(setFieldLastPlayer(round, 'P1').activeField?.lastPlayerId, 'P1');
  assert.equal(clearField(round).activeField, null);
});

test('addDiscard moves a card into the discard pile and out of every other zone', () => {
  let round = createInitialRound();
  round = addDiscard(round, makeSandboxCard('RANK_3', 'SUIT_FIRE'));
  assert.deepEqual(
    round.discardPile.map((c) => c.cardId),
    ['SBX_RANK_3_SUIT_FIRE'],
  );
  assert.ok(
    round.players
      .find((p) => p.playerId === 'P1')
      ?.hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'),
  );
  assert.equal(removeDiscard(round, 'SBX_RANK_3_SUIT_FIRE').discardPile.length, 0);
});
