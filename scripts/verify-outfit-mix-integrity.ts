/**
 * Production integrity: athletic→athleisure, occasion caps, pool prune.
 * Run: npx tsx scripts/verify-outfit-mix-integrity.ts
 */
import {
  analyzeOutfitAesthetic,
  computeLocalOutfitScore,
  occasionFormalityHardCap,
  getStyleLane,
} from '../utils/outfitCompatibilityScore';
import { isAthleticTopOverride, isStructuredTailoredBottom, isCasualTrouserBottom } from '../utils/garmentCategory';
import { overridePrimaryStyle, blockSmartCasualUpgrade } from '../utils/taxonomyOverrides';
import { pruneMixCandidates, isStrictMixOccasion } from '../utils/outfitMixConstraints';
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

console.log('verify-outfit-mix-integrity: taxonomy + caps + prune passed');
