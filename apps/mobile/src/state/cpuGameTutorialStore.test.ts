import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import { CPU_GAME_TUTORIAL_STORAGE_KEY } from '../features/cpu-game/tutorialModel';
import {
  __resetCpuGameTutorialStoreForTest,
  configureCpuGameTutorialStore,
  cpuGameTutorialStore,
} from './cpuGameTutorialStore';

function memoryStorage(
  initial = new Map<string, string>(),
): StoragePort & { map: Map<string, string> } {
  return {
    map: initial,
    getItem: async (key) => initial.get(key) ?? null,
    setItem: async (key, value) => {
      initial.set(key, value);
    },
  };
}

beforeEach(() => {
  __resetCpuGameTutorialStoreForTest();
});

describe('cpuGameTutorialStore', () => {
  it('loads a missing progress record as incomplete', async () => {
    configureCpuGameTutorialStore({ storage: memoryStorage(), now: () => 0 });

    await cpuGameTutorialStore.getState().load();

    assert.equal(cpuGameTutorialStore.getState().status, 'ready');
    assert.equal(cpuGameTutorialStore.getState().progress.completed, false);
  });

  it('completes tutorial only after storage succeeds', async () => {
    const storage = memoryStorage();
    configureCpuGameTutorialStore({
      storage,
      now: () => Date.UTC(2026, 8, 2, 0, 0, 0),
    });

    await cpuGameTutorialStore.getState().complete();

    assert.equal(cpuGameTutorialStore.getState().status, 'ready');
    assert.equal(cpuGameTutorialStore.getState().progress.completed, true);
    assert.deepEqual(JSON.parse(storage.map.get(CPU_GAME_TUTORIAL_STORAGE_KEY) ?? ''), {
      completed: true,
      completedAt: '2026-09-02T00:00:00.000Z',
    });
  });

  it('keeps previous progress when completion persistence fails', async () => {
    const storage: StoragePort = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('disk full');
      },
    };
    configureCpuGameTutorialStore({ storage, now: () => 0 });

    await cpuGameTutorialStore.getState().complete();

    assert.equal(cpuGameTutorialStore.getState().status, 'failed');
    assert.equal(cpuGameTutorialStore.getState().progress.completed, false);
  });
});
