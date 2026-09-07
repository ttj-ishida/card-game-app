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
