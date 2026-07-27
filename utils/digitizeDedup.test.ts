/**
 * Digitize dedup partition tests.
 * Run: npx tsx utils/digitizeDedup.test.ts
 */
import assert from 'node:assert/strict';
import {
  collapseWithinBatch,
  filterAgainstWardrobe,
  partitionDigitizeCandidates,
} from './digitizeDedup.ts';

console.log('=== Digitize dedup ===\n');

{
  const { kept, dropped } = collapseWithinBatch([
    { id: 'a', name: 'Black Running T-Shirt', category: 'tops', color: 'black' },
    { id: 'b', name: 'Black Running T-Shirt', category: 'tops', color: 'black' },
    { id: 'c', name: 'Black Shorts', category: 'bottoms', color: 'black' },
  ]);
  assert.equal(kept.length, 2);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].item.id, 'b');
  console.log('✓ within-batch collapse');
}

{
  const wardrobe = [
    {
      id: '1',
      name: 'Black Running T-Shirt',
      category: 'tops',
      color: 'black',
      origin: 'owned',
    },
  ];
  const { unique, duplicates } = filterAgainstWardrobe(
    [
      { id: 'n1', name: 'Black Running T-Shirt', category: 'tops', color: 'black' },
      { id: 'n2', name: 'Navy Hoodie', category: 'tops', color: 'navy' },
    ],
    wardrobe,
  );
  assert.equal(unique.length, 1);
  assert.equal(unique[0].id, 'n2');
  assert.equal(duplicates.length, 1);
  console.log('✓ wardrobe filter');
}

{
  const { unique, dropped } = partitionDigitizeCandidates(
    [
      { id: 'a', name: 'Black Shorts', category: 'bottoms', color: 'black' },
      { id: 'b', name: 'Black Shorts', category: 'bottoms', color: 'black' },
      { id: 'c', name: 'Black Shorts', category: 'bottoms', color: 'black' },
    ],
    [
      {
        id: 'w1',
        name: 'Black Shorts',
        category: 'bottoms',
        color: 'black',
        origin: 'owned',
      },
    ],
  );
  assert.equal(unique.length, 0);
  assert.ok(dropped.length >= 2);
  console.log('✓ partition: batch + wardrobe');
}

console.log('\nAll digitize dedup checks passed.\n');
