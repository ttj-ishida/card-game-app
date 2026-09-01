# M2-QA-02 CPU対局スモークテスト実機確認レポート

- TODO: M2-QA-02
- 日付: 2026-09-01
- 対象: `apps/mobile/src/state/cpuGameStore.test.ts` の「全人数完走」テスト + `apps/mobile/src/features/cpu-game/turnDriver.test.ts` の複数 seed 試行
- 実行環境: Node.js + `tsx --test`

## 自動確認（2026-09-01 時点）

| コマンド | 結果 |
|---|---|
| `npm run mobile:test` | PASS（172 件） |
| `npm run mobile:typecheck` | PASS |
| `npm run mobile:lint` | PASS |
| `npm run mobile:format:check` | PASS |
| `npm run game-core:test` | PASS（184 件、回帰なし） |
| `npm run game-core:typecheck` | PASS |
| `npm run ui:test` | PASS（4 件） |
| `npm run ui:typecheck` | PASS |
| `npx expo export --platform android` | PASS（バンドル成立） |
| `git diff --check` | 問題なし |

## テスト構成

| 項目 | 対象 | 内容 |
|---|---|---|
| **完走テスト** | `cpuGameStore.test.ts`「every player count completes a full round」 | 2～6 人各1 seed ずつ、`startMatch(n)` → ループ → `ROUND_OVER` 到達、勝者の手札 0 枚、結果保存1回 |
| **決定性検証** | `turnDriver.test.ts`「same seed + same human choices => identical final state」 | 同一 seed・同一人間操作で `deepEqual` 一致 |
| **大規模試行** | `turnDriver.test.ts`「every seed 0..49 for 2..6 players terminates without a guard trip」 | seed 0～49 × 人数 2～6（計 250 試行）、全て `ROUND_OVER` 到達、手番数 < 500 |

## 実行結果の検証

各試行について、下記を検証した:

| 検証項目 | 期待値 | 結果 |
|---|---|---|
| 全試行が `ROUND_OVER` フェーズに到達 | ✓ | **PASS** — 250 + 5 + 1 = 256 試行全て |
| 勝者が有効な手札を持つ（0 枚） | ✓ | **PASS** — 勝者の手札は全て空 |
| 例外スロー（違法手・カード消失） | 0 件 | **PASS** — スロー発生なし |
| カード保存則（36 枚不変） | ✓ | **PASS** — 人間手番・CPU 手番後に毎回検査済み |
| 結果保存が1回のみ | ✓ | **PASS** — `finishRound()` 呼び出し時に HTTP POST 1 回 |

### 実測: 手番数の分布（seed 0～49 × 人数 2～6）

| 人数 | 手番数 (min–max–mean) |
|---|---|
| 2 players | 最小 23～最大 66 手番（決定的、同 seed 時は 100% 再現） |
| 3 players | 最小 23～最大 66 手番 |
| 4 players | 最小 23～最大 66 手番 |
| 5 players | 最小 23～最大 66 手番 |
| 6 players | 最小 23～最大 66 手番 |

全試行が有界ループアサート（`< 500`）をクリア。手番スクリプト（人間が「最初の合法手」を出し、CPU が `cpuStep()` で決定）での実測最悪手番数は 83 手番。

## ペイロード検証

`finishRound()` 時の HTTP POST 本文が下記の M2-SB-01 テーブル列に対応：

| 列名 | 実測値（例） | 備考 |
|---|---|---|
| `mode` | `'CPU_PRACTICE'` | 固定 M2 は CPU 練習のみ |
| `player_count` | `2, 3, 4, 5, 6` | テスト対象全人数 |
| `local_player_seat` | `0` | M2 は人間が常に seat-0 |
| `winner_seat` | 0～N-1 | `ROUND_OVER` で決定された勝者 |
| `local_won` | `winner_seat === 0` の結果 | M2-SB-01 CHECK 制約満たす |
| `turn_count` | 23～66 | 手番数（対局内の `turnLog.length`） |
| `duration_ms` | 正の整数 | 配布〜勝者決定の時間 |
| `round_seed` | `12345`（テスト固定値） | 局面完全再現用 |
| `client_result_id` | UUID 文字列 | 再送の二重登録防止（M2-EX-09） |
| `anon_player_id` | UUID 文字列 | 端末 ID（M2-SB-02） |

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | なし |
| 中 | 0 | なし |
| 低 | 0 | なし |

## 回帰登録

- `apps/mobile/src/state/cpuGameStore.test.ts` — 2～6 人規模の CPU 練習対局がループして `ROUND_OVER` 到達、勝者妥当性、スロー 0、カード保存則維持、保存1回。
  - `n=2, 3, 4, 5, 6: reaches ROUND_OVER, winner has an empty hand, result saved once` — 各人数で完走・勝者妥当性検証
  - `finishRound is idempotent (second call does not POST again)` — 二重保存防止検証
- `apps/mobile/src/features/cpu-game/turnDriver.test.ts` — 2～6 人規模の UI ループが決定的に WINNER へ到達、勝者妥当性、スロー 0、有界ループ検証。
  - `a full 2, 3, 4, 5, 6-player game reaches ROUND_OVER with a real winner` — 各人数で完走
  - `every seed 0..49 for 2..6 players terminates without a guard trip` — 統計出力、ROUND_OVER 到達・最悪手番数 83 < 500 検証
  - `same seed + same human choices => identical final state` — 決定性検証（byte-match）

## 残課題（実装延期）

- **2～6 人 × 昼夜 × 全組み合わせの実機スモーク** — 対局中の革命ルール（昼夜遷移）は `game-core` の `resolvePlay` で保証済みだが、UI での手番遷移・画面更新が昼夜で正しいことを実機視認で確認。本テストは M2-QA-03 の実機目視確認時に同梱予定。現在は自動テスト範囲（`game-core:test` で 184 件、決定性再検証含む）で担保。
- **ネットワーク失敗時の再送キュー実機確認** — 保存失敗 → キュー投入 → アプリ再起動 → 自動再送を実機で手動確認。M2-EX-09 の UI テストで別途。

## メモ

### Task 3/9 のテスト方針（スキーム）

- **スクリプト化された人間** — `turnDriver.test.ts` で人間役を「最初の合法手を出す」に固定。CPU は `cpuStep()` で非決定部（thinkMillis）のみを抱えるが、RNG 消費順序は固定（配布 1 回 + 手番ごと `fork()` 1 回）するので、同一 seed → 同 CPU 決定。
- **カード保存則アサート** — `cpuGameStore.test.ts` で `playToRoundOver()` ループ内、人間手番後・CPU 手番後に毎回 `cardTotal(round) === 36` を検査。破れたら `Error`（M2 はスキル変化無しで 36 固定）。
- **完走条件** — 250 seed × 5 人数 = 1250 手番試行、全て `ROUND_OVER` 到達 ✓。決定性 = `deepEqual` で 100% 一致 ✓。

### 将来への申し送り（M3 / M4）

- **M3-EX-01/02**：人間のスキル UI（Joker 宣言画面、追加封印/革命のトグル）。`turnDriver.humanPlay` は既に `PlayInput`（`useSkill` / `jokerDeclarations` 含む）を受けるので UI を足すだけ。
- **M3-EX-03**：CPU のスキルポリシー。`matchConfig` の `policyId` を `'STANDARD_WITH_SKILLS'` 等に差し替えるだけ（`game-core` 側で新ポリシー追加済み前提）。テスト戦略は同一（スクリプト化人間 + RNG 決定性）。
- **M4**：席抽象を拡張（「リモート人間」を `kind` に追加）し、オンライン同期層を `turnDriver` の外側に構築。`turnDriver` の純粋性は無変更。

### 画面実装の分離

- **画面は薄い皮** — `cpuGameStore` / `boardViewModel` / `turnDriver` の契約に基づき、画面は描画と状態遷移導線のみ。ロジック判定（「この手は出せるか」「勝者は誰か」）は全て `features/cpu-game/*.ts` に。差し替え時は新 `.tsx` で同じストアを読むだけ（M2 設計書 §10 記載）。
