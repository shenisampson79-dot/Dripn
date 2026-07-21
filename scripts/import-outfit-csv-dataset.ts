/**
 * Import flat outfit CSV → unified JSON schema (+ optional live re-score validation).
 *
 * Run:
 *   npx tsx scripts/import-outfit-csv-dataset.ts
 *   npx tsx scripts/import-outfit-csv-dataset.ts --csv=C:\Users\sheni\Downloads\outfit_dataset_3000_realistic.csv
 *   npx tsx scripts/import-outfit-csv-dataset.ts --validate --sample=200
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  computeUnifiedOutfitScore,
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
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='));
  return {
    csv: csvArg?.split('=')[1]
      ?? resolve(process.cwd(), 'data/outfit_dataset_3000_realistic.csv'),
    out: outArg?.split('=')[1]
      ?? resolve(process.cwd(), 'data/outfitUnifiedDataset3000.json'),
    validate: process.argv.includes('--validate'),
    sample: sampleArg ? Number(sampleArg.split('=')[1]) : 150,
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
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
    {
      ...base,
      id: `${row.outfit_id}-top`,
      name: capitalize(row.top),
      category: 'tops',
      color: row.top_color,
    },
    {
      ...base,
      id: `${row.outfit_id}-bottom`,
      name: capitalize(row.bottom),
      category: 'bottoms',
      color: row.bottom_color,
    },
    {
      ...base,
      id: `${row.outfit_id}-shoes`,
      name: capitalize(row.shoes),
      category: 'shoes',
      color: row.shoe_color,
    },
  ];
}

/** Preserve CSV sub-scores but normalize to unified record shape. */
function csvRowToUnifiedRecord(row: CsvRow): UnifiedOutfitRecord {
  return {
    outfit_id: row.outfit_id,
    items: [
      { type: 'top', name: capitalize(row.top), color: row.top_color },
      { type: 'bottom', name: capitalize(row.bottom), color: row.bottom_color },
      { type: 'shoes', name: capitalize(row.shoes), color: row.shoe_color },
    ],
    style: {
      primary_style: null,
      style_consistency: row.STYLE_SCORE,
      formality_match: row.STYLE_SCORE,
      occasion_fit: row.STYLE_SCORE,
      STYLE_SCORE: row.STYLE_SCORE,
    },
    color: {
      palette: [row.top_color, row.bottom_color, row.shoe_color],
      harmony_type: 'mixed_harmonious',
      contrast_score: row.COLOR_SCORE,
      clash_penalty: Math.max(0, 1 - row.COLOR_SCORE),
      seasonal_match: null,
      COLOR_SCORE: row.COLOR_SCORE,
    },
    fit: {
      top_fit: row.top_fit,
      bottom_fit: row.bottom_fit,
      silhouette: 'mixed',
      proportion_score: row.FIT_SCORE,
      silhouette_balance: row.FIT_SCORE,
      fit_quality: row.FIT_SCORE,
      FIT_SCORE: row.FIT_SCORE,
    },
    final_score: row.final_score,
    label: row.label,
    feedback: [],
  };
}

function labelCounts(records: UnifiedOutfitRecord[]) {
  return {
    good: records.filter((r) => r.label === 'good').length,
    average: records.filter((r) => r.label === 'average').length,
    bad: records.filter((r) => r.label === 'bad').length,
  };
}

function main() {
  const { csv, out, validate, sample } = parseArgs();

  if (!existsSync(csv)) {
    console.error(`CSV not found: ${csv}`);
    process.exit(1);
  }

  const projectCsv = resolve(process.cwd(), 'data/outfit_dataset_3000_realistic.csv');
  if (csv !== projectCsv && !existsSync(projectCsv)) {
    copyFileSync(csv, projectCsv);
    console.log(`Copied → ${projectCsv}`);
  }

  const rows = parseCsv(readFileSync(csv, 'utf8'));
  const records = rows.map(csvRowToUnifiedRecord);

  const payload = {
    schema: 'outfitUnifiedDataset.schema.json',
    source: 'outfit_dataset_3000_realistic.csv',
    weights: { style: 0.4, color: 0.3, fit: 0.3 },
    imported_at: new Date().toISOString(),
    count: records.length,
    label_counts: labelCounts(records),
    outfits: records,
  };

  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`Imported ${records.length} outfits → ${out}`);
  console.log(`Labels: good=${payload.label_counts.good} average=${payload.label_counts.average} bad=${payload.label_counts.bad}`);

  if (validate) {
    const slice = rows.slice(0, Math.min(sample, rows.length));
    let labelMatch = 0;
    let scoreDeltaSum = 0;

    for (const row of slice) {
      const live = computeUnifiedOutfitScore(csvRowToItems(row), { outfitId: row.outfit_id });
      if (live.record.label === row.label) labelMatch++;
      scoreDeltaSum += Math.abs(live.record.final_score - row.final_score);
    }

    const labelPct = Math.round((labelMatch / slice.length) * 100);
    const meanDelta = (scoreDeltaSum / slice.length).toFixed(3);
    console.log(`Live validation (n=${slice.length}): label agreement ${labelPct}%, mean |Δscore| ${meanDelta}`);
  }
}

main();
