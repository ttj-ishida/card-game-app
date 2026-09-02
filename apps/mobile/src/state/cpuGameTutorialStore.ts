import { createStore } from 'zustand/vanilla';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  CPU_GAME_TUTORIAL_STORAGE_KEY,
  DEFAULT_TUTORIAL_PROGRESS,
  parseTutorialProgress,
  serializeTutorialProgress,
  type TutorialProgress,
} from '../features/cpu-game/tutorialModel';

export type CpuGameTutorialStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type CpuGameTutorialState = {
  progress: TutorialProgress;
  status: CpuGameTutorialStatus;
  load: () => Promise<void>;
  complete: () => Promise<void>;
  reset: () => Promise<void>;
};

export type CpuGameTutorialDeps = {
  storage: StoragePort;
  now: () => number;
};

let deps: CpuGameTutorialDeps | null = null;

export function configureCpuGameTutorialStore(next: CpuGameTutorialDeps): void {
  deps = next;
}

function requireDeps(): CpuGameTutorialDeps {
  if (!deps) {
    throw new Error('cpuGameTutorialStore is not configured');
  }
  return deps;
}

export const cpuGameTutorialStore = createStore<CpuGameTutorialState>((set) => ({
  progress: DEFAULT_TUTORIAL_PROGRESS,
  status: 'idle',

  load: async () => {
    const d = requireDeps();
    set({ status: 'loading' });
    try {
      const raw = await d.storage.getItem(CPU_GAME_TUTORIAL_STORAGE_KEY);
      set({ progress: parseTutorialProgress(raw), status: 'ready' });
    } catch {
      set({ progress: DEFAULT_TUTORIAL_PROGRESS, status: 'failed' });
    }
  },

  complete: async () => {
    const d = requireDeps();
    const raw = serializeTutorialProgress(d.now());
    const progress = parseTutorialProgress(raw);
    try {
      await d.storage.setItem(CPU_GAME_TUTORIAL_STORAGE_KEY, raw);
      set({ progress, status: 'ready' });
    } catch {
      set({ status: 'failed' });
    }
  },

  reset: async () => {
    const d = requireDeps();
    try {
      await d.storage.setItem(
        CPU_GAME_TUTORIAL_STORAGE_KEY,
        JSON.stringify(DEFAULT_TUTORIAL_PROGRESS),
      );
      set({ progress: DEFAULT_TUTORIAL_PROGRESS, status: 'ready' });
    } catch {
      set({ status: 'failed' });
    }
  },
}));

export function __resetCpuGameTutorialStoreForTest(): void {
  deps = null;
  cpuGameTutorialStore.setState({
    progress: DEFAULT_TUTORIAL_PROGRESS,
    status: 'idle',
  });
}
