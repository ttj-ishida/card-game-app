import assert from "node:assert/strict";
import { test } from "node:test";

import { createNumberCard, parseNumberCombination } from "./index.ts";

const c = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH" = "FIRE") =>
  createNumberCard(
    `CARD_NUMBER_RANK_${rank}_SUIT_${suit}`,
    `RANK_${rank}`,
    `SUIT_${suit}`,
  );

test("parseNumberCombination recognizes single and rank sets", () => {
  assert.deepEqual(parseNumberCombination([c(6)]), {
    kind: "SINGLE",
    ranks: [6],
    cards: [c(6)],
  });

  assert.deepEqual(
    parseNumberCombination([c(7, "FIRE"), c(7, "WATER"), c(7, "WIND")]),
    {
      kind: "RANK_SET",
      ranks: [7],
      cards: [c(7, "FIRE"), c(7, "WATER"), c(7, "WIND")],
    },
  );
});

test("parseNumberCombination recognizes sequences and rejects invalid sets", () => {
  assert.equal(parseNumberCombination([c(2), c(3), c(4)])?.kind, "SEQUENCE");
  assert.equal(parseNumberCombination([c(8), c(9), c(1)]), null);
  assert.equal(parseNumberCombination([c(2), c(3)]), null);
  assert.equal(
    parseNumberCombination([c(2), c(2), c(3), c(3), c(4), c(4)]),
    null,
  );
  assert.equal(parseNumberCombination([c(5), c(5), c(5), c(5), c(5)]), null);
});
