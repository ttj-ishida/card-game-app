import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { RoundState } from '@card-game-app/game-core';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import { __resetAnonPlayerIdMemoForTest } from '../features/cpu-game/anonPlayerId';
import type { HttpPort } from '../features/cpu-game/practiceResultSync';
import { QUEUE_KEY } from '../features/cpu-game/practiceResultQueue';
import { activeSeatId, type DriverState } from '../features/cpu-game/turnDriver';
import {
  cpuGameStore,
  configureCpuGameStore,
  __resetCpuGameStoreForTest,
  type CpuGameDeps,
} from './cpuGameStore';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-key-123';

type RecordedCall = { url: string; headers: Record<string, string>; body: string };

function createFakeHttp(
  responses: ({ status: number; body: string } | { throw: true })[],
): HttpPort & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let i = 0;
  return {
    calls,
    async post(url, headers, body) {
      calls.push({ url, headers, body });
      const r = responses[Math.min(i, responses.length - 1)] ?? { status: 201, body: '' };
      i += 1;
      if ('throw' in r) throw new Error('network down');
      return { status: r.status, body: r.body };
    },
  };
}

function createFakeStorage(
  initial?: Record<string, string>,
): StoragePort & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}

function makeFakeDeps(overrides: Partial<CpuGameDeps> = {}): CpuGameDeps & {
  http: HttpPort & { calls: RecordedCall[] };
  storage: StoragePort & { data: Map<string, string> };
} {
  let idN = 0;
  return {
    makeSeed: () => 12345,
    makeId: () => `id-${(idN += 1)}`,
    now: () => 1_000_000,
    storage: createFakeStorage(),
    http: createFakeHttp([{ status: 201, body: '' }]),
    supabaseUrl: SUPABASE_URL,
    anonKey: ANON_KEY,
    ...overrides,
  } as CpuGameDeps & {
    http: HttpPort & { calls: RecordedCall[] };
    storage: StoragePort & { data: Map<string, string> };
  };
}

function cardTotal(round: RoundState): number {
  const inHands = round.players.reduce((sum, p) => sum + p.hand.length, 0);
  const field = round.activeField ? round.activeField.combination.cards.length : 0;
  return inHands + round.discardPile.length + field;
}

const PAYLOAD_COLUMNS = [
  'anon_player_id',
  'client_result_id',
  'duration_ms',
  'local_player_seat',
  'local_won',
  'mode',
  'player_count',
  'round_seed',
  'turn_count',
  'winner_seat',
];

/** Drive the store from startMatch to ROUND_OVER, asserting card conservation every step. */
function playToRoundOver(n: number): void {
  cpuGameStore.getState().startMatch(n);
  assert.equal(cardTotal(cpuGameStore.getState().driver!.round), 36, `n=${n} initial`);

  let guard = 0;
  for (;;) {
    if ((guard += 1) > 2000) throw new Error(`no progress n=${n}`);
    const state = cpuGameStore.getState();
    const driver = state.driver!;
    if (driver.phase === 'ROUND_OVER') break;

    if (driver.phase === 'HUMAN_TURN') {
      const legal = state.legalPlays;
      assert.ok(legal.length > 0, `n=${n}: no legal human plays`);
      const first = legal[0];
      if (first.input.kind === 'PASS') {
        const res = cpuGameStore.getState().pass();
        assert.ok(res.ok, `n=${n}: pass rejected (${res.reason})`);
      } else {
        for (const cardId of first.input.cardIds) cpuGameStore.getState().selectCard(cardId);
        const res = cpuGameStore.getState().submitPlay();
        assert.ok(res.ok, `n=${n}: submit rejected (${res.reason})`);
      }
      assert.equal(cardTotal(cpuGameStore.getState().driver!.round), 36, `n=${n} after human`);
    } else {
      // CPU_PENDING: stage then commit.
      const driverBefore = cpuGameStore.getState().driver;
      const { thinkMillis } = cpuGameStore.getState().advanceCpu();
      assert.ok(thinkMillis >= 600 && thinkMillis <= 1200, `n=${n}: thinkMillis ${thinkMillis}`);
      assert.equal(cpuGameStore.getState().cpuThinking, true);
      assert.notEqual(cpuGameStore.getState().pendingCpuReveal, null);
      // advanceCpu must NOT mutate driver.
      assert.equal(
        cpuGameStore.getState().driver,
        driverBefore,
        `n=${n}: advanceCpu mutated driver`,
      );
      assert.equal(cpuGameStore.getState().driver!.phase, 'CPU_PENDING');

      cpuGameStore.getState().commitCpuReveal();
      assert.equal(cpuGameStore.getState().cpuThinking, false);
      assert.equal(cpuGameStore.getState().pendingCpuReveal, null);
      assert.equal(cardTotal(cpuGameStore.getState().driver!.round), 36, `n=${n} after cpu`);
    }
  }
}

beforeEach(() => {
  __resetAnonPlayerIdMemoForTest();
  __resetCpuGameStoreForTest();
  cpuGameStore.getState().exit();
});

describe('cpuGameStore configuration guard', () => {
  it('startMatch throws a clear error when unconfigured', () => {
    // @ts-expect-error deliberately clearing config for the guard test
    configureCpuGameStore(undefined);
    assert.throws(() => cpuGameStore.getState().startMatch(4), /configure/i);
  });

  it('finishRound rejects when unconfigured', async () => {
    // @ts-expect-error deliberately clearing config for the guard test
    configureCpuGameStore(undefined);
    await assert.rejects(() => cpuGameStore.getState().finishRound(), /configure/i);
  });
});

describe('M2-QA-02: every player count completes a full round', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    it(`n=${n}: reaches ROUND_OVER, winner has an empty hand, result saved once`, async () => {
      const deps = makeFakeDeps();
      configureCpuGameStore(deps);

      playToRoundOver(n);

      const afterLoop = cpuGameStore.getState();
      assert.equal(afterLoop.driver!.phase, 'ROUND_OVER');
      assert.ok(afterLoop.driver!.winnerSeatId);

      await cpuGameStore.getState().finishRound();

      const state = cpuGameStore.getState();
      assert.ok(state.result, `n=${n}: result missing`);
      assert.ok(state.result!.winnerSeatId, `n=${n}: winnerSeatId missing`);
      const winner = state.driver!.round.players.find(
        (p) => p.playerId === state.result!.winnerSeatId,
      );
      assert.equal(winner?.hand.length, 0, `n=${n}: winner hand not empty`);
      assert.equal(state.saveStatus, 'saved', `n=${n}: saveStatus`);

      assert.equal(deps.http.calls.length, 1, `n=${n}: http POST count`);
      const call = deps.http.calls[0];
      assert.equal(call.url, `${SUPABASE_URL}/rest/v1/practice_round_results`);
      const body = JSON.parse(call.body);
      assert.deepEqual(Object.keys(body).sort(), PAYLOAD_COLUMNS, `n=${n}: payload columns`);
      assert.equal(body.mode, 'CPU_PRACTICE');
      assert.equal(body.player_count, n);
      assert.equal(body.round_seed, 12345);
      assert.equal(body.local_won, body.winner_seat === body.local_player_seat);
      assert.equal(typeof body.turn_count, 'number');
      assert.ok(body.turn_count > 0);
    });
  }

  it('finishRound is idempotent (second call does not POST again)', async () => {
    const deps = makeFakeDeps();
    configureCpuGameStore(deps);
    playToRoundOver(3);
    await cpuGameStore.getState().finishRound();
    await cpuGameStore.getState().finishRound();
    assert.equal(deps.http.calls.length, 1);
  });
});

describe('determinism', () => {
  it('two runs with identical fakes produce a deepEqual final driver', async () => {
    const seen: DriverState[] = [];
    for (let run = 0; run < 2; run += 1) {
      __resetAnonPlayerIdMemoForTest();
      cpuGameStore.getState().exit();
      configureCpuGameStore(makeFakeDeps());
      playToRoundOver(4);
      seen.push(cpuGameStore.getState().driver!);
    }
    assert.deepEqual(seen[0], seen[1]);
  });
});

describe('rematch and exit', () => {
  it('rematch bumps rematchIndex and rotates the first seat clockwise', () => {
    const deps = makeFakeDeps();
    configureCpuGameStore(deps);
    playToRoundOver(4);

    const before = cpuGameStore.getState().driver!;
    const baselineIndex = before.config.seats.findIndex(
      (s) => s.seatId === before.baselineFirstSeatId,
    );

    cpuGameStore.getState().rematch();

    const after = cpuGameStore.getState().driver!;
    assert.equal(after.rematchIndex, before.rematchIndex + 1);
    assert.equal(after.baselineFirstSeatId, before.baselineFirstSeatId);
    assert.equal(after.turnLog.length, 0);
    assert.equal(cpuGameStore.getState().result, null);
    assert.equal(cpuGameStore.getState().saveStatus, 'idle');
    const expectedFirst =
      after.config.seats[(baselineIndex + 1) % after.config.seats.length].seatId;
    assert.equal(activeSeatId(after), expectedFirst);
  });

  it('exit fully resets the store', async () => {
    const deps = makeFakeDeps();
    configureCpuGameStore(deps);
    playToRoundOver(2);
    await cpuGameStore.getState().finishRound();

    cpuGameStore.getState().exit();

    const state = cpuGameStore.getState();
    assert.equal(state.driver, null);
    assert.equal(state.result, null);
    assert.deepEqual(state.selection, []);
    assert.deepEqual(state.legalPlays, []);
    assert.equal(state.pendingCpuReveal, null);
    assert.equal(state.cpuThinking, false);
    assert.equal(state.startedAtMs, null);
    assert.equal(state.clientResultId, null);
    assert.equal(state.saveStatus, 'idle');
  });
});

describe('finishRound failure handling', () => {
  it('http 500 leaves saveStatus queued and enqueues one entry', async () => {
    const deps = makeFakeDeps({ http: createFakeHttp([{ status: 500, body: 'boom' }]) });
    configureCpuGameStore(deps);
    playToRoundOver(3);

    await cpuGameStore.getState().finishRound();

    assert.equal(cpuGameStore.getState().saveStatus, 'queued');
    const queued = JSON.parse((deps.storage as { data: Map<string, string> }).data.get(QUEUE_KEY)!);
    assert.equal(queued.length, 1);
  });

  it('http.post throwing leaves saveStatus queued without crashing', async () => {
    const deps = makeFakeDeps({ http: createFakeHttp([{ throw: true }]) });
    configureCpuGameStore(deps);
    playToRoundOver(3);

    await cpuGameStore.getState().finishRound();
    await tick();

    assert.equal(cpuGameStore.getState().saveStatus, 'queued');
    assert.ok(cpuGameStore.getState().result);
    const queued = JSON.parse((deps.storage as { data: Map<string, string> }).data.get(QUEUE_KEY)!);
    assert.equal(queued.length, 1);
  });

  it('http 400 (permanent) leaves saveStatus failed and nothing queued', async () => {
    const deps = makeFakeDeps({ http: createFakeHttp([{ status: 400, body: 'bad payload' }]) });
    configureCpuGameStore(deps);
    playToRoundOver(3);

    await cpuGameStore.getState().finishRound();
    await tick();

    assert.equal(cpuGameStore.getState().saveStatus, 'failed');
    const raw = (deps.storage as { data: Map<string, string> }).data.get(QUEUE_KEY);
    assert.deepEqual(raw ? JSON.parse(raw) : [], []);
  });

  it('finishRound flushes a pre-seeded queue entry once the network is back', async () => {
    const preseeded = {
      client_result_id: 'preseed-1',
      anon_player_id: 'anon-x',
      mode: 'CPU_PRACTICE',
      player_count: 4,
      local_player_seat: 0,
      winner_seat: 1,
      local_won: false,
      turn_count: 10,
      duration_ms: 1000,
      round_seed: 1,
    };
    const storage = createFakeStorage({ [QUEUE_KEY]: JSON.stringify([preseeded]) });
    const deps = makeFakeDeps({ storage, http: createFakeHttp([{ status: 201, body: '' }]) });
    configureCpuGameStore(deps);
    playToRoundOver(3);

    await cpuGameStore.getState().finishRound();
    await tick();

    assert.equal(cpuGameStore.getState().saveStatus, 'saved');
    assert.equal(JSON.parse(storage.data.get(QUEUE_KEY)!).length, 0, 'queue drained by flush');
  });

  it('a storage failure inside finishRound does not crash and queues', async () => {
    const storage: StoragePort & { data: Map<string, string> } = {
      data: new Map(),
      async getItem() {
        throw new Error('storage unavailable');
      },
      async setItem() {
        throw new Error('storage unavailable');
      },
    };
    const deps = makeFakeDeps({ storage, http: createFakeHttp([{ status: 500, body: 'boom' }]) });
    configureCpuGameStore(deps);
    playToRoundOver(2);

    await cpuGameStore.getState().finishRound();
    assert.equal(cpuGameStore.getState().saveStatus, 'queued');
  });
});

describe('selection and rejection behaviour', () => {
  it('submitPlay on an empty selection is a no-op returning ok:false', () => {
    const deps = makeFakeDeps();
    configureCpuGameStore(deps);
    cpuGameStore.getState().startMatch(2);
    // seat-0 leads first in a 2-player game only if dealt first; guard for that.
    if (cpuGameStore.getState().driver!.phase !== 'HUMAN_TURN') return;
    const driverBefore = cpuGameStore.getState().driver;
    const res = cpuGameStore.getState().submitPlay();
    assert.equal(res.ok, false);
    assert.equal(cpuGameStore.getState().driver, driverBefore);
  });

  it('clearSelection empties the current selection', () => {
    const deps = makeFakeDeps();
    configureCpuGameStore(deps);
    cpuGameStore.getState().startMatch(2);
    if (cpuGameStore.getState().driver!.phase !== 'HUMAN_TURN') return;
    const legal = cpuGameStore.getState().legalPlays.find((p) => p.input.kind === 'PLAY');
    if (!legal || legal.input.kind !== 'PLAY') return;
    cpuGameStore.getState().selectCard(legal.input.cardIds[0]);
    assert.ok(cpuGameStore.getState().selection.length > 0);
    cpuGameStore.getState().clearSelection();
    assert.deepEqual(cpuGameStore.getState().selection, []);
  });

  it('advanceCpu is a no-op outside CPU_PENDING', () => {
    const deps = makeFakeDeps();
    configureCpuGameStore(deps);
    cpuGameStore.getState().startMatch(2);
    if (cpuGameStore.getState().driver!.phase !== 'HUMAN_TURN') return;
    const before = cpuGameStore.getState().driver;
    const res = cpuGameStore.getState().advanceCpu();
    assert.equal(res.thinkMillis, 0);
    assert.equal(cpuGameStore.getState().driver, before);
    assert.equal(cpuGameStore.getState().pendingCpuReveal, null);
  });
});
