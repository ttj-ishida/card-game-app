# デザイン刷新 サブプロジェクト W2：ナビゲーション・クローム 設計書

- 文書ID：GAME-SPEC-SHELL-W2
- 版数：0.1
- 作成日：2026-09-07
- 前提：SP1 / SP2 / SHELL-W1 実装済み。
- 実装場所：`apps/mobile/src/components/`（新規 `MenuFab.tsx` / `SideMenu.tsx` / `navItems.ts`）、`apps/mobile/src/app/_layout.tsx`、`apps/mobile/src/app/cpu-game/play.tsx`

---

## 1. 目的とスコープ

expo-router の標準 `<Stack>` ヘッダー（紫のバー）を全廃し、**上部バーなし・フローティングボタン方式**のナビへ差し替える（レビュー確定）。

1. `<Stack screenOptions={{ headerShown: false }}>`。
2. `<MenuFab>`：左下の丸型フローティングボタン（金縁・`☰`）。全画面に常時表示。タップで `<SideMenu>` を開く。
3. `<SideMenu>`：左からスライドインするダークパネル（RN コアの `Animated` で `translateX`。reanimated 不使用）。ナビリスト＋閉じる。背景タップで閉じる。
4. `navItems.ts`：ナビ項目（label + href）の一元定義。
5. `cpu-game/play.tsx`：web にハードウェアバックが無く、標準ヘッダーも消えるため、対戦中に詰まないよう明示の **退出ボタン**を追加（既存の `Alert` 確認を再利用）。`online-room/play.tsx` は既に退出ボタンあり。

### スコープ外

| 項目 | 行き先 |
|---|---|
| 手札の扇形・カード演出 | SHELL-W3 |
| SideMenu からの遷移時に対戦画面の離脱確認を挟む | 将来。W2 では対戦画面に明示の退出ボタンを置くことで担保（SideMenu の項目は素の遷移） |
| テーマ切替を SideMenu に載せる | 将来（設定画面にある） |

## 2. Global Constraints

- 依存追加なし。`Animated`（RN コア）でスライド。`Modal`（RN コア / react-native-web 対応）でオーバーレイ。
- `packages/ui` 不変。
- `.ts` テストのみ。`navItems` の内容と、`SideMenu` の表示項目フィルタ（本番で同期診断を隠す）を純関数化してテスト。
- 既存 362 テストに回帰なし。`tsc` / `eslint` / `prettier` クリーン。
- コミット `main` 直、`[SHELL-W2]`、明示パスのみ `git add`、末尾 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- 並行作業：`_layout.tsx` / `online-room/*` に未コミット変更があれば待つ。

## 3. `navItems.ts`（純）

```ts
export type NavItem = { key: string; labelKey: TranslationKey; href: string; devOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', labelKey: 'nav.home', href: '/' },
  { key: 'cpu', labelKey: 'nav.cpuGame', href: '/cpu-game/setup' },
  { key: 'online', labelKey: 'nav.onlineRoom', href: '/online-room' },
  { key: 'catalog', labelKey: 'nav.catalog', href: '/catalog' },
  { key: 'sandbox', labelKey: 'nav.sandbox', href: '/sandbox' },
  { key: 'settings', labelKey: 'nav.settings', href: '/cpu-game/settings' },
  { key: 'diagnostics', labelKey: 'nav.diagnostics', href: '/diagnostics', devOnly: true },
];

export function visibleNavItems(items: NavItem[], isProduction: boolean): NavItem[];
```

- `visibleNavItems`：`isProduction` なら `devOnly` を落とす。テスト：本番=6件、非本番=7件、順序保持。
- i18n キー `nav.*` を `translate.ts` に追加（home/cpuGame/onlineRoom/catalog/sandbox/settings/diagnostics/menuTitle/close）。既存の `home.*` 等と文言が重複してよい。

## 4. `MenuFab.tsx`

```ts
export function MenuFab({ onPress }: { onPress: () => void }): JSX.Element;
```

- 絶対配置：`position: 'absolute', left: 16, bottom: 16, zIndex: 20`。
- 直径 52、`borderRadius: 26`、`backgroundColor: c.surface.card.back`、`borderWidth: 2`、`borderColor: ACCENT`、中央に `☰`（`c.ink.primary`, fontSize 22）。押下 `opacity: 0.85`。
- `accessibilityRole="button"`、`accessibilityLabel={translate('nav.menuTitle')}`。
- `useTheme` を使うので `<ThemeProvider>` 内。

## 5. `SideMenu.tsx`

```ts
export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }): JSX.Element;
```

- `<Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>`。
- 中身：
  - 背景 `<Pressable style={StyleSheet.absoluteFill}>`（`rgba(0,0,0,0.5)`）→ `onClose`。
  - パネル `<Animated.View>`：幅 280、`height: '100%'`、`backgroundColor: c.surface.card.back`、右辺に `borderRightWidth: 2, borderRightColor: ACCENT`。`transform: [{ translateX }]`。
  - `translateX` は `useRef(new Animated.Value(-280))`。`visible` の変化で `Animated.timing(..., { toValue: visible ? 0 : -280, duration: 180, useNativeDriver: true }).start()`。
  - パネル上部：`translate('nav.menuTitle')` の見出し＋右に閉じる `✕`（`onClose`）。
  - リスト：`visibleNavItems(NAV_ITEMS, isProduction)` を `map`。各行 `<Pressable>`：`translate(item.labelKey)`、押下で `router.replace(item.href)` → `onClose()`。現在ルート（`usePathname()`）と一致する項目は `ACCENT` 文字色＋左に金バー。
- `isProduction = getOptionalAppConfig()?.appEnv === 'production'`。
- `visible === false` でも `Modal` は返す（`visible` prop で制御）。初回 `visible=false` 時に閉じ位置で待機。

## 6. `_layout.tsx` 変更

`ThemedStack` を改修：

```tsx
function ThemedStack() {
  const { scheme, colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface.table.day },
        }}
      >
        {/* 既存の <Stack.Screen> 群はそのまま（title は残してよい／未使用になるだけ） */}
      </Stack>
      <MenuFab onPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
```

- `headerStyle` / `headerTintColor` は不要になるので削除。
- `<Stack.Screen>` の `options` から `headerBackVisible` は消してよい（ヘッダー自体が無い）。title は残置可（害なし）。

## 7. `cpu-game/play.tsx` 変更

`topBar` 内の履歴トグルの隣に退出ボタンを追加：

```tsx
<Button
  variant="danger"
  label={translate('cpuGame.exit.button')}
  onPress={() => {
    Alert.alert(translate('cpuGame.exit.confirmTitle'), undefined, [
      { text: translate('cpuGame.exit.confirmCancel'), style: 'cancel' },
      {
        text: translate('cpuGame.exit.confirmOk'),
        style: 'destructive',
        onPress: () => {
          cpuGameStore.getState().exit();
          router.replace('/');
        },
      },
    ]);
  }}
/>
```

- 既存の `useFocusEffect` の BackHandler ハンドラと同じ処理。関数に切り出して両方から呼ぶ。
- i18n `cpuGame.exit.button` を追加（`退出`）。

## 8. テスト計画

| 種別 | 対象 | 場所 |
|---|---|---|
| 単体 | `visibleNavItems`（本番フィルタ・順序・件数） | `components/navItems.test.ts`（新） |
| 回帰 | `mobile:test` / `ui:test` / `game-core:test` | ローカル |
| 静的 | typecheck / lint / format:check | ローカル |
| 目視 | `expo start --web`：①標準ヘッダーが消えている ②左下FABをタップ→左からメニュー ③項目タップで遷移＋閉じる ④CPU対戦で退出ボタン→確認→ホーム | `SendUserFile` |

## 9. 実装順序

1. `navItems.ts` + `navItems.test.ts` + i18n `nav.*` / `cpuGame.exit.button`。
2. `MenuFab.tsx`。
3. `SideMenu.tsx`。
4. `components/index.ts` に3つを追記。
5. `_layout.tsx` を改修（`headerShown: false` + FAB + SideMenu）。
6. `cpu-game/play.tsx` に退出ボタン。
7. `expo start --web` 目視 → スクショ。
8. 検証一式 → コミット → push。

## 10. 未解決

1. FAB は左下でよいか（右下だと手札と干渉しにくい／左下だと戻る的な位置）。
2. スライド 180ms・幅280 でよいか。
3. 現在ルートのハイライト方法（金文字＋左バー）。
