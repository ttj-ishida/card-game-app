import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SANDBOX_MAX_PLAYERS,
  SANDBOX_MIN_PLAYERS,
  createInitialRound,
  makeSandboxCard,
  sandboxCardId,
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
