# M1-EX-10 ルールサンドボックス画面 実機確認レポート

- TODO: M1-EX-10
- 日付: <実施日>
- 対象: `apps/mobile/src/app/sandbox/index.tsx`（開発者用デバッグ盤面）
- 確認端末: <例: エミュレータ Pixel_9 / Android 14 / 横画面>、<例: タブレット相当 AVD / Android 13>

## 自動確認（実装完了時点、2026-08-30）

| コマンド | 結果 |
|---|---|
| `npm run mobile:test` | PASS（58件） |
| `npm run mobile:typecheck` | PASS |
| `npm run mobile:lint` | PASS |
| `npm run mobile:format:check` | PASS |
| `npm run game-core:test` / `:typecheck` | PASS（93件、回帰なし） |
| `npm run ui:test` / `:typecheck` | PASS（4件） |
| `npx expo export --platform android --output-dir dist` | PASS |

## 実機・エミュレータ目視確認

| # | 確認項目 | 手順 | 期待 | 結果 |
|---|---|---|---|---|
| D-1 | 横画面レイアウト（スマホ相当） | Pixel 相当 AVD を横向きで起動 → ホーム →「ルールサンドボックス（開発用）」 | ①盤面 / ②プレイ入力が左右2カラム、③結果・履歴が下段。横スクロールなし、要素の重なり・見切れなし | 未確認 |
| D-2 | 横画面レイアウト（タブレット相当） | 10インチ相当 AVD を横向きで同上 | カラムが広がり読みやすい。崩れなし | 未確認 |
| D-3 | 文字拡大 | 設定 → ディスプレイ → フォントサイズ / 表示サイズを最大 → 画面を再確認 | ボタン文字・カードチップが拡大しても切れず、タップ領域が保たれる。行が折り返して縦に伸びるのは可 | 未確認 |
| D-4 | TalkBack 読み上げ順 | 設定 → ユーザー補助 → TalkBack を ON → 画面を左右スワイプでフォーカス移動 | フォーカス順が「ツールバー → プリセット → 盤面エディタ → プレイ入力 → 実行 → 結果 → 履歴」。各操作が意味のあるラベルを読み上げる（例「3 火」「昼」「場に設定」）。選択中の状態（`selected` / `checked` / `disabled`）が読み上げられる | 未確認 |
| D-5 | 変化Joker の判別 | プリセット「同属性34+Joker5 で属性ロック」を読み込み →「実行」 | 場の 🔥5 が「J」バッジ付きで表示され、TalkBack が「…変化Joker」と読み上げる。実カードは通常表示のまま | 未確認 |
| D-6 | 主要フローの再現 | プリセットを1つ読み込み →「実行」→ ③に合法/不正・種別・バッジが出て ①の盤面が遷移後へ更新 → 「1手戻す」で戻る | 期待どおり遷移・巻き戻し。不正プレイ時は盤面据え置き＋日本語理由 | 未確認 |
| D-7 | 任意局面の構築 | 昼夜トグル / 人数 / 手番 / 各手札のカード追加削除（追加先プレイヤー選択）/ スキル / status / 場エディタ / 属性ロック / 追加封印 / 連続パス / 捨て札 を一通り操作 | すべて即時反映。場エディタで無効な組（例 🔥6・💧8）を作ると「この組み合わせは無効です」表示＋「場に設定」無効化（＝画面状態「編集警告」到達） | 未確認 |
| D-8 | 低性能 / 軽量設定 | 低RAM プロファイルの AVD、または開発者オプションでアニメーション OFF | スクロールがカクつかず操作可能（本画面はアニメーションなし） | 未確認 |
| D-9 | 戻る操作 | Android の戻るジェスチャ / ボタン | ホームへ戻る。状態が壊れない | 未確認 |

### 対象外（N/A）

| 項目 | 理由 |
|---|---|
| 通信失敗・再試行 | 本画面は完全にローカル・同期動作。ネットワーク I/O なし（`resolvePlay` は純粋関数）。ローディング状態も持たない |
| 軽量設定トグル | M1 では未実装（M3-EX-08 で導入予定）。本画面はアニメーション・重いフィルタを含まない |

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | <0> | <> |
| 中 | <0> | <> |
| 低 | <> | <> |

## 既知の留保（実装時レビューより）

- 画面のレンダーテストはなし（リポジトリに react-test-renderer 未導入、カタログ画面と同方針）。ロジックは `sandboxModel` / `rule-sandbox-store` / `translate` の `.test.ts` で網羅（計58件）。
- ホーム画面の `/sandbox` 導線は現状ラベル「開発用」付きで常時表示。外部配布ビルド前に `__DEV__` で囲む必要がある。
- 手札の追加先セレクタは、手番を切り替えても自動追従しない（保持中の選択が有効な限りそのまま）。デバッグ用途では許容。

## 回帰登録

- `apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts` — エディタ純粋性・不変条件・`buildPlayInput`・`describeResolution`。
- `apps/mobile/src/features/rule-sandbox/sandboxPresets.test.ts` — 10プリセットが各 id の意図どおり `resolvePlay` する。
- `apps/mobile/src/state/rule-sandbox-store.test.ts` — `applyPlay` / `undo` / `reset` / `loadPreset` / `fieldDraft` の状態遷移。
- `apps/mobile/src/i18n/translate.test.ts` — `sandbox.*` 必須キー、`REASON_CODES satisfies Record<PlayRejectionReason, true>` による網羅の型保証。
- `npx expo export --platform android` — `@card-game-app/game-core` / `@card-game-app/ui` の Metro 解決を含むバンドル成立。
