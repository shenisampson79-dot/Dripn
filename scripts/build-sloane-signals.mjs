#!/usr/bin/env node
/**
 * Build Sloane Street soft-scoring signals from dataset.json.
 *
 * Usage: npm run build:sloane-signals
 * Reads:  data/sloane_street_dataset/dataset.json
 * Writes: data/sloane_street_dataset/signals.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const datasetPath = path.join(root, 'data', 'sloane_street_dataset', 'dataset.json');
const outPath = path.join(root, 'data', 'sloane_street_dataset', 'signals.json');

const STYLE_BUCKETS = ['smart_casual', 'business_casual', 'resort', 'casual'];

function canonColor(c) {
  const x = String(c || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  const map = {
    gray: 'grey',
    charcoal: 'grey',
    off_white: 'cream',
    ivory: 'cream',
    pale_yellow: 'yellow',
    light_blue: 'blue',
    taupe: 'beige',
    tan: 'beige',
    terracotta: 'brown',
    rust: 'brown',
    mauve: 'pink',
    olive: 'green',
    coral: 'coral',
    gold: 'beige',
    multicolour: 'multicolor',
  };
  return map[x] || x;
}

function pairKey(a, b) {
  const A = canonColor(a);
  const B = canonColor(b);
  if (!A || !B || A === B) return null;
  return A < B ? `${A}+${B}` : `${B}+${A}`;
}

function inc(map, key, n = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + n;
}

function topN(map, n) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

function boostFromRank(rank, maxBoost, minBoost = 3) {
  // rank 0 → maxBoost, last → minBoost
  const span = Math.max(1, 14);
  const t = rank / span;
  return Math.round(maxBoost - t * (maxBoost - minBoost));
}

function styleBucket(primary) {
  const p = String(primary || '').toLowerCase();
  if (p === 'business_casual' || p === 'business_formal') return 'business_casual';
  if (p === 'smart_casual') return 'smart_casual';
  if (p === 'resort') return 'resort';
  if (p === 'casual' || p === 'evening') return p === 'evening' ? 'smart_casual' : 'casual';
  return 'casual';
}

const raw = fs.readFileSync(datasetPath, 'utf8');
const dataset = JSON.parse(raw);
if (!Array.isArray(dataset) || dataset.length !== 42) {
  console.error(`Expected 42 outfits, got ${Array.isArray(dataset) ? dataset.length : typeof dataset}`);
  process.exit(1);
}

const colourFreq = {};
const pairingFreq = {};
const footwearByStyle = Object.fromEntries(STYLE_BUCKETS.map((s) => [s, {}]));
const layeringFreq = {};
const silhouetteFreq = {};
const footwearAll = {};
/** brand → colour combo freq */
const brandColourFreq = {};
/** brand → pairing freq */
const brandPairingFreq = {};
/** brand → silhouette freq */
const brandSilhouetteFreq = {};
/** style bucket → footwear preferred */
const luxuryFootwearPreferred = Object.fromEntries(STYLE_BUCKETS.map((s) => [s, {}]));
const styleTagFreq = {};
const lowContrastNeutralFreq = {};
let validCount = 0;
const LUXURY_NEUTRALS = new Set(['cream', 'beige', 'white', 'taupe', 'grey', 'brown', 'navy', 'black']);

for (const row of dataset) {
  const valid = row?.rules?.valid !== false;
  if (!valid) continue;
  validCount += 1;

  const brand = row.brand || 'sloane_street';
  if (!brandColourFreq[brand]) brandColourFreq[brand] = {};
  if (!brandPairingFreq[brand]) brandPairingFreq[brand] = {};
  if (!brandSilhouetteFreq[brand]) brandSilhouetteFreq[brand] = {};

  const palette = Array.isArray(row.colour_palette) ? row.colour_palette.map(canonColor) : [];
  const uniq = [...new Set(palette.filter(Boolean))];
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      const key = pairKey(uniq[i], uniq[j]);
      inc(colourFreq, key);
      inc(brandColourFreq[brand], key);
    }
  }

  // Quiet-luxury neutral stacks (all palette colours in luxury neutrals, ≥2)
  if (uniq.length >= 2 && uniq.every((c) => LUXURY_NEUTRALS.has(c))) {
    const sorted = [...uniq].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        inc(lowContrastNeutralFreq, pairKey(sorted[i], sorted[j]));
      }
    }
  }

  const topCat = row.outfit?.top?.category || null;
  const bottomCat = row.outfit?.bottom?.category || null;
  // Skip dress-only rows — not a separable top×bottom pairing signal
  if (topCat && bottomCat && topCat !== 'dress') {
    const pairing = `${topCat}×${bottomCat}`;
    inc(pairingFreq, pairing);
    inc(brandPairingFreq[brand], pairing);
  }

  const fw = row.outfit?.footwear?.subcategory || null;
  if (fw) {
    inc(footwearAll, fw);
    const bucket = styleBucket(row.style?.primary);
    inc(footwearByStyle[bucket], fw);
    inc(luxuryFootwearPreferred[bucket], fw);
  }

  const sil = row.features?.silhouette || 'unknown';
  inc(layeringFreq, row.features?.layering || 'none');
  inc(silhouetteFreq, sil);
  inc(brandSilhouetteFreq[brand], sil);

  for (const tag of Array.isArray(row.style_tags) ? row.style_tags : []) {
    inc(styleTagFreq, String(tag).toLowerCase());
  }
}

const colour_combos = topN(colourFreq, 15).map(([combo, frequency], i) => ({
  combo,
  frequency,
  score_boost: Math.max(3, Math.min(8, boostFromRank(i, 8, 3))),
}));

const garment_pairings = topN(pairingFreq, 20).map(([pairing, frequency], i) => ({
  pairing,
  frequency,
  score_boost: Math.max(2, Math.min(6, boostFromRank(i, 6, 2))),
}));

const footwear_by_style = {};
for (const style of STYLE_BUCKETS) {
  footwear_by_style[style] = topN(footwearByStyle[style], 8).map(([subcategory, frequency], i) => ({
    subcategory,
    frequency,
    score_boost: Math.max(2, Math.min(6, 6 - i)),
  }));
}

const layering_patterns = topN(layeringFreq, 10).map(([pattern, frequency]) => ({
  pattern,
  frequency,
}));

const silhouette_counts = topN(silhouetteFreq, 10).map(([silhouette, frequency]) => ({
  silhouette,
  frequency,
}));

const topColours = colour_combos
  .slice(0, 5)
  .map((c) => `${c.combo} (${c.frequency})`)
  .join(', ');
const topFw = topN(footwearAll, 5)
  .map(([k, v]) => `${k}×${v}`)
  .join(', ');
const topPairs = garment_pairings
  .slice(0, 5)
  .map((p) => `${p.pairing} (${p.frequency})`)
  .join(', ');

const excluded = dataset.filter((row) => row?.rules?.valid === false);
const excludedReasons = excluded
  .flatMap((row) => (Array.isArray(row?.rules?.violations) ? row.rules.violations : []))
  .filter(Boolean);
const excludedLabel =
  excluded.length === 0
    ? 'none excluded'
    : `${excluded.length} excluded (${[...new Set(excludedReasons)].join(', ') || 'invalid'})`;

const insights = [
  `Sloane Street sample: ${validCount}/42 valid wearable looks (${excludedLabel}).`,
  `Top colour combos: ${topColours || 'n/a'}.`,
  `Top garment pairings: ${topPairs || 'n/a'}.`,
  `Footwear leaders: ${topFw || 'n/a'} — loafers dominate smart_casual; sneakers/espadrilles lean casual/resort.`,
  `Layering is mostly none/light with occasional structured blazer looks; silhouettes skew tailored + relaxed.`,
].join(' ');

const brand_colour_systems = Object.entries(brandColourFreq)
  .map(([brand, freq]) => ({
    brand,
    top_colours: topN(freq, 5).map(([combo, frequency]) => ({ combo, frequency })),
  }))
  .filter((b) => b.top_colours.length > 0)
  .sort((a, b) => b.top_colours[0].frequency - a.top_colours[0].frequency || a.brand.localeCompare(b.brand));

const brand_pairings = [];
for (const [brand, freq] of Object.entries(brandPairingFreq)) {
  for (const [pair, frequency] of topN(freq, 3)) {
    brand_pairings.push({ pair, frequency, brand_bias: brand });
  }
}
brand_pairings.sort((a, b) => b.frequency - a.frequency || a.pair.localeCompare(b.pair));

const brand_silhouettes = Object.entries(brandSilhouetteFreq)
  .map(([brand, freq]) => {
    const top = topN(freq, 1)[0];
    return top ? { brand, silhouette: top[0], frequency: top[1] } : null;
  })
  .filter(Boolean);

const quiet_luxury_palettes = topN(lowContrastNeutralFreq, 12).map(([combo, frequency], i) => ({
  combo,
  frequency,
  score_boost: Math.max(3, Math.min(6, boostFromRank(i, 6, 3))),
}));

const footwear_rules = STYLE_BUCKETS.map((context) => {
  const preferred = topN(luxuryFootwearPreferred[context], 4).map(([subcategory]) => subcategory);
  const avoided =
    context === 'smart_casual' || context === 'business_casual'
      ? ['chunky_boots', 'rugged_boots', 'combat_boots', 'sneakers']
      : context === 'resort'
        ? ['chunky_boots', 'oxfords']
        : ['heels'];
  return { context, preferred, avoided: avoided.filter((a) => !preferred.includes(a)) };
});

const luxury = {
  brand_colour_systems,
  brand_pairings: brand_pairings.slice(0, 20),
  brand_silhouettes,
  quiet_luxury_palettes,
  footwear_rules,
  style_tags: topN(styleTagFreq, 12).map(([tag, frequency]) => ({ tag, frequency })),
};

const signals = {
  version: 2,
  source: 'sloane_street',
  generated_at: new Date().toISOString(),
  sample_size: dataset.length,
  valid_count: validCount,
  colour_combos,
  garment_pairings,
  footwear_by_style,
  layering_patterns,
  silhouette_counts,
  footwear_overall: topN(footwearAll, 12).map(([subcategory, frequency]) => ({
    subcategory,
    frequency,
  })),
  luxury,
  insights,
};

fs.writeFileSync(outPath, `${JSON.stringify(signals, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(
  `valid=${validCount} colour_combos=${colour_combos.length} pairings=${garment_pairings.length} brands=${brand_colour_systems.length}`,
);
console.log(insights);
