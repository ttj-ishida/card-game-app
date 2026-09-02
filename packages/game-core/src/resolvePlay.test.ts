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
  type RoundState,
  type SkillEffectCode,
} from "./index.ts";

type Suit = "FIRE" | "WATER" | "WIND" | "EARTH";

const c = (rank: number, suit: Suit = "FIRE") =>
  createNumberCard(
    `N_${rank}_${suit}`,
    `RANK_${rank}` as never,
    `SUIT_${suit}` as never,
  );

const field = (
  cards: ReturnType<typeof c>[],
  lastPlayerId: string,
): ActiveField => {
  const combination = parseNumberCombination(cards);
  assert.ok(combination);
  return createActiveField(combination, lastPlayerId);
};

function round(overrides: Partial<Parameters<typeof createRoundState>[0]> = {}) {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [c(3), c(4), c(8)]),
      createPlayerState("P2", [c(5), c(6), c(7)]),
      createPlayerState("P3", [c(2), c(9), c(9, "WATER")]),
    ],
    activePlayerId: "P1",
    ...overrides,
  });
}

const skilled = (
  playerId: string,
  hand: ReturnType<typeof c>[],
  effectCode: SkillEffectCode,
) =>
  createPlayerState(playerId, hand, {
    skillId: `SK_${playerId}`,
    effectCode,
    used: false,
  });

test("resolvePlay rejects a play from a player who is not on turn", () => {
  const state = round();
  const result = resolvePlay(state, { kind: "PASS", playerId: "P2" });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "NOT_ACTIVE_PLAYER");
  assert.equal(result.state, state);
});

test("resolvePlay rejects a pass while the field is empty", () => {
  const result = resolvePlay(round(), { kind: "PASS", playerId: "P1" });
  assert.equal(result.ok === false && result.reason, "FIELD_EMPTY");
});

test("resolvePlay records a pass and advances to the next player", () => {
  const state = round({ activeField: field([c(9, "WATER")], "P3") });
  const result = resolvePlay(state, { kind: "PASS", playerId: "P1" });
  assert.ok(result.ok);
  assert.equal(result.state.activePlayerId, "P2");
  assert.equal(
    result.state.players.find((p) => p.playerId === "P1")?.status,
    "PASSED",
  );
  assert.equal(result.state.consecutivePasses, 1);
  assert.equal(result.outcome.actionKind, "PASS");
  assert.equal(result.outcome.fieldCleared, false);
});

test("resolvePlay clears the field once every responder passed and hands the lead to the last player", () => {
  const state = round({
    activeField: field([c(9, "WATER")], "P3"),
    extensionSealed: true,
  });
  const first = resolvePlay(state, { kind: "PASS", playerId: "P1" });
  assert.ok(first.ok);
  const second = resolvePlay(first.state, { kind: "PASS", playerId: "P2" });
  assert.ok(second.ok);
  assert.equal(second.outcome.fieldCleared, true);
  assert.equal(second.state.activeField, null);
  assert.equal(second.state.activePlayerId, "P3");
  assert.equal(second.state.extensionSealed, false);
  assert.equal(second.state.dayNight, "DAY");
  assert.equal(second.state.consecutivePasses, 0);
  assert.deepEqual(
    second.state.discardPile.map((card) => card.rankCode),
    ["RANK_9"],
  );
  assert.ok(second.state.players.every((p) => p.status === "ACTIVE"));
});

test("resolvePlay leads a combination, consumes the cards, and moves on", () => {
  const state = round();
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE"],
  });
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "LEAD");
  assert.equal(result.state.activeField?.lastPlayerId, "P1");
  assert.deepEqual(
    result.state.players.find((p) => p.playerId === "P1")?.hand.map((x) => x.cardId),
    ["N_4_FIRE", "N_8_FIRE"],
  );
  assert.equal(result.state.activePlayerId, "P2");
  assert.equal(result.state.consecutivePasses, 0);
});

test("resolvePlay rejects a play that references a card not in hand", () => {
  const state = round();
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_5_FIRE"],
  });
  assert.equal(result.ok === false && result.reason, "CARD_NOT_IN_HAND");
});

test("resolvePlay rejects an illegal replacement and keeps the input untouched", () => {
  const state = round({ activeField: field([c(6, "WATER")], "P2") });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_4_FIRE"],
  });
  assert.equal(result.ok === false && result.reason, "NOT_STRONGER");
  assert.deepEqual(state, snapshot);
  assert.equal(result.state, state);
});

test("resolvePlay moves the replaced set to the discard pile", () => {
  const state = round({ activeField: field([c(6, "WATER")], "P2") });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_8_FIRE"],
  });
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "REPLACE");
  assert.deepEqual(
    result.state.discardPile.map((card) => card.cardId),
    ["N_6_WATER"],
  );
});

test("resolvePlay locks the count on the first replace", () => {
  const state = round({
    players: [
      createPlayerState("P1", [c(9, "FIRE"), c(9, "WATER")]),
      createPlayerState("P2", [c(1, "EARTH")]),
    ],
    activePlayerId: "P1",
    activeField: field([c(8, "FIRE"), c(8, "WATER")], "P2"),
  });
  const replaced = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_9_FIRE", "N_9_WATER"],
  });
  assert.ok(replaced.ok);
  assert.equal(replaced.state.activeField?.lock.countLocked, true);
});

test("resolvePlay applies extension seal after the number card lands", () => {
  const state = round({
    players: [
      skilled("P1", [c(6, "WATER"), c(3)], "SKILL_EXTENSION_SEAL"),
      createPlayerState("P2", [c(5), c(7)]),
    ],
    activePlayerId: "P1",
    activeField: field([c(6)], "P2"),
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_6_WATER"],
    useSkill: "EXTENSION_SEAL",
  });
  assert.ok(result.ok);
  assert.equal(result.state.extensionSealed, true);
  assert.equal(
    result.state.players.find((p) => p.playerId === "P1")?.skill?.used,
    true,
  );
});

test("resolvePlay flips day/night first when the revolution skill is used", () => {
  const state = round({
    players: [
      skilled("P1", [c(6), c(6, "WATER")], "SKILL_REVOLUTION"),
      createPlayerState("P2", [c(7), c(7, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: field([c(7, "WIND"), c(7, "EARTH")], "P2"),
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_6_FIRE", "N_6_WATER"],
    useSkill: "REVOLUTION",
  });
  assert.ok(result.ok);
  assert.equal(result.state.dayNight, "NIGHT");
  assert.equal(result.outcome.dayNightAfter, "NIGHT");
});

test("resolvePlay rejects a revolution skill play that is illegal after the flip and keeps state", () => {
  const state = round({
    players: [
      skilled("P1", [c(8), c(8, "WATER")], "SKILL_REVOLUTION"),
      createPlayerState("P2", [c(7), c(7, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: field([c(7, "WIND"), c(7, "EARTH")], "P2"),
  });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_8_FIRE", "N_8_WATER"],
    useSkill: "REVOLUTION",
  });
  assert.equal(result.ok, false);
  assert.deepEqual(state, snapshot);
});

test("resolvePlay clears the field after a transformed Joker natural revolution", () => {
  const state = round({
    players: [
      skilled(
        "P1",
        [c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE"), c(9, "WATER")],
        "SKILL_JOKER_HERO",
      ),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE", "N_5_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [{ skillId: "SK_P1", rankCode: "RANK_6", suitCode: "SUIT_FIRE" }],
  });
  assert.ok(result.ok);
  assert.equal(result.state.activeField, null);
  assert.equal(result.outcome.fieldCleared, true);
  assert.equal(result.state.activePlayerId, "P1");
  assert.equal(
    result.state.discardPile.some((card) => card.transformedFromSkillId === "SK_P1"),
    true,
  );
  assert.equal(result.state.dayNight, "NIGHT");
  assert.equal(result.outcome.naturalRevolution, true);
});

test("resolvePlay forbids going out with a transform Joker and does not consume cards", () => {
  const state = round({
    players: [
      skilled("P1", [c(7, "WATER")], "SKILL_JOKER_HERO"),
      createPlayerState("P2", [c(4)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
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

test("resolvePlay clears the field with a Joker then leads in the same play", () => {
  const state = round({
    players: [
      skilled("P1", [c(2), c(8)], "SKILL_JOKER_SAINT"),
      createPlayerState("P2", [c(5)]),
    ],
    activePlayerId: "P1",
    activeField: field([c(9, "WATER")], "P2"),
    extensionSealed: true,
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_2_FIRE"],
    useSkill: "JOKER_CLEAR",
  });
  assert.ok(result.ok);
  assert.equal(result.outcome.fieldCleared, true);
  assert.equal(result.state.extensionSealed, false);
  assert.equal(result.state.dayNight, "DAY");
  assert.equal(result.state.activeField?.combination.ranks[0], 2);
  assert.equal(result.state.activeField?.lastPlayerId, "P1");
  assert.deepEqual(
    result.state.discardPile.map((card) => card.cardId),
    ["N_9_WATER"],
  );
  assert.equal(
    result.state.players.find((p) => p.playerId === "P1")?.skill?.used,
    true,
  );
});

test("resolvePlay rejects a Joker clear when there is no field", () => {
  const state = round({
    players: [skilled("P1", [c(3)], "SKILL_JOKER_HERO")],
    activePlayerId: "P1",
    activeField: null,
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE"],
    useSkill: "JOKER_CLEAR",
  });
  assert.equal(result.ok === false && result.reason, "NO_FIELD_TO_CLEAR");
});

test("resolvePlay declares a winner when the last number card is played", () => {
  const state = round({
    players: [
      createPlayerState("P1", [c(8)]),
      createPlayerState("P2", [c(5), c(6)]),
    ],
    activePlayerId: "P1",
    activeField: field([c(6, "WATER")], "P2"),
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_8_FIRE"],
  });
  assert.ok(result.ok);
  assert.equal(result.outcome.winnerId, "P1");
  assert.equal(result.state.winnerId, "P1");
  assert.equal(
    result.state.players.find((p) => p.playerId === "P1")?.status,
    "OUT",
  );
});

test("resolvePlay rejects any play once the round already has a winner", () => {
  const state = round({
    players: [createPlayerState("P1", [c(3)]), createPlayerState("P2", [c(5)])],
    activePlayerId: "P1",
    winnerId: "P2",
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE"],
  });
  assert.equal(result.ok === false && result.reason, "ROUND_FINISHED");
});

test("resolvePlay does not mutate the input on a successful play and is repeatable", () => {
  const state = round({ activeField: field([c(6, "WATER")], "P2") });
  const snapshot = structuredClone(state);
  const first = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_8_FIRE"],
  });
  const second = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_8_FIRE"],
  });
  assert.ok(first.ok && second.ok);
  assert.deepEqual(state, snapshot);
  assert.notEqual(first.state, state);
  assert.deepEqual(first.state, second.state);
});

test("resolvePlay rejects JOKER_TRANSFORM with zero declarations", () => {
  const state = round({
    players: [
      skilled("P1", [c(3, "FIRE"), c(4, "FIRE")], "SKILL_JOKER_HERO"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
  assert.deepEqual(state, snapshot);
});

test("resolvePlay rejects JOKER_TRANSFORM with two declarations", () => {
  const state = round({
    players: [
      skilled("P1", [c(3, "FIRE"), c(4, "FIRE")], "SKILL_JOKER_HERO"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [
      { skillId: "SK_P1", rankCode: "RANK_5", suitCode: "SUIT_FIRE" },
      { skillId: "SK_P1", rankCode: "RANK_6", suitCode: "SUIT_FIRE" },
    ],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
  assert.deepEqual(state, snapshot);
});

test("resolvePlay rejects JOKER_TRANSFORM whose declaration skillId is not the held skill", () => {
  const state = round({
    players: [
      skilled("P1", [c(3, "FIRE"), c(4, "FIRE")], "SKILL_JOKER_HERO"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [{ skillId: "SOMETHING_ELSE", rankCode: "RANK_5", suitCode: "SUIT_FIRE" }],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
  assert.deepEqual(state, snapshot);
});

test("resolvePlay rejects a non-transform skill play that carries jokerDeclarations", () => {
  const state = round({
    players: [
      skilled("P1", [c(6, "WATER"), c(3)], "SKILL_EXTENSION_SEAL"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_6_WATER"],
    useSkill: "EXTENSION_SEAL",
    jokerDeclarations: [{ skillId: "SK_P1", rankCode: "RANK_5", suitCode: "SUIT_FIRE" }],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
  assert.deepEqual(state, snapshot);
});
