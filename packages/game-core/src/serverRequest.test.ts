import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INITIAL_RULESET_VERSION,
  type ServerRoundSnapshot,
  resolveServerPlayRequest,
} from "./server.ts";

const snapshot: ServerRoundSnapshot = {
  roundId: "round-1",
  stateVersion: 0,
  dayNight: "DAY",
  activePlayerId: "P1",
  activeField: null,
  players: [
    {
      playerId: "P1",
      status: "ACTIVE",
      consecutivePasses: 0,
      hand: [{ cardId: "N_3_FIRE", rankCode: "RANK_3", suitCode: "SUIT_FIRE" }],
      skill: null,
    },
    {
      playerId: "P2",
      status: "ACTIVE",
      consecutivePasses: 0,
      hand: [
        { cardId: "N_4_WATER", rankCode: "RANK_4", suitCode: "SUIT_WATER" },
      ],
      skill: null,
    },
  ],
};

test("resolveServerPlayRequest accepts a legal play for the active authenticated player", () => {
  const result = resolveServerPlayRequest(snapshot, {
    requestId: "request-1",
    expectedStateVersion: 0,
    playerId: "P1",
    play: { kind: "PLAY", playerId: "P1", cardIds: ["N_3_FIRE"] },
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.outcome.actionKind, "LEAD");
  assert.equal(result.ok && result.rulesetVersion, INITIAL_RULESET_VERSION);
});

test("resolveServerPlayRequest rejects stale state versions before resolving cards", () => {
  const result = resolveServerPlayRequest(snapshot, {
    requestId: "request-2",
    expectedStateVersion: 99,
    playerId: "P1",
    play: { kind: "PLAY", playerId: "P1", cardIds: ["N_3_FIRE"] },
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? null : result.reason, "STALE_STATE_VERSION");
});

test("resolveServerPlayRequest rejects a player outside the active turn", () => {
  const result = resolveServerPlayRequest(snapshot, {
    requestId: "request-3",
    expectedStateVersion: 0,
    playerId: "P2",
    play: { kind: "PLAY", playerId: "P2", cardIds: ["N_4_WATER"] },
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? null : result.reason, "NOT_ACTIVE_PLAYER");
});

test("resolveServerPlayRequest rejects illegal card choices through shared rules", () => {
  const result = resolveServerPlayRequest(snapshot, {
    requestId: "request-4",
    expectedStateVersion: 0,
    playerId: "P1",
    play: { kind: "PLAY", playerId: "P1", cardIds: ["N_4_WATER"] },
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? null : result.reason, "CARD_NOT_IN_HAND");
});

test("resolveServerPlayRequest persists consecutivePasses so a 3-player round clears the field via all-pass", () => {
  const activeField = {
    combination: {
      kind: "SINGLE" as const,
      cards: [
        {
          kind: "NUMBER" as const,
          cardId: "N_9_FIRE",
          rankCode: "RANK_9" as const,
          suitCode: "SUIT_FIRE" as const,
        },
      ],
      ranks: [9],
    },
    lastPlayerId: "P1",
    lock: { countLocked: false, suitFixed: null, suitUniform: false },
  };

  const threePlayerSnapshot = (
    activePlayerId: string,
    consecutivePasses: number,
  ): ServerRoundSnapshot => ({
    roundId: "round-2",
    stateVersion: 1,
    dayNight: "DAY",
    activePlayerId,
    activeField,
    consecutivePasses,
    players: [
      {
        playerId: "P1",
        status: "ACTIVE",
        consecutivePasses: 0,
        hand: [],
        skill: null,
      },
      {
        playerId: "P2",
        status: "ACTIVE",
        consecutivePasses: 0,
        hand: [],
        skill: null,
      },
      {
        playerId: "P3",
        status: "ACTIVE",
        consecutivePasses: 0,
        hand: [],
        skill: null,
      },
    ],
  });

  // P2 passes first. Persisted consecutivePasses starts at 0 (no one has
  // passed yet since P1's lead) -> becomes 1, which is below the
  // 2-responder threshold, so the field must stay up.
  const afterP2Pass = resolveServerPlayRequest(threePlayerSnapshot("P2", 0), {
    requestId: "r1",
    expectedStateVersion: 1,
    playerId: "P2",
    play: { kind: "PASS", playerId: "P2" },
  });
  assert.equal(afterP2Pass.ok, true);
  const consecutivePassesAfterP2 = afterP2Pass.ok
    ? afterP2Pass.state.consecutivePasses
    : -1;
  assert.equal(consecutivePassesAfterP2, 1);
  assert.notEqual(afterP2Pass.ok && afterP2Pass.state.activeField, null);

  // P3 passes next. The caller must pass through the persisted count from
  // the previous response (this is the bug this test guards against: a
  // caller that always sends 0 would never reach the clear threshold).
  const afterP3Pass = resolveServerPlayRequest(
    threePlayerSnapshot("P3", consecutivePassesAfterP2),
    {
      requestId: "r2",
      expectedStateVersion: 1,
      playerId: "P3",
      play: { kind: "PASS", playerId: "P3" },
    },
  );
  assert.equal(afterP3Pass.ok, true);
  assert.equal(afterP3Pass.ok && afterP3Pass.state.activeField, null);
  assert.equal(afterP3Pass.ok && afterP3Pass.state.consecutivePasses, 0);
});

test("resolveServerPlayRequest rejects malformed request envelopes", () => {
  const result = resolveServerPlayRequest(snapshot, {
    requestId: "",
    expectedStateVersion: 0,
    playerId: "P1",
    play: { kind: "PASS", playerId: "P1" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? null : result.reason, "INVALID_REQUEST");
});
