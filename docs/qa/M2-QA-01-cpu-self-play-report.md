# M2-QA-01 CPU自動対戦ハーネス実機確認レポート

- TODO: M2-QA-01
- 日付: 2026-09-01
- 対象: `packages/game-core/src/cpuSelfPlay.test.ts`（CPU自動対戦テストハーネス）
- 実行環境: Node.js + `tsx --test`

本レポートはハーネス実装の土台となる **24 seed × 5 人数（計 120 局）の試行結果** を記す。100 seed 規模の完全検証はサブプロジェクト2完了後、UI 実装にあわせて行う（M2-QA-01 本実施）。

## 自動確認（2026-09-01 時点）

| コマンド | 結果 |
|---|---|
| `npm run game-core:test` | PASS（179件 / 新規 7件）|
| `npm run game-core:typecheck` | PASS |

## テスト構成

| 人数 | seed 数 | 試行数 | 結果 |
|---|---|---|---|
| 2 players | 24 | 24 | PASS（24/24 WINNER 到達） |
| 3 players | 24 | 24 | PASS（24/24 WINNER 到達） |
| 4 players | 24 | 24 | PASS（24/24 WINNER 到達） |
| 5 players | 24 | 24 | PASS（24/24 WINNER 到達） |
| 6 players | 24 | 24 | PASS（24/24 WINNER 到達） |
| **合計** | - | **120** | **PASS（120/120）** |

## 実行結果の検証

各試行について、下記を検証した:

| 検証項目 | 期待値 | 結果 |
|---|---|---|
| 全局が `stopReason: "WINNER"` | ✓ | **PASS** — 120/120 |
| 勝者が有効な手札を持つ（0枚） | ✓ | **PASS** — 勝者の手札は全て空 |
| 例外スロー（違法手・カード消失） | 0 件 | **PASS** — スロー発生なし |
| 有界ループアサート（`turns.length < 500`） | ✓ | **PASS** — 6人 10 seed すべてクリア |

### 実測: 手番数の分布

ハーネスが実行時に計測する手番数統計（`npm run game-core:test` 出力の `[self-play]` ログより）:

| 人数 | 手番数 (min–max–mean) |
|---|---|
| 2 players | 25–44–31.8 |
| 3 players | 25–45–37.8 |
| 4 players | 23–55–40.2 |
| 5 players | 24–57–41.5 |
| 6 players | 23–66–41.8 |

全試行が有界ループアサート（`< 500`）をクリア。`playRound`（Task 5）内部で実装されるカード保存則・合法性検査・上限 1000 手番も同時に保証される。

## 決定性検証

新規テスト `self-play results are deterministic (byte-match on replay)` により、複数の `(playerIds, seed)` 組について `playRound` を 2 回ずつ呼び出し、戻り値 `RoundResult` が `assert.deepEqual` で **完全一致** することを確認。決定的エンジン動作が保証される。

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | なし |
| 中 | 0 | なし |
| 低 | 0 | なし |

## 回帰登録

- `packages/game-core/src/cpuSelfPlay.test.ts` — 2～6 人規模の CPU 自動対戦が決定的に WINNER へ到達、勝者の妥当性、スロー 0、有界ループ検証。
  - `self-play: 2 players complete cleanly across 24 seeds` — 統計出力、WINNER 到達・勝者妥当性検証
  - `self-play: 3 players complete cleanly across 24 seeds` — 統計出力、WINNER 到達・勝者妥当性検証
  - `self-play: 4 players complete cleanly across 24 seeds` — 統計出力、WINNER 到達・勝者妥当性検証
  - `self-play: 5 players complete cleanly across 24 seeds` — 統計出力、WINNER 到達・勝者妥当性検証
  - `self-play: 6 players complete cleanly across 24 seeds` — 統計出力、WINNER 到達・勝者妥当性検証
  - `self-play traces stay bounded (no runaway loop)` — 6人規模 10 seed で `< 500` 手番アサート
  - `self-play results are deterministic (byte-match on replay)` — 複数 seed 組で`RoundResult` 完全一致検証

## 残課題（実装延期）

- **100 seed 規模の拡大試行** — `RUN_FULL = 1` として 100 seed × 5 人数（計 500 局）を実施。結果は UI サブプロジェクト（M2-QA-01 本実施）で実装・確認。本レポートは土台段階のため 24 seed で検証とする。
- **複数リマッチ・絆ストーリー・高度なポリシー** — M3 以降の拡張に対応。M2-QA-01 は STANDARD ポリシー・シングルリマッチのみ。

## メモ

### Task 5（`playRound`）が保証する安全性

- **不変条件の毎手検査** — `resolvePlay` 後、カード総数 36 / cardId 一意性 / 手番席の 3 点を検査。違反時は手番 index 付き `Error` を throw。CPU ポリシーが違法手を返した場合も同様。
- **上限チェック** — `maxTurns`（デフォルト 1000）に達すると `stopReason: "MAX_TURNS"` で停止し、無限ループを防止。
- **決定性** — RNG 消費順序を固定（配布 1 回 + 手番ごと `fork()` 1 回）。同一 seed → バイト一致の `RoundResult`。

### このハーネスが追加で検証する項目

- **WINNER 到達** — 120 試行全て `stopReason === "WINNER"`（決着する）。
- **勝者妥当性** — 宣言された勝者が `finalState.players` に存在し、手札が 0 枚。
- **有界ループ** — 6 人規模 10 seed について `turns.length < 500` をアサート（`maxTurns` 1000 よりも厳しい実測チェック）。
- **決定性再検証** — 複数 seed 組で `playRound` を 2 回ずつ実行し、`RoundResult` の完全一致を確認（決定的エンジンの再保証）。

### ハーネスの特性

- 純粋・同期・決定的（ネットワーク I/O なし、`Math.random()` なし、`Date` 依存なし）。
- 実行時に手番数統計を計測・ログ出力（`[self-play]` 行）。
- 失敗時に絶対 seed と理由を記録（種単位での再現性を確保）。

## 対応した設計要件

- §8 cpuSelfPlay.test.ts の実装（24 seed テスト盤）
- §4.5 ヘッドレス対局ループの決定性 / 再現性検証
- §6 不変条件検査（カード保存則・一意性・手番席） + 例外スロー
