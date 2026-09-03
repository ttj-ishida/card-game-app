import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
  resolvePlay,
} from "./server.ts";

test("server entrypoint exposes deterministic round rule resolution", () => {
  const state = createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [
        createNumberCard("N_3_FIRE", "RANK_3", "SUIT_FIRE"),
        createNumberCard("N_5_FIRE", "RANK_5", "SUIT_FIRE"),
      ]),
      createPlayerState("P2", [createNumberCard("N_4_WATER", "RANK_4", "SUIT_WATER")]),
    ],
    activePlayerId: "P1",
  });

  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.state.activePlayerId, "P2");
  assert.equal(result.ok && result.outcome.actionKind, "LEAD");
});

