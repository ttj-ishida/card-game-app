import { createStore } from 'zustand/vanilla';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  CPU_GAME_SETTINGS_STORAGE_KEY,
  DEFAULT_CPU_GAME_SETTINGS,
  parseCpuGameSettings,
  serializeCpuGameSettings,
  type AnimationSpeed,
  type CpuGameSettings,
} from '../features/cpu-game/cpuGameSettings';

export type CpuGameSettingsStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type CpuGameSettingsState = {
  settings: CpuGameSettings;
  status: CpuGameSettingsStatus;
  load: () => Promise<void>;
  setAnimationSpeed: (animationSpeed: AnimationSpeed) => Promise<void>;
  setLowMotion: (lowMotion: boolean) => Promise<void>;
};

export type CpuGameSettingsDeps = {
  storage: StoragePort;
};

let deps: CpuGameSettingsDeps | null = null;

export function configureCpuGameSettingsStore(next: CpuGameSettingsDeps): void {
  deps = next;
}

function requireDeps(): CpuGameSettingsDeps {
  if (!deps) {
    throw new Error('cpuGameSettingsStore is not configured');
  }
  return deps;
}

async function persist(settings: CpuGameSettings, storage: StoragePort): Promise<void> {
  await storage.setItem(CPU_GAME_SETTINGS_STORAGE_KEY, serializeCpuGameSettings(settings));
}

export const cpuGameSettingsStore = createStore<CpuGameSettingsState>((set, get) => ({
  settings: DEFAULT_CPU_GAME_SETTINGS,
  status: 'idle',

  load: async () => {
    const d = requireDeps();
    set({ status: 'loading' });
    try {
      const raw = await d.storage.getItem(CPU_GAME_SETTINGS_STORAGE_KEY);
      set({ settings: parseCpuGameSettings(raw), status: 'ready' });
    } catch {
      set({ settings: DEFAULT_CPU_GAME_SETTINGS, status: 'failed' });
    }
  },

  setAnimationSpeed: async (animationSpeed) => {
    const d = requireDeps();
    const settings = { ...get().settings, animationSpeed };
    set({ settings });
    try {
      await persist(settings, d.storage);
      set({ status: 'ready' });
    } catch {
      set({ status: 'failed' });
    }
  },

  setLowMotion: async (lowMotion) => {
    const d = requireDeps();
    const settings = { ...get().settings, lowMotion };
    set({ settings });
    try {
      await persist(settings, d.storage);
      set({ status: 'ready' });
    } catch {
      set({ status: 'failed' });
    }
  },
}));

export function __resetCpuGameSettingsStoreForTest(): void {
  deps = null;
  cpuGameSettingsStore.setState({
    settings: DEFAULT_CPU_GAME_SETTINGS,
    status: 'idle',
  });
}
