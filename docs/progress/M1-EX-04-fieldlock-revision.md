# M1-EX-04 場のロック体系 改訂 進捗

- 関連TODO: M1-EX-04（ルール訂正）/ M1-EX-10（サンドボックス反映）
- 状態: 完了
- 日付: 2026-09-01
- 仕様: docs/superpowers/specs/2026-09-01-field-state-lock-system-design.md

## 概要

M1-EX-10 実機確認で発覚したルール食い違いを受け、アクティブセットの更新・追加可否と属性制限を、枚数ロック / 属性固定ロック / 属性統一ロックの3種へ再定義。旧 §10.1 属性ロック（`RoundState.lockedSuitCode` / `detectSuitLock` / `SUIT_LOCKED`）を廃止し、`ActiveField.lock: FieldLock` ＋ `deriveFieldLock` ＋ `evaluateNumberPlay` のロック判定に置き換え。将来のルールトグル用に `RulesetOptions`（M1 は `RULESET_INITIAL` 固定）の継ぎ目を用意。

## 成果物

| 種別 | パス |
| --- | --- |
| ルール実装 | `packages/game-core/src/index.ts` |
| ロック導出テスト | `packages/game-core/src/fieldLock.test.ts` |
| 受入テスト | `packages/game-core/src/ruleAcceptance.test.ts`（T-RULE-008 改訂、023/024/025 追加） |
| 要件 | `docs/product/独自カードゲーム_要件定義書_v0.2.md`（v0.3） |
| チェックリスト | `docs/qa/M1-QA-03-rule-verification-checklist.md`（グループ D 差し替え） |
| サンドボックス | `apps/mobile/src/features/rule-sandbox/*`, `apps/mobile/src/state/rule-sandbox-store.ts`, `apps/mobile/src/app/sandbox/index.tsx` |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run game-core:test` / `:typecheck` | PASS（105 tests / tsc クリーン） |
| `npm run mobile:test` / `:typecheck` / `:lint` / `:format:check` | PASS（62 tests / tsc・eslint・prettier クリーン、`index.tsx` を `format` で整形） |
| `npm run ui:typecheck` | PASS |
| `npx expo export --platform android` | PASS（`dist/` へ出力、android bundle 1・assets 27、コミット対象外） |
| `git diff --check` | 問題なし |

## メモ

- 自然革命 REV-002 は初回更新後は追加不可のため発生し得ない（初回更新前は従来どおり）。ルール変更ではなく帰結。
- 追加封印（SEAL-*）はスキル効果として現状維持。
- ルールトグルの UI・永続化は将来の別スペック。
- サンドボックス画面の場エディタに「場のロック」コントロールを追加: 枚数ロック トグル（`accessibilityRole="switch"`）、属性統一ロック トグル（同）、属性固定ロック 属性チップ複数選択（`accessibilityRole="button"` + `accessibilityState.selected`）。`draft.activeField` が存在するときのみ表示し、`translate('sandbox.fieldLock.*')` / `translate('sandbox.suit.*')` 経由でラベル表示。結果パネルの理由表示は既存の `translate(lastResult.reasonKey)` 経由で新 reason キー（`COUNT_LOCKED` / `SUIT_FIXED_MISMATCH` / `SUIT_UNIFORM_REQUIRED`）が自動表示。
