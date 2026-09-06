import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import type { OnlineHttpPort } from '../features/online-room/onlineRoomClient';
import {
  __resetOnlineRoomStoreForTest,
  configureOnlineRoomStore,
  onlineRoomStore,
} from './onlineRoomStore';

type Response = { status: number; body: string };

function storage(): StoragePort {
  return {
    getItem: async () =>
      JSON.stringify({ accessToken: 'access-1', refreshToken: null, expiresAtMs: 120_000 }),
    setItem: async () => undefined,
  };
}

function http(responses: Response[]): OnlineHttpPort {
  let i = 0;
  const next = () => responses[Math.min(i++, responses.length - 1)] ?? { status: 200, body: '' };
  return {
    async get() {
      return next();
    },
    async post() {
      return next();
    },
  };
}

function roomBody() {
  return JSON.stringify([
    {
      id: 'room-1',
      invite_code: 'ROOM123',
      status: 'WAITING',
      max_players: 4,
      turn_seconds: 60,
      cpu_takeover_enabled: true,
    },
  ]);
}

function seatsBody(
  seats: { player_id: string; seat_index: number; role: string; status: string }[] = [
    { player_id: 'player-1', seat_index: 0, role: 'HOST', status: 'JOINED' },
  ],
) {
  return JSON.stringify(seats);
}

function inRoundRoomBody() {
  return JSON.stringify([
    {
      id: 'room-1',
      invite_code: 'ROOM123',
      status: 'IN_ROUND',
      max_players: 2,
      turn_seconds: 60,
      cpu_takeover_enabled: true,
    },
  ]);
}

function configure(fakeHttp: OnlineHttpPort) {
  configureOnlineRoomStore({
    http: fakeHttp,
    storage: storage(),
    supabaseUrl: 'https://example.supabase.co',
    anonKey: 'anon-key',
    now: () => 1_000,
  });
}

beforeEach(() => {
  __resetOnlineRoomStoreForTest();
});

describe('onlineRoomStore', () => {
  it('creates a room and loads the waiting room view', async () => {
    configure(
      http([
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
        { status: 200, body: roomBody() },
        { status: 200, body: seatsBody() },
      ]),
    );

    onlineRoomStore.getState().setInviteCode(' room123 ');
    await onlineRoomStore
      .getState()
      .createRoom({ maxPlayers: 4, turnSeconds: 60, cpuTakeoverEnabled: true });

    assert.equal(onlineRoomStore.getState().status, 'ready');
    assert.equal(onlineRoomStore.getState().inviteCode, 'ROOM123');
    assert.equal(onlineRoomStore.getState().room?.seats.length, 1);
    assert.equal(onlineRoomStore.getState().myPlayerId, 'player-1');
  });

  it('rejects empty invite code before network access', async () => {
    configure(http([]));

    await onlineRoomStore
      .getState()
      .createRoom({ maxPlayers: 4, turnSeconds: 60, cpuTakeoverEnabled: true });

    assert.equal(onlineRoomStore.getState().status, 'failed');
    assert.equal(onlineRoomStore.getState().errorMessageKey, 'onlineRoom.error.inviteRequired');
  });

  it('rejects a malformed invite code before network access', async () => {
    let posted = false;
    configure({
      async get() {
        return { status: 200, body: '' };
      },
      async post() {
        posted = true;
        return { status: 200, body: '' };
      },
    });

    onlineRoomStore.getState().setInviteCode('ああ');
    await onlineRoomStore
      .getState()
      .createRoom({ maxPlayers: 4, turnSeconds: 60, cpuTakeoverEnabled: true });

    assert.equal(onlineRoomStore.getState().status, 'failed');
    assert.equal(onlineRoomStore.getState().errorMessageKey, 'onlineRoom.error.inviteInvalid');
    assert.equal(posted, false);
  });

  it('maps a taken invite code to a specific message', async () => {
    configure(
      http([
        { status: 400, body: JSON.stringify({ code: 'P0001', message: 'INVITE_CODE_TAKEN' }) },
      ]),
    );

    onlineRoomStore.getState().setInviteCode('ROOM123');
    await onlineRoomStore
      .getState()
      .createRoom({ maxPlayers: 4, turnSeconds: 60, cpuTakeoverEnabled: true });

    assert.equal(onlineRoomStore.getState().status, 'failed');
    assert.equal(onlineRoomStore.getState().errorMessageKey, 'onlineRoom.error.inviteTaken');
  });

  it('maps "room not found" on join to a specific message', async () => {
    configure(
      http([{ status: 400, body: JSON.stringify({ code: 'P0001', message: 'room not found' }) }]),
    );

    onlineRoomStore.getState().setInviteCode('NOPE99');
    await onlineRoomStore.getState().joinRoom();

    assert.equal(onlineRoomStore.getState().status, 'failed');
    assert.equal(onlineRoomStore.getState().errorMessageKey, 'onlineRoom.error.roomNotFound');
  });

  it('joins a room and then starts the round', async () => {
    configure(
      http([
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
        { status: 200, body: roomBody() },
        { status: 200, body: seatsBody() },
        { status: 200, body: JSON.stringify({ round_id: 'round-1' }) },
      ]),
    );

    onlineRoomStore.getState().setInviteCode('ROOM123');
    await onlineRoomStore.getState().joinRoom();
    assert.equal(onlineRoomStore.getState().myPlayerId, 'player-2');
    await onlineRoomStore.getState().startRound();

    assert.equal(onlineRoomStore.getState().status, 'started');
    assert.equal(onlineRoomStore.getState().roundId, 'round-1');
  });

  it('maps "only host can start the round" to a specific message', async () => {
    configure(
      http([
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
        { status: 200, body: roomBody() },
        { status: 200, body: seatsBody() },
        {
          status: 400,
          body: JSON.stringify({ code: 'P0001', message: 'only host can start the round' }),
        },
      ]),
    );

    onlineRoomStore.getState().setInviteCode('ROOM123');
    await onlineRoomStore.getState().joinRoom();
    await onlineRoomStore.getState().startRound();

    assert.equal(onlineRoomStore.getState().status, 'failed');
    assert.equal(onlineRoomStore.getState().errorMessageKey, 'onlineRoom.error.notHost');
  });

  it('pollRoom reflects new seats without entering the loading state', async () => {
    configure(
      http([
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
        { status: 200, body: roomBody() },
        { status: 200, body: seatsBody() },
        // pollRoom
        { status: 200, body: roomBody() },
        {
          status: 200,
          body: seatsBody([
            { player_id: 'player-1', seat_index: 0, role: 'HOST', status: 'JOINED' },
            { player_id: 'player-2', seat_index: 1, role: 'GUEST', status: 'JOINED' },
          ]),
        },
      ]),
    );

    onlineRoomStore.getState().setInviteCode('ROOM123');
    await onlineRoomStore
      .getState()
      .createRoom({ maxPlayers: 2, turnSeconds: 60, cpuTakeoverEnabled: true });
    await onlineRoomStore.getState().pollRoom();

    assert.equal(onlineRoomStore.getState().status, 'ready');
    assert.equal(onlineRoomStore.getState().room?.seats.length, 2);
  });

  it('pollRoom moves to "started" with the round id once the host has started', async () => {
    configure(
      http([
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
        { status: 200, body: roomBody() },
        { status: 200, body: seatsBody() },
        // pollRoom: room now IN_ROUND
        { status: 200, body: inRoundRoomBody() },
        { status: 200, body: seatsBody() },
        { status: 200, body: JSON.stringify([{ id: 'round-1' }]) },
      ]),
    );

    onlineRoomStore.getState().setInviteCode('ROOM123');
    await onlineRoomStore.getState().joinRoom();
    await onlineRoomStore.getState().pollRoom();

    assert.equal(onlineRoomStore.getState().status, 'started');
    assert.equal(onlineRoomStore.getState().roundId, 'round-1');
  });

  it('pollRoom ignores a transient fetch failure and keeps the lobby usable', async () => {
    configure(
      http([
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
        { status: 200, body: roomBody() },
        { status: 200, body: seatsBody() },
        { status: 500, body: 'oops' },
      ]),
    );

    onlineRoomStore.getState().setInviteCode('ROOM123');
    await onlineRoomStore
      .getState()
      .createRoom({ maxPlayers: 2, turnSeconds: 60, cpuTakeoverEnabled: true });
    await onlineRoomStore.getState().pollRoom();

    assert.equal(onlineRoomStore.getState().status, 'ready');
    assert.equal(onlineRoomStore.getState().errorMessageKey, null);
  });
});
