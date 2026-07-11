#!/usr/bin/env node
/**
 * Generates locales/*.json for all SUPPORTED_LANGUAGES (except en).
 * Spanish uses spanish-priority overrides + API fill; other langs use Google translate.
 *
 * Usage: node scripts/generate-all-locales.js [--force] [--lang=fr]
 */
const fs = require('fs');
const path = require('path');
const { translateViaGoogle, sleep } = require('./locale-translator');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');

const SUPPORTED = [
  'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'sv', 'da', 'no', 'fi',
];

const EN_FIXES = {
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
};

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadOverrides(lang) {
  if (lang === 'es') {
    try {
      return require('./spanish-priority');
    } catch {
      return {};
    }
  }
  const overridePath = path.join(__dirname, `overrides-${lang}.json`);
  if (fs.existsSync(overridePath)) {
    return loadJson(overridePath);
  }
  return {};
}

const CONCURRENCY = 8;

async function mapConcurrent(items, fn, limit = CONCURRENCY) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function translateLocale(lang, enFlat, overrides, { force = false } = {}) {
  const outPath = path.join(LOCALES_DIR, `${lang}.json`);
  const existing = (!force && fs.existsSync(outPath)) ? loadJson(outPath) : {};

  const keys = Object.keys(enFlat);
  const missing = keys.filter((key) => force || !existing[key] || existing[key] === '');
  if (missing.length === 0 && Object.keys(existing).length >= keys.length) {
    console.log(`  ${lang}: skip (complete ${Object.keys(existing).length} keys)`);
    return existing;
  }

  console.log(`  ${lang}: translating ${missing.length} missing/updated keys…`);
  const translatedEntries = await mapConcurrent(missing, async (key) => {
    if (overrides[key]) {
      return [key, overrides[key]];
    }
    const english = enFlat[key];
    if (!english || !english.trim() || /^[\d.,\s$€£¥%+\-]+$/.test(english)) {
      return [key, english];
    }
    try {
      await sleep(40);
      const translated = await translateViaGoogle(english, lang);
      return [key, translated];
    } catch (err) {
      console.warn(`  ${lang} ${key}: ${err.message}`);
      return [key, english];
    }
  });

  const result = { ...existing };
  for (const [key, value] of translatedEntries) {
    result[key] = value;
  }
  // Drop keys removed from en-flat only when force regenerating
  if (force) {
    for (const key of Object.keys(result)) {
      if (!(key in enFlat)) delete result[key];
    }
  }
  // Ensure every en-flat key exists
  for (const key of keys) {
    if (!(key in result)) result[key] = enFlat[key];
  }

  console.log(`  ${lang}: ${Object.keys(result).length} keys written`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const langArg = args.find((a) => a.startsWith('--lang='));
  const onlyLang = langArg ? langArg.split('=')[1] : null;

  if (!fs.existsSync(EN_FLAT)) {
    console.error('Missing en-flat.json — run: node scripts/generate-translations.js');
    process.exit(1);
  }

  // Fix known bad English extractions
  const enFlat = { ...loadJson(EN_FLAT), ...EN_FIXES };
  fs.writeFileSync(EN_FLAT, JSON.stringify(enFlat, null, 2) + '\n');

  if (!fs.existsSync(LOCALES_DIR)) {
    fs.mkdirSync(LOCALES_DIR, { recursive: true });
  }

  const langs = onlyLang ? [onlyLang] : SUPPORTED;
  console.log(`Generating ${langs.length} locale(s) from ${Object.keys(enFlat).length} keys…`);

  // Process languages sequentially (each lang parallelizes keys internally)
  for (const lang of langs) {
    const overrides = loadOverrides(lang);
    await translateLocale(lang, enFlat, overrides, { force });
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
