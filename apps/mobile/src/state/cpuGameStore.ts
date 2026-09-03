import { createStore } from 'zustand/vanilla';

import { scaleThinkMillis } from '../features/cpu-game/cpuGameSettings';
import { cpuGameSettingsStore } from './cpuGameSettingsStore';
import type {
  LegalPlay,
  PlayInput,
  PlayRejectionReason,
  PlaySkillUse,
  RankCode,
  RoundState,
  SuitCode,
} from '@card-game-app/game-core';

import { getAnonPlayerId, type StoragePort } from '../features/cpu-game/anonPlayerId';
import { buildMatchConfig, isValidTotalPlayers } from '../features/cpu-game/matchConfig';
import {
  fetchActiveRulesetId,
  savePracticeResultReturningId,
  saveRoundEvents,
  type HttpPort,
} from '../features/cpu-game/practiceResultSync';
import {
  enqueuePracticeResult,
  flushPracticeResultQueue,
} from '../features/cpu-game/practiceResultQueue';
import { buildRoundEventsPayload } from '../features/cpu-game/roundEventsPayload';
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
import type { PendingHumanSkill } from '../features/cpu-game/skillPlayOptions';

const TOTAL_CARDS = 36;

export type CpuGameSaveStatus = 'idle' | 'saving' | 'saved' | 'duplicate' | 'queued' | 'failed';

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
  jokerTransform: { active: boolean; rankCode: RankCode | null; suitCode: SuitCode | null };
  pendingSkill: PendingHumanSkill | null;

  startMatch: (totalPlayers: number, seed?: number) => void;
  selectCard: (cardId: string) => void;
  clearSelection: () => void;
  submitPlay: () => CpuGamePlayResult;
  pass: () => CpuGamePlayResult;
  openJokerTransform: () => void;
  closeJokerTransform: () => void;
  setJokerDeclaration: (rankCode: RankCode | null, suitCode: SuitCode | null) => void;
  submitSkillPlay: (useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION') => CpuGamePlayResult;
  submitJokerTransform: () => CpuGamePlayResult;
  advanceCpu: () => { thinkMillis: number };
  commitCpuReveal: () => void;
  finishRound: () => Promise<void>;
  flushQueue: () => Promise<void>;
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

// A transformed Joker (createTransformedJokerCard) is a NumberCard that is not one
// of the 36 real number-deck cards — it carries `transformedFromSkillId`. Card
// conservation only counts real cards, so exclude transformed Jokers everywhere.
const isRealCard = (card: { transformedFromSkillId?: string }): boolean =>
  card.transformedFromSkillId === undefined;

function sameCardSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((id) => bSet.has(id));
}

function sameJokerDeclaration(
  input: PlayInput,
  pending: Extract<PendingHumanSkill, { useSkill: 'JOKER_TRANSFORM' }>,
): boolean {
  if (input.kind !== 'PLAY') return false;
  const declaration = input.jokerDeclarations?.[0];
  return (
    input.jokerDeclarations?.length === 1 &&
    declaration?.rankCode === pending.jokerDeclaration.rankCode &&
    declaration.suitCode === pending.jokerDeclaration.suitCode
  );
}

function legalPlaysForPendingSkill(
  legalPlays: LegalPlay[],
  pendingSkill: PendingHumanSkill | null,
): LegalPlay[] {
  if (!pendingSkill) {
    return legalPlays.filter(
      (play) => play.input.kind !== 'PLAY' || play.input.useSkill === undefined,
    );
  }
  return legalPlays.filter((play) => {
    if (play.input.kind !== 'PLAY' || play.input.useSkill !== pendingSkill.useSkill) return false;
    if (pendingSkill.useSkill !== 'JOKER_TRANSFORM') return true;
    return sameJokerDeclaration(play.input, pendingSkill);
  });
}

function skillUseMatchesHeld(useSkill: PlaySkillUse, heldEffect?: string): boolean {
  if (useSkill === 'EXTENSION_SEAL') return heldEffect === 'SKILL_EXTENSION_SEAL';
  if (useSkill === 'REVOLUTION') return heldEffect === 'SKILL_REVOLUTION';
  return heldEffect === 'SKILL_JOKER_HERO' || heldEffect === 'SKILL_JOKER_SAINT';
}
function assertCardConservation(round: RoundState): void {
  const inHands = round.players.reduce(
    (sum, player) => sum + player.hand.filter(isRealCard).length,
    0,
  );
  const onField = round.activeField
    ? round.activeField.combination.cards.filter(isRealCard).length
    : 0;
  const inDiscard = round.discardPile.filter(isRealCard).length;
  const total = inHands + inDiscard + onField;
  if (total !== TOTAL_CARDS) {
    throw new Error(
      `cpuGameStore: card conservation violated (${inHands} in hands + ` +
        `${inDiscard} discarded + ${onField} on field = ${total}, expected ${TOTAL_CARDS})`,
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
  | 'openJokerTransform'
  | 'closeJokerTransform'
  | 'setJokerDeclaration'
  | 'submitSkillPlay'
  | 'submitJokerTransform'
  | 'advanceCpu'
  | 'commitCpuReveal'
  | 'finishRound'
  | 'flushQueue'
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
  jokerTransform: { active: false, rankCode: null, suitCode: null },
  pendingSkill: null,
};

export const cpuGameStore = createStore<CpuGameState>((set, get) => {
  const applyHumanInput = (input: PlayInput): CpuGamePlayResult => {
    const { driver } = get();
    if (!driver) return { ok: false };
    const res = humanPlay(driver, input);
    if (!res.ok) return { ok: false, reason: res.reason };
    assertCardConservation(res.next.round);
    set({
      driver: res.next,
      selection: [],
      legalPlays: legalPlaysForHuman(res.next),
      jokerTransform: { active: false, rankCode: null, suitCode: null },
      pendingSkill: null,
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
      set((state) => ({
        selection: toggleCard(
          state.selection,
          cardId,
          legalPlaysForPendingSkill(state.legalPlays, state.pendingSkill),
        ),
      })),

    clearSelection: () =>
      set({
        selection: [],
        pendingSkill: null,
        jokerTransform: { active: false, rankCode: null, suitCode: null },
      }),

    submitPlay: () => {
      const { driver, selection, pendingSkill, legalPlays } = get();
      if (!driver) return { ok: false };
      if (!pendingSkill) return applyHumanInput(toPlayInput(selection, activeSeatId(driver)));

      const seatId = activeSeatId(driver);
      const human = driver.round.players.find((p) => p.playerId === seatId);
      if (!human?.skill || !skillUseMatchesHeld(pendingSkill.useSkill, human.skill.effectCode)) {
        return { ok: false, reason: 'SKILL_NOT_AVAILABLE' };
      }
      const input: PlayInput = {
        kind: 'PLAY',
        playerId: seatId,
        cardIds: [...selection],
        useSkill: pendingSkill.useSkill,
        jokerDeclarations:
          pendingSkill.useSkill === 'JOKER_TRANSFORM'
            ? [
                {
                  skillId: human.skill.skillId,
                  rankCode: pendingSkill.jokerDeclaration.rankCode,
                  suitCode: pendingSkill.jokerDeclaration.suitCode,
                },
              ]
            : undefined,
      };
      const isKnownLegal = legalPlaysForPendingSkill(legalPlays, pendingSkill).some(
        (play) => play.input.kind === 'PLAY' && sameCardSet(play.input.cardIds, input.cardIds),
      );
      if (!isKnownLegal) return { ok: false };
      return applyHumanInput(input);
    },

    pass: () => {
      const { driver, pendingSkill } = get();
      if (!driver || pendingSkill) return { ok: false };
      return applyHumanInput({ kind: 'PASS', playerId: activeSeatId(driver) });
    },

    openJokerTransform: () =>
      set({ jokerTransform: { active: true, rankCode: null, suitCode: null } }),

    closeJokerTransform: () =>
      set({ jokerTransform: { active: false, rankCode: null, suitCode: null } }),

    setJokerDeclaration: (rankCode, suitCode) =>
      set((s) => ({ jokerTransform: { ...s.jokerTransform, rankCode, suitCode } })),

    submitSkillPlay: (useSkill) => {
      const { driver, legalPlays } = get();
      if (!driver || driver.phase !== 'HUMAN_TURN') return { ok: false };
      const seatId = activeSeatId(driver);
      const human = driver.round.players.find((p) => p.playerId === seatId);
      if (
        !human?.skill ||
        human.skill.used ||
        !skillUseMatchesHeld(useSkill, human.skill.effectCode)
      ) {
        return { ok: false, reason: 'SKILL_NOT_AVAILABLE' };
      }
      const hasLegalFollowUp = legalPlays.some(
        (play) => play.input.kind === 'PLAY' && play.input.useSkill === useSkill,
      );
      if (!hasLegalFollowUp) return { ok: false };
      set({
        pendingSkill: { useSkill },
        selection: [],
        jokerTransform: { active: false, rankCode: null, suitCode: null },
      });
      return { ok: true };
    },

    submitJokerTransform: () => {
      const { driver, jokerTransform, legalPlays } = get();
      if (!driver || driver.phase !== 'HUMAN_TURN') return { ok: false };
      if (jokerTransform.rankCode == null || jokerTransform.suitCode == null) {
        return { ok: false };
      }
      const seatId = activeSeatId(driver);
      const human = driver.round.players.find((p) => p.playerId === seatId);
      if (
        !human?.skill ||
        human.skill.used ||
        !skillUseMatchesHeld('JOKER_TRANSFORM', human.skill.effectCode)
      ) {
        return { ok: false, reason: 'SKILL_NOT_AVAILABLE' };
      }
      const pendingSkill: PendingHumanSkill = {
        useSkill: 'JOKER_TRANSFORM',
        jokerDeclaration: {
          rankCode: jokerTransform.rankCode,
          suitCode: jokerTransform.suitCode,
        },
      };
      const hasLegalFollowUp = legalPlaysForPendingSkill(legalPlays, pendingSkill).length > 0;
      if (!hasLegalFollowUp) return { ok: false };
      set({
        pendingSkill,
        selection: [],
        jokerTransform: { active: false, rankCode: null, suitCode: null },
      });
      return { ok: true };
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
      return {
        thinkMillis: scaleThinkMillis(
          step.decided.thinkMillis,
          cpuGameSettingsStore.getState().settings,
        ),
      };
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
        pendingSkill: null,
        jokerTransform: { active: false, rankCode: null, suitCode: null },
      });
    },

    finishRound: async () => {
      const d = requireDeps();
      const { driver, result, startedAtMs } = get();
      if (!driver || driver.phase !== 'ROUND_OVER' || result != null) return;

      set({ saveStatus: 'saving' });

      try {
        const endedAtMs = d.now();
        const view = describeRoundResult(driver, startedAtMs ?? endedAtMs, endedAtMs);
        const clientResultId = get().clientResultId ?? d.makeId();
        set({ result: view, clientResultId });

        const anonPlayerId = await getAnonPlayerId({ storage: d.storage, makeId: d.makeId });
        const canSync = d.supabaseUrl.length > 0 && d.anonKey.length > 0;
        const rulesetId = canSync
          ? await fetchActiveRulesetId({
              http: d.http,
              supabaseUrl: d.supabaseUrl,
              anonKey: d.anonKey,
            })
          : null;
        const payload = buildPracticeResultPayload({
          view,
          state: driver,
          anonPlayerId,
          clientResultId,
          rulesetId,
        });
        if (!canSync) {
          await enqueuePracticeResult(d.storage, payload);
          set({ saveStatus: 'queued' });
          return;
        }
        const { outcome, roundResultId } = await savePracticeResultReturningId(payload, {
          http: d.http,
          supabaseUrl: d.supabaseUrl,
          anonKey: d.anonKey,
        });
        if (outcome === 'failed') {
          await enqueuePracticeResult(d.storage, payload);
        }
        if (outcome === 'saved' && roundResultId) {
          await saveRoundEvents(buildRoundEventsPayload(roundResultId, driver.publicEvents), {
            http: d.http,
            supabaseUrl: d.supabaseUrl,
            anonKey: d.anonKey,
          });
        }
        set({
          saveStatus:
            outcome === 'saved'
              ? 'saved'
              : outcome === 'duplicate'
                ? 'duplicate'
                : outcome === 'rejected'
                  ? 'failed'
                  : 'queued',
        });
      } catch {
        // A thrown storage/network error (or a describeRoundResult/makeId failure)
        // must not crash the round-over screen. `result` may still have been set.
        set({ saveStatus: 'queued' });
      }

      // Fire-and-forget: retry anything queued by an earlier round now that this
      // save attempt has completed (we are presumably online). Never surfaces.
      void get().flushQueue();
    },

    flushQueue: async () => {
      let d: CpuGameDeps;
      try {
        d = requireDeps();
      } catch {
        // Unconfigured (e.g. called from _layout on mount before env is wired) — no-op.
        return;
      }
      try {
        await flushPracticeResultQueue({
          storage: d.storage,
          http: d.http,
          supabaseUrl: d.supabaseUrl,
          anonKey: d.anonKey,
        });
      } catch {
        // A flush failure must never surface. `saveStatus` is per-round; untouched here.
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

/**
 * テスト専用リセット。注入済み `deps` を undefined に戻し、ストアを初期状態へ。
 * `beforeEach` で呼ぶ（本番コードからは呼ばない）。
 */
export function __resetCpuGameStoreForTest(): void {
  deps = null;
  cpuGameStore.setState({ ...INITIAL });
}
