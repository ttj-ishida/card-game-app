# M0-QA-01 カードカタログ master/仮素材結合 QAレポート

- TODO: M0-QA-01
- 日付: 2026-08-28
- 対象: mobile card catalogのdata bindingと表示準備

## テストケース

| ケース | 入力 | 期待値 | 結果 |
|---|---|---|---|
| QA-CATALOG-001 | 数字master 36行、skill master 4行、card_count合計6 | catalog itemが42件に展開される | PASS |
| QA-CATALOG-002 | 仮素材のない数字master行 | missing number asset errorでbuildが失敗する | PASS |
| QA-CATALOG-003 | 有効なplaceholder manifest | すべてのcatalog itemにSVG runtime asset pathがある | PASS |
| QA-CATALOG-004 | Supabase REST client request failure | 部分的なasset mutationを残さずerror stateへ移る | code pathとretry UIでPASS |
| QA-CATALOG-005 | 繰り返しasset生成と検査 | 生成後のplaceholder manifestがphysicalDeckCount 42を保つ | PASS |
| QA-CATALOG-006 | Android向けbundle export | catalog routeがlocal TS manifest込みでbundleされる | PASS |

## 実行コマンド

| コマンド | 結果 |
|---|---|
| npm run mobile:test | PASS、12 tests |
| npm run mobile:typecheck | PASS |
| npm run mobile:lint | PASS |
| npm run mobile:format:check | PASS |
| npm run assets:check | PASS |
| npm run ui:test | PASS、4 tests |
| npm run ui:typecheck | PASS |
| npx expo export --platform android --output-dir dist | PASS |

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | 検証後の既知高重大度不具合はない。 |
| 中 | 0 | なし。 |
| 低 | 1 | 現在の画面は生成カード仮素材をReact Nativeのnative card viewとasset IDで表示する。SVG画像そのものの直接描画は、React Native SVG描画方針の決定後に扱う。 |

## 回帰登録

- apps/mobile/src/features/catalog/cardCatalog.test.ts で42件展開とmissing asset failureを確認する。
- scripts/check-m0-assets.mjs でplaceholder manifest count、寸法、runtime path、容量境界を確認する。
- Expo exportでcatalog routeがAndroid向けにbundleできることを確認する。
