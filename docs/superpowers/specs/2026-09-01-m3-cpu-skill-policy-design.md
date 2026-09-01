# M3 サブプロジェクト1：CPUのスキル判断 設計書

- 文書ID：GAME-SPEC-M3-SP1
- 版数：0.1
- 作成日：2026-09-01
- 基準文書：`独自カードゲーム_要件定義書_v0.2.md`（v0.4 本文、§6.2 / §11 / §12 / §20）、`独自カードゲーム_M3_詳細TODO_v0.2.md`
- 対象 TODO：M3-EX-03（CPUが全スキルを合法に使用）／ M3-QA-01（CPU同士1000局自動対戦）
- 実装場所：`packages/game-core/`、一部 `apps/mobile/src/state/cpuGameStore.ts` と `apps/mobile/metro.config.js`

---

## 1. 目的とスコープ

判定エンジン（`resolvePlay` と `evaluateJokerTransformPlay` / `evaluateJokerClear` / `evaluateGoOut`）は M1 で完成済み。本サブプロジェクトは **CPU がスキル手も候補に入れて選べるようにする層** だけを足す：

1. `enumerateLegalPlays` にスキル手の列挙を追加（オプトイン）。
2. `standardPolicy` に最小限のスキル使用ヒューリスティックを追加。
3. ヘッドレス対局ループ（`playRound`）と UI 手番ドライバ（`turnDriver.cpuStep`）を「CPU 席はスキルも候補」にする。
4. CPU 同士 1000 局の自動対戦（M3-QA-01）で停止・不正手・不変条件違反 0 を確認。

あわせて M2 サブプロジェクト1 の申し送りを回収する：

- **`index.ts` → `core.ts` 分割**：循環 import 制約と `metro.config.js` の game-core シムを除去。
- **カード保存則の修正**：`roundLoop.ts` と `cpuGameStore.ts` の「全カード = 36」を実カードのみで数える（変化Joker由来カードは 36 に含まれない）。

### スコープ外

| 項目 | 行き先 |
|---|---|
| 人間のスキル使用UI（Joker宣言画面、封印・革命トグル） | M3-EX-01 / M3-EX-02（M3 サブプロジェクト3） |
| 不正理由の詳細支援表示 | M3-EX-07 |
| CPU の複数タイプ・難易度設定 | 将来版（v1.0 は標準1種類）。レジストリの継ぎ目は M2 で用意済み |
| スキルヒューリスティックの高度化（最適プレイ） | QA-01 の結果を見て後続で調整。M3 は「全スキルを合法に発動できる」が完了条件 |
| `@card-game-app/ui` の `.js` バレル問題 | 別件（`packages/ui/src/index.ts`）。metro の ui シムは残置 |

## 2. Global Constraints

- `packages/game-core` は依存を追加しない（zero-dep、`node:test` + `tsx`）。
- game-core は純粋・同期・決定的。乱数は注入された `Rng` 経由。1局は seed から byte 単位で再現できる（`enumerateLegalPlays` にスキル手が増えても、`resolvePlay` ドライランは状態を変えず、CPU の rng 消費順序は変わらない）。
- `resolvePlay` を含む既存公開 API のシグネチャは変更しない。`enumerateLegalPlays` は**第2引数の追加のみ**（省略時は現行と完全に同一の結果）。
- 判定ロジックを列挙器・ポリシーに複製しない（`resolvePlay` が唯一の正。スキル手も `resolvePlay` ドライランで合法性を確定する）。
- `TurnLogEntry` / トレースに非公開手札・cardId を出さない（既存どおり枚数と `useSkill` の種別のみ）。
- **import 指定子**：`core.ts` 分割後、`packages/game-core/src/` 内は `.ts` 拡張子で統一（`tsconfig` に `allowImportingTsExtensions: true`。`tsc --noEmit` / `tsx` / Metro すべて `.ts` を解決できることを probe 済み）。
- `apps/mobile` の既存テスト（180件）と game-core の既存テスト（184件）に回帰を出さない。
- コミットは `main` 直、`[TODO-ID]` 付き、明示パスのみ `git add`。

## 3. `core.ts` 分割（Part A）

### 3.1 手順

1. `git mv packages/game-core/src/index.ts packages/game-core/src/core.ts`。
2. 新 `packages/game-core/src/index.ts` を作成：
   ```ts
   export * from "./core.ts";
   export * from "./rng.ts";
   export * from "./deal.ts";
   export * from "./legalMoves.ts";
   export * from "./cpuPolicy.ts";
   export * from "./cpuPolicyStandard.ts";
   export * from "./roundLoop.ts";
   ```
3. `packages/game-core/tsconfig.json` の `compilerOptions` に `"allowImportingTsExtensions": true` を追加。
4. `core.ts` 末尾から旧「M2 re-export」ブロック（`export * from "./rng.js"` 等）を削除。
5. M2 の6ソースファイル（`rng.ts` は engine 参照なし）の import を修正：
   - `from "./index.js"` → `from "./core.ts"`（engine シンボルは `core.ts` にある）。
   - `from "./rng.js"` → `from "./rng.ts"`、`from "./legalMoves.js"` → `.ts` など、兄弟モジュール参照も `.ts` へ。
   - これで `index.ts`（バレル）→ `core.ts` + M2ファイル、M2ファイル → `core.ts` + 兄弟、の一方向 DAG になり **循環 import なし**。TDZ 制約は消滅。
6. `deal.ts` の `numberDeck()` / `skillDeck()` は関数のまま（`const` へ戻す必要はない。害もない）。
7. `apps/mobile/metro.config.js` から game-core `.js`-strip シム（`gameCoreSrc` を使う分岐）を削除。`@card-game-app/ui` の `uiTokensEntry` 分岐は残す。
8. テストファイル（`packages/game-core/src/*.test.ts`）は `from "./index.ts"` のまま（バレルが全再エクスポート）。変更不要。

### 3.2 確認

- `npm run game-core:test`（184件、回帰なし）
- `npm run game-core:typecheck`
- `npm run mobile:typecheck` / `npm run mobile:test`（180件）
- `cd apps/mobile && npx expo export --platform android`（metro シム削除後もバンドル成立）

## 4. カード保存則の修正（Part B）

`createTransformedJokerCard(skillId, rank, suit)` は `cardId = "JOKER_AS_" + skillId`、`transformedFromSkillId` 付きの `NumberCard` を作る。これは数字デッキ36枚に含まれない。

### 4.1 `roundLoop.ts` `assertInvariants`

- 実カード判定 `const isReal = (c: NumberCard) => c.transformedFromSkillId === undefined;` を導入。
- カード保存則：`Σ real(hand) + real(discardPile) + real(activeField.combination.cards) === 36`。
- cardId 一意：実カードの cardId 集合のみで重複チェック（変化Joker は `JOKER_AS_<skillId>` で衝突しないが、実カード側だけを見る）。

### 4.2 `apps/mobile/src/state/cpuGameStore.ts`

- 同じ `isReal` フィルタを `assertCardConservation` へ適用。M3-EX-03 で CPU がスキルを使い始めると、この store 経由の対局（M2 の CPU戦画面）でも変化Joker が場に出るため。
- `apps/mobile` 側のテスト（`cpuGameStore.test.ts`）に「CPU がスキルを使う対局でも保存則が成立する」ケースを追加（`STANDARD` ポリシーがスキルを使う seed を選ぶ）。

## 5. `enumerateLegalPlays` のスキル手列挙（Part C / D）

```ts
export function enumerateLegalPlays(
  state: RoundState,
  options?: { includeSkills?: boolean },
): LegalPlay[];
```

- `options` 省略 or `includeSkills !== true` → **現行と完全に同一**（数字手 + PASS のみ）。
- `includeSkills === true` かつ `state.winnerId == null` かつ 手番プレイヤーが `skill != null && !skill.used` のとき、下記のスキル手を追加で列挙。

`LegalPlay.input` は `PlayInput` union（`useSkill` / `jokerDeclarations` を含められる）。すべて `resolvePlay(state, input)` ドライランで検証し、`ok` のもののみ採用。`actionKind` / `resultingCombination`（`res.state.activeField?.combination`）/ `goesOut`（採用手適用後の手番プレイヤーの実カード手札が 0）を写す。

### 5.1 スキル種別の判定

`player.skill.effectCode`：
- `SKILL_JOKER_HERO` / `SKILL_JOKER_SAINT` → Joker（JOKER_CLEAR + JOKER_TRANSFORM）
- `SKILL_EXTENSION_SEAL` → EXTENSION_SEAL
- `SKILL_REVOLUTION` → REVOLUTION

### 5.2 JOKER_CLEAR

- `state.activeField != null` のときのみ。
- 「場を流した後に手番プレイヤーが作るリード」を候補にする：既存の候補生成（単体 / 同数2〜4 / 連番3〜9）を手番プレイヤーの数字手札に適用し、各 `cardIds` について `resolvePlay(state, { kind:"PLAY", playerId, cardIds, useSkill:"JOKER_CLEAR" })` をドライラン。
- `resolveCardPlay` は JOKER_CLEAR を「場を流す → `cardIds` を新リードとして評価」で処理する（実装済み）。

### 5.3 JOKER_TRANSFORM

- 宣言 `{ skillId: player.skill.skillId, rankCode, suitCode }` を 9 rank × 4 suit の 36 通り。
- 各宣言について、手番プレイヤーの数字手札から選ぶ部分集合（0 枚以上）と合わせて組み合わせを作り、`resolvePlay(state, { kind:"PLAY", playerId, cardIds:<部分集合>, useSkill:"JOKER_TRANSFORM", jokerDeclarations:[宣言] })` をドライラン。
- 部分集合の候補は「宣言カード + 部分集合」が単体 / 同数 / 連番のいずれかになり得るものに限定：
  - 単体（部分集合 0 枚、宣言のみ）
  - 同数セット：宣言 rank と同じ数字を手札が持つとき、その 1〜3 枚 + 宣言
  - 連番セット：宣言 rank を含む連続窓（長さ 3〜9）から宣言以外の rank を手札の 1 枚ずつ
- 組み合わせ爆発ガード：1手番で生成する JOKER_TRANSFORM 候補の上限を定数（例 `JOKER_TRANSFORM_CANDIDATE_CAP = 2000`）でガードし、超過分はスキップ。M3 の手札上限（18枚）でも通常到達しない。
- 変化Joker上がり（`jokerDeclarations.length > 0` かつ手札が 0 になる）は `evaluateGoOut` / `resolvePlay` が `TRANSFORM_JOKER_GO_OUT` で弾く → 列挙結果から自動除外。

### 5.4 EXTENSION_SEAL

- 既存の数字手の列挙結果（`includeSkills` なしで得られる `LegalPlay[]` のうち `kind:"PLAY"` のもの）それぞれについて、`{ ...input, useSkill:"EXTENSION_SEAL" }` をドライラン。
- 封印は事後効果なのでこの手自体の合法性は変わらない（数字手が合法なら封印併用も合法）。ドライランは念のための確認。

### 5.5 REVOLUTION

- 革命は昼夜を先に反転してから数字カードを判定する（`usesRevolutionSkill` 経由）。
- 手番プレイヤーの数字手札から候補 `cardIds`（単体 / 同数 / 連番）を生成し、各について `resolvePlay(state, { kind:"PLAY", playerId, cardIds, useSkill:"REVOLUTION" })` をドライラン。反転後に合法なもののみ採用。

### 5.6 決定的順序

既存のソートキー `[isPass, 枚数, 結果の強さ, cardIds辞書順]` に、`枚数` の直後へスキル次元を挿入する：`[isPass, 枚数, useSkill有無（無し=0 先）, useSkill名, jokerDeclaration の rank・suit, 結果の強さ, cardIds辞書順]`。

- **数字手（`useSkill` 無し）どうしの相対順序は不変**（スキル次元は定数 `0 / "" / 0` になり、`cardIds` が一意タイブレークなので並びは従来と完全に一致）。→ `enumerateLegalPlays(state)` / `(state, {})` の出力は現行と byte 一致。
- スキル手は同じ枚数の数字手の**後ろ**に来る（`useSkill有無` が枚数の次）。
- 注：宣言のみ（手札0枚）の JOKER_TRANSFORM 単体は `枚数 = input.cardIds.length = 0` なので、1枚の数字単体より前に並ぶ。ポリシーは `useSkill === undefined` で数字手を絞るので実害なし。決定的で安定であればよい。

## 6. `standardPolicy` のスキルヒューリスティック（Part D）

決定的。QA-01 で全 4 スキルが発動することを確認してから調整する前提の最小版。

`legalPlays` は `enumerateLegalPlays(state, { includeSkills: true })` の結果（呼び出し側が渡す）。判定順：

1. **上がれる手**：`legalPlays.filter(p => p.goesOut)`（変化Joker上がりは既に除外済み）。空でなければ結果の強さが最小のもの、同値は `rng`。
2. **場が空**（`state.activeField === null`）：`actionKind === "LEAD"` かつ `input.kind === "PLAY"` かつ `cardIds.length === 1` かつ `useSkill === undefined` の手（=最弱の単体数字）。同値は `rng`。（空場でのスキルリードは最小版では行わない。）
3. **場がある**：
   - `numberResponses = legalPlays.filter(p => p.actionKind !== "PASS" && p.input.kind === "PLAY" && p.input.useSkill === undefined)`
   - `numberResponses` が空でない：
     - `best = 最弱の numberResponse`
     - `jokerDump = legalPlays.filter(p => p.input.useSkill === "JOKER_TRANSFORM" && !p.goesOut)` のうち、手札から出す枚数 `p.input.cardIds.length`（変化Joker はスキル枠由来なので手札枚数に数えない）が `best.input.cardIds.length` より**厳密に多い**もの。空でなければ最弱の `jokerDump` を選ぶ（Joker が数字だけでは作れない組み合わせを完成させ、より多く手札を減らせる場合）。
     - そうでなければ `best`。さらに `best` の `actionKind` が `EXTEND` / `REPLACE` かつ手番プレイヤーの `skill.effectCode === "SKILL_EXTENSION_SEAL"` かつ `{ ...best.input, useSkill:"EXTENSION_SEAL" }` が `legalPlays` に存在するなら、その封印併用版を選ぶ。
   - `numberResponses` が空（本来パス）でスキル保有：
     - Joker：`legalPlays.filter(p => p.input.useSkill === "JOKER_CLEAR")` の最弱を選ぶ（場流し + 最弱リード）。
     - 革命：`legalPlays.filter(p => p.input.useSkill === "REVOLUTION" && p.actionKind !== "PASS")` の最弱を選ぶ。
     - どちらも無ければ PASS。
4. **それ以外** → `{ kind:"PASS", playerId: state.activePlayerId }`。

- タイブレークは既存の `pickWeakest`（決定的順序済み配列に `rng.nextInt`）を流用。
- `standardPolicy` は `state.players[active].skill` を読んで種別を判定してよい（自分のスキルは公開情報扱いで問題ない — §VIS は相手の非公開スキルの話）。

## 7. 配線（Part E）

- `roundLoop.ts` `playRound`：`enumerateLegalPlays(state)` → `enumerateLegalPlays(state, { includeSkills: true })`。
- `apps/mobile/src/features/cpu-game/turnDriver.ts` `cpuStep`：`enumerateLegalPlays(state.round)` → `enumerateLegalPlays(state.round, { includeSkills: true })`。人間手番の `legalPlaysForHuman` は `includeSkills` を渡さない（人間のスキルUIは M3-EX-01/02）。
- `TurnRecord` / `TurnLogEntry` は `useSkill` を既に記録している（M2で実装済み）。

## 8. M3-QA-01：CPU 同士 1000 局自動対戦

- `packages/game-core/src/cpuSelfPlay.test.ts` を拡張：
  - 既存の `RUN_FULL` トグルを使い、フル実行を各人数 200 seed（計 1000 局）へ。コミットするテストは軽量（各人数 20 seed）のまま、`RUN_FULL=1` で 1000 局。
  - すべての局で `stopReason === "WINNER"`、`playRound` が throw しない（不正手・不変条件違反は throw）。
  - **スキル発動の網羅**：軽量テストの範囲で、トレース（`turns[].input.useSkill`）に `JOKER_CLEAR` / `JOKER_TRANSFORM` / `EXTENSION_SEAL` / `REVOLUTION` の 4 種すべてが少なくとも1回出現することを assert（出現しなければヒューリスティックか列挙のバグ）。
  - 変化Joker上がりが1件も無いこと（`turns` の最終手が `useSkill === "JOKER_TRANSFORM"` かつ勝者、というケースが 0）。
- レポート `docs/qa/M3-QA-01-cpu-skill-self-play-report.md`（`docs/qa/M2-QA-01-*` 書式）：実行コマンド、人数×seed、全局 WINNER 到達、不正手 throw 0、不変条件違反 0、4スキル発動回数、変化Joker上がり 0、回帰登録、残課題（実機での全スキル境界確認は M3-QA-02）。

## 9. テスト方針

`packages/game-core/src/*.test.ts`（`npm run game-core:test`）。

| ファイル | 追加ケース |
|---|---|
| `barrelExports.test.ts`（新規） | `core.ts` 分割後、代表的な公開シンボル（`resolvePlay` / `evaluateNumberPlay` / `createRoundState` / `dealRound` / `enumerateLegalPlays` / `resolveCpuPolicy` / `playRound` / 型は import 時エラーが出ないこと）が `./index.ts` から解決できる |
| `roundLoop.test.ts` | 変化Joker が場に出た局でカード保存則が成立（実カード36）／既存の全人数完走に回帰なし |
| `legalMoves.test.ts` | `enumerateLegalPlays(state)` は現行と同一（スナップショット的比較）／`{ includeSkills: true }` で Joker席は JOKER_CLEAR / JOKER_TRANSFORM が出る／封印席は各数字手に併用版が出る／革命席は反転後合法な手が出る／すべて `resolvePlay` で `ok`／変化Joker上がりは列挙されない／決定的順序 |
| `cpuPolicy.test.ts`（standard） | Joker席が「本来パス」局面で JOKER_CLEAR を選ぶ／封印席が REPLACE 時に封印併用を選ぶ／革命席が反転で応答できるとき革命を選ぶ／JOKER_TRANSFORM で手札を多く減らせるとき使う／スキルが無ければ M2 と同じ挙動／同 seed 再現 |
| `cpuSelfPlay.test.ts` | 上記 §8 |
| `apps/mobile/.../cpuGameStore.test.ts` | CPU がスキルを使う seed で全人数完走・保存則成立 |

## 10. 確認手順

- `npm run game-core:test` / `npm run game-core:typecheck`
- `npm run mobile:test` / `npm run mobile:typecheck` / `mobile:lint` / `mobile:format:check`
- `cd apps/mobile && npx expo export --platform android`（metro シム削除後）
- `git diff --check`
- 進捗記録：`docs/progress/M3-EX-03.md`、`docs/progress/M3-QA-01.md`

## 11. 将来への申し送り

- **ヒューリスティック調整**：QA-01 の 1000 局結果（スキル発動頻度、勝率、手番数分布）を見て、`standardPolicy` のスキル発動条件を調整。特に革命の使いどころ（現状は「数字応答が無いとき」だけ）と封印の使いどころ（現状は「REPLACE のとき常に」）。
- **CPU 複数タイプ**：`AGGRESSIVE` 等を追加するなら `cpuPolicy*.ts` に新ファイル + レジストリ1行。列挙器（`enumerateLegalPlays`）は共通。
- **M3-SB-04（公開対局イベント）**：`TurnLogEntry` / `TurnRecord` の形（`useSkill` 含む、cardId 無し）がイベント保存形式の入力になる。イベントに「使用カード」を含めるなら、公開情報（場に出たカード）だけを別途持つ設計が要る。
- **`allowImportingTsExtensions`**：`packages/ui` も同様にして metro の ui シムを消せる（別 TODO）。
