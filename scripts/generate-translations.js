#!/usr/bin/env node
/**
 * Generates scripts/en-flat.json and scripts/es-flat.json from i18n-keys.txt
 * English: git HEAD originals > source fallbacks > DEFAULT_TRANSLATIONS > humanized
 * Spanish: existing LOCAL_TRANSLATIONS.es > spanish-overrides > quality UI translation
 */

const fs = require('fs');
const path = require('path');
const {
  extractFallbacksFromSource,
  flattenDefaults,
  extractExistingSpanish,
  humanizeKey,
} = require('./translation-utils');

const ROOT = path.resolve(__dirname, '..');
const KEYS_FILE = path.join(__dirname, 'i18n-keys.txt');
const EN_OUT = path.join(__dirname, 'en-flat.json');
const ES_OUT = path.join(__dirname, 'es-flat.json');
const GIT_EN = path.join(__dirname, 'git-english-map.json');

// Load Spanish overrides (section-organized real translations)
const { SPANISH_OVERRIDES, translateUI } = require('./spanish-overrides');
const subEn = require('./subscription-translations').EN;

function loadJsonIfExists(file) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  return {};
}

function buildEnglish(keys) {
  const gitEnglish = loadJsonIfExists(GIT_EN);
  const legalEnglish = loadJsonIfExists(path.join(__dirname, 'legal-english-map.json'));
  const fallbacks = extractFallbacksFromSource();
  const defaults = flattenDefaults();
  const en = {};

  for (const key of keys) {
    en[key] =
      subEn[key] ||
      legalEnglish[key] ||
      gitEnglish[key] ||
      fallbacks[key] ||
      defaults[key] ||
      humanizeKey(key);
  }
  return en;
}

function buildSpanish(keys, enFlat) {
  const spanishData = loadJsonIfExists(path.join(__dirname, 'spanish-data.json'));
  if (Object.keys(spanishData).length === keys.length) {
    return spanishData;
  }

  const existingEs = extractExistingSpanish();
  const es = {};
  for (const key of keys) {
    const english = enFlat[key];
    es[key] =
      spanishData[key] ||
      SPANISH_OVERRIDES[key] ||
      existingEs[key] ||
      translateUI(key, english);
  }
  return es;
}

function main() {
  // Ensure source maps are fresh
  require('./extract-git-english');
  require('./parse-legal-head');

  const keys = fs.readFileSync(KEYS_FILE, 'utf8').trim().split('\n').filter(Boolean);
  const enFlat = buildEnglish(keys);
  fs.writeFileSync(EN_OUT, JSON.stringify(enFlat, null, 2) + '\n');

  // Build comprehensive Spanish data (reads en-flat.json)
  require('./gen-legal-es');
  require('./build-spanish-data');

  const esFlat = loadJsonIfExists(path.join(__dirname, 'spanish-data.json'));

  fs.writeFileSync(ES_OUT, JSON.stringify(esFlat, null, 2) + '\n');

  const enFromGit = keys.filter((k) => loadJsonIfExists(GIT_EN)[k]).length;
  const esFromOverrides = keys.filter((k) => SPANISH_OVERRIDES[k]).length;
  const esFromExisting = keys.filter((k) => extractExistingSpanish()[k]).length;

  console.log(`Generated ${keys.length} keys`);
  console.log(`  en-flat.json → ${EN_OUT}`);
  console.log(`  es-flat.json → ${ES_OUT}`);
  console.log(`English sources: git=${enFromGit}, fallbacks=${keys.filter((k) => extractFallbacksFromSource()[k]).length}`);
  console.log(`Spanish sources: overrides=${esFromOverrides}, existing=${esFromExisting}`);
}

main();
