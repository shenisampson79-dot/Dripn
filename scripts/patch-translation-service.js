const fs = require('fs');
const path = require('path');

const SERVICE = path.join(__dirname, '../services/TranslationService.ts');
const extSnippet = fs.readFileSync(path.join(__dirname, '_extended-en-snippet.txt'), 'utf8');
const esSnippet = fs.readFileSync(path.join(__dirname, '_es-snippet.txt'), 'utf8');

let lines = fs.readFileSync(SERVICE, 'utf8').split('\n');

// 1. Index signature
if (!lines.some((l) => l.includes('[key: string]: any'))) {
  const idx = lines.findIndex((l) => l.trim() === 'aiStylist: AIStylistTranslations;');
  if (idx >= 0) lines.splice(idx + 1, 0, '  [key: string]: any;');
}

// 2. Extended DEFAULT_TRANSLATIONS before closing };
if (!lines.some((l) => l.includes('Extended sections from en-flat.json'))) {
  const aiClose = lines.findIndex((l, i) => l.includes('decisionSanityCheckDesc:') && i > 500);
  let closeIdx = -1;
  for (let i = aiClose + 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '') === '};') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx < 0) throw new Error('Could not find DEFAULT_TRANSLATIONS closing');
  const extLines = extSnippet.trimEnd().split('\n');
  lines.splice(closeIdx, 0, '  // Extended sections from en-flat.json', ...extLines);
}

// 3. UI_FULL_COVERAGE export before LOCAL_TRANSLATIONS
if (!lines.some((l) => l.includes('UI_FULL_COVERAGE_LANGUAGES'))) {
  const localIdx = lines.findIndex((l) => l.startsWith('const LOCAL_TRANSLATIONS'));
  lines.splice(localIdx, 0, "export const UI_FULL_COVERAGE_LANGUAGES = ['en', 'es'] as const;", '');
}

// 4. Replace es block in LOCAL_TRANSLATIONS
const esStart = lines.findIndex((l) => l.replace(/\r$/, '').trim() === 'es: {');
const frStart = lines.findIndex((l) => l.replace(/\r$/, '').trim() === 'fr: {');
if (esStart >= 0 && frStart > esStart) {
  const newEsLines = esSnippet.split('\n');
  lines.splice(esStart + 1, frStart - esStart - 1, ...newEsLines);
}

// 5. Replace mergeTranslations method
const mergeStart = lines.findIndex((l) => l.includes('private mergeTranslations('));
const setLangStart = lines.findIndex((l) => l.includes('async setLanguage(langCode'));
if (mergeStart >= 0 && setLangStart > mergeStart) {
  const newMerge = `  private mergeTranslations(backendTranslations: Record<string, any>, langCode: string): Translations {
    const flatToNested = (flat: Record<string, any>): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const key in flat) {
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = current[parts[i]] || {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = flat[key];
      }
      return result;
    };

    const nested = flatToNested(backendTranslations);

    const core: Record<string, any> = {
      locale: langCode,
      localeInfo: {
        direction: 'ltr',
        locale: langCode,
        language: nested.localeInfo?.language || langCode,
      },
      common: { ...DEFAULT_TRANSLATIONS.common, ...nested.common },
      nav: { ...DEFAULT_TRANSLATIONS.nav, ...nested.nav },
      stylist: { ...DEFAULT_TRANSLATIONS.stylist, ...nested.stylist },
      wardrobe: { ...DEFAULT_TRANSLATIONS.wardrobe, ...nested.wardrobe },
      profile: { ...DEFAULT_TRANSLATIONS.profile, ...nested.profile },
      stylistHub: {
        ...DEFAULT_TRANSLATIONS.stylistHub,
        ...nested.stylistHub,
        personalStylist:
          nested.stylistHub?.personalStylist === 'Personal Stylist'
            ? DEFAULT_TRANSLATIONS.stylistHub.personalStylist
            : (nested.stylistHub?.personalStylist ?? DEFAULT_TRANSLATIONS.stylistHub.personalStylist),
        personalStylistDesc:
          nested.stylistHub?.personalStylistDesc ?? DEFAULT_TRANSLATIONS.stylistHub.personalStylistDesc,
      },
      bodyScan: { ...DEFAULT_TRANSLATIONS.bodyScan, ...nested.bodyScan },
      colorScan: { ...DEFAULT_TRANSLATIONS.colorScan, ...nested.colorScan },
      quiz: { ...DEFAULT_TRANSLATIONS.quiz, ...nested.quiz },
      onboarding: {
        ...DEFAULT_TRANSLATIONS.onboarding,
        ...nested.onboarding,
        steps: { ...DEFAULT_TRANSLATIONS.onboarding.steps, ...nested.onboarding?.steps },
      },
      styleArchetypes: { ...DEFAULT_TRANSLATIONS.styleArchetypes, ...nested.styleArchetypes },
      styleSelection: {
        ...DEFAULT_TRANSLATIONS.styleSelection,
        ...nested.styleSelection,
        styles: {
          ...DEFAULT_TRANSLATIONS.styleSelection.styles,
          ...nested.styleSelection?.styles,
        },
      },
      settings: { ...DEFAULT_TRANSLATIONS.settings, ...nested.settings },
      home: { ...DEFAULT_TRANSLATIONS.home, ...nested.home },
      auth: { ...DEFAULT_TRANSLATIONS.auth, ...nested.auth },
      aiStylist: { ...DEFAULT_TRANSLATIONS.aiStylist, ...nested.aiStylist },
    };

    for (const key of Object.keys(nested)) {
      if (!(key in core) && nested[key] && typeof nested[key] === 'object') {
        core[key] = { ...(DEFAULT_TRANSLATIONS as any)[key], ...nested[key] };
      }
    }

    for (const key of Object.keys(DEFAULT_TRANSLATIONS)) {
      if (!(key in core) && (DEFAULT_TRANSLATIONS as any)[key]) {
        core[key] = { ...(DEFAULT_TRANSLATIONS as any)[key], ...(nested[key] || {}) };
      }
    }

    return core as Translations;
  }`.split('\n');
  lines.splice(mergeStart, setLangStart - mergeStart, ...newMerge, '');
}

fs.writeFileSync(SERVICE, lines.join('\n'));
console.log('Patched TranslationService.ts —', lines.length, 'lines');
console.log('  welcome in DEFAULT:', lines.some((l) => l.includes('welcome: {')));
console.log('  welcome.tagline in es:', lines.some((l) => l.includes("'welcome.tagline'")));
console.log('  dynamic merge:', lines.some((l) => l.includes('const core:')));
