import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { __resetAnonPlayerIdMemoForTest } from '../features/cpu-game/anonPlayerId';
import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  __resetCpuGameStatsStoreForTest,
  configureCpuGameStatsStore,
  cpuGameStatsStore,
} from './cpuGameStatsStore';

function storage(): StoragePort {
  return { getItem: async () => 'anon-1', setItem: async () => undefined };
}

beforeEach(() => {
  __resetAnonPlayerIdMemoForTest();
  __resetCpuGameStatsStoreForTest();
});

describe('cpuGameStatsStore', () => {
  it('loads CPU stats for the anon player', async () => {
    const http = {
      async post(_url: string, _headers: Record<string, string>, _body: string) {
        return {
          status: 200,
          body: JSON.stringify([
            { rounds_played: 4, rounds_won: 1, win_rate: 0.25, last_played_at: null },
          ]),
        };
      },
    };
    configureCpuGameStatsStore({
      storage: storage(),
      makeId: () => 'anon-new',
      http,
      supabaseUrl: 'u',
      anonKey: 'k',
    });

    await cpuGameStatsStore.getState().load();

    assert.equal(cpuGameStatsStore.getState().status, 'ready');
    assert.equal(cpuGameStatsStore.getState().view.status, 'ready');
  });
});
