import { createStore } from 'zustand/vanilla';

import { getAnonPlayerId, type StoragePort } from '../features/cpu-game/anonPlayerId';
import { fetchCpuGameStats, type StatsView } from '../features/cpu-game/statsModel';
import type { HttpPort } from '../features/cpu-game/practiceResultSync';

export type CpuGameStatsStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'failed';

export type CpuGameStatsDeps = {
  storage: StoragePort;
  makeId: () => string;
  http: HttpPort;
  supabaseUrl: string;
  anonKey: string;
};

export type CpuGameStatsState = {
  status: CpuGameStatsStatus;
  view: StatsView;
  load(): Promise<void>;
};

let deps: CpuGameStatsDeps | undefined;

const emptyView: StatsView = { status: 'empty' };
const initialState = {
  status: 'idle' as CpuGameStatsStatus,
  view: emptyView,
};

export function configureCpuGameStatsStore(next: CpuGameStatsDeps | undefined): void {
  deps = next;
}

function requireDeps(): CpuGameStatsDeps {
  if (!deps) {
    throw new Error(
      'cpuGameStatsStore is not configured: call configureCpuGameStatsStore(deps) before using the store',
    );
  }
  return deps;
}

export const cpuGameStatsStore = createStore<CpuGameStatsState>((set) => ({
  ...initialState,

  async load() {
    const d = requireDeps();
    set({ status: 'loading' });
    try {
      const anonPlayerId = await getAnonPlayerId({ storage: d.storage, makeId: d.makeId });
      const view = await fetchCpuGameStats(anonPlayerId, d);
      set({ status: view.status, view: view.status === 'failed' ? emptyView : view });
    } catch {
      set({ status: 'failed', view: emptyView });
    }
  },
}));

export function __resetCpuGameStatsStoreForTest(): void {
  deps = undefined;
  cpuGameStatsStore.setState(initialState);
}
