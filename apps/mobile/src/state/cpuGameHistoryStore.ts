import { createStore } from 'zustand/vanilla';

import { getAnonPlayerId, type StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  fetchCpuGameHistory,
  type HistoryHttpPort,
  type HistoryRoundView,
} from '../features/cpu-game/historyModel';

export type CpuGameHistoryStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'failed';

export type CpuGameHistoryDeps = {
  storage: StoragePort;
  makeId: () => string;
  http: HistoryHttpPort;
  supabaseUrl: string;
  anonKey: string;
};

export type CpuGameHistoryState = {
  status: CpuGameHistoryStatus;
  items: HistoryRoundView[];
  load(): Promise<void>;
};

let deps: CpuGameHistoryDeps | undefined;

const initialState = {
  status: 'idle' as CpuGameHistoryStatus,
  items: [] as HistoryRoundView[],
};

export function configureCpuGameHistoryStore(next: CpuGameHistoryDeps | undefined): void {
  deps = next;
}

function requireDeps(): CpuGameHistoryDeps {
  if (!deps) {
    throw new Error(
      'cpuGameHistoryStore is not configured: call configureCpuGameHistoryStore(deps) before using the store',
    );
  }
  return deps;
}

export const cpuGameHistoryStore = createStore<CpuGameHistoryState>((set) => ({
  ...initialState,

  async load() {
    const d = requireDeps();
    set({ status: 'loading' });
    try {
      const anonPlayerId = await getAnonPlayerId({ storage: d.storage, makeId: d.makeId });
      const result = await fetchCpuGameHistory(anonPlayerId, d);
      set({ status: result.status, items: result.items });
    } catch {
      set({ status: 'failed', items: [] });
    }
  },
}));

export function __resetCpuGameHistoryStoreForTest(): void {
  deps = undefined;
  cpuGameHistoryStore.setState(initialState);
}
