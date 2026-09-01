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

// ---- M3: minimal skill heuristic ----

type SkillEffect =
  | "SKILL_JOKER_HERO"
  | "SKILL_JOKER_SAINT"
  | "SKILL_EXTENSION_SEAL"
  | "SKILL_REVOLUTION";

function skillRound(opts: {
  hand: ReturnType<typeof n>[];
  effectCode: SkillEffect;
  used?: boolean;
  activeField?: Parameters<typeof createRoundState>[0]["activeField"];
  p2?: ReturnType<typeof n>[];
}): RoundState {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: 1,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", opts.hand, {
        skillId: "SK1",
        effectCode: opts.effectCode,
        used: opts.used ?? false,
      }),
      createPlayerState("P2", opts.p2 ?? [n(9, "WATER"), n(9, "WIND")]),
    ],
    activePlayerId: "P1",
    activeField: opts.activeField ?? null,
  });
}

const decideSkills = (state: RoundState, seed = 1) =>
  standardPolicy({
    state,
    legalPlays: enumerateLegalPlays(state, { includeSkills: true }),
    rng: createRng(seed),
  });

const fieldSingle = (
  rank: number,
  suit: "FIRE" | "WATER" | "WIND" | "EARTH",
): Parameters<typeof createRoundState>[0]["activeField"] => ({
  combination: { kind: "SINGLE", cards: [n(rank, suit)], ranks: [rank] },
  lastPlayerId: "P2",
  lock: { countLocked: false, suitFixed: null, suitUniform: false },
});

const fieldSeq123: Parameters<typeof createRoundState>[0]["activeField"] = {
  combination: {
    kind: "SEQUENCE",
    cards: [n(1, "WATER"), n(2, "WATER"), n(3, "WATER")],
    ranks: [1, 2, 3],
  },
  lastPlayerId: "P2",
  lock: { countLocked: false, suitFixed: null, suitUniform: false },
};

test("standard policy prefers a plain number response over a weaker Joker clear-lead", () => {
  // field SINGLE 5; hand can only answer with single 6 (REPLACE). A naive
  // "weakest non-pass" would grab a JOKER_CLEAR lead of 2 (strength 2 < 6).
  const state = skillRound({
    effectCode: "SKILL_JOKER_HERO",
    hand: [n(6, "FIRE"), n(2, "WATER"), n(3, "WATER"), n(4, "WATER")],
    activeField: fieldSingle(5, "EARTH"),
  });
  for (let seed = 0; seed < 20; seed += 1) {
    const input = decideSkills(state, seed);
    assert.ok(input.kind === "PLAY" && input.useSkill === undefined);
    assert.deepEqual(
      input.kind === "PLAY" && input.cardIds,
      ["CARD_NUMBER_RANK_6_SUIT_FIRE"],
    );
  }
});

test("standard policy clears the field with a Joker when it has no number response", () => {
  const state = skillRound({
    effectCode: "SKILL_JOKER_HERO",
    hand: [n(2, "FIRE"), n(3, "WATER")],
    activeField: fieldSingle(4, "EARTH"),
  });
  const input = decideSkills(state);
  assert.ok(input.kind === "PLAY" && input.useSkill === "JOKER_CLEAR");
});

test("standard policy seals a REPLACE response when holding EXTENSION_SEAL", () => {
  const state = skillRound({
    effectCode: "SKILL_EXTENSION_SEAL",
    hand: [n(5, "FIRE"), n(6, "FIRE"), n(8, "WATER")],
    activeField: fieldSingle(4, "EARTH"),
  });
  // deterministic across every seed (a naive weakest-non-pass pick would only
  // land the sealed variant on ~half of the seeds).
  for (let seed = 0; seed < 30; seed += 1) {
    const input = decideSkills(state, seed);
    assert.ok(
      input.kind === "PLAY" && input.useSkill === "EXTENSION_SEAL",
      `seed ${seed}`,
    );
    assert.deepEqual(
      input.kind === "PLAY" && input.cardIds,
      ["CARD_NUMBER_RANK_5_SUIT_FIRE"],
    );
  }
});

test("standard policy plays REVOLUTION when only a post-flip response is legal", () => {
  const state = skillRound({
    effectCode: "SKILL_REVOLUTION",
    hand: [n(3, "FIRE"), n(2, "WATER")],
    activeField: fieldSingle(6, "WIND"),
  });
  const input = decideSkills(state);
  assert.ok(input.kind === "PLAY" && input.useSkill === "REVOLUTION");
});

test("standard policy uses JOKER_TRANSFORM when it sheds more hand cards than the best number response", () => {
  const state = skillRound({
    effectCode: "SKILL_JOKER_SAINT",
    hand: [n(4, "FIRE"), n(6, "FIRE"), n(7, "FIRE"), n(8, "EARTH"), n(9, "WATER")],
    activeField: fieldSeq123,
  });
  const input = decideSkills(state);
  assert.ok(input.kind === "PLAY" && input.useSkill === "JOKER_TRANSFORM");
  assert.ok(input.kind === "PLAY" && input.cardIds.length > 1);
});

test("standard policy with includeSkills matches M2 when the seat holds no usable skill", () => {
  const state = skillRound({
    effectCode: "SKILL_JOKER_HERO",
    used: true, // already used -> not usable -> pure M2 path
    hand: [n(3, "FIRE"), n(5, "WATER"), n(7, "FIRE")],
    activeField: fieldSingle(4, "EARTH"),
  });
  for (let seed = 0; seed < 25; seed += 1) {
    const withSkills = standardPolicy({
      state,
      legalPlays: enumerateLegalPlays(state, { includeSkills: true }),
      rng: createRng(seed),
    });
    const bare = standardPolicy({
      state,
      legalPlays: enumerateLegalPlays(state),
      rng: createRng(seed),
    });
    assert.deepEqual(withSkills, bare);
    assert.ok(withSkills.kind === "PASS" || withSkills.useSkill === undefined);
  }
});

test("skill decisions are reproducible by seed", () => {
  const state = skillRound({
    effectCode: "SKILL_JOKER_SAINT",
    hand: [n(4, "FIRE"), n(6, "FIRE"), n(7, "FIRE"), n(8, "EARTH"), n(9, "WATER")],
    activeField: fieldSeq123,
  });
  assert.deepEqual(decideSkills(state, 7), decideSkills(state, 7));
  assert.deepEqual(decideSkills(state, 42), decideSkills(state, 42));
});

test("rollThinkDelayMillis stays within [600, 1200] and is reproducible", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const v = rollThinkDelayMillis(createRng(seed));
    assert.ok(Number.isInteger(v) && v >= 600 && v <= 1200);
  }
  assert.equal(rollThinkDelayMillis(createRng(7)), rollThinkDelayMillis(createRng(7)));
});
