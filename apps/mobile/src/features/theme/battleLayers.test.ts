import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveBattleLayers } from './battleLayers.ts';
import type { BackgroundTable } from './resolveBackgroundSource.ts';

const table: BackgroundTable = {
  light: { battle: 1, home: 2, universal: 3 },
  dark: { battle: 4, home: 5, universal: 6 },
};

test('dark theme: base is dark battle, flip is light battle', () => {
  assert.deepEqual(resolveBattleLayers(table, 'dark'), { base: 4, flip: 1 });
});

test('light theme: base is light battle, flip is dark battle', () => {
  assert.deepEqual(resolveBattleLayers(table, 'light'), { base: 1, flip: 4 });
});
