# M2 CPU戦 対局UIフロー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ホーム →「CPU戦」→ 人数選択 → 配布 → 人間1人とCPUが交互に手番 → 勝者 → 結果 → 再戦/ホーム、を1本のアプリ内フローとして完走できるようにする（M2-EX-04/05/06/07-UI/08 + M2-SB-02 + M2-EX-09 + M2-QA-02/03）。

**Architecture:** 判定は `@card-game-app/game-core`（サブプロジェクト1完成）へ全委譲。UI 用ターンドライバ（人間入力とCPU自動手番を交互に回す純粋状態機械）＋盤面ビューモデル＋手札選択＋結果保存を、すべて `apps/mobile/src/features/cpu-game/*.ts` の純モジュールに置き `.test.ts` でカバー。画面（`src/app/cpu-game/*.tsx`）は `cpuGameStore` / `boardViewModel` の薄い皮に徹し、ロジックを持たない。

**Tech Stack:** Expo SDK 57 / expo-router / `zustand/vanilla` / TypeScript / `node:test` + `tsx`。新規ネイティブ依存：`@react-native-async-storage/async-storage`、`expo-crypto`。

**設計書:** `docs/superpowers/specs/2026-09-01-m2-cpu-game-ui-design.md`（§番号で参照。型・レイアウトの正本）。

## Global Constraints

- 既存 `apps/mobile` パターン厳守：画面 `src/app/`（expo-router）、純ロジック `src/features/<name>/*.ts` + `.test.ts`（`npm run mobile:test` = `tsx --test src/**/*.test.ts`）、ストア `src/state/*.ts`（`zustand/vanilla` の `createStore`）、文言は `src/i18n/translate.ts` の `jaDictionary` にキー追加 → `translate()` 経由。
- 描画は `View` / `Text` / `Pressable` / `ScrollView` のみ。SVG・アニメライブラリ・`react-test-renderer` 不使用。**画面のレンダーテストは書かない。**
- `game-core` は変更しない。公開 API のみ使用。
- **純モジュールは `@react-native-async-storage/async-storage` / `expo-crypto` / global `fetch` を直接 import しない。** ストレージ・HTTP・UUID生成・seed生成は注入ポート（`StoragePort` / `HttpPort` / `() => string` / `() => number`）で受け、実体は画面側アダプタ（`src/features/cpu-game/cpuGameAdapters.ts`）で配線。
- デザイントークンは `@card-game-app/ui`（`colors` / `spacing` / `radius` / `typography` / `card`）。新規ハードコード色を増やさない。
- **決定性**：1局は `seed` から完全再現。`createRng(seed)` を作り、配布に `fork()` 1回、手番ごとに `fork()` 1回（手番 index = `turnLog.length` で消費）。`roundLoop.ts` と同じ規律。
- `seatId`（`'seat-0'`..`'seat-5'`）を `game-core` の `playerId` として渡す。
- 相手の手札の中身を保持・表示・記録しない（枚数のみ、VIS-102）。`TurnLogEntry` / 保存ペイロードに cardId・スキル種別・個人情報を出さない。
- 画面は機能プレースホルダ。デザイン確定後に差し替える前提でロジックを持たせない。カード描画は1つの `CardFace` 経由、入力はパック非依存データのみ。`MatchConfig.packId` は常に `'DEFAULT'`。
- コミットは `main` 直、`[TODO-ID]` 付き Conventional Commits、**明示パスのみ `git add`（`git add -A` / `git add .` 禁止）**。末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- 各タスク完了時：`npm run mobile:test` + `npm run mobile:typecheck` が通る、既存 62 mobile テストに回帰なし。

## 参照する `game-core` シンボル

```ts
function dealRound(input: { playerIds: readonly string[]; rng: Rng; rematchIndex?: number; baselineFirstPlayerId?: string }):
  { players: PlayerState[]; firstPlayerId: string; dayNight: 'DAY'; eightCardSeatId: string | null };
function numberDeck(): NumberCard[];
function enumerateLegalPlays(state: RoundState): LegalPlay[];
function resolveCpuPolicy(id: CpuPolicyId): (input: { state: RoundState; legalPlays: LegalPlay[]; rng: Rng }) => PlayInput;
function rollThinkDelayMillis(rng: Rng): number;   // [600,1200]
function resolvePlay(state: RoundState, play: PlayInput):
  | { ok: true; state: RoundState; outcome: { actionKind: 'LEAD'|'EXTEND'|'REPLACE'|'PASS'; fieldCleared: boolean; naturalRevolution: boolean; dayNightAfter: DayNight; winnerId: string | null } }
  | { ok: false; reason: PlayRejectionReason; state: RoundState };
function createRng(seed: number): Rng;   // Rng.fork(): Rng
function createRoundState(input: { rulesetCode: 'INITIAL'; rulesetVersion: number; dayNight: DayNight; players: PlayerState[]; activePlayerId: string }): RoundState;
const INITIAL_RULESET_VERSION: number;
// types: RoundState, PlayInput ({kind:'PASS',playerId} | {kind:'PLAY',playerId,cardIds}), LegalPlay ({input,actionKind,resultingCombination,goesOut}),
//        NumberCard ({kind:'NUMBER',cardId,rankCode,suitCode,transformedFromSkillId?}), PlayerState ({playerId,status,hand,skill,consecutivePasses}),
//        CpuPolicyId ('STANDARD'), PlayRejectionReason, DayNight ('DAY'|'NIGHT'), SuitCode, RankCode
function rankNumber(rankCode: RankCode): number;
function isTransformedJokerCard(card: NumberCard | null | undefined): boolean;
```

---

## Task 1: 依存追加・i18n・ホーム導線・ルート雛形

**Files:**
- Modify: `apps/mobile/package.json` (deps)
- Modify: `apps/mobile/src/i18n/translate.ts`, `apps/mobile/src/i18n/translate.test.ts`
- Modify: `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/index.tsx`
- Create: `apps/mobile/src/app/cpu-game/setup.tsx`, `apps/mobile/src/app/cpu-game/play.tsx`, `apps/mobile/src/app/cpu-game/result.tsx` (最小スタブ)

- [ ] **Step 1: ネイティブ依存を追加** — `apps/mobile` で `npx expo install @react-native-async-storage/async-storage expo-crypto`。`package.json` の `dependencies` に2行入ることを確認（バージョンは Expo SDK 57 が選ぶもの）。

- [ ] **Step 2: i18n キーを追加** — `translate.ts` の `jaDictionary` に以下を追加（日本語）。既存の並びに合わせる。
```
'home.cpuGame': 'CPU戦',
'cpuGame.setup.title': 'CPU戦の設定',
'cpuGame.setup.players': '人数',
'cpuGame.setup.start': '開始',
'cpuGame.seat.you': 'あなた',
'cpuGame.seat.cpu': 'CPU',
'cpuGame.phase.yourTurn': 'あなたの手番',
'cpuGame.phase.cpuThinking': '思考中…',
'cpuGame.phase.roundOver': '対局終了',
'cpuGame.action.submit': '出す',
'cpuGame.action.pass': 'パス',
'cpuGame.action.clear': '選択解除',
'cpuGame.field.empty': '場なし',
'cpuGame.field.lastPlayer': '最終出し手',
'cpuGame.lock.count': '枚数ロック',
'cpuGame.lock.suitFixed': '属性固定ロック',
'cpuGame.lock.suitUniform': '属性統一ロック',
'cpuGame.lock.seal': '追加封印',
'cpuGame.dayNight.day': '昼',
'cpuGame.dayNight.night': '夜',
'cpuGame.dayNight.strengthOrder': '強弱順',
'cpuGame.opponent.cardsSuffix': '枚',
'cpuGame.opponent.hasSkill': 'スキル保有',
'cpuGame.opponent.status.PASSED': 'パス',
'cpuGame.opponent.status.OUT': '上がり',
'cpuGame.skill.heldNote': 'M3で使用可能',
'cpuGame.invalid': 'この組み合わせは出せません',
'cpuGame.result.title': '結果',
'cpuGame.result.youWin': 'あなたの勝ち',
'cpuGame.result.youLose': 'あなたの負け',
'cpuGame.result.winnerIs': '勝者',
'cpuGame.result.turns': '手番数',
'cpuGame.result.duration': '対局時間',
'cpuGame.result.rematch': '再戦',
'cpuGame.result.home': 'ホームへ',
'cpuGame.result.saveOk': '結果を保存しました',
'cpuGame.result.saveQueued': '結果は後で保存します',
'cpuGame.exit.confirmTitle': '対局を終了しますか？',
'cpuGame.exit.confirmOk': '終了',
'cpuGame.exit.confirmCancel': 'つづける',
'cpuGame.history': '履歴',
'cpuGame.seatShort.you': 'あなた',
```
`translate.test.ts`：`cpuGame.*` の必須キー網羅チェックがあれば追加。無ければ「全 `cpuGame.` キーが引ける」テストを1件追加。

- [ ] **Step 3: ホームに導線** — `src/app/index.tsx` の catalog / sandbox ボタンの前に「CPU戦」`Link href="/cpu-game/setup"` を追加（既存 `styles.button` 流用、`translate('home.cpuGame')`）。

- [ ] **Step 4: ルート登録** — `src/app/_layout.tsx` の `Stack` に3画面追加：
```tsx
<Stack.Screen name="cpu-game/setup" options={{ title: translate('cpuGame.setup.title') }} />
<Stack.Screen name="cpu-game/play" options={{ title: translate('app.title'), headerBackVisible: false }} />
<Stack.Screen name="cpu-game/result" options={{ title: translate('cpuGame.result.title'), headerBackVisible: false }} />
```

- [ ] **Step 5: 画面スタブ** — 3ファイルを最小の `export default function ...(){ return <View><Text>...</Text></View> }` で作る（Task 10 で中身）。typecheck を通すため。

- [ ] **Step 6: 確認** — `npm run mobile:typecheck && npm run mobile:test && npm run mobile:lint && npm run mobile:format:check`、`npx expo export --platform android`（バンドル成立）。

- [ ] **Step 7: コミット** — `git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/src/i18n/translate.ts apps/mobile/src/i18n/translate.test.ts apps/mobile/src/app/_layout.tsx apps/mobile/src/app/index.tsx apps/mobile/src/app/cpu-game/`（package-lock は expo install が変えた場合）。`feat(mobile): [M2] add cpu-game deps, i18n keys, home link, route stubs`

> ルートの `package-lock.json` も変わる可能性がある。変わっていれば同コミットに含める。

---

## Task 2: `matchConfig.ts`

**Files:** Create `apps/mobile/src/features/cpu-game/matchConfig.ts` + `.test.ts`

**Interfaces (Produces):** 設計書 §4.1 の全シンボル。`SeatKind`, `SeatConfig`, `MatchConfig`, `MIN_PLAYERS`(2), `MAX_PLAYERS`(6), `DEFAULT_PACK_ID`('DEFAULT'), `isValidTotalPlayers`, `buildMatchConfig`, `seatPolicies`, `humanSeatIds`, `isHumanSeat`.

- [ ] **Step 1: 失敗するテスト** — `matchConfig.test.ts`:
```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig, isHumanSeat, isValidTotalPlayers, seatPolicies, humanSeatIds, DEFAULT_PACK_ID } from './matchConfig';

test('isValidTotalPlayers accepts 2..6 integers only', () => {
  for (const n of [2, 3, 4, 5, 6]) assert.equal(isValidTotalPlayers(n), true);
  for (const n of [1, 7, 0, -1, 2.5, Number.NaN]) assert.equal(isValidTotalPlayers(n), false);
});

test('buildMatchConfig: seat-0 is HUMAN, rest are CPU STANDARD, length N, packId DEFAULT', () => {
  const c = buildMatchConfig(4);
  assert.equal(c.seats.length, 4);
  assert.equal(c.packId, DEFAULT_PACK_ID);
  assert.deepEqual(c.seats.map((s) => s.seatId), ['seat-0', 'seat-1', 'seat-2', 'seat-3']);
  assert.equal(c.seats[0].kind, 'HUMAN');
  assert.ok(c.seats.slice(1).every((s) => s.kind === 'CPU' && s.policyId === 'STANDARD'));
  assert.equal(c.seats[0].nameKey, 'cpuGame.seat.you');
});

test('buildMatchConfig throws for invalid totals', () => {
  assert.throws(() => buildMatchConfig(1), RangeError);
  assert.throws(() => buildMatchConfig(7), RangeError);
});

test('seatPolicies covers only CPU seats; humanSeatIds is the one human', () => {
  const c = buildMatchConfig(3);
  assert.deepEqual(seatPolicies(c), { 'seat-1': 'STANDARD', 'seat-2': 'STANDARD' });
  assert.deepEqual(humanSeatIds(c), ['seat-0']);
  assert.equal(isHumanSeat(c, 'seat-0'), true);
  assert.equal(isHumanSeat(c, 'seat-1'), false);
});
```

- [ ] **Step 2:** 実行して失敗を確認 (`npm run mobile:test`)。

- [ ] **Step 3: 実装** — `matchConfig.ts`:
```ts
import type { CpuPolicyId } from '@card-game-app/game-core';

export type SeatKind = 'HUMAN' | 'CPU';
export type SeatConfig = { seatId: string; kind: SeatKind; policyId?: CpuPolicyId; nameKey: string };
export type MatchConfig = { seats: SeatConfig[]; packId: string };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DEFAULT_PACK_ID = 'DEFAULT';

export function isValidTotalPlayers(total: number): boolean {
  return Number.isInteger(total) && total >= MIN_PLAYERS && total <= MAX_PLAYERS;
}

export function buildMatchConfig(totalPlayers: number): MatchConfig {
  if (!isValidTotalPlayers(totalPlayers)) {
    throw new RangeError(`buildMatchConfig: total must be ${MIN_PLAYERS}..${MAX_PLAYERS}, got ${totalPlayers}`);
  }
  const seats: SeatConfig[] = Array.from({ length: totalPlayers }, (_, i) =>
    i === 0
      ? { seatId: 'seat-0', kind: 'HUMAN', nameKey: 'cpuGame.seat.you' }
      : { seatId: `seat-${i}`, kind: 'CPU', policyId: 'STANDARD', nameKey: `cpuGame.seat.cpu` },
  );
  return { seats, packId: DEFAULT_PACK_ID };
}

export function seatPolicies(config: MatchConfig): Record<string, CpuPolicyId> {
  return Object.fromEntries(
    config.seats.filter((s) => s.kind === 'CPU').map((s) => [s.seatId, s.policyId ?? 'STANDARD']),
  );
}
export function humanSeatIds(config: MatchConfig): string[] {
  return config.seats.filter((s) => s.kind === 'HUMAN').map((s) => s.seatId);
}
export function isHumanSeat(config: MatchConfig, seatId: string): boolean {
  return config.seats.some((s) => s.seatId === seatId && s.kind === 'HUMAN');
}
```
> `nameKey` は `'cpuGame.seat.cpu'` 固定。画面側で席 index を付けて "CPU 2" のように表示する（i18n に番号を埋めない方針）。ビューモデルが `nameKey` + index を返す（Task 5）。

- [ ] **Step 4:** GREEN 確認 + typecheck。

- [ ] **Step 5: コミット** — `feat(mobile): [M2-EX-04] add cpu-game match config`

---

## Task 3: `turnDriver.ts`

**Files:** Create `apps/mobile/src/features/cpu-game/turnDriver.ts` + `.test.ts`

**Interfaces:** 設計書 §4.2 の全シンボル。Consumes: `matchConfig.ts`（`MatchConfig`, `seatPolicies`, `isHumanSeat`）、`game-core`。

- [ ] **Step 1: 失敗するテスト** — `turnDriver.test.ts`。少なくとも：
```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { enumerateLegalPlays } from '@card-game-app/game-core';
import { buildMatchConfig } from './matchConfig';
import { initGame, humanPlay, cpuStep, isHumanTurn, activeSeatId, legalPlaysForHuman } from './turnDriver';

const start = (n: number, seed = n * 1000 + 1) => initGame({ config: buildMatchConfig(n), seed });

// 人間役スクリプト: 人間手番は「最初の合法手」を出す。CPU手番は cpuStep。ROUND_OVER まで。
function playToEnd(n: number, seed: number) {
  let s = start(n, seed);
  let guard = 0;
  while (s.phase !== 'ROUND_OVER') {
    if (++guard > 500) throw new Error(`no progress n=${n} seed=${seed}`);
    if (isHumanTurn(s)) {
      const legal = legalPlaysForHuman(s);
      assert.ok(legal.length > 0);
      const res = humanPlay(s, legal[0].input);
      assert.equal(res.ok, true, res.ok ? '' : `human illegal: ${(res as { reason: string }).reason}`);
      s = (res as { next: typeof s }).next;
    } else {
      s = cpuStep(s).next;
    }
  }
  return s;
}

for (const n of [2, 3, 4, 5, 6]) {
  test(`a full ${n}-player game reaches ROUND_OVER with a real winner`, () => {
    const s = playToEnd(n, n * 7919 + 13);
    assert.ok(s.winnerSeatId);
    const winner = s.round.players.find((p) => p.playerId === s.winnerSeatId);
    assert.equal(winner?.hand.length, 0);
  });
}

test('same seed + same human choices => identical final state', () => {
  const a = playToEnd(4, 4242);
  const b = playToEnd(4, 4242);
  assert.deepEqual(a, b);
});

test('humanPlay rejects an illegal move without mutating state', () => {
  const s = start(2, 1);
  // 場が空なのに PASS は不正
  const before = JSON.stringify(s);
  const res = humanPlay(s, { kind: 'PASS', playerId: activeSeatId(s) });
  assert.equal(res.ok, false);
  assert.equal(JSON.stringify(s), before);
});

test('cpuStep decides a legal move with a 600..1200 think delay', () => {
  let s = start(3, 99);
  while (isHumanTurn(s)) s = humanPlay(s, legalPlaysForHuman(s)[0].input).ok ? (humanPlay(s, legalPlaysForHuman(s)[0].input) as { next: typeof s }).next : s;
  const { decided } = cpuStep(s);
  assert.ok(decided.thinkMillis >= 600 && decided.thinkMillis <= 1200);
});
```

- [ ] **Step 2:** 失敗確認。

- [ ] **Step 3: 実装** — `turnDriver.ts`。中核ロジック（設計書 §4.2「手順」に従う）：
```ts
import {
  createRng, createRoundState, dealRound, enumerateLegalPlays, INITIAL_RULESET_VERSION,
  resolveCpuPolicy, resolvePlay, rollThinkDelayMillis,
  type DayNight, type LegalPlay, type PlayInput, type PlayRejectionReason, type RoundState, type Rng,
} from '@card-game-app/game-core';
import { isHumanSeat, seatPolicies, type MatchConfig } from './matchConfig';

export type GamePhase = 'HUMAN_TURN' | 'CPU_PENDING' | 'ROUND_OVER';
export type TurnLogEntry = {
  index: number; seatId: string; seatKind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS'; cardCount: number;
  actionKind: 'LEAD' | 'EXTEND' | 'REPLACE' | 'PASS';
  fieldCleared: boolean; dayNightAfter: DayNight; handCountsAfter: Record<string, number>;
};
export type DriverState = {
  config: MatchConfig; seed: number; rematchIndex: number; baselineFirstSeatId: string;
  round: RoundState; phase: GamePhase; turnLog: TurnLogEntry[]; winnerSeatId: string | null;
};

function phaseFor(config: MatchConfig, round: RoundState): GamePhase {
  if (round.winnerId) return 'ROUND_OVER';
  return isHumanSeat(config, round.activePlayerId) ? 'HUMAN_TURN' : 'CPU_PENDING';
}

function turnRng(seed: number, turnIndex: number): Rng {
  const rng = createRng(seed);
  rng.fork();                 // 配布分
  for (let i = 0; i < turnIndex; i += 1) rng.fork();
  return rng.fork();
}

export function initGame(input: {
  config: MatchConfig; seed: number; rematchIndex?: number; baselineFirstSeatId?: string;
}): DriverState {
  const rematchIndex = input.rematchIndex ?? 0;
  const rng = createRng(input.seed);
  const deal = dealRound({
    playerIds: input.config.seats.map((s) => s.seatId),
    rng: rng.fork(),
    rematchIndex,
    baselineFirstPlayerId: input.baselineFirstSeatId,
  });
  const round = createRoundState({
    rulesetCode: 'INITIAL', rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: deal.dayNight, players: deal.players, activePlayerId: deal.firstPlayerId,
  });
  return {
    config: input.config, seed: input.seed, rematchIndex,
    baselineFirstSeatId: input.baselineFirstSeatId ?? deal.firstPlayerId,
    round, phase: phaseFor(input.config, round), turnLog: [], winnerSeatId: round.winnerId,
  };
}

function appendTurn(state: DriverState, seatId: string, input: PlayInput, res: Extract<ReturnType<typeof resolvePlay>, { ok: true }>): DriverState {
  const seatKind = isHumanSeat(state.config, seatId) ? 'HUMAN' : 'CPU';
  const entry: TurnLogEntry = {
    index: state.turnLog.length, seatId, seatKind,
    kind: input.kind === 'PASS' ? 'PASS' : 'PLAY',
    cardCount: input.kind === 'PASS' ? 0 : input.cardIds.length,
    actionKind: res.outcome.actionKind, fieldCleared: res.outcome.fieldCleared,
    dayNightAfter: res.outcome.dayNightAfter,
    handCountsAfter: Object.fromEntries(res.state.players.map((p) => [p.playerId, p.hand.length])),
  };
  return {
    ...state, round: res.state, turnLog: [...state.turnLog, entry],
    phase: phaseFor(state.config, res.state), winnerSeatId: res.state.winnerId,
  };
}

export function humanPlay(state: DriverState, input: PlayInput):
  | { ok: true; next: DriverState } | { ok: false; reason: PlayRejectionReason } {
  if (state.phase !== 'HUMAN_TURN' || input.playerId !== state.round.activePlayerId) {
    return { ok: false, reason: 'NOT_ACTIVE_PLAYER' };
  }
  const res = resolvePlay(state.round, input);
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, next: appendTurn(state, input.playerId, input, res) };
}

export function cpuStep(state: DriverState): {
  next: DriverState;
  decided: { seatId: string; input: PlayInput; thinkMillis: number; actionKind: TurnLogEntry['actionKind'] };
} {
  const seatId = state.round.activePlayerId;
  const rng = turnRng(state.seed, state.turnLog.length);
  const legalPlays = enumerateLegalPlays(state.round);
  const policyId = seatPolicies(state.config)[seatId];
  const input = resolveCpuPolicy(policyId)({ state: state.round, legalPlays, rng });
  const thinkMillis = rollThinkDelayMillis(rng);
  const res = resolvePlay(state.round, input);
  if (!res.ok) {
    throw new Error(`cpuStep: policy "${policyId}" illegal at turn ${state.turnLog.length} (${res.reason}): ${JSON.stringify(input)}`);
  }
  return {
    next: appendTurn(state, seatId, input, res),
    decided: { seatId, input, thinkMillis, actionKind: res.outcome.actionKind },
  };
}

export function legalPlaysForHuman(state: DriverState): LegalPlay[] {
  return state.phase === 'HUMAN_TURN' ? enumerateLegalPlays(state.round) : [];
}
export function activeSeatId(state: DriverState): string { return state.round.activePlayerId; }
export function isHumanTurn(state: DriverState): boolean { return state.phase === 'HUMAN_TURN'; }
```

- [ ] **Step 4:** GREEN + typecheck。全 seed で `ROUND_OVER` 到達しなければ実バグ — seed を出して調査（`maxTurns` 相当の guard に逃げない）。

- [ ] **Step 5: コミット** — `feat(mobile): [M2-EX-07] add cpu-game turn driver`

---

## Task 4: `handSelection.ts`

**Files:** Create `apps/mobile/src/features/cpu-game/handSelection.ts` + `.test.ts`

**Interfaces:** 設計書 §4.3。

- [ ] **Step 1: 失敗するテスト** — 代表ケース：空場で単体を1枚選ぶと `canSubmit` true／2枚目に同 rank を選べる（同数セットが合法なら）／連番の途中カードは選べない（合法手に無い組合せ）／`toggleCard` で既選択を外す／`canPass` は合法手に PASS があるとき true。`LegalPlay[]` はテスト内で手で構築するか `enumerateLegalPlays` を実状態で呼んで得る（後者推奨）。

- [ ] **Step 2:** 失敗確認。

- [ ] **Step 3: 実装** — `handSelection.ts`:
```ts
import type { LegalPlay, PlayInput } from '@card-game-app/game-core';

export type HandSelection = string[];

function playSet(p: LegalPlay): Set<string> | null {
  return p.input.kind === 'PLAY' ? new Set(p.input.cardIds) : null;
}
function isSubsetOf(a: Iterable<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function canSelectCard(selection: HandSelection, cardId: string, legalPlays: LegalPlay[]): boolean {
  if (selection.includes(cardId)) return true;   // 既選択は外せる = 触れる
  const candidate = [...selection, cardId];
  return legalPlays.some((p) => {
    const set = playSet(p);
    return set != null && isSubsetOf(candidate, set);
  });
}

export function toggleCard(selection: HandSelection, cardId: string, legalPlays: LegalPlay[]): HandSelection {
  if (selection.includes(cardId)) return selection.filter((id) => id !== cardId);
  if (!canSelectCard(selection, cardId, legalPlays)) return selection;
  return [...selection, cardId];
}

export function canSubmit(selection: HandSelection, legalPlays: LegalPlay[]): boolean {
  if (selection.length === 0) return false;
  const sel = new Set(selection);
  return legalPlays.some((p) => {
    const set = playSet(p);
    return set != null && set.size === sel.size && isSubsetOf(sel, set);
  });
}

export function toPlayInput(selection: HandSelection, seatId: string): PlayInput {
  return { kind: 'PLAY', playerId: seatId, cardIds: [...selection] };
}

export function canPass(legalPlays: LegalPlay[]): boolean {
  return legalPlays.some((p) => p.input.kind === 'PASS');
}
```

- [ ] **Step 4:** GREEN + typecheck.
- [ ] **Step 5: コミット** — `feat(mobile): [M2-EX-06] add cpu-game hand selection`

---

## Task 5: `boardViewModel.ts` + `CardFace` の型

**Files:** Create `apps/mobile/src/features/cpu-game/boardViewModel.ts` + `.test.ts`

**Interfaces:** 設計書 §4.4。Consumes: `turnDriver.ts`, `handSelection.ts`, `matchConfig.ts`, `game-core`。

- [ ] **Step 1: 失敗するテスト** — 代表：
  - `initGame(buildMatchConfig(2), seed)` で `hand.length === 18`（2人配布）、`buildMatchConfig(6)` で `6`（**M2-QA-03 の構造検証**）。各 `HandCardView` が `{ cardId, rank, suitCode, isJoker, selected, selectable }` を持つ。
  - `opponents` が人間席（seat-0）を除外、席順、`numberCardCount` が `round.players` と一致、`isActive` が手番席で true。
  - 場あり状態で `field.cards` が全カード、`field.kind`。場なしで `field === null`。
  - `strengthOrder` が昼 `[1..9]`、（夜状態を作って）`[9..1]`。
  - `lock` と `extensionSealed` が別フィールド。
  - `activeSeatNameKey` が手番席の `nameKey`。
- [ ] **Step 2:** 失敗確認。
- [ ] **Step 3: 実装** — 設計書 §4.4 の型どおり。`hand` は `round.players` の人間席 `hand` を `(rankNumber, suitCode順)` で並べ、`selected = selection.includes(cardId)`、`selectable = selected || canSelectCard(selection, cardId, legalPlays)`。`opponents` は `config.seats.filter(kind==='CPU')` を席順で、`hasSkill = player.skill != null && !player.skill.used`。`field` は `round.activeField?.combination` から。`lock` は `round.activeField?.lock ?? { countLocked:false, suitFixed:null, suitUniform:false }`。`strengthOrder`: `round.dayNight === 'DAY' ? [1..9] : [9..1]`。`humanSkillNameKey`: 人間 `player.skill` があれば `'cpuGame.skill.' + effectCode` 形式（または既存 `sandbox.skill.*` キー再利用）。
  - `CardFace` に渡すのは `{ rank, suitCode, isJoker }` のみ。`FieldCardView` / `HandCardView` はそれを内包。
- [ ] **Step 4:** GREEN + typecheck。
- [ ] **Step 5: コミット** — `feat(mobile): [M2-EX-05] add cpu-game board view model`

---

## Task 6: `anonPlayerId.ts` (M2-SB-02)

**Files:** Create `apps/mobile/src/features/cpu-game/anonPlayerId.ts` + `.test.ts`

- [ ] **Step 1: 失敗するテスト** — フェイク `StoragePort`（Map ベース）で：初回は `makeId` を呼んで保存し返す／2回目は保存済み値を返す（`makeId` 呼ばれない）／`__resetAnonPlayerIdMemoForTest` 後は再度ストレージから読む／`storage.getItem` が throw しても `makeId()` の値を返す（保存失敗は握り潰し）。
- [ ] **Step 2:** 失敗確認。
- [ ] **Step 3: 実装** — 設計書 §4.6:
```ts
export type StoragePort = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
export const ANON_PLAYER_ID_KEY = 'card-game.anonPlayerId';
let memo: string | null = null;

export async function getAnonPlayerId(deps: { storage: StoragePort; makeId: () => string }): Promise<string> {
  if (memo) return memo;
  try {
    const existing = await deps.storage.getItem(ANON_PLAYER_ID_KEY);
    if (existing) { memo = existing; return existing; }
  } catch { /* fall through to generate */ }
  const id = deps.makeId();
  memo = id;
  try { await deps.storage.setItem(ANON_PLAYER_ID_KEY, id); } catch { /* keep in-memory only */ }
  return id;
}
export function __resetAnonPlayerIdMemoForTest(): void { memo = null; }
```
- [ ] **Step 4:** GREEN + typecheck.
- [ ] **Step 5: コミット** — `feat(mobile): [M2-SB-02] add anonymous player id`

---

## Task 7: `resultModel.ts` (M2-EX-08 の一部)

**Files:** Create `apps/mobile/src/features/cpu-game/resultModel.ts` + `.test.ts`

**Interfaces:** 設計書 §4.5。Consumes: `turnDriver.ts`, `matchConfig.ts`。

- [ ] **Step 1: 失敗するテスト** — `initGame` → 人間役スクリプトで完走した `DriverState` に対し `describeRoundResult(state, 0, 30000)` が `{ winnerSeatId, winnerNameKey, localWon, playerCount, turnCount, durationMs: 30000 }`。`localWon` は `winnerSeatId` が人間席のとき true。`buildPracticeResultPayload` の出力が M2-SB-01 の列名・型、かつ `local_won === (winner_seat === local_player_seat)`（CHECK 整合）、`round_seed === state.seed`。
- [ ] **Step 2:** 失敗確認。
- [ ] **Step 3: 実装** — 設計書 §4.5。`winner_seat` / `local_player_seat` は `seatId`（`'seat-3'`）から index を取る（`config.seats.findIndex`）。`winnerNameKey` は勝者席の `nameKey`。
- [ ] **Step 4:** GREEN + typecheck.
- [ ] **Step 5: コミット** — `feat(mobile): [M2-EX-08] add cpu-game result model`

---

## Task 8: `practiceResultSync.ts` + `practiceResultQueue.ts` (M2-EX-09)

**Files:** Create both + `.test.ts`. Consumes: `resultModel.ts`（`PracticeResultPayload`）, `anonPlayerId.ts`（`StoragePort`）。

- [ ] **Step 1: 失敗するテスト** — フェイク `HttpPort`：
  - `savePracticeResult`：`{ status: 201, body: '' }` → `'saved'`；`{ status: 409, body: '...duplicate key...23505...' }` → `'duplicate'`；`{ status: 500 }` → `'failed'`；`post` が reject → `'failed'`。POST 先 URL が `${supabaseUrl}/rest/v1/practice_round_results`、ヘッダに `apikey` / `authorization: Bearer <anonKey>` / `Content-Type: application/json` / `Prefer: return=minimal` を含むこと。
  - `enqueuePracticeResult` → フェイク storage に JSON 配列で入る、同 `client_result_id` を2回入れても1件。
  - `flushPracticeResultQueue`：キューに2件（1つは http が saved、1つは failed）→ `{ flushed: 1, remaining: 1 }`、残るのは failed の方。
  - `recordFinishedRound`：http saved → `'saved'`、キュー空のまま；http failed → `'failed'`、キューに1件。
- [ ] **Step 2:** 失敗確認。
- [ ] **Step 3: 実装** — 設計書 §4.7。`duplicate` 判定は `status === 409 || body.includes('23505') || body.toLowerCase().includes('duplicate key')`。`enqueue`/`flush` は `storage.getItem(QUEUE_KEY)` を `JSON.parse`（無ければ `[]`）、`setItem(QUEUE_KEY, JSON.stringify(...))`。
- [ ] **Step 4:** GREEN + typecheck.
- [ ] **Step 5: コミット** — `feat(mobile): [M2-EX-09] add practice result save + offline resend queue`

---

## Task 9: `cpuGameStore.ts`

**Files:** Create `apps/mobile/src/state/cpuGameStore.ts` + `.test.ts`

**Interfaces:** 設計書 §5。Consumes: `features/cpu-game/*`（全部）, `zustand/vanilla`。

- [ ] **Step 1: 失敗するテスト** — `cpuGameStore.test.ts`。`configureCpuGameStore` にフェイク（`makeSeed: () => 12345`, `makeId` はカウンタで `'id-1'`,`'id-2'`…, `now: () => 1_000_000`, in-memory `storage`, fake `http` returning `{status:201,body:''}` と呼び出し記録）を配線。**M2-QA-02 の本体**：
```ts
// 2〜6人すべて: startMatch(n) → ループ:
//   phase HUMAN_TURN  → selectCard で最初の合法手のカードを順に選び submitPlay()
//   phase CPU_PENDING → advanceCpu() then commitCpuReveal()
//   phase ROUND_OVER  → break
// を回し、必ず ROUND_OVER 到達・winnerSeatId の手札0・不正手 throw なし・
// 各適用後に Σhand+discard+field===36 を assert。
// finishRound() 後 http.post 呼び出しが1回・payload が M2-SB-01 列を満たす・saveStatus==='saved'。
```
さらに：`rematch()` で `driver.rematchIndex` が +1・先攻がローテーション（`baselineFirstSeatId` から時計回り）。`exit()` で `driver === null` / `result === null`。同じフェイク（同 seed）で2回流して最終 `driver` が `deepEqual`。`http` を `{status:500}` にすると `finishRound` 後 `saveStatus==='queued'` かつ storage の QUEUE_KEY に1件。
- [ ] **Step 2:** 失敗確認。
- [ ] **Step 3: 実装** — 設計書 §5。
  - `configureCpuGameStore(deps: { makeSeed: () => number; makeId: () => string; storage: StoragePort; http: HttpPort; supabaseUrl: string; anonKey: string })` — モジュール変数へ保存。未配線で `startMatch` 等が呼ばれたら明確な `Error`。
  - `startMatch(total, seed?)`: `buildMatchConfig(total)` → `initGame` → ストア初期化、`startedAtMs = Date.now()`（`Date.now` はストアが持ってよい、決定性は seed のみが担保。テストは `durationMs` を検査しない or `deps.now` を注入）→ 実は `now` も注入にする：`configureCpuGameStore` に `now: () => number` を追加。
  - `submitPlay()`: `toPlayInput(selection, activeSeatId)` → `humanPlay` → 成功なら `driver` 更新・`selection` クリア・`legalPlays` 再計算・`{ ok: true }`。失敗は `{ ok: false, reason }`、状態不変。
  - **CPU 進行は2フェーズ（staged reveal）**。ストアに `pendingCpuReveal: { decided: <cpuStep().decided>; nextDriver: DriverState } | null` を持つ。
    - `advanceCpu()`：`driver.phase === 'CPU_PENDING' && pendingCpuReveal == null` のとき `cpuStep(driver)` を呼ぶが **`driver` にはまだ適用しない**。結果を `pendingCpuReveal` に格納し `{ thinkMillis: decided.thinkMillis }` を返す。それ以外は no-op で `{ thinkMillis: 0 }`。
    - `commitCpuReveal()`：`pendingCpuReveal` があれば `driver = pendingCpuReveal.nextDriver`、`pendingCpuReveal = null`、`legalPlays` 再計算、カード保存則 assert。`driver.winnerId` があれば以降 `finishRound` は画面が呼ぶ。
    - `boardViewModel` は `pendingCpuReveal != null` の間、盤面は**据え置き**（手が反映される前）で、手番 CPU 席に「思考中」を出す（`phase` は実質 `CPU_PENDING` のまま。ビューモデルに `cpuThinking: boolean` を足す）。
    - これで「CPU パネルが thinkMillis 秒『思考中』→ その後に手が盤面へ反映」という CPU-007 準拠の挙動になり、`turnDriver` は無変更。
  - `finishRound()`: `phase==='ROUND_OVER'` のとき `describeRoundResult` → `result` セット → `getAnonPlayerId` → `buildPracticeResultPayload`（`clientResultId` は `makeId()` を1回、`clientResultId` フィールドに保持し重複呼び出し防止）→ `recordFinishedRound` → `saveStatus` 更新。
  - `rematch()`: `initGame({ config, seed: makeSeed(), rematchIndex: driver.rematchIndex + 1, baselineFirstSeatId: driver.baselineFirstSeatId })`。`result` / `saveStatus` リセット。
  - `exit()`: すべて初期化。
  - カード保存則 assert：各 `submitPlay` / `advanceCpu` 適用後に `Σhand + discard + field === 36` を確認、破れたら `Error`。
- [ ] **Step 4:** GREEN + typecheck。全人数完走を確認。
- [ ] **Step 5: コミット** — `feat(mobile): [M2-EX-07] add cpu-game store and full-game loop`

> このタスクで `advanceCpu` の thinkMillis 受け渡し方式が固まる。Task 10 の画面はそれに従う。もし戻り値方式が破綻するなら Task 3 に `peekThinkMillis(state): number` を足す小変更を許可（レビューで判断）。

---

## Task 10: 画面（`CardFace` / `setup` / `play` / `result`）+ アダプタ配線

**Files:**
- Create: `apps/mobile/src/features/cpu-game/CardFace.tsx`
- Create: `apps/mobile/src/features/cpu-game/cpuGameAdapters.ts`
- Rewrite: `apps/mobile/src/app/cpu-game/setup.tsx`, `play.tsx`, `result.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`（`configureCpuGameStore` 配線）

- [ ] **Step 1: `CardFace.tsx`** — props `{ rank: number; suitCode: SuitCode; isJoker: boolean; size: 'hand' | 'field' | 'mini' }`。既存 `sandbox/index.tsx` の `CardChip` 相当（数字大＋属性色ボーダー＋日本語ラベル＋変化Joker「J」バッジ）。`size` で寸法を変える。`@card-game-app/ui` の `colors.suit` / `radius.card` / `typography` 使用。パック非依存。**ロジック無し。**

- [ ] **Step 2: `cpuGameAdapters.ts`** — 実体を組む：
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getAppConfig } from '../../config/appEnv';
import type { StoragePort } from './anonPlayerId';
import type { HttpPort } from './practiceResultSync';

export const storagePort: StoragePort = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
};
export const httpPort: HttpPort = {
  async post(url, headers, body) {
    const r = await fetch(url, { method: 'POST', headers, body });
    return { status: r.status, body: await r.text() };
  },
};
export const makeId = () => Crypto.randomUUID();
export const makeSeed = () => Math.floor(Math.random() * 2 ** 31);
export const now = () => Date.now();
export function cpuGameDeps() {
  const cfg = getAppConfig();
  return { storage: storagePort, http: httpPort, makeId, makeSeed, now,
           supabaseUrl: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey };
}
```

- [ ] **Step 3: `_layout.tsx`** — `import { configureCpuGameStore } from '../state/cpuGameStore'; import { cpuGameDeps } from '../features/cpu-game/cpuGameAdapters';` を追加し、コンポーネント本体の外（モジュールトップ）で `configureCpuGameStore(cpuGameDeps())` を1回。

- [ ] **Step 4: `setup.tsx`** — 人数 2〜6 の選択（`Pressable` 6個 or +/−）、`isValidTotalPlayers` で「開始」活性。開始で `useCpuGameStore.getState().startMatch(total)` → `router.replace('/cpu-game/play')`。文言 `cpuGame.setup.*`。`accessibilityRole` / `accessibilityState` を付ける。

- [ ] **Step 5: `play.tsx`** — 設計書 §6 のレイアウト。`const vm = buildBoardViewModel(driver, selection, legalPlays)` をストア購読から作る（またはストアが `boardViewModel` を派生セレクタで出す）。
  - 上帯：昼夜 + `strengthOrder` + 手番席名（`translate(vm.activeSeatNameKey)` + CPU席は index）+ 履歴トグル。
  - 相手列：`vm.opponents` を `ScrollView horizontal`、各パネルに名前・`numberCardCount` + `cpuGame.opponent.cardsSuffix`・`hasSkill` ドット・status・`isActive` 枠。
  - 場：`vm.field` を `CardFace size="field"` の行、`lastPlayer`、`vm.lock` / `vm.extensionSealed` を別々に（`cpuGame.lock.*`）。
  - 手札：`ScrollView horizontal`、`vm.hand` を `CardFace size="hand"`、`selectable` で押下可、`selected` で強調。タップ → `store.selectCard(cardId)`。
  - 操作：「出す」（`vm.canSubmit`）→ `store.submitPlay()`、「パス」（`vm.canPass`）→ `store.pass()`、「選択解除」→ `store.clearSelection()`。`submitPlay`/`pass` が `{ ok:false, reason }` を返したら `translate('sandbox.reason.'+reason)` か `cpuGame.invalid` を表示。
  - CPU 進行：`useEffect`（依存 `[phase, pendingCpuReveal]`）で —
    - `phase==='CPU_PENDING' && !pendingCpuReveal` → `const { thinkMillis } = store.advanceCpu()`（ステージ）。
    - `pendingCpuReveal` あり → `const t = setTimeout(() => store.commitCpuReveal(), thinkMillisFromLastAdvance)`（`thinkMillis` は直近 `advanceCpu` 戻りを ref に保持）。cleanup で `clearTimeout`。
    - `commitCpuReveal` 後、次も `CPU_PENDING` なら同じ effect が再度回る。
  - `phase==='ROUND_OVER'` → `useEffect` で `store.finishRound()` 実行後 `router.replace('/cpu-game/result')`。
  - ハードウェアバック：`useEffect` で確認ダイアログ（`Alert.alert`）→ OK で `store.exit()` + `router.replace('/')`。

- [ ] **Step 6: `result.tsx`** — `vm`/`store.result` から勝敗（`youWin`/`youLose`）、`winnerIs` + 勝者名、`turns`、`duration`（`durationMs` を秒表示）。`saveStatus` に応じて `saveOk` / `saveQueued`。「再戦」→ `store.rematch()` + `router.replace('/cpu-game/play')`。「ホームへ」→ `store.exit()` + `router.replace('/')`。

- [ ] **Step 7: 確認** — `npm run mobile:typecheck && npm run mobile:lint && npm run mobile:format:check && npm run mobile:test`（画面テストは無いが既存全通過）、`npx expo export --platform android`（新ネイティブ依存含めバンドル成立）。

- [ ] **Step 8: コミット** — `feat(mobile): [M2-EX-04/05/06/08] wire cpu-game screens`

---

## Task 11: QA ドキュメント・進捗ドキュメント・スイープ

**Files:**
- Create: `docs/qa/M2-QA-02-cpu-game-smoke-report.md`, `docs/qa/M2-QA-03-hand-layout-report.md`
- Create: `docs/progress/M2-EX-04.md` … `M2-EX-09.md`, `docs/progress/M2-QA-02.md`, `docs/progress/M2-QA-03.md`

- [ ] **Step 1: M2-QA-02 レポート** — `cpuGameStore.test.ts` / `turnDriver.test.ts` の全人数完走テストを根拠に、`docs/qa/M2-QA-02-cpu-game-smoke-report.md`（`docs/qa/M2-QA-01-*` の書式）：対象・実行コマンド・結果（2〜6人 × N seed、全局 ROUND_OVER 到達、不正手 throw 0、カード保存則違反 0）・不具合 高0中0低0・回帰登録・残課題（昼夜の全組み合わせ手動確認は実機 QA で）。

- [ ] **Step 2: M2-QA-03 レポート** — `boardViewModel.test.ts` の 18枚/6枚 構造テストを自動確認欄に、実機目視チェックリスト（`docs/qa/M1-EX-10-*` 書式）：横画面スマホ/タブレットで手札18枚・6枚が重なり・欠け・タップ領域不足なく表示、相手6席が収まる、文字拡大で操作が欠けない、TalkBack 読み上げ順。各行「未確認」で置き（ユーザーが実機確認して更新）。

- [ ] **Step 3: 進捗ドキュメント** — 各 TODO の `docs/progress/M2-EX-0X.md`（日本語、既存書式）。1ファイルに複数 EX をまとめず、TODO 単位。内容：状態=完了（QA-03 実機部分は「実機確認待ち」）/ 日付 / 概要 / 成果物 / 確認 / メモ（申し送り：デザイン画面差し替えは `boardViewModel`/ストア契約の上、`CardFace` がパック継ぎ目、`packId` は `'DEFAULT'` 固定、スキルUI は M3）。

- [ ] **Step 4: 全体スイープ**
```
npm run mobile:test
npm run mobile:typecheck
npm run mobile:lint
npm run mobile:format:check
npm run game-core:test
npm run game-core:typecheck
npx expo export --platform android
git diff --check
```
すべて PASS を進捗ドキュメントに記録。

- [ ] **Step 5: コミット** — `docs(progress): [M2] record cpu-game UI flow completion`

---

## Self-Review

**1. Spec coverage:**

| 設計書 | タスク |
|---|---|
| §3 画面構成 | Task 1（雛形）+ Task 10（実装） |
| §4.1 matchConfig | Task 2 |
| §4.2 turnDriver | Task 3 |
| §4.3 handSelection | Task 4 |
| §4.4 boardViewModel + CardFace | Task 5（型・ロジック）+ Task 10（`CardFace.tsx`） |
| §4.5 resultModel | Task 7 |
| §4.6 anonPlayerId | Task 6 |
| §4.7 practiceResultSync/Queue | Task 8 |
| §4.8 i18n | Task 1 |
| §5 store | Task 9 |
| §6 レイアウト | Task 10 |
| §7 決定性・エラー | Task 3/9 のテスト + カード保存則 assert |
| §8 テスト方針 | 各タスクの `.test.ts` |
| §9 完了確認 | Task 11 |

**2. Placeholder scan:** i18n キーは Task 1 に実キーを列挙済み。CPU 進行は Task 9 の staged reveal（`advanceCpu` ステージ → `commitCpuReveal` 適用）で確定、`turnDriver` 無変更。`boardViewModel` に `cpuThinking: boolean` を足す（Task 5 で `pendingCpuReveal` 相当を受けるか、Task 9 でストア派生として持つ — Task 5 のビューモデルは `DriverState` のみ受けるので `cpuThinking` はストアが別途持ち画面へ渡す）。

**3. Type consistency:**
- `seatId` = `game-core` の `playerId`（全タスク共通）。
- `PracticeResultPayload`（Task 7）の列名は M2-SB-01 マイグレーション（`docs/superpowers/specs/2026-09-01-m2-practice-round-results-design.md` §3）と一致：`client_result_id` / `anon_player_id` / `mode` / `player_count` / `local_player_seat` / `winner_seat` / `local_won` / `turn_count` / `duration_ms` / `round_seed`。
- `StoragePort` は `anonPlayerId.ts`（Task 6）で定義、Task 8 が import。
- `HttpPort` は `practiceResultSync.ts`（Task 8）で定義、Task 10 のアダプタが実装。
- `DriverState` / `GamePhase` / `TurnLogEntry` は Task 3 で定義、Task 5/7/9 が消費。
- `MatchConfig` / `SeatConfig` は Task 2 で定義、Task 3/5/7/9 が消費。

**4. 純モジュールのネイティブ依存排除:** `matchConfig` / `turnDriver` / `handSelection` / `boardViewModel` / `anonPlayerId` / `resultModel` / `practiceResultSync` / `practiceResultQueue` / `cpuGameStore` はいずれも `@react-native-async-storage/async-storage` / `expo-crypto` / `react-native` を import しない（`cpuGameStore` は `Date` も注入 `now`）。実体配線は `cpuGameAdapters.ts`（Task 10）と `_layout.tsx` のみ。→ 全モジュールが `tsx --test` で動く。
