import type { ThemeScheme } from '@ragnarok-millennium/ui';

import { fieldStageAssets } from './fieldStageAssets.generated';

/** Asset key for the field-stage backdrop, e.g. fieldStageKey('dark') -> 'field-stage-dark'. */
export function fieldStageKey(scheme: ThemeScheme): string {
  return `field-stage-${scheme}`;
}

/**
 * The bundled field-stage backdrop image (a Metro `require()` id) for the
 * given theme scheme, or `null` when that artwork is not in the app yet (the
 * caller falls back to the vector ellipse). `assets` is injectable for tests;
 * defaults to the generated map.
 */
export function resolveFieldStageArt(
  scheme: ThemeScheme,
  assets: Partial<Record<string, () => number>> = fieldStageAssets,
): number | null {
  const thunk = assets[fieldStageKey(scheme)];
  return thunk ? thunk() : null;
}

/**
 * The two field-stage layers to cross-fade during a revolution, mirroring
 * `resolveBattleLayers`. `base` is the current scheme's art; `flip` is the
 * opposite scheme's — reached when the game's day/night inverts.
 */
export function resolveFieldStageLayers(
  scheme: ThemeScheme,
  assets: Partial<Record<string, () => number>> = fieldStageAssets,
): { base: number | null; flip: number | null } {
  const other: ThemeScheme = scheme === 'dark' ? 'light' : 'dark';
  return {
    base: resolveFieldStageArt(scheme, assets),
    flip: resolveFieldStageArt(other, assets),
  };
}
