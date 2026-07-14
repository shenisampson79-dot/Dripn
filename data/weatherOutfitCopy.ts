/**
 * Localized weather descriptions + outfit recommendation copy
 * used by WeatherService. English strings must stay identical to
 * the historical WeatherService.ts defaults.
 *
 * Copy is loaded from data/content/weather/{lang}.json via getWeatherPack.
 */

import type { ContentLang } from '@/utils/contentLang';
import { getWeatherPack } from '@/data/content/contentPacks';

export type { ContentLang };

export interface LocalizedOutfitRecommendation {
  layers: string[];
  keyPieces: string[];
  accessories: string[];
  colors: string[];
  fabricTips: string;
  stylingNote: string;
}

export type OutfitGender = 'female' | 'male' | 'other';

export type OutfitTempBand = 'hot' | 'warm' | 'mild' | 'cold' | 'freezing';

export interface OutfitBandTemplate {
  layers: string[];
  keyPiecesFemale: string[];
  keyPiecesMale: string[];
  accessories: string[];
  colors: string[];
  fabricTips: string;
  /** May include `{peakTemp}` for the hot band. */
  stylingNoteTemplate: string;
}

function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : `{${key}}`,
  );
}

// ---------------------------------------------------------------------------
// Weather descriptions (WMO)
// ---------------------------------------------------------------------------

export function getWeatherDescription(code: number, lang: ContentLang): string {
  const pack = getWeatherPack(lang);
  return pack.descriptions[String(code)] ?? pack.descriptionFallback;
}

export function getDefaultWeatherDescription(lang: ContentLang): string {
  return getWeatherPack(lang).defaultDescription;
}

export function getLocationFallback(lang: ContentLang): string {
  return getWeatherPack(lang).locationFallback;
}

/** Fallback place-name phrases used across weather flows. */
export const UNKNOWN_LOCATION = {
  get en() {
    return getWeatherPack('en').unknownLocation;
  },
};

export function getUnknownLocation(lang: ContentLang) {
  return getWeatherPack(lang).unknownLocation;
}

// ---------------------------------------------------------------------------
// Outfit band templates
// ---------------------------------------------------------------------------

export function getOutfitTempBand(peakTemp: number): OutfitTempBand {
  if (peakTemp >= 25) return 'hot';
  if (peakTemp >= 18) return 'warm';
  if (peakTemp >= 10) return 'mild';
  if (peakTemp >= 0) return 'cold';
  return 'freezing';
}

export function getBaseOutfit(
  peakTemp: number,
  gender: OutfitGender,
  lang: ContentLang,
): LocalizedOutfitRecommendation {
  return getBaseOutfitForTemp(peakTemp, gender === 'female', gender === 'male', lang);
}

export function getBaseOutfitForTemp(
  peakTemp: number,
  isFemale: boolean,
  _isMale: boolean,
  lang: ContentLang,
): LocalizedOutfitRecommendation {
  const band = getOutfitTempBand(peakTemp);
  const template = getWeatherPack(lang).bands[band];
  const stylingNote = fillTemplate(template.stylingNoteTemplate, { peakTemp });

  return {
    layers: [...template.layers],
    keyPieces: isFemale
      ? [...template.keyPiecesFemale]
      : [...template.keyPiecesMale],
    accessories: [...template.accessories],
    colors: [...template.colors],
    fabricTips: template.fabricTips,
    stylingNote,
  };
}

// ---------------------------------------------------------------------------
// Condition overlays
// ---------------------------------------------------------------------------

export function applyRainOverlay(
  rec: LocalizedOutfitRecommendation,
  lang: ContentLang,
): LocalizedOutfitRecommendation {
  const o = getWeatherPack(lang).overlays.rain;
  return {
    ...rec,
    keyPieces: [o.keyPiece, ...rec.keyPieces],
    accessories: [...rec.accessories, ...o.accessories],
    fabricTips: rec.fabricTips + o.fabricTipsSuffix,
    stylingNote: rec.stylingNote + o.stylingNoteSuffix,
  };
}

export function applySnowOverlay(
  rec: LocalizedOutfitRecommendation,
  lang: ContentLang,
): LocalizedOutfitRecommendation {
  const o = getWeatherPack(lang).overlays.snow;
  return {
    ...rec,
    accessories: [...rec.accessories, ...o.accessories],
    stylingNote: rec.stylingNote + o.stylingNoteSuffix,
  };
}

export function applyWindOverlay(
  rec: LocalizedOutfitRecommendation,
  lang: ContentLang,
): LocalizedOutfitRecommendation {
  const o = getWeatherPack(lang).overlays.wind;
  return {
    ...rec,
    accessories: [...rec.accessories, o.accessory],
    stylingNote: rec.stylingNote + o.stylingNoteSuffix,
  };
}

// ---------------------------------------------------------------------------
// Daily range adjustments (same logic as WeatherService)
// ---------------------------------------------------------------------------

/**
 * Match EN labels for stripping winter-leaning items.
 * Filtering decides on English twin arrays so all ContentLang packs work.
 * EN+ES bilingual fallback kept for any non-parallel edge cases.
 */
const WARM_PEAK_ACCESSORY_FILTER =
  /gloves|guantes|wool scarf|bufanda de lana|beanie|gorro|ear muff|orejeras|puffer|plumífero|heavy|pesad|wool coat|abrigo de lana|cable knit|ochos/i;

const WARM_PEAK_KEY_PIECE_FILTER =
  /wool coat|abrigo de lana|cable knit|ochos|puffer|plumífero|thermal|térmic|heavy knit|punto grueso|chunky turtleneck|cuello alto grueso/i;

const MILD_WARM_ACCESSORY_FILTER =
  /scarf|bufanda|pañuelo|gloves|guantes|structured bag|bolso estructurado/i;

/** Keep localized/EN arrays aligned while filtering on English labels (EN+ES fallback). */
function filterParallel(
  localized: string[],
  english: string[],
  filter: RegExp,
): { loc: string[]; en: string[] } {
  const loc: string[] = [];
  const en: string[] = [];
  const len = Math.max(localized.length, english.length);
  for (let i = 0; i < len; i++) {
    const locItem = localized[i];
    const enItem = english[i] ?? locItem;
    if (locItem == null) continue;
    if (filter.test(enItem) || filter.test(locItem)) continue;
    loc.push(locItem);
    en.push(enItem);
  }
  return { loc, en };
}

export function applyDailyRangeAdjustments(
  recommendation: LocalizedOutfitRecommendation,
  lowTemp: number,
  peakTemp: number,
  tempSpread: number,
  isFemale: boolean,
  _isMale: boolean,
  lang: ContentLang,
): LocalizedOutfitRecommendation {
  const adjusted: LocalizedOutfitRecommendation = {
    ...recommendation,
    layers: [...recommendation.layers],
    keyPieces: [...recommendation.keyPieces],
    accessories: [...recommendation.accessories],
    colors: [...recommendation.colors],
  };
  const copy = getWeatherPack(lang).dailyRange;
  // English twin of the same band base — same length/order for filter indices.
  const enBase =
    lang === 'en'
      ? {
          accessories: [...adjusted.accessories],
          keyPieces: [...adjusted.keyPieces],
        }
      : getBaseOutfitForTemp(peakTemp, isFemale, _isMale, 'en');

  let enAccessories = [...enBase.accessories];
  let enKeyPieces = [...enBase.keyPieces];

  // Strip winter accessories if the day will be warm.
  if (peakTemp >= 20) {
    const acc = filterParallel(
      adjusted.accessories,
      enAccessories,
      WARM_PEAK_ACCESSORY_FILTER,
    );
    adjusted.accessories = acc.loc;
    enAccessories = acc.en;

    const kp = filterParallel(
      adjusted.keyPieces,
      enKeyPieces,
      WARM_PEAK_KEY_PIECE_FILTER,
    );
    adjusted.keyPieces = kp.loc;
    enKeyPieces = kp.en;
  }

  if (peakTemp >= 22 && lowTemp <= 18) {
    adjusted.layers =
      lowTemp <= 14 ? [...copy.layersHotMorning] : [...copy.layersHotDay];

    const acc = filterParallel(
      adjusted.accessories,
      enAccessories,
      MILD_WARM_ACCESSORY_FILTER,
    );
    adjusted.accessories = acc.loc;
    enAccessories = acc.en;

    if (!adjusted.accessories.includes(copy.sunglasses)) {
      adjusted.accessories.unshift(copy.sunglasses);
    }

    adjusted.stylingNote = fillTemplate(copy.heatSwingNoteTemplate, {
      lowTemp,
      peakTemp,
    });
  } else if (tempSpread >= 10) {
    adjusted.layers = [...adjusted.layers, copy.wideSwingLayer];
    adjusted.stylingNote = fillTemplate(copy.wideSwingNoteTemplate, {
      lowTemp,
      peakTemp,
    });
  } else if (tempSpread >= 6) {
    adjusted.stylingNote = fillTemplate(copy.modestSwingNoteTemplate, {
      lowTemp,
      peakTemp,
      existing: adjusted.stylingNote,
    });
  }

  // Very cold start but mild peak: don't overdress for the afternoon.
  if (lowTemp < 10 && peakTemp >= 16 && peakTemp < 22) {
    adjusted.keyPieces = isFemale
      ? [...copy.coldMorningFemale]
      : [...copy.coldMorningMale];
    adjusted.layers = [...copy.coldMorningLayers];
  }

  return adjusted;
}

// ---------------------------------------------------------------------------
// Full recommendation builder (mirrors WeatherService.getOutfitRecommendation)
// ---------------------------------------------------------------------------

export type WeatherConditionKind =
  | 'sunny'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'windy'
  | 'foggy'
  | 'stormy';

export function buildLocalizedOutfitRecommendation(params: {
  peakTemp: number;
  lowTemp: number;
  tempSpread: number;
  hasDailyRange: boolean;
  condition: WeatherConditionKind;
  windSpeed: number;
  gender?: string;
  lang: ContentLang;
}): LocalizedOutfitRecommendation {
  const {
    peakTemp,
    lowTemp,
    tempSpread,
    hasDailyRange,
    condition,
    windSpeed,
    gender = 'unspecified',
    lang,
  } = params;

  const isFemale = gender === 'female';
  const isMale = gender === 'male';

  let recommendation = getBaseOutfitForTemp(peakTemp, isFemale, isMale, lang);

  if (hasDailyRange && tempSpread >= 6) {
    recommendation = applyDailyRangeAdjustments(
      recommendation,
      lowTemp,
      peakTemp,
      tempSpread,
      isFemale,
      isMale,
      lang,
    );
  }

  if (condition === 'rainy' || condition === 'stormy') {
    recommendation = applyRainOverlay(recommendation, lang);
  }

  if (condition === 'snowy') {
    recommendation = applySnowOverlay(recommendation, lang);
  }

  if (windSpeed > 20) {
    recommendation = applyWindOverlay(recommendation, lang);
  }

  return recommendation;
}
