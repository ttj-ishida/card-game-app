import {
  isTransformedJokerCard,
  rankNumber,
  RANK_CODES,
  SUIT_CODES,
  UNLOCKED_FIELD,
  type CombinationKind,
  type DayNight,
  type FieldLock,
  type NumberCard,
  type PlaySkillUse,
  type RankCode,
  type SkillEffectCode,
  type SuitCode,
} from '@card-game-app/game-core';

import type { FieldCardView, HandCardView } from '../cpu-game/boardViewModel';
import type { PublicRoundEvent, TurnActionKind } from '../cpu-game/turnDriver';

export type OnlineSnapshotHandRow = {
  card_id: string;
  position: number;
  card_state: 'IN_HAND' | 'PLAYED' | 'DISCARDED';
};

export type OnlineSnapshotSkillRow = {
  skill_id: string;
  used: boolean;
  consumed_at: string | null;
};

export type OnlineSnapshotEventRow = {
  event_seq: number;
  state_version: number;
  event_kind: string;
  actor_player_id: string | null;
  public_payload: Record<string, unknown> | null;
  created_at: string;
};

export type OnlineSnapshotActiveField = {
  combination: {
    kind: CombinationKind;
    cards: NumberCard[];
    ranks: number[];
  };
  lastPlayerId: string;
  lock?: Partial<FieldLock> | null;
};

export type OnlineRoundSnapshotResponse = {
  ok: true;
  round_id: string;
  player_id: string;
  state_version: number;
  latest_event_seq: number;
  public_state: {
    state_version: number;
    day_night: DayNight;
    active_player_id: string;
    active_field: OnlineSnapshotActiveField | Record<string, never> | null;
    hand_counts: Record<string, number>;
  };
  hand: OnlineSnapshotHandRow[];
  skills: OnlineSnapshotSkillRow[];
  events: OnlineSnapshotEventRow[];
};

export type OnlineOpponentView = {
  playerId: string;
  numberCardCount: number;
  isActive: boolean;
};

export type OnlineSkillView = {
  skillId: string;
  effectCode: SkillEffectCode;
  used: boolean;
};

export type OnlineRoundEventView = Pick<
  PublicRoundEvent,
  | 'index'
  | 'seatId'
  | 'kind'
  | 'actionKind'
  | 'cards'
  | 'skillEffect'
  | 'fieldCleared'
  | 'dayNightAfter'
> & {
  eventSeq: number;
  stateVersion: number;
  createdAt: string;
  /** サーバーの生の event_kind（PLAY_ACCEPTED / PLAYER_LEFT_CPU_TAKEOVER など）。 */
  eventKind: string;
};

export type SeatTakeoverStatus = 'CPU' | 'LEFT';

/**
 * イベントログから席ごとの離脱状態を導出する（M4-EX-09）。
 * `PLAYER_LEFT_CPU_TAKEOVER` → CPU 引き継ぎ、`PLAYER_FORFEITED` → 退出（棄権）。
 * 離脱イベントの `actor_player_id`（= `seatId`）が離脱した本人。
 */
export function deriveSeatTakeovers(
  events: OnlineRoundEventView[],
): Record<string, SeatTakeoverStatus> {
  const out: Record<string, SeatTakeoverStatus> = {};
  for (const event of events) {
    if (!event.seatId) continue;
    if (event.eventKind === 'PLAYER_LEFT_CPU_TAKEOVER') out[event.seatId] = 'CPU';
    else if (event.eventKind === 'PLAYER_FORFEITED') out[event.seatId] = 'LEFT';
  }
  return out;
}

export type OnlineRoundViewModel = {
  roundId: string;
  playerId: string;
  stateVersion: number;
  latestEventSeq: number;
  dayNight: DayNight;
  activePlayerId: string;
  isMyTurn: boolean;
  field: { cards: FieldCardView[]; kind: CombinationKind; lastPlayerId: string } | null;
  lock: FieldLock;
  hand: HandCardView[];
  skills: OnlineSkillView[];
  opponents: OnlineOpponentView[];
  events: OnlineRoundEventView[];
};

const skillEffectsById: Record<string, SkillEffectCode> = {
  SKILL_CARD_JOKER_HERO: 'SKILL_JOKER_HERO',
  SKILL_CARD_JOKER_SAINT: 'SKILL_JOKER_SAINT',
  SKILL_CARD_EXTENSION_SEAL: 'SKILL_EXTENSION_SEAL',
  SKILL_CARD_REVOLUTION: 'SKILL_REVOLUTION',
};

function isRankCode(value: string): value is RankCode {
  return (RANK_CODES as readonly string[]).includes(value);
}

function isSuitCode(value: string): value is SuitCode {
  return (SUIT_CODES as readonly string[]).includes(value);
}

export function parseNumberCardId(cardId: string): NumberCard | null {
  const match = /^CARD_NUMBER_(RANK_[1-9])_(SUIT_(?:FIRE|WATER|WIND|EARTH))$/.exec(cardId);
  if (!match) return null;
  const [, rankCode, suitCode] = match;
  if (!isRankCode(rankCode) || !isSuitCode(suitCode)) return null;
  return { kind: 'NUMBER', cardId, rankCode, suitCode };
}

export function parseSkillEffectFromId(skillId: string): SkillEffectCode | null {
  return skillEffectsById[skillId] ?? null;
}

function cardFace(
  card: Pick<NumberCard, 'rankCode' | 'suitCode' | 'transformedFromSkillId'>,
): FieldCardView {
  return {
    rank: rankNumber(card.rankCode),
    suitCode: card.suitCode,
    isJoker: isTransformedJokerCard(card as NumberCard),
  };
}

export function normalizeLock(lock: Partial<FieldLock> | null | undefined): FieldLock {
  return {
    countLocked: lock?.countLocked ?? UNLOCKED_FIELD.countLocked,
    suitFixed: lock?.suitFixed ? [...lock.suitFixed] : null,
    suitUniform: lock?.suitUniform ?? UNLOCKED_FIELD.suitUniform,
  };
}

function activeField(value: OnlineRoundSnapshotResponse['public_state']['active_field']) {
  if (!value || Object.keys(value).length === 0)
    return { field: null, lock: { ...UNLOCKED_FIELD } };
  const field = value as OnlineSnapshotActiveField;
  const lock = normalizeLock(field.lock);
  return {
    field: {
      cards: field.combination.cards.map(cardFace),
      kind: field.combination.kind,
      lastPlayerId: field.lastPlayerId,
    },
    lock,
  };
}

function buildHand(rows: OnlineSnapshotHandRow[]): HandCardView[] {
  return rows
    .slice()
    .sort(
      (left, right) => left.position - right.position || left.card_id.localeCompare(right.card_id),
    )
    .map((row) => parseNumberCardId(row.card_id))
    .filter((card): card is NumberCard => card != null)
    .map((card) => ({
      cardId: card.cardId,
      rank: rankNumber(card.rankCode),
      suitCode: card.suitCode,
      isJoker: false,
      selected: false,
      selectable: true,
    }));
}

function buildSkills(rows: OnlineSnapshotSkillRow[]): OnlineSkillView[] {
  return rows
    .map((row) => ({ row, effectCode: parseSkillEffectFromId(row.skill_id) }))
    .filter(
      (entry): entry is { row: OnlineSnapshotSkillRow; effectCode: SkillEffectCode } =>
        entry.effectCode != null,
    )
    .map(({ row, effectCode }) => ({ skillId: row.skill_id, effectCode, used: row.used }));
}

function buildOpponents(snapshot: OnlineRoundSnapshotResponse): OnlineOpponentView[] {
  return Object.entries(snapshot.public_state.hand_counts)
    .filter(([playerId]) => playerId !== snapshot.player_id)
    .map(([playerId, numberCardCount]) => ({
      playerId,
      numberCardCount,
      isActive: playerId === snapshot.public_state.active_player_id,
    }));
}

function parseActionKind(payload: Record<string, unknown> | null): TurnActionKind {
  const value = payload?.action_kind;
  if (value === 'LEAD' || value === 'EXTEND' || value === 'REPLACE' || value === 'PASS')
    return value;
  return 'PASS';
}

function parseEventKind(payload: Record<string, unknown> | null): 'PLAY' | 'PASS' {
  const value = payload?.kind;
  if (value === 'PLAY' || value === 'PASS') return value;
  return parseActionKind(payload) === 'PASS' ? 'PASS' : 'PLAY';
}

function parseSkillEffect(payload: Record<string, unknown> | null): PlaySkillUse | null {
  const value = payload?.skill_effect;
  if (
    value === 'EXTENSION_SEAL' ||
    value === 'REVOLUTION' ||
    value === 'JOKER_TRANSFORM' ||
    value === 'JOKER_CLEAR'
  ) {
    return value;
  }
  return null;
}

function parseEventCards(
  payload: Record<string, unknown> | null,
): { rankCode: RankCode; suitCode: SuitCode }[] {
  const cards = payload?.cards;
  if (!Array.isArray(cards)) return [];
  return cards.flatMap((card) => {
    if (!card || typeof card !== 'object') return [];
    const rankCode =
      (card as { rank_code?: unknown; rankCode?: unknown }).rank_code ??
      (card as { rankCode?: unknown }).rankCode;
    const suitCode =
      (card as { suit_code?: unknown; suitCode?: unknown }).suit_code ??
      (card as { suitCode?: unknown }).suitCode;
    if (typeof rankCode !== 'string' || typeof suitCode !== 'string') return [];
    if (!isRankCode(rankCode) || !isSuitCode(suitCode)) return [];
    return [{ rankCode, suitCode }];
  });
}

function buildEvents(rows: OnlineSnapshotEventRow[]): OnlineRoundEventView[] {
  return rows.map((row, index) => {
    const payload = row.public_payload;
    const dayNightAfter = payload?.day_night_after;
    return {
      index,
      eventSeq: row.event_seq,
      stateVersion: row.state_version,
      seatId: row.actor_player_id ?? '',
      kind: parseEventKind(payload),
      actionKind: parseActionKind(payload),
      cards: parseEventCards(payload),
      skillEffect: parseSkillEffect(payload),
      fieldCleared: payload?.field_cleared === true,
      dayNightAfter: dayNightAfter === 'NIGHT' ? 'NIGHT' : 'DAY',
      createdAt: row.created_at,
      eventKind: row.event_kind,
    };
  });
}

export function buildOnlineRoundViewModel(
  snapshot: OnlineRoundSnapshotResponse,
): OnlineRoundViewModel {
  const { field, lock } = activeField(snapshot.public_state.active_field);
  return {
    roundId: snapshot.round_id,
    playerId: snapshot.player_id,
    stateVersion: snapshot.state_version,
    latestEventSeq: snapshot.latest_event_seq,
    dayNight: snapshot.public_state.day_night,
    activePlayerId: snapshot.public_state.active_player_id,
    isMyTurn: snapshot.player_id === snapshot.public_state.active_player_id,
    field,
    lock,
    hand: buildHand(snapshot.hand),
    skills: buildSkills(snapshot.skills),
    opponents: buildOpponents(snapshot),
    events: buildEvents(snapshot.events),
  };
}
