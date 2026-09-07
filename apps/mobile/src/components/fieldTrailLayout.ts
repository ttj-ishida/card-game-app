/** Rough rendered widths (CardFace box + padding + border). */
const FIELD_CARD_W = 52;
const MINI_CARD_W = 42;
const CARD_GAP = 4;
const STEP_GAP = 16;

/** A skill mini-card rendered alongside a step's number cards. */
const FIELD_SKILL_W = 64;
const MINI_SKILL_W = 52;

/** Card box heights, used to size the ellipse around the latest play. */
const FIELD_CARD_H = 46;

/** Padding between the latest play's cards and the surrounding ellipse. */
const ELLIPSE_PAD_X = 26;
const ELLIPSE_PAD_Y = 20;

export type TrailStepShape = { cardCount: number; hasSkill: boolean };

export function stepWidth(cardCount: number, isLatest: boolean, hasSkill = false): number {
  if (cardCount <= 0 && !hasSkill) return 0;
  const cw = isLatest ? FIELD_CARD_W : MINI_CARD_W;
  const sw = isLatest ? FIELD_SKILL_W : MINI_SKILL_W;
  const cards = cardCount * cw + Math.max(0, cardCount - 1) * CARD_GAP;
  const skill = hasSkill ? (cardCount > 0 ? CARD_GAP : 0) + sw : 0;
  return cards + skill;
}

/**
 * Size of the ellipse drawn around the latest play (最終出し手). Grows with the
 * number of cards — and the skill mini-card, when present — so an EXTEND
 * (e.g. 6→66→666) or a skill play stays fully enclosed.
 */
export function ellipseSize(
  latestCardCount: number,
  hasSkill = false,
): { width: number; height: number } {
  const cards = Math.max(1, latestCardCount);
  return {
    width: stepWidth(cards, true, hasSkill) + ELLIPSE_PAD_X * 2,
    height: FIELD_CARD_H + ELLIPSE_PAD_Y * 2,
  };
}

/**
 * Horizontal shift for the trail row so the last step (最終出し手) sits centred
 * in `containerWidth`; earlier steps trail off to the left.
 */
export function centerLatestOffset(steps: TrailStepShape[], containerWidth: number): number {
  if (steps.length === 0) return 0;
  const widths = steps.map((s, i) => stepWidth(s.cardCount, i === steps.length - 1, s.hasSkill));
  const rowWidth = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * STEP_GAP;
  const lastCentre = rowWidth - widths[widths.length - 1] / 2;
  return Math.round(containerWidth / 2 - lastCentre);
}
