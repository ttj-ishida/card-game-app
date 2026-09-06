# デザイン刷新 サブプロジェクト1：テーマ基盤 + ダークトークン + 背景コンポーネント 設計書

- 文書ID：GAME-SPEC-THEME-SP1
- 版数：0.2
- 作成日：2026-09-07
- 背景：遊戯王マスターデュエルのデュエルフィールドを参照したダーク基調へアプリ全体を刷新する取り組み。全体像は「デザイン刷新サブプロジェクト分解」（本文 §1.1）。
- 対象アセット：`assets/backgrounds/ragnarok-{battle-bg,home-bg,bg-universal}{,-day}.png`（dark 3枚コミット済み `2bbfa84`、day 3枚は本サブプロジェクトで追加。詳細は `assets/backgrounds/README.md`）
- 版数 0.2 の変更点：§8 のレビュー確定を反映（§4.4 案C＝ライト用「昼」背景を採用 / §4.5・§4.6 を 6アセット出し分けに更新 / OS不明時ダーク固定 / 生 hex 暫定トークン化）
- 実装場所：`packages/ui/src/`、`apps/mobile/src/features/theme/`（新設）、`apps/mobile/src/state/`、`apps/mobile/src/app/`（全画面 + `_layout.tsx`）

---

## 1. 目的とスコープ

### 1.1 全体像（分解）

| # | サブプロジェクト | 内容 | 依存 |
|---|---|---|---|
| **SP1（本書）** | テーマ基盤 + ダークトークン + 背景 | `ThemeProvider`/`useTheme()`、light/dark トークンセット、OS追従＋アプリ内上書き＋永続化、`<AppBackground>`、3グループへの配線。既存画面は新トークンに追従してダークが端から端まで動く | なし |
| SP2 | マスターデュエル風UIキット | `<Button>` `<Panel>` `<Chip>` `<Frame>` を金×紺の意匠で新設し各画面を移行 | SP1 |
| SP3 | 対戦盤面アート | プレイマット/フィールド枠、革命バリアント背景＋クロスフェード、革命時の盤面演出 | SP1（SP2推奨） |
| SP4 | カード枠リデザイン | M0仮SVGカードを新意匠へ置換 | SP2 |

### 1.2 SP1 がやること

1. `packages/ui/src/tokens.ts` に **light（現行 = day 相当）と dark の2セット**を用意し、型で同一形状を保証する。
2. `apps/mobile` に **テーマ機構**を新設：
   - `ThemePreference = 'system' | 'light' | 'dark'` の純モジュール（parse/serialize/デフォルト）
   - `themeStore`（zustand、AsyncStorage 永続化、`cpuGameSettingsStore` と同じ形）
   - `resolveScheme(pref, osScheme)` 純関数
   - `ThemeProvider` + `useTheme()` + `useThemedStyles(factory)`
3. 全画面と `_layout.tsx` の `StyleSheet.create({...})`（モジュールスコープ、`colors.*` 直参照）を **`makeStyles` ファクトリ**へ機械的に移行し、テーマ切替でリレンダーされるようにする。
4. `<AppBackground variant="battle" | "home" | "universal">` を新設し、対戦・ホーム/ロビー・その他へ配線。
5. 設定画面（`cpu-game/settings.tsx`）に **テーマ切替（システム / ライト / ダーク）** の行を追加。
6. `packages/ui` トークン網羅テスト、テーマ解決・永続化のユニットテスト、既存回帰ゼロ。

### 1.3 スコープ外

| 項目 | 行き先 |
|---|---|
| `<Button>` `<Panel>` `<Chip>` `<Frame>` 等の新コンポーネント | SP2 |
| 金の装飾・グラス風パネル・フレーム意匠 | SP2 |
| プレイマット/フィールド枠アート | SP3 |
| 革命バリアント背景・クロスフェード・昼夜逆転演出 | SP3 |
| カード（`CardFace`）の意匠変更 | SP4（SP1 では新トークンに追従して色だけ変わる） |
| ライト用「昼」背景の**追加調整・作り直し** | 初版3枚は本SPで用意済み。意匠のブラッシュアップは SP3 の盤面アートに合流可 |
| `@ragnarok-millennium/ui` の `.js` バレル問題 / metro ui シム除去 | 別件（本書は metro シムを温存し、テーマ機構は `apps/mobile` 側に置く） |

## 2. Global Constraints

- `packages/ui` は依存を追加しない（`tokens.ts` は値と型のみ、副作用なし）。テーマの状態・React・ストレージは全て `apps/mobile` 側。
- `metro.config.js` の `@ragnarok-millennium/ui` → `packages/ui/src/tokens.ts` シムは**変更しない**。したがって新トークンは `tokens.ts` 内に置き、`index.ts` バレルには手を入れない。
- 既存の公開名 `colors` / `spacing` / `radius` / `typography` / `card` / `designTokens` は**シグネチャ・値ともに現状維持**（`colors` は light セットそのもの）。既存の直 import（11ファイル）はビルドを壊さずに動き続ける。
- テーマ切替は**再マウントなし**で反映される（Context + `useThemedStyles` のメモ化キーに scheme を含める）。
- 永続化は `storagePort`（AsyncStorage）経由。キーは `card-game-app:theme-preference:v1`。
- 純モジュール（`features/theme/themePreference.ts`）は React にもストレージにも依存しない。`node:test` + `tsx` で単体テスト可能。
- `apps/mobile` の既存テスト（約180件）と `packages/ui` の既存テストに回帰を出さない。
- コミットは `main` 直、`[THEME-SP1]` 付き、明示パスのみ `git add`（`git add -A` 禁止）。
- 画面移行は**見た目の等価性を保つ**：light テーマでの各画面は移行前後でピクセルが実質同一（トークン値は不変で参照方法だけが変わる。例外は §5.1 で生 hex をトークンへ寄せた箇所のみ、かつ僅差に留める）。

## 3. トークン層（`packages/ui/src/tokens.ts`）

### 3.1 形

```ts
// 既存 colors をそのまま light パレットとして残す（キー・値とも不変）
export const colors = { /* 現行のまま */ } as const;

export type ThemeColors = typeof colors;   // 形の正
export type ThemeScheme = 'light' | 'dark';

// dark は colors と完全に同一の形（深いキーまで）。値のみ差し替え。
export const darkColors: ThemeColors = {
  surface: {
    table:  { day: '#12161C', night: '#0B0E14' }, // ダーク時の卓（§3.2）
    card:   { face: '#1B2028', back: '#0E1116' },
  },
  ink:  { primary: '#EDE6D6', secondary: '#A7AEB8', inverse: '#12161C' },
  suit: { fire: '#F06A4A', water: '#4FA0DE', wind: '#57B98F', earth: '#C39A4E' }, // 暗背景で沈まないよう明度＋
  state:{ warning: '#E0A32B', disabled: '#4A525C' },
} as const;

export const themeColors: Record<ThemeScheme, ThemeColors> = {
  light: colors,
  dark: darkColors,
};
```

- `radius` / `spacing` / `typography` / `card` はテーマ非依存。据え置き。
- `darkColors` の実値は §3.2 のたたき。実装時に `<AppBackground>` の上で AA コントラストを満たすか目視 + 計算で確認し、必要なら微調整（値の微修正はスペック改訂不要）。

### 3.2 dark パレットの意図

| トークン | light（現行） | dark（案） | 意図 |
|---|---|---|---|
| `surface.table.day` | `#EEF5F1` | `#12161C` | 画面の素地。背景画像の上に敷くスクリム兼フォールバック |
| `surface.table.night` | `#17202A` | `#0B0E14` | さらに沈めた面 |
| `surface.card.face` | `#FAF8F0` | `#1B2028` | パネル・カード面。背景から浮く最小限の明度差 |
| `surface.card.back` | `#2E3147` | `#0E1116` | カード裏 |
| `ink.primary` | `#1B1D24` | `#EDE6D6` | 主要テキスト（羊皮紙寄りのオフホワイト） |
| `ink.secondary` | `#3B4148` | `#A7AEB8` | 副次テキスト |
| `ink.inverse` | `#F5F2E8` | `#12161C` | 明色ボタン上の文字 |
| `suit.*` | 現行 | 明度＋ややビビッド | 暗背景で識別を保つ |
| `state.warning` | `#C28A18` | `#E0A32B` | 警告帯 |
| `state.disabled` | `#8B9098` | `#4A525C` | 無効・境界線 |

> 注：`state.warning` は「色のみに意味を持たせない」規約（Art Direction Board）を維持。ラベル併記は各画面の既存実装のまま。

### 3.3 `tokens.test.ts` 追加

- `darkColors` が `colors` と**同一のキー集合**（深いパスまで）を持つ。
- `themeColors.light === colors`、`themeColors.dark === darkColors`。
- 全 `ink` / `surface` / `state` 値が `#RRGGBB` 形式。
- （軽量コントラスト）`ink.primary` on `surface.card.face` が両テーマで WCAG AA（4.5:1）以上 — 小さなヘルパを test 内に置く。

## 4. テーマ機構（`apps/mobile/src/features/theme/`）

### 4.1 `themePreference.ts`（純）

`cpuGameSettings.ts` と同じ作法：

```ts
export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_PREFERENCE_STORAGE_KEY = 'card-game-app:theme-preference:v1';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
export function parseThemePreference(raw: string | null): ThemePreference;   // 不正 → default
export function serializeThemePreference(p: ThemePreference): string;        // JSON `{ "preference": p }`
export function resolveScheme(
  pref: ThemePreference,
  osScheme: 'light' | 'dark' | null,
): 'light' | 'dark';   // 'system' → osScheme ?? 'dark'（OS不明時はダーク既定）
```

- 単体テスト：3×3 の pref×os マトリクス、`null` os、不正 raw、round-trip。

### 4.2 `themeStore.ts`（zustand）

`cpuGameSettingsStore` を踏襲：

```ts
type ThemeStoreState = {
  status: 'loading' | 'ready' | 'failed';
  preference: ThemePreference;
  load: () => Promise<void>;
  setPreference: (p: ThemePreference) => Promise<void>;
};
export function configureThemeStore(deps: { storage: StoragePort }): void;
```

- `load()`：`storage.getItem` → `parseThemePreference` → state。失敗は `status:'failed'` + `DEFAULT`。
- `setPreference()`：楽観更新 → `storage.setItem(serialize())`。失敗はログのみ（次回起動で復元）。
- `_layout.tsx` の既存 `try { configure… }` ブロックに `configureThemeStore({ storage: deps.storage })` を追加。`useEffect` の初回で `void themeStore.getState().load()`。

### 4.3 `ThemeProvider` / `useTheme` / `useThemedStyles`

```ts
// ThemeContext value
type ThemeContextValue = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  preference: ThemePreference;
};
```

- `ThemeProvider`（`_layout.tsx` で `<Stack>` を包む）：
  - `useColorScheme()`（RN）で OS スキーム購読。
  - `useStore(themeStore, s => s.preference)` で嗜好購読。
  - `scheme = resolveScheme(preference, osScheme)`、`colors = themeColors[scheme]`。
  - `themeStore.status === 'loading'` の間は `resolveScheme('system', os)` で暫定描画（チラつき回避、ブロックしない）。
- `useTheme(): ThemeContextValue`。
- `useThemedStyles<T>(factory: (c: ThemeColors) => T): T`
  - `useMemo(() => StyleSheet.create(factory(colors)), [scheme])`。
  - 依存は `scheme` のみ（`colors` はスキームごとに安定参照）。

### 4.4 ライトテーマ時の背景（レビュー確定：案C）

ライト（昼）テーマ用に「昼」バリアント背景を3枚用意済み（`*-day.png`）。`<AppBackground>` は
`variant × scheme` で 6枚を出し分ける。両テーマともマスターデュエル風の世界観を保つ。

- day 画像はライトUI（濃色テキスト `ink.primary` = `#1B1D24`）が乗る前提で明るく作ってある。
- スクリムはテーマで向きが逆：dark は暗いスクリム、light は薄い**明るい**スクリムで文字の下地を整える（§4.5）。

### 4.5 `<AppBackground>`

```tsx
type Variant = 'battle' | 'home' | 'universal';
function AppBackground({ variant, children }: { variant: Variant; children: ReactNode }): JSX.Element;
```

- 常に `ImageBackground`（RN コア。`expo-image` は未導入なので使わない）
  - `source` は `variant × scheme` で 6枚から選択（`resolveBackgroundSource(variant, scheme)`）
  - `resizeMode="cover"`、`style={{ flex: 1 }}`
  - 上に**スクリム** `View`（`StyleSheet.absoluteFill`）。テーマで色が反転する：
    | variant | dark スクリム | light スクリム |
    |---|---|---|
    | battle | `rgba(11,14,20,0.42)` 均一 | `rgba(244,240,230,0.40)` 均一 |
    | home | 上 `rgba(11,14,20,0.28)` / 下 `0.52` の2枚 | 上 `rgba(244,240,230,0.20)` / 下 `0.45` の2枚 |
    | universal | `rgba(11,14,20,0.50)` | `rgba(244,240,230,0.55)` |
  - グラデはコア RN のみ（`react-native-linear-gradient` 未導入）なので**重ね `View` 2枚**で近似。
  - スクリム値は実装時に主要画面で目視調整（微修正はスペック改訂不要）。
- `require` の相対パスが深い問題 → `apps/mobile/src/features/theme/backgroundAssets.ts` に集約：
  ```ts
  export const backgroundAssets = {
    dark: {
      battle: require('../../../../../assets/backgrounds/ragnarok-battle-bg.png'),
      home: require('../../../../../assets/backgrounds/ragnarok-home-bg.png'),
      universal: require('../../../../../assets/backgrounds/ragnarok-bg-universal.png'),
    },
    light: {
      battle: require('../../../../../assets/backgrounds/ragnarok-battle-bg-day.png'),
      home: require('../../../../../assets/backgrounds/ragnarok-home-bg-day.png'),
      universal: require('../../../../../assets/backgrounds/ragnarok-bg-universal-day.png'),
    },
  } as const;
  export const resolveBackgroundSource = (v: Variant, s: ThemeScheme) => backgroundAssets[s][v];
  ```
  - Metro は `assets/backgrounds/*.png` を素で解決する（`react-native-svg` 不要、PNG はコア対応）。`assets/` は monorepo ルート配下で Metro の `watchFolders` に含まれる（既存 `assets/runtime/**/*.svg` を `require` 済みという事実で確認済み）。
- アクセシビリティ：背景は `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` は付けない（子が本文）。画像自体は装飾なので `accessible={false}`。

### 4.6 画面への配線

| 画面 | variant |
|---|---|
| `app/cpu-game/play.tsx` | battle |
| `app/online-room/play.tsx` | battle |
| `app/index.tsx`（ホーム） | home |
| `app/online-room/index.tsx` | home |
| `app/online-room/lobby.tsx` | home |
| `app/join.tsx` | universal |
| `app/catalog/index.tsx` | universal |
| `app/diagnostics/index.tsx` | universal |
| `app/sandbox/index.tsx` | universal |
| `app/cpu-game/setup.tsx` / `result.tsx` / `history.tsx` / `stats.tsx` / `settings.tsx` / `tutorial.tsx` | universal |

- 各画面：最外の `ScrollView`/`View` を `<AppBackground variant=…>` で包み、内側コンテナの `backgroundColor` を除去（スクリムが担う）。`contentContainerStyle` の余白・レイアウトは不変。

### 4.7 `_layout.tsx`

- ハードコード `#111827` / `#f9fafb` / `#f8fafc` を撤去し、`useTheme()` から：
  ```ts
  screenOptions={{
    headerStyle: { backgroundColor: colors.surface.card.back },
    headerTintColor: colors.ink.primary,
    contentStyle: { backgroundColor: colors.surface.table.day },
  }}
  ```
- `<ThemeProvider>` で `<Stack>` を包む。`expo-status-bar` の `<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />` を追加。

## 5. 画面のスタイル移行（機械的）

### 5.1 パターン

Before（モジュールスコープ、テーマ非対応）:
```ts
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.table.day },
  title: { color: colors.ink.primary, /* … */ },
});
```
After:
```ts
const makeStyles = (c: ThemeColors) => ({
  screen: { flex: 1 },                    // 背景色は <AppBackground> へ移動
  title: { color: c.ink.primary, /* … */ },
});
// コンポーネント内
const styles = useThemedStyles(makeStyles);
```

- `colors.` → `c.` の単純置換 + `StyleSheet.create` を `useThemedStyles(makeStyles)` に。
- `spacing` / `radius` / `typography` は `@ragnarok-millennium/ui` から従来どおり直 import（テーマ非依存）。
- `backgroundColor: colors.surface.table.day`（画面素地）は削除、`<AppBackground>` が担当。パネル等の `backgroundColor: colors.surface.card.face` は `c.surface.card.face` として残す。
- 生 hex（`app/index.tsx` の `#166534` ボタン等）→ 近いトークンへ寄せる（`#166534` → `c.suit.wind` 相当、`#f8fafc`/`#111827` → トークン）。ボタンの意匠自体は SP2 で作り直すため、SP1 では「トークンに寄せて両テーマで破綻しない」までとする。

### 5.2 対象ファイル（14）

`_layout.tsx` ＋ §4.6 の全画面。`CardFace.tsx` は色トークン参照があれば同様に移行（意匠は変えない）。

### 5.3 リスク

- `useThemedStyles` はフックなので、`StyleSheet.create` をコンポーネント外で使っている非コンポーネント関数があれば要調整。→ 実装時に grep で洗い出し（現状 grep では全て画面コンポーネント内）。
- `zustand` の `useStore` セレクタ増加による再レンダー → `preference` と `osScheme` のみ購読、`scheme` 派生は `useMemo`。

## 6. テスト計画

| 種別 | 対象 | 場所 |
|---|---|---|
| 単体 | `resolveScheme` マトリクス、`parse/serializeThemePreference` | `features/theme/themePreference.test.ts`（新） |
| 単体 | `themeStore` load/setPreference（storage スタブ） | `state/themeStore.test.ts`（新） |
| 単体 | `darkColors` キー網羅・hex 形式・AA コントラスト | `packages/ui/src/tokens.test.ts`（追記） |
| 単体 | `resolveBackgroundSource(variant, scheme)` が 6枚を正しく引く | `features/theme/backgroundAssets.test.ts`（新） |
| 回帰 | 既存 `npm run -w … mobile:test` 全緑、`ui:test`、`game-core:test` | CI 相当をローカル実行 |
| 目視 | 主要3画面（ホーム / CPU対戦 / カタログ）を light/dark 双方でスクリーンショット | `/run` で Expo 起動、`SendUserFile` で提出 |

- RTL（`@testing-library/react-native`）は未導入。`<AppBackground>` のロジックは `resolveBackgroundSource` に寄せて単体テスト、コンポーネント自体は薄く保つ。

## 7. 実装順序（プラン化の目安）

1. `packages/ui/tokens.ts`：`darkColors` / `themeColors` / 型 + `tokens.test.ts`。
2. `features/theme/themePreference.ts` + テスト。
3. `state/themeStore.ts` + テスト + `_layout.tsx` の configure/load 配線。
4. `features/theme/ThemeProvider.tsx`（`useTheme` / `useThemedStyles`）+ `_layout.tsx` を包む・header をトークン化。
5. `features/theme/backgroundAssets.ts` + `AppBackground.tsx` + `resolveBackgroundSource` テスト。
6. 画面移行を小分けで（a: ホーム系 / b: 対戦系 / c: その他）。各バッチでスクショ確認。
7. `cpu-game/settings.tsx` にテーマ切替行 + i18n キー。
8. 全テスト・typecheck・lint・format:check → コミット（バッチごと）。

## 8. レビュー結果（2026-09-07 確定）

1. **§4.4 ライトテーマの背景** → 案C（ライト用「昼」背景を3枚生成・使用）。実施済み。
2. **OS不明時の既定**（`resolveScheme('system', null)`）→ ダーク固定。
3. **dark パレットの実値**（§3.2）→ 方向性 OK。最終値は実装時に主要画面で目視調整。
4. `app/index.tsx` 等の生 hex → SP1 で暫定トークン化（意匠刷新は SP2）。

残る調整余地（プラン化には影響しない）：dark パレット実値、スクリム不透明度、`*-day.png` の意匠ブラッシュアップ（SP3 合流可）。
