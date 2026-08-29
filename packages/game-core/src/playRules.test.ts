import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createNumberCard,
  evaluateNumberPlay,
  parseNumberCombination,
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

test("evaluateNumberPlay allows leads, single replacement, and rank-set extension", () => {
  assert.deepEqual(
    evaluateNumberPlay({
      current: null,
      candidateCards: [c(4)],
      dayNight: "DAY",
    }),
    {
      legal: true,
      actionKind: "LEAD",
      combination: combo([c(4)]),
      resultingCombination: combo([c(4)]),
    },
  );

  assert.equal(
    evaluateNumberPlay({
      current: combo([c(6)]),
      candidateCards: [c(7)],
      dayNight: "DAY",
    }).actionKind,
    "REPLACE",
  );

  assert.deepEqual(
    evaluateNumberPlay({
      current: combo([c(6)]),
      candidateCards: [c(6, "WATER"), c(6, "WIND")],
      dayNight: "DAY",
    }),
    {
      legal: true,
      actionKind: "EXTEND",
      combination: combo([c(6, "WATER"), c(6, "WIND")]),
      resultingCombination: combo([c(6), c(6, "WATER"), c(6, "WIND")]),
    },
  );
});

test("evaluateNumberPlay handles sequence extension direction and same-length replacement", () => {
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(2), c(3), c(4)]),
      candidateCards: [c(5), c(6)],
      dayNight: "DAY",
    }).legal,
    true,
  );
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(5), c(6), c(7)]),
      candidateCards: [c(4), c(3)],
      dayNight: "NIGHT",
    }).legal,
    true,
  );
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(2), c(3), c(4)]),
      candidateCards: [c(3), c(4), c(5)],
      dayNight: "DAY",
    }).actionKind,
    "REPLACE",
  );
});

test("evaluateNumberPlay rejects wrong shape, weak replacement, and sealed extension", () => {
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(6)]),
      candidateCards: [c(7), c(8)],
      dayNight: "DAY",
    }).legal,
    false,
  );
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(7), c(7, "WATER")]),
      candidateCards: [c(6), c(6, "WIND")],
      dayNight: "DAY",
    }).legal,
    false,
  );
  assert.deepEqual(
    evaluateNumberPlay({
      current: combo([c(6)]),
      candidateCards: [c(6, "WATER")],
      dayNight: "DAY",
      extensionSealed: true,
    }),
    { legal: false, reason: "EXTENSION_SEALED" },
  );
});

test("evaluateNumberPlay enforces suit lock and detects new lock after reflection", () => {
  assert.deepEqual(
    evaluateNumberPlay({
      current: combo([c(6)]),
      candidateCards: [c(7, "WATER")],
      dayNight: "DAY",
      lockedSuitCode: "SUIT_FIRE",
    }),
    { legal: false, reason: "SUIT_LOCKED" },
  );

  const result = evaluateNumberPlay({
    current: combo([c(6)]),
    candidateCards: [c(6, "FIRE"), c(6, "FIRE")],
    dayNight: "DAY",
  });
  assert.equal(result.legal, true);
  assert.equal(result.createsSuitLock, true);
  assert.equal(result.lockedSuitCode, "SUIT_FIRE");
});
