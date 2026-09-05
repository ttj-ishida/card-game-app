import { createStore } from 'zustand/vanilla';

import type { LegalPlay, PlayInput, PlaySkillUse } from '@card-game-app/game-core';

import { toggleCard } from '../features/cpu-game/handSelection';
import { buildLegalPlaysForOnlineRound } from '../features/online-room/onlineLegalMoves';
import {
  fetchOnlineRoundSnapshot,
  leaveOnlineRound,
  submitOnlinePlayRequest,
  type OnlineRoomDeps,
} from '../features/online-room/onlineRoomClient';
import {
  buildOnlineRoundViewModel,
  type OnlineRoundEventView,
  type OnlineRoundSnapshotResponse,
  type OnlineRoundViewModel,
  type OnlineSnapshotEventRow,
} from '../features/online-room/onlineRoundViewModel';

export type OnlineRoundStatus = 'idle' | 'loading' | 'ready' | 'submitting' | 'error';
export type OnlineConnectionStatus = 'online' | 'reconnecting' | 'offline';
export type OnlinePendingSkill = { useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION' };
export type OnlineSubmitResult = { ok: boolean; reason?: string };

/**
 * 自動再接続の許容時間（M4-EX-07 の「60秒以内」）。ポーリングは2秒間隔で
 * 走り続け、この時間を超えて復帰できなければ `connection: 'offline'` へ落として
 * 手動の再接続待ちにする。
 */
export const RECONNECT_WINDOW_MS = 60_000;

export type OnlineRoundDeps = OnlineRoomDeps & { makeId: () => string };

export type OnlineRoundState = {
  roundId: string | null;
  view: OnlineRoundViewModel | null;
  eventLog: OnlineRoundEventView[];
  legalPlays: LegalPlay[];
  selection: string[];
  pendingSkill: OnlinePendingSkill | null;
  status: OnlineRoundStatus;
  connection: OnlineConnectionStatus;
  reconnectSinceMs: number | null;
  needsFullResync: boolean;
  lastReason: string | null;
  winnerPlayerId: string | null;

  start(roundId: string): Promise<void>;
  poll(): Promise<void>;
  reconnect(): Promise<void>;
  selectCard(cardId: string): void;
  clearSelection(): void;
  declareSkill(useSkill: OnlinePendingSkill['useSkill']): void;
  cancelSkill(): void;
  submitPlay(): Promise<OnlineSubmitResult>;
  pass(): Promise<OnlineSubmitResult>;
  leaveRound(cpuTakeoverRequested: boolean): Promise<void>;
  reset(): void;
};

let deps: OnlineRoundDeps | undefined;

const initialState = {
  roundId: null as string | null,
  view: null as OnlineRoundViewModel | null,
  eventLog: [] as OnlineRoundEventView[],
  legalPlays: [] as LegalPlay[],
  selection: [] as string[],
  pendingSkill: null as OnlinePendingSkill | null,
  status: 'idle' as OnlineRoundStatus,
  connection: 'online' as OnlineConnectionStatus,
  reconnectSinceMs: null as number | null,
  needsFullResync: false,
  lastReason: null as string | null,
  winnerPlayerId: null as string | null,
};

export function configureOnlineRoundStore(next: OnlineRoundDeps | undefined): void {
  deps = next;
}

function requireDeps(): OnlineRoundDeps {
  if (!deps) {
    throw new Error(
      'onlineRoundStore is not configured: call configureOnlineRoundStore(deps) before using the store',
    );
  }
  return deps;
}

/** `submit-play` と `leave_friend_round` はキー名が揃っていない（既存実装のまま）。両対応する。 */
function extractWinnerId(rows: OnlineSnapshotEventRow[]): string | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const payload = rows[i].public_payload;
    const winner = payload?.winner_id ?? payload?.winner_player_id;
    if (typeof winner === 'string') return winner;
  }
  return null;
}

/** 選択中スキルの有無で、素の手候補 / そのスキルの手候補のどちらへ絞るか。 */
function legalPlaysForSelection(
  legalPlays: LegalPlay[],
  pendingSkill: OnlinePendingSkill | null,
): LegalPlay[] {
  if (!pendingSkill) {
    return legalPlays.filter((p) => p.input.kind !== 'PLAY' || p.input.useSkill === undefined);
  }
  return legalPlays.filter(
    (p) => p.input.kind === 'PLAY' && p.input.useSkill === pendingSkill.useSkill,
  );
}

function mergeEventLog(
  existing: OnlineRoundEventView[],
  incoming: OnlineRoundEventView[],
): OnlineRoundEventView[] {
  const byEventSeq = new Map(existing.map((e) => [e.eventSeq, e]));
  for (const event of incoming) byEventSeq.set(event.eventSeq, event);
  return [...byEventSeq.values()]
    .sort((a, b) => a.eventSeq - b.eventSeq)
    .map((event, index) => ({ ...event, index }));
}

/**
 * イベント列に欠番があるか（M4-EX-06）。`get_friend_round_snapshot` は
 * `after_state_version` より後を全件返すので通常は連番になるが、想定外の
 * 取りこぼしを検知したら全件再取得へ切り替える。`latestEventSeq` は
 * サーバーが知る最大 event_seq で、手元の最大がそれ未満なら末尾が欠けている。
 */
function hasEventGap(eventLog: OnlineRoundEventView[], latestEventSeq: number): boolean {
  if (eventLog.length === 0) return false;
  const seqs = eventLog.map((e) => e.eventSeq);
  const max = seqs[seqs.length - 1];
  if (latestEventSeq > max) return true;
  for (let i = 1; i < seqs.length; i += 1) {
    if (seqs[i] !== seqs[i - 1] + 1) return true;
  }
  return false;
}

/** ポーリング/送信の通信失敗を、60秒の再接続ウィンドウに照らして分類する。 */
function connectionAfterFailure(
  reconnectSinceMs: number | null,
  now: number,
): { connection: OnlineConnectionStatus; reconnectSinceMs: number } {
  const since = reconnectSinceMs ?? now;
  return {
    connection: now - since >= RECONNECT_WINDOW_MS ? 'offline' : 'reconnecting',
    reconnectSinceMs: since,
  };
}

export const onlineRoundStore = createStore<OnlineRoundState>((set, get) => ({
  ...initialState,

  async start(roundId) {
    set({ ...initialState, roundId, status: 'loading' });
    try {
      const d = requireDeps();
      const response = await fetchOnlineRoundSnapshot(roundId, null, d);
      applySnapshot(set, get, response, true);
    } catch {
      set({ status: 'error', connection: 'reconnecting', reconnectSinceMs: requireDeps().now() });
    }
  },

  async poll() {
    const { roundId, view, connection, needsFullResync } = get();
    if (!roundId || !view) return;
    if (connection === 'offline') return; // 手動の reconnect() 待ち
    try {
      const d = requireDeps();
      const afterVersion = needsFullResync ? null : view.stateVersion;
      const response = await fetchOnlineRoundSnapshot(roundId, afterVersion, d);
      applySnapshot(set, get, response, afterVersion === null);
    } catch {
      set((state) => connectionAfterFailure(state.reconnectSinceMs, requireDeps().now()));
    }
  },

  async reconnect() {
    const { roundId } = get();
    if (!roundId) return;
    set({
      connection: 'reconnecting',
      reconnectSinceMs: requireDeps().now(),
      needsFullResync: true,
    });
    await get().poll();
  },

  selectCard(cardId) {
    set((state) => ({
      selection: toggleCard(
        state.selection,
        cardId,
        legalPlaysForSelection(state.legalPlays, state.pendingSkill),
      ),
    }));
  },

  clearSelection() {
    set({ selection: [], pendingSkill: null });
  },

  declareSkill(useSkill) {
    set({ pendingSkill: { useSkill }, selection: [] });
  },

  cancelSkill() {
    set({ pendingSkill: null });
  },

  async submitPlay() {
    const { selection, pendingSkill } = get();
    const play: PlayInput = {
      kind: 'PLAY',
      playerId: '',
      cardIds: [...selection],
      useSkill: pendingSkill?.useSkill,
    };
    return submit(set, get, play);
  },

  async pass() {
    return submit(set, get, { kind: 'PASS', playerId: '' });
  },

  async leaveRound(cpuTakeoverRequested) {
    const { roundId } = get();
    if (!roundId) return;
    try {
      const d = requireDeps();
      await leaveOnlineRound(roundId, cpuTakeoverRequested, d);
    } catch {
      /* best-effort: the player is leaving regardless of server confirmation */
    }
    set({ ...initialState });
  },

  reset() {
    set({ ...initialState });
  },
}));

function applySnapshot(
  set: (partial: Partial<OnlineRoundState>) => void,
  get: () => OnlineRoundState,
  response: OnlineRoundSnapshotResponse,
  fullResync: boolean,
): void {
  const view = buildOnlineRoundViewModel(response);
  const legalPlays = buildLegalPlaysForOnlineRound(response);
  const winnerFromBatch = extractWinnerId(response.events);
  const eventLog = mergeEventLog(fullResync ? [] : get().eventLog, view.events);
  set({
    view,
    legalPlays,
    eventLog,
    winnerPlayerId: get().winnerPlayerId ?? winnerFromBatch,
    status: 'ready',
    connection: 'online',
    reconnectSinceMs: null,
    // 欠番を検知したら次のポーリングで全件取り直す。全件取得直後の検知は
    // ループを避けるため無視する。
    needsFullResync: !fullResync && hasEventGap(eventLog, response.latest_event_seq),
  });
}

type SubmitPlayInput =
  | { kind: 'PASS'; playerId?: string }
  | { kind: 'PLAY'; playerId?: string; cardIds: string[]; useSkill?: PlaySkillUse };

async function submit(
  set: (
    partial: Partial<OnlineRoundState> | ((s: OnlineRoundState) => Partial<OnlineRoundState>),
  ) => void,
  get: () => OnlineRoundState,
  play: SubmitPlayInput,
): Promise<OnlineSubmitResult> {
  const { view, roundId } = get();
  if (!roundId || !view) return { ok: false, reason: 'ROUND_NOT_FOUND' };
  if (!view.isMyTurn) return { ok: false, reason: 'NOT_ACTIVE_PLAYER' };
  if (play.kind === 'PLAY' && play.cardIds.length === 0) {
    return { ok: false, reason: 'CARD_NOT_IN_HAND' };
  }

  const d = requireDeps();
  const input = { ...play, playerId: view.playerId } as PlayInput;
  set({ status: 'submitting' });
  try {
    const result = await submitOnlinePlayRequest(roundId, view.stateVersion, d.makeId(), input, d);
    if (result.ok) {
      set({ selection: [], pendingSkill: null, lastReason: null });
      await get().poll();
      return { ok: true };
    }
    set({ status: 'ready', lastReason: result.reason });
    if (result.reason === 'STALE_STATE_VERSION') await get().poll();
    return { ok: false, reason: result.reason };
  } catch {
    set((state) => ({
      status: 'ready',
      ...connectionAfterFailure(state.reconnectSinceMs, d.now()),
      lastReason: 'NETWORK_ERROR',
    }));
    return { ok: false, reason: 'NETWORK_ERROR' };
  }
}

export function __resetOnlineRoundStoreForTest(): void {
  deps = undefined;
  onlineRoundStore.setState(initialState);
}
