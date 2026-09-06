import type { ThemeScheme } from '@ragnarok-millennium/ui';

export type BackgroundVariant = 'battle' | 'home' | 'universal';

/** RN's `require()` for an image asset returns an opaque numeric handle. */
export type BackgroundTable = Record<ThemeScheme, Record<BackgroundVariant, number>>;

export function resolveBackgroundSource(
  table: BackgroundTable,
  scheme: ThemeScheme,
  variant: BackgroundVariant,
): number {
  return table[scheme][variant];
}
