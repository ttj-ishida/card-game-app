import assert from 'node:assert/strict';
import { test } from 'node:test';

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

test('default preference is system', () => {
  assert.equal(DEFAULT_THEME_PREFERENCE, 'system');
});

test('parse returns default for null / garbage / unknown value', () => {
  assert.equal(parseThemePreference(null), 'system');
  assert.equal(parseThemePreference(''), 'system');
  assert.equal(parseThemePreference('not json'), 'system');
  assert.equal(parseThemePreference('{}'), 'system');
  assert.equal(parseThemePreference('{"preference":"sepia"}'), 'system');
  assert.equal(parseThemePreference('{"preference":42}'), 'system');
});

test('parse round-trips every valid preference', () => {
  for (const preference of ['system', 'light', 'dark'] as const) {
    assert.equal(parseThemePreference(serializeThemePreference(preference)), preference);
  }
});

test('resolveScheme: explicit light/dark ignores OS', () => {
  assert.equal(resolveScheme('light', 'dark'), 'light');
  assert.equal(resolveScheme('dark', 'light'), 'dark');
  assert.equal(resolveScheme('light', null), 'light');
  assert.equal(resolveScheme('dark', null), 'dark');
});

test('resolveScheme: system follows OS, falls back to dark when OS unknown', () => {
  assert.equal(resolveScheme('system', 'light'), 'light');
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', null), 'dark');
});
