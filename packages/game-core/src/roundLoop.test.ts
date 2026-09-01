import assert from "node:assert/strict";
import { test } from "node:test";

import { type CpuPolicyId, numberDeck, playRound } from "./index.ts";

const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const allStandard = (ids: string[]): Record<string, CpuPolicyId> =>
  Object.fromEntries(ids.map((id) => [id, "STANDARD"]));

for (const n of [2, 3, 4, 5, 6]) {
  test(`playRound reaches a winner for ${n} players`, () => {
    const ids = seats(n);
    const result = playRound({ playerIds: ids, seed: n * 100 + 7, seatPolicies: allStandard(ids) });
    assert.equal(result.stopReason, "WINNER");
    assert.ok(result.winnerId && ids.includes(result.winnerId));
    const winnerHand = result.finalState.players.find((p) => p.playerId === result.winnerId);
    assert.equal(winnerHand?.hand.length, 0);
  });
}

test("card conservation holds on every turn", () => {
  const ids = seats(4);
  const result = playRound({ playerIds: ids, seed: 4242, seatPolicies: allStandard(ids) });
  for (const turn of result.turns) {
    const inHands = Object.values(turn.handCountsAfter).reduce((a, b) => a + b, 0);
    assert.ok(inHands <= numberDeck().length);
  }
  const finalInHands = result.finalState.players.reduce((a, p) => a + p.hand.length, 0);
  const field = result.finalState.activeField?.combination.cards.length ?? 0;
  assert.equal(finalInHands + result.finalState.discardPile.length + field, 36);
});

test("playRound is fully reproducible for the same seed", () => {
  const ids = seats(5);
  const a = playRound({ playerIds: ids, seed: 999, seatPolicies: allStandard(ids) });
  const b = playRound({ playerIds: ids, seed: 999, seatPolicies: allStandard(ids) });
  assert.deepEqual(a, b);
});

test("TurnRecord carries a think delay and legal-play count but no card contents", () => {
  const ids = seats(3);
  const result = playRound({ playerIds: ids, seed: 5, seatPolicies: allStandard(ids) });
  assert.ok(result.turns.length > 0);
  for (const turn of result.turns) {
    assert.ok(turn.thinkMillis >= 600 && turn.thinkMillis <= 1200);
    assert.ok(turn.legalPlayCount >= 1);
    assert.ok(!JSON.stringify(turn).includes("CARD_NUMBER_")); // no card ids leak
  }
});

test("playRound throws when a seat has no policy", () => {
  const ids = seats(3);
  assert.throws(
    () => playRound({ playerIds: ids, seed: 1, seatPolicies: { p1: "STANDARD", p2: "STANDARD" } }),
    Error,
  );
});

test("maxTurns stops the loop with MAX_TURNS", () => {
  const ids = seats(4);
  const result = playRound({
    playerIds: ids,
    seed: 1,
    seatPolicies: allStandard(ids),
    maxTurns: 3,
  });
  assert.equal(result.stopReason, "MAX_TURNS");
  assert.equal(result.turns.length, 3);
});

test("rematchIndex rotates the first player", () => {
  const ids = seats(4);
  const base = playRound({ playerIds: ids, seed: 1, seatPolicies: allStandard(ids) });
  const first0 = base.deal.firstPlayerId;
  const rematch = playRound({
    playerIds: ids,
    seed: 2,
    seatPolicies: allStandard(ids),
    rematchIndex: 1,
    baselineFirstPlayerId: first0,
  });
  assert.equal(rematch.deal.firstPlayerId, ids[(ids.indexOf(first0) + 1) % 4]);
});
