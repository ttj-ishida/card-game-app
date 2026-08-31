import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createActiveField,
  createNumberCard,
  createTransformedJokerCard,
  evaluateJokerClear,
  evaluateJokerTransformPlay,
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

test("createTransformedJokerCard exposes the declared rank and suit as a number card", () => {
  assert.deepEqual(
    createTransformedJokerCard("SKILL_JOKER_HERO_P1", "RANK_5", "SUIT_FIRE"),
    {
      kind: "NUMBER",
      cardId: "JOKER_AS_SKILL_JOKER_HERO_P1",
      rankCode: "RANK_5",
      suitCode: "SUIT_FIRE",
      transformedFromSkillId: "SKILL_JOKER_HERO_P1",
    },
  );
});

test("evaluateJokerTransformPlay lets two distinct Jokers complete a sequence and trigger natural revolution", () => {
  const result = evaluateJokerTransformPlay({
    current: null,
    realNumberCards: [c(3), c(4)],
    jokerDeclarations: [
      {
        skillId: "SKILL_JOKER_HERO_P1",
        rankCode: "RANK_5",
        suitCode: "SUIT_FIRE",
      },
      {
        skillId: "SKILL_JOKER_SAINT_P1",
        rankCode: "RANK_6",
        suitCode: "SUIT_FIRE",
      },
    ],
    dayNight: "DAY",
  });

  assert.equal(result.legal, true);
  assert.equal(result.actionKind, "LEAD");
  assert.equal(result.combination.kind, "SEQUENCE");
  assert.equal(result.naturalRevolution, true);
  assert.equal(result.dayNightAfter, "NIGHT");
});

test("evaluateJokerTransformPlay rejects duplicate declared identity against real cards or another Joker", () => {
  assert.deepEqual(
    evaluateJokerTransformPlay({
      current: null,
      realNumberCards: [c(5, "FIRE")],
      jokerDeclarations: [
        {
          skillId: "SKILL_JOKER_HERO_P1",
          rankCode: "RANK_5",
          suitCode: "SUIT_FIRE",
        },
      ],
      dayNight: "DAY",
    }),
    { legal: false, reason: "DUPLICATE_JOKER_DECLARATION" },
  );

  assert.deepEqual(
    evaluateJokerTransformPlay({
      current: null,
      realNumberCards: [c(3, "FIRE")],
      jokerDeclarations: [
        {
          skillId: "SKILL_JOKER_HERO_P1",
          rankCode: "RANK_4",
          suitCode: "SUIT_FIRE",
        },
        {
          skillId: "SKILL_JOKER_SAINT_P1",
          rankCode: "RANK_4",
          suitCode: "SUIT_FIRE",
        },
      ],
      dayNight: "DAY",
    }),
    { legal: false, reason: "DUPLICATE_JOKER_DECLARATION" },
  );
});

test("evaluateJokerTransformPlay forbids winning with a transformed Joker plus the last number card", () => {
  assert.deepEqual(
    evaluateJokerTransformPlay({
      current: null,
      realNumberCards: [c(7, "WATER")],
      jokerDeclarations: [
        {
          skillId: "SKILL_JOKER_HERO_P1",
          rankCode: "RANK_7",
          suitCode: "SUIT_FIRE",
        },
      ],
      dayNight: "DAY",
      remainingNumberCardCount: 1,
    }),
    { legal: false, reason: "JOKER_TRANSFORM_LAST_NUMBER_WIN" },
  );
});

test("evaluateJokerClear requires a field and returns continued-play constraints without changing day/night", () => {
  assert.deepEqual(
    evaluateJokerClear({ currentField: null, dayNight: "NIGHT" }),
    {
      legal: false,
      reason: "NO_FIELD_TO_CLEAR",
    },
  );

  assert.deepEqual(
    evaluateJokerClear({
      currentField: createActiveField(
        combo([c(6, "FIRE"), c(6, "WATER")]),
        "player-2",
      ),
      dayNight: "NIGHT",
    }),
    {
      legal: true,
      clearedCards: [c(6, "FIRE"), c(6, "WATER")],
      extensionSealed: false,
      dayNightAfter: "NIGHT",
      mustLead: true,
      canPass: false,
      canUseSecondSkill: false,
    },
  );
});
