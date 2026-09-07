import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clampFabPosition,
  defaultFabPosition,
  parseFabPosition,
  serializeFabPosition,
} from './fabPosition.ts';

const frame = { width: 1000, height: 600 };

test('clamps a position that overflows any edge back inside', () => {
  assert.deepEqual(clampFabPosition({ x: -50, y: -50 }, frame), { x: 34, y: 34 });
  assert.deepEqual(clampFabPosition({ x: 9999, y: 9999 }, frame), { x: 966, y: 566 });
});

test('leaves an in-bounds position untouched', () => {
  assert.deepEqual(clampFabPosition({ x: 500, y: 300 }, frame), { x: 500, y: 300 });
});

test('degenerate tiny frame does not invert the range', () => {
  const c = clampFabPosition({ x: 100, y: 100 }, { width: 10, height: 10 });
  assert.ok(c.x >= 0 && c.y >= 0);
});

test('default position is bottom-left', () => {
  const d = defaultFabPosition(frame);
  assert.equal(d.x, 42);
  assert.equal(d.y, 600 - 16 - 26);
});

test('parse/serialize round-trips and rejects junk', () => {
  assert.equal(parseFabPosition(null), null);
  assert.equal(parseFabPosition('nope'), null);
  assert.equal(parseFabPosition('{"x":1}'), null);
  assert.deepEqual(parseFabPosition(serializeFabPosition({ x: 12.7, y: 40.2 })), { x: 13, y: 40 });
});
