// 要件定義書 v0.2 §31.2「必須ルールテスト」T-RULE-001〜022 の自動化。
// 各テスト名の先頭に対応する T-RULE ID を付ける。
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INITIAL_RULESET_VERSION,
  createActiveField,
  createNumberCard,
  createPlayerState,
  createRoundState,
  parseNumberCombination,
  resolvePlay,
  type ActiveField,
  type DayNight,
  type FieldLock,
  type NumberCard,
  type PlayInput,
  type RoundState,
  type SkillEffectCode,
} from "./index.ts";

type Suit = "FIRE" | "WATER" | "WIND" | "EARTH";

const c = (rank: number, suit: Suit = "FIRE"): NumberCard =>
  createNumberCard(
    `N_${rank}_${suit}`,
    `RANK_${rank}` as never,
    `SUIT_${suit}` as never,
  );

const fieldOf = (
  cards: NumberCard[],
  by: string,
  lock?: FieldLock,
): ActiveField => {
  const combination = parseNumberCombination(cards);
  assert.ok(combination);
  return createActiveField(combination, by, lock);
};

function makeRound(opts: {
  dayNight?: DayNight;
  p1: NumberCard[];
  p1Skill?: SkillEffectCode;
  p2?: NumberCard[];
  p3?: NumberCard[];
  field?: { cards: NumberCard[]; by: string };
  fieldLock?: FieldLock;
  extensionSealed?: boolean;
}): RoundState {
  const players = [
    createPlayerState(
      "P1",
      opts.p1,
      opts.p1Skill
        ? { skillId: "SK_P1", effectCode: opts.p1Skill, used: false }
        : null,
    ),
    createPlayerState("P2", opts.p2 ?? [c(1, "EARTH"), c(1, "WIND")]),
  ];
  if (opts.p3) players.push(createPlayerState("P3", opts.p3));

  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: opts.dayNight ?? "DAY",
    players,
    activePlayerId: "P1",
    activeField: opts.field
      ? fieldOf(opts.field.cards, opts.field.by, opts.fieldLock)
      : null,
    extensionSealed: opts.extensionSealed ?? false,
  });
}

const play = (state: RoundState, input: PlayInput) => resolvePlay(state, input);

test("T-RULE-001: day, field 66 accepts 77", () => {
  const result = play(
    makeRound({ p1: [c(7), c(7, "WATER")], field: { cards: [c(6), c(6, "WATER")], by: "P2" } }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_7_FIRE", "N_7_WATER"] },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "REPLACE");
});

test("T-RULE-002: night, field 66 accepts 55", () => {
  const result = play(
    makeRound({
      dayNight: "NIGHT",
      p1: [c(5), c(5, "WATER")],
      field: { cards: [c(6), c(6, "WATER")], by: "P2" },
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_5_FIRE", "N_5_WATER"] },
  );
  assert.ok(result.ok);
});

test("T-RULE-003: day, field 66 rejects 777 for count mismatch", () => {
  const result = play(
    makeRound({
      p1: [c(7), c(7, "WATER"), c(7, "WIND")],
      field: { cards: [c(6), c(6, "WATER")], by: "P2" },
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_7_FIRE", "N_7_WATER", "N_7_WIND"] },
  );
  assert.equal(result.ok === false && result.reason, "SHAPE_MISMATCH");
});

test("T-RULE-004: day, field 234 grows to 23456 with one natural revolution", () => {
  const result = play(
    makeRound({
      p1: [c(5, "FIRE"), c(6, "WATER"), c(9, "EARTH")],
      field: { cards: [c(2, "FIRE"), c(3, "WATER"), c(4, "WIND")], by: "P2" },
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_5_FIRE", "N_6_WATER"] },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "EXTEND");
  assert.deepEqual(result.state.activeField?.combination.ranks, [2, 3, 4, 5, 6]);
  assert.equal(result.outcome.naturalRevolution, true);
  assert.equal(result.state.dayNight, "NIGHT");
});

test("T-RULE-005: night, field 567 grows to 34567 with one natural revolution", () => {
  const result = play(
    makeRound({
      dayNight: "NIGHT",
      p1: [c(3, "FIRE"), c(4, "WATER"), c(9, "EARTH")],
      field: { cards: [c(5, "FIRE"), c(6, "WATER"), c(7, "WIND")], by: "P2" },
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_3_FIRE", "N_4_WATER"] },
  );
  assert.ok(result.ok);
  assert.deepEqual(result.state.activeField?.combination.ranks, [3, 4, 5, 6, 7]);
  assert.equal(result.outcome.naturalRevolution, true);
});

test("T-RULE-006: extending an existing four-card sequence does not revolt", () => {
  const result = play(
    makeRound({
      p1: [c(6, "FIRE"), c(9, "EARTH")],
      field: {
        cards: [c(2, "FIRE"), c(3, "WATER"), c(4, "WIND"), c(5, "EARTH")],
        by: "P2",
      },
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_6_FIRE"] },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.naturalRevolution, false);
});

test("T-RULE-007: replacing with a fresh four-card set revolts again", () => {
  const result = play(
    makeRound({
      p1: [c(7), c(7, "WATER"), c(7, "WIND"), c(7, "EARTH"), c(9)],
      field: {
        cards: [c(6), c(6, "WATER"), c(6, "WIND"), c(6, "EARTH")],
        by: "P2",
      },
    }),
    {
      kind: "PLAY",
      playerId: "P1",
      cardIds: ["N_7_FIRE", "N_7_WATER", "N_7_WIND", "N_7_EARTH"],
    },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "REPLACE");
  assert.equal(result.outcome.naturalRevolution, true);
});

test("T-RULE-008: a uniform-suit sequence lead raises the suit-uniform lock", () => {
  const result = play(
    makeRound({ p1: [c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE"), c(9, "WATER")] }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_3_FIRE", "N_4_FIRE", "N_5_FIRE"] },
  );
  assert.ok(result.ok);
  assert.equal(result.state.activeField?.lock.suitUniform, true);
});

test("T-RULE-009: rejects a same-rank extension while extension is sealed", () => {
  const result = play(
    makeRound({
      p1: [c(6, "WIND"), c(9)],
      field: { cards: [c(6), c(6, "WATER")], by: "P2" },
      extensionSealed: true,
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_6_WIND"] },
  );
  assert.equal(result.ok === false && result.reason, "EXTENSION_SEALED");
});

test("T-RULE-010: allows a stronger same-shape update while extension is sealed", () => {
  const result = play(
    makeRound({
      p1: [c(7), c(7, "WATER"), c(9)],
      field: { cards: [c(6), c(6, "WATER")], by: "P2" },
      extensionSealed: true,
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_7_FIRE", "N_7_WATER"] },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "REPLACE");
});

test("T-RULE-011: day field 77 accepts revolution + 66 after the flip", () => {
  const result = play(
    makeRound({
      p1: [c(6), c(6, "WATER"), c(9)],
      p1Skill: "SKILL_REVOLUTION",
      field: { cards: [c(7), c(7, "WATER")], by: "P2" },
    }),
    {
      kind: "PLAY",
      playerId: "P1",
      cardIds: ["N_6_FIRE", "N_6_WATER"],
      useSkill: "REVOLUTION",
    },
  );
  assert.ok(result.ok);
  assert.equal(result.state.dayNight, "NIGHT");
});

test("T-RULE-012: forbids a play that is both a natural revolution and a revolution card", () => {
  const result = play(
    makeRound({
      p1: [c(6), c(6, "WATER"), c(6, "WIND"), c(6, "EARTH"), c(9)],
      p1Skill: "SKILL_REVOLUTION",
    }),
    {
      kind: "PLAY",
      playerId: "P1",
      cardIds: ["N_6_FIRE", "N_6_WATER", "N_6_WIND", "N_6_EARTH"],
      useSkill: "REVOLUTION",
    },
  );
  assert.equal(
    result.ok === false && result.reason,
    "NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL",
  );
});

test("T-RULE-013: winning by leading the last number card after a Joker clear", () => {
  const result = play(
    makeRound({
      p1: [c(6)],
      p1Skill: "SKILL_JOKER_SAINT",
      field: { cards: [c(9, "WATER")], by: "P2" },
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_6_FIRE"], useSkill: "JOKER_CLEAR" },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.winnerId, "P1");
});

test("T-RULE-014: last number card + transform Joker is illegal and consumes nothing", () => {
  const state = makeRound({
    p1: [c(7, "WATER")],
    p1Skill: "SKILL_JOKER_HERO",
  });
  const snapshot = structuredClone(state);
  const result = play(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_7_WATER"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [
      { skillId: "SK_P1", rankCode: "RANK_7", suitCode: "SUIT_FIRE" },
    ],
  });
  assert.equal(result.ok === false && result.reason, "TRANSFORM_JOKER_GO_OUT");
  assert.deepEqual(state, snapshot);
});

test("T-RULE-015: winning with the last number card + extension seal", () => {
  const result = play(
    makeRound({
      p1: [c(7, "WATER")],
      p1Skill: "SKILL_EXTENSION_SEAL",
      field: { cards: [c(6)], by: "P2" },
    }),
    {
      kind: "PLAY",
      playerId: "P1",
      cardIds: ["N_7_WATER"],
      useSkill: "EXTENSION_SEAL",
    },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.winnerId, "P1");
});

test("T-RULE-016: winning with the last number card + revolution card after the flip", () => {
  const result = play(
    makeRound({
      p1: [c(6), c(6, "WATER")],
      p1Skill: "SKILL_REVOLUTION",
      field: { cards: [c(7), c(7, "WATER")], by: "P2" },
    }),
    {
      kind: "PLAY",
      playerId: "P1",
      cardIds: ["N_6_FIRE", "N_6_WATER"],
      useSkill: "REVOLUTION",
    },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.winnerId, "P1");
  assert.equal(result.state.dayNight, "NIGHT");
});

test("T-RULE-017: two Jokers declaring distinct identities complete a legal sequence", () => {
  const result = play(
    makeRound({
      p1: [c(3, "FIRE"), c(4, "FIRE"), c(9, "WATER")],
      p1Skill: "SKILL_JOKER_HERO",
    }),
    {
      kind: "PLAY",
      playerId: "P1",
      cardIds: ["N_3_FIRE", "N_4_FIRE"],
      useSkill: "JOKER_TRANSFORM",
      jokerDeclarations: [
        { skillId: "SK_P1", rankCode: "RANK_5", suitCode: "SUIT_FIRE" },
        { skillId: "SK_P1_B", rankCode: "RANK_6", suitCode: "SUIT_FIRE" },
      ],
    },
  );
  assert.ok(result.ok);
  assert.equal(result.state.activeField?.combination.kind, "SEQUENCE");
});

test("T-RULE-018: a Joker that duplicates a real card identity is illegal", () => {
  const result = play(
    makeRound({
      p1: [c(5, "FIRE"), c(9, "WATER")],
      p1Skill: "SKILL_JOKER_HERO",
    }),
    {
      kind: "PLAY",
      playerId: "P1",
      cardIds: ["N_5_FIRE"],
      useSkill: "JOKER_TRANSFORM",
      jokerDeclarations: [
        { skillId: "SK_P1", rankCode: "RANK_5", suitCode: "SUIT_FIRE" },
      ],
    },
  );
  assert.equal(
    result.ok === false && result.reason,
    "DUPLICATE_JOKER_DECLARATION",
  );
});

test("T-RULE-019: passing on an empty field is illegal", () => {
  const result = play(makeRound({ p1: [c(3)] }), {
    kind: "PASS",
    playerId: "P1",
  });
  assert.equal(result.ok === false && result.reason, "FIELD_EMPTY");
});

test("T-RULE-020: every responder passing clears the field and the last player leads", () => {
  const state = makeRound({
    p1: [c(3)],
    p2: [c(5)],
    p3: [c(7)],
    field: { cards: [c(9, "WATER")], by: "P3" },
  });
  const first = play(state, { kind: "PASS", playerId: "P1" });
  assert.ok(first.ok);
  const second = play(first.state, { kind: "PASS", playerId: "P2" });
  assert.ok(second.ok);
  assert.equal(second.outcome.fieldCleared, true);
  assert.equal(second.state.activeField, null);
  assert.equal(second.state.activePlayerId, "P3");
});

test("T-RULE-021: day, single 6 accepts a stronger single 7 as an update", () => {
  const result = play(
    makeRound({ p1: [c(7), c(9)], field: { cards: [c(6)], by: "P2" } }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_7_FIRE"] },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "REPLACE");
});

test("T-RULE-022: day, single 6 accepts 66 as an extension to 666", () => {
  const result = play(
    makeRound({
      p1: [c(6, "WATER"), c(6, "WIND"), c(9)],
      field: { cards: [c(6)], by: "P2" },
    }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_6_WATER", "N_6_WIND"] },
  );
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "EXTEND");
  assert.deepEqual(result.state.activeField?.combination.ranks, [6]);
  assert.equal(result.state.activeField?.combination.cards.length, 3);
});

test("T-RULE-023: adding after the first replace is illegal (count lock)", () => {
  const state = makeRound({
    p1: [c(8), c(8, "WATER"), c(8, "WIND")],
    p2: [c(1, "EARTH")],
    field: { cards: [c(7), c(7, "WATER")], by: "P2" },
  });
  const replaced = play(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_8_FIRE", "N_8_WATER"],
  });
  assert.ok(replaced.ok);
  assert.equal(replaced.state.activeField?.lock.countLocked, true);
  const added = play(
    {
      ...replaced.state,
      activePlayerId: replaced.state.activeField!.lastPlayerId,
    },
    {
      kind: "PLAY",
      playerId: replaced.state.activeField!.lastPlayerId,
      cardIds: ["N_8_WIND"],
    },
  );
  assert.equal(added.ok === false && added.reason, "COUNT_LOCKED");
});

test("T-RULE-024: a replace that misses the fixed suit multiset is illegal", () => {
  const state = makeRound({
    p1: [c(9, "WATER")],
    p2: [c(1, "EARTH")],
    field: { cards: [c(8, "FIRE")], by: "P2" },
    fieldLock: { countLocked: true, suitFixed: ["SUIT_FIRE"], suitUniform: false },
  });
  const result = play(state, { kind: "PLAY", playerId: "P1", cardIds: ["N_9_WATER"] });
  assert.equal(result.ok === false && result.reason, "SUIT_FIXED_MISMATCH");
});

test("T-RULE-025: a uniform sequence may be updated with a different uniform suit", () => {
  const state = makeRound({
    p1: [c(4, "WATER"), c(5, "WATER"), c(6, "WATER"), c(9, "EARTH")],
    p2: [c(1, "EARTH")],
    field: { cards: [c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE")], by: "P2" },
    fieldLock: { countLocked: false, suitFixed: null, suitUniform: true },
  });
  const result = play(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_4_WATER", "N_5_WATER", "N_6_WATER"],
  });
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "REPLACE");
});
