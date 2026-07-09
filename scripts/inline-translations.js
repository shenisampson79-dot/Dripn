#!/usr/bin/env node
/**
 * Inlines en-flat.json / es-flat.json into services/TranslationService.ts
 * - Merges extended English sections into DEFAULT_TRANSLATIONS
 * - Replaces LOCAL_TRANSLATIONS.es with full flat Spanish map
 */
const fs = require('fs');
const path = require('path');
const { flatToNested } = require('./translation-utils');

const EN_FLAT = path.join(__dirname, 'en-flat.json');
const ES_FLAT = path.join(__dirname, 'es-flat.json');
const SERVICE = path.join(__dirname, '../services/TranslationService.ts');

const CORE_SECTIONS = new Set([
  'locale', 'localeInfo', 'common', 'nav', 'stylist', 'wardrobe', 'profile',
  'stylistHub', 'bodyScan', 'colorScan', 'quiz', 'onboarding', 'styleArchetypes',
  'styleSelection', 'settings', 'home', 'auth', 'aiStylist',
]);

function formatFlatObject(flat, indent = '    ') {
  const entries = Object.entries(flat).sort(([a], [b]) => a.localeCompare(b));
  const lines = entries.map(([k, v]) => {
    const escaped = v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `${indent}'${k}': '${escaped}',`;
  });
  return lines.join('\n');
}

function buildExtendedNested(enFlat) {
  const extended = {};
  for (const [key, value] of Object.entries(enFlat)) {
    const section = key.split('.')[0];
    if (CORE_SECTIONS.has(section)) continue;
    extended[key] = value;
  }
  return flatToNested(extended);
}

function formatNestedObject(obj, indent = '  ', depth = 0) {
  const pad = indent.repeat(depth + 1);
  const close = indent.repeat(depth);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `'${key}'`;
      lines.push(`${pad}${safeKey}: '${escaped}',`);
    } else if (value && typeof value === 'object') {
      const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `'${key}'`;
      lines.push(`${pad}${safeKey}: {`);
      lines.push(formatNestedObject(value, indent, depth + 1));
      lines.push(`${pad}},`);
    }
  }
  return lines.join('\n');
}

function main() {
  const enFlat = JSON.parse(fs.readFileSync(EN_FLAT, 'utf8'));
  const esFlat = JSON.parse(fs.readFileSync(ES_FLAT, 'utf8'));
  let ts = fs.readFileSync(SERVICE, 'utf8');

  const extendedNested = buildExtendedNested(enFlat);
  const extendedBlock = formatNestedObject(extendedNested, '  ', 0);

  // 1. Update Translations interface with index signature
  if (!ts.includes('[key: string]: any')) {
    ts = ts.replace(
      /export interface Translations \{([\s\S]*?)  aiStylist: AIStylistTranslations;\n\}/,
      `export interface Translations {$1  aiStylist: AIStylistTranslations;\n  [key: string]: any;\n}`
    );
  }

  // 2. Add extended sections to DEFAULT_TRANSLATIONS (before closing };)
  const defaultEndMarker = '\n};\n\nconst LOCAL_TRANSLATIONS';
  if (!ts.includes('welcome:')) {
    ts = ts.replace(
      defaultEndMarker,
      `,\n  // Extended sections from en-flat.json\n${extendedBlock}\n};\n\nconst LOCAL_TRANSLATIONS`
    );
  } else {
    // Replace existing extended block
    ts = ts.replace(
      /,?\n  \/\/ Extended sections from en-flat\.json[\s\S]*?\n\};\n\nconst LOCAL_TRANSLATIONS/,
      `,\n  // Extended sections from en-flat.json\n${extendedBlock}\n};\n\nconst LOCAL_TRANSLATIONS`
    );
  }

  // 3. Replace LOCAL_TRANSLATIONS es block
  const esBlock = formatFlatObject(esFlat);
  ts = ts.replace(
    /const LOCAL_TRANSLATIONS: Record<string, Record<string, string>> = \{[\s\S]*?\n\};\n\nclass TranslationServiceClass/,
    `export const UI_FULL_COVERAGE_LANGUAGES = ['en', 'es'] as const;\n\nconst LOCAL_TRANSLATIONS: Record<string, Record<string, string>> = {\n  es: {\n${esBlock}\n  },\n  fr: {\n    'common.continue': 'Continuer', 'common.skip': 'Passer', 'common.save': 'Sauvegarder',\n    'common.cancel': 'Annuler', 'common.back': 'Retour', 'common.next': 'Suivant',\n    'common.done': 'Terminé', 'common.loading': 'Chargement...', 'common.error': 'Erreur', 'common.retry': 'Réessayer',\n    'nav.home': 'Accueil', 'nav.wardrobe': 'Garde-robe', 'nav.chat': 'Chat', 'nav.profile': 'Profil', 'nav.settings': 'Paramètres',\n    'stylist.greeting': "Bonjour! Comment puis-je vous aider aujourd'hui?", 'stylist.thinking': 'Je réfléchis...',\n    'stylist.askMe': "Posez-moi n'importe quelle question sur la mode...",\n    'settings.language': 'Langue', 'settings.voiceAndLanguage': 'Voix et langue', 'settings.subscription': 'Abonnement', 'settings.logout': 'Déconnexion',\n  },\n  de: {\n    'common.continue': 'Weiter', 'common.skip': 'Überspringen', 'common.save': 'Speichern',\n    'common.cancel': 'Abbrechen', 'common.back': 'Zurück', 'common.next': 'Weiter', 'common.done': 'Fertig',\n    'nav.home': 'Startseite', 'nav.wardrobe': 'Kleiderschrank', 'nav.chat': 'Chat', 'nav.profile': 'Profil', 'nav.settings': 'Einstellungen',\n    'settings.language': 'Sprache', 'settings.subscription': 'Abonnement', 'settings.logout': 'Abmelden',\n  },\n};\n\nclass TranslationServiceClass`
  );

  // 4. Update mergeTranslations to spread unknown sections
  const mergeFn = `  private mergeTranslations(backendTranslations: Record<string, any>, langCode: string): Translations {
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
        direction: 'ltr' as const,
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

    // Merge any extended top-level sections not in core
    for (const key of Object.keys(nested)) {
      if (!(key in core) && nested[key] && typeof nested[key] === 'object') {
        core[key] = { ...(DEFAULT_TRANSLATIONS as any)[key], ...nested[key] };
      }
    }

    // Also merge extended sections from DEFAULT_TRANSLATIONS
    for (const key of Object.keys(DEFAULT_TRANSLATIONS)) {
      if (!(key in core) && (DEFAULT_TRANSLATIONS as any)[key]) {
        core[key] = { ...(DEFAULT_TRANSLATIONS as any)[key], ...(nested[key] || {}) };
      }
    }

    return core as Translations;
  }`;

  ts = ts.replace(
    /  private mergeTranslations\(backendTranslations: Record<string, any>, langCode: string\): Translations \{[\s\S]*?    \};\n  \}/,
    mergeFn
  );

  fs.writeFileSync(SERVICE, ts);
  console.log(`Updated ${SERVICE}`);
  console.log(`  Extended sections: ${Object.keys(extendedNested).join(', ')}`);
  console.log(`  Spanish keys inlined: ${Object.keys(esFlat).length}`);
}

main();
