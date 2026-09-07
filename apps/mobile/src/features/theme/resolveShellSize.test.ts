import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveShellSize } from './resolveShellSize.ts';

test('returns null below the min width (mobile fills the screen)', () => {
  assert.equal(resolveShellSize({ width: 375, height: 812 }), null);
  assert.equal(resolveShellSize({ width: 759, height: 800 }), null);
});

test('at exactly minWidth it frames (>=)', () => {
  assert.notEqual(resolveShellSize({ width: 760, height: 900 }), null);
});

test('wide 1920x1080 is height-constrained', () => {
  // (1920-48)/(1080-48) = 1.814 > 16/9 (1.777) -> height limits
  const s = resolveShellSize({ width: 1920, height: 1080 });
  assert.ok(s);
  assert.equal(s.height, 1032);
  assert.equal(s.width, Math.round((1032 * 16) / 9));
});

test('tall window 900x1400 is width-constrained', () => {
  const s = resolveShellSize({ width: 900, height: 1400 });
  assert.ok(s);
  assert.equal(s.width, 852);
  assert.equal(s.height, Math.round((852 * 9) / 16));
});

test('result is always integer and matches the aspect within 1px', () => {
  for (const win of [
    { width: 1280, height: 800 },
    { width: 1600, height: 900 },
    { width: 1024, height: 1366 },
  ]) {
    const s = resolveShellSize(win);
    assert.ok(s);
    assert.equal(s.width, Math.round(s.width));
    assert.equal(s.height, Math.round(s.height));
    assert.ok(Math.abs(s.width / s.height - 16 / 9) < 0.02, `${win.width}x${win.height}`);
  }
});

test('honours custom options', () => {
  assert.equal(resolveShellSize({ width: 800, height: 600 }, { minWidth: 1000 }), null);
  const s = resolveShellSize({ width: 1000, height: 1000 }, { aspect: 1, margin: 0 });
  assert.deepEqual(s, { width: 1000, height: 1000 });
});
