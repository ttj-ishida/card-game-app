import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import type { StoragePort } from '../features/cpu-game/anonPlayerId.ts';
import { THEME_PREFERENCE_STORAGE_KEY } from '../features/theme/themePreference.ts';
import { __resetThemeStoreForTest, configureThemeStore, themeStore } from './themeStore.ts';

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const calls: Array<[string, string]> = [];
  const storage: StoragePort = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      calls.push([k, v]);
      map.set(k, v);
    },
  };
  return { storage, calls, map };
}

beforeEach(() => __resetThemeStoreForTest());

test('load reads a stored preference', async () => {
  const { storage } = makeStorage({
    [THEME_PREFERENCE_STORAGE_KEY]: JSON.stringify({ preference: 'light' }),
  });
  configureThemeStore({ storage });
  await themeStore.getState().load();
  assert.equal(themeStore.getState().preference, 'light');
  assert.equal(themeStore.getState().status, 'ready');
});

test('load falls back to system + failed when storage throws', async () => {
  const storage: StoragePort = {
    getItem: async () => {
      throw new Error('boom');
    },
    setItem: async () => {},
  };
  configureThemeStore({ storage });
  await themeStore.getState().load();
  assert.equal(themeStore.getState().preference, 'system');
  assert.equal(themeStore.getState().status, 'failed');
});

test('setPreference updates state and persists the serialized value', async () => {
  const { storage, calls } = makeStorage();
  configureThemeStore({ storage });
  await themeStore.getState().setPreference('dark');
  assert.equal(themeStore.getState().preference, 'dark');
  assert.deepEqual(calls, [
    [THEME_PREFERENCE_STORAGE_KEY, JSON.stringify({ preference: 'dark' })],
  ]);
});

test('throws when used before configure', async () => {
  await assert.rejects(() => themeStore.getState().load(), /not configured/);
});
