import { createStore } from 'zustand/vanilla';

import type { TranslationKey } from '../i18n/translate';
import { isValidInviteCode, normalizeInviteCode } from '../features/online-room/inviteLink';
import {
  createOnlineRoom,
  fetchOnlineWaitingRoom,
  joinOnlineRoom,
  OnlineRoomRpcError,
  startOnlineRound,
  type OnlineRoomDeps,
  type OnlineRoomSettings,
  type OnlineWaitingRoomView,
} from '../features/online-room/onlineRoomClient';

export type OnlineRoomStatus =
  'idle' | 'creating' | 'joining' | 'loading' | 'ready' | 'starting' | 'started' | 'failed';

export type OnlineRoomState = {
  status: OnlineRoomStatus;
  inviteCode: string;
  room: OnlineWaitingRoomView | null;
  /** このクライアントの席の player_id（create/join の応答）。ホスト判定に使う。 */
  myPlayerId: string | null;
  roundId: string | null;
  errorMessageKey: TranslationKey | null;
  setInviteCode(inviteCode: string): void;
  createRoom(settings: OnlineRoomSettings): Promise<void>;
  joinRoom(): Promise<void>;
  refreshRoom(): Promise<void>;
  /**
   * ロビー滞在中に 1 秒間隔で呼ぶ静かな更新。参加者の増減を反映し、
   * ホストが対局を開始したら status を 'started' にして roundId を埋める
   * （ゲスト側も自動で対局画面へ遷移できるように）。`loading` にはしない。
   */
  pollRoom(): Promise<void>;
  startRound(): Promise<void>;
  reset(): void;
};

let deps: OnlineRoomDeps | undefined;

const initialState = {
  status: 'idle' as OnlineRoomStatus,
  inviteCode: '',
  room: null as OnlineWaitingRoomView | null,
  myPlayerId: null as string | null,
  roundId: null as string | null,
  errorMessageKey: null as TranslationKey | null,
};

export function configureOnlineRoomStore(next: OnlineRoomDeps | undefined): void {
  deps = next;
}

function requireDeps(): OnlineRoomDeps {
  if (!deps) {
    throw new Error(
      'onlineRoomStore is not configured: call configureOnlineRoomStore(deps) before using the store',
    );
  }
  return deps;
}

/** サーバー/通信エラーを画面向けのメッセージキーへ写す。 */
function errorKeyFor(err: unknown): TranslationKey {
  if (err instanceof OnlineRoomRpcError) {
    switch (err.serverCode) {
      case 'INVITE_CODE_TAKEN':
        return 'onlineRoom.error.inviteTaken';
      case 'room not found':
        return 'onlineRoom.error.roomNotFound';
      case 'room is full':
        return 'onlineRoom.error.roomFull';
      case 'room is not waiting':
      case 'room is not in progress':
        return 'onlineRoom.error.roomUnavailable';
      case 'only host can start the round':
        return 'onlineRoom.error.notHost';
    }
  }
  return 'onlineRoom.error.network';
}

function failureState(err?: unknown): Pick<OnlineRoomState, 'status' | 'errorMessageKey'> {
  return { status: 'failed', errorMessageKey: errorKeyFor(err) };
}

export const onlineRoomStore = createStore<OnlineRoomState>((set, get) => ({
  ...initialState,

  setInviteCode(inviteCode) {
    set({ inviteCode: normalizeInviteCode(inviteCode), errorMessageKey: null });
  },

  async createRoom(settings) {
    const inviteCode = normalizeInviteCode(get().inviteCode);
    if (inviteCode.length === 0) {
      set({ status: 'failed', errorMessageKey: 'onlineRoom.error.inviteRequired' });
      return;
    }
    if (!isValidInviteCode(inviteCode)) {
      set({ status: 'failed', errorMessageKey: 'onlineRoom.error.inviteInvalid' });
      return;
    }
    set({ status: 'creating', errorMessageKey: null });
    try {
      const d = requireDeps();
      const created = await createOnlineRoom(inviteCode, settings, d);
      const room = await fetchOnlineWaitingRoom(created.room_id, d);
      set({
        status: 'ready',
        inviteCode: room.inviteCode,
        room,
        myPlayerId: created.player_id,
        roundId: null,
      });
    } catch (err) {
      set(failureState(err));
    }
  },

  async joinRoom() {
    const inviteCode = normalizeInviteCode(get().inviteCode);
    if (inviteCode.length === 0) {
      set({ status: 'failed', errorMessageKey: 'onlineRoom.error.inviteRequired' });
      return;
    }
    if (!isValidInviteCode(inviteCode)) {
      set({ status: 'failed', errorMessageKey: 'onlineRoom.error.inviteInvalid' });
      return;
    }
    set({ status: 'joining', errorMessageKey: null });
    try {
      const d = requireDeps();
      const joined = await joinOnlineRoom(inviteCode, d);
      const room = await fetchOnlineWaitingRoom(joined.room_id, d);
      set({
        status: 'ready',
        inviteCode: room.inviteCode,
        room,
        myPlayerId: joined.player_id,
        roundId: null,
      });
    } catch (err) {
      set(failureState(err));
    }
  },

  async refreshRoom() {
    const roomId = get().room?.roomId;
    if (!roomId) return;
    set({ status: 'loading', errorMessageKey: null });
    try {
      const d = requireDeps();
      const room = await fetchOnlineWaitingRoom(roomId, d);
      set({ status: 'ready', inviteCode: room.inviteCode, room });
    } catch (err) {
      set(failureState(err));
    }
  },

  async pollRoom() {
    const roomId = get().room?.roomId;
    if (!roomId) return;
    if (get().status === 'started' || get().status === 'starting') return;
    try {
      const d = requireDeps();
      const room = await fetchOnlineWaitingRoom(roomId, d);
      if (room.roundId) {
        set({ room, inviteCode: room.inviteCode, status: 'started', roundId: room.roundId });
      } else {
        set({ room, inviteCode: room.inviteCode });
      }
    } catch {
      // 一時的な通信失敗は無視。ロビーは直前の表示のまま、次のティックで再取得する。
    }
  },

  async startRound() {
    const roomId = get().room?.roomId;
    if (!roomId) return;
    set({ status: 'starting', errorMessageKey: null });
    try {
      const d = requireDeps();
      const roundId = await startOnlineRound(roomId, d);
      set({ status: 'started', roundId });
    } catch (err) {
      set(failureState(err));
    }
  },

  reset() {
    set(initialState);
  },
}));

export function __resetOnlineRoomStoreForTest(): void {
  deps = undefined;
  onlineRoomStore.setState(initialState);
}
