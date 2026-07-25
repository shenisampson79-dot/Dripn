/**
 * Outfit Mix: athleisure lane labels + occasion hard caps.
 * Run: npx tsx scripts/verify-outfit-mix-occasion.ts
 */
import {
  analyzeOutfitAesthetic,
  computeLocalOutfitScore,
  occasionFormalityHardCap,
  isPerformanceAthleticTop,
} from '../utils/outfitCompatibilityScore';
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
const shorts = item({ id: 'shorts', category: 'bottoms', name: 'Black Shorts', color: 'black' });
const ankleBoots = item({
  id: 'boots',
  category: 'shoes',
  name: 'Dark Brown Leather Lace-up Ankle Boots',
  color: 'brown',
});

assert(isPerformanceAthleticTop(tank), 'running tank must be performance athletic top');

const athleisureLook = [tank, trousers, sneakers];
const aesthetic = analyzeOutfitAesthetic(athleisureLook);
assert(
  aesthetic.primaryStyle === 'athleisure',
  `running tank + trousers + sneakers must be athleisure, got ${aesthetic.primaryStyle}`,
);
assert(
  aesthetic.primaryStyle !== 'smart_casual',
  'must NEVER label performance tank outfit as smart_casual',
);

const casualScore = computeLocalOutfitScore(athleisureLook, null, null, null, {
  occasion: 'casual',
  source: 'outfit_mix',
});
assert(casualScore.score >= 55, `cohesive athleisure on Casual can score reasonably, got ${casualScore.score}`);
assert(
  !/smart casual/i.test(casualScore.hint || '') && !/smart casual/i.test(casualScore.stylistAnalysis?.summary || ''),
  `summary must not say smart casual: ${casualScore.stylistAnalysis?.summary || casualScore.hint}`,
);
assert(
  /athleisure/i.test(casualScore.stylistAnalysis?.summary || casualScore.hint || ''),
  `summary should mention athleisure: ${casualScore.stylistAnalysis?.summary || casualScore.hint}`,
);

for (const occasion of ['party', 'work', 'formal', 'wedding'] as const) {
  const scored = computeLocalOutfitScore(athleisureLook, null, null, null, {
    occasion,
    source: 'outfit_mix',
  });
  const gate = occasionFormalityHardCap(occasion, athleisureLook, aesthetic);
  assert(gate != null, `${occasion} must fire occasion formality gate`);
  assert(
    scored.score <= gate!.cap,
    `${occasion} score must be ≤${gate!.cap}, got ${scored.score}`,
  );
  assert(
    scored.score < 50,
    `${occasion} must not score ~90% for athletic tank look, got ${scored.score}`,
  );
}

const party = computeLocalOutfitScore(athleisureLook, null, null, null, {
  occasion: 'party',
  source: 'outfit_mix',
});
assert(party.score <= 38, `Party athletic tank ≤38, got ${party.score}`);

const formal = computeLocalOutfitScore(athleisureLook, null, null, null, {
  occasion: 'formal',
  source: 'outfit_mix',
});
assert(formal.score <= 22, `Formal athletic tank ≤22, got ${formal.score}`);

const clashLook = [tank, shorts, ankleBoots];
const clashScore = computeLocalOutfitScore(clashLook, null, null, null, {
  occasion: 'casual',
  source: 'outfit_mix',
});
assert(clashScore.score < 40, `tank+shorts+ankle boots should score low, got ${clashScore.score}`);
assert(
  !/tailored pieces/i.test(clashScore.stylistAnalysis?.summary || '')
    || !(clashScore.signals?.lanesPresent || []).includes('tailored'),
  `must not claim tailored pieces when none present: ${clashScore.stylistAnalysis?.summary}`,
);

console.log('verify-outfit-mix-occasion: athleisure lane + occasion caps passed');
