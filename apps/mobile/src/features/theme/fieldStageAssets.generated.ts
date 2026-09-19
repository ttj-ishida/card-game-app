// Hand-maintained until SP4b lands the 2 field-stage PNGs (see
// docs/art/SP4-GR-01-number-card-art.md § Field stage backdrop). Maps a
// field-stage key (see fieldStageArt.ts `fieldStageKey`) to a lazy require()
// thunk for a bundled PNG (thunks keep this module import-safe under `node --test`).
export const fieldStageAssets: Partial<Record<string, () => number>> = {};
