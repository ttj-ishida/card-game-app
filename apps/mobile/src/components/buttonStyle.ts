import type { TextStyle, ViewStyle } from 'react-native';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

/** Restrained matte gold accent, shared by every kit component. Theme-neutral. */
export const ACCENT = '#C9A94E';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonVisual = { container: ViewStyle; text: TextStyle };

// #RRGGBB -> rgba(r, g, b, a)
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveButtonVisual(
  c: ThemeColors,
  variant: ButtonVariant,
  opts: { disabled: boolean; selected: boolean },
): ButtonVisual {
  const base: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  };
  const text: TextStyle = {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  };

  let container: ViewStyle;
  switch (variant) {
    case 'primary':
      container = { ...base, backgroundColor: c.ink.primary, borderColor: c.ink.primary };
      text.color = c.ink.inverse;
      break;
    case 'secondary':
      container = {
        ...base,
        backgroundColor: withAlpha(c.surface.card.face, 0.86),
        borderColor: ACCENT,
      };
      text.color = c.ink.primary;
      break;
    case 'ghost':
      container = { ...base };
      text.color = c.ink.secondary;
      break;
    case 'danger':
      container = {
        ...base,
        backgroundColor: withAlpha(c.surface.card.face, 0.86),
        borderColor: c.suit.fire,
      };
      text.color = c.suit.fire;
      break;
  }

  if (opts.selected) {
    container.borderColor = ACCENT;
    container.borderWidth = 2;
  }
  return { container, text };
}
