#!/usr/bin/env node
/**
 * Merge alert-i18n-new-keys.js into en-flat.json, locales/*, and i18n-keys.txt
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const KEYS_FILE = path.join(__dirname, 'i18n-keys.txt');
const LOCALES_DIR = path.join(ROOT, 'locales');
const NEW_KEYS = require('./alert-i18n-new-keys');

const enFlat = JSON.parse(fs.readFileSync(EN_FLAT, 'utf8'));
let upserted = 0;
for (const [key, value] of Object.entries(NEW_KEYS)) {
  if (enFlat[key] !== value) {
    enFlat[key] = value;
    upserted++;
  }
}
fs.writeFileSync(EN_FLAT, JSON.stringify(enFlat, null, 2) + '\n');
console.log(`en-flat.json: upserted ${upserted} (total ${Object.keys(enFlat).length})`);

const existingKeys = fs.existsSync(KEYS_FILE)
  ? fs.readFileSync(KEYS_FILE, 'utf8').trim().split('\n').filter(Boolean)
  : [];
const keySet = new Set([...existingKeys, ...Object.keys(NEW_KEYS), ...Object.keys(enFlat)]);
const sorted = [...keySet].sort();
fs.writeFileSync(KEYS_FILE, sorted.join('\n') + '\n');
console.log(`i18n-keys.txt: ${sorted.length} keys`);

for (const file of fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))) {
  const p = path.join(LOCALES_DIR, file);
  const locale = JSON.parse(fs.readFileSync(p, 'utf8'));
  let missing = 0;
  for (const [key, value] of Object.entries(NEW_KEYS)) {
    if (!locale[key]) {
      locale[key] = value;
      missing++;
    }
  }
  // Keep en.json in sync with en-flat
  if (file === 'en.json') {
    for (const [key, value] of Object.entries(enFlat)) {
      locale[key] = value;
    }
  }
  fs.writeFileSync(p, JSON.stringify(locale, null, 2) + '\n');
  console.log(`  ${file}: added ${missing} (total ${Object.keys(locale).length})`);
}
console.log('Done. Run retranslate for interim English keys.');
