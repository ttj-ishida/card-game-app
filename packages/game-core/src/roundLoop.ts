import type {
  DayNight,
  NumberCard,
  PlayActionKind,
  PlayInput,
  PlaySkillUse,
  RoundState,
} from "./core.ts";
import { INITIAL_RULESET_VERSION, createRoundState, resolvePlay } from "./core.ts";
import { type DealResult, dealRound } from "./deal.ts";
import { enumerateLegalPlays } from "./legalMoves.ts";
import {
  CPU_POLICY_IDS,
  type CpuPolicyId,
  resolveCpuPolicy,
  rollThinkDelayMillis,
} from "./cpuPolicy.ts";
import { createRng } from "./rng.ts";

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

// 停止性の根拠：場が流れるたびに必ず LEAD が発生し（空場では PASS は不正）、
// LEAD は必ず1枚以上を手札から恒久的に取り除く PLAY である。よって PLAY 手番は
// 高々 ~36 回、その間に挟まる PASS は高々 (n-1) 回 → どのポリシーでも合法手を返す限り
// 手番数は概ね 36n（n≤6 で ≤216）で頭打ちになる。1000 はあくまで安全マージンで、
// チューニング値ではない。
const DEFAULT_MAX_TURNS = 1000;

export function playRound(input: PlayRoundInput): RoundResult {
  const rematchIndex = input.rematchIndex ?? 0;
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;
  const playerIds = [...input.playerIds];

  // 配布より前に席ポリシーを検証する（局の途中で気付くより早く落とす）。
  for (const id of playerIds) {
    if (!Object.hasOwn(input.seatPolicies, id)) {
      throw new Error(`playRound: no CPU policy for seat "${id}"`);
    }
    const policyId = input.seatPolicies[id];
    if (!CPU_POLICY_IDS.includes(policyId)) {
      throw new Error(`playRound: unknown CPU policy "${policyId}" for seat "${id}"`);
    }
  }

  const rng = createRng(input.seed);

  const deal = dealRound({
    playerIds,
    rng: rng.fork(),
    rematchIndex,
    baselineFirstPlayerId: input.baselineFirstPlayerId,
  });

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

    const legalPlays = enumerateLegalPlays(state, { includeSkills: true });
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
  } else if (play.kind === "PLAY") {
    const record: TurnPlayRecord = {
      kind: "PLAY",
      playerId: play.playerId,
      cardCount: play.cardIds.length,
    };
    if (play.useSkill !== undefined) record.useSkill = play.useSkill;
    return record;
  } else {
    throw new Error(`redactPlay: unexpected play kind`);
  }
}

// A transformed Joker (createTransformedJokerCard) is a NumberCard that is NOT one
// of the 36 number-deck cards — it carries `transformedFromSkillId`. The card
// conservation invariant only holds for the real deck, so filter it out here.
function isRealCard(card: NumberCard): boolean {
  return card.transformedFromSkillId === undefined;
}

function assertInvariants(state: RoundState, turnIndex: number, playerIds: string[]): void {
  const handCards = state.players.flatMap((p) => p.hand).filter(isRealCard);
  const fieldCards = (state.activeField?.combination.cards ?? []).filter(isRealCard);
  const discardCards = state.discardPile.filter(isRealCard);
  const total = handCards.length + discardCards.length + fieldCards.length;
  if (total !== 36) {
    throw new Error(
      `playRound: real card conservation broken at turn ${turnIndex} (total ${total})`,
    );
  }
  const handIds = handCards.map((c) => c.cardId);
  if (new Set(handIds).size !== handIds.length) {
    throw new Error(`playRound: duplicate real card in hands at turn ${turnIndex}`);
  }
  if (!playerIds.includes(state.activePlayerId)) {
    throw new Error(`playRound: active player "${state.activePlayerId}" not seated at turn ${turnIndex}`);
  }
}
