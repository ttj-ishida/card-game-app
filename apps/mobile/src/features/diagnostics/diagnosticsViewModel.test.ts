import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDiagnosticsView, type DiagnosticsConfig } from './diagnosticsViewModel';
import type { SyncDiagnosticsState } from './syncDiagnosticsStore';

const emptyDiag: Pick<
  SyncDiagnosticsState,
  'lastRequest' | 'lastError' | 'lastSave' | 'lastFlush'
> = {
  lastRequest: null,
  lastError: null,
  lastSave: null,
  lastFlush: null,
};

const config: DiagnosticsConfig = {
  appEnv: 'development',
  supabaseUrl: 'https://evzmtxwdsoebekxlqxeo.supabase.co',
  anonKeyConfigured: true,
};

function row(view: ReturnType<typeof buildDiagnosticsView>, label: string): string {
  const found = view.rows.find((r) => r.label === label);
  assert.ok(found, `missing row: ${label}`);
  return found.value;
}

test('redacts: shows host only and key-presence only — never the full URL', () => {
  const view = buildDiagnosticsView({
    config,
    diag: emptyDiag,
    queueCount: 0,
    anonPlayerId: 'anon-abc',
    connection: null,
    nowMs: 1_000_000,
  });
  assert.equal(row(view, 'Supabase host'), 'evzmtxwdsoebekxlqxeo.supabase.co');
  assert.equal(row(view, 'Anon key'), 'configured');
  // The view input type carries only `anonKeyConfigured: boolean`, never the key body.
  assert.ok(!JSON.stringify(view).includes('https://'), 'full URL must not appear');
});

test('env not configured → syncConfigured false and clear labels', () => {
  const view = buildDiagnosticsView({
    config: null,
    diag: emptyDiag,
    queueCount: 3,
    anonPlayerId: null,
    connection: { kind: 'not-configured' },
    nowMs: 0,
  });
  assert.equal(view.syncConfigured, false);
  assert.equal(row(view, 'App env'), '(env not configured)');
  assert.equal(row(view, 'Supabase host'), '—');
  assert.equal(row(view, 'Anon key'), 'missing');
  assert.equal(row(view, 'Pending queue'), '3');
});

test('surfaces the last save outcome, HTTP error and flush with relative time', () => {
  const now = 1_000_000;
  const view = buildDiagnosticsView({
    config,
    diag: {
      lastRequest: {
        path: '/rest/v1/practice_round_results',
        status: 201,
        at: now - 5_000,
        bodySnippet: '',
      },
      lastError: {
        path: '/rest/v1/practice_round_results',
        status: null,
        at: now - 65_000,
        bodySnippet: 'TypeError: Network request failed',
      },
      lastSave: {
        status: 'queued',
        note: 'network/server error — queued for retry',
        at: now - 5_000,
      },
      lastFlush: { flushed: 0, remaining: 2, at: now - 3_600_000 },
    },
    queueCount: 2,
    anonPlayerId: 'anon-abc',
    connection: { kind: 'unreachable' },
    nowMs: now,
  });
  assert.match(
    row(view, 'Last save'),
    /^queued · network\/server error — queued for retry · 5s ago$/,
  );
  assert.match(row(view, 'Last HTTP'), /^201 \/rest\/v1\/practice_round_results · 5s ago$/);
  assert.match(
    row(view, 'Last HTTP error'),
    /^network \/rest\/v1\/practice_round_results · 1m ago$/,
  );
  assert.equal(row(view, 'Last error body'), 'TypeError: Network request failed');
  assert.match(row(view, 'Last retry (flush)'), /^flushed 0, remaining 2 · 1h ago$/);
  assert.equal(row(view, 'Connection test'), 'unreachable (network error)');
});

test('connection test labels', () => {
  const base = { config, diag: emptyDiag, queueCount: 0, anonPlayerId: null, nowMs: 0 };
  assert.equal(
    row(
      buildDiagnosticsView({ ...base, connection: { kind: 'ok', status: 200 } }),
      'Connection test',
    ),
    'ok (200)',
  );
  assert.equal(
    row(
      buildDiagnosticsView({ ...base, connection: { kind: 'unauthorized', status: 401 } }),
      'Connection test',
    ),
    'key rejected (401)',
  );
  assert.equal(
    row(buildDiagnosticsView({ ...base, connection: null }), 'Connection test'),
    'not tested',
  );
});
