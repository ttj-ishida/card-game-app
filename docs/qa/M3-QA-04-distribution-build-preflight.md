# M3-QA-04: CPUアルファ配布用ビルド プリフライト

日付: 2026-09-03
状態: EAS previewビルド投入済み（APK生成待ち）

## 目的

M3-QA-04 は「テスターがインストール・完走できる」配布用ビルドを作るタスクである。依存TODOは M3-QA-01〜03 であり、M3-QA-02 の実機確認が未完了の間は正式完了にしない。

## 自動確認結果

`npm run qa:m3:preflight` を2026-09-03に再実行し、自然革命修正後の最新HEADで通過を確認した。

| コマンド                        | 目的                       | 結果                                           |
| ------------------------------- | -------------------------- | ---------------------------------------------- |
| `npm run game-core:test`        | ルールエンジン回帰         | PASS（210 件）                                 |
| `npm run mobile:test`           | モバイル純関数・ストア回帰 | PASS（251 件）                                 |
| `npm run mobile:typecheck`      | 画面含む TypeScript 検査   | PASS                                           |
| `npm run mobile:lint`           | ESLint                     | PASS                                           |
| `npm run mobile:format:check`   | Prettier                   | PASS                                           |
| `npm run mobile:export:android` | Expo Android bundle export | PASS（`dist` 出力、M3 tutorial SVG 5件を含む） |

## 配布前チェック

| ID            | 項目                     | 期待結果                                            | 状態                        |
| ------------- | ------------------------ | --------------------------------------------------- | --------------------------- |
| QA04-READY-01 | M3-QA-01                 | CPU 1,000局自動対戦レポート完了                     | PASS                        |
| QA04-READY-02 | M3-QA-02                 | 全スキル・全上がり境界の実機確認完了                | PASS                        |
| QA04-READY-03 | M3-QA-03                 | 5人対戦の配布席・先攻ローテーション確認完了         | PASS                        |
| QA04-BUILD-01 | Android export           | `npm run mobile:export:android` が成功              | PASS                        |
| QA04-BUILD-02 | インストール可能な成果物 | EAS previewビルドで内部配布APKを生成できる          | 実行中（EAS Build投入済み） |
| QA04-RUN-01   | テスター完走             | 新規テスターが1局完走し、履歴・戦績保存を確認できる | 未着手                      |

## 現在の制約

- M3-QA-02 は2026-09-03にユーザー実機確認済み。
- このPCにはJavaがPATHになく、`apps/mobile/android` も未生成のためローカルGradleビルドは未実施。EAS CLIログイン後、`@tetsuzi/card-game-app` を作成・紐付けし、Android previewビルドを投入した。
- Preview build: `https://expo.dev/accounts/tetsuzi/projects/card-game-app/builds/2fcd8190-584e-4d6b-86d3-f211f83dc347`

## 次の一歩

1. EAS previewビルドの完了を待つ。
2. 生成されたAPKをテスター端末へインストールする。
3. 1局完走と履歴・戦績保存を確認する。
