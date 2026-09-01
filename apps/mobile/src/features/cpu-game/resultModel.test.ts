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
import { buildPracticeResultPayload, describeRoundResult } from './resultModel';

// 人間役スクリプト: 人間手番は最初の合法手、CPU手番は cpuStep。ROUND_OVER まで。
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

// _findseed で確認したシード: n=2 seed=6 は人間(seat-0)勝ち、seed=0 は CPU 勝ち。
const HUMAN_WINS = playToEnd(2, 6);
const CPU_WINS = playToEnd(2, 0);

test('describeRoundResult returns every RoundResultView field', () => {
  const view = describeRoundResult(HUMAN_WINS, 0, 30000);
  assert.equal(view.winnerSeatId, HUMAN_WINS.winnerSeatId);
  assert.equal(
    view.winnerNameKey,
    HUMAN_WINS.config.seats.find((s) => s.seatId === HUMAN_WINS.winnerSeatId)!.nameKey,
  );
  assert.equal(view.localWon, true);
  assert.equal(view.playerCount, 2);
  assert.equal(view.turnCount, HUMAN_WINS.turnLog.length);
  assert.equal(view.durationMs, 30000);
});

test('localWon is true iff the winner is the human seat', () => {
  assert.equal(HUMAN_WINS.winnerSeatId, 'seat-0');
  assert.equal(describeRoundResult(HUMAN_WINS, 0, 1000).localWon, true);

  assert.notEqual(CPU_WINS.winnerSeatId, 'seat-0');
  assert.equal(describeRoundResult(CPU_WINS, 0, 1000).localWon, false);
});

test('durationMs clamps a negative interval to 0', () => {
  assert.equal(describeRoundResult(HUMAN_WINS, 5000, 1000).durationMs, 0);
  assert.equal(describeRoundResult(HUMAN_WINS, 1000, 1000).durationMs, 0);
  assert.equal(describeRoundResult(HUMAN_WINS, 1000, 4200).durationMs, 3200);
});

test('describeRoundResult throws on an unfinished round', () => {
  const fresh = initGame({ config: buildMatchConfig(2), seed: 4242 });
  assert.equal(fresh.winnerSeatId, null);
  assert.throws(() => describeRoundResult(fresh, 0, 1000), /not finished/);
});

test('buildPracticeResultPayload carries every practice_round_results column with the right type', () => {
  const view = describeRoundResult(HUMAN_WINS, 1000, 31000);
  const payload = buildPracticeResultPayload({
    view,
    state: HUMAN_WINS,
    anonPlayerId: 'device-abc',
    clientResultId: 'result-123',
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    'anon_player_id',
    'client_result_id',
    'duration_ms',
    'local_player_seat',
    'local_won',
    'mode',
    'player_count',
    'round_seed',
    'ruleset_id',
    'turn_count',
    'winner_seat',
  ]);
  assert.equal(payload.client_result_id, 'result-123');
  assert.equal(payload.anon_player_id, 'device-abc');
  assert.equal(payload.mode, 'CPU_PRACTICE');
  assert.equal(typeof payload.player_count, 'number');
  assert.equal(typeof payload.local_player_seat, 'number');
  assert.equal(typeof payload.winner_seat, 'number');
  assert.equal(typeof payload.local_won, 'boolean');
  assert.equal(typeof payload.turn_count, 'number');
  assert.equal(typeof payload.duration_ms, 'number');
  assert.equal(typeof payload.round_seed, 'number');
  assert.equal(payload.ruleset_id, null);

  assert.equal(payload.player_count, 2);
  assert.equal(payload.local_player_seat, 0);
  assert.equal(payload.winner_seat, 0);
  assert.equal(payload.local_won, true);
  assert.equal(payload.turn_count, HUMAN_WINS.turnLog.length);
  assert.equal(payload.duration_ms, 30000);
});

test('payload satisfies the DB CHECK: local_won === (winner_seat === local_player_seat)', () => {
  for (const state of [HUMAN_WINS, CPU_WINS]) {
    const view = describeRoundResult(state, 0, 1000);
    const payload = buildPracticeResultPayload({
      view,
      state,
      anonPlayerId: 'd',
      clientResultId: 'c',
    });
    assert.equal(payload.local_won, payload.winner_seat === payload.local_player_seat);
  }
});

test('winner_seat is the config index of the winning seat, local_player_seat the human index', () => {
  const view = describeRoundResult(CPU_WINS, 0, 1000);
  const payload = buildPracticeResultPayload({
    view,
    state: CPU_WINS,
    anonPlayerId: 'd',
    clientResultId: 'c',
  });
  assert.equal(
    payload.winner_seat,
    CPU_WINS.config.seats.findIndex((s) => s.seatId === CPU_WINS.winnerSeatId),
  );
  assert.equal(
    payload.local_player_seat,
    CPU_WINS.config.seats.findIndex((s) => s.kind === 'HUMAN'),
  );
  assert.equal(payload.local_won, false);
  assert.notEqual(payload.winner_seat, payload.local_player_seat);
});

test('round_seed mirrors state.seed', () => {
  const view = describeRoundResult(CPU_WINS, 0, 1000);
  const payload = buildPracticeResultPayload({
    view,
    state: CPU_WINS,
    anonPlayerId: 'd',
    clientResultId: 'c',
  });
  assert.equal(payload.round_seed, CPU_WINS.seed);
  assert.equal(payload.round_seed, 0);
});

test('buildPracticeResultPayload throws when the view contradicts the state (upstream bug)', () => {
  const good = describeRoundResult(CPU_WINS, 0, 1000);
  const tampered = { ...good, localWon: true }; // CPU won, so localWon must be false
  assert.throws(
    () =>
      buildPracticeResultPayload({
        view: tampered,
        state: CPU_WINS,
        anonPlayerId: 'd',
        clientResultId: 'c',
      }),
    /disagrees/,
  );
});

test('both a human-wins and a CPU-wins seed produce constraint-valid payloads for 3 players', () => {
  const h3 = playToEnd(3, 6); // human wins
  const c3 = playToEnd(3, 3); // CPU wins
  assert.equal(h3.winnerSeatId, 'seat-0');
  assert.notEqual(c3.winnerSeatId, 'seat-0');
  for (const state of [h3, c3]) {
    const view = describeRoundResult(state, 0, 2000);
    const payload = buildPracticeResultPayload({
      view,
      state,
      anonPlayerId: 'd',
      clientResultId: 'c',
    });
    assert.ok(payload.player_count >= 2 && payload.player_count <= 6);
    assert.ok(payload.local_player_seat >= 0 && payload.local_player_seat < payload.player_count);
    assert.ok(payload.winner_seat >= 0 && payload.winner_seat < payload.player_count);
    assert.equal(payload.local_won, payload.winner_seat === payload.local_player_seat);
    assert.ok(payload.turn_count >= 0);
    assert.ok(payload.duration_ms >= 0);
  }
});

test('ruleset_id defaults to null when not provided', () => {
  const view = describeRoundResult(HUMAN_WINS, 0, 1000);
  const payload = buildPracticeResultPayload({
    view,
    state: HUMAN_WINS,
    anonPlayerId: 'd',
    clientResultId: 'c',
  });
  assert.equal(payload.ruleset_id, null);
});

test('ruleset_id carries the provided value through', () => {
  const view = describeRoundResult(HUMAN_WINS, 0, 1000);
  const payload = buildPracticeResultPayload({
    view,
    state: HUMAN_WINS,
    anonPlayerId: 'd',
    clientResultId: 'c',
    rulesetId: 'ruleset-uuid-123',
  });
  assert.equal(payload.ruleset_id, 'ruleset-uuid-123');
});
