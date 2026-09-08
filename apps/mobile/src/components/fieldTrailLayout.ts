/** Rough rendered widths (CardFace box + padding + border). */
const FIELD_CARD_W = 52;
const MINI_CARD_W = 42;
const CARD_GAP = 4;

/** A skill mini-card rendered alongside a step's number cards. */
const FIELD_SKILL_W = 64;
const MINI_SKILL_W = 52;

/** Card box height, used to size the ellipse around the latest play. */
const FIELD_CARD_H = 46;

/** Padding between the latest play's cards and the surrounding ellipse. */
const ELLIPSE_PAD_X = 24;
const ELLIPSE_PAD_Y = 18;

/** Largest combination in the game (four same-rank cards) plus a skill card. */
const ELLIPSE_MAX_CARDS = 4;

/**
 * Fixed size of the ellipse around the latest play (最終出し手). It does NOT
 * resize per play and does NOT move — always big enough for the largest
 * combination (4 cards) plus a skill mini-card, so a single-card play and a
 * four-card play share the same, stationary frame.
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

/** Rendered width of one trail step's cards (+ optional skill mini-card). */
export function stepWidth(cardCount: number, isLatest: boolean, hasSkill = false): number {
  if (cardCount <= 0 && !hasSkill) return 0;
  const cw = isLatest ? FIELD_CARD_W : MINI_CARD_W;
  const sw = isLatest ? FIELD_SKILL_W : MINI_SKILL_W;
  const cards = cardCount * cw + Math.max(0, cardCount - 1) * CARD_GAP;
  const skill = hasSkill ? (cardCount > 0 ? CARD_GAP : 0) + sw : 0;
  return cards + skill;
}
