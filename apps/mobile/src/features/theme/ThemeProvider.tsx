import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from 'zustand/react';

import { themeColors, type ThemeColors, type ThemeScheme } from '@ragnarok-millennium/ui';

import { resolveScheme, type ThemePreference } from './themePreference';
import { themeStore } from '../../state/themeStore';

export type ThemeContextValue = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  preference: ThemePreference;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const os = useColorScheme();
  const osScheme: 'light' | 'dark' | null = os === 'dark' || os === 'light' ? os : null;
  const preference = useStore(themeStore, (s) => s.preference);
  const scheme = resolveScheme(preference, osScheme);
  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: themeColors[scheme], preference }),
    [scheme, preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }
  return ctx;
}

/**
 * Build a themed StyleSheet. `factory` receives the active palette and should
 * return a `StyleSheet.create({...})` result. The sheet is rebuilt only when
 * the active scheme changes.
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { scheme, colors } = useTheme();
  // `colors` is a stable reference per scheme and `factory` is defined at
  // module scope, so keying the memo on `scheme` alone is correct.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(colors), [scheme]);
}
