import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveBackgroundSource, type BackgroundTable } from './resolveBackgroundSource.ts';

const table: BackgroundTable = {
  light: { battle: 1, home: 2, universal: 3 },
  dark: { battle: 4, home: 5, universal: 6 },
};

test('picks the cell for the given scheme x variant', () => {
  assert.equal(resolveBackgroundSource(table, 'light', 'battle'), 1);
  assert.equal(resolveBackgroundSource(table, 'light', 'home'), 2);
  assert.equal(resolveBackgroundSource(table, 'light', 'universal'), 3);
  assert.equal(resolveBackgroundSource(table, 'dark', 'battle'), 4);
  assert.equal(resolveBackgroundSource(table, 'dark', 'home'), 5);
  assert.equal(resolveBackgroundSource(table, 'dark', 'universal'), 6);
});
