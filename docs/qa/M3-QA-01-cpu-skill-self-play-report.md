# M3-QA-01 CPU同士スキル入り自動対戦レポート

- TODO: M3-QA-01
- 日付: 2026-09-01
- 対象: `packages/game-core/src/cpuSelfPlay.test.ts`（CPU 同士スキル入り自動対戦ハーネス）
- 実行環境: Node.js v22 + `tsx --test`
- 前提: サブプロジェクト1 Task 1〜5 完了（`enumerateLegalPlays(state, { includeSkills: true })` がスキル手を返し、`standardPolicy` がそれを選ぶ）

本レポートは §7 の配線（`playRound` と `turnDriver.cpuStep` を `{ includeSkills: true }` へ切替）後、CPU 同士対戦でスキル手が合法・安全・網羅的に発動することを確認したもの。

## 配線変更（§7）

| 箇所 | 変更 |
|---|---|
| `packages/game-core/src/roundLoop.ts` `playRound` | `enumerateLegalPlays(state)` → `enumerateLegalPlays(state, { includeSkills: true })`（唯一の変更） |
| `apps/mobile/src/features/cpu-game/turnDriver.ts` `cpuStep` | `enumerateLegalPlays(state.round)` → `enumerateLegalPlays(state.round, { includeSkills: true })` |
| `apps/mobile/.../turnDriver.ts` `legalPlaysForHuman` | 変更なし（人間のスキル UI は M3-EX-01/02） |

決定性への影響なし：列挙器のスキル手ドライラン（`resolvePlay`）は状態を変えず、CPU の手番 rng 消費順序（配布 1 回 + 手番ごと `fork()` 1 回）は不変。`self-play results are deterministic (byte-match on replay)` が引き続き PASS。

## 自動確認（2026-09-01 時点）

| コマンド | 結果 |
|---|---|
| `npm run game-core:test` | PASS（203 件 / 新規 1 件：`all 4 skill types fire across the lightweight sweep`）|
| `npm run game-core:typecheck` | PASS |
| `npm run mobile:test` | PASS（181 件 / 新規 1 件：`M3-QA-01: CPU skill usage keeps card conservation`）|
| `npm run mobile:typecheck` / `mobile:lint` / `mobile:format:check` | PASS |
| `cd apps/mobile && npx expo export --platform android` | PASS（バンドル成立）|
| `git diff --check` | PASS |

`apps/mobile/src/features/cpu-game/resultModel.test.ts` の 1 行を修正：`playToEnd(3, 0)`（旧「人間勝ち」seed）は `includeSkills` 切替で CPU 勝ちに変わったため、3 人・人間勝ちの seed を `6` に差し替え（テストデータのみ、ロジック変更なし）。

## 実行コマンド

| 用途 | コマンド | 局数 |
|---|---|---|
| コミットする軽量テスト | `npm run game-core:test` | 各人数 20 seed × 5 人数 = **100 局** |
| フル検証 | `RUN_FULL=1 npm run game-core:test`（または該当ファイルのみ） | 各人数 200 seed × 5 人数 = **1000 局** |

## 測定した実行時間

| 実行 | ハーネス `duration_ms` | wall-clock（`tsx --test` 単体ファイル） |
|---|---|---|
| 軽量（100 局） | 約 2.8 s | 約 4.0 s |
| `RUN_FULL=1`（1000 局） | 約 21.3 s | 約 22.5 s |

Task 3 レビューの性能懸念（最悪ケースで `enumerateLegalPlays({includeSkills:true})` 1 回あたり ~2500–3000 `resolvePlay` ドライラン）に対し、**1000 局フル実行で ~21 s**。2 分閾値に対して十分な余裕があり、`JOKER_TRANSFORM_CANDIDATE_CAP`（2000）やサブセット生成の縮小は不要。軽量テストも 15 s 閾値に対し ~4 s で問題なし。

## テスト構成（軽量）

| 人数 | seed 数 | 試行数 | 結果 | 手番数 (min–max–mean) |
|---|---|---|---|---|
| 2 players | 20 | 20 | PASS（20/20 WINNER）| 21–40–30.6 |
| 3 players | 20 | 20 | PASS（20/20 WINNER）| 24–44–35.8 |
| 4 players | 20 | 20 | PASS（20/20 WINNER）| 24–51–40.2 |
| 5 players | 20 | 20 | PASS（20/20 WINNER）| 19–48–34.5 |
| 6 players | 20 | 20 | PASS（20/20 WINNER）| 12–58–33.8 |
| **合計** | - | **100** | **PASS（100/100）** | - |

## 実行結果の検証

| 検証項目 | 期待値 | 軽量（100 局） | `RUN_FULL=1`（1000 局） |
|---|---|---|---|
| 全局 `stopReason === "WINNER"` | ✓ | **PASS** 100/100 | **PASS** 1000/1000 |
| 勝者が有効（実カード手札 0 枚） | ✓ | **PASS** | **PASS** |
| 例外スロー（違法手・不変条件違反） | 0 件 | **PASS** スロー無し | **PASS** スロー無し |
| 実カード保存則（毎手 36 枚、`assertInvariants`） | ✓ | **PASS** | **PASS** |
| 有界ループアサート（`turns.length < 500`） | ✓ | **PASS** | **PASS** |
| 変化Joker上がり（勝利手が `useSkill === "JOKER_TRANSFORM"`） | 0 件 | **PASS** 0 件 | **PASS** 0 件 |
| 決定性（同 seed バイト一致） | ✓ | **PASS** | **PASS** |

## 4 スキル発動の網羅

軽量テスト（100 局）で全 `turns[].input.useSkill` を走査し、`{ JOKER_CLEAR, JOKER_TRANSFORM, EXTENSION_SEAL, REVOLUTION }` の 4 種すべての出現を assert（新規テスト `self-play: all 4 skill types fire across the lightweight sweep`）。ターゲット seed の追加は不要だった（既定の 20 seed 範囲で全種発動）。

### 軽量（100 局）スキル発動回数

| 人数 | JOKER_CLEAR | JOKER_TRANSFORM | EXTENSION_SEAL | REVOLUTION |
|---|---:|---:|---:|---:|
| 2p | 12 | 6 | 14 | 8 |
| 3p | 19 | 3 | 18 | 16 |
| 4p | 29 | 2 | 28 | 20 |
| 5p | 31 | 4 | 33 | 27 |
| 6p | 38 | 2 | 39 | 29 |
| **合計** | **129** | **17** | **132** | **100** |

### `RUN_FULL=1`（1000 局）スキル発動回数

| 人数 | JOKER_CLEAR | JOKER_TRANSFORM | EXTENSION_SEAL | REVOLUTION |
|---|---:|---:|---:|---:|
| 2p | 108 | 29 | 137 | 96 |
| 3p | 176 | 33 | 179 | 180 |
| 4p | 267 | 14 | 259 | 222 |
| 5p | 321 | 17 | 321 | 287 |
| 6p | 387 | 7 | 381 | 317 |
| **合計** | **1259** | **100** | **1277** | **1102** |

- `JOKER_TRANSFORM` の発動は少数（1000 局で 100 回）。宣言のみでは上がれず（`TRANSFORM_JOKER_GO_OUT` で除外）、`standardPolicy` は「数字だけでは作れない組み合わせを完成させ、かつ厳密に多く手札を減らせる」ときのみ選ぶため、頻度が低いのは設計どおり。全人数で発動を確認済み。
- 変化Joker上がりは軽量・フルとも **0 件**。

## モバイル側の保存則テスト（Task 2 Step 4 の回収）

`apps/mobile/src/state/cpuGameStore.test.ts` に新規テスト `M3-QA-01: CPU skill usage keeps card conservation`：

- `makeSeed: () => 29`、2 人。`startMatch → (submitPlay / advanceCpu + commitCpuReveal) ループ → ROUND_OVER` を完走。
- STANDARD CPU が `JOKER_TRANSFORM` を宣言し、変化Joker カード（`transformedFromSkillId` 付き）が実際に場／捨札に出ることを確認。
- 毎手 `commitCpuReveal` / 人間手が走らせる store の `assertCardConservation`（実カードのみ 36 枚フィルタ、Part B）でスロー無し。テスト側でも実カード合計 36 を毎手アサート。

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | なし |
| 中 | 0 | なし |
| 低 | 0 | なし |

## 回帰登録

- `packages/game-core/src/cpuSelfPlay.test.ts`
  - `self-play: {2..6} players complete cleanly across 20 seeds` — 全局 WINNER、勝者妥当性、スロー 0、スキル発動集計、変化Joker上がり 0
  - `self-play: all 4 skill types fire across the lightweight sweep` — 4 スキル全種の出現（列挙器／ヒューリスティックのバグ検出）
  - `self-play traces stay bounded (no runaway loop)` — 既存
  - `self-play results are deterministic (byte-match on replay)` — 既存（`includeSkills` 後も byte 一致）
- `apps/mobile/src/state/cpuGameStore.test.ts`
  - `M3-QA-01: CPU skill usage keeps card conservation` — CPU がスキル（`JOKER_TRANSFORM`）を使う対局で全手番保存則成立・完走

## 残課題

- **実機での全スキル境界確認 = M3-QA-02**：本レポートはヘッドレス（`playRound`）＋ store 単体テストの範囲。実機 UI（Joker 宣言画面・封印/革命トグル）を通した全スキル境界は M3-QA-02 で確認。
- **ヒューリスティック調整**（§11 申し送り）：1000 局の発動頻度・手番数分布をもとに `standardPolicy` のスキル発動条件を後続で調整。特に革命（現状「数字応答が無いとき」のみ）・封印（現状「REPLACE 時は常に」）・`JOKER_TRANSFORM` の使いどころ。
- **人間のスキル使用 UI**：M3-EX-01 / M3-EX-02（`legalPlaysForHuman` は本タスクで変更せず）。

## 対応した設計要件

- §7 配線（`playRound` / `turnDriver.cpuStep` を `{ includeSkills: true }` へ）
- §8 M3-QA-01：1000 局自動対戦（全局 WINNER、不正手 throw 0、不変条件違反 0、4 スキル発動網羅、変化Joker上がり 0）
- §4.2 モバイル `cpuGameStore.test.ts` に「CPU がスキルを使う対局でも保存則成立」ケース追加
