export type AnimationSpeed = 'FAST' | 'NORMAL' | 'SLOW';

export type CpuGameSettings = {
  animationSpeed: AnimationSpeed;
  lowMotion: boolean;
};

export const CPU_GAME_SETTINGS_STORAGE_KEY = 'card-game-app:cpu-game-settings:v1';

export const DEFAULT_CPU_GAME_SETTINGS: CpuGameSettings = {
  animationSpeed: 'NORMAL',
  lowMotion: false,
};

const SPEEDS = new Set<AnimationSpeed>(['FAST', 'NORMAL', 'SLOW']);

export function parseCpuGameSettings(raw: string | null): CpuGameSettings {
  if (!raw) return DEFAULT_CPU_GAME_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<CpuGameSettings>;
    if (!SPEEDS.has(parsed.animationSpeed as AnimationSpeed)) {
      return DEFAULT_CPU_GAME_SETTINGS;
    }
    if (typeof parsed.lowMotion !== 'boolean') {
      return DEFAULT_CPU_GAME_SETTINGS;
    }
    return {
      animationSpeed: parsed.animationSpeed as AnimationSpeed,
      lowMotion: parsed.lowMotion,
    };
  } catch {
    return DEFAULT_CPU_GAME_SETTINGS;
  }
}

export function serializeCpuGameSettings(settings: CpuGameSettings): string {
  return JSON.stringify({
    animationSpeed: settings.animationSpeed,
    lowMotion: settings.lowMotion,
  });
}

export function scaleThinkMillis(ms: number, settings: CpuGameSettings): number {
  const multiplier =
    settings.animationSpeed === 'FAST' ? 0.5 : settings.animationSpeed === 'SLOW' ? 1.4 : 1;
  return Math.round(ms * multiplier);
}
