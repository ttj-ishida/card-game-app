import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import type { StoragePort } from '../features/cpu-game/anonPlayerId.ts';
import { FAB_POSITION_STORAGE_KEY } from '../features/theme/fabPosition.ts';
import {
  __resetFabPositionStoreForTest,
  configureFabPositionStore,
  fabPositionStore,
} from './fabPositionStore.ts';

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const calls: [string, string][] = [];
  const storage: StoragePort = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      calls.push([k, v]);
      map.set(k, v);
    },
  };
  return { storage, calls };
}

beforeEach(() => __resetFabPositionStoreForTest());

test('load reads a stored position', async () => {
  const { storage } = makeStorage({
    [FAB_POSITION_STORAGE_KEY]: JSON.stringify({ x: 100, y: 200 }),
  });
  configureFabPositionStore({ storage });
  await fabPositionStore.getState().load();
  assert.deepEqual(fabPositionStore.getState().position, { x: 100, y: 200 });
});

test('load with nothing stored keeps null (default position)', async () => {
  const { storage } = makeStorage();
  configureFabPositionStore({ storage });
  await fabPositionStore.getState().load();
  assert.equal(fabPositionStore.getState().position, null);
});

test('setPosition updates state and persists rounded', async () => {
  const { storage, calls } = makeStorage();
  configureFabPositionStore({ storage });
  await fabPositionStore.getState().setPosition({ x: 12.6, y: 40.1 });
  assert.deepEqual(fabPositionStore.getState().position, { x: 12.6, y: 40.1 });
  assert.deepEqual(calls, [[FAB_POSITION_STORAGE_KEY, JSON.stringify({ x: 13, y: 40 })]]);
});

test('throws before configure', async () => {
  await assert.rejects(() => fabPositionStore.getState().load(), /not configured/);
});
