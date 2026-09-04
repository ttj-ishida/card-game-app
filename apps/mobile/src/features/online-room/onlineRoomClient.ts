import type { PlayInput } from '@card-game-app/game-core';

import type { OnlineRoundSnapshotResponse } from './onlineRoundViewModel';
import type { StoragePort } from '../cpu-game/anonPlayerId';

export type OnlineHttpPort = {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }>;
  post(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ status: number; body: string }>;
};

export type OnlineRoomDeps = {
  http: OnlineHttpPort;
  storage: StoragePort;
  supabaseUrl: string;
  anonKey: string;
  now: () => number;
};

export type OnlineAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAtMs: number;
};

export type OnlineRoomRpcResult = {
  room_id: string;
  player_id: string;
  invite_code: string;
  seat_index: number;
  status: string;
};

export type OnlinePlayRequestResult =
  | {
      ok: true;
      dry_run: false;
      request_id: string;
      round_id: string;
      state_version: number;
      event_seq: number;
      outcome: {
        action_kind: 'LEAD' | 'EXTEND' | 'REPLACE' | 'PASS';
        field_cleared: boolean;
        day_night_after: 'DAY' | 'NIGHT';
        winner_id: string | null;
      };
    }
  | {
      ok: false;
      reason: string;
      current_state_version?: number;
    };
export type OnlineRoomSettings = {
  maxPlayers: number;
  turnSeconds: number;
  cpuTakeoverEnabled: boolean;
};

export type OnlineRoomSeat = {
  playerId: string;
  seatIndex: number;
  role: 'HOST' | 'GUEST' | 'CPU';
  status: 'JOINED' | 'READY' | 'LEFT';
};

export type OnlineWaitingRoomView = {
  roomId: string;
  inviteCode: string;
  status: 'WAITING' | 'IN_ROUND' | 'CLOSED';
  maxPlayers: number;
  turnSeconds: number;
  cpuTakeoverEnabled: boolean;
  seats: OnlineRoomSeat[];
};

const SESSION_KEY = 'onlineRoom.authSession.v1';
const SESSION_LEEWAY_MS = 60_000;

function baseHeaders(deps: OnlineRoomDeps, session?: OnlineAuthSession): Record<string, string> {
  return {
    apikey: deps.anonKey,
    Authorization: `Bearer ${session?.accessToken ?? deps.anonKey}`,
    'Content-Type': 'application/json',
  };
}

function parseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

function rpcUrl(deps: OnlineRoomDeps, name: string): string {
  return `${deps.supabaseUrl}/rest/v1/rpc/${name}`;
}

function tableUrl(deps: OnlineRoomDeps, path: string): string {
  return `${deps.supabaseUrl}/rest/v1/${path}`;
}

function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

function parseStoredSession(raw: string | null, now: number): OnlineAuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OnlineAuthSession>;
    if (
      typeof parsed.accessToken !== 'string' ||
      parsed.accessToken.length === 0 ||
      typeof parsed.expiresAtMs !== 'number'
    ) {
      return null;
    }
    if (parsed.expiresAtMs <= now + SESSION_LEEWAY_MS) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      expiresAtMs: parsed.expiresAtMs,
    };
  } catch {
    return null;
  }
}

export async function ensureOnlineAuthSession(deps: OnlineRoomDeps): Promise<OnlineAuthSession> {
  const stored = parseStoredSession(await deps.storage.getItem(SESSION_KEY), deps.now());
  if (stored) return stored;

  const response = await deps.http.post(
    `${deps.supabaseUrl}/auth/v1/signup`,
    baseHeaders(deps),
    JSON.stringify({ data: { app: 'card-game-app' } }),
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Online anonymous sign-in failed: ${response.status}`);
  }

  const body = parseJson<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  }>(response.body);
  if (!body.access_token) throw new Error('Online anonymous sign-in returned no access token');

  const session: OnlineAuthSession = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAtMs: deps.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
  await deps.storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function createOnlineRoom(
  inviteCode: string,
  settings: OnlineRoomSettings,
  deps: OnlineRoomDeps,
): Promise<OnlineRoomRpcResult> {
  const session = await ensureOnlineAuthSession(deps);
  const response = await deps.http.post(
    rpcUrl(deps, 'create_friend_room'),
    baseHeaders(deps, session),
    JSON.stringify({
      requested_invite_code: normalizeInviteCode(inviteCode),
      requested_max_players: settings.maxPlayers,
      requested_turn_seconds: settings.turnSeconds,
      requested_cpu_takeover_enabled: settings.cpuTakeoverEnabled,
    }),
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Create online room failed: ${response.status}`);
  }
  return parseJson<OnlineRoomRpcResult>(response.body);
}

export async function joinOnlineRoom(
  inviteCode: string,
  deps: OnlineRoomDeps,
): Promise<OnlineRoomRpcResult> {
  const session = await ensureOnlineAuthSession(deps);
  const response = await deps.http.post(
    rpcUrl(deps, 'join_friend_room'),
    baseHeaders(deps, session),
    JSON.stringify({ requested_invite_code: normalizeInviteCode(inviteCode) }),
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Join online room failed: ${response.status}`);
  }
  return parseJson<OnlineRoomRpcResult>(response.body);
}

export async function startOnlineRound(roomId: string, deps: OnlineRoomDeps): Promise<string> {
  const session = await ensureOnlineAuthSession(deps);
  const response = await deps.http.post(
    rpcUrl(deps, 'start_friend_round'),
    baseHeaders(deps, session),
    JSON.stringify({ target_room_id: roomId }),
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Start online round failed: ${response.status}`);
  }
  return parseJson<{ round_id: string }>(response.body).round_id;
}

export async function fetchOnlineWaitingRoom(
  roomId: string,
  deps: OnlineRoomDeps,
): Promise<OnlineWaitingRoomView> {
  const session = await ensureOnlineAuthSession(deps);
  const headers = baseHeaders(deps, session);
  const roomResponse = await deps.http.get(
    tableUrl(
      deps,
      `rooms?select=id,invite_code,status,max_players,turn_seconds,cpu_takeover_enabled&id=eq.${roomId}`,
    ),
    headers,
  );
  if (roomResponse.status < 200 || roomResponse.status >= 300) {
    throw new Error(`Fetch online room failed: ${roomResponse.status}`);
  }
  const room = parseJson<
    {
      id: string;
      invite_code: string;
      status: OnlineWaitingRoomView['status'];
      max_players: number;
      turn_seconds: number;
      cpu_takeover_enabled: boolean;
    }[]
  >(roomResponse.body)[0];
  if (!room) throw new Error('Online room not found');

  const seatsResponse = await deps.http.get(
    tableUrl(
      deps,
      `room_players?select=player_id,seat_index,role,status&room_id=eq.${roomId}&order=seat_index.asc`,
    ),
    headers,
  );
  if (seatsResponse.status < 200 || seatsResponse.status >= 300) {
    throw new Error(`Fetch online room seats failed: ${seatsResponse.status}`);
  }
  const seats = parseJson<
    {
      player_id: string;
      seat_index: number;
      role: OnlineRoomSeat['role'];
      status: OnlineRoomSeat['status'];
    }[]
  >(seatsResponse.body).map((seat) => ({
    playerId: seat.player_id,
    seatIndex: seat.seat_index,
    role: seat.role,
    status: seat.status,
  }));

  return {
    roomId: room.id,
    inviteCode: room.invite_code,
    status: room.status,
    maxPlayers: room.max_players,
    turnSeconds: room.turn_seconds,
    cpuTakeoverEnabled: room.cpu_takeover_enabled,
    seats,
  };
}

export async function fetchOnlineRoundSnapshot(
  roundId: string,
  afterStateVersion: number | null,
  deps: OnlineRoomDeps,
): Promise<OnlineRoundSnapshotResponse> {
  const session = await ensureOnlineAuthSession(deps);
  const response = await deps.http.post(
    rpcUrl(deps, 'get_friend_round_snapshot'),
    baseHeaders(deps, session),
    JSON.stringify({ target_round_id: roundId, after_state_version: afterStateVersion }),
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Fetch online round snapshot failed: ${response.status}`);
  }
  return parseJson<OnlineRoundSnapshotResponse>(response.body);
}

export type OnlineLeaveRoundResult = {
  ok: true;
  round_id: string;
  player_id: string;
  status: 'CPU_TAKEOVER' | 'OUT';
  cpu_takeover: boolean;
  state_version: number;
  event_seq: number;
  winner_player_id: string | null;
};

export async function leaveOnlineRound(
  roundId: string,
  cpuTakeoverRequested: boolean,
  deps: OnlineRoomDeps,
): Promise<OnlineLeaveRoundResult> {
  const session = await ensureOnlineAuthSession(deps);
  const response = await deps.http.post(
    rpcUrl(deps, 'leave_friend_round'),
    baseHeaders(deps, session),
    JSON.stringify({
      target_round_id: roundId,
      requested_cpu_takeover: cpuTakeoverRequested,
    }),
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Leave online round failed: ${response.status}`);
  }
  return parseJson<OnlineLeaveRoundResult>(response.body);
}

export async function submitOnlinePlayRequest(
  roundId: string,
  expectedStateVersion: number,
  requestId: string,
  play: PlayInput,
  deps: OnlineRoomDeps,
): Promise<OnlinePlayRequestResult> {
  const session = await ensureOnlineAuthSession(deps);
  const response = await deps.http.post(
    `${deps.supabaseUrl}/functions/v1/submit-play`,
    baseHeaders(deps, session),
    JSON.stringify({
      round_id: roundId,
      request_id: requestId,
      expected_state_version: expectedStateVersion,
      play,
    }),
  );
  const result = parseJson<OnlinePlayRequestResult>(response.body);
  if (response.status < 200 || response.status >= 300) {
    return result.ok ? { ok: false, reason: `HTTP_${response.status}` } : result;
  }
  return result;
}
