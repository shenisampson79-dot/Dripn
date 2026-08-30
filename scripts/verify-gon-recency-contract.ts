/**
 * GON cross-request recency contract — deterministic regression.
 * Run: npx tsx scripts/verify-gon-recency-contract.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  extractGonRecentOutfitIdLists,
  flattenGonPenalizeItemIds,
} from '../utils/extractGonRecentOutfitIdLists';

const root = resolve(import.meta.dirname, '..');

// Unit: prior look ids extracted newest-first from session options
{
  const lists = extractGonRecentOutfitIdLists([
    { id: 'look_1', outfit: { items: [{ id: '10' }, { id: '11' }, { id: '12' }] } },
    { id: 'look_2', itemIds: ['73', '63', '53'] },
  ]);
  assert.deepEqual(lists[0], ['73', '63', '53'], 'newest look first');
  assert.deepEqual(lists[1], ['10', '11', '12']);
  const penalize = flattenGonPenalizeItemIds(lists);
  assert.ok(penalize.includes('73') && penalize.includes('10'));
}

const scanSrc = readFileSync(resolve(root, 'screens/ScanWardrobeScreen.tsx'), 'utf8');
const apiSrc = readFileSync(resolve(root, 'services/ApiService.ts'), 'utf8');

assert.match(scanSrc, /extractGonRecentOutfitIdLists\(outfitOptions/);
assert.match(scanSrc, /recentOutfits: recentOutfits\.length \? recentOutfits/);
assert.match(scanSrc, /penalizeItemIds: penalizeItemIds\.length \? penalizeItemIds/);
assert.match(apiSrc, /recentOutfits\?: Array<Array<string \| number>>/);
assert.match(apiSrc, /penalizeItemIds\?: Array<string \| number>/);

console.log('verify-gon-recency-contract — all passed');
