# M2 サブプロジェクト1：ヘッドレスCPU対局エンジン 設計書

- 文書ID：GAME-SPEC-M2-SP1
- 版数：0.1
- 作成日：2026-09-01
- 基準文書：`独自カードゲーム_要件定義書_v0.2.md`（v0.3 本文）、`独自カードゲーム_M2_詳細TODO_v0.2.md`
- 対象 TODO：M2-EX-01 / M2-EX-02 / M2-EX-03 / M2-EX-07（エンジン部）／ M2-QA-01 の土台
- 実装場所：`packages/game-core/src/`（zero-dep、`node:test` + `tsx`）

---

## 1. 目的とスコープ

`resolvePlay` が既に「1手の状態遷移（PLAY/PASS・場流し・手番送り・最初の上がりで局終了）」を完全に担っている。本サブプロジェクトはその上に、純ロジックの層を積む：

1. 決定的乱数（seed から生成、注入）
2. 2〜6人の配布・先攻・昼初期化（再戦ローテーション含む）
3. 現在状態からの全合法手の列挙
4. 標準CPU（複数タイプ選択可能なレジストリ構造、M2 出荷は1種類）
5. 配布から勝者まで無停止で進むヘッドレス対局ループ（毎手トレース + `stopReason`）

### スコープ外

| 項目 | 行き先 |
|---|---|
| 対局画面・CPU戦設定画面・手札操作UI・思考待ちの実 `sleep` | M2 サブプロジェクト2（M2-EX-04/05/06/07 UI部・EX-08） |
| `practice_round_results` 保存・匿名プレイヤーID・ローカル再送 | M2 サブプロジェクト3（M2-SB-01/02・EX-09） |
| CPU のスキル判断（Joker・追加封印・革命） | M3-EX-03 |
| 人間の手番タイマー・時間切れ自動操作（TIMER-001 / TIMEOUT-001〜006） | 公式対戦（将来）・フレンド対戦（M4） |
| 棄権検出・CPU引継ぎ・FORFEIT-102 敗北記録 | M4（§7 に継ぎ目を明記） |
| オンライン同期・サーバ権威・並行対局管理 | M4 |

## 2. Global Constraints

- `packages/game-core` は依存を追加しない（zero-dep、`node:test` + `tsx` のみ）。
- `game-core:typecheck` は `src/index.ts` 経由のみ型検査する。新規公開シンボルはすべて `src/index.ts` から re-export する。テストファイルは型検査対象外なので、テスト側の型健全性は手動監査で担保する。
- game-core は純粋・同期・決定的。時計・タイマー・スレッド・I/O・グローバル可変状態を持たない。乱数は必ず注入された `Rng` 経由。
- 表示名・日本語文言・resource key を対局状態や内部IDへ保存しない。
- 非公開手札・未使用スキルをログへ出さない（`TurnRecord` は手札の中身を持たず枚数のみ）。
- カードID命名は既存規約に従う：数字 `CARD_NUMBER_RANK_r_SUIT_s`、スキル物理カード `SKILL_CARD_<EFFECT>` および複数枚は `_1` / `_2` サフィックス。
- 既存の公開 API（`resolvePlay`・`createRoundState`・`evaluate*` 群など）のシグネチャは変更しない。追加のみ。

## 3. ファイル構成

すべて `packages/game-core/src/` に新規作成し、`src/index.ts` から re-export する。

| ファイル | 責務 | 主な公開シンボル |
|---|---|---|
| `rng.ts` | 決定的PRNG（mulberry32）とシャッフル | `Rng`, `createRng`, `shuffle` |
| `deal.ts` | 配布・先攻・昼初期化・再戦ローテーション、正準デッキ定数 | `NUMBER_DECK`, `SKILL_DECK`, `dealRound`, `DealInput`, `DealResult` |
| `legalMoves.ts` | 現手番の全合法手の列挙 | `LegalPlay`, `enumerateLegalPlays` |
| `cpuPolicy.ts` | CPUポリシーの型・レジストリ・思考待ち算出 | `CpuPolicyId`, `CpuPolicy`, `CpuDecisionInput`, `CPU_POLICY_IDS`, `resolveCpuPolicy`, `rollThinkDelayMillis` |
| `cpuPolicyStandard.ts` | 標準CPUポリシー実装 | `standardPolicy` |
| `roundLoop.ts` | ヘッドレス対局ループ | `playRound`, `PlayRoundInput`, `TurnRecord`, `RoundStopReason`, `RoundResult` |

`index.ts` のルールエンジン本体（`resolvePlay` ほか）は編集しない。

## 4. モジュール詳細

### 4.1 `rng.ts`

```ts
export type Rng = {
  nextUint32(): number;             // [0, 2^32)
  nextInt(bound: number): number;   // [0, bound)  bound は正の整数
  nextFloat(): number;              // [0, 1)
  fork(): Rng;                      // 独立ストリーム。呼び出すと自分は1歩進む
};

export function createRng(seed: number): Rng;
export function shuffle<T>(rng: Rng, items: readonly T[]): T[];
```

- アルゴリズムは mulberry32（32bit、依存なし、決定的）。`seed` は `Math.trunc` して `>>> 0` で uint32 に丸める。
- `nextInt(bound)` は剰余バイアスを避けるため rejection sampling を使う。`bound <= 0` は `RangeError`。
- `fork()` は現在の内部状態から新しい種を1つ引き（`nextUint32()`）、その種で新しい `Rng` を作って返す。親はその1歩分進む。子と親、子どうしは独立。
- `shuffle` は入力を変更せず新しい配列を返す。Fisher–Yates（末尾から `nextInt` で交換）。出力は入力の並べ替えであり多重集合として不変。

### 4.2 `deal.ts`

```ts
export const NUMBER_DECK: readonly NumberCard[];  // 36枚。rank 1..9 × suit の4種、id = CARD_NUMBER_RANK_r_SUIT_s
export const SKILL_DECK: readonly SkillCard[];    // 6枚。used=false
//   SKILL_CARD_JOKER_HERO        effect SKILL_JOKER_HERO
//   SKILL_CARD_JOKER_SAINT       effect SKILL_JOKER_SAINT
//   SKILL_CARD_EXTENSION_SEAL_1  effect SKILL_EXTENSION_SEAL
//   SKILL_CARD_EXTENSION_SEAL_2  effect SKILL_EXTENSION_SEAL
//   SKILL_CARD_REVOLUTION_1      effect SKILL_REVOLUTION
//   SKILL_CARD_REVOLUTION_2      effect SKILL_REVOLUTION

export type DealInput = {
  playerIds: readonly string[];       // 2〜6、席順（時計回り）。重複不可
  rng: Rng;
  rematchIndex?: number;              // 0 = 初局（既定）
  baselineFirstPlayerId?: string;     // 再戦時、初局の先攻プレイヤーID。rematchIndex >= 1 で必須
};

export type DealResult = {
  players: PlayerState[];             // playerIds と同順。hand は (rankNumber, suitCode) 昇順。skill 1枚。status ACTIVE。consecutivePasses 0
  firstPlayerId: string;
  dayNight: "DAY";
  eightCardSeatId: string | null;     // 5人のときのみ非null（= その局で8枚を受け取る席）
};

export function dealRound(input: DealInput): DealResult;
```

**配布枚数**（SETUP-001/002）：

| 人数 | 枚数 |
|---:|---|
| 2 | 18 ×2 |
| 3 | 12 ×3 |
| 4 | 9 ×4 |
| 5 | 8 ×1、7 ×4 |
| 6 | 6 ×6 |

**手順**：
1. `playerIds` を検証（長さ 2〜6、重複なし）。外れたら `RangeError`。`rematchIndex >= 1` かつ `baselineFirstPlayerId` 未指定 → `RangeError`。
2. `numbers = shuffle(rng, NUMBER_DECK)`、`skills = shuffle(rng, SKILL_DECK)`（`rng` をこの順で消費）。
3. 8枚席インデックス `eightSeatIndex` を決定：
   - 5人以外 → `null`。
   - 5人・初局（`rematchIndex === 0`）→ `rng.nextInt(5)`。
   - 5人・再戦 → `(baselineSeatIndex + rematchIndex) % 5`。`baselineSeatIndex` は `playerIds.indexOf(baselineFirstPlayerId)`。
4. 各席へ数字カードを配る。5人なら `eightSeatIndex` の席が8枚、他が7枚。それ以外は均等。配る順は席順、`numbers` を先頭から。
5. 各席へ `skills[i]` を1枚。余剰スキルは対局外（配らない）。
6. 先攻 `firstPlayerId` を決定：
   - 5人 → 8枚席（= `playerIds[eightSeatIndex]`）（SETUP-003/006）。
   - 5人以外・初局 → `playerIds[rng.nextInt(n)]`（SETUP-004）。
   - 5人以外・再戦 → `playerIds[(baselineSeatIndex + rematchIndex) % n]`（SETUP-005）。
7. 各席の `hand` を `(rankNumber, suitCode)` 昇順でソート。
8. `dayNight: "DAY"` 固定（WIN-107：再戦時も昼へ戻す）。

**乱数消費順序の固定**：`shuffle(numbers)` → `shuffle(skills)` → （必要なら）8枚席 `nextInt` → （必要なら）初局先攻 `nextInt`。この順序は仕様として固定する（テストが依存する）。

### 4.3 `legalMoves.ts`

```ts
export type LegalPlay = {
  input: PlayInput;                              // kind:"PLAY"（cardIds のみ、useSkill/jokerDeclarations なし）または kind:"PASS"
  actionKind: PlayActionKind | "PASS";           // LEAD | EXTEND | REPLACE | PASS
  resultingCombination: NumberCombination | null; // PASS は null
  goesOut: boolean;                              // この手で手番プレイヤーの数字手札が0になる
};

export function enumerateLegalPlays(state: RoundState): LegalPlay[];
```

- 対象は `state.activePlayerId` のみ。`state.winnerId` が非nullなら空配列。
- **M2 は数字カードのプレイのみ列挙する**（`useSkill` を伴う手は列挙しない）。`evaluatePass` 相当が合法なら `PASS` を1件含める。
- **候補生成**（手番プレイヤーの数字手札から）：
  - 単体：各カード1枚。
  - 同数セット：同一 rank が2枚以上ある rank について、サイズ 2〜min(4, 枚数) の全組合せ。
  - 連番セット：連続する rank 窓（長さ 2〜9、各 rank を手札が1枚以上持つ）について、各 rank から1枚選ぶ全属性組合せ（連番の拡張は2枚から起こり得るため、下限は2）。組合せ爆発を防ぐため、1回の列挙で1窓あたり生成する連番候補は上限（`SEQUENCE_CANDIDATE_CAP = 1024`）でガードし、上限超過時はその窓をスキップして良い。到達しうる最大は「18枚の手札 = 6 rank × 3 suit」の窓で 3^6 = 729 であり、1024 がこれを安全マージン込みで覆う（超過窓は通常対局では発生しない）。
- **検証**：各候補 `cardIds` について `resolvePlay(state, { kind:"PLAY", playerId: activePlayerId, cardIds })` をドライラン。`ok === true` のものだけ採用し、`outcome.actionKind` を `actionKind` に、採用手の `resolvePlay` 後 `state` から手番プレイヤーの `hand.length === 0` を `goesOut` に、反映後 `activeField.combination` を `resultingCombination` に写す。判定ロジックを列挙器側に複製しない（`resolvePlay` が唯一の正）。
- **決定的順序**：`actionKind`（PASS を末尾）→ カード枚数 昇順 → `resultingCombination` の強さ 昇順 → `cardIds` を結合した文字列の辞書順。
- PASS の合法性は `resolvePlay(state, { kind:"PASS", playerId })` のドライランで判定する（`ok` なら採用）。

### 4.4 `cpuPolicy.ts` / `cpuPolicyStandard.ts`

```ts
export type CpuPolicyId = "STANDARD";                 // 将来ユニオン拡張（"AGGRESSIVE" 等）
export const CPU_POLICY_IDS: readonly CpuPolicyId[];   // UI セレクタ用の一覧。順序は表示順

export type CpuDecisionInput = {
  state: RoundState;
  legalPlays: LegalPlay[];   // enumerateLegalPlays の結果。呼び出し側が渡す
  rng: Rng;                  // この手番専用のストリーム
};
export type CpuPolicy = (input: CpuDecisionInput) => PlayInput;

export function resolveCpuPolicy(id: CpuPolicyId): CpuPolicy;   // 未知 id は Error
export function rollThinkDelayMillis(rng: Rng): number;         // [600, 1200] の整数（CPU-007 / TBD-009）

export const standardPolicy: CpuPolicy;   // cpuPolicyStandard.ts
```

**`standardPolicy` の決定手順**（`legalPlays` は空でない前提。空なら `roundLoop` が先に停止する）：

1. `goesOut === true` の手が1つ以上あれば → その集合で `resultingCombination` の強さが最小の手。同値が複数なら `rng.nextInt` で1つ。
2. 場が空（`state.activeField === null`、= 全 `legalPlays` が `actionKind: "LEAD"`）→ `actionKind: "LEAD"` かつ `cardIds.length === 1` の手のうち、カードの強さ（`rankStrength(rank, state.dayNight)`）が最小のもの。同値（複数属性）は `rng.nextInt` で1つ。
3. 場がある → `PASS` 以外の手のうち `resultingCombination` の強さが最小のもの。同値は `rng.nextInt`。`PASS` 以外が無ければ `PASS`。

- 「同値は `rng` で選ぶ」際は、候補を決定的順序（4.3）でソート済みの配列に対して `rng.nextInt(candidates.length)` を引く。これにより seed から完全再現できる（§確定前提「結果を再現可能な形で記録」）。
- `standardPolicy` はスキルを一切使わない（返す `PlayInput` に `useSkill` を含めない）。
- `CPU_POLICY_IDS` と `resolveCpuPolicy` は「`CPU_POLICY_IDS` の全 id が `resolveCpuPolicy` で解決できる」ことをテストで保証する。

**`rollThinkDelayMillis`**：`600 + rng.nextInt(601)`。game-core は待たない。UI（サブプロジェクト2）が `TurnRecord.thinkMillis` を読んで `sleep` する。

### 4.5 `roundLoop.ts`

```ts
export type PlayRoundInput = {
  playerIds: readonly string[];
  seed: number;
  seatPolicies: Record<string, CpuPolicyId>;   // すべての席に対応する id
  rematchIndex?: number;                        // 既定 0
  baselineFirstPlayerId?: string;
  maxTurns?: number;                            // 既定 1000
};

export type TurnRecord = {
  index: number;                     // 0-based
  playerId: string;
  policyId: CpuPolicyId;
  legalPlayCount: number;
  input: PlayInput;
  actionKind: PlayActionKind | "PASS";
  fieldCleared: boolean;
  naturalRevolution: boolean;
  dayNightAfter: DayNight;
  handCountsAfter: Record<string, number>;   // playerId -> 数字手札枚数
  thinkMillis: number;
};

export type RoundStopReason = "WINNER" | "MAX_TURNS" | "NO_PROGRESS";

export type RoundResult = {
  seed: number;
  rematchIndex: number;
  config: { playerIds: string[]; seatPolicies: Record<string, CpuPolicyId> };
  deal: DealResult;
  turns: TurnRecord[];
  winnerId: string | null;
  finalState: RoundState;
  stopReason: RoundStopReason;
};

export function playRound(input: PlayRoundInput): RoundResult;
```

**手順**：
1. `rng = createRng(seed)`。
2. `deal = dealRound({ playerIds, rng: rng.fork(), rematchIndex, baselineFirstPlayerId })`。
3. `state = createRoundState({ rulesetCode:"INITIAL", rulesetVersion: INITIAL_RULESET_VERSION, dayNight: deal.dayNight, players: deal.players, activePlayerId: deal.firstPlayerId })`。
4. `seatPolicies` に全 `playerIds` の対応があるか検証。無ければ throw。
5. ループ：`state.winnerId === null` かつ `turns.length < maxTurns` の間、
   1. `active = state.activePlayerId`、`policyId = seatPolicies[active]`。
   2. `turnRng = rng.fork()`（手番 index ごとに独立）。
   3. `legalPlays = enumerateLegalPlays(state)`。空なら `stopReason = "NO_PROGRESS"` で break。
   4. `input = resolveCpuPolicy(policyId)({ state, legalPlays, rng: turnRng })`。
   5. `thinkMillis = rollThinkDelayMillis(turnRng)`。
   6. `res = resolvePlay(state, input)`。`res.ok === false` → `Error`（メッセージに `turnIndex`・`input`・`res.reason`）。
   7. `state = res.state`。`TurnRecord` を push。
   8. **不変条件検査**（§5）。破れたら `Error`。
6. `stopReason`：`state.winnerId` があれば `"WINNER"`、そうでなく `turns.length >= maxTurns` なら `"MAX_TURNS"`（`"NO_PROGRESS"` は 5.iii で設定済み）。
7. `RoundResult` を返す。

- ループは `rng.fork()` を「配布に1回 + 手番ごとに1回」の順で消費する。手番数が増えても配布ストリームは不動。

## 5. 不変条件

`playRound` が各手番の `resolvePlay` 適用後に検査する（破れたら `Error`）。M2-QA-01 の「不正手・停止・カード消失0件」を直接支える。

1. **カード保存則**：`Σ players[].hand.length + discardPile.length + (activeField ? activeField.combination.cards.length : 0) === 36`。M2 はスキル変化（変化Joker）が無いため厳密に 36。M3 で変化Joker導入時に再検討。
2. **cardId 一意**：全 `players[].hand` の `cardId` を集めて重複が無い。
3. **手番健全性**：`state.activePlayerId` が `playerIds` に含まれる。

## 6. エラー一覧

| 関数 | 条件 | 型 |
|---|---|---|
| `createRng` | seed が非有限 | `RangeError` |
| `Rng.nextInt` | `bound <= 0` または非整数 | `RangeError` |
| `dealRound` | `playerIds` の長さが 2〜6 外／重複あり | `RangeError` |
| `dealRound` | `rematchIndex >= 1` かつ `baselineFirstPlayerId` 未指定／`playerIds` に無い | `RangeError` |
| `resolveCpuPolicy` | 未知の `CpuPolicyId` | `Error` |
| `playRound` | `seatPolicies` に手番席の id が無い | `Error` |
| `playRound` | policy が非合法手を返した（`resolvePlay` が `ok:false`） | `Error`（`turnIndex` / `input` / `reason` 付き） |
| `playRound` | 不変条件違反 | `Error`（違反内容 / `turnIndex` 付き） |

`NO_PROGRESS` / `MAX_TURNS` は例外ではなく `stopReason` として返す（QA が検査する異常系）。

## 7. 将来の拡張（M4: CPU引継ぎ）

本設計は M4 の「棄権席を CPU が引き継ぐ」（FORFEIT-101/102、MODE-FRIEND-006）に無改造で載る継ぎ目を持つ：

- `CpuPolicy` は席に依存しないステートレスな毎手関数（`state.activePlayerId` の席について現在の `RoundState` だけで決定）。引継ぎ前の履歴を必要としない（§CPU-003）。
- `seatPolicies` がそのまま継ぎ目：ある席の制御が human → `CpuPolicyId` に切り替わるだけ。参照するレジストリ（`cpuPolicy.ts`）は共通。
- `enumerateLegalPlays` / `resolveCpuPolicy` / 各ポリシー実装は M4 のオンライン対局ループからも再利用。`playRound` は M4 のループそのものではない（M4 は Realtime・再接続・締切管理を含む独自ループ）。
- `Rng.fork()` により、引継ぎ発生時に `(gameSeed, seatIndex, takeoverTurn)` 由来の席専用ストリームを fork でき、引継ぎ後も再現可能。

M2 では棄権検出・席状態遷移・敗北記録・引継ぎ設定UIは実装しない。

## 8. テスト方針

`packages/game-core/src/*.test.ts`（`node:test`、`npm run game-core:test`）。既存 114 件に回帰を出さない。

| ファイル | 主なケース |
|---|---|
| `rng.test.ts` | 同 seed → 同数列／`fork` の親子・兄弟独立／`shuffle` は多重集合不変・入力非破壊／`nextInt` の範囲と剰余バイアス無し／seed の uint32 丸め |
| `deal.test.ts` | 人数別枚数(2/3/4/5/6)／5人8枚席がちょうど1つ／配布後カードID集合が NUMBER_DECK と一致・重複なし／各席スキル1枚・物理重複なし・余剰は対局外／初局先攻(5人=8枚席、5人以外=乱数)／再戦ローテーション（先攻・8枚席が時計回りに1つ進む）／`dayNight === "DAY"`／手札ソート／`playerIds` 異常で `RangeError`／同 seed 再現 |
| `legalMoves.test.ts` | 空場：単体/同数/連番のリード列挙／応答：同数セット・連番の合法更新のみ／枚数ロック・属性固定/統一ロック・追加封印での除外／PASS の有無（場あり/なし）／`goesOut` フラグ／決定的順序／全 `LegalPlay` が `resolvePlay` で `ok`（齟齬なし）／`winnerId` 非nullで空配列 |
| `cpuPolicy.test.ts` | 最弱単体リード／同値属性の rng タイブレークが seed で再現／上がり手を最優先／PASS 以外が無ければ PASS／スキルを返さない／`CPU_POLICY_IDS` 全 id を `resolveCpuPolicy` が解決／未知 id で Error／`rollThinkDelayMillis` が [600,1200] 整数・seed 再現 |
| `roundLoop.test.ts` | 2〜6人すべてで `stopReason === "WINNER"` に到達／`winnerId` が該当席の手札0／カード保存則が全手番で成立／`TurnRecord` の形と `handCountsAfter` の整合／同 seed で `RoundResult` 完全一致／`maxTurns` 到達で `"MAX_TURNS"`／`seatPolicies` 欠落で Error／`rematchIndex` を変えると先攻が回る |
| `cpuSelfPlay.test.ts` | 固定 seed 群（例：1..30）で `playRound` を回し、全局 `stopReason === "WINNER"`・不正手 throw なし・カード保存則違反なし。失敗時は seed をエラーに出す。M2-QA-01 レポートはこのハーネスを 100 seed で回した結果を記録する |

## 9. 完了条件（対象 TODO へのマッピング）

| TODO | 完了条件（TODO文書） | 本設計での充足 |
|---|---|---|
| M2-EX-01 | 人数別枚数と5人時の8枚席が正しい | `dealRound` + `deal.test.ts` |
| M2-EX-02 | 現在状態から全合法手を取得できる | `enumerateLegalPlays` + `legalMoves.test.ts` |
| M2-EX-03 | カード提出・パス・（基本スキルの席は M3）を選べる | `standardPolicy` + `cpuPolicy.test.ts`。スキルは M3-EX-03 |
| M2-EX-07（エンジン部） | 配布から勝者まで停止せず進む | `playRound` + `roundLoop.test.ts` |
| M2-QA-01（土台） | 不正手・停止・カード消失が0件 | 不変条件 + `cpuSelfPlay.test.ts` |

## 10. 確認手順

- `npm run game-core:test`（新規テスト全通過、既存回帰なし）
- `npm run game-core:typecheck`（`src/index.ts` 経由の新規 re-export が型検査を通る）
- テストファイルの型健全性を手動監査（typecheck 対象外のため）
- `git diff --check`
- 進捗記録：`docs/progress/M2-EX-01.md` 〜 `M2-EX-03.md`、`M2-EX-07.md`（エンジン部）、`M2-QA-01.md`（土台）
