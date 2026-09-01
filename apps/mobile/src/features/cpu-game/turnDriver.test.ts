import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig } from './matchConfig';
import {
  initGame,
  humanPlay,
  cpuStep,
  isHumanTurn,
  activeSeatId,
  legalPlaysForHuman,
  type DriverState,
  type PublicRoundEvent,
} from './turnDriver';
import type { PlayInput } from '@card-game-app/game-core';

const start = (n: number, seed = n * 1000 + 1): DriverState =>
  initGame({ config: buildMatchConfig(n), seed });

// 人間役スクリプト: 人間手番は「最初の合法手」を出す。CPU手番は cpuStep。ROUND_OVER まで。
function playToEnd(n: number, seed: number): DriverState {
  let s = start(n, seed);
  let guard = 0;
  while (s.phase !== 'ROUND_OVER') {
    if (++guard > 500) throw new Error(`no progress n=${n} seed=${seed} turns=${s.turnLog.length}`);
    if (isHumanTurn(s)) {
      const legal = legalPlaysForHuman(s);
      assert.ok(legal.length > 0, `no legal human plays n=${n} seed=${seed}`);
      const res = humanPlay(s, legal[0].input);
      if (!res.ok) throw new Error(`human illegal n=${n} seed=${seed}: ${res.reason}`);
      s = res.next;
    } else {
      s = cpuStep(s).next;
    }
  }
  return s;
}

for (const n of [2, 3, 4, 5, 6]) {
  test(`a full ${n}-player game reaches ROUND_OVER with a real winner`, () => {
    const s = playToEnd(n, n * 7919 + 13);
    assert.ok(s.winnerSeatId);
    const winner = s.round.players.find((p) => p.playerId === s.winnerSeatId);
    assert.equal(winner?.hand.length, 0);
  });
}

test('every seed 0..49 for 2..6 players terminates without a guard trip', () => {
  let worst = 0;
  for (let n = 2; n <= 6; n += 1) {
    for (let seed = 0; seed < 50; seed += 1) {
      const s = playToEnd(n, seed);
      assert.ok(s.winnerSeatId, `no winner n=${n} seed=${seed}`);
      worst = Math.max(worst, s.turnLog.length);
    }
  }
  assert.ok(worst < 500, `worst turn count ${worst}`);
});

test('same seed + same human choices => identical final state', () => {
  const a = playToEnd(4, 4242);
  const b = playToEnd(4, 4242);
  assert.deepEqual(a, b);
});

test('same seed => identical state after every single step', () => {
  let a = start(4, 4242);
  let b = start(4, 4242);
  assert.deepEqual(a, b);
  let guard = 0;
  while (a.phase !== 'ROUND_OVER') {
    if (++guard > 500) throw new Error('no progress');
    if (isHumanTurn(a)) {
      const ra = humanPlay(a, legalPlaysForHuman(a)[0].input);
      const rb = humanPlay(b, legalPlaysForHuman(b)[0].input);
      if (!ra.ok) throw new Error(`a illegal: ${ra.reason}`);
      if (!rb.ok) throw new Error(`b illegal: ${rb.reason}`);
      a = ra.next;
      b = rb.next;
    } else {
      a = cpuStep(a).next;
      b = cpuStep(b).next;
    }
    assert.deepEqual(a, b);
  }
});

test('humanPlay rejects an illegal move without mutating state', () => {
  const s = start(2, 1);
  // 場が空なのに PASS は不正
  const before = JSON.stringify(s);
  const res = humanPlay(s, { kind: 'PASS', playerId: activeSeatId(s) });
  assert.equal(res.ok, false);
  assert.equal(JSON.stringify(s), before);
});

test('humanPlay rejects when it is not the human turn', () => {
  let s = start(3, 99);
  while (isHumanTurn(s)) {
    const res = humanPlay(s, legalPlaysForHuman(s)[0].input);
    if (!res.ok) throw new Error(res.reason);
    s = res.next;
  }
  assert.equal(s.phase, 'CPU_PENDING');
  const before = JSON.stringify(s);
  const res = humanPlay(s, { kind: 'PASS', playerId: activeSeatId(s) });
  assert.equal(res.ok, false);
  assert.equal(res.ok ? '' : res.reason, 'NOT_ACTIVE_PLAYER');
  assert.equal(JSON.stringify(s), before);
});

test('humanPlay rejects a move whose playerId is not the active seat', () => {
  const s = start(2, 1); // seat-0 is HUMAN and leads first
  assert.equal(s.phase, 'HUMAN_TURN');
  const legal = legalPlaysForHuman(s);
  const wrong: PlayInput = { ...legal[0].input, playerId: 'seat-1' };
  const res = humanPlay(s, wrong);
  assert.equal(res.ok, false);
  assert.equal(res.ok ? '' : res.reason, 'NOT_ACTIVE_PLAYER');
});

test('cpuStep decides a legal move with a 600..1200 think delay', () => {
  let s = start(3, 99);
  while (isHumanTurn(s)) {
    const res = humanPlay(s, legalPlaysForHuman(s)[0].input);
    if (!res.ok) throw new Error(res.reason);
    s = res.next;
  }
  const { decided } = cpuStep(s);
  assert.ok(decided.thinkMillis >= 600 && decided.thinkMillis <= 1200);
  assert.equal(decided.seatId, activeSeatId(s));
  assert.equal(s.config.seats.find((seat) => seat.seatId === decided.seatId)?.kind, 'CPU');
});

test('initGame: phase reflects the dealt first seat and baseline is recorded', () => {
  const config = buildMatchConfig(4);
  const s = initGame({ config, seed: 4242 });
  assert.equal(s.turnLog.length, 0);
  assert.equal(s.winnerSeatId, null);
  assert.equal(s.baselineFirstSeatId, s.round.activePlayerId);
  assert.equal(s.rematchIndex, 0);
  assert.equal(s.phase, s.round.activePlayerId === 'seat-0' ? 'HUMAN_TURN' : 'CPU_PENDING');
});

test('initGame honours an explicit baselineFirstSeatId', () => {
  const config = buildMatchConfig(4);
  const s = initGame({ config, seed: 4242, baselineFirstSeatId: 'seat-2', rematchIndex: 1 });
  assert.equal(s.baselineFirstSeatId, 'seat-2');
  assert.equal(s.rematchIndex, 1);
});

test('legalPlaysForHuman is empty when it is not the human turn', () => {
  let s = start(3, 99);
  while (isHumanTurn(s)) {
    const res = humanPlay(s, legalPlaysForHuman(s)[0].input);
    if (!res.ok) throw new Error(res.reason);
    s = res.next;
  }
  assert.deepEqual(legalPlaysForHuman(s), []);
});

test('a finished game exposes ROUND_OVER phase and empty human legal plays', () => {
  const s = playToEnd(4, 4242);
  assert.equal(s.phase, 'ROUND_OVER');
  assert.deepEqual(legalPlaysForHuman(s), []);
  assert.equal(isHumanTurn(s), false);
});

test('turn log carries card counts but no card ids', () => {
  const s = playToEnd(5, 5 * 7919 + 13);
  for (const entry of s.turnLog) {
    assert.equal(typeof entry.cardCount, 'number');
    assert.ok(!('cardIds' in entry));
    assert.ok(!('cardId' in entry));
    assert.equal(entry.index, s.turnLog.indexOf(entry));
    if (entry.kind === 'PASS') assert.equal(entry.cardCount, 0);
  }
});

test('publicEvents has one entry per turn, matching turnLog', () => {
  const s = playToEnd(5, 5 * 7919 + 13);
  assert.equal(s.publicEvents.length, s.turnLog.length);
  s.publicEvents.forEach((event: PublicRoundEvent, i: number) => {
    assert.equal(event.index, i);
    assert.equal(event.seatId, s.turnLog[i].seatId);
    assert.equal(event.seatKind, s.turnLog[i].seatKind);
    assert.equal(event.kind, s.turnLog[i].kind);
    assert.equal(event.fieldCleared, s.turnLog[i].fieldCleared);
    assert.equal(event.dayNightAfter, s.turnLog[i].dayNightAfter);
    assert.deepEqual(event.handCountsAfter, s.turnLog[i].handCountsAfter);
  });
});

test('a PASS event carries no cards and no skill effect', () => {
  const s = playToEnd(5, 5 * 7919 + 13);
  for (const event of s.publicEvents) {
    if (event.kind === 'PASS') {
      assert.deepEqual(event.cards, []);
      assert.equal(event.skillEffect, null);
    }
  }
});

test('a PLAY event carries at least one public card', () => {
  const s = playToEnd(5, 5 * 7919 + 13);
  for (const event of s.publicEvents) {
    if (event.kind === 'PLAY') {
      assert.ok(event.cards.length > 0, `turn ${event.index} PLAY has no cards`);
    }
  }
});

test('publicEvents surface every skill effect across the standard sweep, with cards attached', () => {
  const seen = new Set<string>();
  let transformHasCards = false;
  for (let n = 2; n <= 6; n += 1) {
    for (let seed = 0; seed < 50; seed += 1) {
      const s = playToEnd(n, seed);
      for (const event of s.publicEvents) {
        if (!event.skillEffect) continue;
        seen.add(event.skillEffect);
        if (event.skillEffect === 'JOKER_TRANSFORM' && event.cards.length > 0) {
          transformHasCards = true;
        }
      }
    }
  }
  for (const effect of ['JOKER_CLEAR', 'JOKER_TRANSFORM', 'EXTENSION_SEAL', 'REVOLUTION']) {
    assert.ok(seen.has(effect), `${effect} never appeared in publicEvents across the sweep`);
  }
  assert.ok(transformHasCards, 'a JOKER_TRANSFORM event should carry at least one public card');
});
