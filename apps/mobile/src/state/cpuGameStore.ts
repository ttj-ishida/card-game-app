import { createStore } from 'zustand/vanilla';

import type { LegalPlay, PlayRejectionReason, RoundState } from '@card-game-app/game-core';

import { getAnonPlayerId, type StoragePort } from '../features/cpu-game/anonPlayerId';
import { buildMatchConfig, isValidTotalPlayers } from '../features/cpu-game/matchConfig';
import { recordFinishedRound, type HttpPort } from '../features/cpu-game/practiceResultSync';
import {
  buildPracticeResultPayload,
  describeRoundResult,
  type RoundResultView,
} from '../features/cpu-game/resultModel';
import { toggleCard, toPlayInput, type HandSelection } from '../features/cpu-game/handSelection';
import {
  activeSeatId,
  cpuStep,
  humanPlay,
  initGame,
  legalPlaysForHuman,
  type CpuDecision,
  type DriverState,
} from '../features/cpu-game/turnDriver';

const TOTAL_CARDS = 36;

export type CpuGameSaveStatus = 'idle' | 'saving' | 'saved' | 'duplicate' | 'queued';

export type PendingCpuReveal = {
  decided: CpuDecision;
  nextDriver: DriverState;
};

export type CpuGamePlayResult = { ok: boolean; reason?: PlayRejectionReason };

export type CpuGameState = {
  driver: DriverState | null;
  selection: HandSelection;
  legalPlays: LegalPlay[];
  pendingCpuReveal: PendingCpuReveal | null;
  startedAtMs: number | null;
  clientResultId: string | null;
  result: RoundResultView | null;
  saveStatus: CpuGameSaveStatus;
  /** Derived convenience mirror of `pendingCpuReveal != null`. */
  cpuThinking: boolean;

  startMatch: (totalPlayers: number, seed?: number) => void;
  selectCard: (cardId: string) => void;
  clearSelection: () => void;
  submitPlay: () => CpuGamePlayResult;
  pass: () => CpuGamePlayResult;
  advanceCpu: () => { thinkMillis: number };
  commitCpuReveal: () => void;
  finishRound: () => Promise<void>;
  rematch: () => void;
  exit: () => void;
};

export type CpuGameDeps = {
  makeSeed: () => number;
  makeId: () => string;
  now: () => number;
  storage: StoragePort;
  http: HttpPort;
  supabaseUrl: string;
  anonKey: string;
};

// The one allowed module-scope mutable: dependency-injection config. Reset-able,
// and the test suite reconfigures it per test.
let deps: CpuGameDeps | null = null;

export function configureCpuGameStore(next: CpuGameDeps): void {
  deps = next;
}

function requireDeps(): CpuGameDeps {
  if (!deps) {
    throw new Error(
      'cpuGameStore is not configured: call configureCpuGameStore(deps) before using the store',
    );
  }
  return deps;
}

function assertCardConservation(round: RoundState): void {
  const inHands = round.players.reduce((sum, player) => sum + player.hand.length, 0);
  const onField = round.activeField ? round.activeField.combination.cards.length : 0;
  const total = inHands + round.discardPile.length + onField;
  if (total !== TOTAL_CARDS) {
    throw new Error(
      `cpuGameStore: card conservation violated (${inHands} in hands + ` +
        `${round.discardPile.length} discarded + ${onField} on field = ${total}, expected ${TOTAL_CARDS})`,
    );
  }
}

const INITIAL: Omit<
  CpuGameState,
  | 'startMatch'
  | 'selectCard'
  | 'clearSelection'
  | 'submitPlay'
  | 'pass'
  | 'advanceCpu'
  | 'commitCpuReveal'
  | 'finishRound'
  | 'rematch'
  | 'exit'
> = {
  driver: null,
  selection: [],
  legalPlays: [],
  pendingCpuReveal: null,
  startedAtMs: null,
  clientResultId: null,
  result: null,
  saveStatus: 'idle',
  cpuThinking: false,
};

export const cpuGameStore = createStore<CpuGameState>((set, get) => {
  const applyHumanInput = (
    input: ReturnType<typeof toPlayInput> | { kind: 'PASS'; playerId: string },
  ): CpuGamePlayResult => {
    const { driver } = get();
    if (!driver) return { ok: false };
    const res = humanPlay(driver, input);
    if (!res.ok) return { ok: false, reason: res.reason };
    assertCardConservation(res.next.round);
    set({
      driver: res.next,
      selection: [],
      legalPlays: legalPlaysForHuman(res.next),
    });
    return { ok: true };
  };

  return {
    ...INITIAL,

    startMatch: (totalPlayers, seed) => {
      const d = requireDeps();
      if (!isValidTotalPlayers(totalPlayers)) {
        throw new Error(`cpuGameStore.startMatch: invalid total players ${totalPlayers}`);
      }
      const usedSeed = seed ?? d.makeSeed();
      const driver = initGame({ config: buildMatchConfig(totalPlayers), seed: usedSeed });
      assertCardConservation(driver.round);
      set({
        ...INITIAL,
        driver,
        legalPlays: legalPlaysForHuman(driver),
        startedAtMs: d.now(),
      });
    },

    selectCard: (cardId) =>
      set((state) => ({ selection: toggleCard(state.selection, cardId, state.legalPlays) })),

    clearSelection: () => set({ selection: [] }),

    submitPlay: () => {
      const { driver, selection } = get();
      if (!driver) return { ok: false };
      return applyHumanInput(toPlayInput(selection, activeSeatId(driver)));
    },

    pass: () => {
      const { driver } = get();
      if (!driver) return { ok: false };
      return applyHumanInput({ kind: 'PASS', playerId: activeSeatId(driver) });
    },

    advanceCpu: () => {
      const { driver, pendingCpuReveal } = get();
      if (!driver || driver.phase !== 'CPU_PENDING' || pendingCpuReveal != null) {
        return { thinkMillis: 0 };
      }
      const step = cpuStep(driver);
      set({
        pendingCpuReveal: { decided: step.decided, nextDriver: step.next },
        cpuThinking: true,
      });
      return { thinkMillis: step.decided.thinkMillis };
    },

    commitCpuReveal: () => {
      const { pendingCpuReveal } = get();
      if (!pendingCpuReveal) return;
      const nextDriver = pendingCpuReveal.nextDriver;
      assertCardConservation(nextDriver.round);
      set({
        driver: nextDriver,
        pendingCpuReveal: null,
        cpuThinking: false,
        selection: [],
        legalPlays: legalPlaysForHuman(nextDriver),
      });
    },

    finishRound: async () => {
      const d = requireDeps();
      const { driver, result, startedAtMs } = get();
      if (!driver || driver.phase !== 'ROUND_OVER' || result != null) return;

      set({ saveStatus: 'saving' });
      const endedAtMs = d.now();
      const view = describeRoundResult(driver, startedAtMs ?? endedAtMs, endedAtMs);
      const clientResultId = get().clientResultId ?? d.makeId();
      set({ result: view, clientResultId });

      try {
        const anonPlayerId = await getAnonPlayerId({ storage: d.storage, makeId: d.makeId });
        const payload = buildPracticeResultPayload({
          view,
          state: driver,
          anonPlayerId,
          clientResultId,
        });
        const outcome = await recordFinishedRound(payload, {
          storage: d.storage,
          http: d.http,
          supabaseUrl: d.supabaseUrl,
          anonKey: d.anonKey,
        });
        set({
          saveStatus:
            outcome === 'saved' ? 'saved' : outcome === 'duplicate' ? 'duplicate' : 'queued',
        });
      } catch {
        // A thrown storage/network error must not crash the round-over screen.
        set({ saveStatus: 'queued' });
      }
    },

    rematch: () => {
      const d = requireDeps();
      const { driver } = get();
      if (!driver) return;
      const next = initGame({
        config: driver.config,
        seed: d.makeSeed(),
        rematchIndex: driver.rematchIndex + 1,
        baselineFirstSeatId: driver.baselineFirstSeatId,
      });
      assertCardConservation(next.round);
      set({
        ...INITIAL,
        driver: next,
        legalPlays: legalPlaysForHuman(next),
        startedAtMs: d.now(),
      });
    },

    exit: () => set({ ...INITIAL }),
  };
});
