import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { bodySnippet, hostOf, httpPath, syncDiagnosticsStore } from './syncDiagnosticsStore';

beforeEach(() => {
  syncDiagnosticsStore.getState().reset();
});

test('starts empty', () => {
  const s = syncDiagnosticsStore.getState();
  assert.equal(s.lastRequest, null);
  assert.equal(s.lastError, null);
  assert.equal(s.lastSave, null);
  assert.equal(s.lastFlush, null);
});

test('recordRequest / recordError / recordSave / recordFlush keep only the latest', () => {
  const s = syncDiagnosticsStore.getState();
  s.recordRequest({ path: '/rest/v1/a', status: 200, at: 1, bodySnippet: '' });
  s.recordRequest({ path: '/rest/v1/b', status: 201, at: 2, bodySnippet: '' });
  assert.deepEqual(syncDiagnosticsStore.getState().lastRequest, {
    path: '/rest/v1/b',
    status: 201,
    at: 2,
    bodySnippet: '',
  });

  s.recordError({ path: '/rest/v1/b', status: null, at: 3, bodySnippet: 'network down' });
  assert.deepEqual(syncDiagnosticsStore.getState().lastError, {
    path: '/rest/v1/b',
    status: null,
    at: 3,
    bodySnippet: 'network down',
  });

  s.recordSave('queued', 'network error — queued for retry', 4);
  assert.deepEqual(syncDiagnosticsStore.getState().lastSave, {
    status: 'queued',
    note: 'network error — queued for retry',
    at: 4,
  });

  s.recordFlush({ flushed: 2, remaining: 1, at: 5 });
  assert.deepEqual(syncDiagnosticsStore.getState().lastFlush, {
    flushed: 2,
    remaining: 1,
    at: 5,
  });
});

test('reset clears every record', () => {
  const s = syncDiagnosticsStore.getState();
  s.recordRequest({ path: '/x', status: 500, at: 1, bodySnippet: 'boom' });
  s.recordSave('failed', 'server rejected the payload (4xx)', 2);
  s.reset();
  const after = syncDiagnosticsStore.getState();
  assert.equal(after.lastRequest, null);
  assert.equal(after.lastSave, null);
});

test('httpPath strips host, query and fragment', () => {
  assert.equal(
    httpPath('https://abc.supabase.co/rest/v1/practice_round_results?select=id'),
    '/rest/v1/practice_round_results',
  );
  assert.equal(httpPath('http://10.0.2.2:54321/rest/v1/round_events'), '/rest/v1/round_events');
  assert.equal(httpPath('not a url /rest/v1/x?y=1'), '/rest/v1/x');
});

test('hostOf returns host only, never scheme or path', () => {
  assert.equal(
    hostOf('https://evzmtxwdsoebekxlqxeo.supabase.co/rest/v1/x'),
    'evzmtxwdsoebekxlqxeo.supabase.co',
  );
  assert.equal(hostOf('http://10.0.2.2:54321'), '10.0.2.2:54321');
  assert.equal(hostOf('garbage'), 'garbage');
});

test('bodySnippet collapses whitespace and truncates', () => {
  assert.equal(bodySnippet('  a\n\n  b   c '), 'a b c');
  const long = 'x'.repeat(500);
  const snip = bodySnippet(long, 10);
  assert.equal(snip, `${'x'.repeat(10)}…`);
});
