#!/usr/bin/env node
/**
 * Re-translate keys that contain {placeholders}, with placeholder protection.
 * Also force-restores English placeholder names if any remain mangled.
 */
const fs = require('fs');
const path = require('path');
const { translateViaGoogle, sleep } = require('./locale-translator');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');
const CONCURRENCY = 5;

const enFlat = JSON.parse(fs.readFileSync(EN_FLAT, 'utf8'));
const alertKeys = Object.keys(require('./alert-i18n-new-keys'));
const phKeys = [...new Set([
  ...alertKeys,
  ...Object.keys(enFlat),
])].filter((k) => /\{[a-zA-Z0-9_]+\}/.test(enFlat[k] || ''));

function placeholdersMatch(en, loc) {
  const enPh = [...(en.matchAll(/\{[a-zA-Z0-9_]+\}/g))].map((m) => m[0]).sort().join(',');
  const locPh = [...(String(loc || '').matchAll(/\{[^}]+\}/g))].map((m) => m[0]).sort().join(',');
  return enPh === locPh;
}

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

async function main() {
  const langs = fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .filter((l) => l !== 'en');

  console.log(`Placeholder keys to check: ${phKeys.length}`);

  for (const lang of langs) {
    const outPath = path.join(LOCALES_DIR, `${lang}.json`);
    const locale = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const toFix = phKeys.filter((k) => !placeholdersMatch(enFlat[k], locale[k]));
    console.log(`${lang}: ${toFix.length} mangled placeholder keys`);
    if (toFix.length === 0) continue;

    const entries = await mapConcurrent(toFix, async (key) => {
      const english = enFlat[key];
      try {
        await sleep(40);
        const translated = await translateViaGoogle(english, lang);
        if (!placeholdersMatch(english, translated)) {
          // Fallback: keep English if placeholders still broken
          console.warn(`  ${lang} ${key}: placeholders still broken, keeping EN`);
          return [key, english];
        }
        return [key, translated];
      } catch (err) {
        console.warn(`  ${lang} ${key}: ${err.message}`);
        return [key, english];
      }
    });

    for (const [key, value] of entries) {
      locale[key] = value;
    }
    fs.writeFileSync(outPath, JSON.stringify(locale, null, 2) + '\n');
    console.log(`  ${lang}: fixed ${entries.length}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
