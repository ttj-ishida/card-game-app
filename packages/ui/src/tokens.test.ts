import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  card,
  colors,
  darkColors,
  designTokens,
  radius,
  spacing,
  themeColors,
  typography,
} from './tokens.ts';

test('design tokens expose M0 color roles', () => {
  assert.equal(colors.surface.table.day, '#EEF5F1');
  assert.equal(colors.surface.table.night, '#17202A');
  assert.equal(colors.suit.fire, '#D84A2B');
  assert.equal(colors.suit.water, '#2577B8');
  assert.equal(colors.suit.wind, '#31886B');
  assert.equal(colors.suit.earth, '#8A6A2A');
});

test('spacing, typography, and radius tokens are stable primitives', () => {
  assert.deepEqual(Object.keys(spacing), ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl']);
  assert.equal(radius.control, 6);
  assert.equal(radius.card, 12);
  assert.equal(typography.letterSpacing, 0);
  assert.equal(typography.weight.bold, '700');
});

test('card tokens match the accepted M0-GR-02 template', () => {
  assert.equal(card.aspectRatio, 5 / 7);
  assert.equal(card.source.width, 750);
  assert.equal(card.source.height, 1050);
  assert.equal(card.display.catalog.width, 250);
  assert.equal(card.display.catalog.height, 350);
  assert.equal(card.bounds.safeArea.x + card.bounds.safeArea.width, 690);
  assert.equal(card.bounds.safeArea.y + card.bounds.safeArea.height, 966);
});

test('designTokens groups all public token categories', () => {
  assert.deepEqual(Object.keys(designTokens), ['colors', 'spacing', 'radius', 'typography', 'card']);
});

// --- THEME-SP1: dark token set ---

function leafPaths(obj: unknown, prefix = ''): string[] {
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

function leafValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj);
}

test('darkColors has exactly the same shape as colors', () => {
  assert.deepStrictEqual(leafPaths(darkColors).sort(), leafPaths(colors).sort());
});

test('every darkColors leaf is a #RRGGBB string', () => {
  for (const path of leafPaths(darkColors)) {
    const value = leafValue(darkColors, path);
    assert.match(String(value), /^#[0-9A-Fa-f]{6}$/, `${path} = ${String(value)}`);
  }
});

test('themeColors maps light->colors and dark->darkColors', () => {
  assert.strictEqual(themeColors.light, colors);
  assert.strictEqual(themeColors.dark, darkColors);
});

function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [hi, lo] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

test('primary text on panel meets WCAG AA (4.5:1) in both themes', () => {
  assert.ok(
    contrastRatio(colors.ink.primary, colors.surface.card.face) >= 4.5,
    'light ink/panel contrast too low',
  );
  assert.ok(
    contrastRatio(darkColors.ink.primary, darkColors.surface.card.face) >= 4.5,
    'dark ink/panel contrast too low',
  );
});
