/**
 * Generate unified outfit training dataset (style + color + fit sub-scores).
 *
 * Run:
 *   npx tsx scripts/generate-unified-outfit-dataset.ts
 *   npx tsx scripts/generate-unified-outfit-dataset.ts --count=500 --csv
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import { STYLE_TAG_DATASET } from '../utils/outfitStyleTagMatcher';
import {
  computeUnifiedOutfitScore,
  unifiedRecordToFeatures,
  type UnifiedOutfitRecord,
} from '../utils/outfitUnifiedScore';

const COLORS = [
  'black', 'white', 'gray', 'navy', 'beige', 'cream', 'brown', 'denim', 'olive',
  'burgundy', 'rust', 'tan', 'charcoal', 'red', 'orange', 'purple', 'multicolor',
];

function parseArgs() {
  const countArg = process.argv.find((a) => a.startsWith('--count='));
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const csv = process.argv.includes('--csv');
  return {
    count: countArg ? Number(countArg.split('=')[1]) : 120,
    out: outArg ? outArg.split('=')[1] : 'data/outfitUnifiedDataset.json',
    csv,
  };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function entriesForCategory(category: string) {
  return STYLE_TAG_DATASET.entries.filter(
    (entry) => !entry.categories?.length || entry.categories.includes(category),
  );
}

function itemFromEntry(entryId: string, category: string, color: string): WardrobeItem {
  const entry = STYLE_TAG_DATASET.entries.find((e) => e.id === entryId);
  const keyword = entry?.keywords[0] ?? entryId.replace(/_/g, ' ');
  const name = keyword.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    id: `${entryId}-${Math.random().toString(36).slice(2, 7)}`,
    userId: 'gen',
    name,
    category,
    color,
    imageUri: '',
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
  };
}

function randomItem(category: string, color: string): WardrobeItem {
  const pool = entriesForCategory(category);
  return itemFromEntry(pick(pool).id, category, color);
}

function randomOutfit(includeOuter = false): WardrobeItem[] {
  const items = [
    randomItem('tops', pick(COLORS)),
    randomItem('bottoms', pick(COLORS)),
    randomItem('shoes', pick(COLORS)),
  ];
  if (includeOuter && Math.random() > 0.4) {
    items.push(randomItem('outerwear', pick(COLORS)));
  }
  return items;
}

/** Curated anchor outfits — diverse good / bad / edge cases. */
const CURATED: WardrobeItem[][] = [
  [
    { id: 'c1', userId: 's', name: 'White Oxford Shirt', category: 'tops', color: 'white', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c2', userId: 's', name: 'Navy Chinos', category: 'bottoms', color: 'navy', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c3', userId: 's', name: 'Brown Loafers', category: 'shoes', color: 'brown', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
  ],
  [
    { id: 'c4', userId: 's', name: 'Grey Hoodie', category: 'tops', color: 'gray', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c5', userId: 's', name: 'Grey Sweatpants', category: 'bottoms', color: 'gray', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c6', userId: 's', name: 'Black Leather Chelsea Boots', category: 'shoes', color: 'black', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
  ],
  [
    { id: 'c7', userId: 's', name: 'Neon Green Hoodie', category: 'tops', color: 'multicolor', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c8', userId: 's', name: 'Red Shorts', category: 'bottoms', color: 'red', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c9', userId: 's', name: 'Purple Sneakers', category: 'shoes', color: 'purple', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
  ],
  [
    { id: 'c10', userId: 's', name: 'Navy Blazer', category: 'outerwear', color: 'navy', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c11', userId: 's', name: 'Grey Hoodie', category: 'tops', color: 'gray', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c12', userId: 's', name: 'Blue Slim Jeans', category: 'bottoms', color: 'denim', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
    { id: 'c13', userId: 's', name: 'White High Top Sneakers', category: 'shoes', color: 'white', imageUri: '', seasons: [], occasions: [], timesWorn: 0, isFavorite: false, createdAt: '', updatedAt: '' },
  ],
];

export function generateUnifiedDataset(count = 120): UnifiedOutfitRecord[] {
  const records: UnifiedOutfitRecord[] = [];
  let id = 1;

  for (const outfit of CURATED) {
    records.push(
      computeUnifiedOutfitScore(outfit, { outfitId: `O${String(id++).padStart(3, '0')}` }).record,
    );
  }

  while (records.length < count) {
    const outfit = randomOutfit(Math.random() > 0.5);
    records.push(
      computeUnifiedOutfitScore(outfit, { outfitId: `O${String(id++).padStart(3, '0')}` }).record,
    );
  }

  return records;
}

function recordsToCsv(records: UnifiedOutfitRecord[]): string {
  const rows = records.map(unifiedRecordToFeatures);
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
  ];
  return lines.join('\n');
}

function main() {
  const { count, out, csv } = parseArgs();
  const records = generateUnifiedDataset(count);
  const outPath = resolve(process.cwd(), out);

  const payload = {
    schema: 'outfitUnifiedDataset.schema.json',
    weights: { style: 0.4, color: 0.3, fit: 0.3 },
    generated_at: new Date().toISOString(),
    count: records.length,
    label_counts: {
      good: records.filter((r) => r.label === 'good').length,
      average: records.filter((r) => r.label === 'average').length,
      bad: records.filter((r) => r.label === 'bad').length,
    },
    outfits: records,
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${records.length} outfits → ${outPath}`);
  console.log(`Labels: good=${payload.label_counts.good} average=${payload.label_counts.average} bad=${payload.label_counts.bad}`);

  if (csv) {
    const csvPath = outPath.replace(/\.json$/i, '.csv');
    writeFileSync(csvPath, recordsToCsv(records));
    console.log(`Wrote CSV → ${csvPath}`);
  }
}

main();
