import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_CPU_GAME_SETTINGS,
  parseCpuGameSettings,
  scaleThinkMillis,
  serializeCpuGameSettings,
} from './cpuGameSettings';

test('parseCpuGameSettings returns defaults for missing, corrupt, or unknown values', () => {
  assert.deepEqual(parseCpuGameSettings(null), DEFAULT_CPU_GAME_SETTINGS);
  assert.deepEqual(parseCpuGameSettings('not-json'), DEFAULT_CPU_GAME_SETTINGS);
  assert.deepEqual(
    parseCpuGameSettings(JSON.stringify({ animationSpeed: 'TURBO', lowMotion: true })),
    DEFAULT_CPU_GAME_SETTINGS,
  );
});

test('parseCpuGameSettings accepts every known animation speed and lowMotion flag', () => {
  assert.deepEqual(
    parseCpuGameSettings(JSON.stringify({ animationSpeed: 'FAST', lowMotion: true })),
    {
      animationSpeed: 'FAST',
      lowMotion: true,
    },
  );
  assert.deepEqual(
    parseCpuGameSettings(JSON.stringify({ animationSpeed: 'SLOW', lowMotion: false })),
    {
      animationSpeed: 'SLOW',
      lowMotion: false,
    },
  );
});

test('serializeCpuGameSettings stores the stable v1 shape', () => {
  assert.deepEqual(
    JSON.parse(serializeCpuGameSettings({ animationSpeed: 'FAST', lowMotion: true })),
    {
      animationSpeed: 'FAST',
      lowMotion: true,
    },
  );
});

test('scaleThinkMillis applies deterministic speed multipliers', () => {
  assert.equal(scaleThinkMillis(1000, { animationSpeed: 'NORMAL', lowMotion: false }), 1000);
  assert.equal(scaleThinkMillis(1000, { animationSpeed: 'FAST', lowMotion: false }), 500);
  assert.equal(scaleThinkMillis(1000, { animationSpeed: 'SLOW', lowMotion: true }), 1400);
});
