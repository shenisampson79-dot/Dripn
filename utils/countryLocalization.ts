/**
 * Localize country display names.
 *
 * Stored profile values stay English (e.g. "United States").
 * Display prefers i18n keys (`countries.US`) because Hermes/RN often lacks
 * full Intl.DisplayNames locale data — Intl may exist but still return English.
 * Node/Intl is used only as a secondary attempt, then English as last resort.
 */

/** English display name → ISO 3166-1 alpha-2 (or XK for Kosovo) */
const ENGLISH_TO_ISO: Record<string, string> = {
  Albania: 'AL',
  Andorra: 'AD',
  'Antigua and Barbuda': 'AG',
  Argentina: 'AR',
  Armenia: 'AM',
  Australia: 'AU',
  Austria: 'AT',
  Azerbaijan: 'AZ',
  Bahamas: 'BS',
  Bangladesh: 'BD',
  Barbados: 'BB',
  Belarus: 'BY',
  Belgium: 'BE',
  Belize: 'BZ',
  Bolivia: 'BO',
  'Bosnia and Herzegovina': 'BA',
  Botswana: 'BW',
  Brazil: 'BR',
  Bulgaria: 'BG',
  Canada: 'CA',
  'Cayman Islands': 'KY',
  Chile: 'CL',
  China: 'CN',
  Colombia: 'CO',
  'Costa Rica': 'CR',
  Croatia: 'HR',
  Cuba: 'CU',
  Curacao: 'CW',
  Cyprus: 'CY',
  'Czech Republic': 'CZ',
  Denmark: 'DK',
  Dominica: 'DM',
  'Dominican Republic': 'DO',
  Ecuador: 'EC',
  Egypt: 'EG',
  'El Salvador': 'SV',
  Estonia: 'EE',
  Ethiopia: 'ET',
  Fiji: 'FJ',
  Finland: 'FI',
  France: 'FR',
  Georgia: 'GE',
  Germany: 'DE',
  Ghana: 'GH',
  Greece: 'GR',
  Grenada: 'GD',
  Guatemala: 'GT',
  Guyana: 'GY',
  Haiti: 'HT',
  Honduras: 'HN',
  'Hong Kong': 'HK',
  Hungary: 'HU',
  Iceland: 'IS',
  India: 'IN',
  Indonesia: 'ID',
  Ireland: 'IE',
  Israel: 'IL',
  Italy: 'IT',
  Jamaica: 'JM',
  Japan: 'JP',
  Jordan: 'JO',
  Kazakhstan: 'KZ',
  Kenya: 'KE',
  Kosovo: 'XK',
  Kuwait: 'KW',
  Latvia: 'LV',
  Lebanon: 'LB',
  Liechtenstein: 'LI',
  Lithuania: 'LT',
  Luxembourg: 'LU',
  Macau: 'MO',
  Malaysia: 'MY',
  Maldives: 'MV',
  Malta: 'MT',
  Mauritius: 'MU',
  Mexico: 'MX',
  Moldova: 'MD',
  Monaco: 'MC',
  Montenegro: 'ME',
  Morocco: 'MA',
  Namibia: 'NA',
  Nepal: 'NP',
  Netherlands: 'NL',
  'New Zealand': 'NZ',
  Nicaragua: 'NI',
  Nigeria: 'NG',
  'North Macedonia': 'MK',
  Norway: 'NO',
  Oman: 'OM',
  Pakistan: 'PK',
  Panama: 'PA',
  Paraguay: 'PY',
  Peru: 'PE',
  Philippines: 'PH',
  Poland: 'PL',
  Portugal: 'PT',
  'Puerto Rico': 'PR',
  Qatar: 'QA',
  Romania: 'RO',
  Russia: 'RU',
  Rwanda: 'RW',
  'Saint Kitts and Nevis': 'KN',
  'Saint Lucia': 'LC',
  'Saint Vincent and the Grenadines': 'VC',
  'San Marino': 'SM',
  'Saudi Arabia': 'SA',
  Senegal: 'SN',
  Serbia: 'RS',
  Seychelles: 'SC',
  Singapore: 'SG',
  Slovakia: 'SK',
  Slovenia: 'SI',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  Spain: 'ES',
  'Sri Lanka': 'LK',
  Suriname: 'SR',
  Sweden: 'SE',
  Switzerland: 'CH',
  Taiwan: 'TW',
  Tanzania: 'TZ',
  Thailand: 'TH',
  'Trinidad and Tobago': 'TT',
  Tunisia: 'TN',
  Turkey: 'TR',
  'Turks and Caicos Islands': 'TC',
  UAE: 'AE',
  Uganda: 'UG',
  Ukraine: 'UA',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'United States': 'US',
  Uruguay: 'UY',
  'US Virgin Islands': 'VI',
  'Vatican City': 'VA',
  Venezuela: 'VE',
  Vietnam: 'VN',
  Zambia: 'ZM',
  Zimbabwe: 'ZW',
};

/** Common ISO / alias inputs → canonical English name used in ENGLISH_TO_ISO */
const ALIAS_TO_ENGLISH: Record<string, string> = {
  US: 'United States',
  USA: 'United States',
  'UNITED STATES': 'United States',
  'UNITED STATES OF AMERICA': 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  'UNITED KINGDOM': 'United Kingdom',
  AE: 'United Arab Emirates',
  UAE: 'United Arab Emirates',
};

/** Friendly aliases for translation keys (in addition to countries.US) */
const ISO_TO_ALIAS_KEYS: Record<string, string[]> = {
  US: ['countries.unitedStates', 'countries.US'],
  GB: ['countries.unitedKingdom', 'countries.GB'],
  AE: ['countries.unitedArabEmirates', 'countries.AE'],
};

const displayNameCache = new Map<string, Intl.DisplayNames>();

/** Map app language codes to BCP 47 tags Intl.DisplayNames handles well. */
const LOCALE_FOR_INTL: Record<string, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  nl: 'nl',
  pl: 'pl',
  ru: 'ru',
  zh: 'zh-Hans',
  ja: 'ja',
  ko: 'ko',
  ar: 'ar',
  hi: 'hi',
  tr: 'tr',
  sv: 'sv',
  da: 'da',
  no: 'nb',
  fi: 'fi',
};

function normalizeEnglishCountryName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (ALIAS_TO_ENGLISH[upper]) return ALIAS_TO_ENGLISH[upper];
  if (ENGLISH_TO_ISO[trimmed]) return trimmed;
  // Case-insensitive English match
  const found = Object.keys(ENGLISH_TO_ISO).find(
    (name) => name.toLowerCase() === trimmed.toLowerCase(),
  );
  return found || trimmed;
}

function getDisplayNames(language: string): Intl.DisplayNames | null {
  const base = (language || 'en').split('-')[0];
  const locale = LOCALE_FOR_INTL[base] || base;
  const cached = displayNameCache.get(locale);
  if (cached) return cached;
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
      return null;
    }
    const dn = new Intl.DisplayNames([locale], { type: 'region' });
    // Probe: Hermes often constructs DisplayNames but returns English/ISO for all locales.
    const probe = dn.of('US');
    if (locale !== 'en' && (probe === 'United States' || probe === 'US' || !probe)) {
      return null;
    }
    displayNameCache.set(locale, dn);
    return dn;
  } catch {
    return null;
  }
}

export function getCountryIsoCode(englishName: string): string | undefined {
  const normalized = normalizeEnglishCountryName(englishName);
  return ENGLISH_TO_ISO[normalized];
}

type TranslateFn = (key: string) => string;

function translateCountry(
  iso: string,
  englishName: string,
  t?: TranslateFn,
): string | null {
  if (!t) return null;
  const keys = [...(ISO_TO_ALIAS_KEYS[iso] || []), `countries.${iso}`];
  for (const key of keys) {
    const value = t(key);
    if (value && value !== key && value !== englishName) {
      return value;
    }
    // Accept translated value even if somehow equal for English
    if (value && value !== key) {
      return value;
    }
  }
  return null;
}

/** Localized label for a stored English country name (or ISO alias). */
export function getLocalizedCountryName(
  englishName: string | null | undefined,
  language: string,
  t?: TranslateFn,
): string {
  if (!englishName) return '';
  const normalized = normalizeEnglishCountryName(englishName);
  const iso = ENGLISH_TO_ISO[normalized];
  if (!iso) return englishName;

  // 1) Prefer bundled i18n keys (reliable on Hermes / RN)
  const fromKeys = translateCountry(iso, normalized, t);
  if (fromKeys) return fromKeys;

  // 2) Intl when the runtime has real locale data
  const base = (language || 'en').split('-')[0];
  if (base !== 'en') {
    const dn = getDisplayNames(language);
    if (dn) {
      try {
        const localized = dn.of(iso);
        if (localized && localized !== normalized && localized !== iso) {
          return localized;
        }
      } catch {
        // fall through
      }
    }
  }

  return normalized;
}

/** Filter countries by English or localized name. */
export function filterCountriesBySearch(
  countries: readonly string[],
  search: string,
  language: string,
  t?: TranslateFn,
): string[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...countries];
  return countries.filter((english) => {
    if (english.toLowerCase().includes(q)) return true;
    const localized = getLocalizedCountryName(english, language, t).toLowerCase();
    return localized.includes(q);
  });
}

/** All ISO codes we ship country translation keys for. */
export function getAllCountryIsoCodes(): string[] {
  return [...new Set(Object.values(ENGLISH_TO_ISO))];
}

export { ENGLISH_TO_ISO, LOCALE_FOR_INTL };
