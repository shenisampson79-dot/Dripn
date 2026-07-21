/**
 * Re-score imported CSV with live unified engine + season / occasion / brand context.
 *
 * Run:
 *   npx tsx scripts/rescore-outfit-dataset.ts
 *   npx tsx scripts/rescore-outfit-dataset.ts --csv=data/outfit_dataset_3000_realistic.csv
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  applyBrandTiersToItems,
  enrichOutfitContext,
} from '../utils/outfitContextEnrichment';
import {
  computeUnifiedOutfitScore,
  unifiedRecordToFeatures,
  type OutfitQualityLabel,
  type UnifiedOutfitRecord,
} from '../utils/outfitUnifiedScore';

type CsvRow = {
  outfit_id: string;
  top: string;
  bottom: string;
  shoes: string;
  top_color: string;
  bottom_color: string;
  shoe_color: string;
  top_fit: string;
  bottom_fit: string;
  shoe_fit: string;
  style_category: string;
  STYLE_SCORE: number;
  COLOR_SCORE: number;
  FIT_SCORE: number;
  final_score: number;
  label: OutfitQualityLabel;
};

function parseArgs() {
  const csvArg = process.argv.find((a) => a.startsWith('--csv='));
  return {
    csv: csvArg?.split('=')[1]
      ?? resolve(process.cwd(), 'data/outfit_dataset_3000_realistic.csv'),
    jsonOut: resolve(process.cwd(), 'data/outfitUnifiedDataset3000_rescored.json'),
    csvOut: resolve(process.cwd(), 'data/outfitUnifiedDataset3000_rescored.csv'),
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx]; });
    rows.push({
      outfit_id: row.outfit_id,
      top: row.top,
      bottom: row.bottom,
      shoes: row.shoes,
      top_color: row.top_color,
      bottom_color: row.bottom_color,
      shoe_color: row.shoe_color,
      top_fit: row.top_fit,
      bottom_fit: row.bottom_fit,
      shoe_fit: row.shoe_fit,
      style_category: row.style_category,
      STYLE_SCORE: Number(row.STYLE_SCORE),
      COLOR_SCORE: Number(row.COLOR_SCORE),
      FIT_SCORE: Number(row.FIT_SCORE),
      final_score: Number(row.final_score),
      label: row.label as OutfitQualityLabel,
    });
  }
  return rows;
}

function capitalize(s: string): string {
  return s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function csvRowToItems(row: CsvRow): WardrobeItem[] {
  const base = {
    userId: 'csv',
    imageUri: '',
    seasons: ['all-season'] as const,
    occasions: ['everyday'] as const,
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
  };
  return [
    { ...base, id: `${row.outfit_id}-top`, name: capitalize(row.top), category: 'tops', color: row.top_color },
    { ...base, id: `${row.outfit_id}-bottom`, name: capitalize(row.bottom), category: 'bottoms', color: row.bottom_color },
    { ...base, id: `${row.outfit_id}-shoes`, name: capitalize(row.shoes), category: 'shoes', color: row.shoe_color },
  ];
}

function rescoreRow(row: CsvRow): UnifiedOutfitRecord {
  const rawItems = csvRowToItems(row);
  const context = enrichOutfitContext(rawItems, row.style_category, row.outfit_id);
  const items = applyBrandTiersToItems(rawItems, context.brand_tiers);

  const result = computeUnifiedOutfitScore(items, {
    outfitId: row.outfit_id,
    context,
    occasion: context.occasion,
    userSeason: context.season,
    sourceLabel: row.label,
  });

  return result.record;
}

function labelCounts(records: UnifiedOutfitRecord[]) {
  return {
    good: records.filter((r) => r.label === 'good').length,
    average: records.filter((r) => r.label === 'average').length,
    bad: records.filter((r) => r.label === 'bad').length,
  };
}

function recordsToCsv(records: UnifiedOutfitRecord[]): string {
  const rows = records.map(unifiedRecordToFeatures);
  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n');
}

function main() {
  const { csv, jsonOut, csvOut } = parseArgs();
  if (!existsSync(csv)) {
    console.error(`CSV not found: ${csv}`);
    process.exit(1);
  }

  const sourceRows = parseCsv(readFileSync(csv, 'utf8'));
  console.log(`Re-scoring ${sourceRows.length} outfits with live engine…`);

  const records: UnifiedOutfitRecord[] = [];
  let sourceLabelMatch = 0;

  for (let i = 0; i < sourceRows.length; i++) {
    const row = sourceRows[i];
    const record = rescoreRow(row);
    records.push(record);
    if (record.label === row.label) sourceLabelMatch++;
    if ((i + 1) % 500 === 0) console.log(`  ${i + 1}/${sourceRows.length}`);
  }

  const occasionCounts: Record<string, number> = {};
  const seasonCounts: Record<string, number> = {};
  for (const r of records) {
    occasionCounts[r.context.occasion] = (occasionCounts[r.context.occasion] ?? 0) + 1;
    seasonCounts[r.context.season] = (seasonCounts[r.context.season] ?? 0) + 1;
  }

  const payload = {
    schema: 'outfitUnifiedDataset.schema.json',
    source: 'outfit_dataset_3000_realistic.csv',
    rescored: true,
    engine: 'computeUnifiedOutfitScore',
    weights: { style: 0.4, color: 0.3, fit: 0.3 },
    rescored_at: new Date().toISOString(),
    count: records.length,
    label_counts: labelCounts(records),
    source_label_agreement_pct: Math.round((sourceLabelMatch / records.length) * 100),
    occasion_distribution: occasionCounts,
    season_distribution: seasonCounts,
    outfits: records,
  };

  writeFileSync(jsonOut, JSON.stringify(payload, null, 2));
  writeFileSync(csvOut, recordsToCsv(records));

  console.log(`\nWrote JSON → ${jsonOut}`);
  console.log(`Wrote CSV  → ${csvOut}`);
  console.log(`Labels: good=${payload.label_counts.good} average=${payload.label_counts.average} bad=${payload.label_counts.bad}`);
  console.log(`Source CSV label agreement: ${payload.source_label_agreement_pct}%`);
  console.log('Occasions:', occasionCounts);
  console.log('Seasons:', seasonCounts);
}

main();
