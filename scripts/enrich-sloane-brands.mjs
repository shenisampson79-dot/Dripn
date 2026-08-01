#!/usr/bin/env node
/**
 * Enrich Sloane dataset rows with brand / price_tier / style_tags.
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/enrich-sloane-brands.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const datasetPath = path.join(root, 'data', 'sloane_street_dataset', 'dataset.json');

/** Longer names first so "loro piana" wins over partials. */
const BRAND_PATTERNS = [
  [/loro\s*piana/i, 'loro_piana', 'ultra_luxury'],
  [/veronica\s*beard/i, 'veronica_beard', 'contemporary_luxury'],
  [/love\s*shack\s*fancy|loveshackfancy/i, 'loveshackfancy', 'contemporary_luxury'],
  [/white\s*company/i, 'white_company', 'premium'],
  [/anine\s*bing/i, 'anine_bing', 'contemporary_luxury'],
  [/brunello\s*cucinelli/i, 'brunello_cucinelli', 'ultra_luxury'],
  [/ralph\s*lauren/i, 'ralph_lauren', 'luxury'],
  [/varley/i, 'varley', 'premium'],
  [/sandro/i, 'sandro', 'contemporary_luxury'],
  [/brora/i, 'brora', 'premium'],
  [/moscot/i, 'moscot', 'premium'],
  [/rixo/i, 'rixo', 'contemporary_luxury'],
  [/paige/i, 'paige', 'premium'],
  [/liberty/i, 'liberty', 'luxury'],
  [/k-?way/i, 'k_way', 'premium'],
  [/docksides/i, 'docksides', 'premium'],
  [/zegna/i, 'zegna', 'ultra_luxury'],
];

function detectBrand(notes = '') {
  for (const [re, brand, tier] of BRAND_PATTERNS) {
    if (re.test(notes)) return { brand, price_tier: tier };
  }
  return { brand: null, price_tier: 'luxury' };
}

function styleTags(row) {
  const tags = new Set();
  const primary = String(row.style?.primary || '');
  const contrast = String(row.features?.contrast || '');
  const sil = String(row.features?.silhouette || '');
  const brand = String(row.brand || '');

  if (contrast === 'low') tags.add('quiet luxury');
  if (/tailored/.test(sil)) tags.add('tailored');
  if (/relaxed/.test(sil)) tags.add('relaxed');
  if (primary === 'smart_casual') tags.add('smart casual');
  if (primary === 'resort') tags.add('resort');
  if (primary === 'business_formal' || primary === 'business_casual') tags.add('tailored');
  if (primary === 'casual') tags.add('casual');
  if (/loro_piana|zegna|brunello/.test(brand)) {
    tags.add('quiet luxury');
    tags.add('minimal');
  }
  if (brand === 'varley') tags.add('athleisure');
  return [...tags];
}

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

for (const row of dataset) {
  const detected = detectBrand(row.notes || '');
  row.brand = detected.brand;
  row.price_tier = detected.price_tier;
  row.style_tags = styleTags(row);
}

fs.writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
const withBrand = dataset.filter((r) => r.brand).length;
console.log(`Enriched ${datasetPath}`);
console.log(`rows=${dataset.length} with_brand=${withBrand}`);
