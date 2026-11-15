import { AestheticSettings, ThemePreset } from './types';

export interface ThemePresetDefinition {
  id: ThemePreset;
  label: string;
  tagline: string;
  accent: string;
  accentHighlight: string;
  panelRgb: string;
  cardTopRgb: string;
  cardBottomRgb: string;
  playerRgb: string;
  activeCardStartRgb: string;
  activeCardEndRgb: string;
  ambientPrimary: string;
  ambientSecondary: string;
  previewGradient: string;
  swatchClass: string;
}

export const THEME_DEFINITIONS: Record<ThemePreset, ThemePresetDefinition> = {
  'night-city': {
    id: 'night-city',
    label: 'Night City',
    tagline: 'Slate midnight glass & warm copper',
    accent: '#C28356',
    accentHighlight: '#E89B63',
    panelRgb: '20, 22, 29',
    cardTopRgb: '44, 52, 58',
    cardBottomRgb: '22, 27, 34',
    playerRgb: '32, 34, 41',
    activeCardStartRgb: '82, 74, 70',
    activeCardEndRgb: '36, 35, 40',
    ambientPrimary: 'rgba(194, 131, 86, 0.34)',
    ambientSecondary: 'rgba(24, 38, 68, 0.48)',
    previewGradient: 'linear-gradient(135deg, #2d1e17 0%, #161d2e 55%, #090b10 100%)',
    swatchClass: 'from-[#C28356] to-[#1b2236]',
  },
  'minimal-dark': {
    id: 'minimal-dark',
    label: 'Minimal Dark',
    tagline: 'Crisp obsidian frost & silver contrast',
    accent: '#D4D4D8',
    accentHighlight: '#F4F4F5',
    panelRgb: '14, 14, 17',
    cardTopRgb: '30, 30, 35',
    cardBottomRgb: '13, 13, 16',
    playerRgb: '18, 18, 22',
    activeCardStartRgb: '48, 48, 54',
    activeCardEndRgb: '20, 20, 24',
    ambientPrimary: 'rgba(161, 161, 170, 0.16)',
    ambientSecondary: 'rgba(16, 16, 20, 0.72)',
    previewGradient: 'linear-gradient(135deg, #27272a 0%, #121215 58%, #08080a 100%)',
    swatchClass: 'from-zinc-300 to-zinc-950',
  },
  'cozy-room': {
    id: 'cozy-room',
    label: 'Cozy Room',
    tagline: 'Warm espresso walnut & candlelit amber',
    accent: '#DDA15E',
    accentHighlight: '#F2CC8F',
    panelRgb: '34, 24, 19',
    cardTopRgb: '56, 39, 29',
    cardBottomRgb: '25, 17, 13',
    playerRgb: '40, 29, 23',
    activeCardStartRgb: '98, 68, 46',
    activeCardEndRgb: '42, 28, 20',
    ambientPrimary: 'rgba(221, 161, 94, 0.38)',
    ambientSecondary: 'rgba(88, 47, 24, 0.54)',
    previewGradient: 'linear-gradient(135deg, #4b2e1b 0%, #2b1a12 58%, #130b08 100%)',
    swatchClass: 'from-[#F2CC8F] to-[#3a2214]',
  },
  'velvet-noir': {
    id: 'velvet-noir',
    label: 'Velvet Noir',
    tagline: 'Deep wine plum & muted rose-gold silk',
    accent: '#D4728A',
    accentHighlight: '#F09BB0',
    panelRgb: '26, 15, 22',
    cardTopRgb: '48, 27, 40',
    cardBottomRgb: '20, 11, 17',
    playerRgb: '32, 18, 27',
    activeCardStartRgb: '92, 46, 70',
    activeCardEndRgb: '36, 18, 28',
    ambientPrimary: 'rgba(212, 114, 138, 0.34)',
    ambientSecondary: 'rgba(64, 22, 48, 0.56)',
    previewGradient: 'linear-gradient(135deg, #53233c 0%, #24101d 58%, #0e070c 100%)',
    swatchClass: 'from-[#F09BB0] to-[#301325]',
  },
  'midnight-ocean': {
    id: 'midnight-ocean',
    label: 'Midnight Ocean',
    tagline: 'Pelagic indigo glass & cool sea-cyan glow',
    accent: '#4BB2C5',
    accentHighlight: '#7ED8E8',
    panelRgb: '12, 22, 32',
    cardTopRgb: '24, 42, 58',
    cardBottomRgb: '10, 17, 26',
    playerRgb: '16, 28, 40',
    activeCardStartRgb: '32, 74, 96',
    activeCardEndRgb: '15, 32, 44',
    ambientPrimary: 'rgba(75, 178, 197, 0.30)',
    ambientSecondary: 'rgba(13, 42, 68, 0.58)',
    previewGradient: 'linear-gradient(135deg, #1b4b63 0%, #0d2033 58%, #060d17 100%)',
    swatchClass: 'from-[#7ED8E8] to-[#0b1f30]',
  },
  'sakura-haze': {
    id: 'sakura-haze',
    label: 'Sakura Haze',
    tagline: 'Evening twilight slate & soft cherry blossom',
    accent: '#D89AA8',
    accentHighlight: '#F2C0CC',
    panelRgb: '28, 22, 30',
    cardTopRgb: '50, 39, 53',
    cardBottomRgb: '22, 17, 24',
    playerRgb: '34, 27, 37',
    activeCardStartRgb: '90, 62, 79',
    activeCardEndRgb: '36, 26, 38',
    ambientPrimary: 'rgba(216, 154, 168, 0.34)',
    ambientSecondary: 'rgba(66, 42, 68, 0.52)',
    previewGradient: 'linear-gradient(135deg, #5c3b50 0%, #2a1e2d 58%, #110c14 100%)',
    swatchClass: 'from-[#F2C0CC] to-[#2c1e2e]',
  },
  custom: {
    id: 'custom',
    label: 'Custom Studio',
    tagline: 'Your uploaded wallpaper & studio tuning',
    accent: '#C28356',
    accentHighlight: '#E89B63',
    panelRgb: '20, 22, 28',
    cardTopRgb: '40, 44, 52',
    cardBottomRgb: '20, 22, 28',
    playerRgb: '28, 30, 38',
    activeCardStartRgb: '72, 66, 68',
    activeCardEndRgb: '32, 33, 38',
    ambientPrimary: 'rgba(194, 131, 86, 0.30)',
    ambientSecondary: 'rgba(20, 24, 34, 0.52)',
    previewGradient: 'linear-gradient(135deg, #3b2a1f 0%, #202430 55%, #0c0d12 100%)',
    swatchClass: 'from-amber-400 to-stone-900',
  },
};

export const STUDIO_THEME_ORDER: readonly ThemePreset[] = [
  'night-city',
  'minimal-dark',
  'cozy-room',
  'velvet-noir',
  'midnight-ocean',
  'sakura-haze',
];

export const ALL_THEME_ORDER: readonly ThemePreset[] = [...STUDIO_THEME_ORDER, 'custom'];

export const ACCENT_SWATCHES = [
  { label: 'Copper', color: '#C28356' },
  { label: 'Honey', color: '#DDA15E' },
  { label: 'Silver', color: '#E4E4E7' },
  { label: 'Rose', color: '#E17A8C' },
  { label: 'Sage', color: '#7EB09B' },
  { label: 'Ice Blue', color: '#7DA6D8' },
] as const;

export function hexToRgbTuple(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function brightenRgb([r, g, b]: [number, number, number], amount = 34): [number, number, number] {
  return [
    Math.min(255, r + amount),
    Math.min(255, g + amount),
    Math.min(255, b + amount),
  ];
}

export function resolveFontFamilyCss(fontFamily: AestheticSettings['fontFamily']): string {
  switch (fontFamily) {
    case 'editorial':
      return '"Playfair Display", Georgia, "Times New Roman", serif';
    case 'mono':
      return '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    case 'modern':
    default:
      return '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
}

export function resolveClockFontFamilyCss(fontFamily: AestheticSettings['fontFamily']): string {
  switch (fontFamily) {
    case 'editorial':
      return '"Playfair Display", Georgia, serif';
    case 'mono':
      return '"JetBrains Mono", ui-monospace, monospace';
    case 'modern':
    default:
      return '"Antonio", "Oswald", sans-serif';
  }
}

export interface ResolvedThemeTokens {
  def: ThemePresetDefinition;
  accent: string;
  accentHighlight: string;
  accentRgb: string;
  accentHighlightRgb: string;
  panelAlpha: number;
  cardTopAlpha: number;
  cardBottomAlpha: number;
  fontFamilyCss: string;
  clockFontFamilyCss: string;
}

export function getThemeTokens(settings: AestheticSettings): ResolvedThemeTokens {
  const def = THEME_DEFINITIONS[settings.theme] || THEME_DEFINITIONS['night-city'];
  const rawCustomAccent = settings.accentColor?.trim();
  const validCustomRgb = rawCustomAccent ? hexToRgbTuple(rawCustomAccent) : null;
  const baseAccent = validCustomRgb ? rawCustomAccent! : def.accent;
  const parsed = validCustomRgb || hexToRgbTuple(def.accent) || [194, 131, 86];
  const isNeutralMinimal =
    settings.theme === 'minimal-dark' && baseAccent.toUpperCase() === '#E4E4E7';
  const hiTuple = isNeutralMinimal
    ? ([250, 250, 250] as [number, number, number])
    : validCustomRgb && baseAccent.toLowerCase() !== def.accent.toLowerCase()
    ? brightenRgb(parsed, 34)
    : hexToRgbTuple(def.accentHighlight) || brightenRgb(parsed, 34);

  const highlightHex = `#${hiTuple
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;

  const panelAlpha = Math.min(0.95, Math.max(0.24, settings.panelTransparency / 100));
  const cardTopAlpha = Math.min(0.95, Math.max(0.32, panelAlpha + 0.04));
  const cardBottomAlpha = Math.min(0.96, Math.max(0.45, panelAlpha + 0.16));

  return {
    def,
    accent: baseAccent,
    accentHighlight: highlightHex,
    accentRgb: parsed.join(', '),
    accentHighlightRgb: hiTuple.join(', '),
    panelAlpha,
    cardTopAlpha,
    cardBottomAlpha,
    fontFamilyCss: resolveFontFamilyCss(settings.fontFamily),
    clockFontFamilyCss: resolveClockFontFamilyCss(settings.fontFamily),
  };
}
