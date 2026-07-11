#!/usr/bin/env node
/**
 * Re-translate NEW_AND_FIXED keys that are still English in locale files.
 */
const fs = require('fs');
const path = require('path');
const { translateViaGoogle, sleep } = require('./locale-translator');
const { NEW_AND_FIXED } = (() => {
  // Re-read from merge script by evaluating the object from en-flat for our prefixes
  const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'en-flat.json'), 'utf8'));
  const prefixes = [
    'navTitles.', 'coldOpen.', 'discover.', 'blog.', 'surpriseMe.', 'weeklyPlanner.',
    'cancelFlow.', 'secondOpinion.', 'voiceComment.', 'shoppable.', 'settings.newsletter',
    'common.pleaseTryAgainRuby',
  ];
  const keys = Object.keys(en).filter((k) => prefixes.some((p) => k.startsWith(p) || k.includes(p.replace(/\.$/, ''))));
  // Also include exact truncated fixes
  const force = [
    'coldOpen.egNothingFeelsRightImBoredOfMyClothes',
    'coldOpen.egNothingFeelsRightI',
    'common.pleaseTryAgainRubyDidntGetYourMessage',
    'common.pleaseTryAgainRubyDidn',
  ];
  const set = new Set([...keys, ...force]);
  const out = {};
  for (const k of set) if (en[k]) out[k] = en[k];
  return { NEW_AND_FIXED: out };
})();

const LOCALES_DIR = path.join(__dirname, '../locales');
const LANGS = [
  'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'sv', 'da', 'no', 'fi',
];

async function mapConcurrent(items, fn, limit = 5) {
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
  const onlyLang = (process.argv.find((a) => a.startsWith('--lang=')) || '').split('=')[1];
  const langs = onlyLang ? [onlyLang] : LANGS;

  for (const lang of langs) {
    const outPath = path.join(LOCALES_DIR, `${lang}.json`);
    const locale = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const stale = Object.keys(NEW_AND_FIXED).filter((k) => {
      const cur = locale[k];
      const en = NEW_AND_FIXED[k];
      return !cur || cur === en;
    });
    if (!stale.length) {
      console.log(`${lang}: ok`);
      continue;
    }
    console.log(`${lang}: re-translating ${stale.length} English leftovers…`);
    const entries = await mapConcurrent(stale, async (key) => {
      try {
        await sleep(40);
        return [key, await translateViaGoogle(NEW_AND_FIXED[key], lang)];
      } catch (err) {
        console.warn(`  ${lang} ${key}: ${err.message}`);
        return [key, NEW_AND_FIXED[key]];
      }
    });
    for (const [k, v] of entries) locale[k] = v;
    const sorted = Object.fromEntries(Object.entries(locale).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`${lang}: done`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
