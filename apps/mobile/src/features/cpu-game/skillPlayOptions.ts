import {
  rankNumber,
  rankStrength,
  resolvePlay,
  type DayNight,
  type LegalPlay,
  type PlayInput,
  type RankCode,
  type SkillEffectCode,
  type SuitCode,
} from '@card-game-app/game-core';
import type { HandSelection } from './handSelection';
import type { DriverState } from './turnDriver';

export type SkillSubmitOption = {
  useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION';
  input: PlayInput;
};

export type JokerDeclarationDraft = { rankCode: RankCode | null; suitCode: SuitCode | null };

export type JokerTransformResolution =
  | { status: 'ok'; input: PlayInput }
  | { status: 'forbidden-go-out' }
  | { status: 'illegal'; rejectionReasonKey: string }
  | { status: 'incomplete' };

const RANKS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function humanSeatId(state: DriverState): string {
  return state.config.seats.find((s) => s.kind === 'HUMAN')?.seatId ?? state.round.activePlayerId;
}

/** 手番の人間が未使用で保有するスキルの effectCode。無ければ null。 */
export function heldSkillEffect(state: DriverState): SkillEffectCode | null {
  const human = state.round.players.find((p) => p.playerId === humanSeatId(state));
  return human?.skill && !human.skill.used ? human.skill.effectCode : null;
}

function exactMatch(cardIds: readonly string[], sel: Set<string>): boolean {
  return cardIds.length === sel.size && cardIds.every((id) => sel.has(id));
}

/** 選択札 == cardIds の合法スキル手（JOKER_TRANSFORM を除く）を種別ごとに1件。 */
export function submitOptionsForSelection(
  legalPlays: LegalPlay[],
  selection: HandSelection,
): SkillSubmitOption[] {
  const sel = new Set(selection);
  const out: SkillSubmitOption[] = [];
  for (const p of legalPlays) {
    if (p.input.kind !== 'PLAY') continue;
    const use = p.input.useSkill;
    if (use !== 'JOKER_CLEAR' && use !== 'EXTENSION_SEAL' && use !== 'REVOLUTION') continue;
    if (!exactMatch(p.input.cardIds, sel)) continue;
    if (out.some((o) => o.useSkill === use)) continue;
    out.push({ useSkill: use, input: p.input });
  }
  return out;
}

/** 変化Joker：選択実カード + 宣言 draft から JOKER_TRANSFORM 手を組み resolvePlay で判定。 */
export function resolveJokerTransform(
  state: DriverState,
  selection: HandSelection,
  draft: JokerDeclarationDraft,
): JokerTransformResolution {
  if (draft.rankCode == null || draft.suitCode == null) return { status: 'incomplete' };
  const seatId = humanSeatId(state);
  const human = state.round.players.find((p) => p.playerId === seatId);
  if (!human?.skill || human.skill.used) {
    return { status: 'illegal', rejectionReasonKey: 'sandbox.reason.SKILL_NOT_AVAILABLE' };
  }
  const input: PlayInput = {
    kind: 'PLAY',
    playerId: seatId,
    cardIds: [...selection],
    useSkill: 'JOKER_TRANSFORM',
    jokerDeclarations: [
      { skillId: human.skill.skillId, rankCode: draft.rankCode, suitCode: draft.suitCode },
    ],
  };
  const res = resolvePlay(state.round, input);
  if (res.ok) return { status: 'ok', input };
  if (res.reason === 'TRANSFORM_JOKER_GO_OUT') return { status: 'forbidden-go-out' };
  return { status: 'illegal', rejectionReasonKey: `sandbox.reason.${res.reason}` };
}

/** 革命併用時のプレビュー（表示のみ）。 */
export function revolutionPreview(state: DriverState): {
  dayNightAfter: DayNight;
  strengthOrderAfter: number[];
} {
  const dayNightAfter: DayNight = state.round.dayNight === 'DAY' ? 'NIGHT' : 'DAY';
  const strengthOrderAfter = [...RANKS].sort(
    (a, b) => rankStrength(a, dayNightAfter) - rankStrength(b, dayNightAfter),
  );
  return { dayNightAfter, strengthOrderAfter };
}

/** 素の数字手（useSkill なし）の distinct cardId 集合の数。 */
export function legalMoveCount(legalPlays: LegalPlay[]): number {
  const sets = new Set<string>();
  for (const p of legalPlays) {
    if (p.input.kind === 'PLAY' && p.input.useSkill === undefined) {
      sets.add([...p.input.cardIds].sort().join(','));
    }
  }
  return sets.size;
}

/** 選択が素でもスキルでも提出できないときの理由キー（M3-EX-07）。 */
export function selectionRejectionReasonKey(
  state: DriverState,
  selection: HandSelection,
  legalPlays: LegalPlay[],
): string | null {
  if (selection.length === 0) return null;
  const sel = new Set(selection);
  const matchesAny = legalPlays.some(
    (p) => p.input.kind === 'PLAY' && exactMatch(p.input.cardIds, sel),
  );
  if (matchesAny) return null;
  const res = resolvePlay(state.round, {
    kind: 'PLAY',
    playerId: humanSeatId(state),
    cardIds: [...selection],
  });
  if (res.ok) return null;
  return `sandbox.reason.${res.reason}`;
}

/** 宣言 draft からプレビュー用の { rank, suitCode }。未完なら null。 */
export function jokerPreviewCard(
  draft: JokerDeclarationDraft,
): { rank: number; suitCode: SuitCode } | null {
  if (draft.rankCode == null || draft.suitCode == null) return null;
  return { rank: rankNumber(draft.rankCode), suitCode: draft.suitCode };
}
