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
