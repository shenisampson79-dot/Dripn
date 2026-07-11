/**
 * Localize country display names using Intl.DisplayNames (CLDR),
 * while keeping English names as the stored profile values.
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
    displayNameCache.set(locale, dn);
    return dn;
  } catch {
    return null;
  }
}

export function getCountryIsoCode(englishName: string): string | undefined {
  return ENGLISH_TO_ISO[englishName];
}

/** Localized label for a stored English country name. */
export function getLocalizedCountryName(
  englishName: string | null | undefined,
  language: string,
): string {
  if (!englishName) return '';
  const iso = ENGLISH_TO_ISO[englishName];
  if (!iso) return englishName;
  const dn = getDisplayNames(language);
  if (!dn) return englishName;
  try {
    return dn.of(iso) || englishName;
  } catch {
    return englishName;
  }
}

/** Filter countries by English or localized name. */
export function filterCountriesBySearch(
  countries: readonly string[],
  search: string,
  language: string,
): string[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...countries];
  return countries.filter((english) => {
    if (english.toLowerCase().includes(q)) return true;
    const localized = getLocalizedCountryName(english, language).toLowerCase();
    return localized.includes(q);
  });
}
