import type { DayNight, PlayActionKind, PlayInput, PlaySkillUse, RoundState } from "./index.js";
import { INITIAL_RULESET_VERSION, createRoundState, resolvePlay } from "./index.js";
import { type DealResult, dealRound } from "./deal.js";
import { enumerateLegalPlays } from "./legalMoves.js";
import { type CpuPolicyId, resolveCpuPolicy, rollThinkDelayMillis } from "./cpuPolicy.js";
import { createRng } from "./rng.js";

export type PlayRoundInput = {
  playerIds: readonly string[];
  seed: number;
  seatPolicies: Record<string, CpuPolicyId>;
  rematchIndex?: number;
  baselineFirstPlayerId?: string;
  maxTurns?: number;
};

/**
 * トレース用の手の記録。cardId・rankCode・suitCode などのカード内容は
 * 一切含めない（M2-QA-01 の自己対戦ハーネスに手札を漏らさない）。
 * 何を選んだか（種別・枚数・スキル）だけを残す。
 */
export type TurnPlayRecord =
  | { kind: "PASS"; playerId: string }
  | { kind: "PLAY"; playerId: string; cardCount: number; useSkill?: PlaySkillUse };

export type TurnRecord = {
  index: number;
  playerId: string;
  policyId: CpuPolicyId;
  legalPlayCount: number;
  input: TurnPlayRecord;
  actionKind: PlayActionKind | "PASS";
  fieldCleared: boolean;
  naturalRevolution: boolean;
  dayNightAfter: DayNight;
  handCountsAfter: Record<string, number>;
  thinkMillis: number;
};

export type RoundStopReason = "WINNER" | "MAX_TURNS" | "NO_PROGRESS";

export type RoundResult = {
  seed: number;
  rematchIndex: number;
  config: { playerIds: string[]; seatPolicies: Record<string, CpuPolicyId> };
  deal: DealResult;
  turns: TurnRecord[];
  winnerId: string | null;
  finalState: RoundState;
  stopReason: RoundStopReason;
};

const DEFAULT_MAX_TURNS = 1000;

export function playRound(input: PlayRoundInput): RoundResult {
  const rematchIndex = input.rematchIndex ?? 0;
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;
  const playerIds = [...input.playerIds];

  const rng = createRng(input.seed);

  const deal = dealRound({
    playerIds,
    rng: rng.fork(),
    rematchIndex,
    baselineFirstPlayerId: input.baselineFirstPlayerId,
  });

  for (const id of playerIds) {
    if (!(id in input.seatPolicies)) {
      throw new Error(`playRound: no CPU policy for seat "${id}"`);
    }
  }

  let state = createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: deal.dayNight,
    players: deal.players,
    activePlayerId: deal.firstPlayerId,
  });

  const turns: TurnRecord[] = [];
  let stopReason: RoundStopReason = "WINNER";

  while (state.winnerId === null && turns.length < maxTurns) {
    const turnIndex = turns.length;
    const active = state.activePlayerId;
    const policyId = input.seatPolicies[active];
    const turnRng = rng.fork();

    const legalPlays = enumerateLegalPlays(state);
    if (legalPlays.length === 0) {
      stopReason = "NO_PROGRESS";
      break;
    }

    const play = resolveCpuPolicy(policyId)({ state, legalPlays, rng: turnRng });
    const thinkMillis = rollThinkDelayMillis(turnRng);

    const res = resolvePlay(state, play);
    if (!res.ok) {
      throw new Error(
        `playRound: policy "${policyId}" produced an illegal move at turn ${turnIndex} ` +
          `(reason ${res.reason}): ${JSON.stringify(play)}`,
      );
    }

    state = res.state;
    assertInvariants(state, turnIndex, playerIds);

    turns.push({
      index: turnIndex,
      playerId: active,
      policyId,
      legalPlayCount: legalPlays.length,
      input: redactPlay(play),
      actionKind: res.outcome.actionKind,
      fieldCleared: res.outcome.fieldCleared,
      naturalRevolution: res.outcome.naturalRevolution,
      dayNightAfter: res.outcome.dayNightAfter,
      handCountsAfter: Object.fromEntries(
        state.players.map((p) => [p.playerId, p.hand.length]),
      ),
      thinkMillis,
    });
  }

  if (state.winnerId === null && stopReason === "WINNER") {
    stopReason = "MAX_TURNS";
  }

  return {
    seed: input.seed,
    rematchIndex,
    config: { playerIds, seatPolicies: { ...input.seatPolicies } },
    deal,
    turns,
    winnerId: state.winnerId,
    finalState: state,
    stopReason,
  };
}

function redactPlay(play: PlayInput): TurnPlayRecord {
  if (play.kind === "PASS") {
    return { kind: "PASS", playerId: play.playerId };
  }
  const record: TurnPlayRecord = {
    kind: "PLAY",
    playerId: play.playerId,
    cardCount: play.cardIds.length,
  };
  if (play.useSkill !== undefined) record.useSkill = play.useSkill;
  return record;
}

function assertInvariants(state: RoundState, turnIndex: number, playerIds: string[]): void {
  const handCards = state.players.flatMap((p) => p.hand);
  const fieldCards = state.activeField?.combination.cards ?? [];
  const total = handCards.length + state.discardPile.length + fieldCards.length;
  if (total !== 36) {
    throw new Error(`playRound: card conservation broken at turn ${turnIndex} (total ${total})`);
  }
  const handIds = handCards.map((c) => c.cardId);
  if (new Set(handIds).size !== handIds.length) {
    throw new Error(`playRound: duplicate card in hands at turn ${turnIndex}`);
  }
  if (!playerIds.includes(state.activePlayerId)) {
    throw new Error(`playRound: active player "${state.activePlayerId}" not seated at turn ${turnIndex}`);
  }
}
