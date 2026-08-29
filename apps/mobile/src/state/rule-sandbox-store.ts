import { createStore, type StoreApi } from 'zustand/vanilla';

import { resolvePlay, type RoundState } from '@card-game-app/game-core';

import {
  buildPlayInput,
  createInitialRound,
  describeResolution,
  emptyPlayDraft,
  type PlayDraft,
  type ResolutionView,
} from '../features/rule-sandbox/sandboxModel';
import { SANDBOX_PRESETS } from '../features/rule-sandbox/sandboxPresets';

export type SandboxHistoryEntry = {
  round: RoundState;
  playDraft: PlayDraft;
  view: ResolutionView;
};

export type RuleSandboxState = {
  draft: RoundState;
  playDraft: PlayDraft;
  history: SandboxHistoryEntry[];
  lastResult: ResolutionView | null;
  editRound: (fn: (round: RoundState) => RoundState) => void;
  setPlayDraft: (patch: Partial<PlayDraft>) => void;
  resetPlayDraft: () => void;
  applyPlay: () => void;
  undo: () => void;
  reset: () => void;
  loadPreset: (id: string) => void;
};

export function createRuleSandboxStore(): StoreApi<RuleSandboxState> {
  return createStore<RuleSandboxState>((set, get) => ({
    draft: createInitialRound(),
    playDraft: emptyPlayDraft(),
    history: [],
    lastResult: null,

    editRound: (fn) => set((state) => ({ draft: fn(state.draft), lastResult: null })),

    setPlayDraft: (patch) => set((state) => ({ playDraft: { ...state.playDraft, ...patch } })),

    resetPlayDraft: () => set({ playDraft: emptyPlayDraft() }),

    applyPlay: () => {
      const { draft, playDraft } = get();
      const resolution = resolvePlay(draft, buildPlayInput(draft, playDraft));
      const view = describeResolution(resolution);
      if (resolution.ok) {
        set((state) => ({
          history: [...state.history, { round: draft, playDraft, view }],
          draft: resolution.state,
          playDraft: emptyPlayDraft(),
          lastResult: view,
        }));
      } else {
        set({ lastResult: view });
      }
    },

    undo: () =>
      set((state) => {
        if (state.history.length === 0) return state;
        const history = state.history.slice(0, -1);
        const last = state.history[state.history.length - 1];
        return { history, draft: last.round, lastResult: null };
      }),

    reset: () =>
      set({
        draft: createInitialRound(),
        playDraft: emptyPlayDraft(),
        history: [],
        lastResult: null,
      }),

    loadPreset: (id) => {
      const preset = SANDBOX_PRESETS.find((entry) => entry.id === id);
      if (!preset) return;
      set({
        draft: preset.round,
        playDraft: preset.play,
        history: [],
        lastResult: null,
      });
    },
  }));
}

export const ruleSandboxStore = createRuleSandboxStore();
