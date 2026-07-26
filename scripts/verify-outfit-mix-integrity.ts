/**
 * Production integrity: athletic→athleisure, occasion caps, pool prune,
 * and Outfit Mix selection/evaluation separation (chip switches).
 * Run: npx tsx scripts/verify-outfit-mix-integrity.ts
 */
import {
  analyzeOutfitAesthetic,
  computeLocalOutfitScore,
  mergeOutfitScores,
  occasionFormalityHardCap,
  getStyleLane,
} from '../utils/outfitCompatibilityScore';
import { isAthleticTopOverride, isStructuredTailoredBottom, isCasualTrouserBottom } from '../utils/garmentCategory';
import { overridePrimaryStyle, blockSmartCasualUpgrade } from '../utils/taxonomyOverrides';
import {
  pruneMixCandidates,
  isStrictMixOccasion,
  buildMixReelPools,
  preserveSelectionAcrossOccasion,
} from '../utils/outfitMixConstraints';
import type { WardrobeItem } from '../contexts/WardrobeContext';

function item(partial: Partial<WardrobeItem> & Pick<WardrobeItem, 'id' | 'category' | 'name'>): WardrobeItem {
  return {
    userId: 'u1',
    imageUri: '',
    color: 'black',
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function selectionIds(sel: Partial<Record<string, string | null>>): string[] {
  return Object.values(sel).filter((id): id is string => !!id).sort();
}

const tank = item({ id: 'tank', category: 'activewear_tops', name: 'ASICS Running Tank', color: 'black' });
const trousers = item({ id: 'trousers', category: 'bottoms', name: 'Black Trousers', color: 'black' });
const sneakers = item({ id: 'sneakers', category: 'shoes', name: 'Cream Lifestyle Sneakers', color: 'cream' });
const cargo = item({ id: 'cargo', category: 'bottoms', name: 'Black Cargo Pants', color: 'black' });
const oxford = item({ id: 'oxford', category: 'tops', name: 'White Oxford Shirt', color: 'white' });
const loafers = item({ id: 'loafers', category: 'shoes', name: 'Brown Loafers', color: 'brown' });

assert(isAthleticTopOverride(tank), 'tank athletic');
assert(isCasualTrouserBottom(trousers), 'plain trousers casual');
assert(!isStructuredTailoredBottom(trousers), 'plain trousers not structured tailored');
assert(blockSmartCasualUpgrade([tank, trousers, sneakers]), 'block smart casual upgrade');

const aesthetic = analyzeOutfitAesthetic([tank, trousers, sneakers]);
assert(aesthetic.primaryStyle === 'athleisure', `got ${aesthetic.primaryStyle}`);
assert(overridePrimaryStyle('smart_casual', [tank, trousers, sneakers]) === 'athleisure', 'override');
assert(getStyleLane(tank) === 'athleisure', `tank lane ${getStyleLane(tank)}`);
assert(getStyleLane(trousers) === 'casual', `trousers lane ${getStyleLane(trousers)}`);

const look = [tank, trousers, sneakers];
for (const [occ, max] of [['formal', 20], ['wedding', 20], ['work', 30], ['party', 35]] as const) {
  const scored = computeLocalOutfitScore(look, null, null, null, { occasion: occ, source: 'outfit_mix' });
  const gate = occasionFormalityHardCap(occ, look, aesthetic);
  assert(gate != null, `${occ} gate`);
  assert(gate!.cap <= max, `${occ} cap ≤${max}, got ${gate!.cap}`);
  assert(scored.score <= max, `${occ} score ≤${max}, got ${scored.score}`);
  assert(scored.score < 90, `${occ} must not be ≥90`);
}

const casual = computeLocalOutfitScore(look, null, null, null, { occasion: 'casual', source: 'outfit_mix' });
assert(casual.score >= 50, `casual athleisure can score reasonably, got ${casual.score}`);
assert(!/smart casual/i.test(casual.stylistAnalysis?.summary || casual.hint || ''), 'no smart casual copy');

assert(isStrictMixOccasion('formal'), 'formal strict');
const pruned = pruneMixCandidates([tank, trousers, sneakers, cargo, oxford, loafers], 'work');
assert(!pruned.kept.some((i) => i.id === 'tank'), 'work prunes tank');
assert(!pruned.kept.some((i) => i.id === 'sneakers'), 'work prunes trainers');
assert(!pruned.kept.some((i) => i.id === 'cargo'), 'work prunes cargo');
assert(pruned.kept.some((i) => i.id === 'oxford'), 'work keeps oxford');

// ─── Selection / evaluation / reels separation ───────────────────────────────
const wardrobe = [tank, trousers, sneakers, cargo, oxford, loafers];
let selection: Partial<Record<string, string | null>> = {
  outerwear: null,
  tops: 'tank',
  bottoms: 'trousers',
  shoes: 'sneakers',
};
const casualIds = selectionIds(selection);
const casualScore = computeLocalOutfitScore(look, null, null, null, { occasion: 'casual', source: 'outfit_mix' });

// Chip → Work: selection immutable; reels prune; score lower; pcs unchanged
selection = preserveSelectionAcrossOccasion(selection);
assert(selectionIds(selection).join('|') === casualIds.join('|'), 'work chip must not mutate selection IDs');
const workPools = buildMixReelPools(wardrobe, 'work', selection);
const workPoolSansSelection = pruneMixCandidates(wardrobe, 'work').kept;
assert(!workPoolSansSelection.some((i) => i.id === 'tank'), 'work pool alone drops tank');
assert(workPools.tops.some((i) => i.id === 'tank'), 'selection lock re-injects tank into tops reel');
assert(workPools.shoes.some((i) => i.id === 'sneakers'), 'selected sneakers stay visible');
// Soft-ban: cargo demoted for scoring but still browsable (UI Reality)
assert(workPools.bottoms.some((i) => i.id === 'cargo'), 'work keeps unselected cargo visible (soft-ban)');
assert(
  (workPools.bottoms.find((i) => i.id === 'cargo') as { softBanned?: boolean })?.softBanned === true,
  'cargo marked softBanned on work',
);

// Formal trousers belong in the bottoms reel (not only bottoms category)
const formalTrousers = item({
  id: 'formal-trouser',
  category: 'formal',
  name: 'Charcoal Dress Trousers',
  color: 'charcoal',
});
const formalPools = buildMixReelPools([trousers, formalTrousers, oxford], 'work', {
  bottoms: 'trousers',
  shoes: 'oxford',
});
assert(formalPools.bottoms.some((i) => i.id === 'formal-trouser'), 'formal trousers in bottoms reel');
assert(formalPools.bottoms.some((i) => i.id === 'trousers'), 'regular trousers still in bottoms reel');
assert(formalPools.shoes.some((i) => i.id === 'oxford'), 'oxford in shoes reel');

const workScore = computeLocalOutfitScore(look, null, null, null, { occasion: 'work', source: 'outfit_mix' });
assert(workScore.score > 0, `work score must be non-zero with pieces, got ${workScore.score}`);
assert(workScore.score < casualScore.score, `work score ${workScore.score} must be < casual ${casualScore.score}`);
assert(selectionIds(selection).length === 3, 'pcs unchanged on work chip');

// Chip → Casual: identical outfit + score restored
selection = preserveSelectionAcrossOccasion(selection);
assert(selectionIds(selection).join('|') === casualIds.join('|'), 'return to casual keeps IDs');
const casualRestored = computeLocalOutfitScore(look, null, null, null, { occasion: 'casual', source: 'outfit_mix' });
assert(casualRestored.score === casualScore.score, `casual score restored ${casualRestored.score} vs ${casualScore.score}`);
assert(selectionIds(selection).length === 3, 'pcs unchanged on return to casual');

// Rapid chip switching — no wipe / no 0 pcs with items selected
const rapidOccasions = ['work', 'formal', 'party', 'wedding', 'casual', 'work', 'casual'] as const;
for (const occ of rapidOccasions) {
  selection = preserveSelectionAcrossOccasion(selection);
  const ids = selectionIds(selection);
  assert(ids.join('|') === casualIds.join('|'), `rapid ${occ}: IDs wiped`);
  assert(ids.length === 3, `rapid ${occ}: 0 pcs with items selected`);
  const pools = buildMixReelPools(wardrobe, occ, selection);
  assert(pools.tops.some((i) => i.id === 'tank'), `rapid ${occ}: selected top missing from reel`);
  const scored = computeLocalOutfitScore(look, null, null, null, { occasion: occ, source: 'outfit_mix' });
  assert(scored.score > 0, `rapid ${occ}: collapsed to 0% with pieces`);
}

// Empty selection is the only 0% / 0 pcs case
const emptyScore = computeLocalOutfitScore([], null, null, null, { occasion: 'work', source: 'outfit_mix' });
assert(emptyScore.score === 0, 'empty look may be 0%');
assert(selectionIds({}).length === 0, 'empty selection is 0 pcs');

// AI merge must not floor-wipe a scored look to 0
const mergedZeroAi = mergeOutfitScores(workScore, { score: 0, hardCapApplied: 'occasion' });
assert(mergedZeroAi.score >= 5, `merge floor with pieces, got ${mergedZeroAi.score}`);

console.log('verify-outfit-mix-integrity: taxonomy + caps + prune + selection lock passed');
