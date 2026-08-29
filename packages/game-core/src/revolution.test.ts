import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createNumberCard,
  detectNaturalRevolution,
  evaluateNumberPlay,
  nextDayNight,
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

test("detectNaturalRevolution triggers for new four-card combinations and threshold-crossing extension", () => {
  assert.equal(
    detectNaturalRevolution(
      null,
      combo([c(4), c(4, "WATER"), c(4, "WIND"), c(4, "EARTH")]),
      "LEAD",
    ),
    true,
  );
  assert.equal(
    detectNaturalRevolution(
      combo([c(2), c(3), c(4)]),
      combo([c(2), c(3), c(4), c(5)]),
      "EXTEND",
    ),
    true,
  );
  assert.equal(
    detectNaturalRevolution(
      combo([c(2), c(3), c(4), c(5)]),
      combo([c(2), c(3), c(4), c(5), c(6)]),
      "EXTEND",
    ),
    false,
  );
  assert.equal(
    detectNaturalRevolution(
      combo([c(4), c(4, "WATER")]),
      combo([c(7), c(7, "WATER"), c(7, "WIND"), c(7, "EARTH")]),
      "REPLACE",
    ),
    true,
  );
});

test("revolution skill flips day/night before legality and forbids natural revolution in the same play", () => {
  assert.equal(nextDayNight("DAY"), "NIGHT");
  assert.equal(nextDayNight("NIGHT"), "DAY");

  assert.deepEqual(
    evaluateNumberPlay({
      current: combo([c(7), c(7, "WATER")]),
      candidateCards: [c(6), c(6, "WATER")],
      dayNight: "DAY",
      usesRevolutionSkill: true,
    }),
    {
      legal: true,
      actionKind: "REPLACE",
      combination: combo([c(6), c(6, "WATER")]),
      resultingCombination: combo([c(6), c(6, "WATER")]),
      dayNightAfter: "NIGHT",
    },
  );

  assert.deepEqual(
    evaluateNumberPlay({
      current: null,
      candidateCards: [c(6), c(6, "WATER"), c(6, "WIND"), c(6, "EARTH")],
      dayNight: "DAY",
      usesRevolutionSkill: true,
    }),
    { legal: false, reason: "NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL" },
  );
});
