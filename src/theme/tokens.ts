/**
 * Design tokens for the "Yörünge" (orbit) direction with the "neon yörünge"
 * colouring approved on the design canvas (page v4). Screens never use raw
 * hex values; they read these through useTheme() so dark/light and a future
 * accent change happen in one place.
 *
 * Dark is the primary look (boards B1–B5): a near-black sky with blue, violet
 * and lime glows and faint stars. Light is the daytime variant (B6).
 *
 * Every category has a fixed neon colour (stored per category in the DB).
 * Its icon sits in a dark box with a thin outline and glow in that colour;
 * the selected category is filled with it. Budget state adds a badge:
 * warning near the budget, danger over it.
 */

export type Palette = {
  /** Screen background. */
  bg: string;
  /** Radial glows painted over the background: top right, left, bottom. */
  glowTop: string;
  glowSide: string;
  glowBottom: string;
  /** Star specks (dark mode only; transparent in light mode). */
  star: string;
  /** Translucent glass fill for round buttons, pills and chips (top → bottom). */
  glassFrom: string;
  glassTo: string;
  /** Opaque fill for things that must hide what is behind them (swiped rows, sheets). */
  surfaceRaised: string;
  /** Selected segment fill on glass. */
  surfaceSelected: string;
  /** 1 px inset ring drawn on glass. */
  hairline: string;
  hairlineStrong: string;
  /** Orbit circles and dashed guides. */
  orbit: string;
  /** Unfilled part of progress rings, bars and dials. */
  track: string;
  /** Center "kalan" core of the orbit view. */
  coreFrom: string;
  coreTo: string;
  /** Inside of a category icon box (top → bottom). */
  tileFrom: string;
  tileTo: string;
  text: string;
  /** Big amounts are drawn with a soft vertical gradient from text to this. */
  textFade: string;
  /** Icons and secondary chip text. */
  textSoft: string;
  textMuted: string;
  /** Hints and tick labels. */
  textFaint: string;
  /** Lime accent, used as a fill (orb, selected chip, current bar). */
  accent: string;
  /** Gradient stops around the accent for the orb. */
  accentFrom: string;
  accentTo: string;
  onAccent: string;
  /** Rings and lines run from the accent into this teal. */
  ringTo: string;
  /** Halo rings around the orb. */
  accentHalo: string;
  accentHaloRing: string;
  /** Income amounts and "spent less" figures. */
  income: string;
  /** Budget badges: close to budget / over budget. */
  warning: string;
  onWarning: string;
  danger: string;
  onDanger: string;
  /** Dim layer behind the category menu and sheets. */
  overlay: string;
  shadow: string;
};

export const dark: Palette = {
  bg: '#06070B',
  glowTop: 'rgba(56,189,248,0.24)',
  glowSide: 'rgba(167,139,250,0.18)',
  glowBottom: 'rgba(212,246,90,0.12)',
  star: '#FFFFFF',
  glassFrom: 'rgba(255,255,255,0.09)',
  glassTo: 'rgba(255,255,255,0.03)',
  surfaceRaised: '#12141D',
  surfaceSelected: 'rgba(255,255,255,0.14)',
  hairline: 'rgba(255,255,255,0.12)',
  hairlineStrong: 'rgba(255,255,255,0.18)',
  orbit: 'rgba(255,255,255,0.10)',
  track: 'rgba(255,255,255,0.07)',
  coreFrom: '#20253A',
  coreTo: '#0C0E17',
  tileFrom: '#161A29',
  tileTo: '#0A0C13',
  text: '#EDEEF2',
  textFade: '#B4B8C8',
  textSoft: '#C9CCD8',
  textMuted: '#9A9FB2',
  textFaint: '#6F7487',
  accent: '#D4F65A',
  accentFrom: '#ECFF9E',
  accentTo: '#A9D62C',
  onAccent: '#07080C',
  ringTo: '#5EEAD4',
  accentHalo: 'rgba(212,246,90,0.07)',
  accentHaloRing: 'rgba(212,246,90,0.22)',
  income: '#D4F65A',
  warning: '#FBBF24',
  onWarning: '#1A1300',
  danger: '#F43F5E',
  onDanger: '#FFFFFF',
  overlay: 'rgba(6,7,11,0.72)',
  shadow: '#000000',
};

export const light: Palette = {
  bg: '#F1F2EC',
  glowTop: 'rgba(56,189,248,0.22)',
  glowSide: 'rgba(167,139,250,0.20)',
  glowBottom: 'rgba(212,246,90,0.40)',
  star: 'transparent',
  glassFrom: 'rgba(255,255,255,0.75)',
  glassTo: 'rgba(255,255,255,0.75)',
  surfaceRaised: '#FFFFFF',
  surfaceSelected: 'rgba(11,12,16,0.08)',
  hairline: 'rgba(11,12,16,0.10)',
  hairlineStrong: 'rgba(11,12,16,0.16)',
  orbit: 'rgba(11,12,16,0.14)',
  track: 'rgba(11,12,16,0.08)',
  coreFrom: '#FFFFFF',
  coreTo: '#E6E8DF',
  tileFrom: '#FFFFFF',
  tileTo: '#FFFFFF',
  text: '#0B0C10',
  textFade: '#3A3E4D',
  textSoft: '#3A3E4D',
  textMuted: '#5B6072',
  textFaint: '#5B6072',
  accent: '#D4F65A',
  accentFrom: '#ECFF9E',
  accentTo: '#A9D62C',
  onAccent: '#0B0C10',
  ringTo: '#0D9488',
  accentHalo: 'rgba(212,246,90,0.35)',
  accentHaloRing: 'rgba(11,12,16,0.10)',
  income: '#3F6B00',
  warning: '#FBBF24',
  onWarning: '#1A1300',
  danger: '#F43F5E',
  onDanger: '#FFFFFF',
  overlay: 'rgba(241,242,236,0.80)',
  shadow: '#0B0C10',
};

export const radius = { sm: 10, tile: 15, rowTile: 12, row: 18, card: 22, cardInner: 21, shell: 26, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 } as const;

/** Sizes that the gesture components and the nav orb share. */
export const size = {
  touch: 44,
  orb: 66,
  /** Category icon box: on the orbit and in menus / selected in menus / in list rows. */
  tile: 46,
  tileSelected: 60,
  rowTile: 36,
  icon: 24,
  row: 64,
  /** Outline of a category box, normal / selected. */
  tileStroke: 1.5,
  tileStrokeSelected: 2,
} as const;

/**
 * Unbounded carries numbers and titles (light weight for big amounts);
 * Manrope carries everything else.
 */
export const font = {
  display: 'Unbounded_300Light',
  displayRegular: 'Unbounded_400Regular',
  displaySemibold: 'Unbounded_600SemiBold',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

/** Text styles from the boards. Letter spacing is in points, as React Native expects. */
export const type = {
  hero: { fontFamily: font.display, fontSize: 50, letterSpacing: -2, lineHeight: 54 },
  amountLarge: { fontFamily: font.display, fontSize: 44, letterSpacing: -1.6, lineHeight: 48 },
  title: { fontFamily: font.display, fontSize: 34, letterSpacing: -1.2, lineHeight: 38 },
  amount: { fontFamily: font.displayRegular, fontSize: 14 },
  amountSmall: { fontFamily: font.displayRegular, fontSize: 12 },
  eyebrow: { fontFamily: font.bold, fontSize: 10, letterSpacing: 2.4 },
  body: { fontFamily: font.regular, fontSize: 15 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 15 },
  label: { fontFamily: font.semibold, fontSize: 13 },
  caption: { fontFamily: font.regular, fontSize: 12 },
  badge: { fontFamily: font.bold, fontSize: 9.5 },
  hint: { fontFamily: font.regular, fontSize: 10.5, letterSpacing: 0.4 },
} as const;

/** rgba() string for a hex colour, e.g. glows and tinted fills. */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(hex: string, target: number, amount: number): string {
  const h = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c + (target - c) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

/**
 * The three tones the neon look needs from one category colour:
 * `base` for outlines, rings and tails, `light` for the icon and label on the
 * dark background, `deep` for the icon and label on the light background.
 * Derived, so a colour a user picks for a custom category works too.
 */
export function categoryTone(hex: string): { base: string; light: string; deep: string } {
  return { base: hex.toUpperCase(), light: mix(hex, 255, 0.3), deep: mix(hex, 0, 0.45) };
}
