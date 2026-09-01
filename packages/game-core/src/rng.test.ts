import assert from "node:assert/strict";
import { test } from "node:test";

import { createRng, shuffle } from "./index.ts";

test("createRng is deterministic for the same seed", () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const seqA = Array.from({ length: 10 }, () => a.nextUint32());
  const seqB = Array.from({ length: 10 }, () => b.nextUint32());
  assert.deepEqual(seqA, seqB);
});

test("createRng differs for different seeds", () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notDeepEqual(
    Array.from({ length: 5 }, () => a.nextUint32()),
    Array.from({ length: 5 }, () => b.nextUint32()),
  );
});

test("createRng coerces the seed to uint32", () => {
  const a = createRng(7);
  const b = createRng(7 + 2 ** 32);
  assert.deepEqual(
    Array.from({ length: 5 }, () => a.nextUint32()),
    Array.from({ length: 5 }, () => b.nextUint32()),
  );
});

test("nextUint32 stays within [0, 2^32)", () => {
  const rng = createRng(99);
  for (let i = 0; i < 1000; i += 1) {
    const value = rng.nextUint32();
    assert.ok(Number.isInteger(value) && value >= 0 && value < 2 ** 32);
  }
});

test("nextInt stays within [0, bound) and covers the range", () => {
  const rng = createRng(5);
  const seen = new Set<number>();
  for (let i = 0; i < 500; i += 1) {
    const value = rng.nextInt(4);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 4);
    seen.add(value);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
});

test("nextInt rejects non-positive or non-integer bounds", () => {
  const rng = createRng(1);
  assert.throws(() => rng.nextInt(0), RangeError);
  assert.throws(() => rng.nextInt(-3), RangeError);
  assert.throws(() => rng.nextInt(2.5), RangeError);
});

test("nextFloat stays within [0, 1)", () => {
  const rng = createRng(3);
  for (let i = 0; i < 1000; i += 1) {
    const value = rng.nextFloat();
    assert.ok(value >= 0 && value < 1);
  }
});

test("createRng rejects a non-finite seed", () => {
  assert.throws(() => createRng(Number.NaN), RangeError);
  assert.throws(() => createRng(Number.POSITIVE_INFINITY), RangeError);
});

test("fork produces an independent stream and advances the parent", () => {
  const parent1 = createRng(42);
  const child1 = parent1.fork();
  const parent2 = createRng(42);
  // parent2 without forking should diverge from parent1 (which advanced on fork)
  assert.notEqual(parent1.nextUint32(), parent2.nextUint32());
  // two forks of equal parents match
  const child2 = createRng(42).fork();
  assert.deepEqual(
    Array.from({ length: 5 }, () => child1.nextUint32()),
    Array.from({ length: 5 }, () => child2.nextUint32()),
  );
});

test("sibling forks are independent", () => {
  const parent = createRng(7);
  const a = parent.fork();
  const b = parent.fork();
  assert.notDeepEqual(
    Array.from({ length: 5 }, () => a.nextUint32()),
    Array.from({ length: 5 }, () => b.nextUint32()),
  );
});

test("shuffle returns a permutation without mutating the input", () => {
  const rng = createRng(2024);
  const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const out = shuffle(rng, input);
  assert.equal(out.length, input.length);
  assert.deepEqual([...out].sort((x, y) => x - y), [...input].sort((x, y) => x - y));
  assert.deepEqual([...input], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("shuffle is deterministic for the same seed and actually reorders", () => {
  const input = Array.from({ length: 20 }, (_, i) => i);
  const a = shuffle(createRng(1), input);
  const b = shuffle(createRng(1), input);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, input);
});
