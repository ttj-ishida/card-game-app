import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NAV_ITEMS, visibleNavItems } from './navItems.ts';

test('NAV_ITEMS covers the primary destinations', () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.key),
    ['home', 'cpu', 'online', 'catalog', 'sandbox', 'settings', 'diagnostics'],
  );
});

test('production hides dev-only entries', () => {
  const prod = visibleNavItems(NAV_ITEMS, true);
  assert.equal(prod.length, 6);
  assert.ok(!prod.some((i) => i.devOnly));
});

test('non-production keeps everything, in order', () => {
  const dev = visibleNavItems(NAV_ITEMS, false);
  assert.equal(dev.length, 7);
  assert.deepEqual(
    dev.map((i) => i.key),
    NAV_ITEMS.map((i) => i.key),
  );
});
