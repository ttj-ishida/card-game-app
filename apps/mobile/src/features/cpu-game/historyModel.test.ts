import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHistoryView, fetchCpuGameHistory } from './historyModel';

test('buildHistoryView maps saved results and public events into display keys', () => {
  const view = buildHistoryView(
    [
      {
        id: 'round-1',
        recorded_at: '2026-09-02T10:00:00Z',
        player_count: 3,
        local_won: true,
        turn_count: 12,
        ruleset_id: 'ruleset-1',
      },
    ],
    {
      'round-1': [
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
          hand_counts_after: { 'seat-0': 4 },
        },
      ],
    },
  );

  assert.deepEqual(view, [
    {
      roundResultId: 'round-1',
      recordedAt: '2026-09-02T10:00:00Z',
      playerCount: 3,
      localWon: true,
      turnCount: 12,
      hasRuleset: true,
      eventsMissing: false,
      events: [
        {
          index: 0,
          seatId: 'seat-0',
          seatKind: 'HUMAN',
          kind: 'PLAY',
          actionKind: 'LEAD',
          cardKeys: [{ rankKey: 'rank.RANK_5', suitKey: 'suit.SUIT_FIRE' }],
          skillEffectKey: 'skillUse.JOKER_TRANSFORM',
          fieldCleared: false,
          dayNightKey: 'dayNight.DAY',
        },
      ],
    },
  ]);
});

test('buildHistoryView marks missing event rows without leaking private data', () => {
  const view = buildHistoryView(
    [
      {
        id: 'round-2',
        recorded_at: '2026-09-02T11:00:00Z',
        player_count: 4,
        local_won: false,
        turn_count: 20,
        ruleset_id: null,
      },
    ],
    {},
  );

  assert.equal(view[0].eventsMissing, true);
  assert.deepEqual(view[0].events, []);
  assert.equal(view[0].hasRuleset, false);
});

test('fetchCpuGameHistory reads recent result rows and their round_events rows', async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const http = {
    async get(url: string, headers: Record<string, string>) {
      calls.push({ url, headers });
      if (url.includes('practice_round_results')) {
        return {
          status: 200,
          body: JSON.stringify([
            {
              id: 'round-1',
              recorded_at: '2026-09-02T10:00:00Z',
              player_count: 3,
              local_won: true,
              turn_count: 12,
              ruleset_id: 'ruleset-1',
            },
          ]),
        };
      }
      return {
        status: 200,
        body: JSON.stringify([{ round_result_id: 'round-1', events: [] }]),
      };
    },
  };

  const view = await fetchCpuGameHistory('anon-1', {
    http,
    supabaseUrl: 'https://example.supabase.co',
    anonKey: 'anon-key',
  });

  assert.equal(view.status, 'ready');
  assert.equal(view.items.length, 1);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /anon_player_id=eq\.anon-1/);
  assert.match(calls[1].url, /round_result_id=in\.\("round-1"\)/);
});
