import type { SuitCode } from '@ragnarok-millennium/game-core';

import { cardArtAssets } from './cardArtAssets.generated';
import { SUIT_SLUG } from './cardMetrics';

/** Asset key for a number card, e.g. cardArtKey(3, 'SUIT_FIRE') -> 'card-3-fire'. */
export function cardArtKey(rank: number, suit: SuitCode): string {
  return `card-${rank}-${SUIT_SLUG[suit]}`;
}

/**
 * The bundled full-art image (a Metro `require()` id) for a number card, or
 * `null` when that artwork is not in the app yet. Entries are lazy thunks so the
 * generated map stays import-safe under `node --test`. `assets` is injectable
 * for tests; defaults to the generated map.
 */
export function resolveCardArt(
  rank: number,
  suit: SuitCode,
  assets: Partial<Record<string, () => number>> = cardArtAssets,
): number | null {
  const thunk = assets[cardArtKey(rank, suit)];
  return thunk ? thunk() : null;
}
