export type FabPosition = { x: number; y: number };

export const FAB_POSITION_STORAGE_KEY = 'card-game-app:fab-position:v1';
export const FAB_SIZE = 52;

/** Keep the FAB centre inside `frame` with `margin` breathing room. */
export function clampFabPosition(
  pos: FabPosition,
  frame: { width: number; height: number },
  fabSize = FAB_SIZE,
  margin = 8,
): FabPosition {
  const half = fabSize / 2;
  const min = half + margin;
  return {
    x: clamp(pos.x, min, Math.max(min, frame.width - min)),
    y: clamp(pos.y, min, Math.max(min, frame.height - min)),
  };
}

/** Default resting place: bottom-left, matching the pre-drag layout. */
export function defaultFabPosition(frame: { width: number; height: number }): FabPosition {
  return { x: 16 + FAB_SIZE / 2, y: frame.height - 16 - FAB_SIZE / 2 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function parseFabPosition(raw: string | null): FabPosition | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeFabPosition(pos: FabPosition): string {
  return JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) });
}
