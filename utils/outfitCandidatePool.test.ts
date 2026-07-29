import assert from 'node:assert/strict';

import type { WardrobeItem } from '../contexts/WardrobeContext';
import { selectOutfitCandidatePool } from './outfitCandidatePool';

function makeItem(partial: Partial<WardrobeItem> & { id: string; category: WardrobeItem['category'] }): WardrobeItem {
  return {
    userId: 'u1',
    name: partial.name || `Item ${partial.id}`,
    color: 'black',
    seasons: [],
    occasions: [],
    isFavorite: false,
    timesWorn: 0,
    imageUri: 'https://example.com/x.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

const items: WardrobeItem[] = [];
for (let i = 0; i < 40; i++) items.push(makeItem({ id: `t${i}`, category: 'tops', timesWorn: i }));
for (let i = 0; i < 40; i++) items.push(makeItem({ id: `b${i}`, category: 'bottoms', timesWorn: i }));
for (let i = 0; i < 40; i++) items.push(makeItem({ id: `s${i}`, category: 'shoes', timesWorn: i }));

const pool = selectOutfitCandidatePool(items, 10);
assert.ok(pool.length <= 40, 'pool should be capped well below full wardrobe');
assert.ok(pool.length >= 20, 'pool should keep enough candidates per role');
assert.equal(selectOutfitCandidatePool(items.slice(0, 5), 10).length, 5, 'small wardrobes pass through');

console.log('outfitCandidatePool.test.ts: ok');
