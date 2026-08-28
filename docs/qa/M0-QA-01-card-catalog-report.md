# M0-QA-01 Catalog Master and Placeholder Asset QA Report

- TODO: M0-QA-01
- Date: 2026-08-28
- Scope: mobile card catalog data binding and display readiness

## Test Cases

| Case | Input | Expected | Result |
|---|---|---|---|
| QA-CATALOG-001 | 36 number master rows and 4 skill master rows with card_count total 6 | Catalog expands to 42 display items | PASS |
| QA-CATALOG-002 | Number master row without placeholder asset | Build fails with missing number asset error | PASS |
| QA-CATALOG-003 | Valid placeholder manifest | Every catalog item has an SVG runtime asset path | PASS |
| QA-CATALOG-004 | Supabase REST client request failure | Catalog enters error state without partial asset mutation | PASS by code path and retry UI |
| QA-CATALOG-005 | Repeated asset generation and inspection | Generated placeholder manifest remains at physicalDeckCount 42 | PASS |
| QA-CATALOG-006 | Android bundle export | Catalog route bundles with local TS manifest | PASS |

## Commands

| Command | Result |
|---|---|
| npm run mobile:test | PASS, 12 tests |
| npm run mobile:typecheck | PASS |
| npm run mobile:lint | PASS |
| npm run mobile:format:check | PASS |
| npm run assets:check | PASS |
| npm run ui:test | PASS, 4 tests |
| npm run ui:typecheck | PASS |
| npx expo export --platform android --output-dir dist | PASS |

## Defects

| Severity | Count | Notes |
|---|---:|---|
| High | 0 | No high-severity known defects after verification. |
| Medium | 0 | None recorded. |
| Low | 1 | The current screen displays generated card placeholders as native card views and asset IDs; direct SVG image rendering is deferred until a React Native SVG rendering strategy is chosen. |

## Regression Coverage

- apps/mobile/src/features/catalog/cardCatalog.test.ts covers 42-item expansion and missing-asset failure.
- scripts/check-m0-assets.mjs covers placeholder manifest count, dimensions, runtime paths, and file-size bounds.
- Expo export verifies the catalog route can bundle for Android.
