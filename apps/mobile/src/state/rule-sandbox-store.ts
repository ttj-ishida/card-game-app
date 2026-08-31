import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  UNLOCKED_FIELD,
  resolvePlay,
  type FieldLock,
  type NumberCard,
  type RoundState,
} from '@card-game-app/game-core';

import {
  buildPlayInput,
  createInitialRound,
  describeResolution,
  emptyPlayDraft,
  isValidFieldCards,
  setFieldCards,
  type PlayDraft,
  type ResolutionView,
} from '../features/rule-sandbox/sandboxModel';
import { SANDBOX_PRESETS } from '../features/rule-sandbox/sandboxPresets';

export type SandboxHistoryEntry = {
  round: RoundState;
  playDraft: PlayDraft;
  view: ResolutionView;
};

export type FieldDraft = {
  cards: NumberCard[];
  lastPlayerId: string;
  lock: FieldLock;
};

export type RuleSandboxState = {
  draft: RoundState;
  playDraft: PlayDraft;
  fieldDraft: FieldDraft;
  history: SandboxHistoryEntry[];
  lastResult: ResolutionView | null;
  editRound: (fn: (round: RoundState) => RoundState) => void;
  setPlayDraft: (patch: Partial<PlayDraft>) => void;
  resetPlayDraft: () => void;
  setFieldDraftCards: (cards: NumberCard[]) => void;
  setFieldDraftLastPlayer: (playerId: string) => void;
  setFieldDraftLock: (patch: Partial<FieldLock>) => void;
  commitFieldDraft: () => void;
  resetFieldDraft: () => void;
  applyPlay: () => void;
  undo: () => void;
  reset: () => void;
  loadPreset: (id: string) => void;
};

function initialFieldDraft(round: RoundState): FieldDraft {
  return {
    cards: round.activeField ? [...round.activeField.combination.cards] : [],
    lastPlayerId: round.activeField?.lastPlayerId ?? round.players[0].playerId,
    lock: { ...(round.activeField?.lock ?? UNLOCKED_FIELD) },
  };
}

export function createRuleSandboxStore(): StoreApi<RuleSandboxState> {
  return createStore<RuleSandboxState>((set, get) => {
    const initialRound = createInitialRound();
    return {
      draft: initialRound,
      playDraft: emptyPlayDraft(),
      fieldDraft: initialFieldDraft(initialRound),
      history: [],
      lastResult: null,

      editRound: (fn) => set((state) => ({ draft: fn(state.draft), lastResult: null })),

      setPlayDraft: (patch) => set((state) => ({ playDraft: { ...state.playDraft, ...patch } })),

      resetPlayDraft: () => set({ playDraft: emptyPlayDraft() }),

      setFieldDraftCards: (cards) =>
        set((state) => ({ fieldDraft: { ...state.fieldDraft, cards } })),

      setFieldDraftLastPlayer: (playerId) =>
        set((state) => ({ fieldDraft: { ...state.fieldDraft, lastPlayerId: playerId } })),

      setFieldDraftLock: (patch) =>
        set((state) => ({
          fieldDraft: { ...state.fieldDraft, lock: { ...state.fieldDraft.lock, ...patch } },
        })),

      commitFieldDraft: () =>
        set((state) => {
          const { draft, fieldDraft } = state;
          if (!isValidFieldCards(fieldDraft.cards)) return state;
          const effectiveLastPlayerId = draft.players.some(
            (player) => player.playerId === fieldDraft.lastPlayerId,
          )
            ? fieldDraft.lastPlayerId
            : draft.players[0].playerId;
          return {
            draft: setFieldCards(draft, fieldDraft.cards, effectiveLastPlayerId, fieldDraft.lock),
            fieldDraft: {
              cards: [],
              lastPlayerId: effectiveLastPlayerId,
              lock: { ...UNLOCKED_FIELD },
            },
            lastResult: null,
          };
        }),

      resetFieldDraft: () =>
        set((state) => ({
          fieldDraft: {
            cards: [],
            lastPlayerId: state.draft.players[0].playerId,
            lock: { ...UNLOCKED_FIELD },
          },
        })),

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
          return { history, draft: last.round, playDraft: last.playDraft, lastResult: null };
        }),

      reset: () => {
        const round = createInitialRound();
        set({
          draft: round,
          playDraft: emptyPlayDraft(),
          fieldDraft: initialFieldDraft(round),
          history: [],
          lastResult: null,
        });
      },

      loadPreset: (id) => {
        const preset = SANDBOX_PRESETS.find((entry) => entry.id === id);
        if (!preset) return;
        set({
          draft: preset.round,
          playDraft: preset.play,
          fieldDraft: initialFieldDraft(preset.round),
          history: [],
          lastResult: null,
        });
      },
    };
  });
}

export const ruleSandboxStore = createRuleSandboxStore();
