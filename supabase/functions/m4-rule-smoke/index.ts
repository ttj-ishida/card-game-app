import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
  resolvePlay,
} from "@card-game-app/game-core/server";

Deno.serve(() => {
  const state = createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [
        createNumberCard("N_3_FIRE", "RANK_3", "SUIT_FIRE"),
        createNumberCard("N_5_FIRE", "RANK_5", "SUIT_FIRE"),
      ]),
      createPlayerState("P2", [
        createNumberCard("N_4_WATER", "RANK_4", "SUIT_WATER"),
      ]),
    ],
    activePlayerId: "P1",
  });

  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE"],
  });

  return Response.json({
    ok: result.ok,
    actionKind: result.ok ? result.outcome.actionKind : null,
    activePlayerId: result.ok ? result.state.activePlayerId : state.activePlayerId,
    rulesetVersion: INITIAL_RULESET_VERSION,
  });
});
