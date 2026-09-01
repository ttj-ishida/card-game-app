import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMatchConfig,
  isHumanSeat,
  isValidTotalPlayers,
  seatPolicies,
  humanSeatIds,
  DEFAULT_PACK_ID,
} from './matchConfig';

test('isValidTotalPlayers accepts 2..6 integers only', () => {
  for (const n of [2, 3, 4, 5, 6]) assert.equal(isValidTotalPlayers(n), true);
  for (const n of [1, 7, 0, -1, 2.5, Number.NaN]) assert.equal(isValidTotalPlayers(n), false);
});

test('buildMatchConfig: seat-0 is HUMAN, rest are CPU STANDARD, length N, packId DEFAULT', () => {
  const c = buildMatchConfig(4);
  assert.equal(c.seats.length, 4);
  assert.equal(c.packId, DEFAULT_PACK_ID);
  assert.deepEqual(
    c.seats.map((s) => s.seatId),
    ['seat-0', 'seat-1', 'seat-2', 'seat-3'],
  );
  assert.equal(c.seats[0].kind, 'HUMAN');
  assert.ok(c.seats.slice(1).every((s) => s.kind === 'CPU' && s.policyId === 'STANDARD'));
  assert.equal(c.seats[0].nameKey, 'cpuGame.seat.you');
  assert.deepEqual(
    c.seats.slice(1).map((s) => s.nameKey),
    ['cpuGame.seat.cpu1', 'cpuGame.seat.cpu2', 'cpuGame.seat.cpu3'],
  );
});

test('buildMatchConfig: a 6-player game gives CPU seats distinct cpu1..cpu5 name keys', () => {
  const c = buildMatchConfig(6);
  assert.deepEqual(
    c.seats.map((s) => s.nameKey),
    [
      'cpuGame.seat.you',
      'cpuGame.seat.cpu1',
      'cpuGame.seat.cpu2',
      'cpuGame.seat.cpu3',
      'cpuGame.seat.cpu4',
      'cpuGame.seat.cpu5',
    ],
  );
});

test('buildMatchConfig throws for invalid totals', () => {
  assert.throws(() => buildMatchConfig(1), RangeError);
  assert.throws(() => buildMatchConfig(7), RangeError);
});

test('seatPolicies covers only CPU seats; humanSeatIds is the one human', () => {
  const c = buildMatchConfig(3);
  assert.deepEqual(seatPolicies(c), { 'seat-1': 'STANDARD', 'seat-2': 'STANDARD' });
  assert.deepEqual(humanSeatIds(c), ['seat-0']);
  assert.equal(isHumanSeat(c, 'seat-0'), true);
  assert.equal(isHumanSeat(c, 'seat-1'), false);
});
