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
const ELLIPSE_PAD_X = 24;
const ELLIPSE_PAD_Y = 18;

/** Largest combination in the game (four same-rank cards) plus a skill card. */
const ELLIPSE_MAX_CARDS = 4;

/**
 * Fixed size of the ellipse around the latest play (最終出し手). It does NOT
 * resize per play — always big enough for the largest combination (4 cards)
 * plus a skill mini-card, so a single-card play and a four-card play share the
 * same frame.
 */
export const ELLIPSE_SIZE: { width: number; height: number } = {
  width:
    ELLIPSE_MAX_CARDS * FIELD_CARD_W +
    (ELLIPSE_MAX_CARDS - 1) * CARD_GAP +
    CARD_GAP +
    FIELD_SKILL_W +
    ELLIPSE_PAD_X * 2,
  height: FIELD_CARD_H + ELLIPSE_PAD_Y * 2,
};

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
 * Horizontal shift for the trail row so the last step (最終出し手) — i.e. the
 * fixed ellipse — sits centred in `containerWidth`; earlier steps trail off to
 * the left.
 */
export function centerLatestOffset(steps: TrailStepShape[], containerWidth: number): number {
  if (steps.length === 0) return 0;
  const widths = steps.map((s, i) =>
    i === steps.length - 1 ? ELLIPSE_SIZE.width : stepWidth(s.cardCount, false, s.hasSkill),
  );
  const rowWidth = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * STEP_GAP;
  const lastCentre = rowWidth - widths[widths.length - 1] / 2;
  return Math.round(containerWidth / 2 - lastCentre);
}
