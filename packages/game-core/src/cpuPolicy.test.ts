import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CPU_POLICY_IDS,
  type RoundState,
  createNumberCard,
  createPlayerState,
  createRoundState,
  createRng,
  enumerateLegalPlays,
  resolveCpuPolicy,
  resolvePlay,
  rollThinkDelayMillis,
  standardPolicy,
} from "./index.ts";

const n = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH") =>
  createNumberCard(`CARD_NUMBER_RANK_${rank}_SUIT_${suit}`, `RANK_${rank}` as never, `SUIT_${suit}` as never);

function round(overrides: Partial<Parameters<typeof createRoundState>[0]> = {}): RoundState {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: 1,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [n(3, "FIRE"), n(5, "WATER"), n(8, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER"), n(9, "WIND")]),
    ],
    activePlayerId: "P1",
    ...overrides,
  });
}

const decide = (state: RoundState, seed = 1) =>
  standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(seed) });

test("CPU_POLICY_IDS is non-empty and every id resolves", () => {
  assert.ok(CPU_POLICY_IDS.length >= 1);
  for (const id of CPU_POLICY_IDS) assert.equal(typeof resolveCpuPolicy(id), "function");
});

test("resolveCpuPolicy throws on an unknown id", () => {
  assert.throws(() => resolveCpuPolicy("NOPE" as never), Error);
});

test("standard policy leads the weakest single on an empty field", () => {
  const input = decide(round());
  assert.equal(input.kind, "PLAY");
  assert.deepEqual(input.kind === "PLAY" && input.cardIds, ["CARD_NUMBER_RANK_3_SUIT_FIRE"]);
});

test("standard policy never returns a skill play", () => {
  const input = decide(round());
  assert.ok(input.kind === "PLAY" && input.useSkill === undefined);
});

test("standard policy prioritises a winning move", () => {
  // P1 can play its last card (single 3) to go out; must pick it.
  const state = round({
    players: [
      createPlayerState("P1", [n(3, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(2, "WIND")], ranks: [2] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const input = standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(1) });
  assert.equal(input.kind, "PLAY");
  assert.equal(resolvePlay(state, input).outcome?.winnerId, "P1");
});

test("standard policy passes when it holds no legal play", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(3, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(7, "WIND")], ranks: [7] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  assert.equal(decideState(state).kind, "PASS");

  function decideState(s: RoundState) {
    return standardPolicy({ state: s, legalPlays: enumerateLegalPlays(s), rng: createRng(1) });
  }
});

test("tie-break among equal weakest singles is reproducible by seed", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(3, "FIRE"), n(3, "WATER"), n(3, "WIND")]),
      createPlayerState("P2", [n(9, "EARTH")]),
    ],
    activePlayerId: "P1",
  });
  const a = standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(123) });
  const b = standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(123) });
  assert.deepEqual(a, b);
});

test("rollThinkDelayMillis stays within [600, 1200] and is reproducible", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const v = rollThinkDelayMillis(createRng(seed));
    assert.ok(Number.isInteger(v) && v >= 600 && v <= 1200);
  }
  assert.equal(rollThinkDelayMillis(createRng(7)), rollThinkDelayMillis(createRng(7)));
});
