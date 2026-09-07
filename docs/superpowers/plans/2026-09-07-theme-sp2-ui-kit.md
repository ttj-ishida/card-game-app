# THEME-SP2 UIキット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans または subagent-driven-development。ステップは `- [ ]`。

**Goal:** `Button` / `Panel` / `Chip` / `ScreenTitle` を新設し、13画面の手書きボタン/チップ/パネルを置換してマスターデュエル風の統一UIにする。

**Architecture:** コンポーネントは `apps/mobile/src/components/`（RNコアのみ）。variant→style 解決は純関数 `resolveButtonVisual` に切り出して単体テスト。各画面は `useThemedStyles` を保ちつつ、ボタン/チップ/パネル/見出しをコンポーネントへ委譲し `makeStyles` を痩せさせる。

**Spec:** `docs/superpowers/specs/2026-09-07-theme-sp2-ui-kit-design.md`（v0.1 + レビュー確定：パネル半透明 / ACCENT `#C9A94E` / Button は label API）

## Global Constraints

（スペック §2 を参照。要点）
- 依存追加なし。`packages/ui` 不変。コンポーネントは `apps/mobile/src/components/`。
- `.ts` テストのみ（RTL なし）。コンポーネント単体テストはしない。`resolveButtonVisual` をテストする。
- `onPress` / `disabled` / `accessibilityRole` / `accessibilityState` / `accessibilityLabel` を欠落させない。機能回帰ゼロ、既存342テスト緑。
- コミット `main` 直、`[THEME-SP2]`、明示パスのみ `git add`、末尾 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- 別セッションが `online-room/lobby.tsx` / `onlineRoom*` を編集中のことがある → その移行は最後（Task 6）に回し、未コミットならスキップして申し送る。

---

## Task 1: buttonStyle 純ロジック

**Files:** Create `apps/mobile/src/components/buttonStyle.ts` / `buttonStyle.test.ts`

**Interfaces (Produces):**
- `const ACCENT = '#C9A94E'`
- `type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'`
- `type ButtonVisual = { container: ViewStyle; text: TextStyle }`
- `function resolveButtonVisual(c: ThemeColors, variant: ButtonVariant, opts: { disabled: boolean; selected: boolean }): ButtonVisual`

- [ ] **Step 1: 失敗するテスト** — `buttonStyle.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { colors, darkColors } from '@ragnarok-millennium/ui';
import { ACCENT, resolveButtonVisual } from './buttonStyle.ts';

const base = { disabled: false, selected: false };

test('primary uses ink.primary bg and ink.inverse text', () => {
  const v = resolveButtonVisual(colors, 'primary', base);
  assert.equal(v.container.backgroundColor, colors.ink.primary);
  assert.equal(v.text.color, colors.ink.inverse);
});

test('secondary is card-face bg with accent border and ink.primary text', () => {
  const v = resolveButtonVisual(darkColors, 'secondary', base);
  assert.equal(v.container.borderColor, ACCENT);
  assert.equal(v.text.color, darkColors.ink.primary);
});

test('ghost has no background, secondary-ink text', () => {
  const v = resolveButtonVisual(colors, 'ghost', base);
  assert.equal(v.container.backgroundColor, undefined);
  assert.equal(v.text.color, colors.ink.secondary);
});

test('danger uses suit.fire for border and text', () => {
  const v = resolveButtonVisual(colors, 'danger', base);
  assert.equal(v.container.borderColor, colors.suit.fire);
  assert.equal(v.text.color, colors.suit.fire);
});

test('selected overlays a 2px accent border on any variant', () => {
  for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
    const v = resolveButtonVisual(colors, variant, { ...base, selected: true });
    assert.equal(v.container.borderColor, ACCENT);
    assert.equal(v.container.borderWidth, 2);
  }
});

test('disabled does not change container/text colours (opacity handled by Pressable)', () => {
  const on = resolveButtonVisual(colors, 'primary', base);
  const off = resolveButtonVisual(colors, 'primary', { ...base, disabled: true });
  assert.deepEqual(off, on);
});
```

- [ ] **Step 2:** `cd apps/mobile && npx tsx --test src/components/buttonStyle.test.ts` → FAIL
- [ ] **Step 3: 実装** — `buttonStyle.ts`:

```ts
import type { TextStyle, ViewStyle } from 'react-native';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

export const ACCENT = '#C9A94E';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonVisual = { container: ViewStyle; text: TextStyle };

export function resolveButtonVisual(
  c: ThemeColors,
  variant: ButtonVariant,
  opts: { disabled: boolean; selected: boolean },
): ButtonVisual {
  const base: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  };
  const text: TextStyle = {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  };

  let container: ViewStyle;
  switch (variant) {
    case 'primary':
      container = { ...base, backgroundColor: c.ink.primary, borderColor: c.ink.primary };
      text.color = c.ink.inverse;
      break;
    case 'secondary':
      container = { ...base, backgroundColor: withAlpha(c.surface.card.face, 0.86), borderColor: ACCENT };
      text.color = c.ink.primary;
      break;
    case 'ghost':
      container = { ...base };
      text.color = c.ink.secondary;
      break;
    case 'danger':
      container = { ...base, backgroundColor: withAlpha(c.surface.card.face, 0.86), borderColor: c.suit.fire };
      text.color = c.suit.fire;
      break;
  }

  if (opts.selected) {
    container.borderColor = ACCENT;
    container.borderWidth = 2;
  }
  return { container, text };
}

// #RRGGBB -> rgba(r,g,b,a)
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 4:** `npx tsx --test src/components/buttonStyle.test.ts` → PASS。`npx tsc --noEmit` → 0。
- [ ] **Step 5: コミット**

```bash
git add apps/mobile/src/components/buttonStyle.ts apps/mobile/src/components/buttonStyle.test.ts
git commit -m "$(printf '%s\n' '[THEME-SP2] button visual resolver + ACCENT' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 2: コンポーネント4種 + バレル

**Files:** Create `Button.tsx` / `Chip.tsx` / `Panel.tsx` / `ScreenTitle.tsx` / `index.ts`（全て `apps/mobile/src/components/`）

**Interfaces (Produces):** スペック §4.1〜4.4 の props 型そのまま。

- [ ] **Step 1: `Button.tsx`**

```tsx
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../features/theme/ThemeProvider';
import { resolveButtonVisual, type ButtonVariant } from './buttonStyle';

export type { ButtonVariant };

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  minWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  selected = false,
  accessibilityLabel,
  minWidth,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const visual = resolveButtonVisual(colors, variant, { disabled, selected });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        visual.container,
        minWidth != null && { minWidth },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={visual.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
```

- [ ] **Step 2: `Chip.tsx`**

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing, typography } from '@ragnarok-millennium/ui';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type ChipProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function Chip({
  label,
  onPress,
  selected = false,
  disabled = false,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: colors.surface.card.face,
          borderColor: selected ? ACCENT : colors.state.disabled,
          borderWidth: selected ? 2 : 1,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={{
          color: selected ? colors.ink.primary : colors.ink.secondary,
          fontSize: typography.size.body,
          fontWeight: selected ? typography.weight.bold : typography.weight.regular,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 48,
    alignItems: 'center',
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
```

- [ ] **Step 3: `Panel.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@ragnarok-millennium/ui';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type PanelProps = {
  children: ReactNode;
  tone?: 'default' | 'flat';
  style?: StyleProp<ViewStyle>;
};

export function Panel({ children, tone = 'default', style }: PanelProps) {
  const { colors } = useTheme();
  const r = parseInt(colors.surface.card.face.slice(1, 3), 16);
  const g = parseInt(colors.surface.card.face.slice(3, 5), 16);
  const b = parseInt(colors.surface.card.face.slice(5, 7), 16);
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: `rgba(${r}, ${g}, ${b}, 0.86)`,
          borderColor: colors.state.disabled,
          borderTopColor: tone === 'flat' ? colors.state.disabled : ACCENT,
          borderTopWidth: tone === 'flat' ? 1 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.modal,
    padding: spacing.md,
  },
});
```

- [ ] **Step 4: `ScreenTitle.tsx`**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@ragnarok-millennium/ui';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';

export type ScreenTitleProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export function ScreenTitle({ title, subtitle, right }: ScreenTitleProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { borderLeftColor: ACCENT }]}>
        <Text
          style={{
            color: colors.ink.primary,
            fontSize: typography.size.title,
            fontWeight: typography.weight.bold,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: colors.ink.secondary,
              fontSize: typography.size.caption,
              marginTop: spacing.xs,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bar: { borderLeftWidth: 3, paddingLeft: spacing.sm },
});
```

- [ ] **Step 5: `index.ts`**

```ts
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { Chip, type ChipProps } from './Chip';
export { Panel, type PanelProps } from './Panel';
export { ScreenTitle, type ScreenTitleProps } from './ScreenTitle';
export { ACCENT } from './buttonStyle';
```

- [ ] **Step 6:** `npx tsc --noEmit` → 0。`npx tsx --test "src/**/*.test.ts"` → 342 + 6 pass。`npx eslint src/components` → 0。`npx prettier --write src/components/*`。
- [ ] **Step 7: コミット**

```bash
git add apps/mobile/src/components/Button.tsx apps/mobile/src/components/Chip.tsx apps/mobile/src/components/Panel.tsx apps/mobile/src/components/ScreenTitle.tsx apps/mobile/src/components/index.ts
git commit -m "$(printf '%s\n' '[THEME-SP2] core UI kit: Button/Chip/Panel/ScreenTitle' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 3: 画面移行バッチ A（軽量）

**Files:** `src/app/index.tsx` / `src/app/online-room/index.tsx` / `src/app/cpu-game/setup.tsx` / `src/app/cpu-game/result.tsx`

移行レシピ（スペック §5.2）を各ファイルに適用：
- ボタンの `<Pressable style={styles.primary}><Text style={styles.primaryText}>…</Text></Pressable>` → `<Button variant=… label={…} onPress={…} disabled={…} />`
- チップ → `<Chip …>`
- 見出し `<Text style={styles.title}>` (+ subtitle) → `<ScreenTitle title subtitle />`
- 枠付きパネル → `<Panel>` / `<Panel tone="flat">`
- 使わなくなった `makeStyles` キーを削除。`makeStyles` が `screen: { flex: 1 }` だけになったら `useThemedStyles` 呼び出しごと削除可（ただし他の `styles.*` が残るなら維持）。

- [ ] **Step 1:** 4ファイル移行
- [ ] **Step 2:** `npx tsc --noEmit` 0 / `npx tsx --test "src/**/*.test.ts"` 全緑 / `npx eslint src/app/index.tsx src/app/online-room/index.tsx src/app/cpu-game/setup.tsx src/app/cpu-game/result.tsx` 0 / `npx prettier --write` 対象4ファイル
- [ ] **Step 3:**（可能なら）`/run` でホームと対戦セットアップを light/dark 表示、`SendUserFile`
- [ ] **Step 4: コミット**

```bash
git add apps/mobile/src/app/index.tsx apps/mobile/src/app/online-room/index.tsx apps/mobile/src/app/cpu-game/setup.tsx apps/mobile/src/app/cpu-game/result.tsx
git commit -m "$(printf '%s\n' '[THEME-SP2] migrate home/setup/result screens to UI kit' '' 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 4: 画面移行バッチ B（対戦画面）

**Files:** `src/app/cpu-game/play.tsx` / `src/app/online-room/play.tsx`

- ボタン（`actionBtn` / `actionBtnGhost` / `actionBtnSelected`）→ `<Button variant selected>`。
- Joker宣言の `pickerCell` / `pickerCellOn` トグル群 → `<Chip selected>`。
- `skillPanel` / `oppPanel` / `historyPanel` / `trailPanel` → `<Panel>`（履歴は `tone="flat"`）。
- 上部 `topBar` の見出し的テキストは `ScreenTitle` にせず現状の小テキストのまま（画面固有情報なので）。

- [ ] **Step 1:** 2ファイル移行
- [ ] **Step 2:** `tsc` 0 / test 全緑 / `eslint` 対象 0 / `prettier --write`
- [ ] **Step 3:**（可能なら）`/run` で CPU 対戦を1手進め、ボタン/チップ/カードの見た目・押下を light/dark 確認、`SendUserFile`
- [ ] **Step 4: コミット** — `[THEME-SP2] migrate battle screens to UI kit`

---

## Task 5: 画面移行バッチ C（残り）

**Files:** `src/app/cpu-game/{history,stats,settings,tutorial}.tsx` / `src/app/catalog/index.tsx` / `src/app/diagnostics/index.tsx` / `src/app/sandbox/index.tsx` / `src/app/join.tsx`

- 各画面のボタン/チップ/パネル/見出しをレシピで置換。
- `settings.tsx` の「テーマ」「演出速度」の Chip 群 → `<Chip>`。
- `sandbox.tsx` は数が多いので慎重に。`CardChip`（sandbox内）はそのまま（SP4 予定、`CardFace` と同じ扱い）。
- `catalog` の `card` / `detailCard` はカード見た目なので `<Panel>` にせず据え置き（枠色だけ `ACCENT` 寄せは任意）。

- [ ] **Step 1:** 9ファイル移行
- [ ] **Step 2:** `tsc` 0 / test 全緑 / `eslint src/app` 0 / `prettier --write "src/app/**/*.tsx"`
- [ ] **Step 3:**（可能なら）`/run` でカタログ・設定・履歴を light/dark 確認、`SendUserFile`
- [ ] **Step 4: コミット** — `[THEME-SP2] migrate remaining screens to UI kit`

---

## Task 6: lobby + CardFace + 総合検証

- [ ] **Step 1: `online-room/lobby.tsx`** — `git status` を確認。別セッションの未コミット変更があれば **スキップして申し送り**。無ければレシピで移行（refresh=secondary、start=primary、seatRow/section=Panel、title=ScreenTitle）。
- [ ] **Step 2: `CardFace.tsx`** — `<Panel>` は使わず、`styles.card` の `borderColor` を suit 色のままにしつつ、Joker バッジ地を `ACCENT` に寄せる程度（見た目の本格変更は SP4）。
- [ ] **Step 3: 総合検証**
  - `npm run mobile:test` 342+ / `npm run mobile:typecheck` 0 / `npm run mobile:lint` 0 / `npm run mobile:format:check` clean
  - `npm run ui:test` / `npm run game-core:test`
  - `grep -rnE "styles\.(primary|secondary|ghost|chip|actionBtn|primaryButton|secondaryButton|ghostButton)" apps/mobile/src/app` → ゼロ（lobby がスキップならそれだけ残ってよい）
- [ ] **Step 4:** スペック `2026-09-07-theme-sp2-ui-kit-design.md` を版数 0.2 にしステータス「実装完了（コミット範囲）」を追記。
- [ ] **Step 5: コミット** — `[THEME-SP2] CardFace accent + mark SP2 complete`
- [ ] **Step 6:** メモリ `background-art-set.md` と `MEMORY.md` を「SP2 完了、次 SP3」に更新。
- [ ] **Step 7:** `git push origin main`

---

## Self-Review

- スペック §4（API）→ Task 2 で全4コンポーネント + `buttonStyle` ✓
- §3（意匠）→ `resolveButtonVisual` / `Panel`（0.86・金トップ）/ `ScreenTitle`（金縦バー）/ `Chip`（selected=金2px）✓
- §5.1 置換表 → Task 3〜6 のバッチが全13画面 + CardFace を網羅（index, online-room/index, setup, result, play×2, history, stats, settings, tutorial, catalog, diagnostics, sandbox, join, lobby）✓
- §6 テスト → Task 1 の `buttonStyle.test.ts` + 各 Task の回帰/静的/目視 ✓
- 型整合：`resolveButtonVisual(c, variant, opts)` は Task 1 定義と Button.tsx 呼び出しで一致。`ACCENT` は `buttonStyle.ts` から全コンポーネントが import ✓
- プレースホルダなし（`/run` 目視は「可能なら」で明示、環境非依存）
