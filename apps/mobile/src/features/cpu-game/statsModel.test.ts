import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStatsView, fetchCpuGameStats } from './statsModel';

test('buildStatsView returns empty for a zero-row RPC response', () => {
  assert.deepEqual(buildStatsView([]), { status: 'empty' });
});

test('buildStatsView formats played, won, win rate, and last played at', () => {
  assert.deepEqual(
    buildStatsView([
      {
        rounds_played: 25,
        rounds_won: 10,
        win_rate: 0.4,
        last_played_at: '2026-09-02T10:00:00Z',
      },
    ]),
    {
      status: 'ready',
      roundsPlayed: 25,
      roundsWon: 10,
      winRateLabel: '40.0%',
      lastPlayedAt: '2026-09-02T10:00:00Z',
    },
  );
});

test('buildStatsView treats null win_rate as empty stats', () => {
  assert.deepEqual(
    buildStatsView([{ rounds_played: 0, rounds_won: 0, win_rate: null, last_played_at: null }]),
    { status: 'empty' },
  );
});

test('fetchCpuGameStats calls the stats RPC with anon player and CPU mode', async () => {
  const calls: { url: string; body: string }[] = [];
  const http = {
    async post(url: string, _headers: Record<string, string>, body: string) {
      calls.push({ url, body });
      return {
        status: 200,
        body: JSON.stringify([
          { rounds_played: 2, rounds_won: 1, win_rate: 0.5, last_played_at: null },
        ]),
      };
    },
  };

  const view = await fetchCpuGameStats('anon-1', {
    http,
    supabaseUrl: 'https://example.supabase.co',
    anonKey: 'anon-key',
  });

  assert.equal(view.status, 'ready');
  assert.equal(view.winRateLabel, '50.0%');
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/get_player_mode_stats');
  assert.deepEqual(JSON.parse(calls[0].body), {
    p_anon_player_id: 'anon-1',
    p_mode: 'CPU_PRACTICE',
  });
});
