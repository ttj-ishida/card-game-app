# M3-QA-04: CPUアルファ配布用ビルド プリフライト

日付: 2026-09-02
状態: ブロック中（M3-QA-02 の実機確認待ち）

## 目的

M3-QA-04 は「テスターがインストール・完走できる」配布用ビルドを作るタスクである。依存TODOは M3-QA-01〜03 であり、M3-QA-02 の実機確認が未完了の間は正式完了にしない。

## 自動確認結果

`npm run qa:m3:preflight` を追加し、2026-09-02 に実行した。

| コマンド                        | 目的                       | 結果                                           |
| ------------------------------- | -------------------------- | ---------------------------------------------- |
| `npm run game-core:test`        | ルールエンジン回帰         | PASS（209 件）                                 |
| `npm run mobile:test`           | モバイル純関数・ストア回帰 | PASS（248 件）                                 |
| `npm run mobile:typecheck`      | 画面含む TypeScript 検査   | PASS                                           |
| `npm run mobile:lint`           | ESLint                     | PASS                                           |
| `npm run mobile:format:check`   | Prettier                   | PASS                                           |
| `npm run mobile:export:android` | Expo Android bundle export | PASS（`dist` 出力、M3 tutorial SVG 5件を含む） |

## 配布前チェック

| ID            | 項目                     | 期待結果                                            | 状態    |
| ------------- | ------------------------ | --------------------------------------------------- | ------- |
| QA04-READY-01 | M3-QA-01                 | CPU 1,000局自動対戦レポート完了                     | PASS    |
| QA04-READY-02 | M3-QA-02                 | 全スキル・全上がり境界の実機確認完了                | BLOCKED |
| QA04-READY-03 | M3-QA-03                 | 5人対戦の配布席・先攻ローテーション確認完了         | PASS    |
| QA04-BUILD-01 | Android export           | `npm run mobile:export:android` が成功              | PASS    |
| QA04-BUILD-02 | インストール可能な成果物 | テスターが端末へ導入できる形式が生成されている      | 未着手  |
| QA04-RUN-01   | テスター完走             | 新規テスターが1局完走し、履歴・戦績保存を確認できる | 未着手  |

## ブロッカー

- M3-QA-02 は実機操作が完了条件であり、現時点ではチェックリスト作成まで完了している。
- Expo export はバンドル確認であり、インストール可能な APK/AAB の生成ではない。配布形式を Expo development build / EAS build / ローカル native build のどれにするかは M3-QA-02 PASS 後に決める。

## 次の一歩

1. `docs/qa/M3-QA-02-skill-boundary-device-checklist.md` を使って実機確認を完了する。
2. M3-QA-02 が PASS になったら、配布方式を選ぶ。
3. テスターがインストールできる成果物を作成し、1局完走と履歴・戦績保存を確認する。
