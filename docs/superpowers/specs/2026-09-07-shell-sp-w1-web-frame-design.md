# デザイン刷新 サブプロジェクト W1：アプリシェル（web の枠） 設計書

- 文書ID：GAME-SPEC-SHELL-W1
- 版数：0.1
- 作成日：2026-09-07
- 前提：SP1（テーマ機構）／SP2（UIキット）実装済み。
- 実装場所：`apps/mobile/src/features/theme/`（新規 `AppShell.tsx` / `resolveShellSize.ts`）、`apps/mobile/src/app/_layout.tsx`、`apps/mobile/src/app/+html.tsx`（新規）

---

## 1. 目的とスコープ

### 1.1 やること

web（および広幅ビュー）でアプリがブラウザ全面に伸び切るのをやめ、**中央の 16:9 横向きフレーム**の中にゲームを収める。フレームの外側にはダークな下地（マスターデュエルの「デュエル外周」感）。

1. `resolveShellSize(win, opts)` 純関数：ウィンドウサイズ → フレームの実ピクセルサイズ（または `null`＝フルブリード）。
2. `<AppShell>` コンポーネント：`Platform.OS === 'web'` かつ幅が閾値以上なら 16:9 の中央ボックスで子を囲む。native / narrow web は素通し（`flex: 1`）。
3. `_layout.tsx`：`<ThemeProvider>` 直下、`<ThemedStack>` を `<AppShell>` で包む。
4. `app/+html.tsx`：web の `<html>/<body>/#root` を 100% 高さ＋オーバースクロール抑止にし、`<body>` の地を深い下地色に。

### 1.2 スコープ外

| 項目 | 行き先 |
|---|---|
| ヘッダー/×ボタン/サイドメニュー | SP-W2 |
| 手札の扇形・カード演出 | SP-W3 |
| 各画面のレイアウトを横向き最適化する作業 | 別途。W1 は「16:9 の中に既存画面をそのまま入れる」だけ（縦 ScrollView は短い高さ内でスクロールする＝横向き端末と同じ挙動） |
| native の見た目変更 | なし（native は素通し） |

## 2. Global Constraints

- 依存追加なし。RN コア＋`react-native-web` の既存機能のみ。
- `packages/ui` 不変。
- native（iOS/Android）の描画・挙動は一切変えない（`Platform.OS !== 'web'` は即 `return children` 相当）。
- `.ts` テストのみ。`resolveShellSize` を単体テスト。コンポーネントはテストしない。
- 既存 356 テストに回帰なし。`tsc` / `eslint` / `prettier` クリーン。
- コミット `main` 直、`[SHELL-W1]`、明示パスのみ `git add`、末尾 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- 並行作業：別セッションが `online-room*` / `_layout.tsx` を触ることがある。実装前に `git status` を確認し、`_layout.tsx` に未コミット変更があれば待つ。

## 3. `resolveShellSize.ts`（純）

```ts
export type ShellSize = { width: number; height: number };

export type ShellOptions = {
  /** これ未満の幅ならフルブリード（モバイル相当）。default 760 */
  minWidth?: number;
  /** ウィンドウ端からの最小マージン。default 24 */
  margin?: number;
  /** アスペクト比 width/height。default 16/9 */
  aspect?: number;
};

/**
 * web の広幅ビュー用に 16:9 フレームの実サイズを返す。
 * - win.width < minWidth → null（フルブリード）
 * - それ以外 → ウィンドウに margin を引いた領域へ収まる最大の aspect 比ボックス
 */
export function resolveShellSize(
  win: { width: number; height: number },
  opts?: ShellOptions,
): ShellSize | null;
```

### テスト（`resolveShellSize.test.ts`）

- `win.width < minWidth` → `null`（375×812、759×800 など）
- ワイドで横が制約：`1920×1080, margin 24` → 高さ律速 or 幅律速のどちらか正しい方。`aspect=16/9` で `(1920-48)/(1080-48) = 1.81 > 1.78` なので**高さ律速**：`height = 1032`, `width = round(1032*16/9) = 1835`。
- 縦長ウィンドウ `900×1400` → 幅律速：`width = 852`, `height = round(852*9/16) = 479`。
- 返り値は常に整数。`width/height` の比が `aspect` と 1px 以内で一致。
- ちょうど `minWidth`（760）→ 非 null（`>=`）。

## 4. `AppShell.tsx`

```tsx
export function AppShell({ children }: { children: ReactNode }): JSX.Element;
```

- `Platform.OS !== 'web'` → `<View style={{ flex: 1 }}>{children}</View>`（何もしない）。
- web：
  - `const win = useWindowDimensions();`
  - `const size = resolveShellSize(win);`
  - `size == null` → `<View style={{ flex: 1 }}>{children}</View>`
  - `size != null` → 中央寄せの外側 `<View style={styles.backdrop}>`（`flex:1`, `alignItems/justifyContent: 'center'`, `backgroundColor: SHELL_BACKDROP`）の中に、
    ```tsx
    <View style={[styles.frame, { width: size.width, height: size.height }]}>{children}</View>
    ```
  - `styles.frame`：`overflow: 'hidden'`, `borderRadius: 18`, `borderWidth: 1`, `borderColor: withAlpha(ACCENT, 0.35)`（SP2 の `ACCENT` を再利用）, web のみ `boxShadow`（`style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.55)' } as any}` — RN Web は文字列 boxShadow 可）。
  - `SHELL_BACKDROP = '#07090D'`（`AppShell.tsx` 内定数。dark 下地）。
- `useTheme` は使わない（下地はテーマ非依存の固定ダーク。フレーム枠は `ACCENT`）。＝ ThemeProvider の内外どちらでも動くが、`_layout` では ThemeProvider 内に置く。

## 5. `app/+html.tsx`（web 専用ドキュメント）

expo-router の web 用ルート HTML をカスタムする。既存が無いので新規作成：

```tsx
import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BODY_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BODY_CSS = `
html, body, #root { height: 100%; }
body { margin: 0; overflow: hidden; background-color: #07090D; overscroll-behavior: none; }
`;
```

- `ScrollViewStyleReset` は expo-router 標準（`react-native-web` の ScrollView をまとも化）。
- `#root` は expo-router web のマウント先 id（確認：現行 expo-router/web は `#root`。異なれば実装時に generated HTML を見て合わせる）。
- native では `+html.tsx` は無視される。

## 6. `_layout.tsx` 変更

```tsx
return (
  <ThemeProvider>
    <AppShell>
      <ThemedStack />
    </AppShell>
  </ThemeProvider>
);
```

import 追加のみ。`ThemedStack` は不変。

## 7. テスト計画

| 種別 | 対象 | 場所 |
|---|---|---|
| 単体 | `resolveShellSize` の律速判定・整数・閾値 | `features/theme/resolveShellSize.test.ts`（新） |
| 回帰 | `mobile:test`（356）/ `ui:test` / `game-core:test` | ローカル |
| 静的 | `mobile:typecheck` / `mobile:lint` / `mobile:format:check` | ローカル |
| 目視 | `expo start --web` で①デスクトップ広幅＝16:9枠＋外周ダーク ②ウィンドウを 700px 未満に縮める＝フルブリード ③native は変化なし（`/run` か既存ビルド） | `SendUserFile` |

## 8. 実装順序

1. `resolveShellSize.ts` + テスト。
2. `AppShell.tsx`。
3. `+html.tsx`。
4. `_layout.tsx` を包む。
5. `expo start --web` で目視 → スクショ提出。
6. 検証一式 → コミット → push。

## 9. 未解決 / レビュー確認事項

1. `minWidth` 閾値 760 でよいか（スマホは全面、タブレット以上で枠）。
2. 外周下地 `#07090D` の暗さ。
3. フレーム枠を `ACCENT` 金の細線でよいか（マスターデュエルの盤外周イメージ）。
