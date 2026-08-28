import assert from 'node:assert/strict';
import { test } from 'node:test';

import { card, colors, designTokens, radius, spacing, typography } from './tokens.ts';

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
