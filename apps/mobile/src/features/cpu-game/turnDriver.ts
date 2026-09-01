import {
  createRng,
  createRoundState,
  dealRound,
  enumerateLegalPlays,
  INITIAL_RULESET_VERSION,
  resolveCpuPolicy,
  resolvePlay,
  rollThinkDelayMillis,
  type DayNight,
  type LegalPlay,
  type PlayInput,
  type PlayRejectionReason,
  type PlayResolution,
  type RoundState,
  type Rng,
} from '@card-game-app/game-core';
import { isHumanSeat, seatPolicies, type MatchConfig } from './matchConfig';

export type GamePhase = 'HUMAN_TURN' | 'CPU_PENDING' | 'ROUND_OVER';

export type TurnActionKind = 'LEAD' | 'EXTEND' | 'REPLACE' | 'PASS';

/**
 * 局のトレース1手ぶん。カード内容（cardId / rankCode / suitCode）は一切保持せず、
 * 「何を選んだか（種別・枚数）」と手番後の公開情報だけを残す（手札を UI ログに漏らさない）。
 */
export type TurnLogEntry = {
  index: number;
  seatId: string;
  seatKind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS';
  cardCount: number;
  actionKind: TurnActionKind;
  fieldCleared: boolean;
  dayNightAfter: DayNight;
  handCountsAfter: Record<string, number>;
};

export type DriverState = {
  config: MatchConfig;
  seed: number;
  rematchIndex: number;
  baselineFirstSeatId: string;
  round: RoundState;
  phase: GamePhase;
  turnLog: TurnLogEntry[];
  winnerSeatId: string | null;
};

export type HumanPlayResult =
  { ok: true; next: DriverState } | { ok: false; reason: PlayRejectionReason };

export type CpuDecision = {
  seatId: string;
  input: PlayInput;
  thinkMillis: number;
  actionKind: TurnActionKind;
};

export type CpuStepResult = { next: DriverState; decided: CpuDecision };

type ResolvedPlay = Extract<PlayResolution, { ok: true }>;

function phaseFor(config: MatchConfig, round: RoundState): GamePhase {
  if (round.winnerId) return 'ROUND_OVER';
  return isHumanSeat(config, round.activePlayerId) ? 'HUMAN_TURN' : 'CPU_PENDING';
}

/**
 * その手番の RNG を種から再構成する。roundLoop.ts の規律を鏡写しにする：
 * `createRng(seed)` → 配布ぶんに1回 `fork()` → 消費済みの手番ぶん `fork()` →
 * もう1回 `fork()` した独立ストリームがその手番のもの。
 * turnIndex は「その手番より前に確定した手数」= `turnLog.length`。
 * これにより人間の分岐がどう転んでも CPU の決定は再現可能になる。
 */
function turnRng(seed: number, turnIndex: number): Rng {
  const rng = createRng(seed);
  rng.fork(); // 配布ぶん
  for (let i = 0; i < turnIndex; i += 1) rng.fork();
  return rng.fork();
}

export function initGame(input: {
  config: MatchConfig;
  seed: number;
  rematchIndex?: number;
  baselineFirstSeatId?: string;
}): DriverState {
  const rematchIndex = input.rematchIndex ?? 0;
  const rng = createRng(input.seed);
  const deal = dealRound({
    playerIds: input.config.seats.map((s) => s.seatId),
    rng: rng.fork(),
    rematchIndex,
    baselineFirstPlayerId: input.baselineFirstSeatId,
  });
  const round = createRoundState({
    rulesetCode: 'INITIAL',
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: deal.dayNight,
    players: deal.players,
    activePlayerId: deal.firstPlayerId,
  });
  return {
    config: input.config,
    seed: input.seed,
    rematchIndex,
    baselineFirstSeatId: input.baselineFirstSeatId ?? deal.firstPlayerId,
    round,
    phase: phaseFor(input.config, round),
    turnLog: [],
    winnerSeatId: round.winnerId,
  };
}

function appendTurn(
  state: DriverState,
  seatId: string,
  input: PlayInput,
  res: ResolvedPlay,
): DriverState {
  const seatKind = isHumanSeat(state.config, seatId) ? 'HUMAN' : 'CPU';
  const entry: TurnLogEntry = {
    index: state.turnLog.length,
    seatId,
    seatKind,
    kind: input.kind === 'PASS' ? 'PASS' : 'PLAY',
    cardCount: input.kind === 'PASS' ? 0 : input.cardIds.length,
    actionKind: res.outcome.actionKind,
    fieldCleared: res.outcome.fieldCleared,
    dayNightAfter: res.outcome.dayNightAfter,
    handCountsAfter: Object.fromEntries(res.state.players.map((p) => [p.playerId, p.hand.length])),
  };
  return {
    ...state,
    round: res.state,
    turnLog: [...state.turnLog, entry],
    phase: phaseFor(state.config, res.state),
    winnerSeatId: res.state.winnerId,
  };
}

export function humanPlay(state: DriverState, input: PlayInput): HumanPlayResult {
  if (state.phase !== 'HUMAN_TURN' || input.playerId !== state.round.activePlayerId) {
    return { ok: false, reason: 'NOT_ACTIVE_PLAYER' };
  }
  const res = resolvePlay(state.round, input);
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, next: appendTurn(state, input.playerId, input, res) };
}

export function cpuStep(state: DriverState): CpuStepResult {
  const seatId = state.round.activePlayerId;
  const turnIndex = state.turnLog.length;
  const rng = turnRng(state.seed, turnIndex);
  const legalPlays = enumerateLegalPlays(state.round, { includeSkills: true });
  const policyId = seatPolicies(state.config)[seatId];
  if (!policyId) {
    throw new Error(
      `cpuStep: seat "${seatId}" has no CPU policy at turn ${turnIndex} ` + `(is it a human seat?)`,
    );
  }
  const input = resolveCpuPolicy(policyId)({ state: state.round, legalPlays, rng });
  const thinkMillis = rollThinkDelayMillis(rng);
  const res = resolvePlay(state.round, input);
  if (!res.ok) {
    throw new Error(
      `cpuStep: policy "${policyId}" for seat "${seatId}" produced an illegal move ` +
        `at turn ${turnIndex} (reason ${res.reason}): ${JSON.stringify(input)}`,
    );
  }
  return {
    next: appendTurn(state, seatId, input, res),
    decided: { seatId, input, thinkMillis, actionKind: res.outcome.actionKind },
  };
}

export function legalPlaysForHuman(state: DriverState): LegalPlay[] {
  return state.phase === 'HUMAN_TURN' ? enumerateLegalPlays(state.round) : [];
}

export function activeSeatId(state: DriverState): string {
  return state.round.activePlayerId;
}

export function isHumanTurn(state: DriverState): boolean {
  return state.phase === 'HUMAN_TURN';
}
