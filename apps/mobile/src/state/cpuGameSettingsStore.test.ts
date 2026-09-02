import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import { CPU_GAME_SETTINGS_STORAGE_KEY } from '../features/cpu-game/cpuGameSettings';
import {
  __resetCpuGameSettingsStoreForTest,
  configureCpuGameSettingsStore,
  cpuGameSettingsStore,
} from './cpuGameSettingsStore';

function createFakeStorage(
  initial?: Record<string, string>,
): StoragePort & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}

beforeEach(() => {
  __resetCpuGameSettingsStoreForTest();
});

describe('cpuGameSettingsStore', () => {
  it('loads persisted settings from storage', async () => {
    const storage = createFakeStorage({
      [CPU_GAME_SETTINGS_STORAGE_KEY]: JSON.stringify({ animationSpeed: 'FAST', lowMotion: true }),
    });
    configureCpuGameSettingsStore({ storage });

    await cpuGameSettingsStore.getState().load();

    assert.deepEqual(cpuGameSettingsStore.getState().settings, {
      animationSpeed: 'FAST',
      lowMotion: true,
    });
    assert.equal(cpuGameSettingsStore.getState().status, 'ready');
  });

  it('persists animation speed and lowMotion changes immediately', async () => {
    const storage = createFakeStorage();
    configureCpuGameSettingsStore({ storage });

    await cpuGameSettingsStore.getState().setAnimationSpeed('SLOW');
    await cpuGameSettingsStore.getState().setLowMotion(true);

    assert.deepEqual(JSON.parse(storage.data.get(CPU_GAME_SETTINGS_STORAGE_KEY)!), {
      animationSpeed: 'SLOW',
      lowMotion: true,
    });
    assert.equal(cpuGameSettingsStore.getState().status, 'ready');
  });

  it('keeps the in-memory choice and marks failed when storage write fails', async () => {
    const storage: StoragePort = {
      async getItem() {
        return null;
      },
      async setItem() {
        throw new Error('disk full');
      },
    };
    configureCpuGameSettingsStore({ storage });

    await cpuGameSettingsStore.getState().setAnimationSpeed('FAST');

    assert.equal(cpuGameSettingsStore.getState().settings.animationSpeed, 'FAST');
    assert.equal(cpuGameSettingsStore.getState().status, 'failed');
  });
});
