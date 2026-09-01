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
