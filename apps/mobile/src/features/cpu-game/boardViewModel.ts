import {
  isTransformedJokerCard,
  rankNumber,
  SUIT_CODES,
  type DayNight,
  type LegalPlay,
  type NumberCard,
  type RankCode,
  type SuitCode,
} from '@card-game-app/game-core';
import { canPass, canSelectCard, canSubmit, canSubmitPlain, type HandSelection } from './handSelection';
import {
  heldSkillEffect,
  jokerPreviewCard,
  legalMoveCount,
  resolveJokerTransform,
  revolutionPreview,
  selectionRejectionReasonKey,
  submitOptionsForSelection,
  type JokerDeclarationDraft,
} from './skillPlayOptions';
import type { MatchConfig } from './matchConfig';
import type { DriverState, GamePhase, TurnActionKind } from './turnDriver';

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

/**
 * 履歴パネル1行ぶんの表示データ。席名は `seatNameKey` を画面側で `translate()`。
 * カード内容は含めない（`TurnLogEntry` と同じく枚数のみ）。
 */
export type TurnLogLineView = {
  index: number;
  seatNameKey: string;
  kind: 'PLAY' | 'PASS';
  cardCount: number;
  actionKind: TurnActionKind;
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
  turnLog: TurnLogLineView[];
  humanSkillNameKey: string | null;
  skillPanel: {
    heldEffectKey: string;
    heldEffectDescKey: string;
    jokerClearAvailable: boolean;
    jokerTransformAvailable: boolean;
    sealAvailable: boolean;
    revolutionAvailable: boolean;
    revolutionPreview: { dayNightAfter: DayNight; strengthOrderAfter: number[] } | null;
  } | null;
  submitOptions: {
    plain: boolean;
    skills: { useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION'; labelKey: string }[];
  };
  jokerTransform: {
    active: boolean;
    rankCode: RankCode | null;
    suitCode: SuitCode | null;
    canConfirm: boolean;
    forbiddenGoOut: boolean;
    rejectionReasonKey: string | null;
    previewCard: { rank: number; suitCode: SuitCode } | null;
  };
  selectionHint: {
    rejectionReasonKey: string | null;
    legalMoveCount: number;
  };
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
  opts?: {
    cpuThinking?: boolean;
    jokerTransform?: { active: boolean } & JokerDeclarationDraft;
  },
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

  const turnLog: TurnLogLineView[] = state.turnLog.map((entry) => ({
    index: entry.index,
    seatNameKey: seatNameKey(config, entry.seatId) ?? '',
    kind: entry.kind,
    cardCount: entry.cardCount,
    actionKind: entry.actionKind,
  }));

  const humanSkillNameKey =
    humanPlayer?.skill != null ? `sandbox.skill.${humanPlayer.skill.effectCode}` : null;

  const isHumanTurn = state.phase === 'HUMAN_TURN';
  const heldEffect = heldSkillEffect(state);
  const jtDraft = opts?.jokerTransform ?? { active: false, rankCode: null, suitCode: null };

  const isJoker = heldEffect === 'SKILL_JOKER_HERO' || heldEffect === 'SKILL_JOKER_SAINT';
  const skillPanel =
    isHumanTurn && heldEffect != null
      ? {
          heldEffectKey: `sandbox.skill.${heldEffect}`,
          heldEffectDescKey: `cpuGame.skill.effect.${heldEffect}`,
          jokerClearAvailable: isJoker && round.activeField != null,
          jokerTransformAvailable: isJoker,
          sealAvailable: heldEffect === 'SKILL_EXTENSION_SEAL',
          revolutionAvailable: heldEffect === 'SKILL_REVOLUTION',
          revolutionPreview: heldEffect === 'SKILL_REVOLUTION' ? revolutionPreview(state) : null,
        }
      : null;

  const skillSubmit = submitOptionsForSelection(legalPlays, selection);
  const submitOptions = {
    plain: canSubmitPlain(selection, legalPlays),
    skills: skillSubmit.map((s) => ({
      useSkill: s.useSkill,
      labelKey: `cpuGame.skill.submit.${s.useSkill}`,
    })),
  };

  const jtRes = jtDraft.active
    ? resolveJokerTransform(state, selection, {
        rankCode: jtDraft.rankCode,
        suitCode: jtDraft.suitCode,
      })
    : null;
  const jokerTransform = {
    active: jtDraft.active,
    rankCode: jtDraft.rankCode,
    suitCode: jtDraft.suitCode,
    canConfirm: jtRes?.status === 'ok',
    forbiddenGoOut: jtRes?.status === 'forbidden-go-out',
    rejectionReasonKey: jtRes?.status === 'illegal' ? jtRes.rejectionReasonKey : null,
    previewCard: jokerPreviewCard({ rankCode: jtDraft.rankCode, suitCode: jtDraft.suitCode }),
  };

  const selectionHint = {
    rejectionReasonKey: isHumanTurn
      ? selectionRejectionReasonKey(state, selection, legalPlays)
      : null,
    legalMoveCount: isHumanTurn ? legalMoveCount(legalPlays) : 0,
  };

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
    turnLog,
    humanSkillNameKey,
    skillPanel,
    submitOptions,
    jokerTransform,
    selectionHint,
    hand,
    canSubmit: canSubmit(selection, legalPlays),
    canPass: canPass(legalPlays),
    cpuThinking: opts?.cpuThinking ?? false,
    winnerSeatId: state.winnerSeatId,
    winnerNameKey: seatNameKey(config, state.winnerSeatId),
  };
}
