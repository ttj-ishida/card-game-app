/** Rough rendered widths (CardFace box + padding + border). */
const FIELD_CARD_W = 52;
const MINI_CARD_W = 42;
const CARD_GAP = 4;
const STEP_GAP = 16;

export function stepWidth(cardCount: number, isLatest: boolean): number {
  if (cardCount <= 0) return 0;
  const cw = isLatest ? FIELD_CARD_W : MINI_CARD_W;
  return cardCount * cw + (cardCount - 1) * CARD_GAP;
}

/**
 * Horizontal shift for the trail row so the last step (最終出し手) sits centred
 * in `containerWidth`; earlier steps trail off to the left.
 */
export function centerLatestOffset(cardCounts: number[], containerWidth: number): number {
  if (cardCounts.length === 0) return 0;
  const widths = cardCounts.map((n, i) => stepWidth(n, i === cardCounts.length - 1));
  const rowWidth = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * STEP_GAP;
  const lastCentre = rowWidth - widths[widths.length - 1] / 2;
  return Math.round(containerWidth / 2 - lastCentre);
}
