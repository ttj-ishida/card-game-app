export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_STORAGE_KEY = 'card-game-app:theme-preference:v1';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

const PREFERENCES = new Set<ThemePreference>(['system', 'light', 'dark']);

export function parseThemePreference(raw: string | null): ThemePreference {
  if (!raw) return DEFAULT_THEME_PREFERENCE;
  try {
    const parsed = JSON.parse(raw) as { preference?: unknown };
    if (PREFERENCES.has(parsed.preference as ThemePreference)) {
      return parsed.preference as ThemePreference;
    }
    return DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function serializeThemePreference(preference: ThemePreference): string {
  return JSON.stringify({ preference });
}

export function resolveScheme(
  preference: ThemePreference,
  osScheme: 'light' | 'dark' | null,
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  return osScheme ?? 'dark';
}
