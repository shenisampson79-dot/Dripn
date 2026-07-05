/**
 * Verified Pantone Colors of the Year — keep in sync with Dripn-Server/data/pantoneColorOfYear.json.
 * Add the new entry each December when Pantone announces the following year's colour.
 */
export interface PantoneColorOfYearEntry {
  name: string;
  hexCode: string;
  pantoneCode?: string;
  description: string;
  pairingColors: string[];
  bestFor: string[];
}

export const PANTONE_COLOR_OF_YEAR_BY_YEAR: Record<number, PantoneColorOfYearEntry> = {
  2023: {
    name: 'Viva Magenta',
    hexCode: '#BB2649',
    pantoneCode: 'PANTONE 18-1750',
    description: 'An unconventional shade rooted in nature — brave, fearless, and full of vim and vigour.',
    pairingColors: ['#FFFFFF', '#1A1A1A', '#C9A87C', '#8B2F39'],
    bestFor: ['Cool', 'Neutral'],
  },
  2024: {
    name: 'Peach Fuzz',
    hexCode: '#FFBE98',
    pantoneCode: 'PANTONE 13-1023',
    description: 'A velvety peach tone that nurtures mind, body, and soul — evoking warmth and togetherness.',
    pairingColors: ['#FFFFFF', '#A47864', '#C9A87C', '#6B5B4F'],
    bestFor: ['Warm', 'Neutral'],
  },
  2025: {
    name: 'Mocha Mousse',
    hexCode: '#A47864',
    pantoneCode: 'PANTONE 17-1230',
    description: 'A warming brown-based hue that enriches the mind, body, and soul — timeless elegance and comfort.',
    pairingColors: ['#FFFFFF', '#1A1A1A', '#D4A574', '#8B7355'],
    bestFor: ['Warm', 'Neutral'],
  },
  2026: {
    name: 'Cloud Dancer',
    hexCode: '#F0EEE9',
    pantoneCode: 'PANTONE 11-4201',
    description: 'A lofty, serene white symbolizing calm, clarity, and spaciousness — a soft reset for overstimulated times.',
    pairingColors: ['#2C3E50', '#A47864', '#87CEEB', '#C8B896'],
    bestFor: ['Warm', 'Cool', 'Neutral'],
  },
};
