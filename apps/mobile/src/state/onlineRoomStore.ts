import { createStore } from 'zustand/vanilla';

import type { TranslationKey } from '../i18n/translate';
import {
  createOnlineRoom,
  fetchOnlineWaitingRoom,
  joinOnlineRoom,
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
  roundId: string | null;
  errorMessageKey: TranslationKey | null;
  setInviteCode(inviteCode: string): void;
  createRoom(settings: OnlineRoomSettings): Promise<void>;
  joinRoom(): Promise<void>;
  refreshRoom(): Promise<void>;
  startRound(): Promise<void>;
  reset(): void;
};

let deps: OnlineRoomDeps | undefined;

const initialState = {
  status: 'idle' as OnlineRoomStatus,
  inviteCode: '',
  room: null as OnlineWaitingRoomView | null,
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

function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

function failureState(): Pick<OnlineRoomState, 'status' | 'errorMessageKey'> {
  return { status: 'failed', errorMessageKey: 'onlineRoom.error.network' };
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
    set({ status: 'creating', errorMessageKey: null });
    try {
      const d = requireDeps();
      const created = await createOnlineRoom(inviteCode, settings, d);
      const room = await fetchOnlineWaitingRoom(created.room_id, d);
      set({ status: 'ready', inviteCode: room.inviteCode, room, roundId: null });
    } catch {
      set(failureState());
    }
  },

  async joinRoom() {
    const inviteCode = normalizeInviteCode(get().inviteCode);
    if (inviteCode.length === 0) {
      set({ status: 'failed', errorMessageKey: 'onlineRoom.error.inviteRequired' });
      return;
    }
    set({ status: 'joining', errorMessageKey: null });
    try {
      const d = requireDeps();
      const joined = await joinOnlineRoom(inviteCode, d);
      const room = await fetchOnlineWaitingRoom(joined.room_id, d);
      set({ status: 'ready', inviteCode: room.inviteCode, room, roundId: null });
    } catch {
      set(failureState());
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
    } catch {
      set(failureState());
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
    } catch {
      set(failureState());
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
