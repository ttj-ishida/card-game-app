import {
  isTransformedJokerCard,
  rankNumber,
  SUIT_CODES,
  type DayNight,
  type LegalPlay,
  type NumberCard,
  type PlayInput,
  type RankCode,
  type SuitCode,
} from '@card-game-app/game-core';
import {
  canPass,
  canSelectCard,
  canSubmit,
  canSubmitPlain,
  type HandSelection,
} from './handSelection';
import {
  heldSkillEffect,
  jokerPreviewCard,
  legalMoveCount,
  resolveJokerTransform,
  revolutionPreview,
  selectionRejectionReasonKey,
  submitOptionsForSelection,
  type JokerDeclarationDraft,
  type PendingHumanSkill,
} from './skillPlayOptions';
import type { MatchConfig } from './matchConfig';
import type { DriverState, GamePhase, PublicRoundEvent, TurnActionKind } from './turnDriver';

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

/** 現在の場を作った一連のプレイ（リード〜現在）1手ぶん。全員に公開済みの情報のみ。 */
export type FieldTrailEntry = {
  index: number;
  seatNameKey: string;
  actionKind: TurnActionKind;
  cards: FieldCardView[];
  skillEffectKey: string | null;
};

export type FieldView = {
  cards: FieldCardView[];
  kind: 'SINGLE' | 'RANK_SET' | 'SEQUENCE';
  lastPlayerNameKey: string;
  /** リードから現在までに場へ出た各プレイ（古い順）。捨てられた更新前のカードも辿れる。 */
  trail: FieldTrailEntry[];
};

export type HandCardView = {
  cardId: string;
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  selected: boolean;
  selectable: boolean;
  selectionLocked?: boolean;
};

/**
 * 履歴パネル1行ぶんの表示データ。席名は `seatNameKey` を画面側で `translate()`。
 * `cards` / `skillEffectKey` は `publicEvents`（行動時点で全員に公開された情報のみ、
 * VIS-202）由来。非公開手札・未使用スキル・cardId は含まない。
 */
export type TurnLogLineView = {
  index: number;
  seatNameKey: string;
  kind: 'PLAY' | 'PASS';
  cardCount: number;
  actionKind: TurnActionKind;
  cards: FieldCardView[];
  skillEffectKey: string | null;
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

function eventCardViews(event: PublicRoundEvent | undefined): FieldCardView[] {
  return (event?.cards ?? []).map((c) => ({
    rank: rankNumber(c.rankCode),
    suitCode: c.suitCode,
    isJoker: false,
  }));
}

function skillEffectKey(effect: PublicRoundEvent['skillEffect']): string | null {
  return effect ? `sandbox.play.useSkill.${effect}` : null;
}

/**
 * 現在の場を作った一連のプレイ（直近のリード／場流しから現在まで、古い順）。
 * `publicEvents` を末尾から辿り、LEAD を含めたら停止。間の PASS は無視し、
 * 場流し（`fieldCleared`）の PASS 境界で停止する。
 */
function currentFieldTrail(
  publicEvents: readonly PublicRoundEvent[],
  config: MatchConfig,
): FieldTrailEntry[] {
  const trail: FieldTrailEntry[] = [];
  for (let i = publicEvents.length - 1; i >= 0; i -= 1) {
    const event = publicEvents[i];
    if (event.kind === 'PLAY') {
      trail.unshift({
        index: event.index,
        seatNameKey: seatNameKey(config, event.seatId) ?? '',
        actionKind: event.actionKind,
        cards: eventCardViews(event),
        skillEffectKey: skillEffectKey(event.skillEffect),
      });
      if (event.actionKind === 'LEAD') break;
    } else if (event.fieldCleared) {
      break;
    }
  }
  return trail;
}

function sameJokerDeclaration(
  input: PlayInput,
  pending: Extract<PendingHumanSkill, { useSkill: 'JOKER_TRANSFORM' }>,
): boolean {
  if (input.kind !== 'PLAY') return false;
  const declaration = input.jokerDeclarations?.[0];
  return (
    input.jokerDeclarations?.length === 1 &&
    declaration?.rankCode === pending.jokerDeclaration.rankCode &&
    declaration.suitCode === pending.jokerDeclaration.suitCode
  );
}

function legalPlaysForPendingSkill(
  legalPlays: LegalPlay[],
  pendingSkill: PendingHumanSkill | null,
): LegalPlay[] {
  if (!pendingSkill) {
    return legalPlays.filter(
      (play) => play.input.kind !== 'PLAY' || play.input.useSkill === undefined,
    );
  }
  return legalPlays.filter((play) => {
    if (play.input.kind !== 'PLAY' || play.input.useSkill !== pendingSkill.useSkill) return false;
    if (pendingSkill.useSkill !== 'JOKER_TRANSFORM') return true;
    return sameJokerDeclaration(play.input, pendingSkill);
  });
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
    pendingSkill?: PendingHumanSkill | null;
  },
): BoardViewModel {
  const { config, round } = state;
  const humanSeatId = config.seats.find((s) => s.kind === 'HUMAN')?.seatId ?? null;
  const pendingSkill = opts?.pendingSkill ?? null;
  const displayAsCleared = pendingSkill?.useSkill === 'JOKER_CLEAR';
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
    displayAsCleared || round.activeField == null
      ? null
      : {
          cards: round.activeField.combination.cards.map(cardFace),
          kind: round.activeField.combination.kind,
          lastPlayerNameKey: seatNameKey(config, round.activeField.lastPlayerId) ?? '',
          trail: currentFieldTrail(state.publicEvents, config),
        };

  const selectionLegalPlays = legalPlaysForPendingSkill(legalPlays, pendingSkill);

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
        selectable: selected || canSelectCard(selection, card.cardId, selectionLegalPlays),
      };
    });

  if (pendingSkill?.useSkill === 'JOKER_TRANSFORM') {
    hand.push({
      cardId: 'PENDING_JOKER_TRANSFORM',
      rank: rankNumber(pendingSkill.jokerDeclaration.rankCode),
      suitCode: pendingSkill.jokerDeclaration.suitCode,
      isJoker: true,
      selected: true,
      selectable: false,
      selectionLocked: true,
    });
  }

  const turnLog: TurnLogLineView[] = state.turnLog.map((entry, i) => {
    const event = state.publicEvents[i];
    return {
      index: entry.index,
      seatNameKey: seatNameKey(config, entry.seatId) ?? '',
      kind: entry.kind,
      cardCount: entry.cardCount,
      actionKind: entry.actionKind,
      cards: eventCardViews(event),
      skillEffectKey: skillEffectKey(event?.skillEffect ?? null),
    };
  });

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
  const availableSkillActions = skillPanel
    ? ([
        skillPanel.jokerClearAvailable ? 'JOKER_CLEAR' : null,
        skillPanel.sealAvailable ? 'EXTENSION_SEAL' : null,
        skillPanel.revolutionAvailable ? 'REVOLUTION' : null,
      ].filter(Boolean) as ('JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION')[])
    : [];
  const submitOptions = {
    plain: pendingSkill
      ? canSubmit(selection, selectionLegalPlays)
      : canSubmitPlain(selection, legalPlays),
    skills: (pendingSkill
      ? availableSkillActions
      : availableSkillActions.length > 0
        ? availableSkillActions
        : skillSubmit.map((s) => s.useSkill)
    ).map((useSkill) => ({
      useSkill,
      labelKey: `cpuGame.skill.submit.${useSkill}`,
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
    canConfirm: jtDraft.active && jtDraft.rankCode != null && jtDraft.suitCode != null,
    forbiddenGoOut: jtRes?.status === 'forbidden-go-out',
    rejectionReasonKey: jtRes?.status === 'illegal' ? jtRes.rejectionReasonKey : null,
    previewCard: jokerPreviewCard({ rankCode: jtDraft.rankCode, suitCode: jtDraft.suitCode }),
  };

  const selectionHint = {
    rejectionReasonKey: isHumanTurn
      ? selectionRejectionReasonKey(state, selection, selectionLegalPlays)
      : null,
    legalMoveCount: isHumanTurn ? legalMoveCount(selectionLegalPlays) : 0,
  };

  return {
    phase: state.phase,
    dayNight: round.dayNight,
    strengthOrder: [...(round.dayNight === 'DAY' ? DAY_STRENGTH_ORDER : NIGHT_STRENGTH_ORDER)],
    activeSeatId: round.activePlayerId,
    activeSeatNameKey: seatNameKey(config, round.activePlayerId) ?? '',
    field,
    lock: displayAsCleared ? { ...UNLOCKED } : (round.activeField?.lock ?? { ...UNLOCKED }),
    extensionSealed: displayAsCleared ? false : round.extensionSealed,
    opponents,
    turnLog,
    skillPanel,
    submitOptions,
    jokerTransform,
    selectionHint,
    hand,
    canSubmit: canSubmit(selection, selectionLegalPlays),
    canPass: pendingSkill ? false : canPass(legalPlays),
    cpuThinking: opts?.cpuThinking ?? false,
    winnerSeatId: state.winnerSeatId,
    winnerNameKey: seatNameKey(config, state.winnerSeatId),
  };
}
