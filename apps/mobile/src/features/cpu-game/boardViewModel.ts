import {
  isTransformedJokerCard,
  rankNumber,
  SUIT_CODES,
  type DayNight,
  type LegalPlay,
  type NumberCard,
  type SuitCode,
} from '@card-game-app/game-core';
import { canPass, canSelectCard, canSubmit, type HandSelection } from './handSelection';
import type { MatchConfig } from './matchConfig';
import type { DriverState, GamePhase } from './turnDriver';

/** パック非依存のカード描画データ。`CardFace`（Task 10）が受け取る唯一の入力。 */
export type CardFaceData = { rank: number; suitCode: SuitCode; isJoker: boolean };

export type OpponentView = {
  seatId: string;
  nameKey: string;
  numberCardCount: number;
  hasSkill: boolean;
  status: 'ACTIVE' | 'PASSED' | 'OUT';
  isActive: boolean;
};

export type FieldCardView = { rank: number; suitCode: SuitCode; isJoker: boolean };

export type FieldView = {
  cards: FieldCardView[];
  kind: 'SINGLE' | 'RANK_SET' | 'SEQUENCE';
  lastPlayerNameKey: string;
};

export type HandCardView = {
  cardId: string;
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  selected: boolean;
  selectable: boolean;
};

export type BoardViewModel = {
  phase: GamePhase;
  dayNight: DayNight;
  strengthOrder: number[];
  activeSeatId: string;
  activeSeatNameKey: string;
  field: FieldView | null;
  lock: { countLocked: boolean; suitFixed: SuitCode[] | null; suitUniform: boolean };
  extensionSealed: boolean;
  opponents: OpponentView[];
  humanSkillNameKey: string | null;
  hand: HandCardView[];
  canSubmit: boolean;
  canPass: boolean;
  cpuThinking: boolean;
  winnerSeatId: string | null;
  winnerNameKey: string | null;
};

const DAY_STRENGTH_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const NIGHT_STRENGTH_ORDER: readonly number[] = [9, 8, 7, 6, 5, 4, 3, 2, 1];

const UNLOCKED = { countLocked: false, suitFixed: null, suitUniform: false } as const;

function seatNameKey(config: MatchConfig, seatId: string | null): string | null {
  if (seatId == null) return null;
  return config.seats.find((s) => s.seatId === seatId)?.nameKey ?? null;
}

function cardFace(card: NumberCard): CardFaceData {
  return {
    rank: rankNumber(card.rankCode),
    suitCode: card.suitCode,
    isJoker: isTransformedJokerCard(card),
  };
}

function compareCards(a: NumberCard, b: NumberCard): number {
  const byRank = rankNumber(a.rankCode) - rankNumber(b.rankCode);
  if (byRank !== 0) return byRank;
  return SUIT_CODES.indexOf(a.suitCode) - SUIT_CODES.indexOf(b.suitCode);
}

export function buildBoardViewModel(
  state: DriverState,
  selection: HandSelection,
  legalPlays: LegalPlay[],
  opts?: { cpuThinking?: boolean },
): BoardViewModel {
  const { config, round } = state;
  const humanSeatId = config.seats.find((s) => s.kind === 'HUMAN')?.seatId ?? null;
  const humanPlayer = round.players.find((p) => p.playerId === humanSeatId) ?? null;

  const opponents: OpponentView[] = config.seats
    .filter((s) => s.kind === 'CPU')
    .map((seat) => {
      const player = round.players.find((p) => p.playerId === seat.seatId);
      return {
        seatId: seat.seatId,
        nameKey: seat.nameKey,
        numberCardCount: player?.hand.length ?? 0,
        hasSkill: player?.skill != null && !player.skill.used,
        status: player?.status ?? 'OUT',
        isActive: seat.seatId === round.activePlayerId,
      };
    });

  const field: FieldView | null =
    round.activeField == null
      ? null
      : {
          cards: round.activeField.combination.cards.map(cardFace),
          kind: round.activeField.combination.kind,
          lastPlayerNameKey: seatNameKey(config, round.activeField.lastPlayerId) ?? '',
        };

  const hand: HandCardView[] = (humanPlayer?.hand ?? [])
    .slice()
    .sort(compareCards)
    .map((card) => {
      const selected = selection.includes(card.cardId);
      return {
        cardId: card.cardId,
        rank: rankNumber(card.rankCode),
        suitCode: card.suitCode,
        isJoker: isTransformedJokerCard(card),
        selected,
        selectable: selected || canSelectCard(selection, card.cardId, legalPlays),
      };
    });

  const humanSkillNameKey =
    humanPlayer?.skill != null ? `sandbox.skill.${humanPlayer.skill.effectCode}` : null;

  return {
    phase: state.phase,
    dayNight: round.dayNight,
    strengthOrder: [...(round.dayNight === 'DAY' ? DAY_STRENGTH_ORDER : NIGHT_STRENGTH_ORDER)],
    activeSeatId: round.activePlayerId,
    activeSeatNameKey: seatNameKey(config, round.activePlayerId) ?? '',
    field,
    lock: round.activeField?.lock ?? { ...UNLOCKED },
    extensionSealed: round.extensionSealed,
    opponents,
    humanSkillNameKey,
    hand,
    canSubmit: canSubmit(selection, legalPlays),
    canPass: canPass(legalPlays),
    cpuThinking: opts?.cpuThinking ?? false,
    winnerSeatId: state.winnerSeatId,
    winnerNameKey: seatNameKey(config, state.winnerSeatId),
  };
}
