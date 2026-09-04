import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { StoragePort } from '../cpu-game/anonPlayerId';
import {
  createOnlineRoom,
  ensureOnlineAuthSession,
  fetchOnlineRoundSnapshot,
  fetchOnlineWaitingRoom,
  joinOnlineRoom,
  startOnlineRound,
  submitOnlinePlayRequest,
  type OnlineHttpPort,
} from './onlineRoomClient';

const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-key';

type RecordedCall = {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
};

function storage(initial?: Record<string, string>): StoragePort & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial ?? {}));
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

function http(
  responses: { status: number; body: string }[],
): OnlineHttpPort & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let i = 0;
  const next = () => responses[Math.min(i++, responses.length - 1)] ?? { status: 200, body: '' };
  return {
    calls,
    async get(url, headers) {
      calls.push({ method: 'GET', url, headers });
      return next();
    },
    async post(url, headers, body) {
      calls.push({ method: 'POST', url, headers, body });
      return next();
    },
  };
}

function deps(fakeHttp: OnlineHttpPort, fakeStorage: StoragePort = storage()) {
  return {
    http: fakeHttp,
    storage: fakeStorage,
    supabaseUrl: SUPABASE_URL,
    anonKey: ANON_KEY,
    now: () => 1_000,
  };
}

describe('ensureOnlineAuthSession', () => {
  it('creates and stores an anonymous Supabase session', async () => {
    const fakeStorage = storage();
    const fakeHttp = http([
      {
        status: 200,
        body: JSON.stringify({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
        }),
      },
    ]);

    const session = await ensureOnlineAuthSession(deps(fakeHttp, fakeStorage));

    assert.equal(session.accessToken, 'access-1');
    assert.equal(fakeHttp.calls[0].url, `${SUPABASE_URL}/auth/v1/signup`);
    assert.equal(fakeHttp.calls[0].headers.apikey, ANON_KEY);
    assert.equal(fakeStorage.data.has('onlineRoom.authSession.v1'), true);
  });

  it('reuses a stored unexpired session without calling auth', async () => {
    const fakeStorage = storage({
      'onlineRoom.authSession.v1': JSON.stringify({
        accessToken: 'stored-access',
        refreshToken: null,
        expiresAtMs: 120_000,
      }),
    });
    const fakeHttp = http([]);

    const session = await ensureOnlineAuthSession(deps(fakeHttp, fakeStorage));

    assert.equal(session.accessToken, 'stored-access');
    assert.equal(fakeHttp.calls.length, 0);
  });
});

describe('online room RPC client', () => {
  it('createOnlineRoom normalizes invite code and calls create_friend_room', async () => {
    const fakeHttp = http([
      { status: 200, body: JSON.stringify({ access_token: 'access-1', expires_in: 3600 }) },
      {
        status: 200,
        body: JSON.stringify({
          room_id: 'room-1',
          player_id: 'player-1',
          invite_code: 'ROOM123',
          seat_index: 0,
          status: 'JOINED',
        }),
      },
    ]);

    const result = await createOnlineRoom(
      ' room123 ',
      { maxPlayers: 4, turnSeconds: 60, cpuTakeoverEnabled: true },
      deps(fakeHttp),
    );

    assert.equal(result.room_id, 'room-1');
    assert.equal(fakeHttp.calls[1].url, `${SUPABASE_URL}/rest/v1/rpc/create_friend_room`);
    assert.equal(fakeHttp.calls[1].headers.Authorization, 'Bearer access-1');
    assert.deepEqual(JSON.parse(fakeHttp.calls[1].body ?? ''), {
      requested_invite_code: 'ROOM123',
      requested_max_players: 4,
      requested_turn_seconds: 60,
      requested_cpu_takeover_enabled: true,
    });
  });

  it('joinOnlineRoom calls join_friend_room with normalized invite code', async () => {
    const fakeStorage = storage({
      'onlineRoom.authSession.v1': JSON.stringify({
        accessToken: 'stored-access',
        refreshToken: null,
        expiresAtMs: 120_000,
      }),
    });
    const fakeHttp = http([
      {
        status: 200,
        body: JSON.stringify({
          room_id: 'room-1',
          player_id: 'player-2',
          invite_code: 'ROOM123',
          seat_index: 1,
          status: 'JOINED',
        }),
      },
    ]);

    await joinOnlineRoom(' room123 ', deps(fakeHttp, fakeStorage));

    assert.equal(fakeHttp.calls[0].url, `${SUPABASE_URL}/rest/v1/rpc/join_friend_room`);
    assert.deepEqual(JSON.parse(fakeHttp.calls[0].body ?? ''), {
      requested_invite_code: 'ROOM123',
    });
  });

  it('startOnlineRound returns the round id', async () => {
    const fakeStorage = storage({
      'onlineRoom.authSession.v1': JSON.stringify({
        accessToken: 'stored-access',
        refreshToken: null,
        expiresAtMs: 120_000,
      }),
    });
    const fakeHttp = http([{ status: 200, body: JSON.stringify({ round_id: 'round-1' }) }]);

    assert.equal(await startOnlineRound('room-1', deps(fakeHttp, fakeStorage)), 'round-1');
    assert.equal(fakeHttp.calls[0].url, `${SUPABASE_URL}/rest/v1/rpc/start_friend_round`);
  });

  it('fetchOnlineWaitingRoom joins room and seat rows into a view', async () => {
    const fakeStorage = storage({
      'onlineRoom.authSession.v1': JSON.stringify({
        accessToken: 'stored-access',
        refreshToken: null,
        expiresAtMs: 120_000,
      }),
    });
    const fakeHttp = http([
      {
        status: 200,
        body: JSON.stringify([
          {
            id: 'room-1',
            invite_code: 'ROOM123',
            status: 'WAITING',
            max_players: 4,
            turn_seconds: 60,
            cpu_takeover_enabled: true,
          },
        ]),
      },
      {
        status: 200,
        body: JSON.stringify([
          { player_id: 'player-1', seat_index: 0, role: 'HOST', status: 'JOINED' },
          { player_id: 'player-2', seat_index: 1, role: 'GUEST', status: 'JOINED' },
        ]),
      },
    ]);

    const view = await fetchOnlineWaitingRoom('room-1', deps(fakeHttp, fakeStorage));

    assert.equal(view.inviteCode, 'ROOM123');
    assert.equal(view.seats.length, 2);
    assert.equal(view.seats[0].role, 'HOST');
    assert.match(fakeHttp.calls[0].url, /rooms\?select=/);
    assert.match(fakeHttp.calls[1].url, /room_players\?select=/);
  });
  it('fetchOnlineRoundSnapshot calls the snapshot RPC with after_state_version', async () => {
    const fakeStorage = storage({
      'onlineRoom.authSession.v1': JSON.stringify({
        accessToken: 'stored-access',
        refreshToken: null,
        expiresAtMs: 120_000,
      }),
    });
    const body = {
      ok: true,
      round_id: 'round-1',
      player_id: 'player-1',
      state_version: 4,
      latest_event_seq: 9,
      public_state: {
        state_version: 4,
        day_night: 'DAY',
        active_player_id: 'player-1',
        active_field: {},
        hand_counts: { 'player-1': 6 },
      },
      hand: [],
      skills: [],
      events: [],
    };
    const fakeHttp = http([{ status: 200, body: JSON.stringify(body) }]);

    const snapshot = await fetchOnlineRoundSnapshot('round-1', 3, deps(fakeHttp, fakeStorage));

    assert.equal(snapshot.state_version, 4);
    assert.equal(fakeHttp.calls[0].url, `${SUPABASE_URL}/rest/v1/rpc/get_friend_round_snapshot`);
    assert.deepEqual(JSON.parse(fakeHttp.calls[0].body ?? ''), {
      target_round_id: 'round-1',
      after_state_version: 3,
    });
  });
  it('submitOnlinePlayRequest posts a guarded play request to the Edge Function', async () => {
    const fakeStorage = storage({
      'onlineRoom.authSession.v1': JSON.stringify({
        accessToken: 'stored-access',
        refreshToken: null,
        expiresAtMs: 120_000,
      }),
    });
    const fakeHttp = http([
      {
        status: 409,
        body: JSON.stringify({
          ok: false,
          reason: 'STALE_STATE_VERSION',
          current_state_version: 3,
        }),
      },
    ]);

    const result = await submitOnlinePlayRequest(
      'round-1',
      2,
      'request-1',
      { kind: 'PASS', playerId: 'player-1' },
      deps(fakeHttp, fakeStorage),
    );

    assert.deepEqual(result, {
      ok: false,
      reason: 'STALE_STATE_VERSION',
      current_state_version: 3,
    });
    assert.equal(fakeHttp.calls[0].url, `${SUPABASE_URL}/functions/v1/submit-play`);
    assert.deepEqual(JSON.parse(fakeHttp.calls[0].body ?? ''), {
      round_id: 'round-1',
      request_id: 'request-1',
      expected_state_version: 2,
      play: { kind: 'PASS', playerId: 'player-1' },
    });
  });
});
