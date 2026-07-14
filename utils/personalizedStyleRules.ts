import type { FashionRule } from '@/data/fashionRules';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { WeatherCondition } from '@/services/WeatherService';
import {
  getCurrentCalendarSeason,
  mapUserGenderToRuleFilter,
  type CalendarSeason,
} from '@/utils/fashionSeason';
import { resolveContentLang } from '@/utils/contentLang';

export interface PersonalizedRulesResult {
  orderedRules: FashionRule[];
  highlightRule: FashionRule | null;
  contextLabel: string | null;
}

const SEASON_LABELS: Record<string, Record<CalendarSeason, string>> = {
  en: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
  es: { spring: 'Primavera', summer: 'Verano', autumn: 'Otoño', winter: 'Invierno' },
  fr: { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' },
  de: { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' },
  it: { spring: 'Primavera', summer: 'Estate', autumn: 'Autunno', winter: 'Inverno' },
  pt: { spring: 'Primavera', summer: 'Verão', autumn: 'Outono', winter: 'Inverno' },
  nl: { spring: 'Lente', summer: 'Zomer', autumn: 'Herfst', winter: 'Winter' },
  pl: { spring: 'Wiosna', summer: 'Lato', autumn: 'Jesień', winter: 'Zima' },
  ru: { spring: 'Весна', summer: 'Лето', autumn: 'Осень', winter: 'Зима' },
  zh: { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' },
  ja: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' },
  ko: { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' },
  ar: { spring: 'الربيع', summer: 'الصيف', autumn: 'الخريف', winter: 'الشتاء' },
  hi: { spring: 'वसंत', summer: 'ग्रीष्म', autumn: 'शरद', winter: 'शीत' },
  tr: { spring: 'İlkbahar', summer: 'Yaz', autumn: 'Sonbahar', winter: 'Kış' },
  sv: { spring: 'Vår', summer: 'Sommar', autumn: 'Höst', winter: 'Vinter' },
  da: { spring: 'Forår', summer: 'Sommer', autumn: 'Efterår', winter: 'Vinter' },
  no: { spring: 'Vår', summer: 'Sommer', autumn: 'Høst', winter: 'Vinter' },
  fi: { spring: 'Kevät', summer: 'Kesä', autumn: 'Syksy', winter: 'Talvi' },
};

const SEASON_TAG_KEYWORDS: Record<CalendarSeason, string[]> = {
  spring: ['spring', 'transitional', 'layering', 'rotation'],
  summer: ['summer', 'breathable', 'light', 'linen'],
  autumn: ['autumn', 'fall', 'layering', 'transitional', 'rotation'],
  winter: ['winter', 'warmth', 'coat', 'thermal', 'insulation'],
};

const HOT_WEATHER_TAGS = ['breathable', 'light', 'linen', 'summer', 'minimal'];
const COLD_WEATHER_TAGS = ['layering', 'warmth', 'coat', 'winter', 'thermal', 'insulation'];

function ruleMatchesGender(rule: FashionRule, gender: 'women' | 'men' | 'all'): boolean {
  if (rule.gender === 'all') return true;
  if (gender === 'all') return true;
  return rule.gender === gender;
}

function scoreRule(
  rule: FashionRule,
  options: {
    gender: 'women' | 'men' | 'all';
    season: CalendarSeason;
    peakTemp?: number;
    wardrobeColors: Set<string>;
    bodyShape?: string | null;
  },
): number {
  let score = 0;
  const tagText = `${rule.tags.join(' ')} ${rule.title} ${rule.content}`.toLowerCase();

  if (ruleMatchesGender(rule, options.gender)) score += 2;

  for (const keyword of SEASON_TAG_KEYWORDS[options.season]) {
    if (tagText.includes(keyword)) score += 3;
  }

  if (options.peakTemp != null) {
    if (options.peakTemp >= 24) {
      if (HOT_WEATHER_TAGS.some((k) => tagText.includes(k))) score += 4;
      if (rule.category === 'Seasonal Dressing' && /light|breathable|summer/i.test(rule.content)) score += 3;
      if (COLD_WEATHER_TAGS.some((k) => tagText.includes(k))) score -= 3;
    } else if (options.peakTemp <= 12) {
      if (COLD_WEATHER_TAGS.some((k) => tagText.includes(k))) score += 4;
      if (rule.category === 'Seasonal Dressing') score += 2;
      if (HOT_WEATHER_TAGS.some((k) => tagText.includes(k))) score -= 2;
    } else {
      if (rule.category === 'Seasonal Dressing' || tagText.includes('layer')) score += 2;
    }
  }

  if (rule.category === 'Colour & Palette') score += 1;
  if (options.wardrobeColors.size > 0 && rule.colorSwatches?.length) {
    const matchesWardrobe = rule.colorSwatches.some((swatch) =>
      options.wardrobeColors.has(swatch.name.toLowerCase()) ||
      options.wardrobeColors.has(swatch.hex.toLowerCase()),
    );
    if (matchesWardrobe) score += 2;
  }

  if (options.bodyShape && tagText.includes('body shape')) score += 2;

  return score;
}

export function personalizeStyleRules(
  rules: FashionRule[],
  options: {
    gender?: string | null;
    wardrobeItems?: WardrobeItem[];
    weather?: WeatherCondition | null;
    bodyShape?: string | null;
    language?: string | null;
  },
): PersonalizedRulesResult {
  const season = getCurrentCalendarSeason();
  const gender = mapUserGenderToRuleFilter(options.gender);
  const peakTemp = options.weather?.tempMax ?? options.weather?.temperature;
  const lang = resolveContentLang(options.language);
  const seasonLabel = SEASON_LABELS[lang]?.[season] ?? SEASON_LABELS.en[season];
  const wardrobeColors = new Set(
    (options.wardrobeItems ?? [])
      .map((item) => item.color?.toLowerCase())
      .filter(Boolean) as string[],
  );

  const scored = rules
    .filter((rule) => ruleMatchesGender(rule, gender))
    .map((rule) => ({
      rule,
      score: scoreRule(rule, {
        gender,
        season,
        peakTemp,
        wardrobeColors,
        bodyShape: options.bodyShape,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const highlightRule = scored[0]?.rule ?? null;

  let contextLabel: string | null = null;
  if (options.weather && peakTemp != null) {
    const low = options.weather.tempMin;
    const high = options.weather.tempMax;
    if (low != null && high != null) {
      contextLabel = lang === 'es'
        ? `${seasonLabel} · ${low}–${high}°C hoy`
        : `${seasonLabel} · ${low}–${high}°C today`;
    } else {
      contextLabel = lang === 'es'
        ? `${seasonLabel} · pico ${peakTemp}°C`
        : `${seasonLabel} · ${peakTemp}°C peak`;
    }
  } else {
    contextLabel = lang === 'es'
      ? `Enfoque de estilo ${seasonLabel.toLowerCase()}`
      : `${seasonLabel} style focus`;
  }

  return {
    orderedRules: scored.map((entry) => entry.rule),
    highlightRule,
    contextLabel,
  };
}

export function pickDailyRuleFromPersonalized(
  rules: FashionRule[],
  options: Parameters<typeof personalizeStyleRules>[1],
): FashionRule | null {
  const { highlightRule, orderedRules } = personalizeStyleRules(rules, options);
  if (highlightRule) return highlightRule;

  if (orderedRules.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86400000) % orderedRules.length;
  return orderedRules[dayIndex];
}
