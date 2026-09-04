import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkSupabaseConnection, type ConnectionCheckDeps } from './connectionCheck';

function fakeHttp(
  responder: (url: string) => Promise<{ status: number; body: string }>,
): ConnectionCheckDeps['http'] {
  return {
    get: (url) => responder(url),
    post: (url) => responder(url),
  };
}

const base = {
  supabaseUrl: 'https://abc.supabase.co',
  anonKey: 'sb_publishable_x',
};

test('not-configured when url or key is empty', async () => {
  assert.deepEqual(
    await checkSupabaseConnection({
      http: fakeHttp(() => Promise.reject(new Error('should not be called'))),
      supabaseUrl: '',
      anonKey: 'k',
    }),
    { kind: 'not-configured' },
  );
  assert.deepEqual(
    await checkSupabaseConnection({
      http: fakeHttp(() => Promise.reject(new Error('should not be called'))),
      supabaseUrl: 'https://abc.supabase.co',
      anonKey: '',
    }),
    { kind: 'not-configured' },
  );
});

test('ok for a 2xx response, and hits the rulesets endpoint with the anon key', async () => {
  let seenUrl = '';
  let seenApikey = '';
  const result = await checkSupabaseConnection({
    ...base,
    http: {
      get: (url, headers) => {
        seenUrl = url;
        seenApikey = headers.apikey ?? '';
        return Promise.resolve({ status: 200, body: '[]' });
      },
      post: () => Promise.reject(new Error('unused')),
    },
  });
  assert.deepEqual(result, { kind: 'ok', status: 200 });
  assert.equal(seenUrl, 'https://abc.supabase.co/rest/v1/rulesets?select=id&limit=1');
  assert.equal(seenApikey, 'sb_publishable_x');
});

test('unauthorized for 401 / 403', async () => {
  assert.deepEqual(
    await checkSupabaseConnection({
      ...base,
      http: fakeHttp(() => Promise.resolve({ status: 401, body: '' })),
    }),
    { kind: 'unauthorized', status: 401 },
  );
  assert.deepEqual(
    await checkSupabaseConnection({
      ...base,
      http: fakeHttp(() => Promise.resolve({ status: 403, body: '' })),
    }),
    { kind: 'unauthorized', status: 403 },
  );
});

test('http-error for other non-2xx', async () => {
  assert.deepEqual(
    await checkSupabaseConnection({
      ...base,
      http: fakeHttp(() => Promise.resolve({ status: 503, body: 'paused' })),
    }),
    { kind: 'http-error', status: 503 },
  );
});

test('unreachable when the fetch throws', async () => {
  assert.deepEqual(
    await checkSupabaseConnection({
      ...base,
      http: fakeHttp(() => Promise.reject(new Error('Network request failed'))),
    }),
    { kind: 'unreachable' },
  );
});
