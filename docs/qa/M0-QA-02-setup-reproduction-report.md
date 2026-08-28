# M0-QA-02 新規セットアップ再現レポート

- TODO: M0-QA-02
- 日付: 2026-08-28
- 元リポジトリ: C:\Projects\card-game-app
- 再現ディレクトリ: C:\Users\tetsu\AppData\Local\Temp\card-game-app-m0-qa-02-20260828233816

## 対象範囲

別のローカルcloneからM0セットアップを再現した。検証対象は、依存復元、asset検査、UI token test、mobile test、lint、format check、Android向けexport、Supabase migration、seed適用、DB testである。

## 重要な隔離メモ

clone直後は既存のlocal development stackと同じSupabase project_idとportを共有していたため、cloneからの直接db resetは使用しなかった。稼働中の開発DBをresetしないように、temp directory内の supabase/config.toml だけを次の値へ変更した。

| 設定 | 一時値 |
|---|---|
| project_id | card-game-app-m0-qa-02 |
| API port | 55421 |
| DB port | 55422 |
| Studio port | 55423 |
| Mail port | 55424 |
| Analytics port | 55427 |
| Pooler port | 55429 |

隔離stackは検証後に停止した。

## 結果

| 手順 | 結果 | メモ |
|---|---|---|
| ローカルリポジトリからgit clone | PASS | 新規の一時ディレクトリを作成した。 |
| npm ci | PASS | ルート依存関係を復元した。 |
| npm --prefix apps/mobile ci | PASS | mobile依存関係ツリーでnpm auditのmoderate warningは出たが完了した。 |
| npm run assets:check | PASS | M0 asset manifestとファイルが有効。 |
| npm run ui:test | PASS | 4件のtestが成功。 |
| npm run ui:typecheck | PASS | shared UI token packageがtypecheckを通過。 |
| npm run mobile:test | PASS | 12件のtestが成功。 |
| npm run mobile:typecheck | PASS | mobile TypeScriptが通過。 |
| npm run mobile:lint | PASS | ESLintが通過。 |
| npm run mobile:format:check | PASS | .gitattributesでLF正規化後に通過。 |
| npx expo export --platform android --output-dir dist | PASS | Android bundleをexportできた。 |
| isolated portsでnpx supabase start | PASS | clone側のmigrationsとseedを適用できた。 |
| npx supabase test db --local supabase/tests/master_schema.sql | PASS | 20件のDB testが成功。 |
| npx supabase test db --local supabase/tests/master_seed.sql | PASS | 19件のDB testが成功。 |
| npx supabase test db --local supabase/tests/master_access.sql | PASS | 24件のDB testが成功。 |
| npx supabase stop | PASS | isolated stackを停止した。 |

## 不具合とfollow-up

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | 既知の高重大度不具合はない。 |
| 中 | 1 | mobile依存関係ツリーでnpm ci時にmoderate audit findingsが報告される。M0再現のblockerではないが、release milestone前に確認する。 |
| 低 | 1 | 他のlocal Supabase stackが起動中の場合、直接clone DB resetにはproject_id/port隔離が必要。本レポートとscriptに記録した。 |

## 回帰登録

- scripts/qa-m0-setup-repro.ps1 に再実行可能なコマンド列を記録した。
- .gitattributes により、Windows cloneでCRLF checkoutが原因のPrettier failureを防ぐ。
- 本レポートにtemp clone pathと隔離Supabase設定を記録した。
