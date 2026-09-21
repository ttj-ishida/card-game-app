import { CARD_METRICS, cardHeight } from '../features/cpu-game/cardMetrics';

/** Rendered card-box widths — the single source of truth is `cardMetrics`. */
const FIELD_CARD_W = CARD_METRICS.field.width;
const MINI_CARD_W = CARD_METRICS.mini.width;
const CARD_GAP = 4;

/** A skill mini-card rendered alongside a step's number cards — same box as a number card. */
const FIELD_SKILL_W = CARD_METRICS.field.width;
const MINI_SKILL_W = CARD_METRICS.mini.width;

/** Card box height, used to size the ellipse around the latest play. */
const FIELD_CARD_H = cardHeight(CARD_METRICS.field.width);

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

/** Breathing room either side of the ellipse the internal layout is authored for. */
const LAYOUT_MARGIN = 28;

/**
 * The width `FieldTrail`'s internal positioning math is authored for — always
 * big enough for the stationary ellipse plus a little past-row space. On a
 * narrow phone the real container is smaller than this, so the whole trail
 * must be rendered at this width and scaled down to fit (see `fieldTrailScale`)
 * rather than reflowed, or the ellipse math (centred on this width) breaks.
 */
export const MIN_LAYOUT_WIDTH = ELLIPSE_SIZE.width + LAYOUT_MARGIN * 2;

/**
 * How to fit the fixed-size field trail into a container of `maxWidth`.
 * `layoutWidth` is what the internal ellipse/past-row math should use instead
 * of the real container width; `scale` is applied via `transform` to shrink
 * that layout down to actually fit. When `maxWidth` is already roomy enough,
 * this is a no-op (`layoutWidth === maxWidth`, `scale === 1`).
 */
export function fieldTrailScale(maxWidth: number): { layoutWidth: number; scale: number } {
  const layoutWidth = Math.max(maxWidth, MIN_LAYOUT_WIDTH);
  const scale = maxWidth > 0 ? Math.min(1, maxWidth / layoutWidth) : 1;
  return { layoutWidth, scale };
}

/** On-screen px width the self-play "pop" enlarge should read at. */
const SELF_POP_TARGET_W = 140;

/**
 * Scale factor for a `field`-size card so a self-played card's entrance pop
 * reads at a fixed, legible `SELF_POP_TARGET_W` on screen, regardless of how
 * much `fieldTrailScale`'s `scale` has already shrunk the whole trail down to
 * fit a narrow phone. Never shrinks below the card's normal size.
 */
export function selfPlayPopScale(outerScale: number): number {
  if (outerScale <= 0) return 1;
  return Math.max(1, SELF_POP_TARGET_W / (FIELD_CARD_W * outerScale));
}
