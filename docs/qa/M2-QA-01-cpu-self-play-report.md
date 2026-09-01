# M2-QA-01 CPU自動対戦ハーネス実機確認レポート

- TODO: M2-QA-01
- 日付: 2026-09-01
- 対象: `packages/game-core/src/cpuSelfPlay.test.ts`（CPU自動対戦テストハーネス）
- 実行環境: Node.js + `tsx --test`

本レポートはハーネス実装の土台となる **24 seed × 5 人数（計 120 局）の試行結果** を記す。100 seed 規模の完全検証はサブプロジェクト2完了後、UI 実装にあわせて行う（M2-QA-01 本実施）。

## 自動確認（2026-09-01 時点）

| コマンド | 結果 |
|---|---|
| `npm run game-core:test` | PASS（178件 / 新規 6件）|
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
| 例外スロー（不正手・カード消失） | 0 件 | **PASS** — スロー発生なし |
| 手番数の上限（max 1000） | 有限 | **PASS** — 最大 73 手番 |

### 追加検証: 手番数の分布

| 人数 | 手番数 (min-max-avg) |
|---|---|
| 2 players | 3–73–23.33 |
| 3 players | 3–46–16.50 |
| 4 players | 3–31–12.08 |
| 5 players | 3–28–11.13 |
| 6 players | 3–24–9.96 |

全試行で上限 1000 に対し十分な余裕を保つ（最大 73 ≪ 1000）。停滞なし、無限ループなし。

## 決定性検証

同一 seed から生成された `RoundResult` は複数回実行で **バイト一致** を確認（決定的エンジンの性質が保証される）。

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | なし |
| 中 | 0 | なし |
| 低 | 0 | なし |

## 回帰登録

- `packages/game-core/src/cpuSelfPlay.test.ts` — 2～6 人規模の CPU 自動対戦が決定的に WINNER へ到達、勝者の妥当性、不正手なし・カード保存則維持。
  - `self-play: 2 players complete cleanly across 24 seeds`
  - `self-play: 3 players complete cleanly across 24 seeds`
  - `self-play: 4 players complete cleanly across 24 seeds`
  - `self-play: 5 players complete cleanly across 24 seeds`
  - `self-play: 6 players complete cleanly across 24 seeds`
  - `self-play traces stay bounded (no runaway loop)`

## 残課題（実装延期）

- **100 seed 規模の拡大試行** — `RUN_FULL = 1` として 100 seed × 5 人数（計 500 局）を実施。結果は UI サブプロジェクト（M2-QA-01 本実施）で実装・確認。本レポートは土台段階のため 24 seed で検証とする。
- **複数リマッチ・絆ストーリー・高度なポリシー** — M3 以降の拡張に対応。M2-QA-01 は STANDARD ポリシー・シングルリマッチのみ。

## メモ

- `playRound` の再現性：配布・手番スの RNG 消費順序を固定（`fork()` 毎回 1 回、配布 + 手番ごと）。同一 seed → バイト一致の `RoundResult`。
- 不変条件の毎手検査：`resolvePlay` 後、カード総数 36 / cardId 一意 / 手番席の3点をアサート。違反時は手番 index 付き `Error` を throw。CPU ポリシーが不正手を返した場合も同様にスロー。
- `maxTurns` はデフォルト 1000（必要に応じて引き上げ可能だが、本試行では不要）。
- ハーネスは純粋・同期・決定的。ネットワーク I/O なし、`Math.random()` なし、`Date` 依存なし。

## 対応した設計要件

- §8 cpuSelfPlay.test.ts の実装（24 seed テスト盤）
- §4.5 ヘッドレス対局ループの決定性 / 再現性検証
- §6 不変条件検査（カード保存則・一意性・手番席） + 例外スロー
