import type { PublicRoundEvent } from './turnDriver';

/** M3-SB-04 `round_events` の列に対応するペイロード。 */
export type RoundEventsPayload = {
  round_result_id: string;
  events: RoundEventPayloadEntry[];
};

export type RoundEventPayloadEntry = {
  index: number;
  seat_id: string;
  seat_kind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS';
  action_kind: PublicRoundEvent['actionKind'];
  cards: { rank_code: string; suit_code: string }[];
  skill_effect: PublicRoundEvent['skillEffect'];
  field_cleared: boolean;
  day_night_after: PublicRoundEvent['dayNightAfter'];
  hand_counts_after: Record<string, number>;
};

/**
 * `turnDriver` の `publicEvents`（内部の camelCase 表現）から
 * `round_events.events`（DB のスネークケース JSON 表現）へ変換する。
 * pure 関数。`round_result_id` は呼び出し側が `practice_round_results` への
 * insert 成功後に得る値を渡す（ネットワーク配線は次サブプロジェクト）。
 */
export function buildRoundEventsPayload(
  roundResultId: string,
  publicEvents: PublicRoundEvent[],
): RoundEventsPayload {
  return {
    round_result_id: roundResultId,
    events: publicEvents.map((event) => ({
      index: event.index,
      seat_id: event.seatId,
      seat_kind: event.seatKind,
      kind: event.kind,
      action_kind: event.actionKind,
      cards: event.cards.map((card) => ({ rank_code: card.rankCode, suit_code: card.suitCode })),
      skill_effect: event.skillEffect,
      field_cleared: event.fieldCleared,
      day_night_after: event.dayNightAfter,
      hand_counts_after: event.handCountsAfter,
    })),
  };
}
