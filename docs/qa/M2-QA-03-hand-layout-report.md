# M2-QA-03 手札配置・レイアウト実機確認レポート

- TODO: M2-QA-03
- 日付: 2026-09-01
- 対象: `apps/mobile/src/features/cpu-game/boardViewModel.test.ts` の 18 枚/6 枚構造テスト + 実機目視チェックリスト（画面 EX-05/06）
- 確認端末: エミュレータ（スマホ相当 AVD、タブレット相当 AVD、横画面）
- 注記: **自動確認は完了。実機目視確認（デバイス確認行）は実機での操作が必要なため、ユーザーが手動で埋める。**

## 自動確認（2026-09-01 時点）

| コマンド | 結果 |
|---|---|
| `npm run mobile:test` | PASS（172 件）— M2-QA-03 テスト含む |
| `npm run mobile:typecheck` / `:lint` / `:format:check` | PASS |
| `npm run game-core:test` / `:typecheck` | PASS（184 件、回帰なし） |
| `npm run ui:test` / `:typecheck` | PASS（4 件） |
| `npx expo export --platform android` | PASS（バンドル成立） |

### 自動テスト検証（boardViewModel.test.ts）

| # | テスト項目 | 期待 | 結果 |
|---|---|---|---|
| A-1 | 2 人配布で手札 18 枚 | `vm.hand.length === 18` | PASS — テスト「M2-QA-03: a 2-player deal yields an 18-card hand」 |
| A-2 | 6 人配布で手札 6 枚 | `vm.hand.length === 6` | PASS — 同テスト |
| A-3 | 全カード要素が `{ rank, suitCode, isJoker }` を保有 | 型チェック | PASS — テスト「every FieldCardView and HandCardView carries { rank, suitCode, isJoker }」 |
| A-4 | 手札が `(rank, suitCode)` 昇順 | `hand[i].key <= hand[i+1].key` | PASS — テスト「hand is sorted ascending by (rank, suit order)」 |
| A-5 | 場の表示形式が SINGLE / RANK_SET / SEQUENCE のいずれか | 型チェック + 有効性 | PASS — テスト「field is null before any lead, populated after」 |
| A-6 | 横画面での強弱順が昼夜で反転 | 昼: [1..9], 夜: [9..1] | PASS — テスト「strengthOrder is [1..9] by day」「strengthOrder is [9..1] at night」 |
| A-7 | 対戦相手が人間席を除外して席順で並ぶ | `opponents.map(o => o.seatId)` が `['seat-1', ...]` | PASS — テスト「opponents exclude the human seat, follow seat order」 |

## 実機・エミュレータ目視確認チェックリスト

| # | 確認項目 | 期待 | 結果 |
|---|---|---|---|
| D-1 | 横画面レイアウト（スマホ相当）— 手札 18 枚 | 手札が上帯・相手・場・操作ボタンを圧迫・重なり・見切れなし（全てタップ可）、横スクロールなし | 未確認 |
| D-2 | 横画面レイアウト（スマホ相当）— 手札 6 枚 | カードが適切な間隔で配置、タップ領域十分 | 未確認 |
| D-3 | 横画面レイアウト（タブレット相当） | 広い画面で各パネルが読みやすく、崩れなし | 未確認 |
| D-4 | 相手席 6 席が全て横スクロール可で見える | `OpponentView` × (N-1) 席が上帯下に横スクロール、各席にカード枚数・スキル・ステータス（ACTIVE/PASSED/OUT）表示 | 未確認 |
| D-5 | 場のカードとロック表示が読める | 場に出たカード（数字 + 属性色 + ラベル）、ロック3行（枚数ロック● / 属性固定[火] / 属性統一— / 追加封印—）が明確 | 未確認 |
| D-6 | 文字拡大時の操作ボタン | 「出す」「パス」「選択解除」が文字拡大で横に欠けず、クリック領域が保たれる | 未確認 |
| D-7 | TalkBack 読み上げ順（読み上げ有効時） | フォーカス順が「上帯（昼夜・手番）→ 相手席列 → 場 → 手札 → 操作（出す・パス・選択解除）」。各カードが「数字・属性」（例「火6」）と選択状態（「選択済み」）を読み上げる | 未確認 |
| D-8 | CPU「思考中…」表示 | `phase==='CPU_PENDING'` で対応相手席に「思考中…」テキスト、手札操作は全て無効化 | 未確認 |
| D-9 | 結果画面への遷移と表示 | `ROUND_OVER` で自動 replace → `/cpu-game/result`、勝者名・「勝ちました」「負けました」テキスト表示、「再戦」「ホームへ」ボタン活性 | 未確認 |
| D-10 | 戻る操作（ハードウェアバック） | 対局中に戻る → 確認ダイアログ「対局を中止しますか」 → YES で `/`（ホーム）に `exit()` | 未確認 |

### 対象外（N/A）

| 項目 | 理由 |
|---|---|
| アニメーション・演出 | M2 は機能プレースホルダ版のみ。カード移動アニメ・SE/BGM は M3 以降（M2-GR-04 素材を M3 で実装） |
| 複数カードパック・デザインカード | M2 は `packId='DEFAULT'` 固定（数字 + 属性ラベル + 形状）。複数パック選択は M3-EX-08（ソロ設定）/ M4（卓設定） |
| 通信失敗・再試行 | 本画面は完全ローカル同期。ネットワーク I/O は結果画面で発生（`recordFinishedRound`）し、失敗時は画面ブロック無し |

## 不具合

| 重大度 | 件数 | メモ |
|---|---:|---|
| 高 | 0 | なし |
| 中 | 0 | なし |
| 低 | 0 | なし |

## 既知の留保（設計・実装時より）

- **自動確認テスト** — 画面レンダーテストは無し（リポジトリに react-test-renderer 未導入）。ロジック（構造・値）は `boardViewModel.test.ts` で全網羅、画面は値を描画する薄い皮。
- **実機確認スコープ** — 目視確認チェックリスト（D-1～D-10）は手動確認項目。エミュレータと実機での見え方・タップ精度に差があるため、実際の実機（スマホ・タブレット）での最終確認が必須。
- **横画面のみ対応** — M2 の 3 画面（setup/play/result）は全て `app.json` の `orientation: 'landscape'` で横画面固定。縦画面レイアウトは対象外。
- **手番タイマー** — 「手番プレイヤー表示」のみ実装（M2-UI-BATTLE-006 の時間部分は M4 実装予定）。

## 回帰登録

- `apps/mobile/src/features/cpu-game/boardViewModel.test.ts`（M2-QA-03 自動確認）
  - `M2-QA-03: a 2-player deal yields an 18-card hand, a 6-player deal yields 6` — 配布枚数の構造テスト
  - `every HandCardView carries the full shape` — 全カード要素の型チェック
  - `every FieldCardView and HandCardView carries { rank, suitCode, isJoker }` — カード識別要素の検査
  - `hand is sorted ascending by (rank, suit order)` — 手札整列順の検証
  - `field is null before any lead, populated after` — 場表示の生成
  - `strengthOrder is [1..9] by day` / `strengthOrder is [9..1] at night` — 昼夜による強弱順反転
  - `opponents exclude the human seat, follow seat order, and mirror round.players` — 対手パネル席順と情報

## 残課題（実装延期）

- **D-1～D-10 の実機確認** — 上表「結果」列の「未確認」を、実機でのスマホ・タブレット視認で埋める。ユーザーまたは QA 担当者による手動確認。
- **複数カードパック対応テスト** — `CardFace` に `packId` を渡して異なるアセット描画の動作確認。M3-EX-08 の設定導入後。
- **昼夜切り替え実機確認** — `revolutionCondition()` での昼夜遷移は `game-core` で保証済み、UI の `dayNight` 反映・強弱順表示の実機視認。現在は `game-core:test` で革命ルール全体を検証（手番ロジック無変更）。

## メモ

### 画面実装の分離と将来対応

- **ビューモデル契約** — `boardViewModel` が `DriverState` → `BoardViewModel` を導出する型・値変換は全て純関数。画面は `BoardViewModel` を描画するだけ。
- **将来デザイン版への差し替え** — デザイン版 `play.tsx` は同じ `boardViewModel` を呼んで同じ `BoardViewModel` を受け取り、デザイン仕様に従って描画。`features/cpu-game/*.ts` は無変更。
- **CardFace の重要性** — 全カード表示（手札・場・対手スキルバッジ）が1つの `CardFace` コンポーネント経由。M2 は `{ rank, suitCode, isJoker }` から「数字 + 属性色 + ラベル」を描画（デフォルトパック）。M3 で複数パック対応時に `CardFace` に `packId` を渡すだけで自動対応。

### 技術用語・アクセシビリティ（UI-A11Y）

- **属性ロック** — 属性固定（枚数固定でスート必須）/ 属性統一（同じスート）は色のみに依存せず、ラベル・記号で区別（UI-A11Y-001）。
- **スキル表示** — M2 では「使用不可の注記」を付ける（M3 で使用 UI 足す）。相手席のスキル有無は「●」バッジで表示（読み上げ「スキル保有」）。
- **TalkBack** — Android 標準の読み上げ。各要素に適切な `accessibilityLabel` / `accessibilityRole` を指定（既存 sandbox 画面の踏襲）。

### デバイス・ビルド環境

- **開発環境** — Expo SDK 57、dev client 再ビルド要 （`@react-native-async-storage/async-storage` + `expo-crypto` 追加につき。M2 リリースノート記載）
- **テスト対象の型機** — Android エミュレータ（Pixel 5 / Pixel Tablet 相当）、横画面固定。
- **実機確認の端末** — スマホ（6 インチ程度）・タブレット（10 インチ程度）推奨（上記相当）。

### ビルド・バンドル

- **Metro 設定** — `apps/mobile/metro.config.js` に `game-core` の `.js` エクスポート用シムを追加済み（M2-EX-03 で解決）。
- **expo export** — `npx expo export --platform android` で AAB/APK 相当の出力確認。新ネイティブ依存（AsyncStorage / expo-crypto）の解決も同時確認。
