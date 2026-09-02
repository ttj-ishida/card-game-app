import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { StoragePort } from './anonPlayerId';
import type { PracticeResultPayload } from './resultModel';
import {
  savePracticeResult,
  recordFinishedRound,
  savePracticeResultReturningId,
  saveRoundEvents,
  fetchActiveRulesetId,
  type HttpPort,
  type SaveOutcome,
} from './practiceResultSync';
import { enqueuePracticeResult, flushPracticeResultQueue, QUEUE_KEY } from './practiceResultQueue';

const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-key-123';

function makePayload(overrides: Partial<PracticeResultPayload> = {}): PracticeResultPayload {
  return {
    client_result_id: 'crid-1',
    anon_player_id: 'anon-1',
    mode: 'CPU_PRACTICE',
    player_count: 4,
    local_player_seat: 0,
    winner_seat: 2,
    local_won: false,
    turn_count: 37,
    duration_ms: 123456,
    round_seed: 99,
    ruleset_id: null,
    ...overrides,
  };
}

type RecordedCall = { url: string; headers: Record<string, string>; body: string };

/** 設定した応答を順に返す（尽きたら最後の応答を繰り返す）フェイク HttpPort。 */
function createFakeHttp(
  responses: ({ status: number; body: string } | { throw: true })[],
): HttpPort & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let i = 0;
  return {
    calls,
    async post(url, headers, body) {
      calls.push({ url, headers, body });
      const r = responses[Math.min(i, responses.length - 1)] ?? { status: 200, body: '' };
      i++;
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

describe('savePracticeResult', () => {
  it('201 → saved', async () => {
    const http = createFakeHttp([{ status: 201, body: '' }]);
    const outcome = await savePracticeResult(makePayload(), {
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'saved');
  });

  it('200 and 204 → saved', async () => {
    for (const status of [200, 204]) {
      const http = createFakeHttp([{ status, body: '' }]);
      const outcome = await savePracticeResult(makePayload(), {
        http,
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      });
      assert.equal(outcome, 'saved', `status ${status}`);
    }
  });

  it('409 → duplicate', async () => {
    const http = createFakeHttp([{ status: 409, body: '' }]);
    const outcome = await savePracticeResult(makePayload(), {
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'duplicate');
  });

  it('body contains 23505 → duplicate', async () => {
    const http = createFakeHttp([{ status: 400, body: '{"code":"23505","message":"boom"}' }]);
    const outcome = await savePracticeResult(makePayload(), {
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'duplicate');
  });

  it('body contains "duplicate key" (any case) → duplicate', async () => {
    const http = createFakeHttp([
      { status: 500, body: 'ERROR: duplicate KEY value violates unique constraint' },
    ]);
    const outcome = await savePracticeResult(makePayload(), {
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'duplicate');
  });

  it('other 4xx (400 / 401 / 422) → rejected (permanent, not retried)', async () => {
    for (const status of [400, 401, 422]) {
      const http = createFakeHttp([{ status, body: 'nope' }]);
      const outcome = await savePracticeResult(makePayload(), {
        http,
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      });
      assert.equal(outcome, 'rejected', `status ${status}`);
    }
  });

  it('500 → failed', async () => {
    const http = createFakeHttp([{ status: 500, body: 'Internal Server Error' }]);
    const outcome = await savePracticeResult(makePayload(), {
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'failed');
  });

  it('post throws → failed', async () => {
    const http = createFakeHttp([{ throw: true }]);
    const outcome = await savePracticeResult(makePayload(), {
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'failed');
  });

  it('posts to the right URL with all four headers and JSON body', async () => {
    const http = createFakeHttp([{ status: 201, body: '' }]);
    const payload = makePayload();
    await savePracticeResult(payload, { http, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY });

    assert.equal(http.calls.length, 1);
    const call = http.calls[0];
    assert.equal(call.url, `${SUPABASE_URL}/rest/v1/practice_round_results`);
    assert.equal(call.headers.apikey, ANON_KEY);
    assert.equal(call.headers.Authorization, `Bearer ${ANON_KEY}`);
    assert.equal(call.headers['Content-Type'], 'application/json');
    assert.equal(call.headers.Prefer, 'return=minimal');
    assert.deepEqual(JSON.parse(call.body), payload);
  });
});

describe('enqueuePracticeResult', () => {
  it('writes a JSON array into the queue key', async () => {
    const storage = createFakeStorage();
    await enqueuePracticeResult(storage, makePayload());
    const raw = storage.data.get(QUEUE_KEY)!;
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].client_result_id, 'crid-1');
  });

  it('dedupes by client_result_id (enqueue same id twice → 1 entry)', async () => {
    const storage = createFakeStorage();
    await enqueuePracticeResult(storage, makePayload({ turn_count: 1 }));
    await enqueuePracticeResult(storage, makePayload({ turn_count: 2 }));
    const parsed = JSON.parse(storage.data.get(QUEUE_KEY)!);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].turn_count, 2, 'latest payload wins');
  });

  it('keeps distinct client_result_id entries', async () => {
    const storage = createFakeStorage();
    await enqueuePracticeResult(storage, makePayload({ client_result_id: 'a' }));
    await enqueuePracticeResult(storage, makePayload({ client_result_id: 'b' }));
    const parsed = JSON.parse(storage.data.get(QUEUE_KEY)!);
    assert.equal(parsed.length, 2);
  });

  it('caps the queue at 100 entries, dropping the oldest', async () => {
    const storage = createFakeStorage();
    for (let n = 0; n < 105; n += 1) {
      await enqueuePracticeResult(storage, makePayload({ client_result_id: `crid-${n}` }));
    }
    const parsed: PracticeResultPayload[] = JSON.parse(storage.data.get(QUEUE_KEY)!);
    assert.equal(parsed.length, 100);
    assert.equal(parsed[0].client_result_id, 'crid-5', 'oldest kept is #5');
    assert.equal(parsed[99].client_result_id, 'crid-104', 'newest kept is #104');
  });

  it('tolerates a missing value (starts from [])', async () => {
    const storage = createFakeStorage();
    await enqueuePracticeResult(storage, makePayload());
    assert.equal(JSON.parse(storage.data.get(QUEUE_KEY)!).length, 1);
  });

  it('tolerates a corrupt value (resets to [])', async () => {
    const storage = createFakeStorage({ [QUEUE_KEY]: 'not json {{{' });
    await enqueuePracticeResult(storage, makePayload());
    const parsed = JSON.parse(storage.data.get(QUEUE_KEY)!);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 1);
  });

  it('tolerates a non-array JSON value (resets to [])', async () => {
    const storage = createFakeStorage({ [QUEUE_KEY]: '{"foo":1}' });
    await enqueuePracticeResult(storage, makePayload());
    assert.equal(JSON.parse(storage.data.get(QUEUE_KEY)!).length, 1);
  });
});

describe('flushPracticeResultQueue', () => {
  it('drops saved + duplicate, keeps failed, returns right counts', async () => {
    const a = makePayload({ client_result_id: 'a' });
    const b = makePayload({ client_result_id: 'b' });
    const c = makePayload({ client_result_id: 'c' });
    const storage = createFakeStorage({ [QUEUE_KEY]: JSON.stringify([a, b, c]) });
    // a → saved, b → failed, c → duplicate
    const http = createFakeHttp([
      { status: 201, body: '' },
      { status: 500, body: 'err' },
      { status: 409, body: '' },
    ]);

    const result = await flushPracticeResultQueue({
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });

    assert.deepEqual(result, { flushed: 2, remaining: 1 });
    const survivors = JSON.parse(storage.data.get(QUEUE_KEY)!);
    assert.equal(survivors.length, 1);
    assert.equal(survivors[0].client_result_id, 'b');
  });

  it('drops a rejected (permanent 4xx) entry without keeping it', async () => {
    const a = makePayload({ client_result_id: 'a' });
    const b = makePayload({ client_result_id: 'b' });
    const storage = createFakeStorage({ [QUEUE_KEY]: JSON.stringify([a, b]) });
    // a → saved (201), b → rejected (400)
    const http = createFakeHttp([
      { status: 201, body: '' },
      { status: 400, body: 'bad' },
    ]);
    const result = await flushPracticeResultQueue({
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.deepEqual(result, { flushed: 2, remaining: 0 });
    assert.equal(JSON.parse(storage.data.get(QUEUE_KEY)!).length, 0);
  });

  it('empty queue → { flushed: 0, remaining: 0 } and no http calls', async () => {
    const storage = createFakeStorage();
    const http = createFakeHttp([{ status: 201, body: '' }]);
    const result = await flushPracticeResultQueue({
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.deepEqual(result, { flushed: 0, remaining: 0 });
    assert.equal(http.calls.length, 0);
  });

  it('all failed → keeps every entry', async () => {
    const storage = createFakeStorage({
      [QUEUE_KEY]: JSON.stringify([
        makePayload({ client_result_id: 'a' }),
        makePayload({ client_result_id: 'b' }),
      ]),
    });
    const http = createFakeHttp([{ throw: true }]);
    const result = await flushPracticeResultQueue({
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.deepEqual(result, { flushed: 0, remaining: 2 });
    assert.equal(JSON.parse(storage.data.get(QUEUE_KEY)!).length, 2);
  });
});

describe('recordFinishedRound', () => {
  it('save succeeds → returns saved, queue stays empty', async () => {
    const storage = createFakeStorage();
    const http = createFakeHttp([{ status: 201, body: '' }]);
    const outcome: SaveOutcome = await recordFinishedRound(makePayload(), {
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'saved');
    assert.equal(storage.data.get(QUEUE_KEY), undefined);
  });

  it('save is a duplicate → returns duplicate, queue stays empty', async () => {
    const storage = createFakeStorage();
    const http = createFakeHttp([{ status: 409, body: '' }]);
    const outcome = await recordFinishedRound(makePayload(), {
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'duplicate');
    assert.equal(storage.data.get(QUEUE_KEY), undefined);
  });

  it('save fails → returns failed, payload is queued once', async () => {
    const storage = createFakeStorage();
    const http = createFakeHttp([{ status: 500, body: 'err' }]);
    const outcome = await recordFinishedRound(makePayload(), {
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'failed');
    const queued = JSON.parse(storage.data.get(QUEUE_KEY)!);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].client_result_id, 'crid-1');
  });

  it('save is permanently rejected (4xx) → returns rejected, queue stays empty', async () => {
    const storage = createFakeStorage();
    const http = createFakeHttp([{ status: 400, body: 'bad payload' }]);
    const outcome = await recordFinishedRound(makePayload(), {
      storage,
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    assert.equal(outcome, 'rejected');
    assert.equal(storage.data.get(QUEUE_KEY), undefined);
  });
});

describe('M3 result/event sync helpers', () => {
  it('savePracticeResultReturningId asks PostgREST to return the inserted result id', async () => {
    const http = createFakeHttp([{ status: 201, body: '[{"id":"round-result-1"}]' }]);
    const result = await savePracticeResultReturningId(makePayload({ ruleset_id: 'ruleset-1' }), {
      http,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });

    assert.deepEqual(result, { outcome: 'saved', roundResultId: 'round-result-1' });
    assert.equal(http.calls[0].url, `${SUPABASE_URL}/rest/v1/practice_round_results?select=id`);
    assert.equal(http.calls[0].headers.Prefer, 'return=representation');
    assert.equal(JSON.parse(http.calls[0].body).ruleset_id, 'ruleset-1');
  });

  it('savePracticeResultReturningId preserves duplicate and failure outcomes without an id', async () => {
    const duplicate = createFakeHttp([{ status: 409, body: '' }]);
    assert.deepEqual(
      await savePracticeResultReturningId(makePayload(), {
        http: duplicate,
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      }),
      { outcome: 'duplicate', roundResultId: null },
    );

    const failed = createFakeHttp([{ status: 500, body: 'err' }]);
    assert.deepEqual(
      await savePracticeResultReturningId(makePayload(), {
        http: failed,
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      }),
      { outcome: 'failed', roundResultId: null },
    );
  });

  it('saveRoundEvents posts the public event payload to round_events', async () => {
    const http = createFakeHttp([{ status: 201, body: '' }]);
    const outcome = await saveRoundEvents(
      {
        round_result_id: 'round-result-1',
        events: [
          {
            index: 0,
            seat_id: 'seat-0',
            seat_kind: 'HUMAN',
            kind: 'PLAY',
            action_kind: 'LEAD',
            cards: [{ rank_code: 'RANK_5', suit_code: 'SUIT_FIRE' }],
            skill_effect: 'JOKER_TRANSFORM',
            field_cleared: false,
            day_night_after: 'DAY',
            hand_counts_after: { 'seat-0': 3 },
          },
        ],
      },
      { http, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY },
    );

    assert.equal(outcome, 'saved');
    assert.equal(http.calls[0].url, `${SUPABASE_URL}/rest/v1/round_events`);
    assert.equal(http.calls[0].headers.Prefer, 'return=minimal');
    assert.equal(JSON.parse(http.calls[0].body).round_result_id, 'round-result-1');
  });

  it('fetchActiveRulesetId reads the active ruleset id and degrades to null on failures', async () => {
    const ok = createFakeHttp([{ status: 200, body: '[{"ruleset_id":"ruleset-1"}]' }]);
    assert.equal(
      await fetchActiveRulesetId({ http: ok, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }),
      'ruleset-1',
    );
    assert.equal(ok.calls[0].url, `${SUPABASE_URL}/rest/v1/rpc/get_active_ruleset`);

    const bad = createFakeHttp([{ status: 500, body: 'err' }]);
    assert.equal(
      await fetchActiveRulesetId({ http: bad, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }),
      null,
    );
  });
});
