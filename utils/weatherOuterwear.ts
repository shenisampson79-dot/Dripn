/**
 * Weather-aware outerwear hard gates for the wardrobe allocator (client).
 *
 * Thresholds (°C):
 * - HOT  ≥24: force empty outerwear slot; heavy blocked; reward no outerwear
 * - WARM ≥22: HARD block heavy (fleece/puffer/insulated/wool coat); light rare
 * - COOL ~10–18: light outerwear OK; heavy allowed when cooler
 * - COLD ≤10: prefer/require outerwear when wardrobe has a valid piece
 *
 * Soft fabric kick: name/fabric/insulation fields that imply fleece/wool heavy
 * use the same hard block in heat. Full FABRIC_DB is phase-2 (not required to ship).
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { isOuterwearItem } from '@/utils/completeOutfit';
import { classifyGarment, getGarmentBySubtype } from '@/utils/garmentTaxonomy';

export type WeatherLike = {
  temperature?: number;
  temp?: number;
  feelsLike?: number;
  unit?: string;
  units?: string | { temp?: string; wind?: string };
  useMetric?: boolean;
  condition?: string;
  conditions?: string;
  location?: string;
  city?: string;
  source?: string;
};

export const WEATHER_OUTERWEAR_THRESHOLDS_C = Object.freeze({
  /** ≥ this → default empty outerwear slot (hard) */
  HOT_EMPTY: 24,
  /** ≥ this → hard-block heavy outerwear */
  WARM_NO_HEAVY: 22,
  /** ≤ this → prefer/require outerwear when available */
  COLD_REQUIRE: 10,
});

const HEAVY_SUBTYPES = new Set(['fleece', 'puffer', 'tailored_coat']);

const HEAVY_NAME_RE =
  /\b(fleece|full-?zip\s*fleece|half-?zip\s*fleece|polar\s*fleece|sherpa|puffer|puffa|down\s*jacket|down\s*coat|quilted|insulated|insulation|parka|ski\s*jacket|winter\s*coat|wool\s*coat|heavy\s*coat|padded|duvet|thermal|gore-?tex\s*park|montane|canada\s*goose|north\s*face\s*(nuptse|thermoball)|patagonia\s*nano)\b/i;

const LIGHT_NAME_RE =
  /\b(blazer|sport\s*coat|overshirt|shacket|cardigan|thin\s*cardigan|denim\s*jacket|jean\s*jacket|bomber(?!\s*padded)|trench|chore|utility|windbreaker|anorak|softshell|rain\s*shell|light\s*jacket|linen\s*blazer)\b/i;

function itemStyleText(item: Partial<WardrobeItem> & Record<string, unknown>): string {
  return `${item?.name || ''} ${item?.color || ''} ${item?.category || ''} ${item?.subcategory || ''} ${item?.brand || ''} ${(item as any)?.fabric || ''} ${(item as any)?.material || ''} ${(item as any)?.insulation || ''}`
    .toLowerCase();
}

export function parseWeatherTempC(weather?: WeatherLike | null): number | null {
  if (!weather || typeof weather !== 'object') return null;
  const raw = weather.temperature ?? weather.temp ?? weather.feelsLike;
  if (raw == null || (raw as unknown) === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const unitRaw = weather.unit
    ?? (typeof weather.units === 'string' ? weather.units : weather.units?.temp)
    ?? (weather.useMetric === false ? 'F' : 'C');
  const unit = String(unitRaw || 'C').toUpperCase();
  if (unit.startsWith('F') || unit.includes('°F')) return Math.round((n - 32) * (5 / 9));
  return Math.round(n);
}

/** Normalize orchestrator / OpenWeather / Today snapshot shapes for allocator gates. */
export function normalizeWeatherForAllocator(weather?: WeatherLike | null): WeatherLike | null {
  if (!weather || typeof weather !== 'object') return null;
  const temp = weather.temperature ?? weather.temp ?? weather.feelsLike;
  if (temp == null || (temp as unknown) === '' || !Number.isFinite(Number(temp))) return null;
  const unitRaw = weather.unit
    ?? (typeof weather.units === 'string' ? weather.units : weather.units?.temp)
    ?? (weather.useMetric === false ? 'F' : 'C');
  const condition = weather.condition || weather.conditions || '';
  return {
    temperature: Number(temp),
    temp: Number(temp),
    feelsLike: weather.feelsLike != null ? Number(weather.feelsLike) : undefined,
    condition,
    conditions: condition,
    unit: String(unitRaw || 'C'),
    units: String(unitRaw || 'C'),
    location: weather.location || weather.city,
    source: weather.source,
  };
}

/** Short hard-authority line for stylist prompts when temp is known. */
export function formatWeatherOuterwearAuthorityForPrompt(weather?: WeatherLike | null): string {
  const normalized = normalizeWeatherForAllocator(weather) || weather;
  const tempC = parseWeatherTempC(normalized);
  if (tempC == null) return '';
  const policy = outerwearWeatherPolicy(
    tempC,
    normalized?.condition || normalized?.conditions || '',
  );
  const { HOT_EMPTY, WARM_NO_HEAVY, COLD_REQUIRE } = WEATHER_OUTERWEAR_THRESHOLDS_C;
  const lines = [`WEATHER OUTERWEAR AUTHORITY: ambient ~${tempC}°C.`];
  if (policy.forceEmpty) {
    lines.push(
      `HOT (≥${HOT_EMPTY}°C): outerwear slot must stay empty. Never suggest fleece, puffer, insulated, wool coat, or full-zip midlayers. Do not praise heavy layers.`,
    );
  } else if (policy.blockHeavy) {
    lines.push(
      `WARM (≥${WARM_NO_HEAVY}°C or transitional ≥18°C): heavy outerwear (fleece/puffer/insulated/wool coat) is forbidden. Light layers only if needed; prefer bare looks.`,
    );
  } else if (policy.requireWhenAvailable) {
    lines.push(
      `COLD (≤${COLD_REQUIRE}°C): prefer outerwear when the wardrobe has a suitable piece.`,
    );
  } else {
    lines.push('Mild: outerwear optional; match fabric weight to temperature.');
  }
  if (policy.wet) {
    lines.push('Wet conditions: prefer weather-appropriate shells over fashion-only layers.');
  }
  return lines.join(' ');
}

export function isHeavyOuterwear(item: Partial<WardrobeItem> | null | undefined): boolean {
  if (!item) return false;
  const text = itemStyleText(item as any);
  const cat = String(item.category || '').toLowerCase();

  let subtype = (item as any).subtype || (item as any).garmentSubtype || (item as any).taxonomySubtype || null;
  try {
    const classified = classifyGarment(item);
    if (classified?.subtype) subtype = classified.subtype;
  } catch {
    // taxonomy optional
  }

  if (subtype && HEAVY_SUBTYPES.has(String(subtype))) return true;

  try {
    const meta = subtype ? getGarmentBySubtype(subtype) : null;
    if (meta?.silhouette === 'insulated' || meta?.visualWeight === 'heavy') {
      if (cat === 'outerwear' || isOuterwearItem(item as WardrobeItem) || /jacket|coat|fleece|parka|puffer/.test(text)) {
        return true;
      }
    }
    if (meta?.fabric === 'fleece' || /fleece/.test(String(meta?.fabric || ''))) return true;
  } catch {
    // optional
  }

  const fabric = String((item as any).fabric || (item as any).material || (item as any).insulation || '').toLowerCase();
  if (
    /\b(fleece|wool|down|insulated|quilted|sherpa|polar)\b/.test(fabric)
    && (cat === 'outerwear' || isOuterwearItem(item as WardrobeItem) || /jacket|coat|fleece|parka|hoodie/.test(text))
  ) {
    return true;
  }

  if (HEAVY_NAME_RE.test(text)) {
    if (cat === 'outerwear' || isOuterwearItem(item as WardrobeItem) || /jacket|coat|fleece|parka|puffer|hoodie/.test(text)) {
      return true;
    }
  }

  if (/full-?zip/i.test(text) && !/rain|shell|windbreaker|softshell|anorak|denim|blazer/i.test(text)) {
    if (cat === 'outerwear' || isOuterwearItem(item as WardrobeItem) || /fleece|hoodie|jacket/.test(text)) {
      return true;
    }
  }

  return false;
}

export function isLightOuterwear(item: Partial<WardrobeItem> | null | undefined): boolean {
  if (!item || isHeavyOuterwear(item)) return false;
  const text = itemStyleText(item as any);
  let subtype = (item as any).subtype || (item as any).garmentSubtype || null;
  try {
    const classified = classifyGarment(item);
    if (classified?.subtype) subtype = classified.subtype;
  } catch {
    // optional
  }
  if (['blazer', 'denim_jacket', 'cardigan', 'cropped_jacket'].includes(String(subtype || ''))) {
    return true;
  }
  return LIGHT_NAME_RE.test(text);
}

export function outerwearWeatherPolicy(tempC: number | null, condition = '') {
  const cond = String(condition || '').toLowerCase();
  const wet = /rain|storm|snow|drizzle|shower/.test(cond);

  if (tempC == null || !Number.isFinite(tempC)) {
    return {
      tempC: null as number | null,
      forceEmpty: false,
      blockHeavy: false,
      lightOnly: false,
      preferEmpty: false,
      requireWhenAvailable: false,
      softOuterwearPenalty: 0,
      rewardNoOuterwear: 0,
      wet,
    };
  }

  const { HOT_EMPTY, WARM_NO_HEAVY, COLD_REQUIRE } = WEATHER_OUTERWEAR_THRESHOLDS_C;

  if (tempC >= HOT_EMPTY) {
    return {
      tempC,
      forceEmpty: true,
      blockHeavy: true,
      lightOnly: true,
      preferEmpty: true,
      requireWhenAvailable: false,
      softOuterwearPenalty: -80,
      rewardNoOuterwear: 12,
      wet,
    };
  }

  if (tempC >= WARM_NO_HEAVY) {
    return {
      tempC,
      forceEmpty: false,
      blockHeavy: true,
      lightOnly: true,
      preferEmpty: true,
      requireWhenAvailable: false,
      softOuterwearPenalty: -40,
      rewardNoOuterwear: 8,
      wet,
    };
  }

  if (tempC <= COLD_REQUIRE) {
    return {
      tempC,
      forceEmpty: false,
      blockHeavy: false,
      lightOnly: false,
      preferEmpty: false,
      requireWhenAvailable: true,
      softOuterwearPenalty: 0,
      rewardNoOuterwear: -18,
      wet,
    };
  }

  const coolLightBias = tempC >= 18;
  return {
    tempC,
    forceEmpty: false,
    blockHeavy: coolLightBias,
    lightOnly: coolLightBias,
    preferEmpty: false,
    requireWhenAvailable: false,
    softOuterwearPenalty: coolLightBias ? -8 : 0,
    rewardNoOuterwear: 0,
    wet,
  };
}

export function filterOuterwearCandidatesForWeather(
  candidates: WardrobeItem[],
  weather?: WeatherLike | null,
): WardrobeItem[] {
  const list = Array.isArray(candidates) ? candidates : [];
  const tempC = parseWeatherTempC(weather);
  const condition = weather?.condition || weather?.conditions || '';
  const policy = outerwearWeatherPolicy(tempC, condition);

  if (policy.forceEmpty) return [];

  let pool = list;
  if (policy.blockHeavy) {
    pool = pool.filter((item) => !isHeavyOuterwear(item));
  }
  if (policy.lightOnly) {
    pool = pool.filter(isLightOuterwear);
  }
  return pool;
}

export function stripIllegalOuterwearForWeather(
  items: WardrobeItem[],
  weather?: WeatherLike | null,
): WardrobeItem[] {
  if (!Array.isArray(items) || !items.length) return items || [];
  const tempC = parseWeatherTempC(weather);
  if (tempC == null) return items;
  const policy = outerwearWeatherPolicy(tempC, weather?.condition || weather?.conditions || '');

  return items.filter((item) => {
    if (!isOuterwearItem(item)) return true;
    if (policy.forceEmpty) return false;
    if (policy.blockHeavy && isHeavyOuterwear(item)) return false;
    if (policy.lightOnly && !isLightOuterwear(item)) return false;
    return true;
  });
}

export function weatherOuterwearScoreAdjustment(
  items: WardrobeItem[],
  weather?: WeatherLike | null,
): number {
  const tempC = parseWeatherTempC(weather);
  if (tempC == null) return 0;
  const policy = outerwearWeatherPolicy(tempC, weather?.condition || weather?.conditions || '');
  const hasOuter = (items || []).some(isOuterwearItem);
  if (!hasOuter) return policy.rewardNoOuterwear || 0;
  if (policy.forceEmpty) return -500;
  if (policy.blockHeavy && (items || []).some((i) => isOuterwearItem(i) && isHeavyOuterwear(i))) {
    return -500;
  }
  return policy.softOuterwearPenalty || 0;
}
