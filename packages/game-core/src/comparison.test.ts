import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareCombinations,
  createNumberCard,
  parseNumberCombination,
  rankStrength,
} from "./index.ts";

const c = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH" = "FIRE") =>
  createNumberCard(
    `CARD_NUMBER_RANK_${rank}_SUIT_${suit}`,
    `RANK_${rank}`,
    `SUIT_${suit}`,
  );

test("rankStrength reverses between day and night", () => {
  assert.equal(rankStrength(9, "DAY") > rankStrength(1, "DAY"), true);
  assert.equal(rankStrength(1, "NIGHT") > rankStrength(9, "NIGHT"), true);
});

test("compareCombinations compares same-shaped combinations by current day/night", () => {
  const dayPair6 = parseNumberCombination([c(6), c(6, "WATER")]);
  const dayPair7 = parseNumberCombination([c(7), c(7, "WATER")]);
  const nightPair5 = parseNumberCombination([c(5), c(5, "WATER")]);
  assert.ok(dayPair6 && dayPair7 && nightPair5);

  assert.equal(compareCombinations(dayPair7, dayPair6, "DAY"), 1);
  assert.equal(compareCombinations(nightPair5, dayPair6, "NIGHT"), 1);
  assert.equal(
    compareCombinations(
      parseNumberCombination([c(2), c(3), c(4)])!,
      parseNumberCombination([c(1), c(2), c(3)])!,
      "DAY",
    ),
    1,
  );
});
