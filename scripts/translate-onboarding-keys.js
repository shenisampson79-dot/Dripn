#!/usr/bin/env node
/**
 * Translate only onboarding/entry/decide-for-me keys that still equal English.
 * Usage: node scripts/translate-onboarding-keys.js
 */
const fs = require('fs');
const path = require('path');
const { translateViaGoogle, sleep } = require('./locale-translator');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');

const PREFIXES = [
  'onboardingEntry.',
  'trustOnboarding.',
  'onboardingProfile.',
  'preSignupQuiz.',
  'decideForMe.',
];

const SUPPORTED = [
  'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'sv', 'da', 'no', 'fi',
];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + '\n');
}

async function mapConcurrent(items, fn, limit = 6) {
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

async function main() {
  const enFlat = loadJson(EN_FLAT);
  const keys = Object.keys(enFlat).filter((k) => PREFIXES.some((p) => k.startsWith(p)));
  console.log(`Translating ${keys.length} onboarding keys for ${SUPPORTED.length} langs…`);

  for (const lang of SUPPORTED) {
    const p = path.join(LOCALES_DIR, `${lang}.json`);
    const data = loadJson(p);
    const todo = keys.filter((k) => !data[k] || data[k] === enFlat[k]);
    if (todo.length === 0) {
      console.log(`  ${lang}: skip`);
      continue;
    }
    console.log(`  ${lang}: ${todo.length} keys…`);
    const translated = await mapConcurrent(todo, async (key) => {
      try {
        await sleep(40);
        return [key, await translateViaGoogle(enFlat[key], lang)];
      } catch (err) {
        console.warn(`  ${lang} ${key}: ${err.message}`);
        return [key, enFlat[key]];
      }
    });
    for (const [k, v] of translated) data[k] = v;
    saveJson(p, data);
  }
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
