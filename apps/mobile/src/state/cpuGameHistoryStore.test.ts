import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { __resetAnonPlayerIdMemoForTest } from '../features/cpu-game/anonPlayerId';
import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  __resetCpuGameHistoryStoreForTest,
  configureCpuGameHistoryStore,
  cpuGameHistoryStore,
} from './cpuGameHistoryStore';

function storage(): StoragePort {
  return { getItem: async () => 'anon-1', setItem: async () => undefined };
}

beforeEach(() => {
  __resetAnonPlayerIdMemoForTest();
  __resetCpuGameHistoryStoreForTest();
});

describe('cpuGameHistoryStore', () => {
  it('loads history for the anon player', async () => {
    const http = {
      async get(url: string) {
        if (url.includes('practice_round_results')) {
          return {
            status: 200,
            body: JSON.stringify([
              {
                id: 'round-1',
                recorded_at: 'now',
                player_count: 2,
                local_won: false,
                turn_count: 3,
                ruleset_id: null,
              },
            ]),
          };
        }
        return { status: 200, body: JSON.stringify([{ round_result_id: 'round-1', events: [] }]) };
      },
    };
    configureCpuGameHistoryStore({
      storage: storage(),
      makeId: () => 'anon-new',
      http,
      supabaseUrl: 'u',
      anonKey: 'k',
    });

    await cpuGameHistoryStore.getState().load();

    assert.equal(cpuGameHistoryStore.getState().status, 'ready');
    assert.equal(cpuGameHistoryStore.getState().items.length, 1);
  });
});
