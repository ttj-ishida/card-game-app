import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CPU_GAME_TUTORIAL_PAGES,
  DEFAULT_TUTORIAL_PROGRESS,
  parseTutorialProgress,
  serializeTutorialProgress,
  tutorialCoversRequiredTopics,
  clampTutorialIndex,
} from './tutorialModel';

test('CPU tutorial pages cover every required M3-EX-06 topic', () => {
  assert.equal(CPU_GAME_TUTORIAL_PAGES.length, 5);
  assert.equal(tutorialCoversRequiredTopics(), true);
  assert.deepEqual(
    CPU_GAME_TUTORIAL_PAGES.map((page) => page.imageAssetId),
    [
      'm3-tutorial-history-stats',
      'm3-tutorial-lead-update',
      'm3-tutorial-locks',
      'm3-tutorial-strength-order',
      'm3-tutorial-skills',
    ],
  );
});

test('clampTutorialIndex keeps navigation in range', () => {
  assert.equal(clampTutorialIndex(-1), 0);
  assert.equal(clampTutorialIndex(0), 0);
  assert.equal(clampTutorialIndex(3.8), 3);
  assert.equal(clampTutorialIndex(99), CPU_GAME_TUTORIAL_PAGES.length - 1);
  assert.equal(clampTutorialIndex(Number.NaN), 0);
});

test('parseTutorialProgress returns defaults for empty or corrupt storage', () => {
  assert.deepEqual(parseTutorialProgress(null), DEFAULT_TUTORIAL_PROGRESS);
  assert.deepEqual(parseTutorialProgress('not-json'), DEFAULT_TUTORIAL_PROGRESS);
  assert.deepEqual(
    parseTutorialProgress(JSON.stringify({ completed: false })),
    DEFAULT_TUTORIAL_PROGRESS,
  );
});

test('serializeTutorialProgress stores a stable completed shape', () => {
  const raw = serializeTutorialProgress(Date.UTC(2026, 8, 2, 0, 0, 0));
  assert.deepEqual(JSON.parse(raw), {
    completed: true,
    completedAt: '2026-09-02T00:00:00.000Z',
  });
  assert.deepEqual(parseTutorialProgress(raw), {
    completed: true,
    completedAt: '2026-09-02T00:00:00.000Z',
  });
});
