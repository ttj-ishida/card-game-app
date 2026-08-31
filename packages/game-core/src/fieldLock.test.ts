import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RULESET_INITIAL,
  createActiveField,
  createNumberCard,
  deriveFieldLock,
  parseNumberCombination,
  type NumberCard,
} from "./index.ts";

const c = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH" = "FIRE") =>
  createNumberCard(
    `C_${rank}_${suit}`,
    `RANK_${rank}` as never,
    `SUIT_${suit}` as never,
  );

const combo = (cards: NumberCard[]) => {
  const parsed = parseNumberCombination(cards);
  assert.ok(parsed);
  return parsed;
};

test("LEAD of a uniform-suit sequence sets suitUniform", () => {
  const resulting = combo([c(3), c(4), c(5)]);
  assert.deepEqual(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: resulting,
      resultingCombination: resulting,
    }),
    { countLocked: false, suitFixed: null, suitUniform: true },
  );
});

test("LEAD of a mixed sequence or a rank set does not set suitUniform", () => {
  const mixed = combo([c(3), c(4, "WATER"), c(5, "WIND")]);
  assert.equal(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: mixed,
      resultingCombination: mixed,
    }).suitUniform,
    false,
  );
  const rankSet = combo([c(6), c(6, "WATER")]);
  assert.equal(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: rankSet,
      resultingCombination: rankSet,
    }).suitUniform,
    false,
  );
});

test("EXTEND preserves suitUniform and never locks count or suitFixed", () => {
  const previous = createActiveField(combo([c(3), c(4), c(5)]), "P1", {
    suitUniform: true,
  });
  const added = combo([c(6), c(7), c(8)]);
  const resulting = combo([c(3), c(4), c(5), c(6)]);
  assert.deepEqual(
    deriveFieldLock({
      previous,
      actionKind: "EXTEND",
      playedCombination: combo([c(6)]),
      resultingCombination: resulting,
    }),
    { countLocked: false, suitFixed: null, suitUniform: true },
  );
  void added;
});

test("first REPLACE always locks count; locks suitFixed only when suits match", () => {
  const previous = createActiveField(combo([c(7), c(7, "WATER")]), "P2");

  const matching = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(8), c(8, "WATER")]),
    resultingCombination: combo([c(8), c(8, "WATER")]),
  });
  assert.equal(matching.countLocked, true);
  assert.deepEqual(matching.suitFixed, ["SUIT_FIRE", "SUIT_WATER"]);

  const mismatching = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(8), c(8, "WIND")]),
    resultingCombination: combo([c(8), c(8, "WIND")]),
  });
  assert.equal(mismatching.countLocked, true);
  assert.equal(mismatching.suitFixed, null);
});

test("a later REPLACE keeps the suitFixed established by the first REPLACE", () => {
  const previous = createActiveField(combo([c(8), c(8, "WATER")]), "P2", {
    countLocked: true,
    suitFixed: ["SUIT_FIRE", "SUIT_WATER"],
  });
  const next = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(9), c(9, "WATER")]),
    resultingCombination: combo([c(9), c(9, "WATER")]),
  });
  assert.deepEqual(next.suitFixed, ["SUIT_FIRE", "SUIT_WATER"]);
});

test("ruleset toggles gate each lock independently", () => {
  const seq = combo([c(3), c(4), c(5)]);
  assert.equal(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: seq,
      resultingCombination: seq,
      ruleset: { ...RULESET_INITIAL, suitUniformLock: false },
    }).suitUniform,
    false,
  );
  const previous = createActiveField(combo([c(7), c(7, "WATER")]), "P2");
  const r = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(8), c(8, "WATER")]),
    resultingCombination: combo([c(8), c(8, "WATER")]),
    ruleset: { countLock: false, suitFixedLock: false, suitUniformLock: false },
  });
  assert.deepEqual(r, { countLocked: false, suitFixed: null, suitUniform: false });
});
