import type { SuitCode } from '@ragnarok-millennium/game-core';

/** Where a card is being rendered. Drives its pixel size. */
export type CardFaceSize = 'catalog' | 'hand' | 'field' | 'mini';

/** height / width for the 5:7 card. */
export const CARD_ASPECT = 7 / 5;

/**
 * Rendered card width (px) per context — the single source of truth. Consumers
 * (`CardFace`, `HandFan`, `fieldTrailLayout`, `SkillMiniCard`) import from here
 * instead of defining their own. Starting values; tune against the 16:9 web
 * frame during implementation and ship the tuned numbers.
 */
export const CARD_METRICS: Record<CardFaceSize, { width: number }> = {
  catalog: { width: 240 },
  hand: { width: 68 },
  field: { width: 80 },
  mini: { width: 46 },
};

export const cardHeight = (width: number): number => Math.round(width * CARD_ASPECT);

/**
 * At or below this rendered width, `CardFace` draws a code rank badge + suit
 * emblem over baked art so the card stays readable in battle.
 */
export const OVERLAY_BELOW_WIDTH = 120;

/** UI-A11Y-002: suit is shown by shape, never colour alone. */
export const SUIT_SYMBOL: Record<SuitCode, string> = {
  SUIT_FIRE: '▲',
  SUIT_WATER: '●',
  SUIT_WIND: '✦',
  SUIT_EARTH: '■',
};
