import type { BackgroundTable } from './resolveBackgroundSource';
import { resolveBackgroundSource } from './resolveBackgroundSource';
import type { ThemeScheme } from '@ragnarok-millennium/ui';

/**
 * The two battle backdrops to cross-fade. `base` is the current theme's battle
 * art; `flip` is the opposite theme's — reached during a revolution (the game's
 * day/night literally inverts).
 */
export function resolveBattleLayers(
  table: BackgroundTable,
  scheme: ThemeScheme,
): { base: number; flip: number } {
  const other: ThemeScheme = scheme === 'dark' ? 'light' : 'dark';
  return {
    base: resolveBackgroundSource(table, scheme, 'battle'),
    flip: resolveBackgroundSource(table, other, 'battle'),
  };
}
