#!/usr/bin/env node
/**
 * Merge remaining i18n keys for Wardrobe / Stylist / Profile / countries.
 * Country names are generated via Node Intl.DisplayNames (reliable offline),
 * because Hermes often lacks CLDR data at runtime.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');

const LOCALE_FOR_INTL = {
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

/** English name → ISO (mirrors utils/countryLocalization.ts) */
const ENGLISH_TO_ISO = {
  Albania: 'AL', Andorra: 'AD', 'Antigua and Barbuda': 'AG', Argentina: 'AR',
  Armenia: 'AM', Australia: 'AU', Austria: 'AT', Azerbaijan: 'AZ', Bahamas: 'BS',
  Bangladesh: 'BD', Barbados: 'BB', Belarus: 'BY', Belgium: 'BE', Belize: 'BZ',
  Bolivia: 'BO', 'Bosnia and Herzegovina': 'BA', Botswana: 'BW', Brazil: 'BR',
  Bulgaria: 'BG', Canada: 'CA', 'Cayman Islands': 'KY', Chile: 'CL', China: 'CN',
  Colombia: 'CO', 'Costa Rica': 'CR', Croatia: 'HR', Cuba: 'CU', Curacao: 'CW',
  Cyprus: 'CY', 'Czech Republic': 'CZ', Denmark: 'DK', Dominica: 'DM',
  'Dominican Republic': 'DO', Ecuador: 'EC', Egypt: 'EG', 'El Salvador': 'SV',
  Estonia: 'EE', Ethiopia: 'ET', Fiji: 'FJ', Finland: 'FI', France: 'FR',
  Georgia: 'GE', Germany: 'DE', Ghana: 'GH', Greece: 'GR', Grenada: 'GD',
  Guatemala: 'GT', Guyana: 'GY', Haiti: 'HT', Honduras: 'HN', 'Hong Kong': 'HK',
  Hungary: 'HU', Iceland: 'IS', India: 'IN', Indonesia: 'ID', Ireland: 'IE',
  Israel: 'IL', Italy: 'IT', Jamaica: 'JM', Japan: 'JP', Jordan: 'JO',
  Kazakhstan: 'KZ', Kenya: 'KE', Kosovo: 'XK', Kuwait: 'KW', Latvia: 'LV',
  Lebanon: 'LB', Liechtenstein: 'LI', Lithuania: 'LT', Luxembourg: 'LU',
  Macau: 'MO', Malaysia: 'MY', Maldives: 'MV', Malta: 'MT', Mauritius: 'MU',
  Mexico: 'MX', Moldova: 'MD', Monaco: 'MC', Montenegro: 'ME', Morocco: 'MA',
  Namibia: 'NA', Nepal: 'NP', Netherlands: 'NL', 'New Zealand': 'NZ',
  Nicaragua: 'NI', Nigeria: 'NG', 'North Macedonia': 'MK', Norway: 'NO',
  Oman: 'OM', Pakistan: 'PK', Panama: 'PA', Paraguay: 'PY', Peru: 'PE',
  Philippines: 'PH', Poland: 'PL', Portugal: 'PT', 'Puerto Rico': 'PR',
  Qatar: 'QA', Romania: 'RO', Russia: 'RU', Rwanda: 'RW',
  'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC',
  'Saint Vincent and the Grenadines': 'VC', 'San Marino': 'SM',
  'Saudi Arabia': 'SA', Senegal: 'SN', Serbia: 'RS', Seychelles: 'SC',
  Singapore: 'SG', Slovakia: 'SK', Slovenia: 'SI', 'South Africa': 'ZA',
  'South Korea': 'KR', Spain: 'ES', 'Sri Lanka': 'LK', Suriname: 'SR',
  Sweden: 'SE', Switzerland: 'CH', Taiwan: 'TW', Tanzania: 'TZ', Thailand: 'TH',
  'Trinidad and Tobago': 'TT', Tunisia: 'TN', Turkey: 'TR',
  'Turks and Caicos Islands': 'TC', UAE: 'AE', Uganda: 'UG', Ukraine: 'UA',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'United States': 'US',
  Uruguay: 'UY', 'US Virgin Islands': 'VI', 'Vatican City': 'VA',
  Venezuela: 'VE', Vietnam: 'VN', Zambia: 'ZM', Zimbabwe: 'ZW',
};

const EN_KEYS = {
  'wardrobe.aiOutfit': 'AI Outfit',
  'wardrobe.outfitMix': 'Outfit Mix',
  'wardrobe.bulkAdd': 'Bulk Add',
  'wardrobe.addItem': 'Add Item',
  'wardrobe.select': 'Select',
  'wardrobe.cancel': 'Cancel',
  'wardrobe.delete': 'Delete',
  'wardrobe.deleteCount': 'Delete ({n})',
  'wardrobe.selectedCount': '{count} Selected',
  'wardrobe.wornTimes': 'Worn {n}x',
  'wardrobe.daysLeft': '{n}d left',
  'wardrobe.dailyOutfits': 'Daily outfits',
  'wardrobe.mixAndMatch': 'Mix & match',

  'aiStylist.outfitFromWardrobe': 'Outfit from your wardrobe',
  'aiStylist.weatherLook': 'Weather look',
  'aiStylist.welcomeMessage':
    "Hello {name}! I'm {stylist}, your personal stylist. I've been exploring your wardrobe and I'm excited about the possibilities we can create together. What brings you here today?",
  'aiStylist.welcomeNameFallback': 'there',
  'aiStylist.promptWorkOutfit': 'Work Outfit',
  'aiStylist.promptDateNight': 'Date Night',
  'aiStylist.promptCasualWeekend': 'Casual Weekend',
  'aiStylist.promptCasualDay': 'Casual Day',
  'aiStylist.promptWeekend': 'Weekend',
  'aiStylist.promptSpecialEvent': 'Special Event',
  'aiStylist.promptColorAdvice': 'Color advice',
  'aiStylist.promptSmartCasual': 'Smart Casual',
  'aiStylist.promptGym': 'Gym',
  'aiStylist.promptEveningOut': 'Evening Out',
  'aiStylist.promptTravel': 'Travel',

  'bodyShapes.hourglass': 'Hourglass',
  'bodyShapes.pear': 'Pear',
  'bodyShapes.apple': 'Apple',
  'bodyShapes.rectangle': 'Rectangle',
  'bodyShapes.invertedTriangle': 'Inverted triangle',
  'bodyShapes.athletic': 'Athletic',
  'bodyShapes.petite': 'Petite',
  'bodyShapes.plusSize': 'Plus size',
  'bodyShapes.tall': 'Tall',
  'bodyShapes.shapeValue': '{shape} shape',

  'colorSeasons.spring': 'Spring',
  'colorSeasons.summer': 'Summer',
  'colorSeasons.autumn': 'Autumn',
  'colorSeasons.winter': 'Winter',
  'colorSeasons.withSubtype': '{season} · {subtype}',
  'colorSubtypes.light': 'light',
  'colorSubtypes.true': 'true',
  'colorSubtypes.deep': 'deep',
  'colorSubtypes.warm': 'warm',
  'colorSubtypes.cool': 'cool',
  'colorSubtypes.soft': 'soft',
  'colorSubtypes.clear': 'clear',
  'colorSubtypes.bright': 'bright',

  'profile.lookbookDayTag': 'Lookbook · Day {day}',
  'profile.dayNLook': 'Day {day} Look',
  'profile.myOutfit': 'My Outfit',
  'profile.lovedOutfit': 'Loved Outfit',
  'profile.itemsCount': '{count} items',
  'profile.undertoneValue': '{tone} undertone',
};

const LOCALIZED = {
  es: {
    'wardrobe.aiOutfit': 'Outfit IA',
    'wardrobe.outfitMix': 'Mezclar outfits',
    'wardrobe.bulkAdd': 'Añadir varios',
    'wardrobe.addItem': 'Añadir prenda',
    'wardrobe.select': 'Seleccionar',
    'wardrobe.cancel': 'Cancelar',
    'wardrobe.delete': 'Eliminar',
    'wardrobe.deleteCount': 'Eliminar ({n})',
    'wardrobe.selectedCount': '{count} seleccionados',
    'wardrobe.wornTimes': 'Usado {n}x',
    'wardrobe.daysLeft': '{n}d restantes',
    'wardrobe.dailyOutfits': 'Outfits diarios',
    'wardrobe.mixAndMatch': 'Mezclar y combinar',
    'aiStylist.outfitFromWardrobe': 'Outfit de tu armario',
    'aiStylist.weatherLook': 'Look según el clima',
    'aiStylist.welcomeMessage':
      '¡Hola {name}! Soy {stylist}, tu estilista personal. He estado explorando tu armario y me entusiasman las posibilidades que podemos crear juntos. ¿Qué te trae por aquí hoy?',
    'aiStylist.welcomeNameFallback': 'hola',
    'aiStylist.promptWorkOutfit': 'Outfit de trabajo',
    'aiStylist.promptDateNight': 'Cita nocturna',
    'aiStylist.promptCasualWeekend': 'Fin de semana informal',
    'aiStylist.promptCasualDay': 'Día casual',
    'aiStylist.promptWeekend': 'Fin de semana',
    'aiStylist.promptSpecialEvent': 'Evento especial',
    'aiStylist.promptColorAdvice': 'Consejo de color',
    'aiStylist.promptSmartCasual': 'Smart casual',
    'aiStylist.promptGym': 'Gimnasio',
    'aiStylist.promptEveningOut': 'Noche de salida',
    'aiStylist.promptTravel': 'Viaje',
    'bodyShapes.hourglass': 'Reloj de arena',
    'bodyShapes.pear': 'Pera',
    'bodyShapes.apple': 'Manzana',
    'bodyShapes.rectangle': 'Rectángulo',
    'bodyShapes.invertedTriangle': 'Triángulo invertido',
    'bodyShapes.athletic': 'Atlético',
    'bodyShapes.petite': 'Petite',
    'bodyShapes.plusSize': 'Talla grande',
    'bodyShapes.tall': 'Alto',
    'bodyShapes.shapeValue': 'Forma {shape}',
    'colorSeasons.spring': 'Primavera',
    'colorSeasons.summer': 'Verano',
    'colorSeasons.autumn': 'Otoño',
    'colorSeasons.winter': 'Invierno',
    'colorSeasons.withSubtype': '{season} · {subtype}',
    'colorSubtypes.light': 'claro',
    'colorSubtypes.true': 'puro',
    'colorSubtypes.deep': 'profundo',
    'colorSubtypes.warm': 'cálido',
    'colorSubtypes.cool': 'frío',
    'colorSubtypes.soft': 'suave',
    'colorSubtypes.clear': 'claro intenso',
    'colorSubtypes.bright': 'brillante',
    'profile.lookbookDayTag': 'Lookbook · Día {day}',
    'profile.dayNLook': 'Look del día {day}',
    'profile.myOutfit': 'Mi outfit',
    'profile.lovedOutfit': 'Outfit favorito',
    'profile.itemsCount': '{count} prendas',
    'profile.undertoneValue': 'Subtono {tone}',
  },
  fr: {
    'wardrobe.aiOutfit': 'Tenue IA',
    'wardrobe.outfitMix': 'Mix de tenues',
    'wardrobe.bulkAdd': 'Ajout multiple',
    'wardrobe.addItem': 'Ajouter',
    'wardrobe.select': 'Sélectionner',
    'wardrobe.cancel': 'Annuler',
    'wardrobe.delete': 'Supprimer',
    'wardrobe.deleteCount': 'Supprimer ({n})',
    'wardrobe.selectedCount': '{count} sélectionné(s)',
    'wardrobe.wornTimes': 'Porté {n}x',
    'wardrobe.daysLeft': '{n}j restants',
    'wardrobe.dailyOutfits': 'Tenues du jour',
    'wardrobe.mixAndMatch': 'Mix & match',
    'aiStylist.outfitFromWardrobe': 'Tenue depuis votre garde-robe',
    'aiStylist.weatherLook': 'Look météo',
    'aiStylist.welcomeMessage':
      'Bonjour {name} ! Je suis {stylist}, votre styliste personnel. J’ai exploré votre garde-robe et je suis déjà enthousiaste. Qu’est-ce qui vous amène aujourd’hui ?',
    'aiStylist.welcomeNameFallback': 'toi',
    'aiStylist.promptWorkOutfit': 'Tenue de travail',
    'aiStylist.promptDateNight': 'Soirée en amoureux',
    'aiStylist.promptCasualWeekend': 'Week-end décontracté',
    'aiStylist.promptCasualDay': 'Journée casual',
    'aiStylist.promptWeekend': 'Week-end',
    'aiStylist.promptSpecialEvent': 'Événement spécial',
    'aiStylist.promptColorAdvice': 'Conseil couleur',
    'bodyShapes.rectangle': 'Rectangle',
    'bodyShapes.shapeValue': 'Silhouette {shape}',
    'colorSeasons.autumn': 'Automne',
    'colorSubtypes.deep': 'profond',
    'profile.lookbookDayTag': 'Lookbook · Jour {day}',
    'profile.dayNLook': 'Look du jour {day}',
  },
  de: {
    'wardrobe.aiOutfit': 'KI-Outfit',
    'wardrobe.outfitMix': 'Outfit-Mix',
    'wardrobe.bulkAdd': 'Mehrere hinzufügen',
    'wardrobe.addItem': 'Teil hinzufügen',
    'wardrobe.select': 'Auswählen',
    'wardrobe.wornTimes': '{n}x getragen',
    'wardrobe.daysLeft': 'Noch {n} T.',
    'wardrobe.dailyOutfits': 'Tägliche Outfits',
    'aiStylist.outfitFromWardrobe': 'Outfit aus deinem Kleiderschrank',
    'aiStylist.weatherLook': 'Wetter-Look',
    'aiStylist.welcomeMessage':
      'Hallo {name}! Ich bin {stylist}, dein persönlicher Stylist. Ich habe deinen Kleiderschrank erkundet und freue mich schon. Was führt dich heute hierher?',
    'aiStylist.promptCasualDay': 'Casual Day',
    'aiStylist.promptWeekend': 'Wochenende',
    'bodyShapes.rectangle': 'Rechteck',
    'bodyShapes.shapeValue': '{shape}-Figur',
    'colorSeasons.autumn': 'Herbst',
    'colorSubtypes.deep': 'tief',
    'profile.lookbookDayTag': 'Lookbook · Tag {day}',
    'profile.dayNLook': 'Look Tag {day}',
  },
  it: {
    'wardrobe.aiOutfit': 'Outfit IA',
    'wardrobe.outfitMix': 'Mix outfit',
    'wardrobe.bulkAdd': 'Aggiungi più',
    'wardrobe.addItem': 'Aggiungi capo',
    'wardrobe.select': 'Seleziona',
    'wardrobe.wornTimes': 'Indossato {n}x',
    'wardrobe.daysLeft': '{n}g rimasti',
    'wardrobe.dailyOutfits': 'Outfit giornalieri',
    'aiStylist.outfitFromWardrobe': 'Outfit dal tuo guardaroba',
    'aiStylist.weatherLook': 'Look meteo',
    'aiStylist.welcomeMessage':
      'Ciao {name}! Sono {stylist}, il tuo stilista personale. Ho esplorato il tuo guardaroba e sono già entusiasta. Cosa ti porta qui oggi?',
    'aiStylist.promptCasualDay': 'Giorno casual',
    'aiStylist.promptWeekend': 'Weekend',
    'bodyShapes.rectangle': 'Rettangolo',
    'bodyShapes.shapeValue': 'Forma {shape}',
    'colorSeasons.autumn': 'Autunno',
    'colorSubtypes.deep': 'profondo',
    'profile.lookbookDayTag': 'Lookbook · Giorno {day}',
    'profile.dayNLook': 'Look del giorno {day}',
  },
  pt: {
    'wardrobe.aiOutfit': 'Outfit IA',
    'wardrobe.outfitMix': 'Misturar outfits',
    'wardrobe.bulkAdd': 'Adicionar vários',
    'wardrobe.addItem': 'Adicionar peça',
    'wardrobe.select': 'Selecionar',
    'wardrobe.wornTimes': 'Usado {n}x',
    'wardrobe.daysLeft': '{n}d restantes',
    'wardrobe.dailyOutfits': 'Outfits diários',
    'aiStylist.outfitFromWardrobe': 'Outfit do seu guarda-roupa',
    'aiStylist.weatherLook': 'Look do clima',
    'aiStylist.welcomeMessage':
      'Olá {name}! Sou {stylist}, seu estilista pessoal. Explorei seu guarda-roupa e já estou animado. O que te traz aqui hoje?',
    'aiStylist.promptCasualDay': 'Dia casual',
    'aiStylist.promptWeekend': 'Fim de semana',
    'bodyShapes.rectangle': 'Retângulo',
    'bodyShapes.shapeValue': 'Formato {shape}',
    'colorSeasons.autumn': 'Outono',
    'colorSubtypes.deep': 'profundo',
    'profile.lookbookDayTag': 'Lookbook · Dia {day}',
    'profile.dayNLook': 'Look do dia {day}',
  },
};

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + '\n');
}

function upsert(target, keys) {
  let n = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (target[k] !== v) {
      target[k] = v;
      n++;
    }
  }
  return n;
}

function buildCountryKeys(lang) {
  const locale = LOCALE_FOR_INTL[lang] || lang;
  let dn = null;
  try {
    dn = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    dn = null;
  }
  const keys = {};
  const seen = new Set();
  for (const [english, iso] of Object.entries(ENGLISH_TO_ISO)) {
    if (seen.has(iso)) continue;
    seen.add(iso);
    let label = english;
    if (dn) {
      try {
        label = dn.of(iso) || english;
      } catch {
        label = english;
      }
    }
    keys[`countries.${iso}`] = label;
  }
  // Friendly aliases
  keys['countries.unitedStates'] = keys['countries.US'];
  keys['countries.unitedKingdom'] = keys['countries.GB'];
  keys['countries.unitedArabEmirates'] = keys['countries.AE'];
  return keys;
}

const enFlat = fs.existsSync(EN_FLAT) ? loadJson(EN_FLAT) : {};
const enCountry = buildCountryKeys('en');
upsert(enFlat, { ...EN_KEYS, ...enCountry });
saveJson(EN_FLAT, enFlat);

const enLocale = path.join(LOCALES_DIR, 'en.json');
const en = loadJson(enLocale);
upsert(en, { ...EN_KEYS, ...enCountry });
saveJson(enLocale, en);

const langs = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json') && f !== 'en.json');
for (const file of langs) {
  const lang = file.replace('.json', '');
  const p = path.join(LOCALES_DIR, file);
  const data = loadJson(p);
  const curated = LOCALIZED[lang] || {};
  const countryKeys = buildCountryKeys(lang);
  for (const [k, enVal] of Object.entries(EN_KEYS)) {
    if (curated[k]) {
      data[k] = curated[k];
    } else if (!data[k] || data[k] === '' || data[k] === enVal) {
      data[k] = enVal;
    }
  }
  upsert(data, countryKeys);
  saveJson(p, data);
  console.log('updated', lang);
}

console.log('done');
