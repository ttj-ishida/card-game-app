import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
  isSkillCard,
  type PlayerState,
  type RoundState,
} from "./index.ts";

test("M1 state types keep display text out of stored game state", () => {
  const card = createNumberCard(
    "CARD_NUMBER_RANK_7_SUIT_FIRE",
    "RANK_7",
    "SUIT_FIRE",
  );
  const player = createPlayerState("PLAYER_1", [card], {
    skillId: "SKILL_CARD_REVOLUTION#1",
    effectCode: "SKILL_REVOLUTION",
    used: false,
  });
  const round = createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: "DAY",
    players: [player],
    activePlayerId: "PLAYER_1",
  });

  const serialized = JSON.stringify(round satisfies RoundState);

  assert.equal(
    (round.players[0] satisfies PlayerState).hand[0].rankCode,
    "RANK_7",
  );
  assert.equal(isSkillCard(round.players[0].skill), true);
  assert.equal(serialized.includes("大天使"), false);
  assert.equal(serialized.includes("火"), false);
});
