import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig } from './matchConfig';
import {
  cpuStep,
  humanPlay,
  initGame,
  isHumanTurn,
  legalPlaysForHuman,
  type DriverState,
} from './turnDriver';
import { buildRoundEventsPayload } from './roundEventsPayload';

function playToEnd(n: number, seed: number): DriverState {
  let s = initGame({ config: buildMatchConfig(n), seed });
  let guard = 0;
  while (s.phase !== 'ROUND_OVER') {
    if (++guard > 500) throw new Error(`no progress n=${n} seed=${seed}`);
    if (isHumanTurn(s)) {
      const res = humanPlay(s, legalPlaysForHuman(s)[0].input);
      if (!res.ok) throw new Error(`human illegal n=${n} seed=${seed}: ${res.reason}`);
      s = res.next;
    } else {
      s = cpuStep(s).next;
    }
  }
  return s;
}

const GAME = playToEnd(3, 6);

test('buildRoundEventsPayload carries the round_result_id through unchanged', () => {
  const payload = buildRoundEventsPayload('result-uuid-1', GAME.publicEvents);
  assert.equal(payload.round_result_id, 'result-uuid-1');
});

test('buildRoundEventsPayload produces one entry per publicEvents item, snake_case', () => {
  const payload = buildRoundEventsPayload('result-uuid-1', GAME.publicEvents);
  assert.equal(payload.events.length, GAME.publicEvents.length);
  payload.events.forEach((entry, i) => {
    const source = GAME.publicEvents[i];
    assert.equal(entry.index, source.index);
    assert.equal(entry.seat_id, source.seatId);
    assert.equal(entry.seat_kind, source.seatKind);
    assert.equal(entry.kind, source.kind);
    assert.equal(entry.action_kind, source.actionKind);
    assert.equal(entry.skill_effect, source.skillEffect);
    assert.equal(entry.field_cleared, source.fieldCleared);
    assert.equal(entry.day_night_after, source.dayNightAfter);
    assert.deepEqual(entry.hand_counts_after, source.handCountsAfter);
    assert.deepEqual(
      entry.cards,
      source.cards.map((c) => ({ rank_code: c.rankCode, suit_code: c.suitCode })),
    );
  });
});

test('buildRoundEventsPayload is pure: it does not mutate the input array', () => {
  const before = JSON.stringify(GAME.publicEvents);
  buildRoundEventsPayload('result-uuid-1', GAME.publicEvents);
  assert.equal(JSON.stringify(GAME.publicEvents), before);
});
