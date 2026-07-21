import tagDataset from '@/data/outfitStyleTagDataset.json';
import type { StyleArchetype } from '@/utils/outfitAestheticClassifier';

export type StyleTagEntry = {
  id: string;
  keywords: string[];
  categories?: string[];
  primary: StyleArchetype[];
  secondary: StyleArchetype[];
};

type StyleTagDataset = {
  version: number;
  primaryWeight: number;
  secondaryWeight: number;
  entries: StyleTagEntry[];
};

const DATASET = tagDataset as StyleTagDataset;

/** Longest keyword wins — "oversized blazer" beats "blazer". */
const SORTED_ENTRIES = [...DATASET.entries].sort((a, b) => {
  const aMax = Math.max(...a.keywords.map((k) => k.length));
  const bMax = Math.max(...b.keywords.map((k) => k.length));
  return bMax - aMax;
});

export function matchStyleTagEntry(text: string, category: string): StyleTagEntry | null {
  const normalizedText = text.toLowerCase();
  const normalizedCat = category.toLowerCase();

  let best: { entry: StyleTagEntry; score: number } | null = null;

  for (const entry of SORTED_ENTRIES) {
    if (entry.categories?.length && !entry.categories.includes(normalizedCat)) continue;

    for (const keyword of entry.keywords) {
      const kw = keyword.toLowerCase();
      if (!normalizedText.includes(kw)) continue;

      const score = kw.length;
      if (!best || score > best.score) {
        best = { entry, score };
      }
    }
  }

  return best?.entry ?? null;
}

export function applyStyleTagEntry(
  entry: StyleTagEntry,
  baseWeight: number,
  tags: Partial<Record<StyleArchetype, number>>,
): void {
  for (const style of entry.primary) {
    tags[style] = (tags[style] || 0) + baseWeight * DATASET.primaryWeight;
  }
  for (const style of entry.secondary) {
    tags[style] = (tags[style] || 0) + baseWeight * DATASET.secondaryWeight;
  }
}

export function classifyItemFromDataset(
  text: string,
  category: string,
  baseWeight: number,
): Partial<Record<StyleArchetype, number>> | null {
  const entry = matchStyleTagEntry(text, category);
  if (!entry) return null;

  const tags: Partial<Record<StyleArchetype, number>> = {};
  applyStyleTagEntry(entry, baseWeight, tags);
  return tags;
}

export function getStyleTagDatasetEntryCount(): number {
  return DATASET.entries.length;
}

export { DATASET as STYLE_TAG_DATASET };
