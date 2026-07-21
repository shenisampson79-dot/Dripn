/**
 * Semi-synthetic outfit calibration generator.
 * Uses the live scorer + style tag dataset to label random combinations.
 *
 * Run: npx tsx scripts/generate-outfit-calibration-dataset.ts [--count=500] [--out=data/outfits_generated.json]
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { computeLocalOutfitScore } from '../utils/outfitCompatibilityScore';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import { STYLE_TAG_DATASET } from '../utils/outfitStyleTagMatcher';

type GeneratedExample = {
  items: Array<{ name: string; category: string; color: string }>;
  label: 'good' | 'bad';
  score: number;
  primaryStyle: string | null;
  clashId?: string;
  issues: string[];
};

const COLORS = ['black', 'white', 'gray', 'navy', 'beige', 'cream', 'brown', 'denim', 'olive'];

const CATEGORY_MAP: Record<string, string> = {
  tops: 'tops',
  bottoms: 'bottoms',
  outerwear: 'outerwear',
  shoes: 'shoes',
  activewear_tops: 'activewear_tops',
  activewear_bottoms: 'activewear_bottoms',
};

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
  const entry = pick(pool);
  return itemFromEntry(entry.id, category, color);
}

function randomOutfit(includeOuter = false): WardrobeItem[] {
  const color = pick(COLORS);
  const accent = pick(COLORS);
  const items = [
    randomItem('tops', color),
    randomItem('bottoms', accent),
    randomItem('shoes', pick(COLORS)),
  ];
  if (includeOuter && Math.random() > 0.45) {
    items.push(randomItem('outerwear', pick(COLORS)));
  }
  return items;
}

function labelFromScore(scored: ReturnType<typeof computeLocalOutfitScore>): GeneratedExample['label'] {
  if (scored.hardCap != null || scored.score <= 45) return 'bad';
  if (scored.score >= 65) return 'good';
  return scored.score >= 52 ? 'good' : 'bad';
}

function issuesFromScore(scored: ReturnType<typeof computeLocalOutfitScore>): string[] {
  const issues: string[] = [];
  if (scored.clashId) issues.push(scored.clashId);
  if (scored.aesthetic?.aestheticConflict) issues.push('style_conflict');
  if (scored.aesthetic?.footwearBreaksIntent) issues.push('footwear_mismatch');
  if (scored.aesthetic?.unclearIdentity) issues.push('unclear_identity');
  if (scored.colorHarmony?.issues.length) issues.push(...scored.colorHarmony.issues);
  if (scored.silhouette?.issues.length) issues.push(...scored.silhouette.issues);
  return [...new Set(issues)];
}

export function generateDataset(count = 500): GeneratedExample[] {
  const data: GeneratedExample[] = [];
  for (let i = 0; i < count; i++) {
    const items = randomOutfit(Math.random() > 0.5);
    const scored = computeLocalOutfitScore(items);
    data.push({
      items: items.map((item) => ({
        name: item.name,
        category: item.category,
        color: item.color,
      })),
      label: labelFromScore(scored),
      score: scored.score,
      primaryStyle: scored.aesthetic?.primaryStyle ?? null,
      clashId: scored.clashId,
      issues: issuesFromScore(scored),
    });
  }
  return data;
}

function parseArg(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}

if (process.argv[1]?.includes('generate-outfit-calibration-dataset')) {
  const count = Number(parseArg('count', '500'));
  const outPath = resolve(parseArg('out', 'data/outfits_generated.json'));
  const dataset = generateDataset(count);
  const good = dataset.filter((d) => d.label === 'good').length;
  const bad = dataset.filter((d) => d.label === 'bad').length;
  writeFileSync(outPath, JSON.stringify({ version: 1, count: dataset.length, good, bad, examples: dataset }, null, 2));
  console.log(`Generated ${dataset.length} outfits → ${outPath} (good: ${good}, bad: ${bad})`);
}
