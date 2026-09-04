import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import type { OnlineHttpPort } from '../features/online-room/onlineRoomClient';
import {
  __resetOnlineRoundStoreForTest,
  configureOnlineRoundStore,
  onlineRoundStore,
} from './onlineRoundStore';

type Response = { status: number; body: string };

function storage(): StoragePort {
  return {
    getItem: async () =>
      JSON.stringify({ accessToken: 'access-1', refreshToken: null, expiresAtMs: 120_000 }),
    setItem: async () => undefined,
  };
}

function http(responses: Response[]): OnlineHttpPort & { calls: { url: string; body?: string }[] } {
  const calls: { url: string; body?: string }[] = [];
  let i = 0;
  const next = () => responses[Math.min(i++, responses.length - 1)] ?? { status: 200, body: '' };
  return {
    calls,
    async get(url) {
      calls.push({ url });
      return next();
    },
    async post(url, _headers, body) {
      calls.push({ url, body });
      return next();
    },
  };
}

function configure(fakeHttp: OnlineHttpPort, makeId: () => string = () => 'request-1') {
  configureOnlineRoundStore({
    http: fakeHttp,
    storage: storage(),
    supabaseUrl: 'https://example.supabase.co',
    anonKey: 'anon-key',
    now: () => 1_000,
    makeId,
  });
}

function snapshotBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    ok: true,
    round_id: 'round-1',
    player_id: 'player-1',
    state_version: 4,
    latest_event_seq: 1,
    public_state: {
      state_version: 4,
      day_night: 'DAY',
      active_player_id: 'player-1',
      active_field: {},
      hand_counts: { 'player-1': 2, 'player-2': 2 },
    },
    hand: [
      { card_id: 'CARD_NUMBER_RANK_5_SUIT_FIRE', position: 0, card_state: 'IN_HAND' },
      { card_id: 'CARD_NUMBER_RANK_7_SUIT_WATER', position: 1, card_state: 'IN_HAND' },
    ],
    skills: [],
    events: [
      {
        event_seq: 1,
        state_version: 4,
        event_kind: 'ROUND_STARTED',
        actor_player_id: null,
        public_payload: {},
        created_at: '2026-09-05T00:00:00Z',
      },
    ],
    ...overrides,
  });
}

beforeEach(() => {
  __resetOnlineRoundStoreForTest();
});

describe('onlineRoundStore', () => {
  it('starts a round and builds the view model from the snapshot', async () => {
    configure(http([{ status: 200, body: snapshotBody() }]));

    await onlineRoundStore.getState().start('round-1');

    const state = onlineRoundStore.getState();
    assert.equal(state.status, 'ready');
    assert.equal(state.connection, 'online');
    assert.equal(state.view?.roundId, 'round-1');
    assert.equal(state.view?.hand.length, 2);
    assert.equal(state.eventLog.length, 1);
  });

  it('toggles card selection', async () => {
    configure(http([{ status: 200, body: snapshotBody() }]));
    await onlineRoundStore.getState().start('round-1');

    onlineRoundStore.getState().selectCard('CARD_NUMBER_RANK_5_SUIT_FIRE');
    assert.deepEqual(onlineRoundStore.getState().selection, ['CARD_NUMBER_RANK_5_SUIT_FIRE']);

    onlineRoundStore.getState().selectCard('CARD_NUMBER_RANK_5_SUIT_FIRE');
    assert.deepEqual(onlineRoundStore.getState().selection, []);
  });

  it('confines selection to skill-shaped plays while a skill is declared', async () => {
    configure(http([{ status: 200, body: snapshotBody() }]));
    await onlineRoundStore.getState().start('round-1');

    onlineRoundStore.getState().declareSkill('EXTENSION_SEAL');
    assert.deepEqual(onlineRoundStore.getState().pendingSkill, { useSkill: 'EXTENSION_SEAL' });

    // No skill card is held in this snapshot, so no EXTENSION_SEAL play is
    // legal — selection must stay empty even though a plain lead of this
    // card would otherwise be legal.
    onlineRoundStore.getState().selectCard('CARD_NUMBER_RANK_5_SUIT_FIRE');
    assert.deepEqual(onlineRoundStore.getState().selection, []);

    onlineRoundStore.getState().cancelSkill();
    onlineRoundStore.getState().selectCard('CARD_NUMBER_RANK_5_SUIT_FIRE');
    assert.deepEqual(onlineRoundStore.getState().selection, ['CARD_NUMBER_RANK_5_SUIT_FIRE']);
  });

  it('submits a play and refreshes the round from the server', async () => {
    configure(
      http([
        { status: 200, body: snapshotBody() },
        {
          status: 200,
          body: JSON.stringify({
            ok: true,
            dry_run: false,
            request_id: 'request-1',
            round_id: 'round-1',
            state_version: 5,
            event_seq: 2,
            outcome: {
              action_kind: 'LEAD',
              field_cleared: false,
              day_night_after: 'DAY',
              winner_id: null,
            },
          }),
        },
        {
          status: 200,
          body: snapshotBody({
            state_version: 5,
            latest_event_seq: 2,
            public_state: {
              state_version: 5,
              day_night: 'DAY',
              active_player_id: 'player-2',
              active_field: {},
              hand_counts: { 'player-1': 1, 'player-2': 2 },
            },
            hand: [
              { card_id: 'CARD_NUMBER_RANK_7_SUIT_WATER', position: 0, card_state: 'IN_HAND' },
            ],
            events: [
              {
                event_seq: 2,
                state_version: 5,
                event_kind: 'PLAY_ACCEPTED',
                actor_player_id: 'player-1',
                public_payload: { action_kind: 'LEAD', cards: [], field_cleared: false },
                created_at: '2026-09-05T00:00:01Z',
              },
            ],
          }),
        },
      ]),
    );
    await onlineRoundStore.getState().start('round-1');
    onlineRoundStore.getState().selectCard('CARD_NUMBER_RANK_5_SUIT_FIRE');

    const result = await onlineRoundStore.getState().submitPlay();

    assert.equal(result.ok, true);
    const state = onlineRoundStore.getState();
    assert.equal(state.view?.stateVersion, 5);
    assert.equal(state.view?.hand.length, 1);
    assert.deepEqual(state.selection, []);
    assert.equal(state.eventLog.length, 2);
  });

  it('surfaces a rejection reason and resyncs on a stale state version', async () => {
    configure(
      http([
        { status: 200, body: snapshotBody() },
        {
          status: 409,
          body: JSON.stringify({
            ok: false,
            reason: 'STALE_STATE_VERSION',
            current_state_version: 6,
          }),
        },
        { status: 200, body: snapshotBody({ state_version: 6 }) },
      ]),
    );
    await onlineRoundStore.getState().start('round-1');
    onlineRoundStore.getState().selectCard('CARD_NUMBER_RANK_5_SUIT_FIRE');

    const result = await onlineRoundStore.getState().submitPlay();

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'STALE_STATE_VERSION');
    assert.equal(onlineRoundStore.getState().status, 'ready');
    assert.equal(onlineRoundStore.getState().view?.stateVersion, 6);
  });

  it('marks the connection as reconnecting when a poll fails, keeping the last known view', async () => {
    configure(
      http([
        { status: 200, body: snapshotBody() },
        { status: 500, body: 'boom' },
      ]),
    );
    await onlineRoundStore.getState().start('round-1');

    await onlineRoundStore.getState().poll();

    const state = onlineRoundStore.getState();
    assert.equal(state.connection, 'reconnecting');
    assert.ok(state.reconnectSinceMs != null);
    assert.equal(state.view?.roundId, 'round-1');
  });

  it('records the winner once a play event reports one', async () => {
    configure(
      http([
        { status: 200, body: snapshotBody() },
        {
          status: 200,
          body: snapshotBody({
            events: [
              {
                event_seq: 2,
                state_version: 5,
                event_kind: 'PLAY_ACCEPTED',
                actor_player_id: 'player-1',
                public_payload: { action_kind: 'LEAD', winner_id: 'player-1' },
                created_at: '2026-09-05T00:00:01Z',
              },
            ],
          }),
        },
      ]),
    );
    await onlineRoundStore.getState().start('round-1');
    await onlineRoundStore.getState().poll();

    assert.equal(onlineRoundStore.getState().winnerPlayerId, 'player-1');
  });

  it('rejects submitting when it is not the local player’s turn', async () => {
    configure(
      http([
        {
          status: 200,
          body: snapshotBody({
            public_state: {
              state_version: 4,
              day_night: 'DAY',
              active_player_id: 'player-2',
              active_field: {},
              hand_counts: { 'player-1': 2, 'player-2': 2 },
            },
          }),
        },
      ]),
    );
    await onlineRoundStore.getState().start('round-1');
    onlineRoundStore.getState().selectCard('CARD_NUMBER_RANK_5_SUIT_FIRE');

    const result = await onlineRoundStore.getState().submitPlay();

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'NOT_ACTIVE_PLAYER');
  });

  it('leaves the round and resets local state', async () => {
    configure(
      http([
        { status: 200, body: snapshotBody() },
        {
          status: 200,
          body: JSON.stringify({
            ok: true,
            round_id: 'round-1',
            player_id: 'player-1',
            status: 'CPU_TAKEOVER',
            cpu_takeover: true,
            state_version: 5,
            event_seq: 2,
            winner_player_id: null,
          }),
        },
      ]),
    );
    await onlineRoundStore.getState().start('round-1');

    await onlineRoundStore.getState().leaveRound(true);

    assert.equal(onlineRoundStore.getState().roundId, null);
    assert.equal(onlineRoundStore.getState().view, null);
  });
});
