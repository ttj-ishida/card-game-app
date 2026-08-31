import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createActiveField,
  createNumberCard,
  determineRoundWinner,
  evaluateGoOut,
  evaluatePass,
  parseNumberCombination,
  resolveFieldClear,
} from "./index.ts";

const c = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH" = "FIRE") =>
  createNumberCard(
    `CARD_NUMBER_RANK_${rank}_SUIT_${suit}`,
    `RANK_${rank}` as never,
    `SUIT_${suit}` as never,
  );

function combo(cards: ReturnType<typeof c>[]) {
  const parsed = parseNumberCombination(cards);
  assert.ok(parsed);
  return parsed;
}

const field = (cards: ReturnType<typeof c>[], lastPlayerId = "player-1") =>
  createActiveField(combo(cards), lastPlayerId);

test("evaluatePass rejects a pass while the field is empty", () => {
  assert.deepEqual(
    evaluatePass({
      activeField: null,
      consecutivePassesBefore: 0,
      activePlayerCount: 3,
      lastPlayerActive: true,
    }),
    { legal: false, reason: "FIELD_EMPTY" },
  );
});

test("evaluatePass rejects a pass during the forced lead after a Joker clear", () => {
  assert.deepEqual(
    evaluatePass({
      activeField: field([c(6)]),
      consecutivePassesBefore: 0,
      activePlayerCount: 3,
      lastPlayerActive: true,
      mustLead: true,
    }),
    { legal: false, reason: "MUST_LEAD" },
  );
});

test("evaluatePass counts the pass without clearing while responders remain", () => {
  assert.deepEqual(
    evaluatePass({
      activeField: field([c(6)]),
      consecutivePassesBefore: 0,
      activePlayerCount: 3,
      lastPlayerActive: true,
    }),
    { legal: true, consecutivePasses: 1, clearsField: false },
  );
});

test("evaluatePass clears the field once every responder has passed", () => {
  assert.deepEqual(
    evaluatePass({
      activeField: field([c(6)]),
      consecutivePassesBefore: 1,
      activePlayerCount: 3,
      lastPlayerActive: true,
    }),
    { legal: true, consecutivePasses: 2, clearsField: true },
  );
});

test("evaluatePass counts the last player among responders when they are gone", () => {
  assert.deepEqual(
    evaluatePass({
      activeField: field([c(6)]),
      consecutivePassesBefore: 1,
      activePlayerCount: 2,
      lastPlayerActive: false,
    }),
    { legal: true, consecutivePasses: 2, clearsField: true },
  );
});

test("resolveFieldClear discards the set, drops lock and seal, keeps day/night, and leaves the last player leading", () => {
  assert.deepEqual(
    resolveFieldClear({
      currentField: field([c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE")], "player-2"),
      dayNight: "NIGHT",
      lastPlayerActive: true,
      fallbackLeaderId: "player-3",
    }),
    {
      clearedCards: [c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE")],
      lockedSuitCode: null,
      extensionSealed: false,
      dayNightAfter: "NIGHT",
      nextLeaderId: "player-2",
    },
  );
});

test("resolveFieldClear falls back to the next active player when the last player is gone", () => {
  assert.equal(
    resolveFieldClear({
      currentField: field([c(6)], "player-2"),
      dayNight: "DAY",
      lastPlayerActive: false,
      fallbackLeaderId: "player-3",
    }).nextLeaderId,
    "player-3",
  );
});

test("evaluateGoOut reports no win while number cards remain in hand", () => {
  assert.deepEqual(
    evaluateGoOut({
      numberCardsInHandAfterPlay: 2,
      playIncludesTransformedJoker: false,
    }),
    { goesOut: false },
  );
});

test("evaluateGoOut reports a win when the last number card empties the hand", () => {
  assert.deepEqual(
    evaluateGoOut({
      numberCardsInHandAfterPlay: 0,
      playIncludesTransformedJoker: false,
    }),
    { goesOut: true },
  );
});

test("evaluateGoOut forbids going out with a transformed Joker in the play", () => {
  assert.deepEqual(
    evaluateGoOut({
      numberCardsInHandAfterPlay: 0,
      playIncludesTransformedJoker: true,
    }),
    { goesOut: false, forbidden: true, reason: "TRANSFORM_JOKER_GO_OUT" },
  );
});

test("determineRoundWinner returns the first player who emptied their number hand", () => {
  assert.equal(
    determineRoundWinner([
      { playerId: "player-1", numberCardCount: 3 },
      { playerId: "player-2", numberCardCount: 0 },
      { playerId: "player-3", numberCardCount: 1 },
    ]),
    "player-2",
  );
  assert.equal(
    determineRoundWinner([
      { playerId: "player-1", numberCardCount: 2 },
      { playerId: "player-2", numberCardCount: 1 },
    ]),
    null,
  );
});
