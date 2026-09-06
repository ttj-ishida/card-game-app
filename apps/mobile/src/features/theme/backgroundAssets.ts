import type { BackgroundTable } from './resolveBackgroundSource';

/**
 * Master Duel-style backdrops, one per (scheme, variant). PNGs live outside the
 * SVG generate/check pipeline; see `assets/backgrounds/README.md`.
 */
export const backgroundAssets: BackgroundTable = {
  dark: {
    battle: require('../../../../../assets/backgrounds/ragnarok-battle-bg.png'),
    home: require('../../../../../assets/backgrounds/ragnarok-home-bg.png'),
    universal: require('../../../../../assets/backgrounds/ragnarok-bg-universal.png'),
  },
  light: {
    battle: require('../../../../../assets/backgrounds/ragnarok-battle-bg-day.png'),
    home: require('../../../../../assets/backgrounds/ragnarok-home-bg-day.png'),
    universal: require('../../../../../assets/backgrounds/ragnarok-bg-universal-day.png'),
  },
};
