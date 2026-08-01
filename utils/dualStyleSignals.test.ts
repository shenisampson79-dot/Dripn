/**
 * Dual-style context weighting tests.
 * Run: npx tsx utils/dualStyleSignals.test.ts
 */
import assert from 'node:assert/strict';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  applyDualStyleBoosts,
  elevatedCasualHybridBoost,
  resolveDualStyleContextKey,
  scoreDualStyleBoosts,
} from './dualStyleSignals';

function item(partial: Partial<WardrobeItem> & { category: string; name: string }): WardrobeItem {
  return {
    id: partial.id || 'x',
    name: partial.name,
    category: partial.category,
    subcategory: partial.subcategory,
    color: partial.color || 'beige',
    imageUri: '',
    seasons: ['all-season'],
    occasions: ['everyday'],
    dateAdded: new Date().toISOString(),
    ...partial,
  } as WardrobeItem;
}

assert.equal(resolveDualStyleContextKey({ occasion: 'work_outfit', workDressCode: 'business_casual' }), 'work');
assert.equal(resolveDualStyleContextKey({ occasion: 'casual_day' }), 'casual');
assert.equal(resolveDualStyleContextKey({ occasion: 'weekend' }), 'weekend');

const workLook = [
  item({ name: 'White Shirt', category: 'tops', subcategory: 'shirt', color: 'white' }),
  item({ name: 'Beige Trousers', category: 'bottoms', subcategory: 'trousers', color: 'beige' }),
  item({ name: 'Brown Loafers', category: 'shoes', subcategory: 'loafers', color: 'brown' }),
];

const casualSneakers = [
  item({ name: 'Black T-Shirt', category: 'tops', subcategory: 't-shirt', color: 'black' }),
  item({ name: 'White Shorts', category: 'bottoms', subcategory: 'shorts', color: 'white' }),
  item({ name: 'White Sneakers', category: 'shoes', subcategory: 'sneakers', color: 'white' }),
];

const elevated = [
  item({ name: 'White Tee', category: 'tops', subcategory: 't-shirt', color: 'white' }),
  item({ name: 'Navy Trousers', category: 'bottoms', subcategory: 'tailored trousers', color: 'navy' }),
  item({ name: 'White Sneakers', category: 'shoes', subcategory: 'sneakers', color: 'white' }),
];

assert.equal(elevatedCasualHybridBoost(elevated, { occasion: 'weekend' }), 6);
assert.equal(
  elevatedCasualHybridBoost(elevated, { occasion: 'work_outfit', workDressCode: 'business_casual' }),
  0,
  'strict work must not get elevated-casual sneaker boost',
);

const workScore = scoreDualStyleBoosts(workLook, { occasion: 'work_outfit', workDressCode: 'business_casual' });
assert.ok(workScore.weights.luxury >= 0.9, 'work should weight luxury high');
assert.ok(workScore.weights.casual <= 0.25, 'work should weight casual low');

const casualScore = scoreDualStyleBoosts(casualSneakers, { occasion: 'weekend' });
assert.ok(casualScore.weights.casual >= 0.9, 'weekend should weight casual high');

// Sneakers must not get a free work boost just because Croydon has many sneakers
const sneakersAtWork = applyDualStyleBoosts(
  [
    item({ name: 'Shirt', category: 'tops', subcategory: 'shirt', color: 'white' }),
    item({ name: 'Trousers', category: 'bottoms', subcategory: 'trousers', color: 'navy' }),
    item({ name: 'Sneakers', category: 'shoes', subcategory: 'sneakers', color: 'white' }),
  ],
  { occasion: 'work_outfit', workDressCode: 'business_formal' },
);
const loafersAtWork = applyDualStyleBoosts(workLook, {
  occasion: 'work_outfit',
  workDressCode: 'business_formal',
});
assert.ok(
  loafersAtWork >= sneakersAtWork,
  `loafers at work (${loafersAtWork}) should beat or match sneakers (${sneakersAtWork})`,
);

console.log('dualStyleSignals.test.ts: all passed');
