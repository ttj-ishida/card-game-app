import { isHumanSeat, type MatchConfig } from './matchConfig';
import type { DriverState } from './turnDriver';

/** 局終了後の表示ビュー。設計書 §4.5。 */
export type RoundResultView = {
  winnerSeatId: string;
  winnerNameKey: string;
  localWon: boolean;
  playerCount: number;
  turnCount: number;
  durationMs: number;
};

/**
 * 完走した `DriverState` を結果ビューへ変換する。
 * `state.winnerSeatId` が null（＝未完走）なら投げる。
 * `durationMs` は `Math.max(0, endedAtMs - startedAtMs)` でクランプする。
 */
export function describeRoundResult(
  state: DriverState,
  startedAtMs: number,
  endedAtMs: number,
): RoundResultView {
  const winnerSeatId = state.winnerSeatId;
  if (winnerSeatId == null) {
    throw new Error('describeRoundResult: round is not finished (winnerSeatId is null)');
  }
  const winnerSeat = state.config.seats.find((s) => s.seatId === winnerSeatId);
  if (winnerSeat == null) {
    throw new Error(`describeRoundResult: winner seat "${winnerSeatId}" is not in the config`);
  }
  return {
    winnerSeatId,
    winnerNameKey: winnerSeat.nameKey,
    localWon: isHumanSeat(state.config, winnerSeatId),
    playerCount: state.config.seats.length,
    turnCount: state.turnLog.length,
    durationMs: Math.max(0, endedAtMs - startedAtMs),
  };
}

/** M2-SB-01 `practice_round_results` の列に対応するペイロード。 */
export type PracticeResultPayload = {
  client_result_id: string;
  anon_player_id: string;
  mode: 'CPU_PRACTICE';
  player_count: number;
  local_player_seat: number;
  winner_seat: number;
  local_won: boolean;
  turn_count: number;
  duration_ms: number;
  round_seed: number;
};

function humanSeatIndex(config: MatchConfig): number {
  const index = config.seats.findIndex((s) => s.kind === 'HUMAN');
  if (index < 0) {
    throw new Error('buildPracticeResultPayload: config has no HUMAN seat');
  }
  return index;
}

/**
 * 結果ビュー + 完走 state から Supabase 送信ペイロードを組む。
 * `winner_seat` / `local_player_seat` は `config.seats` の index。
 * DB の CHECK `local_won = (winner_seat = local_player_seat)` に一致することを表明する
 * （不一致ならこのモジュールより上流のバグ）。
 */
export function buildPracticeResultPayload(input: {
  view: RoundResultView;
  state: DriverState;
  anonPlayerId: string;
  clientResultId: string;
}): PracticeResultPayload {
  const { view, state, anonPlayerId, clientResultId } = input;
  const localPlayerSeat = humanSeatIndex(state.config);
  const winnerSeat = state.config.seats.findIndex((s) => s.seatId === view.winnerSeatId);
  if (winnerSeat < 0) {
    throw new Error(
      `buildPracticeResultPayload: winner seat "${view.winnerSeatId}" is not in the config`,
    );
  }
  if (view.localWon !== (winnerSeat === localPlayerSeat)) {
    throw new Error(
      `buildPracticeResultPayload: localWon (${view.localWon}) disagrees with ` +
        `winner_seat === local_player_seat (${winnerSeat} === ${localPlayerSeat})`,
    );
  }
  return {
    client_result_id: clientResultId,
    anon_player_id: anonPlayerId,
    mode: 'CPU_PRACTICE',
    player_count: view.playerCount,
    local_player_seat: localPlayerSeat,
    winner_seat: winnerSeat,
    local_won: view.localWon,
    turn_count: view.turnCount,
    duration_ms: view.durationMs,
    round_seed: state.seed,
  };
}
