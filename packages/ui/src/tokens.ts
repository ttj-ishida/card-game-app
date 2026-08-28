export const colors = {
  surface: {
    table: {
      day: '#EEF5F1',
      night: '#17202A',
    },
    card: {
      face: '#FAF8F0',
      back: '#2E3147',
    },
  },
  ink: {
    primary: '#1B1D24',
    secondary: '#3B4148',
    inverse: '#F5F2E8',
  },
  suit: {
    fire: '#D84A2B',
    water: '#2577B8',
    wind: '#31886B',
    earth: '#8A6A2A',
  },
  state: {
    warning: '#C28A18',
    disabled: '#8B9098',
  },
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  none: 0,
  control: 6,
  card: 12,
  modal: 16,
  cardSource: 36,
} as const;

export const typography = {
  family: {
    system: 'system',
  },
  size: {
    caption: 12,
    body: 16,
    title: 22,
    cardRank: 64,
  },
  weight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },
  letterSpacing: 0,
} as const;

export const card = {
  aspectRatio: 5 / 7,
  source: {
    width: 750,
    height: 1050,
  },
  display: {
    thumbnail: { width: 150, height: 210 },
    catalog: { width: 250, height: 350 },
    detail: { width: 500, height: 700 },
  },
  bounds: {
    outerBleed: 24,
    safeArea: { x: 60, y: 84, width: 630, height: 882 },
    essentialTextArea: { x: 90, y: 126, width: 570, height: 798 },
  },
} as const;

export const designTokens = {
  colors,
  spacing,
  radius,
  typography,
  card,
} as const;

export type DesignTokens = typeof designTokens;
export type ColorTokens = typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type TypographySizeToken = keyof typeof typography.size;
