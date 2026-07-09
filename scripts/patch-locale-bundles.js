#!/usr/bin/env node
/** Replaces inline LOCAL_TRANSLATIONS with locale JSON imports */
const fs = require('fs');
const path = require('path');

const SERVICE = path.join(__dirname, '../services/TranslationService.ts');
let lines = fs.readFileSync(SERVICE, 'utf8').split(/\r?\n/);

if (!lines.some((l) => l.includes("from './localeBundles'"))) {
  const apiIdx = lines.findIndex((l) => l.includes("from './ApiService'"));
  if (apiIdx < 0) throw new Error('ApiService import not found');
  lines.splice(apiIdx + 1, 0, "import { LOCAL_TRANSLATION_BUNDLES, UI_FULL_COVERAGE_LANGUAGES } from './localeBundles';");
}

const localStart = lines.findIndex((l) => l.startsWith('const LOCAL_TRANSLATIONS'));
if (localStart < 0) throw new Error('LOCAL_TRANSLATIONS block not found');

let localEnd = -1;
for (let i = localStart + 1; i < lines.length; i++) {
  if (lines[i] === '};' && lines[i + 1] === '' && lines[i + 2]?.startsWith('class TranslationServiceClass')) {
    localEnd = i;
    break;
  }
}
if (localEnd < 0) throw new Error('LOCAL_TRANSLATIONS closing not found');

// Remove any existing UI_FULL_COVERAGE export above LOCAL_TRANSLATIONS
let insertAt = localStart;
if (lines[localStart - 1] === '' && lines[localStart - 2]?.includes('UI_FULL_COVERAGE_LANGUAGES')) {
  insertAt = localStart - 2;
}

const replacement = [
  'export { UI_FULL_COVERAGE_LANGUAGES };',
  '',
  'const LOCAL_TRANSLATIONS = LOCAL_TRANSLATION_BUNDLES;',
  '',
];

lines.splice(insertAt, localEnd - insertAt + 1, ...replacement);
fs.writeFileSync(SERVICE, lines.join('\n'));

console.log(`Patched TranslationService.ts — ${lines.length} lines`);
console.log('  localeBundles import:', lines.some((l) => l.includes("from './localeBundles'")));
console.log('  inline es removed:', !lines.some((l) => l.trim() === 'es: {'));
