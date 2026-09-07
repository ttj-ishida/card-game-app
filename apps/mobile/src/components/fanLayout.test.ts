import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fanLayout } from './fanLayout.ts';

test('empty and single', () => {
  assert.deepEqual(fanLayout(0), []);
  assert.deepEqual(fanLayout(1), [{ x: 0, y: 0, rotateDeg: 0, z: 0 }]);
});

test('is left-right symmetric about the centre', () => {
  const slots = fanLayout(5, { maxWidth: 320 });
  for (let i = 0; i < slots.length; i++) {
    const mirror = slots[slots.length - 1 - i];
    assert.ok(Math.abs(slots[i].x + mirror.x) < 1e-9, `x ${i}`);
    assert.ok(Math.abs(slots[i].rotateDeg + mirror.rotateDeg) < 1e-9, `rot ${i}`);
    assert.ok(Math.abs(slots[i].y - mirror.y) < 1e-9, `y ${i}`);
  }
  assert.equal(slots[2].x, 0);
  assert.equal(slots[2].rotateDeg, 0);
});

test('outermost cards carry the full spread and the most sink', () => {
  const slots = fanLayout(7, { maxSpread: 16, arc: 18 });
  assert.equal(slots[0].rotateDeg, -16);
  assert.equal(slots[6].rotateDeg, 16);
  assert.equal(slots[0].y, 18);
  assert.ok(slots[3].y < slots[0].y);
});

test('the fan fits inside maxWidth', () => {
  for (const count of [2, 5, 9, 13]) {
    const slots = fanLayout(count, { maxWidth: 300, cardWidth: 46 });
    const span = slots[slots.length - 1].x - slots[0].x + 46;
    assert.ok(span <= 300 + 1e-9, `count ${count} span ${span}`);
  }
});

test('z is a unique left-to-right stack', () => {
  const slots = fanLayout(13);
  const zs = slots.map((s) => s.z);
  assert.deepEqual(
    zs,
    [...zs].sort((a, b) => a - b),
  );
  assert.equal(new Set(zs).size, zs.length);
});
