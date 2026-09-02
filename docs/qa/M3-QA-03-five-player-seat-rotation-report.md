# M3-QA-03 5人対戦 配布席・先攻ローテーション確認レポート

- TODO: M3-QA-03
- 日付: 2026-09-02
- 対象: 5人CPU戦の配布席、8枚席、先攻ローテーション
- 実行環境: Node.js v22 + `tsx --test`

## 確認観点

| 観点             | 期待値                                                                | 結果 |
| ---------------- | --------------------------------------------------------------------- | ---- |
| 5人配布          | 36枚の数字カードが `[8,7,7,7,7]` に分配される                         | PASS |
| 8枚席            | 5人対戦では8枚席が1席だけ存在する                                     | PASS |
| 初回先攻         | 5人対戦では8枚席が先攻になる                                          | PASS |
| 複数再戦         | `baselineFirstPlayerId + rematchIndex` で時計回りに先攻が交代する     | PASS |
| mobile store連携 | `rematch()` 後も5人・8枚席・先攻が一致し、結果/ログ状態が初期化される | PASS |

## 回帰テスト登録

- `packages/game-core/src/deal.test.ts`
  - `rematch rotates both the 8-card seat and the first player across multiple 5-player rounds`
  - rematchIndex 1〜7 を確認し、2周目に入ってもローテーションが崩れないことを検証。
- `apps/mobile/src/state/cpuGameStore.test.ts`
  - `five-player rematches keep the 8-card seat and first seat rotating together`
  - `cpuGameStore.rematch()` を7回繰り返し、active seat と8枚手札席が一致することを検証。

## 実行結果

| コマンド                 | 結果          |
| ------------------------ | ------------- |
| `npm run game-core:test` | PASS（209件） |
| `npm run mobile:test`    | PASS（248件） |

## 不具合

| 重大度 | 件数 | メモ |
| ------ | ---: | ---- |
| 高     |    0 | なし |
| 中     |    0 | なし |
| 低     |    0 | なし |

## 手動確認手順

1. `npm run android` でアプリを起動する。
2. CPU戦設定で人数を5人にして開始する。
3. 1局を最後まで終える。
4. 結果画面で再戦し、複数回繰り返す。
5. 各局で手札枚数が合計36枚、8枚席が1席だけ、先攻が再戦ごとに交代していることを確認する。

M3-QA-03の完了条件「複数再戦で席が正しく交代する」は、自動テストで再現可能な状態として登録済み。
