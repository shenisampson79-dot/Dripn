#!/usr/bin/env node
/**
 * Builds scripts/spanish-data.json — full Spanish coverage for all i18n keys.
 */
const fs = require('fs');
const path = require('path');
const { extractExistingSpanish } = require('./translation-utils');
const { translateUI } = require('./spanish-overrides');

const EN_FLAT = path.join(__dirname, 'en-flat.json');
const OUT = path.join(__dirname, 'spanish-data.json');

// Priority section Spanish (welcome, help — see build-spanish-data-priority.js exports)
const PRIORITY = require('./spanish-priority');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  if (!fs.existsSync(EN_FLAT)) {
    console.error('Missing en-flat.json — run: node scripts/generate-translations.js');
    process.exit(1);
  }

  // Generate legal Spanish if needed
  if (!fs.existsSync(path.join(__dirname, 'legal-spanish-map.json'))) {
    require('./gen-legal-es');
  }

  const enFlat = loadJson(EN_FLAT);
  const legalEs = loadJson(path.join(__dirname, 'legal-spanish-map.json'));
  const existingEs = extractExistingSpanish();
  const es = {};
  let stats = { priority: 0, legal: 0, existing: 0, ui: 0 };

  for (const [key, en] of Object.entries(enFlat)) {
    if (PRIORITY[key]) {
      es[key] = PRIORITY[key];
      stats.priority++;
    } else if (legalEs[key]) {
      es[key] = legalEs[key];
      stats.legal++;
    } else if (existingEs[key]) {
      es[key] = existingEs[key];
      stats.existing++;
    } else {
      es[key] = translateUI(key, en);
      stats.ui++;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(es, null, 2) + '\n');
  console.log(`spanish-data.json: ${Object.keys(es).length} keys`);
  console.log(`  priority=${stats.priority} legal=${stats.legal} existing=${stats.existing} ui=${stats.ui}`);
}

main();
