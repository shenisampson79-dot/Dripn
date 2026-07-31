import type { StyleArchetype } from '@/utils/outfitAestheticClassifier';
import {
  scoreFashionPalette,
  type FashionColorCategory,
} from '@/utils/fashionColorTaxonomy';

export type ColorGroup = 'neutral' | 'earth' | 'cool' | 'warm' | 'soft' | 'loud' | 'unknown';
export type ColorWheelRelation =
  | 'monochromatic'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'neutral_dominant'
  | 'mixed_harmonious'
  | 'clashing';
export type ColorSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export type ColorHarmonyResult = {
  score: number;
  groups: ColorGroup[];
  wheelRelationship: ColorWheelRelation;
  seasonalMatch: number | null;
  seasonalNote: string | null;
  issues: string[];
  summary: string;
  adjustment: number;
  /** Fashion taxonomy categories (neutral / pastel / bold / dark / earth). */
  fashionCategories?: Array<FashionColorCategory | 'unknown'>;
  /** Points already baked into score from fashion category pairs. */
  fashionAdjustment?: number;
};

const COLOR_TO_GROUP: Record<string, ColorGroup> = {
  black: 'neutral',
  white: 'neutral',
  gray: 'neutral',
  grey: 'neutral',
  cream: 'neutral',
  beige: 'neutral',
  charcoal: 'neutral',
  ivory: 'neutral',
  navy: 'cool',
  denim: 'earth',
  brown: 'earth',
  tan: 'earth',
  olive: 'earth',
  khaki: 'earth',
  green: 'earth',
  blue: 'cool',
  teal: 'cool',
  cyan: 'cool',
  red: 'warm',
  burgundy: 'warm',
  orange: 'warm',
  yellow: 'warm',
  rust: 'warm',
  coral: 'warm',
  peach: 'warm',
  gold: 'warm',
  pink: 'soft',
  purple: 'soft',
  lavender: 'soft',
  mint: 'soft',
  mauve: 'soft',
  rose: 'soft',
  multicolor: 'loud',
  neon: 'loud',
};

/** Representative hue on 0–360° wheel (null = neutral / no hue). */
const COLOR_HUE: Record<string, number> = {
  red: 0,
  orange: 30,
  yellow: 55,
  rust: 18,
  coral: 12,
  peach: 20,
  gold: 45,
  olive: 80,
  green: 120,
  teal: 175,
  cyan: 190,
  blue: 210,
  navy: 220,
  lavender: 275,
  purple: 285,
  pink: 340,
  burgundy: 350,
  mint: 150,
  mauve: 300,
  rose: 350,
};

const GROUP_HUE: Partial<Record<ColorGroup, number>> = {
  warm: 30,
  earth: 75,
  cool: 215,
  soft: 290,
};

const GOOD_PAIRS = new Set([
  'neutral|neutral', 'neutral|earth', 'neutral|cool', 'neutral|warm', 'neutral|soft',
  'earth|earth', 'earth|neutral', 'cool|cool', 'cool|neutral',
]);

const OK_PAIRS = new Set([
  'warm|neutral', 'warm|earth', 'cool|warm', 'soft|neutral', 'soft|earth',
]);

const BAD_PAIRS = new Set([
  'loud|loud', 'loud|warm', 'loud|cool', 'loud|soft', 'loud|earth',
]);

const SEASON_GROUP_AFFINITY: Record<ColorSeason, Partial<Record<ColorGroup, number>>> = {
  spring: { warm: 2, soft: 2, neutral: 1, earth: 1, cool: 0, loud: -1 },
  summer: { cool: 2, soft: 2, neutral: 1, earth: 0, warm: -1, loud: -1 },
  autumn: { earth: 2, warm: 2, neutral: 1, cool: 0, soft: 0, loud: -1 },
  winter: { cool: 2, neutral: 2, earth: 0, warm: 0, soft: 0, loud: 1 },
};

const SEASON_COLOR_BOOST: Record<ColorSeason, string[]> = {
  spring: ['cream', 'coral', 'peach', 'mint', 'gold', 'yellow', 'light blue'],
  summer: ['lavender', 'rose', 'mauve', 'powder blue', 'soft white', 'grey', 'pink'],
  autumn: ['olive', 'rust', 'burgundy', 'mustard', 'brown', 'teal', 'camel', 'tan'],
  winter: ['black', 'white', 'navy', 'charcoal', 'ruby', 'emerald', 'burgundy', 'grey'],
};

function pairKey(a: ColorGroup, b: ColorGroup): string {
  return [a, b].sort().join('|');
}

export function normalizeColorSeason(raw: string | null | undefined): ColorSeason | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('spring')) return 'spring';
  if (s.includes('summer')) return 'summer';
  if (s.includes('autumn') || s.includes('fall')) return 'autumn';
  if (s.includes('winter')) return 'winter';
  return null;
}

export function getColorGroup(color: string | undefined | null): ColorGroup {
  if (!color) return 'unknown';
  const key = color.toLowerCase().trim();
  if (COLOR_TO_GROUP[key]) return COLOR_TO_GROUP[key];
  if (/neon|bright|fluorescent|hot pink/.test(key)) return 'loud';
  if (/pastel|soft|light pink|lavender|mint|mauve|rose/.test(key)) return 'soft';
  if (/navy|blue|teal|cyan|powder/.test(key)) return 'cool';
  if (/red|orange|yellow|burgundy|rust|coral|peach|gold/.test(key)) return 'warm';
  if (/brown|tan|olive|khaki|camel|earth|mustard/.test(key)) return 'earth';
  if (/black|white|grey|gray|cream|beige|charcoal|ivory/.test(key)) return 'neutral';
  return 'unknown';
}

function getColorHue(color: string, group: ColorGroup): number | null {
  const key = color.toLowerCase().trim();
  if (COLOR_HUE[key] != null) return COLOR_HUE[key];
  if (group === 'neutral' || group === 'unknown' || group === 'loud') return null;
  return GROUP_HUE[group] ?? null;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function detectWheelRelationship(hues: number[], groups: ColorGroup[] = []): ColorWheelRelation {
  if (hues.length === 0) return 'neutral_dominant';
  if (hues.length === 1) return 'monochromatic';

  const maxDist = hues.reduce((max, h1, i) => {
    let localMax = 0;
    for (let j = i + 1; j < hues.length; j++) {
      localMax = Math.max(localMax, hueDistance(h1, hues[j]));
    }
    return Math.max(max, localMax);
  }, 0);

  const allClose = hues.every((h) => hues.every((o) => hueDistance(h, o) <= 25));
  if (allClose) return 'monochromatic';

  const allAnalogous = hues.every((h) => hues.every((o) => hueDistance(h, o) <= 60));
  if (allAnalogous) return 'analogous';

  const hasComplementary = hues.some((h1) =>
    hues.some((h2) => h1 !== h2 && hueDistance(h1, h2) >= 150 && hueDistance(h1, h2) <= 210),
  );
  if (hasComplementary && hues.length <= 3) return 'complementary';

  if (hues.length >= 3) {
    const sorted = [...hues].sort((a, b) => a - b);
    const triadicish = hueDistance(sorted[0], sorted[1]) >= 90
      && hueDistance(sorted[1], sorted[2]) >= 90
      && maxDist <= 150;
    if (triadicish) return 'triadic';
  }

  if (maxDist <= 90) return 'mixed_harmonious';

  if (groups.length >= 2) {
    const noBadPairs = groups.every((g1, i) =>
      groups.every((g2, j) => i >= j || g1 === g2 || !BAD_PAIRS.has(pairKey(g1, g2))),
    );
    if (noBadPairs && maxDist <= 160) return 'mixed_harmonious';
  }

  return 'clashing';
}

function scoreSeasonalMatch(
  items: Array<{ color?: string | null }>,
  groups: ColorGroup[],
  userSeason: ColorSeason | null,
): { match: number | null; note: string | null; adjustment: number } {
  if (!userSeason) return { match: null, note: null, adjustment: 0 };

  const affinity = SEASON_GROUP_AFFINITY[userSeason];
  let points = 0;
  let count = 0;
  for (const group of groups) {
    if (group === 'unknown') continue;
    points += affinity[group] ?? 0;
    count++;
  }
  const groupScore = count > 0 ? (points / count) * 50 + 50 : 50;

  const boostColors = SEASON_COLOR_BOOST[userSeason];
  const named = items.map((i) => (i.color || '').toLowerCase()).filter(Boolean);
  const namedHits = named.filter((c) => boostColors.some((b) => c.includes(b.split(' ')[0]))).length;
  const namedBonus = namedHits > 0 ? Math.min(15, namedHits * 6) : 0;

  const offSeasonPenalty = groups.filter((g) => (affinity[g] ?? 0) < 0).length >= 2 ? -12 : 0;

  const match = Math.max(0, Math.min(100, Math.round(groupScore + namedBonus + offSeasonPenalty)));
  const note = match >= 75
    ? `Palette aligns with ${userSeason} colour season`
    : match >= 55
      ? `Some ${userSeason} season colours — a few tones feel off-season`
      : `Several colours read off-season for ${userSeason}`;

  let adjustment = 0;
  if (match >= 80) adjustment = 4;
  else if (match >= 65) adjustment = 2;
  else if (match < 50) adjustment = -6;

  return { match, note, adjustment };
}

function styleColorPenalty(style: StyleArchetype | null, groups: ColorGroup[]): number {
  if (!style) return 0;
  const loudCount = groups.filter((g) => g === 'loud').length;
  if (style === 'minimalist' || style === 'classic_tailoring' || style === 'formal') {
    if (loudCount > 0) return -12;
    if (groups.length >= 3 && !groups.includes('neutral')) return -8;
  }
  if (style === 'edgy_fashion' && loudCount >= 2) return -6;
  return 0;
}

function wheelBonus(relation: ColorWheelRelation, hasNeutralAnchor: boolean): number {
  switch (relation) {
    case 'monochromatic': return 6;
    case 'analogous': return 5;
    case 'complementary': return hasNeutralAnchor ? 6 : 2;
    case 'triadic': return hasNeutralAnchor ? 4 : 0;
    case 'neutral_dominant': return 4;
    case 'mixed_harmonious': return 1;
    case 'clashing': return -10;
    default: return 0;
  }
}

type ItemLike = { color?: string | null };

/** Score palette cohesion 0–100 with wheel + seasonal layers. */
export function scoreColorHarmony(
  items: ItemLike[],
  primaryStyle: StyleArchetype | null = null,
  userSeasonRaw: string | null = null,
): ColorHarmonyResult {
  const groups = items
    .map((item) => getColorGroup(item.color))
    .filter((g) => g !== 'unknown');

  const userSeason = normalizeColorSeason(userSeasonRaw);

  if (groups.length === 0) {
    return {
      score: 70,
      groups: [],
      wheelRelationship: 'neutral_dominant',
      seasonalMatch: null,
      seasonalNote: null,
      issues: [],
      summary: 'No colour data — palette not scored',
      adjustment: 0,
      fashionCategories: [],
      fashionAdjustment: 0,
    };
  }

  const hues = items
    .map((item) => {
      const group = getColorGroup(item.color);
      return getColorHue(item.color || '', group);
    })
    .filter((h): h is number => h != null);

  const wheelRelationship = detectWheelRelationship(hues, groups);
  const hasNeutralAnchor = groups.includes('neutral');

  let score = 82;
  const issues: string[] = [];

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const key = pairKey(groups[i], groups[j]);
      if (BAD_PAIRS.has(key)) score -= 22;
      else if (OK_PAIRS.has(key)) score -= 8;
      else if (!GOOD_PAIRS.has(key) && groups[i] !== groups[j]) score -= 5;
    }
  }

  score += wheelBonus(wheelRelationship, hasNeutralAnchor);
  if (wheelRelationship === 'clashing') issues.push('color_wheel_clash');

  const uniqueGroups = new Set(groups);
  const loudCount = groups.filter((g) => g === 'loud').length;

  if (uniqueGroups.size >= 4) {
    score -= 14;
    issues.push('too_many_color_groups');
  }
  if (loudCount > 1) {
    score -= 18;
    issues.push('multiple_loud_colors');
  }
  if (!hasNeutralAnchor && groups.length >= 3) {
    score -= 10;
    issues.push('no_neutral_anchor');
  }

  score += styleColorPenalty(primaryStyle, groups);

  const seasonal = scoreSeasonalMatch(items, groups, userSeason);
  score += seasonal.adjustment;

  const fashion = scoreFashionPalette(items);
  score += fashion.adjustment;
  if (fashion.adjustment <= -5) {
    issues.push('fashion_category_clash');
  } else if (fashion.adjustment >= 7) {
    issues.push('fashion_category_balance');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let adjustment: number;
  if (score >= 82) adjustment = 8;
  else if (score >= 70) adjustment = 4;
  else if (score >= 55) adjustment = 0;
  else if (score >= 40) adjustment = -8;
  else adjustment = -14;

  let summary: string;
  if (fashion.summary && fashion.adjustment >= 6) {
    summary = fashion.summary;
  } else if (fashion.summary && fashion.adjustment <= -5) {
    summary = fashion.summary;
  } else if (score >= 82) {
    summary = `${wheelRelationship.replace(/_/g, ' ')} palette with strong balance`;
  } else if (wheelRelationship === 'clashing') {
    summary = 'Colours clash on the wheel — add a neutral anchor or move to analogous tones';
  } else if (issues.includes('multiple_loud_colors')) {
    summary = 'Competing bright tones without a neutral anchor';
  } else {
    summary = 'Acceptable colour story — refine wheel relationship or simplify to 2–3 tones';
  }

  return {
    score,
    groups,
    wheelRelationship,
    seasonalMatch: seasonal.match,
    seasonalNote: seasonal.note,
    issues,
    summary,
    adjustment,
    fashionCategories: fashion.categories,
    fashionAdjustment: fashion.adjustment,
  };
}

export function formatColorHarmonyForPrompt(result: ColorHarmonyResult): string {
  const lines = [
    `- Colour harmony score: ${result.score}/100`,
    `- Palette groups: ${result.groups.join(', ') || 'unknown'}`,
    `- Wheel relationship: ${result.wheelRelationship.replace(/_/g, ' ')}`,
  ];
  if (result.fashionCategories?.length) {
    lines.push(`- Fashion categories: ${result.fashionCategories.join(', ')}`);
  }
  if (result.fashionAdjustment) {
    lines.push(`- Fashion category adjustment: ${result.fashionAdjustment > 0 ? '+' : ''}${result.fashionAdjustment}`);
  }
  if (result.seasonalMatch != null) {
    lines.push(`- Seasonal palette match: ${result.seasonalMatch}/100`);
    if (result.seasonalNote) lines.push(`- ${result.seasonalNote}`);
  }
  if (result.issues.length) lines.push(`- Colour issues: ${result.issues.join(', ')}`);
  lines.push(`- Summary: ${result.summary}`);
  return lines.join('\n');
}
