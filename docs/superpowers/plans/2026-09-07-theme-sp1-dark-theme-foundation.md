# THEME-SP1 ダークテーマ基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ全体を light/dark 2テーマ対応にし、マスターデュエル風の背景を全画面に敷く基盤（トークン・テーマ機構・`<AppBackground>`）を導入する。

**Architecture:** `packages/ui/tokens.ts` に light/dark の2トークンセットを値だけ差し替えで用意。テーマの状態・React・永続化は `apps/mobile/src/features/theme/` と `src/state/themeStore.ts`（既存 `cpuGameSettingsStore` と同型）。全画面のモジュールスコープ `StyleSheet.create` を `useThemedStyles(makeStyles)` フックへ機械移行。`<AppBackground variant>` が `variant × scheme` で6枚のPNGを出し分ける。

**Tech Stack:** React Native (Expo SDK 57)、expo-router、zustand v5（`zustand/vanilla` + `zustand/react`）、AsyncStorage、`tsx --test`（唯一のテストランナー。RTL 未導入なのでReactコンポーネントの単体テストは不可、純関数のみ）。

**Spec:** `docs/superpowers/specs/2026-09-07-theme-sp1-dark-theme-foundation-design.md`（v0.2）

## Global Constraints

- `packages/ui` に依存を追加しない。`tokens.ts` は値と型のみ、副作用なし。
- `apps/mobile/metro.config.js` の `@ragnarok-millennium/ui` → `packages/ui/src/tokens.ts` シムは変更しない。新トークンは全て `tokens.ts` 内に置く（`index.ts` バレルは触らない）。
- 既存の公開名 `colors` / `spacing` / `radius` / `typography` / `card` / `designTokens` はシグネチャ・値とも現状維持。`colors` は light セットそのもの。
- テストランナーは `tsx --test src/**/*.test.ts`（mobile）と `tsx --test packages/ui/src/tokens.test.ts`（ui）。テストファイルは必ず `.ts`（`.tsx` 不可）。`require('*.png')` を import するモジュールはテストから読み込まない。
- 永続化は `StoragePort`（`apps/mobile/src/features/cpu-game/anonPlayerId.ts` の `{ getItem, setItem }`）経由。テーマ設定キーは `'card-game-app:theme-preference:v1'`。
- 純モジュール（`features/theme/themePreference.ts`）は React にもストレージにも依存しない。
- zustand ストアは `zustand/vanilla` の `createStore`、`configureXxxStore(deps)` + `requireDeps()` + `__resetXxxStoreForTest()` の既存作法（`src/state/cpuGameSettingsStore.ts` 参照）に厳密に合わせる。
- `apps/mobile` の既存テスト（約180件）と `packages/ui` / `game-core` のテストに回帰を出さない。
- light テーマでの各画面は移行前後でピクセル実質同一（トークン値不変・参照方法のみ変更。例外は生 hex をトークンへ寄せた僅差のみ）。
- コミットは `main` 直、メッセージ先頭に `[THEME-SP1]`、明示パスのみ `git add`（`git add -A` 禁止）。各コミット末尾に:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

---

## File Structure

新規:
- `apps/mobile/src/features/theme/themePreference.ts` — 純：`ThemePreference` 型、パース/シリアライズ、`resolveScheme`
- `apps/mobile/src/features/theme/themePreference.test.ts`
- `apps/mobile/src/state/themeStore.ts` — zustand ストア（嗜好の読み書き）
- `apps/mobile/src/state/themeStore.test.ts`
- `apps/mobile/src/features/theme/ThemeProvider.tsx` — Context・`useTheme`・`useThemedStyles`
- `apps/mobile/src/features/theme/backgroundAssets.ts` — `require('*.png')` の6枚マップ＋`resolveBackgroundSource`
- `apps/mobile/src/features/theme/resolveBackgroundSource.ts` — 純：テーブルを引数に取る選択関数
- `apps/mobile/src/features/theme/resolveBackgroundSource.test.ts`
- `apps/mobile/src/features/theme/AppBackground.tsx` — `<ImageBackground>` + スクリム

変更:
- `packages/ui/src/tokens.ts` — `darkColors` / `themeColors` / 型を追加
- `packages/ui/src/tokens.test.ts` — dark 網羅・コントラストの追記
- `apps/mobile/src/app/_layout.tsx` — `configureThemeStore` / `load` 配線、`<ThemeProvider>` で包む、header をトークン化、`<StatusBar>`
- `apps/mobile/src/app/cpu-game/settings.tsx` — テーマ切替行
- `apps/mobile/src/i18n/translate.ts`（＋辞書） — テーマ設定の文言キー
- 全画面（下記 §Task 8 の一覧）— `StyleSheet.create` → `useThemedStyles(makeStyles)`、画面素地色を除去し `<AppBackground>` で包む

---

## Task 1: light/dark トークンセット

**Files:**
- Modify: `packages/ui/src/tokens.ts`
- Test: `packages/ui/src/tokens.test.ts`

**Interfaces:**
- Produces:
  - `type ThemeScheme = 'light' | 'dark'`
  - `type ThemeColors = typeof colors`（既存 `colors` の形）
  - `const darkColors: ThemeColors`
  - `const themeColors: Record<ThemeScheme, ThemeColors>`（`{ light: colors, dark: darkColors }`）

- [ ] **Step 1: 失敗するテストを書く**

`packages/ui/src/tokens.test.ts` の末尾に追記：

```ts
import { colors, darkColors, themeColors } from './tokens.ts';

// --- THEME-SP1: dark token set ---

function leafPaths(obj: unknown, prefix = ''): string[] {
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

test('darkColors has exactly the same shape as colors', () => {
  assert.deepStrictEqual(leafPaths(darkColors).sort(), leafPaths(colors).sort());
});

test('every darkColors leaf is a #RRGGBB string', () => {
  for (const path of leafPaths(darkColors)) {
    const value = path
      .split('.')
      .reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, darkColors as never);
    assert.match(value as unknown as string, /^#[0-9A-Fa-f]{6}$/, `${path} = ${String(value)}`);
  }
});

test('themeColors maps light->colors and dark->darkColors', () => {
  assert.strictEqual(themeColors.light, colors);
  assert.strictEqual(themeColors.dark, darkColors);
});

function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const [l1, l2] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

test('primary text on panel meets WCAG AA (4.5:1) in both themes', () => {
  assert.ok(contrastRatio(colors.ink.primary, colors.surface.card.face) >= 4.5);
  assert.ok(contrastRatio(darkColors.ink.primary, darkColors.surface.card.face) >= 4.5);
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npm run ui:test`
Expected: FAIL（`darkColors` / `themeColors` が export されていない）

- [ ] **Step 3: 最小実装**

`packages/ui/src/tokens.ts` の `export const colors = { … } as const;` の直後に追加：

```ts
export type ThemeScheme = 'light' | 'dark';
export type ThemeColors = typeof colors;

export const darkColors: ThemeColors = {
  surface: {
    table: { day: '#12161C', night: '#0B0E14' },
    card: { face: '#1B2028', back: '#0E1116' },
  },
  ink: { primary: '#EDE6D6', secondary: '#A7AEB8', inverse: '#12161C' },
  suit: { fire: '#F06A4A', water: '#4FA0DE', wind: '#57B98F', earth: '#C39A4E' },
  state: { warning: '#E0A32B', disabled: '#4A525C' },
} as const;

export const themeColors: Record<ThemeScheme, ThemeColors> = {
  light: colors,
  dark: darkColors,
};
```

`designTokens` オブジェクトはそのまま（`colors` を指したままでよい）。

- [ ] **Step 4: テスト成功を確認**

Run: `npm run ui:test`
Expected: PASS（既存テストも含め全緑）
Run: `npm run ui:typecheck`
Expected: PASS

もし AA コントラストのテストが落ちたら、落ちた側の `darkColors.ink.primary` を明るく（例 `#F2ECDE`）または `surface.card.face` を暗く（例 `#171B22`）調整して再実行。

- [ ] **Step 5: コミット**

```bash
git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
git commit -m "$(printf '%s\n' '[THEME-SP1] add dark token set to packages/ui' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 2: themePreference 純モジュール

**Files:**
- Create: `apps/mobile/src/features/theme/themePreference.ts`
- Test: `apps/mobile/src/features/theme/themePreference.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type ThemePreference = 'system' | 'light' | 'dark'`
  - `const THEME_PREFERENCE_STORAGE_KEY = 'card-game-app:theme-preference:v1'`
  - `const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'`
  - `function parseThemePreference(raw: string | null): ThemePreference`
  - `function serializeThemePreference(preference: ThemePreference): string`
  - `function resolveScheme(preference: ThemePreference, osScheme: 'light' | 'dark' | null): 'light' | 'dark'`

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/theme/themePreference.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  resolveScheme,
  serializeThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
} from './themePreference.ts';

test('storage key is stable', () => {
  assert.equal(THEME_PREFERENCE_STORAGE_KEY, 'card-game-app:theme-preference:v1');
});

test('parse returns default for null / garbage / unknown value', () => {
  assert.equal(parseThemePreference(null), 'system');
  assert.equal(parseThemePreference('not json'), 'system');
  assert.equal(parseThemePreference('{}'), 'system');
  assert.equal(parseThemePreference('{"preference":"sepia"}'), 'system');
});

test('parse round-trips every valid preference', () => {
  for (const p of ['system', 'light', 'dark'] as const) {
    assert.equal(parseThemePreference(serializeThemePreference(p)), p);
  }
});

test('resolveScheme: explicit light/dark ignores OS', () => {
  assert.equal(resolveScheme('light', 'dark'), 'light');
  assert.equal(resolveScheme('dark', 'light'), 'dark');
  assert.equal(resolveScheme('light', null), 'light');
});

test('resolveScheme: system follows OS, falls back to dark when OS unknown', () => {
  assert.equal(resolveScheme('system', 'light'), 'light');
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', null), 'dark');
});

assert.equal(DEFAULT_THEME_PREFERENCE, 'system');
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `cd apps/mobile && npx tsx --test src/features/theme/themePreference.test.ts`
Expected: FAIL（`themePreference.ts` が無い）

- [ ] **Step 3: 最小実装**

`apps/mobile/src/features/theme/themePreference.ts`:

```ts
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_STORAGE_KEY = 'card-game-app:theme-preference:v1';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

const PREFERENCES = new Set<ThemePreference>(['system', 'light', 'dark']);

export function parseThemePreference(raw: string | null): ThemePreference {
  if (!raw) return DEFAULT_THEME_PREFERENCE;
  try {
    const parsed = JSON.parse(raw) as { preference?: unknown };
    if (PREFERENCES.has(parsed.preference as ThemePreference)) {
      return parsed.preference as ThemePreference;
    }
    return DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function serializeThemePreference(preference: ThemePreference): string {
  return JSON.stringify({ preference });
}

export function resolveScheme(
  preference: ThemePreference,
  osScheme: 'light' | 'dark' | null,
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  return osScheme ?? 'dark';
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd apps/mobile && npx tsx --test src/features/theme/themePreference.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/mobile/src/features/theme/themePreference.ts apps/mobile/src/features/theme/themePreference.test.ts
git commit -m "$(printf '%s\n' '[THEME-SP1] theme preference pure module (parse/serialize/resolveScheme)' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 3: themeStore（zustand）＋ `_layout.tsx` 配線

**Files:**
- Create: `apps/mobile/src/state/themeStore.ts`
- Test: `apps/mobile/src/state/themeStore.test.ts`
- Modify: `apps/mobile/src/app/_layout.tsx:24-49`

**Interfaces:**
- Consumes: `themePreference.ts`（Task 2）、`StoragePort`（`../features/cpu-game/anonPlayerId`）
- Produces:
  - `type ThemeStoreStatus = 'idle' | 'loading' | 'ready' | 'failed'`
  - `type ThemeStoreState = { preference: ThemePreference; status: ThemeStoreStatus; load: () => Promise<void>; setPreference: (p: ThemePreference) => Promise<void> }`
  - `function configureThemeStore(deps: { storage: StoragePort }): void`
  - `const themeStore` （`createStore<ThemeStoreState>`）
  - `function __resetThemeStoreForTest(): void`

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/state/themeStore.test.ts`（`cpuGameSettingsStore.test.ts` に倣う）:

```ts
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import type { StoragePort } from '../features/cpu-game/anonPlayerId.ts';
import { THEME_PREFERENCE_STORAGE_KEY } from '../features/theme/themePreference.ts';
import {
  __resetThemeStoreForTest,
  configureThemeStore,
  themeStore,
} from './themeStore.ts';

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const calls: Array<[string, string]> = [];
  const storage: StoragePort = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      calls.push([k, v]);
      map.set(k, v);
    },
  };
  return { storage, calls, map };
}

beforeEach(() => __resetThemeStoreForTest());

test('load reads a stored preference', async () => {
  const { storage } = makeStorage({
    [THEME_PREFERENCE_STORAGE_KEY]: JSON.stringify({ preference: 'light' }),
  });
  configureThemeStore({ storage });
  await themeStore.getState().load();
  assert.equal(themeStore.getState().preference, 'light');
  assert.equal(themeStore.getState().status, 'ready');
});

test('load falls back to system + failed when storage throws', async () => {
  const storage: StoragePort = {
    getItem: async () => {
      throw new Error('boom');
    },
    setItem: async () => {},
  };
  configureThemeStore({ storage });
  await themeStore.getState().load();
  assert.equal(themeStore.getState().preference, 'system');
  assert.equal(themeStore.getState().status, 'failed');
});

test('setPreference updates state and persists serialized value', async () => {
  const { storage, calls } = makeStorage();
  configureThemeStore({ storage });
  await themeStore.getState().setPreference('dark');
  assert.equal(themeStore.getState().preference, 'dark');
  assert.deepEqual(calls, [[THEME_PREFERENCE_STORAGE_KEY, JSON.stringify({ preference: 'dark' })]]);
});

test('throws when used before configure', async () => {
  await assert.rejects(() => themeStore.getState().load(), /not configured/);
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `cd apps/mobile && npx tsx --test src/state/themeStore.test.ts`
Expected: FAIL（`themeStore.ts` が無い）

- [ ] **Step 3: 最小実装**

`apps/mobile/src/state/themeStore.ts`（`cpuGameSettingsStore.ts` と同型）:

```ts
import { createStore } from 'zustand/vanilla';

import type { StoragePort } from '../features/cpu-game/anonPlayerId';
import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  serializeThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
} from '../features/theme/themePreference';

export type ThemeStoreStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type ThemeStoreState = {
  preference: ThemePreference;
  status: ThemeStoreStatus;
  load: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

export type ThemeStoreDeps = { storage: StoragePort };

let deps: ThemeStoreDeps | null = null;

export function configureThemeStore(next: ThemeStoreDeps): void {
  deps = next;
}

function requireDeps(): ThemeStoreDeps {
  if (!deps) throw new Error('themeStore is not configured');
  return deps;
}

export const themeStore = createStore<ThemeStoreState>((set, get) => ({
  preference: DEFAULT_THEME_PREFERENCE,
  status: 'idle',

  load: async () => {
    const d = requireDeps();
    set({ status: 'loading' });
    try {
      const raw = await d.storage.getItem(THEME_PREFERENCE_STORAGE_KEY);
      set({ preference: parseThemePreference(raw), status: 'ready' });
    } catch {
      set({ preference: DEFAULT_THEME_PREFERENCE, status: 'failed' });
    }
  },

  setPreference: async (preference) => {
    const d = requireDeps();
    set({ preference });
    try {
      await d.storage.setItem(THEME_PREFERENCE_STORAGE_KEY, serializeThemePreference(preference));
      set({ status: 'ready' });
    } catch {
      set({ status: 'failed' });
    }
  },
}));

export function __resetThemeStoreForTest(): void {
  deps = null;
  themeStore.setState({ preference: DEFAULT_THEME_PREFERENCE, status: 'idle' });
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd apps/mobile && npx tsx --test src/state/themeStore.test.ts`
Expected: PASS

- [ ] **Step 5: `_layout.tsx` に配線**

`apps/mobile/src/app/_layout.tsx`:

1. import 追加:
   ```ts
   import { configureThemeStore, themeStore } from '../state/themeStore';
   ```
2. `try { … } catch` ブロック内、`configureCpuGameSettingsStore(...)` の隣に:
   ```ts
   configureThemeStore({ storage: deps.storage });
   ```
3. `useEffect` 内の先頭付近に:
   ```ts
   void themeStore.getState().load();
   ```

- [ ] **Step 6: 回帰確認**

Run: `cd apps/mobile && npm test`
Expected: PASS（既存 + 新規すべて緑）

- [ ] **Step 7: コミット**

```bash
git add apps/mobile/src/state/themeStore.ts apps/mobile/src/state/themeStore.test.ts apps/mobile/src/app/_layout.tsx
git commit -m "$(printf '%s\n' '[THEME-SP1] themeStore + wire configure/load in _layout' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 4: ThemeProvider / useTheme / useThemedStyles ＋ `_layout` 適用

**Files:**
- Create: `apps/mobile/src/features/theme/ThemeProvider.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx:51-97`

**Interfaces:**
- Consumes: `themeStore`（Task 3）、`themePreference.resolveScheme`（Task 2）、`@ragnarok-millennium/ui` の `themeColors` / `ThemeColors` / `ThemeScheme`（Task 1）
- Produces:
  - `function ThemeProvider({ children }: { children: ReactNode }): JSX.Element`
  - `type ThemeContextValue = { scheme: ThemeScheme; colors: ThemeColors; preference: ThemePreference }`
  - `function useTheme(): ThemeContextValue`
  - `function useThemedStyles<T extends Record<string, unknown>>(factory: (c: ThemeColors) => T): T`

- [ ] **Step 1: 実装**（このタスクは RTL 不在のため単体テストなし。型と手動確認で担保）

`apps/mobile/src/features/theme/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useStore } from 'zustand/react';

import { themeColors, type ThemeColors, type ThemeScheme } from '@ragnarok-millennium/ui';

import { resolveScheme, type ThemePreference } from './themePreference';
import { themeStore } from '../../state/themeStore';

export type ThemeContextValue = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  preference: ThemePreference;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const osScheme = useColorScheme() ?? null;
  const preference = useStore(themeStore, (s) => s.preference);
  const scheme = resolveScheme(preference, osScheme);
  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: themeColors[scheme], preference }),
    [scheme, preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

export function useThemedStyles<T extends Record<string, unknown>>(
  factory: (c: ThemeColors) => T,
): T {
  const { scheme, colors } = useTheme();
  // scheme をキーに memo（colors はスキームごとに安定参照）
  return useMemo(() => StyleSheet.create(factory(colors)) as T, [scheme]);
}
```

- [ ] **Step 2: 型チェック**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS（`JSX` 名前解決が通らない場合は戻り値型を `React.ReactElement` にして `import type React from 'react'` を追加）

- [ ] **Step 3: `_layout.tsx` に適用**

`apps/mobile/src/app/_layout.tsx`:

1. import:
   ```ts
   import { StatusBar } from 'expo-status-bar';
   import { ThemeProvider, useTheme } from '../features/theme/ThemeProvider';
   ```
2. `RootLayout` の `return (...)` を、`<ThemeProvider>` で包んだ内部コンポーネントに分割:
   ```tsx
   export default function RootLayout() {
     useEffect(() => { /* 既存のまま */ }, []);
     return (
       <ThemeProvider>
         <ThemedStack />
       </ThemeProvider>
     );
   }

   function ThemedStack() {
     const { scheme, colors } = useTheme();
     return (
       <>
         <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
         <Stack
           screenOptions={{
             headerStyle: { backgroundColor: colors.surface.card.back },
             headerTintColor: colors.ink.primary,
             contentStyle: { backgroundColor: colors.surface.table.day },
           }}
         >
           {/* 既存の <Stack.Screen> 群をそのまま移動 */}
         </Stack>
       </>
     );
   }
   ```
   ハードコードの `#111827` / `#f9fafb` / `#f8fafc` は削除。

- [ ] **Step 4: 回帰＋起動確認**

Run: `cd apps/mobile && npm test && npx tsc --noEmit`
Expected: PASS
Run（任意・可能なら）: `/run` で Expo 起動しホーム画面が表示されるか確認（この時点で dark 既定なので卓が暗くなる／文字が明色になる）

- [ ] **Step 5: コミット**

```bash
git add apps/mobile/src/features/theme/ThemeProvider.tsx apps/mobile/src/app/_layout.tsx
git commit -m "$(printf '%s\n' '[THEME-SP1] ThemeProvider/useTheme/useThemedStyles + themed root Stack' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 5: backgroundAssets ＋ AppBackground

**Files:**
- Create: `apps/mobile/src/features/theme/resolveBackgroundSource.ts`
- Test: `apps/mobile/src/features/theme/resolveBackgroundSource.test.ts`
- Create: `apps/mobile/src/features/theme/backgroundAssets.ts`
- Create: `apps/mobile/src/features/theme/AppBackground.tsx`

**Interfaces:**
- Consumes: `useTheme`（Task 4）、`ThemeScheme`（Task 1）
- Produces:
  - `type BackgroundVariant = 'battle' | 'home' | 'universal'`
  - `type BackgroundTable = Record<ThemeScheme, Record<BackgroundVariant, number>>`（RN の asset は `require()` が返す number）
  - `function resolveBackgroundSource(table: BackgroundTable, scheme: ThemeScheme, variant: BackgroundVariant): number`
  - `const backgroundAssets: BackgroundTable`
  - `function AppBackground({ variant, children }: { variant: BackgroundVariant; children: ReactNode }): JSX.Element`

- [ ] **Step 1: 失敗するテストを書く**（純関数のみ。`require('*.png')` を含むファイルは import しない）

`apps/mobile/src/features/theme/resolveBackgroundSource.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveBackgroundSource, type BackgroundTable } from './resolveBackgroundSource.ts';

const table: BackgroundTable = {
  light: { battle: 1, home: 2, universal: 3 },
  dark: { battle: 4, home: 5, universal: 6 },
};

test('picks the cell for the given scheme x variant', () => {
  assert.equal(resolveBackgroundSource(table, 'light', 'battle'), 1);
  assert.equal(resolveBackgroundSource(table, 'light', 'universal'), 3);
  assert.equal(resolveBackgroundSource(table, 'dark', 'home'), 5);
  assert.equal(resolveBackgroundSource(table, 'dark', 'universal'), 6);
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `cd apps/mobile && npx tsx --test src/features/theme/resolveBackgroundSource.test.ts`
Expected: FAIL

- [ ] **Step 3: 純関数を実装**

`apps/mobile/src/features/theme/resolveBackgroundSource.ts`:

```ts
import type { ThemeScheme } from '@ragnarok-millennium/ui';

export type BackgroundVariant = 'battle' | 'home' | 'universal';
export type BackgroundTable = Record<ThemeScheme, Record<BackgroundVariant, number>>;

export function resolveBackgroundSource(
  table: BackgroundTable,
  scheme: ThemeScheme,
  variant: BackgroundVariant,
): number {
  return table[scheme][variant];
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd apps/mobile && npx tsx --test src/features/theme/resolveBackgroundSource.test.ts`
Expected: PASS

- [ ] **Step 5: asset マップと `<AppBackground>` を実装**

`apps/mobile/src/features/theme/backgroundAssets.ts`:

```ts
import type { BackgroundTable } from './resolveBackgroundSource';

export const backgroundAssets: BackgroundTable = {
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
};
```

`apps/mobile/src/features/theme/AppBackground.tsx`:

```tsx
import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

import { useTheme } from './ThemeProvider';
import { backgroundAssets } from './backgroundAssets';
import { resolveBackgroundSource, type BackgroundVariant } from './resolveBackgroundSource';

// スクリム: [上端レイヤー, 下端レイヤー] の rgba。dark は暗幕、light は薄い明幕。
const SCRIM: Record<'light' | 'dark', Record<BackgroundVariant, [string, string]>> = {
  dark: {
    battle: ['rgba(11,14,20,0.42)', 'rgba(11,14,20,0.42)'],
    home: ['rgba(11,14,20,0.28)', 'rgba(11,14,20,0.52)'],
    universal: ['rgba(11,14,20,0.50)', 'rgba(11,14,20,0.50)'],
  },
  light: {
    battle: ['rgba(244,240,230,0.40)', 'rgba(244,240,230,0.40)'],
    home: ['rgba(244,240,230,0.20)', 'rgba(244,240,230,0.45)'],
    universal: ['rgba(244,240,230,0.55)', 'rgba(244,240,230,0.55)'],
  },
};

export function AppBackground({
  variant,
  children,
}: {
  variant: BackgroundVariant;
  children: ReactNode;
}): JSX.Element {
  const { scheme } = useTheme();
  const source = resolveBackgroundSource(backgroundAssets, scheme, variant);
  const [top, bottom] = SCRIM[scheme][variant];
  return (
    <ImageBackground source={source} resizeMode="cover" style={styles.fill}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: top }]} />
      <View
        pointerEvents="none"
        style={[styles.bottomHalf, { backgroundColor: bottom }]}
      />
      <View style={styles.fill}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottomHalf: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
});
```

- [ ] **Step 6: 型チェック**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS（`require` の型が `any`。`tsconfig` が `png` を許すか確認。通らなければ `apps/mobile/src/pngModules.d.ts` に `declare module '*.png' { const v: number; export default v; }` を追加し、そのファイルもコミットに含める）

- [ ] **Step 7: 回帰確認**

Run: `cd apps/mobile && npm test`
Expected: PASS（`AppBackground.tsx` / `backgroundAssets.ts` は `.tsx`/`require` を含むため `tsx --test` の対象外。glob `src/**/*.test.ts` に一致しないので安全）

- [ ] **Step 8: コミット**

```bash
git add apps/mobile/src/features/theme/resolveBackgroundSource.ts apps/mobile/src/features/theme/resolveBackgroundSource.test.ts apps/mobile/src/features/theme/backgroundAssets.ts apps/mobile/src/features/theme/AppBackground.tsx
# pngModules.d.ts を作った場合はそれも add
git commit -m "$(printf '%s\n' '[THEME-SP1] AppBackground + 6-asset variant/scheme resolver' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 6: 設定画面にテーマ切替

**Files:**
- Modify: `apps/mobile/src/app/cpu-game/settings.tsx`
- Modify: `apps/mobile/src/i18n/translate.ts`（辞書。実ファイルを開いて既存の `cpuGame.settings.*` キー群の隣に追加）

**Interfaces:**
- Consumes: `themeStore`（Task 3）、`useThemedStyles`（Task 4）、`ThemePreference`（Task 2）

- [ ] **Step 1: i18n キー追加**

`apps/mobile/src/i18n/translate.ts` の辞書、`cpuGame.settings.lowMotion` の近くに（ja / en 両方あるなら両方）:

```
'cpuGame.settings.theme': 'テーマ',
'cpuGame.settings.theme.system': 'システム',
'cpuGame.settings.theme.light': 'ライト',
'cpuGame.settings.theme.dark': 'ダーク',
```
（英語辞書があれば `'Theme' / 'System' / 'Light' / 'Dark'`）

- [ ] **Step 2: 設定画面に行を追加**

`apps/mobile/src/app/cpu-game/settings.tsx`:

1. import:
   ```ts
   import { useStore } from 'zustand/react';
   import { themeStore } from '../../state/themeStore';
   import type { ThemePreference } from '../../features/theme/themePreference';
   ```
2. コンポーネント本体で:
   ```ts
   const preference = useStore(themeStore, (s) => s.preference);
   const PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];
   ```
3. `animationSpeed` の `<View style={styles.panel}>` ブロックを丸ごと複製し、`speed` を `pref` に、`SPEEDS` を `PREFERENCES` に、翻訳キーを `cpuGame.settings.theme.${pref}` に、`onPress` を `void themeStore.getState().setPreference(pref)` に、選択判定を `preference === pref` に置き換える。ラベルは `translate('cpuGame.settings.theme')`。

- [ ] **Step 3: 確認**

Run: `cd apps/mobile && npm test && npx tsc --noEmit`
Expected: PASS
（可能なら `/run` で設定画面を開き、システム/ライト/ダークを切り替えて画面全体が即座に切り替わるか確認）

- [ ] **Step 4: コミット**

```bash
git add apps/mobile/src/app/cpu-game/settings.tsx apps/mobile/src/i18n/translate.ts
git commit -m "$(printf '%s\n' '[THEME-SP1] theme preference row in settings screen' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 7: 画面のスタイル移行（機械的・3バッチ）

> このタスクは同じ手順を各画面に適用する。コードは「手順」であって画面ごとに新規コードは書かない。バッチごとにコミットし、各バッチ後に light テーマでの見た目が不変であることを確認する。

### 移行手順（全画面共通レシピ）

対象ファイル 1つにつき：

1. import 行の `import { colors, radius, spacing, typography } from '@ragnarok-millennium/ui';` を
   `import { radius, spacing, typography } from '@ragnarok-millennium/ui';` に変更（`colors` を外す）。
   さらに追加（`<相対>` は各ファイルから `apps/mobile/src` までの相対パス。例：`app/index.tsx` なら `..`、`app/cpu-game/play.tsx` なら `../..`）:
   ```ts
   import type { ThemeColors } from '@ragnarok-millennium/ui';
   import { useThemedStyles } from '<相対>/features/theme/ThemeProvider';
   import { AppBackground } from '<相対>/features/theme/AppBackground';
   ```
2. ファイル末尾の `const styles = StyleSheet.create({ ... });` を
   `const makeStyles = (c: ThemeColors) => ({ ... });` に変更。
   - 本体オブジェクト内の `colors.` を全て `c.` に一括置換。
   - `StyleSheet.create` は外す（`useThemedStyles` が内部で呼ぶ）。型が緩くて `tsc` が通らない場合のみ `(c: ThemeColors) => StyleSheet.create({ ... })` 形にする（`useThemedStyles` は二重 `create` に耐えるよう Task 4 で `create` 済みを想定 → 二重にしないため素の object を返すのが正。`tsc` エラーは各プロパティに `as const` ではなく戻り値注釈で解決）。
3. 画面素地の背景色を削除：`screen` などの `backgroundColor: c.surface.table.day`（または生 hex の画面背景）を**削除**。パネル等の `backgroundColor: c.surface.card.face` は残す。
4. コンポーネント関数の本体先頭に `const styles = useThemedStyles(makeStyles);` を追加（既存のモジュールスコープ `styles` は上記で `makeStyles` になっているので名前衝突しない）。
5. `return (` 直後の最外要素（`<ScrollView>` か `<View style={styles.screen}>`）を `<AppBackground variant="...">` で包む。
   - `variant` は §Task 8 の割当表に従う。
   - 最外が `<ScrollView style={styles.screen}>` の場合、`style={styles.screen}` から `flex:1` 以外の視覚系が無いか確認し、`<AppBackground>` の子に `<ScrollView style={styles.screen} contentContainerStyle=...>` をそのまま入れる。`ScrollView` は透過なので背景画像が透ける。
6. 生 hex（`app/index.tsx` の `#f8fafc` / `#111827` / `#166534` / `#475569` / `#ffffff` 等）はトークンへ寄せる：
   - 画面背景 `#f8fafc` → 削除（`AppBackground` が担当）
   - 主要テキスト `#111827` → `c.ink.primary`
   - 副次テキスト `#475569` → `c.ink.secondary`
   - ボタン地 `#166534` → `c.suit.wind`
   - ボタン文字 `#ffffff` → `c.ink.inverse`
7. `npx tsc --noEmit` を通す。

### バッチ 7a: ホーム系

**Files:**
- Modify: `apps/mobile/src/app/index.tsx`（variant `home`、生 hex 多数 → Step 6 適用）
- Modify: `apps/mobile/src/app/online-room/index.tsx`（variant `home`）
- Modify: `apps/mobile/src/app/online-room/lobby.tsx`（variant `home`）

- [ ] **Step 1:** 上記3ファイルにレシピを適用
- [ ] **Step 2:** `cd apps/mobile && npm test && npx tsc --noEmit && npx eslint src/app/index.tsx src/app/online-room/index.tsx src/app/online-room/lobby.tsx` → すべて PASS
- [ ] **Step 3:**（可能なら）`/run` で Expo 起動、ホーム画面を **ライトテーマ**（設定で「ライト」）で開き、移行前スクショと並べて差分が無いことを確認。次に「ダーク」で開き、背景が出て文字が読めることを確認。`SendUserFile` でユーザーに提出。
- [ ] **Step 4: コミット**

```bash
git add apps/mobile/src/app/index.tsx apps/mobile/src/app/online-room/index.tsx apps/mobile/src/app/online-room/lobby.tsx
git commit -m "$(printf '%s\n' '[THEME-SP1] migrate home/lobby screens to themed styles + AppBackground' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

### バッチ 7b: 対戦系

**Files:**
- Modify: `apps/mobile/src/app/cpu-game/play.tsx`（variant `battle`）
- Modify: `apps/mobile/src/app/online-room/play.tsx`（variant `battle`）
- Modify: `apps/mobile/src/features/cpu-game/CardFace.tsx`（`colors` 参照があれば同レシピ Step 1〜2・4・7 のみ。`AppBackground` では包まない＝カード部品なので）

- [ ] **Step 1:** レシピ適用。`play.tsx` は `styles.screen` の `backgroundColor: colors.surface.table.day`（`cpu-game/play.tsx:530`）を削除、`<View style={styles.screen}>` を `<AppBackground variant="battle">` で包む。
- [ ] **Step 2:** `cd apps/mobile && npm test && npx tsc --noEmit && npx eslint src/app/cpu-game/play.tsx src/app/online-room/play.tsx src/features/cpu-game/CardFace.tsx` → PASS
- [ ] **Step 3:**（可能なら）`/run` で CPU 対戦を開始し、light / dark 双方で盤面・手札・カードが読めることを確認、`SendUserFile` で提出。特に盤面カードのコントラストと、革命が未実装でも通常プレイが崩れないこと。
- [ ] **Step 4: コミット**

```bash
git add apps/mobile/src/app/cpu-game/play.tsx apps/mobile/src/app/online-room/play.tsx apps/mobile/src/features/cpu-game/CardFace.tsx
git commit -m "$(printf '%s\n' '[THEME-SP1] migrate battle screens to themed styles + AppBackground' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

### バッチ 7c: 残り全画面

**Files（すべて variant `universal`）:**
- Modify: `apps/mobile/src/app/join.tsx`
- Modify: `apps/mobile/src/app/catalog/index.tsx`
- Modify: `apps/mobile/src/app/diagnostics/index.tsx`
- Modify: `apps/mobile/src/app/sandbox/index.tsx`
- Modify: `apps/mobile/src/app/cpu-game/setup.tsx`
- Modify: `apps/mobile/src/app/cpu-game/result.tsx`
- Modify: `apps/mobile/src/app/cpu-game/history.tsx`
- Modify: `apps/mobile/src/app/cpu-game/stats.tsx`
- Modify: `apps/mobile/src/app/cpu-game/settings.tsx`（Task 6 で一部変更済み。レシピの Step 1〜5 を適用）
- Modify: `apps/mobile/src/app/cpu-game/tutorial.tsx`

- [ ] **Step 1:** 各ファイルにレシピ適用。`tutorial.tsx` は `require('*.svg')` の TUTORIAL_IMAGES マップがあるが触らない（画像表示ロジックは不変）。
- [ ] **Step 2:** `cd apps/mobile && npm test && npx tsc --noEmit && npx eslint src/app` → PASS
- [ ] **Step 3:**（可能なら）`/run` でカタログ / 設定 / 履歴を light / dark で開き差分確認、`SendUserFile` で提出。
- [ ] **Step 4: コミット**

```bash
git add apps/mobile/src/app/join.tsx apps/mobile/src/app/catalog/index.tsx apps/mobile/src/app/diagnostics/index.tsx apps/mobile/src/app/sandbox/index.tsx apps/mobile/src/app/cpu-game/setup.tsx apps/mobile/src/app/cpu-game/result.tsx apps/mobile/src/app/cpu-game/history.tsx apps/mobile/src/app/cpu-game/stats.tsx apps/mobile/src/app/cpu-game/settings.tsx apps/mobile/src/app/cpu-game/tutorial.tsx
git commit -m "$(printf '%s\n' '[THEME-SP1] migrate remaining screens to themed styles + AppBackground' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 8: 総合検証

**Files:** なし（検証のみ）

### variant 割当表

| 画面 | variant |
|---|---|
| `app/cpu-game/play.tsx`、`app/online-room/play.tsx` | `battle` |
| `app/index.tsx`、`app/online-room/index.tsx`、`app/online-room/lobby.tsx` | `home` |
| 上記以外の全画面 | `universal` |

- [ ] **Step 1: フルスイート**

Run: `npm run mobile:test` → PASS
Run: `npm run mobile:typecheck` → PASS
Run: `npm run mobile:lint` → PASS
Run: `npm run mobile:format:check` → PASS（落ちたら `npm --prefix apps/mobile run format` で整形しコミット追記）
Run: `npm run ui:test && npm run ui:typecheck` → PASS
Run: `npm run game-core:test` → PASS（無関係だが回帰確認）

- [ ] **Step 2: grep 残渣チェック**

Run: `grep -rn "colors\." apps/mobile/src/app apps/mobile/src/features/cpu-game/CardFace.tsx`
Expected: ヒットゼロ（全て `c.` に移行済み）。ヒットしたら該当ファイルをレシピで再処理。

Run: `grep -rn "#[0-9a-fA-F]\{6\}" apps/mobile/src/app`
Expected: 残った生 hex を確認。意図的に残すもの（`rgba` や `transparent` 以外の視覚 hex）が無いこと。

- [ ] **Step 3: 目視（可能なら）**

`/run` で Expo 起動。設定画面で システム→ライト→ダーク を切り替え、以下を各テーマで確認し `SendUserFile` で提出：
- ホーム、CPU対戦（プレイ中）、カタログ、設定
- 文字が背景から読める（AA 目視）／ボタンが押せると分かる／カード面が判別できる
- テーマ切替が画面遷移なしで即反映される
- アプリ再起動後も選んだテーマが保持される

- [ ] **Step 4: スペックのステータス更新**

`docs/superpowers/specs/2026-09-07-theme-sp1-dark-theme-foundation-design.md` の版数を 0.3 にし、末尾に「実装完了（コミット範囲 <hash>..<hash>）。dark 実値・スクリム不透明度の最終調整は目視結果に基づき別コミット」を追記。

- [ ] **Step 5: コミット**

```bash
git add docs/superpowers/specs/2026-09-07-theme-sp1-dark-theme-foundation-design.md
git commit -m "$(printf '%s\n' '[THEME-SP1] mark SP1 implementation complete' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

- [ ] **Step 6: メモリ更新**

`C:\Users\tetsu\.claude\projects\C--Projects-card-game-app\memory\background-art-set.md` を更新：「SP1 実装済み。`<AppBackground>` と `useTheme`/`useThemedStyles` が導入され、テーマ設定は Home→設定。SP2（UIキット）が次」。`MEMORY.md` の該当行も更新。

---

## Self-Review

**1. Spec coverage:**
- §3 トークン層 → Task 1 ✓
- §4.1 themePreference → Task 2 ✓
- §4.2 themeStore + `_layout` 配線 → Task 3 ✓
- §4.3 ThemeProvider/useTheme/useThemedStyles → Task 4 ✓
- §4.4 案C（day 背景）→ アセットは作成済み、消費は Task 5 ✓
- §4.5 AppBackground + スクリム → Task 5 ✓
- §4.6 画面割当 → Task 7 + Task 8 割当表 ✓
- §4.7 `_layout` header トークン化 + StatusBar → Task 4 ✓
- §5 画面移行レシピ → Task 7 ✓
- §6 テスト計画 → 各 Task のテスト step + Task 8 ✓
- §3.3 tokens.test 追記（キー網羅・hex・AA）→ Task 1 Step 1 ✓

**2. Placeholder scan:** Task 7 レシピ内の import 例に誤記があったため直下に訂正を併記済み（`AppBackground` は `features/theme/AppBackground` から）。他にプレースホルダなし。

**3. Type consistency:**
- `resolveScheme(preference, osScheme)` の引数順は Task 2 定義と Task 4 呼び出しで一致 ✓
- `themeColors` / `ThemeColors` / `ThemeScheme` は Task 1 で定義、Task 4/5 で消費 ✓
- `resolveBackgroundSource(table, scheme, variant)` の引数順は Task 5 定義・テスト・AppBackground 呼び出しで一致 ✓
- `configureThemeStore({ storage })` / `themeStore.getState().load()` は Task 3 定義、`_layout` と設定画面で一致 ✓
- `useThemedStyles(factory)` の `factory` 戻り値：Task 4 は `StyleSheet.create(factory(colors))` するので `factory` は**素の object を返す**。Task 7 レシピもそれに合わせて `makeStyles = (c) => ({...})`（`StyleSheet.create` を外す）と明記 ✓
