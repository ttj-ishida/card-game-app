import { createStore } from 'zustand/vanilla';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  serializeThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
} from '../features/theme/themePreference';

export type ThemeStoreStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type ThemeStoreState = {
  preference: ThemePreference;
  status: ThemeStoreStatus;
  load: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

export type ThemeStoreDeps = {
  storage: StoragePort;
};

let deps: ThemeStoreDeps | null = null;

export function configureThemeStore(next: ThemeStoreDeps): void {
  deps = next;
}

function requireDeps(): ThemeStoreDeps {
  if (!deps) {
    throw new Error('themeStore is not configured');
  }
  return deps;
}

export const themeStore = createStore<ThemeStoreState>((set) => ({
  preference: DEFAULT_THEME_PREFERENCE,
  status: 'idle',

  load: async () => {
    const d = requireDeps();
    set({ status: 'loading' });
    try {
      const raw = await d.storage.getItem(THEME_PREFERENCE_STORAGE_KEY);
      set({ preference: parseThemePreference(raw), status: 'ready' });
    } catch {
      set({ preference: DEFAULT_THEME_PREFERENCE, status: 'failed' });
    }
  },

  setPreference: async (preference) => {
    const d = requireDeps();
    set({ preference });
    try {
      await d.storage.setItem(THEME_PREFERENCE_STORAGE_KEY, serializeThemePreference(preference));
      set({ status: 'ready' });
    } catch {
      set({ status: 'failed' });
    }
  },
}));

export function __resetThemeStoreForTest(): void {
  deps = null;
  themeStore.setState({ preference: DEFAULT_THEME_PREFERENCE, status: 'idle' });
}
