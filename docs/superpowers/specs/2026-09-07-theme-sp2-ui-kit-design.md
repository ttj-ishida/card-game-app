# デザイン刷新 サブプロジェクト2：マスターデュエル風UIキット 設計書

- 文書ID：GAME-SPEC-THEME-SP2
- 版数：0.2
- 作成日：2026-09-07
- ステータス：**実装完了**（2026-09-07、`547e28e`〜。プラン `docs/superpowers/plans/2026-09-07-theme-sp2-ui-kit.md`）。`Button`/`Chip`/`Panel`/`ScreenTitle` + `resolveButtonVisual`(6 test) を新設、全13画面 + `CardFace` を移行。mobile 356 / ui 8 / game-core 218 テスト緑、tsc・eslint・prettier クリーン。`online-room/play.tsx` の移行分は並行 M4 作業のコミット `27a0c81` に相乗り。目視確認は未実施（要実機）。ACCENT `#C9A94E` / パネル不透明度 0.86 の最終調整は実機目視の結果次第。
- 前提：SP1（`GAME-SPEC-THEME-SP1`、実装完了）。テーマ機構 `useTheme` / `useThemedStyles` / `<AppBackground>` と light/dark トークンが入っている。
- 実装場所：`apps/mobile/src/components/`（新設）、全画面（13ファイル）+ `CardFace`

---

## 1. 目的とスコープ

### 1.1 やること

1. `apps/mobile/src/components/` に**コアUIキット**を新設：`<Button>` / `<Panel>` / `<Chip>` / `<ScreenTitle>`。
2. 意匠は「中間」：深い紺の半透明パネル + 金の細いアクセント線/境界 + 控えめな角丸。RN コアのみ（`react-native-svg` / グラデライブラリは入れない）。
3. 全13画面 + `CardFace` を、手書きの `styles.primary` / `styles.chip` / `styles.panel` 等から新コンポーネントへ移行し、バラつく命名を一掃する。
4. キットのロジック（variant→スタイル解決）を純関数に切り出して単体テスト。コンポーネント自体は薄く保つ（RTL 未導入のため）。

### 1.2 スコープ外

| 項目 | 行き先 |
|---|---|
| 装飾フレーム `<Frame>`、プレイマット、`<FieldSlot>` | SP3（盤面アート） |
| 革命の昼夜逆転バリアント背景・クロスフェード | SP3 |
| カード枠の意匠変更（`CardFace` の見た目） | SP4。SP2 では `CardFace` を新トークン/`<Panel>` の枠組みに合わせる程度 |
| アニメーション（押下トランジション等） | 将来。SP2 は `Pressable` の `opacity` フィードバックのみ |
| 新しいフォント/タイポグラフィスケール | 将来。既存 `typography` トークンを使う |
| dark パレット実値・スクリム濃度の調整 | SP1 の申し送り（実機目視後） |

## 2. Global Constraints

- 依存追加なし。RN コア（`Pressable` / `View` / `Text` / `StyleSheet`）のみ。
- `packages/ui` は触らない（metro シム）。コンポーネントは全て `apps/mobile/src/components/`。
- テストランナーは `tsx --test src/**/*.test.ts`（`.ts` のみ、RTL なし）。コンポーネントの単体テストは**しない**。代わりに variant→style 解決の純関数をテストする。
- 既存の挙動（`onPress`、`disabled`、`accessibilityRole`/`accessibilityState`、`accessibilityLabel`）を欠落させない。移行はビジュアルの等価〜改善に留め、機能回帰ゼロ。
- `apps/mobile` の既存テスト（342）に回帰を出さない。
- コミットは `main` 直、`[THEME-SP2]` 付き、明示パスのみ `git add`。コミット末尾に:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- **並行作業への配慮**：別セッションが `online-room/lobby.tsx` と `onlineRoom*` を編集中のことがある。実装時に working tree を確認し、未コミットなら該当ファイルの移行は最後に回すか一旦スキップして申し送る。

## 3. 意匠（中間トーン）

RN コアで出せる範囲の「マスターデュエル寄り」：

| 要素 | 仕様 |
|---|---|
| Panel 地 | `c.surface.card.face` を**不透明度 0.86** で（背景画像がわずかに透ける）。角丸 `radius.modal`(16)。 |
| Panel 枠 | 上辺だけ金の 2px ライン（`borderTopColor` = アクセント金、他辺は `c.state.disabled` 1px）。「盤の縁」感を最小コストで。 |
| アクセント金 | トークン追加はせず、コンポーネント内定数 `ACCENT = '#C9A94E'`（両テーマ共通。SP1 の `state.warning` とは別、より落ち着いた金）。※将来 `packages/ui` に `accent` を足すかは SP2 後に判断。 |
| Button/primary | 地 `c.ink.primary`、文字 `c.ink.inverse`、角丸 `radius.control`(6)、下辺に 2px の暗い影色（`borderBottomColor`）で厚み表現。 |
| Button/secondary | 地 `c.surface.card.face`×0.86、枠 1px 金、文字 `c.ink.primary`。 |
| Button/ghost | 地なし、文字 `c.ink.secondary`、押下で `c.surface.card.face`×0.5。 |
| Button/danger | secondary と同形、枠と文字を `c.suit.fire`。 |
| Chip | secondary Button の小型版。`selected` で枠 2px 金 + 地 `c.surface.card.face`（不透明）。 |
| ScreenTitle | `typography.size.title` / `weight.bold` / `c.ink.primary`。任意の subtitle は `caption` / `c.ink.secondary`。左に金の 3px 縦バー（`borderLeftWidth`）。 |
| 押下フィードバック | `Pressable` の `style={({pressed}) => [..., pressed && {opacity: 0.85}]}`。`disabled` は `opacity: 0.45`。 |

## 4. コンポーネント API

`apps/mobile/src/components/` 配下。全て default export ではなく named export。バレル `components/index.ts` から再エクスポート。

### 4.1 `Button.tsx`

```ts
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;          // default 'primary'
  disabled?: boolean;
  selected?: boolean;               // アクション選択トグル（play画面のスキルボタン等）
  accessibilityLabel?: string;      // 省略時は label
  minWidth?: number;
  style?: StyleProp<ViewStyle>;     // 外側の微調整（余白のみ想定）
  testID?: string;
};
export function Button(props: ButtonProps): JSX.Element;
```

- `accessibilityRole="button"`、`accessibilityState={{ disabled, selected }}`。
- `selected` は variant を問わず「枠 2px 金」を上掛け。

### 4.2 `Panel.tsx`

```ts
export type PanelProps = {
  children: ReactNode;
  tone?: 'default' | 'flat';        // 'flat' は金トップラインなし（履歴パネル等）
  style?: StyleProp<ViewStyle>;     // gap / padding 上書き
};
export function Panel(props: PanelProps): JSX.Element;
```

### 4.3 `Chip.tsx`

```ts
export type ChipProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};
export function Chip(props: ChipProps): JSX.Element;
```

- `accessibilityRole="button"`、`accessibilityState={{ selected, disabled }}`。

### 4.4 `ScreenTitle.tsx`

```ts
export type ScreenTitleProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;                // 右側の付随要素（更新ボタン等）
};
export function ScreenTitle(props: ScreenTitleProps): JSX.Element;
```

### 4.5 純ロジック `buttonStyle.ts`

```ts
export type ButtonVisual = {
  container: ViewStyle;
  text: TextStyle;
};
export function resolveButtonVisual(
  c: ThemeColors,
  variant: ButtonVariant,
  opts: { disabled: boolean; selected: boolean },
): ButtonVisual;
```

- `buttonStyle.test.ts` で全 variant × (disabled/selected) の組み合わせについて：
  - `container.backgroundColor` / `borderColor` / `text.color` が期待トークン値になる
  - `selected` 時 `borderWidth === 2` かつ `borderColor === ACCENT`
  - `disabled` は視覚のみ（`opacity` は Pressable 側なのでここには出ない）— container/text は非 disabled と同一であることを確認
- `ACCENT` は `buttonStyle.ts` から export し、他コンポーネントも参照。

## 5. 画面移行

### 5.1 置換表

| 旧（各画面バラバラ） | 新 |
|---|---|
| `styles.primary` / `primaryButton` / `actionBtn` / `button` + 対応 `*Text` の `<Pressable><Text/></Pressable>` | `<Button variant="primary" label onPress disabled />` |
| `styles.secondary` / `secondaryButton` + `*Text` | `<Button variant="secondary" … />` |
| `styles.ghost` / `ghostButton` / `actionBtnGhost` + `*Text` | `<Button variant="ghost" … />` |
| 退出・棄権系（`leaveBtn` 等、`suit.fire`） | `<Button variant="danger" … />` |
| `actionBtnSelected` / `pickerCellOn` トグル | `<Button selected … />` または `<Chip selected … />` |
| `styles.chip` + `chipText` + `chipSelected` | `<Chip label onPress selected disabled />` |
| 画面見出しの `<Text style={styles.title}>` (+ subtitle) | `<ScreenTitle title subtitle right />` |
| パネル `<View style={styles.panel}>` / `oppPanel` / `round` / `section`（枠付き） | `<Panel>` / `<Panel tone="flat">` |

### 5.2 手順（1画面ずつ）

1. `import { Button, Chip, Panel, ScreenTitle } from '../../components';`（相対パスは画面位置に応じて）。
2. JSX 内の該当ブロックをコンポーネントに置換。`onPress` / `disabled` / `accessibilityLabel` はそのまま渡す。
3. `makeStyles` から不要になったキー（`primary` / `primaryText` / `chip` / `chipText` / `panel` …）を削除。レイアウト系（`row` / `actions` / `content` / `gap`）は残す。
4. `colors` 由来がコンポーネント内へ移ったので、画面の `makeStyles` が空に近くなるならそれで良い（`screen: { flex: 1 }` のみ等）。使わなくなったら `useThemedStyles` / `ThemeColors` import も削除。
5. `npx tsc --noEmit` / 対象ファイルの `eslint` / `prettier --write`。

### 5.3 バッチ

- 7a: `index` / `online-room/index` / `cpu-game/setup` / `cpu-game/result`（ボタン中心、軽い）
- 7b: `cpu-game/play` / `online-room/play`（ボタン・チップ・パネル大量）
- 7c: `cpu-game/{history,stats,settings,tutorial}` / `catalog` / `diagnostics` / `sandbox` / `join`
- 7d: `online-room/lobby`（並行作業とバッティングするので最後・要確認）
- `CardFace`：`<Panel>` は使わず、内部の枠を `ACCENT` 基調へ寄せるだけ（SP4 で本格対応）。

各バッチ後 `npm test` + `tsc` + 目視（可能なら `/run`）→ コミット。

## 6. テスト計画

| 種別 | 対象 | 場所 |
|---|---|---|
| 単体 | `resolveButtonVisual` 全 variant×state | `components/buttonStyle.test.ts`（新） |
| 回帰 | `npm run mobile:test`（342）、`ui:test`、`game-core:test` | ローカル実行 |
| 静的 | `mobile:typecheck` / `mobile:lint` / `mobile:format:check` | ローカル実行 |
| 目視 | ホーム / CPU対戦 / カタログ / 設定 を light・dark 双方で | `/run` → `SendUserFile` |
| grep | `grep -rnE "styles\.(primary|secondary|ghost|chip|actionBtn)" src/app` がゼロ | Task 完了時 |

## 7. 実装順序

1. `components/buttonStyle.ts`（`ACCENT` / `resolveButtonVisual`）+ `buttonStyle.test.ts`。
2. `components/Button.tsx` / `Chip.tsx` / `Panel.tsx` / `ScreenTitle.tsx` + `components/index.ts`。
3. 画面移行バッチ 7a → 7b → 7c → 7d。
4. `CardFace` の枠を `ACCENT` 基調へ。
5. 総合検証 + スペックのステータス更新 + メモリ更新。

## 8. 未解決 / レビュー確認事項

1. アクセント金 `#C9A94E` の色味（実機で浮かないか）。トークン化（`packages/ui` に `accent`）は SP2 完了後に判断。
2. Panel の 0.86 不透明度で背景画像が透ける演出を許容するか（可読性が主目的なら不透明でも可）。
3. `<Button>` は `label` 文字列 API とするか `children` を許すか。本書は `label`（多言語キーは呼び出し側で `translate` 済みを渡す）。
