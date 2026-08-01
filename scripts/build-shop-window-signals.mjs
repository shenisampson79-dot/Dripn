#!/usr/bin/env node
/**
 * Build combined shop-window soft-scoring signals from Sloane + Croydon + Brixton.
 *
 * Usage: npm run build:shop-window-signals
 * Reads:
 *   data/sloane_street_dataset/dataset.json
 *   data/croydon_mall_dataset/dataset.json
 *   data/brixton_high_street_dataset/dataset.json
 *   data/oxford_street_dataset/dataset.json
 * Writes:
 *   data/sloane_street_dataset/signals.json  (combined + lanes)
 *   data/sloane_street_dataset/signals.luxury.json
 *   data/croydon_mall_dataset/signals.json
 *   data/brixton_high_street_dataset/signals.json
 *   data/oxford_street_dataset/signals.json
 *   data/shop_window_corpus/signals.casual.json  (Croydon + Brixton + Oxford casual lane)
 *   data/shop_window_corpus/insights.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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
    burnt_orange: 'orange',
    mauve: 'pink',
    olive: 'green',
    sage_green: 'green',
    mint_green: 'green',
    coral: 'coral',
    gold: 'beige',
    silver: 'grey',
    gum: 'beige',
    khaki: 'beige',
    maroon: 'red',
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
  const span = Math.max(1, 14);
  const t = rank / span;
  return Math.round(maxBoost - t * (maxBoost - minBoost));
}

function styleBucket(primary) {
  const p = String(primary || '').toLowerCase();
  if (p === 'business_casual' || p === 'business_formal') return 'business_casual';
  if (p === 'smart_casual') return 'smart_casual';
  if (p === 'resort') return 'resort';
  if (p === 'athleisure' || p === 'casual' || p === 'evening') {
    return p === 'evening' ? 'smart_casual' : 'casual';
  }
  return 'casual';
}

function loadDataset(rel) {
  const p = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`Expected array in ${rel}`);
  return data;
}

function mine(dataset) {
  const colourFreq = {};
  const pairingFreq = {};
  const footwearByStyle = Object.fromEntries(STYLE_BUCKETS.map((s) => [s, {}]));
  const layeringFreq = {};
  const silhouetteFreq = {};
  const footwearAll = {};
  const brandColourFreq = {};
  const brandPairingFreq = {};
  const brandSilhouetteFreq = {};
  const luxuryFootwearPreferred = Object.fromEntries(STYLE_BUCKETS.map((s) => [s, {}]));
  const styleTagFreq = {};
  const lowContrastNeutralFreq = {};
  const LUXURY_NEUTRALS = new Set(['cream', 'beige', 'white', 'taupe', 'grey', 'brown', 'navy', 'black']);
  let validCount = 0;

  for (const row of dataset) {
    if (row?.rules?.valid === false) continue;
    validCount += 1;
    const brand = row.brand || row.source || 'unknown';
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
    if (topCat && bottomCat && topCat !== 'dress') {
      const pairing = `${topCat}×${bottomCat}`;
      inc(pairingFreq, pairing);
      inc(brandPairingFreq[brand], pairing);
    }

    const fw = row.outfit?.footwear?.subcategory || null;
    if (fw) {
      const fwKey = String(fw).toLowerCase().replace(/\s+/g, '_');
      const canonFw = /clog|mule/.test(fwKey)
        ? 'mules'
        : /sneaker|trainer/.test(fwKey)
          ? 'sneakers'
          : /sandal/.test(fwKey)
            ? 'sandals'
            : /oxford/.test(fwKey)
              ? 'oxfords'
              : /loafer/.test(fwKey)
                ? 'loafers'
                : /heel/.test(fwKey)
                  ? 'heels'
                  : fwKey;
      inc(footwearAll, canonFw);
      const bucket = styleBucket(row.style?.primary);
      inc(footwearByStyle[bucket], canonFw);
      inc(luxuryFootwearPreferred[bucket], canonFw);
    }

    const sil = row.features?.silhouette || 'unknown';
    inc(layeringFreq, row.features?.layering || 'none');
    inc(silhouetteFreq, sil);
    inc(brandSilhouetteFreq[brand], sil);
    for (const tag of Array.isArray(row.style_tags) ? row.style_tags : []) {
      inc(styleTagFreq, String(tag).toLowerCase());
    }
  }

  return {
    validCount,
    colourFreq,
    pairingFreq,
    footwearByStyle,
    layeringFreq,
    silhouetteFreq,
    footwearAll,
    brandColourFreq,
    brandPairingFreq,
    brandSilhouetteFreq,
    luxuryFootwearPreferred,
    styleTagFreq,
    lowContrastNeutralFreq,
  };
}

function buildSignals(mined, meta) {
  const colour_combos = topN(mined.colourFreq, 15).map(([combo, frequency], i) => ({
    combo,
    frequency,
    score_boost: Math.max(3, Math.min(8, boostFromRank(i, 8, 3))),
  }));
  const garment_pairings = topN(mined.pairingFreq, 20).map(([pairing, frequency], i) => ({
    pairing,
    frequency,
    score_boost: Math.max(2, Math.min(6, boostFromRank(i, 6, 2))),
  }));
  const footwear_by_style = {};
  for (const style of STYLE_BUCKETS) {
    footwear_by_style[style] = topN(mined.footwearByStyle[style], 8).map(([subcategory, frequency], i) => ({
      subcategory,
      frequency,
      score_boost: Math.max(2, Math.min(6, 6 - i)),
    }));
  }
  const layering_patterns = topN(mined.layeringFreq, 10).map(([pattern, frequency]) => ({
    pattern,
    frequency,
  }));
  const silhouette_counts = topN(mined.silhouetteFreq, 10).map(([silhouette, frequency]) => ({
    silhouette,
    frequency,
  }));

  const brand_colour_systems = Object.entries(mined.brandColourFreq)
    .map(([brand, freq]) => ({
      brand,
      top_colours: topN(freq, 5).map(([combo, frequency]) => ({ combo, frequency })),
    }))
    .filter((b) => b.top_colours.length > 0)
    .sort((a, b) => b.top_colours[0].frequency - a.top_colours[0].frequency || a.brand.localeCompare(b.brand));

  const brand_pairings = [];
  for (const [brand, freq] of Object.entries(mined.brandPairingFreq)) {
    for (const [pair, frequency] of topN(freq, 3)) {
      brand_pairings.push({ pair, frequency, brand_bias: brand });
    }
  }
  brand_pairings.sort((a, b) => b.frequency - a.frequency || a.pair.localeCompare(b.pair));

  const brand_silhouettes = Object.entries(mined.brandSilhouetteFreq)
    .map(([brand, freq]) => {
      const top = topN(freq, 1)[0];
      return top ? { brand, silhouette: top[0], frequency: top[1] } : null;
    })
    .filter(Boolean);

  const quiet_luxury_palettes = topN(mined.lowContrastNeutralFreq, 12).map(([combo, frequency], i) => ({
    combo,
    frequency,
    score_boost: Math.max(3, Math.min(6, boostFromRank(i, 6, 3))),
  }));

  const footwear_rules = STYLE_BUCKETS.map((context) => {
    const preferred = topN(mined.luxuryFootwearPreferred[context], 4).map(([subcategory]) => subcategory);
    const avoided =
      context === 'smart_casual' || context === 'business_casual'
        ? ['chunky_boots', 'rugged_boots', 'combat_boots']
        : context === 'casual'
          ? ['oxfords', 'heels']
          : context === 'resort'
            ? ['chunky_boots', 'oxfords']
            : ['heels'];
    return { context, preferred, avoided: avoided.filter((a) => !preferred.includes(a)) };
  });

  const topColours = colour_combos
    .slice(0, 5)
    .map((c) => `${c.combo} (${c.frequency})`)
    .join(', ');
  const topFw = topN(mined.footwearAll, 5)
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
  const topPairs = garment_pairings
    .slice(0, 5)
    .map((p) => `${p.pairing} (${p.frequency})`)
    .join(', ');

  const insights = [
    `${meta.label}: ${mined.validCount}/${meta.sampleSize} valid wearable looks.`,
    `Top colour combos: ${topColours || 'n/a'}.`,
    `Top garment pairings: ${topPairs || 'n/a'}.`,
    `Footwear leaders: ${topFw || 'n/a'}.`,
    `Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.`,
  ].join(' ');

  return {
    version: 4,
    source: meta.source,
    generated_at: new Date().toISOString(),
    sample_size: meta.sampleSize,
    valid_count: mined.validCount,
    colour_combos,
    garment_pairings,
    footwear_by_style,
    layering_patterns,
    silhouette_counts,
    footwear_overall: topN(mined.footwearAll, 12).map(([subcategory, frequency]) => ({
      subcategory,
      frequency,
    })),
    luxury: {
      brand_colour_systems,
      brand_pairings: brand_pairings.slice(0, 24),
      brand_silhouettes,
      quiet_luxury_palettes,
      footwear_rules,
      style_tags: topN(mined.styleTagFreq, 12).map(([tag, frequency]) => ({ tag, frequency })),
    },
    insights,
  };
}

/** Compact lane tables for dual-style scoring (luxury vs casual). */
function laneTables(mined) {
  return {
    colour_combos: topN(mined.colourFreq, 15).map(([combo, frequency], i) => ({
      combo,
      frequency,
      score_boost: Math.max(3, Math.min(8, boostFromRank(i, 8, 3))),
    })),
    garment_pairings: topN(mined.pairingFreq, 20).map(([pairing, frequency], i) => ({
      pairing,
      frequency,
      score_boost: Math.max(2, Math.min(6, boostFromRank(i, 6, 2))),
    })),
    footwear_by_style: Object.fromEntries(
      STYLE_BUCKETS.map((style) => [
        style,
        topN(mined.footwearByStyle[style], 8).map(([subcategory, frequency], i) => ({
          subcategory,
          frequency,
          score_boost: Math.max(2, Math.min(6, 6 - i)),
        })),
      ]),
    ),
  };
}

const sloane = loadDataset('data/sloane_street_dataset/dataset.json');
const croydon = loadDataset('data/croydon_mall_dataset/dataset.json');
const brixton = loadDataset('data/brixton_high_street_dataset/dataset.json');
const oxfordPath = path.join(root, 'data', 'oxford_street_dataset', 'dataset.json');
const oxford = fs.existsSync(oxfordPath) ? loadDataset('data/oxford_street_dataset/dataset.json') : [];
const casualCorpus = [...croydon, ...brixton, ...oxford];
const combined = [...sloane, ...casualCorpus];

const luxurySignals = buildSignals(mine(sloane), {
  label: 'Sloane Street (luxury lane)',
  source: 'sloane_street',
  sampleSize: sloane.length,
});
const croydonSignals = buildSignals(mine(croydon), {
  label: 'Croydon mall',
  source: 'croydon_mall',
  sampleSize: croydon.length,
});
const brixtonSignals = buildSignals(mine(brixton), {
  label: 'Brixton High Street (JD / H&M / Morleys)',
  source: 'brixton_high_street',
  sampleSize: brixton.length,
});
const oxfordSignals = buildSignals(mine(oxford), {
  label: 'Oxford Street',
  source: 'oxford_street',
  sampleSize: oxford.length,
});
const casualSignals = buildSignals(mine(casualCorpus), {
  label: 'Casual lane (Croydon + Brixton + Oxford)',
  source: 'croydon_mall+brixton_high_street+oxford_street',
  sampleSize: casualCorpus.length,
});
const sloaneMined = mine(sloane);
const casualMined = mine(casualCorpus);
const combinedSignals = {
  ...buildSignals(mine(combined), {
    label: 'Shop-window corpus (Sloane + Croydon + Brixton + Oxford)',
    source: 'sloane_street+croydon_mall+brixton_high_street+oxford_street',
    sampleSize: combined.length,
  }),
  lanes: {
    luxury: { source: 'sloane_street', ...laneTables(sloaneMined) },
    casual: {
      source: 'croydon_mall+brixton_high_street+oxford_street',
      ...laneTables(casualMined),
    },
  },
};

const corpusDir = path.join(root, 'data', 'shop_window_corpus');
fs.mkdirSync(corpusDir, { recursive: true });
fs.mkdirSync(path.join(root, 'data', 'brixton_high_street_dataset'), { recursive: true });

fs.writeFileSync(
  path.join(root, 'data', 'croydon_mall_dataset', 'signals.json'),
  `${JSON.stringify(croydonSignals, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(root, 'data', 'brixton_high_street_dataset', 'signals.json'),
  `${JSON.stringify(brixtonSignals, null, 2)}\n`,
);
if (oxford.length) {
  fs.mkdirSync(path.join(root, 'data', 'oxford_street_dataset'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'data', 'oxford_street_dataset', 'signals.json'),
    `${JSON.stringify(oxfordSignals, null, 2)}\n`,
  );
}
fs.writeFileSync(
  path.join(corpusDir, 'signals.casual.json'),
  `${JSON.stringify(casualSignals, null, 2)}\n`,
);
// Luxury-only lane for context-weighted dual-style scoring
fs.writeFileSync(
  path.join(root, 'data', 'sloane_street_dataset', 'signals.luxury.json'),
  `${JSON.stringify(luxurySignals, null, 2)}\n`,
);
// Combined kept for insights / legacy imports — dual-style scoring prefers lane files
fs.writeFileSync(
  path.join(root, 'data', 'sloane_street_dataset', 'signals.json'),
  `${JSON.stringify(combinedSignals, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(corpusDir, 'signals.json'),
  `${JSON.stringify(combinedSignals, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(corpusDir, 'dual_style_weights.json'),
  `${JSON.stringify({
    version: 1,
    note: 'Context weights for dual-style scoring — never flatten luxury+casual into one boost',
    contexts: {
      work: { luxury: 1.0, casual: 0.2 },
      business: { luxury: 1.0, casual: 0.15 },
      smart_casual: { luxury: 0.7, casual: 0.5 },
      elevated_casual: { luxury: 0.55, casual: 0.75 },
      weekend: { luxury: 0.4, casual: 1.0 },
      casual: { luxury: 0.35, casual: 1.0 },
      resort: { luxury: 0.5, casual: 0.8 },
    },
  }, null, 2)}\n`,
);

const insightsMd = `# Shop-window corpus insights

Generated: ${combinedSignals.generated_at}

## Corpus
- Sloane Street: ${sloane.length} rows (${sloane.filter((r) => r?.rules?.valid !== false).length} valid)
- Croydon mall: ${croydon.length} rows (${croydon.filter((r) => r?.rules?.valid !== false).length} valid)
- Brixton High Street: ${brixton.length} rows (${brixton.filter((r) => r?.rules?.valid !== false).length} valid)
- Oxford Street: ${oxford.length} rows (${oxford.filter((r) => r?.rules?.valid !== false).length} valid)
- Combined valid: ${combinedSignals.valid_count}

## Dual-style lanes (preferred for scoring)
- Luxury lane: \`sloane_street_dataset/signals.luxury.json\`
- Casual lane: \`shop_window_corpus/signals.casual.json\` (Croydon + Brixton + Oxford)
- Context weights: \`shop_window_corpus/dual_style_weights.json\`

**Do not** flatten both lanes into one unconditional boost (sneakers common ≠ boost sneakers for work).

## Luxury-only patterns
${luxurySignals.insights}

## Croydon-only patterns
${croydonSignals.insights}

## Brixton-only patterns
${brixtonSignals.insights}

## Oxford Street patterns
${oxfordSignals.insights}

## Casual lane (Croydon + Brixton + Oxford)
${casualSignals.insights}

## Combined patterns (insights only)
${combinedSignals.insights}

## How this feeds the app
Soft boosts only via \`utils/dualStyleSignals.ts\` (colour / pairing / footwear × context weights).
Hard clash + dress-code rules still win.
Rebuild: \`npm run build:shop-window-signals\`
`;

fs.writeFileSync(path.join(corpusDir, 'insights.md'), insightsMd);
console.log(luxurySignals.insights);
console.log('--- Croydon ---');
console.log(croydonSignals.insights);
console.log('--- Brixton ---');
console.log(brixtonSignals.insights);
console.log('--- Oxford ---');
console.log(oxfordSignals.insights);
console.log('--- Casual lane ---');
console.log(casualSignals.insights);
console.log('Wrote luxury + casual (+ Brixton + Oxford) + combined signals');
