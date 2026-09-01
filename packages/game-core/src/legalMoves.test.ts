import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type RoundState,
  type SkillEffectCode,
  createNumberCard,
  createPlayerState,
  createRoundState,
  enumerateLegalPlays,
  resolvePlay,
} from "./index.ts";

const n = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH") =>
  createNumberCard(`CARD_NUMBER_RANK_${rank}_SUIT_${suit}`, `RANK_${rank}` as never, `SUIT_${suit}` as never);

function round(overrides: Partial<Parameters<typeof createRoundState>[0]> = {}): RoundState {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: 1,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [n(3, "FIRE"), n(3, "WATER"), n(5, "FIRE"), n(6, "FIRE"), n(7, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER"), n(9, "WIND")]),
    ],
    activePlayerId: "P1",
    ...overrides,
  });
}

test("empty field: every legal play is a LEAD and there is no PASS", () => {
  const plays = enumerateLegalPlays(round());
  assert.ok(plays.length > 0);
  assert.ok(plays.every((p) => p.actionKind === "LEAD"));
  assert.ok(plays.every((p) => p.input.kind === "PLAY"));
});

test("empty field: singles, the 33 pair, and the 5-6-7 sequence are all enumerated", () => {
  const plays = enumerateLegalPlays(round());
  const shapes = plays.map((p) =>
    p.input.kind === "PLAY" ? p.input.cardIds.length : 0,
  );
  assert.ok(shapes.includes(1)); // singles
  assert.ok(shapes.includes(2)); // 3-3 pair
  assert.ok(shapes.includes(3)); // 5-6-7 fire sequence
});

test("every enumerated play is accepted by resolvePlay", () => {
  const state = round();
  for (const play of enumerateLegalPlays(state)) {
    assert.equal(resolvePlay(state, play.input).ok, true);
  }
});

test("responding to a single: only stronger singles, plus PASS", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(4, "FIRE"), n(8, "FIRE"), n(8, "WATER")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(6, "WIND")], ranks: [6] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const plays = enumerateLegalPlays(state);
  assert.ok(plays.some((p) => p.actionKind === "PASS"));
  const nonPass = plays.filter((p) => p.actionKind !== "PASS");
  // 4 is weaker than 6 in DAY; only the two 8s qualify as REPLACE singles
  assert.ok(nonPass.every((p) => p.input.kind === "PLAY" && p.input.cardIds.length === 1));
  assert.equal(nonPass.length, 2);
});

test("goesOut is set when the play empties the hand", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(2, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
  });
  const plays = enumerateLegalPlays(state);
  assert.ok(plays.length === 1);
  assert.equal(plays[0].goesOut, true);
});

test("count lock excludes same-count extension candidates", () => {
  // field: 8-8 replaced once (countLocked). single 8 add must not appear as legal.
  const state = round({
    players: [
      createPlayerState("P1", [n(8, "WIND"), n(2, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "RANK_SET", cards: [n(8, "FIRE"), n(8, "WATER")], ranks: [8] },
      lastPlayerId: "P2",
      lock: { countLocked: true, suitFixed: null, suitUniform: false },
    },
  });
  const plays = enumerateLegalPlays(state);
  assert.ok(
    !plays.some(
      (p) => p.input.kind === "PLAY" && p.input.cardIds.length === 1 && p.actionKind === "EXTEND",
    ),
  );
});

test("enumeration is deterministically ordered (PASS last)", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(7, "FIRE"), n(8, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(6, "WIND")], ranks: [6] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const a = enumerateLegalPlays(state).map((p) => JSON.stringify(p.input));
  const b = enumerateLegalPlays(state).map((p) => JSON.stringify(p.input));
  assert.deepEqual(a, b);
  assert.equal(enumerateLegalPlays(state).at(-1)?.actionKind, "PASS");
});

test("a finished round enumerates nothing", () => {
  const state = round({ winnerId: "P1" });
  assert.deepEqual(enumerateLegalPlays(state), []);
});

// ---- exhaustiveness oracle ----

/** items の非空部分集合を全部（サイズ 1..maxSize）列挙する。 */
function* subsets(
  items: readonly string[],
  maxSize: number,
  start = 0,
  pick: string[] = [],
): Generator<string[]> {
  if (pick.length >= 1) yield [...pick];
  if (pick.length === maxSize) return;
  for (let i = start; i < items.length; i += 1) {
    pick.push(items[i]);
    yield* subsets(items, maxSize, i + 1, pick);
    pick.pop();
  }
}

function enumeratedPlayKeys(state: RoundState): string[] {
  return enumerateLegalPlays(state)
    .filter((p) => p.actionKind !== "PASS")
    .map((p) => (p.input.kind === "PLAY" ? [...p.input.cardIds].sort().join("|") : ""))
    .sort();
}

function bruteForcePlayKeys(state: RoundState, playerId: string): string[] {
  const player = state.players.find((p) => p.playerId === playerId);
  const ids = (player?.hand ?? []).map((c) => c.cardId);
  const keys: string[] = [];
  for (const subset of subsets(ids, 5)) {
    const res = resolvePlay(state, { kind: "PLAY", playerId, cardIds: subset });
    if (res.ok) keys.push([...subset].sort().join("|"));
  }
  return keys.sort();
}

test("enumerateLegalPlays exactly matches a brute-force resolvePlay oracle (empty field)", () => {
  // 8 number cards: 33 pair, 3-4-5-6 fire run, 88 pair, lone 9. No run longer than 4.
  const hand = [
    n(3, "FIRE"),
    n(3, "WATER"),
    n(4, "FIRE"),
    n(5, "FIRE"),
    n(6, "FIRE"),
    n(8, "WATER"),
    n(8, "WIND"),
    n(9, "EARTH"),
  ];
  const state = round({
    players: [createPlayerState("P1", hand), createPlayerState("P2", [n(9, "WATER")])],
    activePlayerId: "P1",
  });
  assert.deepEqual(enumeratedPlayKeys(state), bruteForcePlayKeys(state, "P1"));
});

test("enumerateLegalPlays exactly matches the oracle over an active SEQUENCE field (2-card extend)", () => {
  const hand = [
    n(3, "FIRE"),
    n(3, "WATER"),
    n(4, "FIRE"),
    n(5, "FIRE"),
    n(6, "FIRE"),
    n(8, "WATER"),
    n(8, "WIND"),
    n(9, "EARTH"),
  ];
  const state = round({
    players: [createPlayerState("P1", hand), createPlayerState("P2", [n(9, "WATER")])],
    activePlayerId: "P1",
    activeField: {
      combination: {
        kind: "SEQUENCE",
        cards: [n(1, "WATER"), n(2, "WATER"), n(3, "WATER")],
        ranks: [1, 2, 3],
      },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const keys = enumeratedPlayKeys(state);
  assert.deepEqual(keys, bruteForcePlayKeys(state, "P1"));
  // the 2-card sequence extension [4,5] must be present
  const fourFive = [
    "CARD_NUMBER_RANK_4_SUIT_FIRE",
    "CARD_NUMBER_RANK_5_SUIT_FIRE",
  ]
    .sort()
    .join("|");
  assert.ok(keys.includes(fourFive));
});

// ---- includeSkills: Joker (JOKER_CLEAR + JOKER_TRANSFORM) ----

type SeatSkill = { skillId: string; effectCode: SkillEffectCode };

function skillRound(overrides: {
  activeSeatSkill: SeatSkill | null;
  activeSeatHand: ReturnType<typeof n>[];
  activeField?: Parameters<typeof createRoundState>[0]["activeField"];
}): RoundState {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: 1,
    dayNight: "DAY",
    players: [
      createPlayerState(
        "P1",
        overrides.activeSeatHand,
        overrides.activeSeatSkill ? { ...overrides.activeSeatSkill, used: false } : null,
      ),
      createPlayerState("P2", [n(9, "WATER"), n(9, "WIND")]),
    ],
    activePlayerId: "P1",
    activeField: overrides.activeField ?? null,
  });
}

const nonEmptyField: Parameters<typeof createRoundState>[0]["activeField"] = {
  combination: { kind: "SINGLE", cards: [n(4, "EARTH")], ranks: [4] },
  lastPlayerId: "P2",
  lock: { countLocked: false, suitFixed: null, suitUniform: false },
};

test("enumerateLegalPlays without options equals enumerateLegalPlays(state, {})", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(3, "FIRE"), n(3, "WATER"), n(5, "FIRE"), n(6, "FIRE"), n(7, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(2, "WIND")], ranks: [2] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  assert.deepEqual(enumerateLegalPlays(state), enumerateLegalPlays(state, {}));
});

test("includeSkills: a Joker holder on a non-empty field can clear-and-lead", () => {
  const state = skillRound({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_JOKER_HERO" },
    activeSeatHand: [n(2, "FIRE"), n(3, "WATER")],
    activeField: nonEmptyField,
  });
  const plays = enumerateLegalPlays(state, { includeSkills: true });
  assert.ok(
    plays.some((p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_CLEAR"),
  );
  for (const p of plays) assert.equal(resolvePlay(state, p.input).ok, true);
});

test("includeSkills: JOKER_TRANSFORM plays are enumerated but never a go-out", () => {
  const state = skillRound({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_JOKER_SAINT" },
    activeSeatHand: [n(5, "FIRE")], // 1 card -> transforming out would be a go-out
  });
  const plays = enumerateLegalPlays(state, { includeSkills: true });
  const transforms = plays.filter(
    (p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_TRANSFORM",
  );
  assert.ok(transforms.length > 0);
  assert.ok(transforms.every((p) => !p.goesOut));
  for (const p of transforms) assert.equal(resolvePlay(state, p.input).ok, true);
});

test("includeSkills: a declared Joker + one adjacent real card extends an active sequence (2-card window)", () => {
  // field: SEQUENCE 1-2-3. Active seat holds a Joker skill + a real 4 adjacent to
  // the run. Declaring the Joker as a 5 lets [real 4 + transformed 5] EXTEND the
  // sequence — a 2-card window that the len=3 loop used to miss entirely.
  const state = skillRound({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_JOKER_HERO" },
    activeSeatHand: [n(4, "FIRE"), n(8, "WATER")],
    activeField: {
      combination: {
        kind: "SEQUENCE",
        cards: [n(1, "WATER"), n(2, "WATER"), n(3, "WATER")],
        ranks: [1, 2, 3],
      },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const plays = enumerateLegalPlays(state, { includeSkills: true });
  const extend = plays.filter(
    (p) =>
      p.input.kind === "PLAY" &&
      p.input.useSkill === "JOKER_TRANSFORM" &&
      p.actionKind === "EXTEND" &&
      p.input.cardIds.includes("CARD_NUMBER_RANK_4_SUIT_FIRE"),
  );
  assert.ok(extend.length > 0, "expected a 2-card JOKER_TRANSFORM sequence extension");
  for (const p of extend) assert.equal(resolvePlay(state, p.input).ok, true);
});

test("includeSkills is a no-op without an unused skill", () => {
  const state = skillRound({ activeSeatSkill: null, activeSeatHand: [n(4, "FIRE")] });
  assert.deepEqual(
    enumerateLegalPlays(state, { includeSkills: true }).map((p) => p.input),
    enumerateLegalPlays(state).map((p) => p.input),
  );
});

test("includeSkills is a no-op when the held skill is already used", () => {
  const state = createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: 1,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [n(4, "FIRE"), n(5, "FIRE")], {
        skillId: "SK1",
        effectCode: "SKILL_JOKER_HERO",
        used: true,
      }),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: nonEmptyField,
  });
  assert.deepEqual(
    enumerateLegalPlays(state, { includeSkills: true }),
    enumerateLegalPlays(state),
  );
});

test("includeSkills: every JOKER_CLEAR / JOKER_TRANSFORM entry passes resolvePlay and order is deterministic", () => {
  const state = skillRound({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_JOKER_HERO" },
    activeSeatHand: [n(3, "FIRE"), n(3, "WATER"), n(4, "FIRE"), n(5, "FIRE")],
    activeField: nonEmptyField,
  });
  const a = enumerateLegalPlays(state, { includeSkills: true });
  const b = enumerateLegalPlays(state, { includeSkills: true });
  assert.deepEqual(
    a.map((p) => JSON.stringify(p.input)),
    b.map((p) => JSON.stringify(p.input)),
  );
  const skillPlays = a.filter((p) => p.input.kind === "PLAY" && p.input.useSkill);
  assert.ok(
    skillPlays.some((p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_CLEAR"),
    "expected a JOKER_CLEAR play",
  );
  assert.ok(
    skillPlays.some((p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_TRANSFORM"),
    "expected a JOKER_TRANSFORM play",
  );
  for (const p of a) {
    assert.equal(resolvePlay(state, p.input).ok, true, `not ok: ${JSON.stringify(p.input)}`);
  }
  // within a given card count, bare number plays precede their skill-bearing siblings
  for (let count = 0; count <= 5; count += 1) {
    const atCount = a
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.input.kind === "PLAY" && p.input.cardIds.length === count);
    const lastBare = atCount
      .filter(({ p }) => p.input.kind === "PLAY" && !p.input.useSkill)
      .map(({ i }) => i)
      .at(-1);
    const firstSkill = atCount
      .filter(({ p }) => p.input.kind === "PLAY" && p.input.useSkill)
      .map(({ i }) => i)
      .at(0);
    if (lastBare !== undefined && firstSkill !== undefined) {
      assert.ok(lastBare < firstSkill, `count ${count}: bare should precede skill`);
    }
  }
});

// ---- includeSkills: EXTENSION_SEAL + REVOLUTION ----

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

test("includeSkills: an EXTENSION_SEAL holder gets a sealed variant of each number play", () => {
  const state = skillRound({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_EXTENSION_SEAL" },
    activeSeatHand: [n(5, "FIRE"), n(6, "FIRE"), n(8, "WATER")],
    activeField: nonEmptyField, // SINGLE 4 -> singles 5/6/8 are REPLACE in DAY
  });
  const bare = enumerateLegalPlays(state).filter(
    (p) => p.input.kind === "PLAY",
  );
  assert.ok(bare.length > 0);
  const withSkill = enumerateLegalPlays(state, { includeSkills: true });
  for (const b of bare) {
    assert.ok(
      withSkill.some(
        (p) =>
          p.input.kind === "PLAY" &&
          p.input.useSkill === "EXTENSION_SEAL" &&
          b.input.kind === "PLAY" &&
          sameSet(p.input.cardIds, b.input.cardIds),
      ),
      `no sealed variant for ${
        b.input.kind === "PLAY" ? b.input.cardIds.join(",") : "?"
      }`,
    );
  }
  // the bare/sealed pair are two distinct plays (distinct seen keys)
  const sealed = withSkill.filter(
    (p) => p.input.kind === "PLAY" && p.input.useSkill === "EXTENSION_SEAL",
  );
  assert.equal(sealed.length, bare.length);
  for (const p of withSkill) assert.equal(resolvePlay(state, p.input).ok, true);
});

test("includeSkills: a REVOLUTION holder gets plays that are legal only after the flip", () => {
  // field SINGLE 6. In DAY a single 3 (str 3) or 2 (str 2) is NOT_STRONGER.
  // REVOLUTION flips to NIGHT: str(3)=7, str(2)=8, str(field 6)=4 -> both REPLACE.
  const state = skillRound({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_REVOLUTION" },
    activeSeatHand: [n(3, "FIRE"), n(2, "WATER")],
    activeField: {
      combination: { kind: "SINGLE", cards: [n(6, "WIND")], ranks: [6] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  // no bare number response exists in the current (DAY) orientation
  const bare = enumerateLegalPlays(state);
  assert.ok(!bare.some((p) => p.input.kind === "PLAY" && !p.input.useSkill));

  const plays = enumerateLegalPlays(state, { includeSkills: true });
  const rev = plays.filter(
    (p) => p.input.kind === "PLAY" && p.input.useSkill === "REVOLUTION",
  );
  assert.ok(rev.length > 0);
  for (const p of rev) assert.equal(resolvePlay(state, p.input).ok, true);
  for (const p of rev) assert.notEqual(p.actionKind, "PASS");
});

test("includeSkills: EXTENSION_SEAL / REVOLUTION keep the no-options invariance", () => {
  for (const effectCode of [
    "SKILL_EXTENSION_SEAL",
    "SKILL_REVOLUTION",
  ] as const) {
    const state = skillRound({
      activeSeatSkill: { skillId: "SK1", effectCode },
      activeSeatHand: [n(3, "FIRE"), n(3, "WATER"), n(5, "FIRE"), n(6, "FIRE")],
      activeField: nonEmptyField,
    });
    assert.deepEqual(enumerateLegalPlays(state), enumerateLegalPlays(state, {}));
  }
});

test("the sequence candidate cap (1024) does not skip a legal 5-card window on an 18-card hand", () => {
  // rank counts 4/4/4/3/3 over ranks 1-5 → full-window product 4*4*4*3*3 = 576 (> old cap 512).
  const suits = ["FIRE", "WATER", "WIND", "EARTH"] as const;
  const hand = [
    ...suits.map((s) => n(1, s)),
    ...suits.map((s) => n(2, s)),
    ...suits.map((s) => n(3, s)),
    ...suits.slice(0, 3).map((s) => n(4, s)),
    ...suits.slice(0, 3).map((s) => n(5, s)),
  ];
  assert.equal(hand.length, 18);
  const state = round({
    players: [createPlayerState("P1", hand), createPlayerState("P2", [n(9, "EARTH")])],
    activePlayerId: "P1",
  });
  const plays = enumerateLegalPlays(state);
  assert.ok(
    plays.some(
      (p) =>
        p.actionKind === "LEAD" &&
        p.resultingCombination?.kind === "SEQUENCE" &&
        p.input.kind === "PLAY" &&
        p.input.cardIds.length === 5,
    ),
  );
});
