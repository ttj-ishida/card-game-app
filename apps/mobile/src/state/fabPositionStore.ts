import { createStore } from 'zustand/vanilla';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  FAB_POSITION_STORAGE_KEY,
  parseFabPosition,
  serializeFabPosition,
  type FabPosition,
} from '../features/theme/fabPosition';

export type FabPositionStoreState = {
  position: FabPosition | null;
  load: () => Promise<void>;
  setPosition: (position: FabPosition) => Promise<void>;
};

export type FabPositionStoreDeps = { storage: StoragePort };

let deps: FabPositionStoreDeps | null = null;

export function configureFabPositionStore(next: FabPositionStoreDeps): void {
  deps = next;
}

function requireDeps(): FabPositionStoreDeps {
  if (!deps) throw new Error('fabPositionStore is not configured');
  return deps;
}

export const fabPositionStore = createStore<FabPositionStoreState>((set) => ({
  position: null,

  load: async () => {
    const d = requireDeps();
    try {
      set({ position: parseFabPosition(await d.storage.getItem(FAB_POSITION_STORAGE_KEY)) });
    } catch {
      set({ position: null });
    }
  },

  setPosition: async (position) => {
    const d = requireDeps();
    set({ position });
    try {
      await d.storage.setItem(FAB_POSITION_STORAGE_KEY, serializeFabPosition(position));
    } catch {
      // keep the optimistic value; it re-persists on the next drag
    }
  },
}));

export function __resetFabPositionStoreForTest(): void {
  deps = null;
  fabPositionStore.setState({ position: null });
}
