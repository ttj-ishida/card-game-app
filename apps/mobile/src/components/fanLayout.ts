export type FanSlot = { x: number; y: number; rotateDeg: number; z: number };

export type FanLayoutOptions = {
  /** Rendered card width in px. Default 46 (CardFace "hand" size). */
  cardWidth?: number;
  /** Container width the fan must fit inside. Default 320. */
  maxWidth?: number;
  /** Rotation of the outermost cards, in degrees. Default 16. */
  maxSpread?: number;
  /** How far the outer cards sink below the centre, in px. Default 18. */
  arc?: number;
};

/**
 * Arc positions for a hand of `count` cards, centred on x = 0.
 * `x` is each card's centre offset, `y` grows toward the edges, `rotateDeg` is
 * symmetric about the middle, `z` stacks left-to-right (rightmost on top).
 */
export function fanLayout(count: number, opts?: FanLayoutOptions): FanSlot[] {
  if (count <= 0) return [];
  const cardWidth = opts?.cardWidth ?? 46;
  const maxWidth = opts?.maxWidth ?? 320;
  const maxSpread = opts?.maxSpread ?? 16;
  const arc = opts?.arc ?? 18;

  if (count === 1) return [{ x: 0, y: 0, rotateDeg: 0, z: 0 }];

  const step = Math.min(cardWidth * 0.62, (maxWidth - cardWidth) / (count - 1));
  const mid = (count - 1) / 2;

  return Array.from({ length: count }, (_, i) => {
    const t = (i - mid) / mid; // -1 .. 1
    return {
      x: (i - mid) * step,
      y: arc * t * t,
      rotateDeg: t * maxSpread,
      z: i,
    };
  });
}
