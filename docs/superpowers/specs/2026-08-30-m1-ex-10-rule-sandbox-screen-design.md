# M1-EX-10 ルールサンドボックス画面 設計

- 文書ID: SPEC-M1-EX-10
- 日付: 2026-08-30
- 対象TODO: M1-EX-10「任意状態を編集できるルールサンドボックス画面を作る」
- 依存: M1-EX-09（`resolvePlay` 完了済み）
- 基準文書: `独自カードゲーム_要件定義書_v0.2.md`（§8〜§14）、`独自カードゲーム_横断マイルストーン_TODO_v0.2.md`（§5）、`docs/qa/M1-QA-03-rule-verification-checklist.md`

## 1. 目的と位置づけ

**開発者用のデバッグ盤面**である。実ゲームの初期設定画面ではない（それは M2-EX-04 / M4-EX-01、対局画面は M2-EX-05）。

横断マイルストーン §5.1:「通信やCPUを入れる前に、任意の手札・場・昼夜・効果を設定し、合法／不正判定と状態変化を目視できるデバッグ用対局盤面を完成させる。」

達成すべきこと:
- 開発者が任意の局面を組み、1手入力し、`resolvePlay` の判定結果と遷移後の盤面を目視できる。
- M1-GR の仮素材が示す全状態（昼夜・属性ロック・追加封印・Joker宣言など）を、色以外でも判別できる形で盤面に表示する。
- QA-03 チェックリストの代表ケースを画面操作で再現する土台になる。

公開範囲は内部のみ（M1 リリース地点「ルール検証版」）。プレイヤー導線からは開発用ラベル付きで暫定的に繋ぐ。

## 2. スコープ

### 2.1 編集できる局面（RoundState）

| 項目 | 編集UI |
|---|---|
| 昼夜 `dayNight` | 昼／夜トグル |
| プレイヤー人数 | 2〜6人セレクタ |
| 手番 `activePlayerId` | プレイヤー選択 |
| 各プレイヤーの手札 `hand` | 1〜9 × 火/水/風/土 のカードをタップで追加／削除（`cardId` 一意） |
| 各プレイヤーのスキル `skill` | なし／勇者Joker／聖女Joker／追加封印／革命、使用済みトグル |
| 各プレイヤーの `status` | ACTIVE／PASSED／OUT |
| 場 `activeField` | カード列＋最終出し手。組み合わせは `parseNumberCombination` で自動解析 |
| 属性ロック `lockedSuitCode` | なし／火／水／風／土 |
| 追加封印 `extensionSealed` | ON／OFF |
| 連続パス数 `consecutivePasses` | 整数入力 |
| 捨て札 `discardPile` | カード列の追加／削除 |

### 2.2 編集できる入力プレイ（PlayInput）

手番プレイヤー（`activePlayerId`）が行う。

| 項目 | 選択肢 |
|---|---|
| 種別 | パス／カードを出す |
| 出す数字カード | 手番プレイヤーの手札から複数選択 |
| 使用スキル | なし／追加封印／革命／変化Joker／場流しJoker（保有・未使用時のみ、1手番1枚） |
| 変化Joker宣言 | 数字1〜9 ＋ 属性1種（変化Joker選択時） |
| 場流しJokerの継続リード | 出す数字カードと同じUI（場を流した直後に同一手番で出すカード） |

### 2.3 表示のみ

`resolvePlay` の戻り値 — `outcome`（actionKind / fieldCleared / naturalRevolution / dayNightAfter / winnerId）、拒否理由 `reason`、更新後の `RoundState`。

### 2.4 スコープ外（YAGNI）

- 端末への状態保存（AsyncStorage）。起動ごとリセットで十分。
- SVG の直接描画。ネイティブ描画で表現する（§8）。
- 1手番で変化Joker宣言を2枚出す組み合わせ（1プレイヤー＝スキル1枚のモデル制約。ヘルパー層でテスト済み）。
- アニメーション・演出、英語リソース。

## 3. 画面構成（案A：横画面1枚のパネル盤面）

1画面を4領域に分割する。横画面では ① と ② を左右2カラム、③ と履歴を下段に置く。

- **ツールバー**: タイトル「ルールサンドボックス（開発用）」／プリセット選択／1手戻す／初期化
- **① 盤面（状態エディタ）**: §2.1 の全項目。カード・昼夜・トグルはタップ、手番・スキル・status・ロック・最終出し手はドロップダウン。
- **② プレイ入力（手番 = P?）**: §2.2 の項目 ＋「実行」ボタン。
- **③ 結果**: 「合法／不正」バッジ、不正なら日本語理由、合法なら種別と outcome バッジ（自然革命・場流し・勝者）。実行後、① の盤面が遷移後 `RoundState` へ再描画される。
- **履歴**: 適用済みプレイの一覧。

編集 → 実行 → ① の再描画を目視 → また編集、のループを最短にする。

## 4. アーキテクチャ

M0 カタログ画面のパターンを踏襲する（判定ロジックは純粋モジュール、状態は zustand、画面は薄いビュー、テストは `.test.ts` のみ）。

```
apps/mobile/src/
  features/rule-sandbox/
    sandboxModel.ts        純粋関数：初期局面・編集操作・プレイ組立・結果整形
    sandboxModel.test.ts
    sandboxPresets.ts      QA-03 / T-RULE 由来のプリセット（純粋データ）
    sandboxPresets.test.ts
  state/
    ruleSandboxStore.ts    zustand：draft(RoundState) + playDraft + lastResult + history
    ruleSandboxStore.test.ts
  app/sandbox/index.tsx    案Aの盤面ビュー（ロジックなし）
```

データフロー:

```
ユーザ操作 ─▶ store アクション ─▶ sandboxModel の純粋関数 ─▶ 新しい draft(RoundState)
「実行」   ─▶ store.applyPlay() ─▶ buildPlayInput(playDraft)
                               ─▶ resolvePlay(draft, play)   ← 既存・テスト済み
                               ─▶ 合法: draft を outcome.state へ、history に push
                                  不正: draft 据え置き、lastResult に reason
                               ─▶ describeResolution() で表示用 DTO（i18nキー）へ
```

`resolvePlay` を呼ぶのは `sandboxModel` / `store` のみ。画面は購読して描画するだけ。

## 5. game-core / ui 連携（新規インフラ）

mobile バンドルは現状 `packages/*` を参照していない。最小差分でモノレポ解決を追加する。

- `apps/mobile/metro.config.js`（新規）:
  - `getDefaultConfig(projectRoot)` を基に
  - `config.watchFolders = [<repo>/packages]`
  - `config.resolver.extraNodeModules = { '@card-game-app/game-core': <repo>/packages/game-core, '@card-game-app/ui': <repo>/packages/ui }`
- `apps/mobile/tsconfig.json` に `baseUrl: "."` と `paths` を追加し、`@card-game-app/game-core` → `../../packages/game-core/src/index.ts`、`@card-game-app/ui` → `../../packages/ui/src/index.ts`。

`packages/game-core` は依存ゼロ・単一ファイル・相対 import なしなので副作用は出ない。`package.json` / `package-lock.json` は変更しない。Metro が `.ts` の `main` を解決できない場合のフォールバックは `"@card-game-app/game-core": "file:../../packages/game-core"` を dependencies に追加する方式（lockfile 再生成が必要）。

## 6. 状態モデル（`sandboxModel.ts`）

### 6.1 型

```
type PlayDraft = {
  kind: 'PASS' | 'PLAY';
  cardIds: string[];
  useSkill?: 'EXTENSION_SEAL' | 'REVOLUTION' | 'JOKER_TRANSFORM' | 'JOKER_CLEAR';
  jokerDeclaration?: { rankCode: RankCode; suitCode: SuitCode };
};

type ResolutionView = {
  ok: boolean;
  reasonKey?: string;                 // 'sandbox.reason.<REASON>'
  actionKey?: string;                 // 'sandbox.action.<LEAD|EXTEND|REPLACE|PASS>'
  badges: Array<'naturalRevolution' | 'fieldCleared' | 'winner'>;
  winnerId?: string;
};
```

### 6.2 初期局面

`createInitialRound()` — 2人、分かりやすい手札（例 P1: 3火/4水/8火、P2: 5風/6土/7水）、スキルなし、場なし、昼、手番P1。`createRoundState` で生成。

### 6.3 編集操作（すべて「現 RoundState → 新 RoundState」の純粋関数）

`setDayNight` / `setPlayerCount` / `setActivePlayer` / `addCardToHand` / `removeCardFromHand` / `setPlayerSkill` / `setPlayerSkillUsed` / `setPlayerStatus` / `setFieldCards` / `setFieldLastPlayer` / `clearField` / `setLockedSuit` / `setExtensionSealed` / `setConsecutivePasses` / `addDiscard` / `removeDiscard`

不変条件の保ち方:
- 人数を減らすと余った席（手札・スキル）を破棄。増やすと空手札の席を追加。
- カード追加は同一 `cardId`（rank+suit の組）重複を拒否。手札・場・捨て札を横断して同一 `cardId` が2箇所に出ないようにする（追加時に既存を除去）。
- 手番プレイヤーを人数変更で失った場合、先頭席へ寄せる。
- `setFieldCards` は `parseNumberCombination` が `null` を返す組では確定させず、エディタ側で「無効」表示にする。

### 6.4 プレイ組立・結果整形

- `buildPlayInput(activePlayerId, playDraft): PlayInput`
- `describeResolution(resolution): ResolutionView` — `reason` の全値と outcome の全バッジに対応する i18n キーを返す（テストで網羅を保証）。

## 7. プリセット（`sandboxPresets.ts`）

`docs/qa/M1-QA-03-rule-verification-checklist.md` の T-RULE-001〜022 に対応する22件を、`{ id, titleKey, round: RoundState, play?: PlayDraft }` の純粋データ配列で定義する。`ruleAcceptance.test.ts` と同じ局面・同じ期待になるよう、テストで代表数件の `resolvePlay` 結果を照合する。

## 8. 仮素材の描画方針

M0-QA-01 の判断（「React NativeでのSVG画像直接描画は導入しない」）を踏襲し、`react-native-svg` は導入しない。`packages/ui` のデザイントークンを使った View/Text のネイティブ描画で表現する。

- 数字カード: ミニカード（数字を大きく、属性を「火/水/風/土」の文字＋トークン色の枠）。変化Joker由来のカードは「J」バッジ付き。
- 昼夜: ラベル付きピル（「昼」「夜」）＋トークン背景色（`surface.table.day` / `night`）。色なしでも文字で判別可。
- 属性ロック: 「ロック: 火」チップ（属性文字＋色）。
- 追加封印: 「追加封印」チップ。
- 自然革命・場流し・勝者: 結果バッジ（文字）。

M1-GR の49個の SVG は設計仕様として残り、M6 で実描画する。

## 9. 画面状態一覧（成果物）

| 状態 | 内容 |
|---|---|
| 初期 | 既定局面。履歴空の案内 |
| 編集中 | 各エディタ操作を即時反映 |
| 実行結果（合法） | 「合法 · 種別」＋ outcome バッジ、盤面が遷移後へ更新 |
| 実行結果（不正） | 「不正」＋日本語理由、盤面は据え置き |
| 編集警告 | 場のカード列が組み合わせとして無効（`parseNumberCombination` が `null`）なとき警告表示し、場を確定させない |
| 空 | 履歴なし時に「1手戻す」を無効表示 |
| ローディング | 同期動作のため該当なし（本表に明記して DoD の主旨を満たす） |

## 10. i18n・アクセシビリティ・横画面

- 表示文字列はすべて `jaDictionary` に `sandbox.*` キーとして追加。`translate.test.ts` の必須キー一覧に追記。
- 属性・状態は色だけに依存せず、必ず文字ラベルを併記。
- 主要操作（カード選択、追加、削除、実行、パス、Undo）に `accessibilityRole` / `accessibilityLabel` / `accessibilityState` を付与。フォーカス順は「盤面 → プレイ入力 → 実行 → 結果」。
- `app.json` は `orientation: landscape` 済み。2カラムは横画面前提でレイアウトし、縦割れ時は縦積みにフォールバック。

## 11. テスト戦略

`.test.ts` のみ実行される（`react-test-renderer` なし）。ロジックを純粋モジュールに寄せて網羅する。

- `sandboxModel.test.ts`
  - 初期局面が妥当な `RoundState`。
  - 各編集操作が不変条件を保つ（人数2〜6のクランプ、`cardId` 一意、手番は実在プレイヤー、無効な場を確定させない）。
  - `buildPlayInput` が各種別・スキル・宣言を正しく組む。
  - `describeResolution` が `reason` 全値・outcome 全バッジに対し存在する i18n キーを返す。
- `sandboxPresets.test.ts`
  - 22プリセットの `round` が妥当。代表数件で `resolvePlay(round, play)` の合法性・理由が `ruleAcceptance.test.ts` と一致。
- `ruleSandboxStore.test.ts`
  - `applyPlay` 合法時に `draft` 更新＋`history` push。不正時に `draft` 据え置き＋`lastResult` に理由。
  - `undo` / `reset` / `loadPreset` の動作。
- `translate.test.ts`
  - `sandbox.*` 必須キーの存在。

## 12. 検証手順（M0 踏襲）

自動:
- `npm run mobile:test` / `npm run mobile:typecheck` / `npm run mobile:lint` / `npm run mobile:format:check`
- `npm run game-core:test` / `npm run game-core:typecheck`（変更なしの確認）
- `npx expo export --platform android --output-dir dist`（バンドル成立）

目視（成果物「実機確認記録」— 開発者が実施）:
- Android 相当・タブレット相当の横画面で、QA-03 チェックリストの代表ケースをプリセットから読み込み、1手入力して結果と遷移後盤面を確認。
- 文字拡大・読み上げ順を確認。

## 13. 新規・変更ファイル

新規:
- `apps/mobile/src/features/rule-sandbox/sandboxModel.ts` ＋ `.test.ts`
- `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts` ＋ `.test.ts`
- `apps/mobile/src/state/ruleSandboxStore.ts` ＋ `.test.ts`
- `apps/mobile/src/app/sandbox/index.tsx`
- `apps/mobile/metro.config.js`
- `docs/progress/M1-EX-10.md`（完了時）

変更:
- `apps/mobile/src/i18n/translate.ts`（`sandbox.*` キー）
- `apps/mobile/src/i18n/translate.test.ts`（必須キー追記）
- `apps/mobile/src/app/_layout.tsx`（`sandbox/index` ルート登録）
- `apps/mobile/src/app/index.tsx`（開発用導線ボタン）
- `apps/mobile/tsconfig.json`（`baseUrl` / `paths`）

## 14. 完了条件との対応

| 完了条件 | 対応 |
|---|---|
| 任意ケースをUIから再現できる | §2.1/§2.2 の全項目編集 ＋ §7 プリセット |
| デバッグ画面から昼夜・手札・場・属性ロック・追加封印を設定できる（横断§5.2） | §2.1 |
| 仮素材で全状態を判別できる（横断§5.2） | §8 ネイティブ描画、色以外でも判別 |
| Expo画面にローディング・空・エラー状態がある（DoD） | §9 画面状態一覧 |
| 表示文字列が言語リソースキーから取得される（DoD） | §10 |
| 主要ロジックに自動テストがある（DoD） | §11 |
| 受入手順を別環境で再現できる（DoD） | §12 |
| エラー時に中途半端な状態を残さない（DoD） | `resolvePlay` の原子性（M1-EX-09）＋不正時 `draft` 据え置き |
