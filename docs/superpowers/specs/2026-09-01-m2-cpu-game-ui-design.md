# M2 サブプロジェクト2：CPU戦 対局UIフロー 設計書

- 文書ID：GAME-SPEC-M2-SP2
- 版数：0.1
- 作成日：2026-09-01
- 基準文書：`独自カードゲーム_要件定義書_v0.2.md`（v0.3 本文、§4.2 / §14 / §20 / §22）、`独自カードゲーム_M2_詳細TODO_v0.2.md`
- 対象 TODO：M2-EX-04 / M2-EX-05 / M2-EX-06 / M2-EX-07（UI部）/ M2-EX-08 / M2-SB-02 / M2-EX-09 / M2-QA-02 / M2-QA-03
- 実装場所：`apps/mobile/`（Expo SDK 57 / expo-router / vanilla zustand / `node:test` + `tsx`）、`supabase/` は変更なし

---

## 1. 目的とスコープ

ホーム →「CPU戦」→ 人数選択 → 配布 → 人間1人とCPUが交互に手番 → 勝者決定 → 結果 → 再戦 or ホーム、を1本のアプリ内フローとして完走できるようにする。判定は `@card-game-app/game-core`（サブプロジェクト1で完成）へ全委譲。

### 到達状態（M2 §6）

- 2〜6人のCPU戦を開始できる（EX-04）
- 手札・場・相手・手番を表示できる（EX-05）
- 合法操作だけ確定できる（EX-06）
- 配布から勝者まで停止せず進む（EX-07 UI部）
- 勝者確認後にカードを再配布できる（EX-08）
- 同じ端末で練習統計を継続できる（SB-02）
- 一時失敗後も二重登録せず再送できる（EX-09）
- 全人数で1局完走できる（QA-02）
- 代表端末サイズで手札18枚と6枚が操作不能な重なり・欠けなく表示される（QA-03）

### スコープ外

| 項目 | 行き先 |
|---|---|
| 人間のスキル使用（Joker宣言・場流し、追加封印、革命） | M3-EX-01 / M3-EX-02（M2 は数字カード + パスのみ。CPU もスキル無し） |
| CPU のスキル判断 | M3-EX-03 |
| 手番タイマー・残り時間カウントダウン・時間切れ自動操作 | 公式対戦（将来）・フレンド対戦（M4）。M2 は「手番プレイヤー表示」のみ（UI-BATTLE-006 の時間部分は M4） |
| 卓／ルーム作成、招待リンク、Realtime 同期、マッチング、複数人間、同時卓のサーバ基盤 | M4（席抽象は M4-ready で作るが、オンライン層・卓UIは作らない） |
| カード移動アニメ、革命の背景反転演出、ロックの紋章・結界演出、SE/BGM | M2-GR-04 素材 + M3 以降の演出実装（M2 は View/Text の状態表示のみ、M0-QA-01 踏襲） |
| 対局履歴の専用画面、CPU戦統計の専用画面 | M3-EX-04 / M3-EX-05（M2 は対局中の簡易手番ログのみ） |
| 本番カードイラスト・属性フレーム | M2-GR-*（M2 は数字＋属性ラベル＋属性色＋形状で識別、UI-A11Y-001/002） |
| チュートリアル、不正理由の詳細支援表示 | M3-EX-06 / M3-EX-07（M2 は不正時に確定無効化＋簡潔な日本語理由） |

## 2. Global Constraints

- `apps/mobile` の既存パターンに従う：画面は `src/app/`（expo-router）、純ロジックは `src/features/<name>/*.ts` + `src/features/<name>/*.test.ts`（`node:test` + `tsx`、`npm run mobile:test`）、ストアは `src/state/*.ts`（`zustand/vanilla` の `createStore`）、文言は `src/i18n/translate.ts` の `jaDictionary` にキー追加して `translate()` 経由。
- 描画は `View` / `Text` / `Pressable` / `ScrollView` のみ。`react-native-svg`・アニメーションライブラリ・`react-test-renderer` は使わない（リポジトリに無い）。**画面のレンダーテストは書かない**。ロジックはすべて純モジュールへ出してテストする。
- デザイントークンは `@card-game-app/ui`（`colors` の `surface.table.day/night`・`suit.*`・`ink.*`・`state.*`、`spacing`、`radius`、`typography`、`card.aspectRatio`）。ハードコードした色を新規に増やさない（既存画面が持つ分は据え置き）。
- `game-core` の公開 API のみ使う。`game-core` は変更しない。使うのは `dealRound` / `numberDeck` / `enumerateLegalPlays` / `resolveCpuPolicy` / `rollThinkDelayMillis` / `resolvePlay` / `createRng` / `createRoundState` / `INITIAL_RULESET_VERSION` と型（`RoundState` / `PlayInput` / `LegalPlay` / `NumberCard` / `CpuPolicyId` / `PlayRejectionReason` / `DayNight` など）。
- **決定性**：1局は `seed` から完全再現できる。RNG は `createRng(seed)` を1本作り、配布に `fork()` 1回、手番ごとに `fork()` 1回（手番 index で消費、`roundLoop.ts` と同じ規律）。CPU の同点タイブレークも seed 再現。
- **横画面固定**（PLT-003 / UI-LAYOUT-001）。`app.json` は既に `"orientation": "landscape"`（アプリ全体）。3画面とも横向き前提でレイアウトを組む（縦積みの `ScrollView` に逃げず、上帯・相手列・場・手札・操作の横基準構成）。追加の orientation 設定は不要。
- **プライバシー**：相手の手札の中身は保持も表示もしない（枚数のみ、VIS-102）。手番ログ・保存ペイロード・分析イベントに非公開手札・スキル種別・`anon_player_id` 以外の個人情報を出さない。
- **ネイティブ依存の追加**：`@react-native-async-storage/async-storage` と `expo-crypto` を `npx expo install` で追加（`apps/mobile/package.json` に2行）。dev client の再ビルドが1回必要（リリースノートに記載）。テスト対象の純モジュールはこれらを**直接 import しない** — ストレージ・HTTP・乱数UUIDは注入ポート（`StoragePort` / `HttpPort` / `() => string`）で受け取り、実体（AsyncStorage / global `fetch` / `Crypto.randomUUID`）は画面側のアダプタで配線する。
- コミットは `main` 直、`[TODO-ID]` 付き Conventional Commits、明示パスのみ `git add`（`.idea/` は `.gitignore` 済み）。

## 3. 画面構成

expo-router、`src/app/cpu-game/` 配下。ホーム（`src/app/index.tsx`）に「CPU戦」ボタンを追加し `/cpu-game/setup` へ。`src/app/_layout.tsx` の `Stack` に3画面を登録。

| ルート | ファイル | TODO | 役割 |
|---|---|---|---|
| `/cpu-game/setup` | `src/app/cpu-game/setup.tsx` | EX-04 | 合計人数（2〜6）を選び「開始」。開始で `cpuGameStore.startMatch(total)` → `/cpu-game/play` へ replace |
| `/cpu-game/play` | `src/app/cpu-game/play.tsx` | EX-05/06/07 | 対局画面。ストアを購読し `boardViewModel` を描画。人間手番は手札選択＋提出/パス。CPU手番は思考待ち後に自動進行 |
| `/cpu-game/result` | `src/app/cpu-game/result.tsx` | EX-08 | 勝敗、勝者、統計への一言、「再戦」「ホームへ」 |

画面遷移：`setup --開始--> play --勝者決定--> result --再戦--> play`（`rematch()` 後）／`result --ホームへ--> /`（`exit()` 後）。`play` で戻る操作（ハードウェアバック）＝確認して `exit()`（対局破棄）。

### 画面状態一覧（各画面）

- **setup**：初期 / 人数選択済み（開始可能）/ 遷移中。通信・ローディングなし。
- **play**：配布直後（人間先攻 or CPU先攻）/ 人間手番（選択なし）/ 人間手番（合法選択）/ 人間手番（不正選択＝確定無効）/ CPU思考中 / 場流し直後 / ラウンド終了（result へ自動遷移）。空・通信失敗は該当なし（完全ローカル同期）。
- **result**：勝敗表示 / 保存中（結果を Supabase へ POST 中、非ブロッキング）/ 保存済み / 保存キュー投入（オフライン）/ 再戦遷移中。保存の成否は画面をブロックしない（小さなステータス表示のみ）。

## 4. 機能モジュール（`src/features/cpu-game/`、純 `.ts` + `.test.ts`）

### 4.1 `matchConfig.ts`

```ts
import type { CpuPolicyId } from '@card-game-app/game-core';

export type SeatKind = 'HUMAN' | 'CPU';

export type SeatConfig = {
  seatId: string;              // 'seat-0' .. 'seat-5'（playerIds として game-core に渡す）
  kind: SeatKind;
  policyId?: CpuPolicyId;       // kind === 'CPU' のとき必須
  nameKey: string;             // 'cpuGame.seat.you' / 'cpuGame.seat.cpu1' ...
};

export type MatchConfig = {
  seats: SeatConfig[];         // 席順（時計回り）。長さ 2..6
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export function isValidTotalPlayers(total: number): boolean;   // 整数かつ 2..6

// seat-0 = HUMAN、seat-1.. = CPU 'STANDARD'。M2 は常に人間1人。
export function buildMatchConfig(totalPlayers: number): MatchConfig;

export function seatPolicies(config: MatchConfig): Record<string, CpuPolicyId>;  // CPU 席のみ
export function humanSeatIds(config: MatchConfig): string[];    // M2 は 1 要素
export function isHumanSeat(config: MatchConfig, seatId: string): boolean;
```

**M4-ready**：`kind` で席を判定し、`activeSeatId === 'seat-0'` のようなハードコードをしない。M4 は「他席も HUMAN（リモート）」を足すだけ。

### 4.2 `turnDriver.ts`

対局の状態機械。純関数。画面は結果を描画し、CPU思考の実 `sleep` だけ持つ。

```ts
import type { DayNight, LegalPlay, PlayInput, PlayRejectionReason, RoundState } from '@card-game-app/game-core';
import type { CpuPolicyId } from '@card-game-app/game-core';
import type { MatchConfig } from './matchConfig';

export type GamePhase = 'HUMAN_TURN' | 'CPU_PENDING' | 'ROUND_OVER';

export type TurnLogEntry = {
  index: number;
  seatId: string;
  seatKind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS';
  cardCount: number;              // PASS は 0。cardId は保持しない
  actionKind: 'LEAD' | 'EXTEND' | 'REPLACE' | 'PASS';
  fieldCleared: boolean;
  dayNightAfter: DayNight;
  handCountsAfter: Record<string, number>;
};

export type DriverState = {
  config: MatchConfig;
  seed: number;
  rematchIndex: number;
  baselineFirstSeatId: string;    // 初局の先攻（再戦ローテーションの基準）
  round: RoundState;
  phase: GamePhase;
  turnLog: TurnLogEntry[];
  winnerSeatId: string | null;
};

export function initGame(input: {
  config: MatchConfig;
  seed: number;
  rematchIndex?: number;          // 0 = 初局
  baselineFirstSeatId?: string;   // rematchIndex >= 1 で必須
}): DriverState;

/** 人間の手番でのみ有効。resolvePlay で検証・適用し、フェーズを進める。 */
export function humanPlay(
  state: DriverState,
  input: PlayInput,
): { ok: true; next: DriverState } | { ok: false; reason: PlayRejectionReason };

/** 現在の CPU 席の1手を決定・適用する（決定的）。画面は呼ぶ前に thinkMillis だけ待つ。 */
export function cpuStep(state: DriverState): {
  next: DriverState;
  decided: { seatId: string; input: PlayInput; thinkMillis: number; actionKind: TurnLogEntry['actionKind'] };
};

/** 人間手番のときの合法手一覧（UI の活性/非活性用）。それ以外は []。 */
export function legalPlaysForHuman(state: DriverState): LegalPlay[];

export function activeSeatId(state: DriverState): string;
export function isHumanTurn(state: DriverState): boolean;
```

**手順（`initGame`）**：`createRng(seed)` → `dealRound({ playerIds: seats.map(s=>s.seatId), rng: rng.fork(), rematchIndex, baselineFirstPlayerId: baselineFirstSeatId })` → `createRoundState({ rulesetCode:'INITIAL', rulesetVersion: INITIAL_RULESET_VERSION, dayNight: deal.dayNight, players: deal.players, activePlayerId: deal.firstPlayerId })` → `phase` = 先攻が人間なら `HUMAN_TURN` 否なら `CPU_PENDING`。`baselineFirstSeatId` は初局なら `deal.firstPlayerId` を採用し返す。

**手順（`humanPlay` / `cpuStep`）**：`resolvePlay(round, input)` → `ok:false` なら理由を返す（human）/ throw（cpu、起こらない想定）→ `round = res.state`、`turnLog` に追記（`res.outcome` から `actionKind` / `fieldCleared` / `dayNightAfter`、`round.players` から `handCountsAfter`）→ `res.state.winnerId` があれば `phase='ROUND_OVER'`, `winnerSeatId` セット。無ければ次 `activePlayerId` の席種別で `HUMAN_TURN` / `CPU_PENDING`。

**RNG 規律**：`cpuStep` は `createRng(seed)` を作り直し、`fork()` を「配布1回 + 手番 index 回」進めて手番専用 rng を得る（`turnLog.length` が手番 index）。これで `humanPlay` の分岐に関係なく CPU の決定が seed 再現。`enumerateLegalPlays(round)` → `resolveCpuPolicy(policyId)({ state: round, legalPlays, rng: turnRng })` → `rollThinkDelayMillis(turnRng)`。

**不正手ガード**：`cpuStep` の `resolvePlay` が `ok:false` を返したらエラー（`{ seatId, input, reason }` 付き）。QA-02 がこれを検出する。

### 4.3 `handSelection.ts`

人間の手札選択の状態。

```ts
import type { LegalPlay, PlayInput } from '@card-game-app/game-core';

export type HandSelection = string[];   // 選択中の cardId（手札内の出現順）

// この cardId を選択に足せるか（足した集合が、ある合法手の cardIds の部分集合になるなら true）
export function canSelectCard(
  selection: HandSelection, cardId: string, legalPlays: LegalPlay[],
): boolean;

export function toggleCard(
  selection: HandSelection, cardId: string, legalPlays: LegalPlay[],
): HandSelection;   // 足せないカードを足そうとしたら selection を変えない。既選択なら外す

// 選択がちょうどある合法手の cardIds 集合に一致するか（提出可能か。UI-BATTLE-010）
export function canSubmit(selection: HandSelection, legalPlays: LegalPlay[]): boolean;

export function toPlayInput(selection: HandSelection, seatId: string): PlayInput; // { kind:'PLAY', playerId: seatId, cardIds: selection }

// パス可能か（場がある = 合法手に PASS エントリがある。UI-BATTLE-009：場が空なら false）
export function canPass(legalPlays: LegalPlay[]): boolean;
```

### 4.4 `boardViewModel.ts`

`DriverState`（+ 選択状態）から対局画面の表示データを導出。純関数。

```ts
import type { DayNight, NumberCard, SuitCode } from '@card-game-app/game-core';
import type { DriverState, GamePhase } from './turnDriver';
import type { HandSelection } from './handSelection';

export type OpponentView = {
  seatId: string;
  nameKey: string;
  numberCardCount: number;
  hasSkill: boolean;               // 未使用スキルを1枚保有（VIS-102）
  status: 'ACTIVE' | 'PASSED' | 'OUT';
  isActive: boolean;               // 現在の手番
};

export type FieldCardView = { rank: number; suitCode: SuitCode; isJoker: boolean };

export type FieldView = {
  cards: FieldCardView[];
  kind: 'SINGLE' | 'RANK_SET' | 'SEQUENCE';
  lastPlayerNameKey: string;
};

export type HandCardView = {
  cardId: string;
  rank: number;
  suitCode: SuitCode;
  isJoker: boolean;
  selected: boolean;
  selectable: boolean;             // canSelectCard の結果（未選択時）／選択中は常に true
};

export type BoardViewModel = {
  phase: GamePhase;
  dayNight: DayNight;
  strengthOrder: number[];         // UI-BATTLE-004：昼 [1..9]、夜 [9..1]
  activeSeatId: string;
  activeSeatNameKey: string;
  field: FieldView | null;         // null = 場なし
  lock: { countLocked: boolean; suitFixed: SuitCode[] | null; suitUniform: boolean };  // UI-BATTLE-005（属性ロックと追加封印は別表示）
  extensionSealed: boolean;
  opponents: OpponentView[];       // 人間以外の席、席順
  humanSkillNameKey: string | null;   // 人間の保有スキル名（M2 は使用不可の注記付き）
  hand: HandCardView[];            // 人間の手札、(rank,suit) 昇順
  canSubmit: boolean;
  canPass: boolean;
  winnerSeatId: string | null;
  winnerNameKey: string | null;
};

export function buildBoardViewModel(
  state: DriverState, selection: HandSelection, legalPlays: LegalPlay[],
): BoardViewModel;
```

### 4.5 `resultModel.ts`

```ts
import type { DriverState } from './turnDriver';

export type RoundResultView = {
  winnerSeatId: string;
  winnerNameKey: string;
  localWon: boolean;
  playerCount: number;
  turnCount: number;
  durationMs: number;
};

export function describeRoundResult(
  state: DriverState, startedAtMs: number, endedAtMs: number,
): RoundResultView;

// M2-SB-01 の practice_round_results の列に対応
export type PracticeResultPayload = {
  client_result_id: string;
  anon_player_id: string;
  mode: 'CPU_PRACTICE';
  player_count: number;
  local_player_seat: number;       // 人間席の index
  winner_seat: number;
  local_won: boolean;
  turn_count: number;
  duration_ms: number;
  round_seed: number;
};

export function buildPracticeResultPayload(input: {
  view: RoundResultView;
  state: DriverState;
  anonPlayerId: string;
  clientResultId: string;
}): PracticeResultPayload;
```

### 4.6 `anonPlayerId.ts`（M2-SB-02）

```ts
export type StoragePort = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const ANON_PLAYER_ID_KEY = 'card-game.anonPlayerId';

// キーがあれば返す。無ければ makeId() で生成し保存して返す。プロセス内メモ化。
export function getAnonPlayerId(deps: {
  storage: StoragePort;
  makeId: () => string;            // 実体は expo-crypto の randomUUID
}): Promise<string>;

export function __resetAnonPlayerIdMemoForTest(): void;
```

「同じ端末で練習統計を継続できる」＝ID が端末に永続化され、再起動後も同じ ID で `practice_round_results` を読める（読み取りクエリは M3-EX-05 の統計画面。M2 は保存のみ）。

### 4.7 `practiceResultSync.ts` / `practiceResultQueue.ts`（M2-EX-09）

```ts
import type { StoragePort } from './anonPlayerId';
import type { PracticeResultPayload } from './resultModel';

export type HttpPort = {
  post(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }>;
};

export type SaveOutcome = 'saved' | 'duplicate' | 'failed';

// POST /rest/v1/practice_round_results。201 → saved。409 または本文が unique 違反(23505) → duplicate。
// それ以外（ネットワーク例外・4xx/5xx） → failed。
export function savePracticeResult(
  payload: PracticeResultPayload,
  deps: { http: HttpPort; supabaseUrl: string; anonKey: string },
): Promise<SaveOutcome>;

export const QUEUE_KEY = 'card-game.practiceResultQueue';

// 失敗時に退避。client_result_id で重複排除。
export function enqueuePracticeResult(storage: StoragePort, payload: PracticeResultPayload): Promise<void>;

// キューを順に save。saved / duplicate は除去、failed は残す。
export function flushPracticeResultQueue(
  deps: { storage: StoragePort; http: HttpPort; supabaseUrl: string; anonKey: string },
): Promise<{ flushed: number; remaining: number }>;

// 対局終了時のオーケストレータ：save 試行 → failed なら enqueue。返り値は最終状態。
export function recordFinishedRound(
  payload: PracticeResultPayload,
  deps: { storage: StoragePort; http: HttpPort; supabaseUrl: string; anonKey: string },
): Promise<SaveOutcome>;
```

呼び出しタイミング：`recordFinishedRound` は結果画面到達時に1回。`flushPracticeResultQueue` はアプリ前面復帰時（`AppState` 'active'）＋対局終了ごと。`client_result_id` は対局終了時に `makeId()` で1回だけ生成し `DriverState` か結果ビューに保持（再送で同じ値を使う）。

### 4.8 i18n

`translate.ts` の `jaDictionary` に追加（抜粋、実装時に確定）：
`home.cpuGame`（"CPU戦"）、`cpuGame.setup.title` / `.players` / `.start` / `.playerCountValue`、`cpuGame.seat.you`（"あなた"）/ `.cpu1`〜`.cpu5`（"CPU 1"…）、`cpuGame.phase.yourTurn` / `.cpuThinking` / `.roundOver`、`cpuGame.action.submit`（"出す"）/ `.pass` / `.clear`、`cpuGame.field.empty` / `.lastPlayer`、`cpuGame.lock.count` / `.suitFixed` / `.suitUniform` / `.seal`、`cpuGame.dayNight.day` / `.night` / `.strengthOrder`、`cpuGame.opponent.cards`（"残り{n}枚"は数値埋め込み無しの実装なら分割）/ `.hasSkill` / `.status.PASSED` / `.status.OUT`、`cpuGame.skill.heldNote`（"M3で使用可能"）、`cpuGame.result.title` / `.youWin` / `.youLose` / `.winnerIs` / `.turns` / `.duration` / `.rematch` / `.home` / `.saveOk` / `.saveQueued`、`cpuGame.exitConfirm.*`。
不正理由は既存 `sandbox.reason.*`（`PlayRejectionReason` キー）を再利用。`translate.test.ts` の網羅マップに `cpuGame.*` 必須キーを追加。

## 5. ストア（`src/state/cpuGameStore.ts`、`zustand/vanilla`）

```ts
export type CpuGameState = {
  driver: DriverState | null;
  selection: HandSelection;
  legalPlays: LegalPlay[];          // 人間手番のときの合法手（派生キャッシュ）
  startedAtMs: number | null;
  clientResultId: string | null;
  result: RoundResultView | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'duplicate' | 'queued';

  startMatch: (totalPlayers: number, seed?: number) => void;   // seed 省略時は makeSeed()
  selectCard: (cardId: string) => void;
  clearSelection: () => void;
  submitPlay: () => { ok: boolean; reason?: PlayRejectionReason };
  pass: () => { ok: boolean; reason?: PlayRejectionReason };
  advanceCpu: () => void;           // 画面が thinkMillis 待ってから呼ぶ
  finishRound: () => Promise<void>; // ROUND_OVER 到達時に result を作り recordFinishedRound
  rematch: () => void;              // rematchIndex+1、baselineFirstSeatId 引き継ぎ
  exit: () => void;                 // 全リセット
};
```

- ストアは `game-core` と `features/cpu-game/*` の純関数だけを呼ぶ。`AsyncStorage` / `fetch` / `expo-crypto` は**直接触らない** — `startMatch` 等が必要とする `makeSeed` / `makeId` / `storage` / `http` は、ストア生成時にモジュール変数へ注入する薄い設定関数 `configureCpuGameStore(deps)` を用意し、アプリ起動時（`_layout.tsx`）に実体を配線、テストはフェイクを配線。
- `advanceCpu`：`driver.phase === 'CPU_PENDING'` のとき `cpuStep` を適用。次も CPU なら画面が再度 `thinkMillis` 待って `advanceCpu`。
- CPU思考待ちの実 `sleep` は**画面**（`play.tsx`）が持つ：`phase==='CPU_PENDING'` を検知 → `cpuStep` の `decided.thinkMillis` は `advanceCpu` 前に知る必要があるので、ストアは `peekCpuThinkMillis()` を提供するか、`advanceCpu` が `{ thinkMillisForNext }` を返して次待ちに使う。→ 実装：`advanceCpu()` が適用後の状態と「次が CPU_PENDING なら次の thinkMillis」を返す。最初の CPU 手番の待ちは `startMatch` / `submitPlay` / `pass` の返り値にも `nextCpuThinkMillis?: number` を含める。

## 6. 対局画面レイアウト（横画面）

```
┌─────────────────────────────────────────────────────────┐
│ 昼/夜  強弱順 1→9    手番: CPU 2        [履歴 ▾]          │  上帯
├─────────────────────────────────────────────────────────┤
│  [CPU1 7枚 ●skill ACTIVE]  [CPU2 5枚 ACTIVE*]  [CPU3 …]  │  相手パネル列（横スクロール可）
│                                                          │
│                  場: 火5 火6 火7  (SEQUENCE)             │  場（中央、全カード表示 UI-BATTLE-003）
│                  最終出し手: CPU1                         │
│         枚数ロック●  属性固定[火]  属性統一—  追加封印—    │  ロック/封印（別表示 UI-BATTLE-005）
├─────────────────────────────────────────────────────────┤
│  手札:  [2火][3火][3水][5風][8火][9土] …   （横スクロール）│  手札（選択可、18枚が収まる）
│  スキル: 勇者Joker（M3で使用可能）                         │
│  [ 出す ]  [ パス ]  [ 選択解除 ]        不正: 理由テキスト │  操作
└─────────────────────────────────────────────────────────┘
```

- 相手パネル：`OpponentView` を席順で。手番の席は枠強調＋`isActive`。`PASSED`/`OUT` はラベル＋淡色（色のみに依存しない、UI-A11Y-001）。
- カード表現：数字（大）＋属性（色＋日本語ラベル＋形状/記号）。変化Joker由来は「J」バッジ（既存 `CardChip` 準拠）。M2 はイラスト無し。
- `phase==='CPU_PENDING'`：手番 CPU パネルに「思考中…」、手札操作は無効。
- `phase==='HUMAN_TURN'`：`selectable` なカードのみ押下可、`canSubmit` で「出す」活性、`canPass` で「パス」活性（場が空なら非活性、UI-BATTLE-009）。不正選択（`canSubmit===false` かつ選択あり）で「出す」非活性＋簡潔理由（`sandbox.reason.*` から、または「この組み合わせは出せません」）。
- `phase==='ROUND_OVER'`：`result.tsx` へ自動 `replace`。
- 履歴：`turnLog` を上帯の折りたたみパネルで表示（手番進行を妨げない、UI-BATTLE-012）。専用画面は M3。

## 7. 決定性・エラー処理

- 同じ `seed` + 同じ人間の操作列 → 同じ最終状態・同じ CPU の手。`turnDriver.test.ts` で検証（人間役をスクリプト化して2回流し `deepEqual`）。
- `humanPlay` の `ok:false`：`reason` を UI へ。状態は不変。UI は「出す」を押させない設計だが二重防御。
- `cpuStep` が不正手（`resolvePlay` `ok:false`）：`Error`（`seatId` / `input` / `reason` / `turnIndex`）。QA-02 が検出。正常系では起きない（サブプロジェクト1で終局性・合法性を検証済み）。
- カード保存則（全手札 + discardPile + 場 = 36）を各手番後にストアで assert（M2 はスキル変化なし）。破れたら `Error`。
- 保存の失敗（`savePracticeResult` → `failed`）：結果画面はブロックしない。キュー投入し「後で再送します」表示。二重登録は `client_result_id` unique（DB）＋キューの重複排除で防ぐ。
- `getAnonPlayerId` のストレージ例外：`makeId()` の値を返し、保存だけ失敗を握りつぶす（ID がその起動限りになるが対局は続行）。

## 8. テスト方針

`apps/mobile/src/**/*.test.ts`（`npm run mobile:test`、`node:test` + `tsx`）。既存 62 件に回帰なし。

| モジュール | 主なケース |
|---|---|
| `matchConfig` | `isValidTotalPlayers` 境界（1/2/6/7、非整数）／`buildMatchConfig` が seat-0 HUMAN・残り CPU STANDARD・長さ N／`seatPolicies` は CPU 席のみ／`isHumanSeat` |
| `turnDriver` | `initGame` が人数別に配布・先攻フェーズ／`humanPlay` 合法手適用・不正 `reason`・状態不変／`cpuStep` が合法手のみ・`thinkMillis` 600–1200・決定的／人間役スクリプトで2〜6人が必ず `ROUND_OVER` 到達・`winnerSeatId` の手札0／同 seed + 同操作列で `deepEqual`／再戦 `rematchIndex` で先攻ローテーション |
| `handSelection` | `canSelectCard`（合法プレフィックスのみ）／`toggleCard` 追加・解除・不可時不変／`canSubmit`（完全一致のみ）／`canPass`（場あり/なし） |
| `boardViewModel` | 場あり/なしの `field`／`strengthOrder` 昼夜／`opponents` が人間除外・席順・status・isActive／`hand` の selected/selectable／`lock` と `extensionSealed` 別フィールド／**QA-03**：2人配布（手札18枚）と6人配布（6枚）で `hand.length` と各要素の形が正しい |
| `resultModel` | `describeRoundResult` の localWon・turnCount・durationMs／`buildPracticeResultPayload` が M2-SB-01 の列・型・CHECK（`local_won = (winner_seat = local_player_seat)`）を満たす |
| `anonPlayerId` | 初回生成・保存・2回目は同じ値／メモ化／ストレージ例外でも値を返す |
| `practiceResultSync` / `Queue` | 201→saved／409→duplicate／500→failed／ネットワーク例外→failed／`enqueue` の重複排除／`flush` が saved・duplicate を除去し failed を残す／`recordFinishedRound` の save→enqueue フォールバック |
| `cpuGameStore` | `startMatch`→`submitPlay`/`pass`/`advanceCpu` ループで **2〜6人すべて1局完走（= M2-QA-02）**、不正手 throw 0、カード保存則維持、同 seed 再現／`rematch` で継続／`exit` で全リセット／`finishRound` が `recordFinishedRound` を1回呼ぶ（フェイク http） |

**M2-QA-02**：`cpuGameStore.test.ts` の「全人数完走」テスト＋固定 seed 群で複数局。レポート `docs/qa/M2-QA-02-cpu-game-smoke-report.md`。
**M2-QA-03**：`boardViewModel.test.ts` の 18枚/6枚 構造テスト＋実機目視チェックリスト `docs/qa/M2-QA-03-hand-layout-report.md`（M1-EX-10 レポートの書式。実機での重なり・欠け・タップ領域はユーザーが確認）。

## 9. 完了確認

- `npm run mobile:test`（新規 + 既存 62、全 PASS）
- `npm run mobile:typecheck` / `mobile:lint` / `mobile:format:check`
- `npm run game-core:test` / `:typecheck`（回帰なし）
- `npx expo export --platform android`（バンドル成立。新ネイティブ依存の解決確認）
- `git diff --check`
- 進捗記録：`docs/progress/M2-EX-04.md` 〜 `M2-EX-09.md`、`M2-QA-02.md`、`M2-QA-03.md`
- リリースノート的メモ：`@react-native-async-storage/async-storage` + `expo-crypto` 追加につき dev client 再ビルドが必要（`npx expo prebuild` 済み環境なら `npm run android` 再実行、Expo Go なら SDK 同梱で可）

## 10. 将来への申し送り（M3 / M4）

- **M3-EX-01/02**：人間のスキルUI（Joker宣言画面、追加封印/革命のトグル）。`turnDriver.humanPlay` は既に `PlayInput`（`useSkill` / `jokerDeclarations` 含む）を受けるので、UI を足すだけ。
- **M3-EX-03**：CPU のスキルポリシー。`matchConfig` の `policyId` を差し替えるだけ（`game-core` 側で新ポリシー追加済み前提）。
- **M3-EX-04/05**：対局履歴・CPU戦統計の専用画面。`turnLog` と `practice_round_results`（`anon_player_id` 索引）から。
- **M4**：`SeatConfig.kind` に「リモート人間」を足し、`turnDriver` の外側にオンライン同期層（Realtime 購読、`resolvePlay` はサーバ権威）。卓作成UIは新規画面。`turnDriver` の純粋な状態機械はそのまま。
- **手番タイマー（UI-BATTLE-006）**：M4 のルーム設定（15/30/60/無制限）とセットで。M2 は「手番プレイヤー表示」のみで時間は出さない。
