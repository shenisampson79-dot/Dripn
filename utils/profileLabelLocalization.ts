/**
 * Localize color-season / subtype and body-shape labels for Profile chrome.
 */

export type TranslateFn = (key: string) => string;

const BODY_SHAPE_KEYS: Record<string, string> = {
  hourglass: 'bodyShapes.hourglass',
  pear: 'bodyShapes.pear',
  apple: 'bodyShapes.apple',
  rectangle: 'bodyShapes.rectangle',
  'inverted-triangle': 'bodyShapes.invertedTriangle',
  invertedtriangle: 'bodyShapes.invertedTriangle',
  athletic: 'bodyShapes.athletic',
  petite: 'bodyShapes.petite',
  'plus-size': 'bodyShapes.plusSize',
  plussize: 'bodyShapes.plusSize',
  tall: 'bodyShapes.tall',
};

const SEASON_KEYS: Record<string, string> = {
  spring: 'colorSeasons.spring',
  summer: 'colorSeasons.summer',
  autumn: 'colorSeasons.autumn',
  fall: 'colorSeasons.autumn',
  winter: 'colorSeasons.winter',
};

const SUBTYPE_KEYS: Record<string, string> = {
  light: 'colorSubtypes.light',
  true: 'colorSubtypes.true',
  deep: 'colorSubtypes.deep',
  warm: 'colorSubtypes.warm',
  cool: 'colorSubtypes.cool',
  soft: 'colorSubtypes.soft',
  clear: 'colorSubtypes.clear',
  bright: 'colorSubtypes.bright',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export function getLocalizedBodyShapeLabel(
  shape: string | null | undefined,
  t: TranslateFn,
): string {
  if (!shape || shape === 'unknown') return '';
  const key = BODY_SHAPE_KEYS[normalizeKey(shape)];
  const localizedShape = key
    ? t(key) || shape
    : shape
        .split(/[-_\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  return (t('bodyShapes.shapeValue') || '{shape} shape').replace('{shape}', localizedShape);
}

export function getLocalizedColorSeasonLabel(
  season: string | null | undefined,
  subtype: string | null | undefined,
  t: TranslateFn,
): string {
  if (!season) return '';
  const seasonKey = SEASON_KEYS[normalizeKey(season)];
  const localizedSeason = seasonKey
    ? t(seasonKey) || season.charAt(0).toUpperCase() + season.slice(1)
    : season.charAt(0).toUpperCase() + season.slice(1);

  if (!subtype) return localizedSeason;

  const subtypeKey = SUBTYPE_KEYS[normalizeKey(subtype)];
  const localizedSubtype = subtypeKey ? t(subtypeKey) || subtype : subtype;
  return (t('colorSeasons.withSubtype') || '{season} · {subtype}')
    .replace('{season}', localizedSeason)
    .replace('{subtype}', localizedSubtype);
}

/** Localize app-generated lookbook titles / tags; leave custom AI titles as stored. */
export function getLocalizedLookbookTitle(
  title: string | null | undefined,
  dayNumber: number,
  t: TranslateFn,
): string {
  const dayTag = (t('profile.lookbookDayTag') || 'Lookbook · Day {day}').replace(
    '{day}',
    String(dayNumber),
  );
  const dayLook = (t('profile.dayNLook') || 'Day {day} Look').replace(
    '{day}',
    String(dayNumber),
  );

  if (!title || !title.trim()) return dayTag;

  const trimmed = title.trim();
  if (/^lookbook\s*[·•\-–—]?\s*day\s*\d+$/i.test(trimmed)) return dayTag;
  if (/^day\s*\d+\s*look$/i.test(trimmed)) return dayLook;
  if (/^my\s+lookbook\s*[·•\-–—]?\s*day\s*\d+$/i.test(trimmed)) {
    return (t('profile.myLookbookDay') || 'My Lookbook · Day {day}').replace(
      '{day}',
      String(dayNumber),
    );
  }
  return trimmed;
}

export function getLocalizedLookbookDayTag(dayNumber: number, t: TranslateFn): string {
  return (t('profile.lookbookDayTag') || 'Lookbook · Day {day}').replace(
    '{day}',
    String(dayNumber),
  );
}
