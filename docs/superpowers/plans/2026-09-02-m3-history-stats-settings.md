# M3 History Stats Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build M3 sub-project 4: CPU match history, CPU stats, animation settings, and result/event persistence wiring.

**Architecture:** Keep screen files thin. Add pure formatting and sync modules under `apps/mobile/src/features/cpu-game`, wire dependency-injected ports through `cpuGameStore`, and expose route screens through Expo Router.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, Zustand vanilla, TypeScript, PostgREST/Supabase REST, AsyncStorage via DI.

**Spec:** `docs/superpowers/specs/2026-09-02-m3-history-stats-settings-design.md`

## Global Constraints

- Do not use `git add -A` or `git add .`; stage explicit paths only.
- Pure modules under `apps/mobile/src/features/cpu-game/*.ts` must not import `fetch`, `AsyncStorage`, `Date`, or `Math.random` directly.
- Display text must go through `translate()` keys; do not store Japanese display strings in app state.
- Screen files under `apps/mobile/src/app/**` are verified by typecheck, lint, and `npm run mobile:export:android` because unit tests only cover `.test.ts`.
- Preserve `savePracticeResult()` compatibility; add new APIs instead of breaking existing tests.

---

### Task 1: Result ID, Active Ruleset, and Round Events Sync

**Files:**

- Modify: `apps/mobile/src/features/cpu-game/practiceResultSync.ts`
- Modify: `apps/mobile/src/features/cpu-game/practiceResultSync.test.ts`
- Modify: `apps/mobile/src/state/cpuGameStore.ts`
- Modify: `apps/mobile/src/features/cpu-game/cpuGameAdapters.ts`

**Interfaces:**

- Produce `savePracticeResultReturningId(payload, deps): Promise<{ outcome: SaveOutcome; roundResultId: string | null }>`.
- Produce `saveRoundEvents(payload, deps): Promise<SaveOutcome>`.
- Produce `fetchActiveRulesetId(deps): Promise<string | null>`.
- Consume existing `buildRoundEventsPayload(roundResultId, publicEvents)`.

- [ ] Write failing tests that `savePracticeResultReturningId` POSTs with `Prefer: return=representation` and parses `[{ id }]`.
- [ ] Write failing tests that `saveRoundEvents` POSTs to `/rest/v1/round_events` and treats duplicate as saved-equivalent duplicate.
- [ ] Write failing store test that `finishRound()` sends `ruleset_id` and round events after result save.
- [ ] Implement minimal sync functions and store wiring.
- [ ] Run `npm run mobile:test` and fix only this task's failures.

### Task 2: CPU Game Settings Model and Store

**Files:**

- Create: `apps/mobile/src/features/cpu-game/cpuGameSettings.ts`
- Create: `apps/mobile/src/features/cpu-game/cpuGameSettings.test.ts`
- Create: `apps/mobile/src/state/cpuGameSettingsStore.ts`
- Modify: `apps/mobile/src/features/cpu-game/cpuGameAdapters.ts`
- Modify: `apps/mobile/src/state/cpuGameStore.ts`

**Interfaces:**

- Produce `DEFAULT_CPU_GAME_SETTINGS`, `parseCpuGameSettings(raw)`, `serializeCpuGameSettings(settings)`, `scaleThinkMillis(ms, settings)`.
- Produce `cpuGameSettingsStore` with `load`, `setAnimationSpeed`, `setLowMotion`.

- [ ] Write failing tests for default parse, corrupt JSON recovery, unknown value recovery, serialization, and speed scaling.
- [ ] Implement pure settings model.
- [ ] Write failing store tests for load/save success and save failure status.
- [ ] Implement settings store using `StoragePort` DI.
- [ ] Wire `advanceCpu()` to scale `thinkMillis` with the current settings.
- [ ] Run `npm run mobile:test`.

### Task 3: History and Stats Data Clients/ViewModels

**Files:**

- Create: `apps/mobile/src/features/cpu-game/historyModel.ts`
- Create: `apps/mobile/src/features/cpu-game/historyModel.test.ts`
- Create: `apps/mobile/src/features/cpu-game/statsModel.ts`
- Create: `apps/mobile/src/features/cpu-game/statsModel.test.ts`
- Create: `apps/mobile/src/state/cpuGameHistoryStore.ts`
- Create: `apps/mobile/src/state/cpuGameStatsStore.ts`

**Interfaces:**

- Produce `fetchCpuGameHistory(anonPlayerId, deps)` and `buildHistoryView(rows, eventsByRoundId)`.
- Produce `fetchCpuGameStats(anonPlayerId, deps)` and `buildStatsView(rows)`.
- Stores expose `load()` plus `status: 'idle' | 'loading' | 'empty' | 'ready' | 'failed'`.

- [ ] Write failing tests for history empty, missing events, cards/skills key conversion, and newest-first preservation.
- [ ] Implement history client/model.
- [ ] Write failing tests for stats 0-row, win rate formatting, and null win rate.
- [ ] Implement stats client/model.
- [ ] Add stores with DI, then run `npm run mobile:test`.

### Task 4: Screens, Navigation, Progress Docs, and Verification

**Files:**

- Modify: `apps/mobile/src/app/index.tsx`
- Modify: `apps/mobile/src/app/cpu-game/result.tsx`
- Create: `apps/mobile/src/app/cpu-game/history.tsx`
- Create: `apps/mobile/src/app/cpu-game/stats.tsx`
- Create: `apps/mobile/src/app/settings.tsx`
- Modify: `apps/mobile/src/i18n/translate.ts`
- Create: `docs/progress/M3-EX-04.md`
- Create: `docs/progress/M3-EX-05.md`
- Create: `docs/progress/M3-EX-08.md`

**Interfaces:**

- Screens read only from stores/ViewModels and call store actions.
- Translation keys cover every screen label, status, retry, and setting option.

- [ ] Add translation-key tests before adding keys.
- [ ] Implement screen routes and navigation buttons.
- [ ] Add progress docs in the existing Japanese format.
- [ ] Run `npm run mobile:test`, `npm run mobile:typecheck`, `npm run mobile:lint`, `npm run mobile:format:check`, `npm run mobile:export:android`, `npm run game-core:test`, `npm run game-core:typecheck`, `git diff --check`.
- [ ] Stage explicit paths only, commit with M3 TODO IDs in the subject, and push.
