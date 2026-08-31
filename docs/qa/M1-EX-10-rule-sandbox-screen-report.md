# M1-EX-10 ルールサンドボックス画面 実機確認レポート

- TODO: M1-EX-10
- 日付: 2026-09-01
- 対象: `apps/mobile/src/app/sandbox/index.tsx`（開発者用デバッグ盤面）
- 確認端末: エミュレータ（タブレット相当 AVD、横画面）
- 注記: 本画面はその後の「場のロック体系」改訂（`docs/superpowers/specs/2026-09-01-field-state-lock-system-design.md`）で、場エディタの「属性ロック（火/水/風/土）」行が **枚数ロック / 属性統一ロック / 属性固定ロック** の3コントロールへ置き換わっている。下表はその状態で確認した。

## 自動確認（2026-09-01 時点）

| コマンド | 結果 |
|---|---|
| `npm run mobile:test` | PASS（62件） |
| `npm run mobile:typecheck` / `:lint` / `:format:check` | PASS |
| `npm run game-core:test` / `:typecheck` | PASS（114件、回帰なし） |
| `npm run ui:test` / `:typecheck` | PASS（4件） |
| `npx expo export --platform android` | PASS |

## 実機・エミュレータ目視確認

| # | 確認項目 | 期待 | 結果 |
|---|---|---|---|
| D-1 | 横画面レイアウト（スマホ相当） | ①盤面 / ②プレイ入力が左右2カラム、③結果・履歴が下段。横スクロールなし、要素の重なり・見切れなし | PASS |
| D-2 | 横画面レイアウト（タブレット相当） | カラムが広がり読みやすい。崩れなし | PASS |
| D-3 | 文字拡大 | ボタン文字・カードチップが拡大しても切れず、タップ領域が保たれる | PASS |
| D-4 | TalkBack 読み上げ順 | フォーカス順が「ツールバー → プリセット → 盤面エディタ → プレイ入力 → 実行 → 結果 → 履歴」。各操作が意味のあるラベルと状態（`selected`/`checked`/`disabled`）を読み上げる | PASS |
| D-5 | 変化Joker の判別 | プリセットまたは変化Joker宣言プレイの結果、場に出た変化Joker由来カードが「J」バッジ付き＋読み上げ「変化Joker」。実カードは通常表示 | PASS |
| D-6 | 主要フローの再現 | プリセット読み込み →「実行」→ ③に合法/不正・種別・バッジ、①の盤面が遷移後へ更新 →「1手戻す」で戻る。不正時は盤面据え置き＋日本語理由 | PASS |
| D-7 | 任意局面の構築 | 昼夜 / 人数 / 手番 / 各手札 / スキル / status / 場エディタ / **枚数ロック・属性統一ロック・属性固定ロック** / 追加封印 / 連続パス / 捨て札 を一通り操作。無効な場（例 🔥6・💧8）で「この組み合わせは無効です」＋「場に設定」無効化（画面状態「編集警告」到達） | PASS |
| D-8 | 低性能 / 軽量設定 | スクロールがカクつかず操作可能（本画面はアニメーションなし） | PASS |
| D-9 | 戻る操作 | ホームへ戻る。状態が壊れない | PASS |

### 対象外（N/A）

| 項目 | 理由 |
|---|---|
| 通信失敗・再試行 | 本画面は完全にローカル・同期動作。ネットワーク I/O なし（`resolvePlay` は純粋関数）。ローディング状態も持たない |
| 軽量設定トグル | M1 では未実装（M3-EX-08 で導入予定）。本画面はアニメーション・重いフィルタを含まない |

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | なし |
| 中 | 0 | なし |
| 低 | 0 | なし |

## 既知の留保（実装時レビューより）

- 画面のレンダーテストはなし（リポジトリに react-test-renderer 未導入、カタログ画面と同方針）。ロジックは `sandboxModel` / `rule-sandbox-store` / `sandboxPresets` / `translate` の `.test.ts` で網羅。
- ホーム画面の `/sandbox` 導線は現状ラベル「開発用」付きで常時表示。外部配布ビルド前に `__DEV__` で囲む必要がある。
- 手札の追加先セレクタは、手番を切り替えても自動追従しない（保持中の選択が有効な限りそのまま）。デバッグ用途では許容。
- 場のロック3コントロールは既定でコミット済みの場に対して編集する。プリセットは `activeField.lock` からロック状態をシードする。
- 各ロックトグルはラベル文字・`accessibilityLabel`・ボタン内文字で同じ文言を3回持つ（読み上げがやや冗長）。「場のロック」グループ見出しは i18n キー未定義のため省略。将来の軽微改善候補。
- Web プレビュー用に `react-native-web` を追加済み（`npm run mobile:web`）。Web は v1.0 対象外・レイアウト目視専用。

## 回帰登録

- `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts` — エディタ純粋性・不変条件・`buildPlayInput`・`describeResolution`・場ロックエディタ。
- `apps/mobile/src/features/rule-sandbox/sandboxPresets.test.ts` — 全プリセットが各 id の意図どおり `resolvePlay` する。
- `apps/mobile/src/state/rule-sandbox-store.test.ts` — `applyPlay` / `undo` / `reset` / `loadPreset` / `fieldDraft` / `fieldDraft.lock` の状態遷移。
- `apps/mobile/src/i18n/translate.test.ts` — `sandbox.*` 必須キー、`REASON_CODES satisfies Record<PlayRejectionReason, true>` による網羅の型保証。
- `npx expo export --platform android` — `@card-game-app/game-core` / `@card-game-app/ui` の Metro 解決を含むバンドル成立。
