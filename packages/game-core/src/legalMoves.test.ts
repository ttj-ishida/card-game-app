import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type RoundState,
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
