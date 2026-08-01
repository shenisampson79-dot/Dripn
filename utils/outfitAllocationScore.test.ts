/**
 * Work-focused calibrated scoring checks.
 * Run: npx tsx utils/outfitAllocationScore.test.ts
 */
import assert from 'node:assert/strict';

import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  scoreOutfitBreakdown,
  scoreOutfitForAllocation,
  weightsFor,
  workAttireRankDelta,
} from './outfitAllocationScore';

function item(
  partial: Partial<WardrobeItem> & Pick<WardrobeItem, 'id' | 'category' | 'name'>,
): WardrobeItem {
  return {
    userId: 'u1',
    imageUri: '',
    color: 'navy',
    seasons: ['all-season'],
    occasions: ['work'],
    timesWorn: 2,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

const dressShirt = item({
  id: 'shirt',
  category: 'tops',
  name: 'White Long Sleeve Dress Shirt',
  color: 'white',
});
const chinos = item({ id: 'chinos', category: 'bottoms', name: 'Navy Chinos', color: 'navy' });
const oxfords = item({
  id: 'oxfords',
  category: 'shoes',
  name: 'Black Oxford Dress Shoes',
  color: 'black',
});
const loafers = item({ id: 'loafers', category: 'shoes', name: 'Brown Leather Loafers', color: 'brown' });
const ruggedBoots = item({
  id: 'boots',
  category: 'shoes',
  name: 'Rugged Leather Work Boots',
  color: 'brown',
});
const linenSs = item({
  id: 'linen',
  category: 'tops',
  name: 'Short Sleeve Linen Shirt',
  color: 'cream',
});
const jeans = item({ id: 'jeans', category: 'bottoms', name: 'Light Wash Jeans', color: 'denim' });

// Work weights: Context dominates
const wFormal = weightsFor('work_outfit', 'business_formal');
assert.ok(wFormal.x >= 38, `business formal context weight expected ≥38, got ${wFormal.x}`);
assert.equal(wFormal.c + wFormal.x + wFormal.u + wFormal.p + wFormal.f, 100);

const wCasual = weightsFor('weekend', null);
assert.ok(wCasual.u >= 20, 'weekend should weight preference higher');
assert.ok(wCasual.x < wFormal.x, 'weekend context < formal work context');

const officeLook = [dressShirt, chinos, oxfords];
const bootsLook = [dressShirt, chinos, ruggedBoots];
const linenLook = [linenSs, jeans, ruggedBoots];

const officeScore = scoreOutfitForAllocation(officeLook, {
  occasion: 'work_outfit',
  workDressCode: 'business_casual',
});
const bootsScore = scoreOutfitForAllocation(bootsLook, {
  occasion: 'work_outfit',
  workDressCode: 'business_casual',
});

assert.ok(
  officeScore > bootsScore,
  `office shoes (${officeScore}) should beat rugged boots (${bootsScore}) for business casual`,
);
assert.ok(officeScore >= 55, `solid office look should score decently, got ${officeScore}`);

const delta = workAttireRankDelta(officeLook, bootsLook, 'business_casual');
assert.ok(delta > 0, `workAttireRankDelta should prefer office shoes, got ${delta}`);

const formalBreakdown = scoreOutfitBreakdown([dressShirt, chinos, oxfords], {
  occasion: 'work_outfit',
  workDressCode: 'business_formal',
});
assert.ok(formalBreakdown.weights.x >= 38, 'formal breakdown keeps high context');
assert.ok(formalBreakdown.context >= 0.4, 'formal office context component should be healthy');

const creativeBoots = scoreOutfitForAllocation(bootsLook, {
  occasion: 'smart_casual',
  workDressCode: 'creative',
});
const creativeOffice = scoreOutfitForAllocation(officeLook, {
  occasion: 'smart_casual',
  workDressCode: 'creative',
});
// Creative workplaces should not crush boots as hard as business casual
assert.ok(
  Math.abs(creativeBoots - creativeOffice) < Math.abs(officeScore - bootsScore) + 5
    || creativeBoots >= bootsScore,
  'creative dress code should be more permissive of boots than business casual',
);

const loafersScore = scoreOutfitForAllocation([dressShirt, chinos, loafers], {
  occasion: 'work_outfit',
  workDressCode: 'business_casual',
});
assert.ok(loafersScore >= 50, `loafers should be a strong business-casual shoe, got ${loafersScore}`);

// Linen + rugged for office should not beat dress shirt + oxfords
const linenOffice = scoreOutfitForAllocation(linenLook, {
  occasion: 'work_outfit',
  workDressCode: 'business_casual',
});
assert.ok(
  officeScore > linenOffice,
  `classic office (${officeScore}) should beat linen+boots (${linenOffice})`,
);

// Luxury soft layer: cream/beige quiet palette should not tank; rugged boots still lose at work
const creamKnit = item({
  id: 'cream',
  category: 'tops',
  name: 'Cream Knit Sweater',
  color: 'cream',
});
const beigeTrousers = item({
  id: 'beige-tr',
  category: 'bottoms',
  name: 'Beige Tailored Trousers',
  color: 'beige',
});
const quietLook = scoreOutfitBreakdown([creamKnit, beigeTrousers, loafers], {
  occasion: 'smart_casual',
  workDressCode: 'smart_casual',
  brandInspiration: 'loro_piana',
});
assert.ok(
  quietLook.reasons.some((r) => /Luxury brand|Sloane Street/.test(r)),
  `expected soft style boost reason, got ${quietLook.reasons.join(' | ')}`,
);

console.log('outfitAllocationScore.test.ts: ok', {
  officeScore,
  bootsScore,
  loafersScore,
  linenOffice,
  formalFinal: formalBreakdown.final,
  creativeBoots,
  quietLuxuryFinal: quietLook.final,
});
