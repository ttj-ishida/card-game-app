import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SANDBOX_MAX_PLAYERS,
  SANDBOX_MIN_PLAYERS,
  addCardToHand,
  addDiscard,
  clearField,
  createInitialRound,
  isValidFieldCards,
  makeSandboxCard,
  removeCardFromHand,
  removeDiscard,
  sandboxCardId,
  setActivePlayer,
  setConsecutivePasses,
  setDayNight,
  setExtensionSealed,
  setFieldCards,
  setFieldLastPlayer,
  setLockedSuit,
  setPlayerCount,
  setPlayerSkill,
  setPlayerSkillUsed,
  setPlayerStatus,
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

test('setPlayerCount clamps and keeps the active player valid', () => {
  const round = setActivePlayer(createInitialRound(), 'P2');
  const grown = setPlayerCount(round, 4);
  assert.deepEqual(
    grown.players.map((p) => p.playerId),
    ['P1', 'P2', 'P3', 'P4'],
  );
  assert.equal(grown.players[2].hand.length, 0);

  const shrunk = setPlayerCount(grown, 1);
  assert.equal(shrunk.players.length, 2);
  assert.equal(shrunk.activePlayerId, 'P2');

  const shrunkPastActive = setPlayerCount(setActivePlayer(grown, 'P4'), 2);
  assert.equal(shrunkPastActive.activePlayerId, 'P1');
});

test('setPlayerSkill adds, replaces, and clears a skill card', () => {
  let round = setPlayerSkill(createInitialRound(), 'P1', 'SKILL_REVOLUTION');
  assert.equal(round.players[0].skill?.effectCode, 'SKILL_REVOLUTION');
  assert.equal(round.players[0].skill?.used, false);
  round = setPlayerSkillUsed(round, 'P1', true);
  assert.equal(round.players[0].skill?.used, true);
  round = setPlayerSkill(round, 'P1', null);
  assert.equal(round.players[0].skill, null);
});

test('setPlayerStatus sets the status enum', () => {
  const round = setPlayerStatus(createInitialRound(), 'P2', 'PASSED');
  assert.equal(round.players[1].status, 'PASSED');
});

test('addCardToHand keeps each card id in exactly one zone', () => {
  let round = createInitialRound();
  round = addCardToHand(round, 'P2', 'RANK_3', 'SUIT_FIRE');
  assert.ok(round.players[1].hand.some((c) => c.cardId === 'SBX_RANK_3_SUIT_FIRE'));
  assert.ok(round.players[0].hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'));
  const ids = round.players.flatMap((p) => p.hand.map((c) => c.cardId));
  assert.equal(new Set(ids).size, ids.length);
});

test('removeCardFromHand drops the card', () => {
  const round = removeCardFromHand(createInitialRound(), 'P1', 'SBX_RANK_3_SUIT_FIRE');
  assert.ok(round.players[0].hand.every((c) => c.cardId !== 'SBX_RANK_3_SUIT_FIRE'));
});

test('moving a field card into a hand collapses or shrinks the field', () => {
  let round = createInitialRound();
  round = setFieldCards(
    round,
    [
      makeSandboxCard('RANK_3', 'SUIT_FIRE'),
      makeSandboxCard('RANK_4', 'SUIT_WATER'),
      makeSandboxCard('RANK_5', 'SUIT_WIND'),
    ],
    'P2',
  );
  assert.equal(round.activeField?.combination.kind, 'SEQUENCE');

  const moved = addCardToHand(round, 'P1', 'RANK_4', 'SUIT_WATER');
  assert.ok(moved.players[0].hand.some((c) => c.cardId === 'SBX_RANK_4_SUIT_WATER'));

  const fieldIds = moved.activeField?.combination.cards.map((c) => c.cardId) ?? [];
  assert.ok(!fieldIds.includes('SBX_RANK_4_SUIT_WATER'));
  // Observed real behavior: removing the middle card of a 3-card sequence leaves
  // [3-fire, 5-wind], which is not a valid combination, so the field collapses to null.
  assert.equal(moved.activeField, null);
});
