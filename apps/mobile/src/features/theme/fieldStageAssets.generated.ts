// Hand-maintained per docs/art/SP4-GR-01-number-card-art.md § Field stage
// backdrop. Maps a field-stage key (see fieldStageArt.ts `fieldStageKey`) to
// a lazy require() thunk for a bundled PNG (thunks keep this module
// import-safe under `node --test`).
export const fieldStageAssets: Partial<Record<string, () => number>> = {
  'field-stage-dark': () => require('../../../../../assets/backgrounds/field-stage-dark.png'),
  'field-stage-light': () => require('../../../../../assets/backgrounds/field-stage-light.png'),
};
