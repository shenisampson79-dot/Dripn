#!/usr/bin/env node
/** Re-translate keys that fell back to English due to API errors */
const fs = require('fs');
const path = require('path');
const { translateViaGoogle, sleep } = require('./locale-translator');

const EN = JSON.parse(fs.readFileSync(path.join(__dirname, 'en-flat.json'), 'utf8'));
const LOCALES = path.join(__dirname, '../locales');

const FIXES = [
  ['de', ['terms.section04.sub02.body2']],
  ['ja', [
    'privacy.section10.title',
    'privacy.section07.bullet3',
    'privacy.section08.title',
    'privacy.section13.sub01.title',
    'privacy.section12.emailSupport',
    'privacy.section11.title',
    'privacy.section13.sub02.title',
    'privacy.section13.title',
  ]],
];

async function main() {
  for (const [lang, keys] of FIXES) {
    const file = path.join(LOCALES, `${lang}.json`);
    const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const key of keys) {
      const en = EN[key];
      if (!en) continue;
      bundle[key] = await translateViaGoogle(en, lang);
      console.log(`  ${lang} ${key}: ${bundle[key].slice(0, 60)}…`);
      await sleep(200);
    }
    fs.writeFileSync(file, JSON.stringify(bundle, null, 2) + '\n');
  }
  console.log('Fixed fallback keys.');
}

main().catch((e) => { console.error(e); process.exit(1); });
