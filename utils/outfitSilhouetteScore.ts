import type { StyleArchetype } from '@/utils/outfitAestheticClassifier';

export type SilhouetteType =
  | 'slim'
  | 'oversized'
  | 'tailored'
  | 'relaxed'
  | 'boxy'
  | 'tapered'
  | 'structured'
  | 'mixed';

export type SilhouetteScoreResult = {
  overall: number;
  proportionBalance: number;
  fitAccuracy: number;
  silhouetteShape: number;
  structureFlow: number;
  silhouetteType: SilhouetteType;
  adjustment: number;
  issues: string[];
};

type ItemLike = { name?: string; category?: string; subcategory?: string };

function itemText(item: ItemLike): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

type FitSignal = 'tight' | 'slim' | 'regular' | 'relaxed' | 'oversized' | 'baggy';

function fitSignal(item: ItemLike): FitSignal {
  const t = itemText(item);
  if (/\b(oversized|baggy|wide leg|wide-leg|parachute|boxy)\b/.test(t)) return 'oversized';
  if (/\b(slim|skinny|fitted|tapered|tailored|pleated)\b/.test(t)) return 'slim';
  if (/\b(relaxed|loose|comfort|straight leg)\b/.test(t)) return 'relaxed';
  if (/\b(crop|cropped|muscle|tight)\b/.test(t)) return 'tight';
  if (/\b(blazer|suit|dress shirt|oxford|trouser|chino)\b/.test(t)) return 'slim';
  if (/\b(hoodie|sweatpant|jogger|track pant|legging)\b/.test(t)) return 'relaxed';
  return 'regular';
}

function isStructured(item: ItemLike): boolean {
  const t = itemText(item);
  return /\b(blazer|suit|dress shirt|oxford|tailored|trouser|pleated|heel|oxford shoe|derby)\b/.test(t);
}

function isFlow(item: ItemLike): boolean {
  const t = itemText(item);
  return /\b(hoodie|sweatpant|jogger|track|legging|t-shirt|tee|sneaker|runner)\b/.test(t);
}

export function scoreOutfitSilhouette(
  items: ItemLike[],
  primaryStyle: StyleArchetype | null = null,
): SilhouetteScoreResult {
  const issues: string[] = [];
  const tops = items.filter((i) => /tops|activewear_tops|outerwear|dresses/.test(String(i.category || '')));
  const bottoms = items.filter((i) => /bottoms|activewear_bottoms|dresses/.test(String(i.category || '')));

  const topSignals = tops.map(fitSignal);
  const bottomSignals = bottoms.map(fitSignal);

  const dominantTop = topSignals[0] || 'regular';
  const dominantBottom = bottomSignals[0] || 'regular';

  let proportionBalance = 7;
  const bothOversized = topSignals.includes('oversized') && bottomSignals.includes('oversized');
  const bothSlim = topSignals.every((s) => s === 'slim' || s === 'tight')
    && bottomSignals.every((s) => s === 'slim' || s === 'tight');
  const balancedMix =
    (['slim', 'regular', 'tight'].includes(dominantTop) && ['relaxed', 'oversized', 'regular'].includes(dominantBottom))
    || (['relaxed', 'oversized'].includes(dominantTop) && ['slim', 'regular', 'tight'].includes(dominantBottom));

  if (balancedMix) proportionBalance = 9;
  else if (bothOversized && (primaryStyle === 'streetwear' || primaryStyle === 'athleisure')) proportionBalance = 7;
  else if (bothOversized) {
    proportionBalance = 4;
    issues.push('double_oversized');
  } else if (bothSlim) proportionBalance = 8;
  else proportionBalance = 6;

  let fitAccuracy = 7;
  if (items.some((i) => /\b(oversized|baggy)\b/.test(itemText(i))) && primaryStyle === 'classic_tailoring') {
    fitAccuracy = 4;
    issues.push('fit_mismatch_tailoring');
  }

  let silhouetteType: SilhouetteType = 'mixed';
  if (bothOversized) silhouetteType = 'oversized';
  else if (bothSlim || items.some(isStructured)) silhouetteType = 'tailored';
  else if (dominantTop === 'slim' && dominantBottom === 'slim') silhouetteType = 'tapered';
  else if (balancedMix) silhouetteType = 'tapered';
  else silhouetteType = 'relaxed';

  let silhouetteShape = 7;
  if (silhouetteType === 'tapered' || silhouetteType === 'tailored') silhouetteShape = 8;
  if (silhouetteType === 'mixed' && issues.length > 0) silhouetteShape = 5;

  const structuredCount = items.filter(isStructured).length;
  const flowCount = items.filter(isFlow).length;
  let structureFlow = 7;
  if (structuredCount > 0 && flowCount > 0 && balancedMix) structureFlow = 8;
  else if (structuredCount >= 2 && flowCount >= 2 && !balancedMix) {
    structureFlow = 4;
    issues.push('structure_flow_clash');
  } else if (flowCount >= 3 && structuredCount === 0) structureFlow = 6;

  const overall = Math.round(
    (proportionBalance + fitAccuracy + silhouetteShape + structureFlow) / 4 * 10,
  ) / 10;

  let adjustment: number;
  if (overall >= 8) adjustment = 6;
  else if (overall >= 7) adjustment = 3;
  else if (overall >= 5.5) adjustment = 0;
  else if (overall >= 4) adjustment = -6;
  else adjustment = -10;

  return {
    overall,
    proportionBalance,
    fitAccuracy,
    silhouetteShape,
    structureFlow,
    silhouetteType,
    adjustment,
    issues,
  };
}

export function formatSilhouetteForPrompt(result: SilhouetteScoreResult): string {
  const lines = [
    `- Silhouette overall: ${result.overall}/10 (${result.silhouetteType})`,
    `- Proportion balance: ${result.proportionBalance}/10`,
    `- Fit accuracy: ${result.fitAccuracy}/10`,
    `- Silhouette shape: ${result.silhouetteShape}/10`,
    `- Structure vs flow: ${result.structureFlow}/10`,
  ];
  if (result.issues.length) lines.push(`- Silhouette issues: ${result.issues.join(', ')}`);
  return lines.join('\n');
}
