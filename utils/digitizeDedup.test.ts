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
import { hexWithHammingDistance } from './wardrobeDuplicateMatch.ts';

console.log('=== Digitize dedup ===\n');

{
  const hash = 'aaaaaaaaaaaaaaaa';
  const { kept, dropped } = collapseWithinBatch([
    { id: 'a', name: 'Black Running T-Shirt', category: 'tops', color: 'black', imagePhash: hash },
    { id: 'b', name: 'Black Running T-Shirt', category: 'tops', color: 'black', imagePhash: hash },
    { id: 'c', name: 'Black Shorts', category: 'bottoms', color: 'black', imagePhash: '0123456789abcdef' },
  ]);
  assert.equal(kept.length, 2);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].item.id, 'b');
  console.log('✓ within-batch collapse on identical hash');
}

{
  const { kept, dropped } = collapseWithinBatch([
    { id: 'a', name: 'Black Running T-Shirt', category: 'tops', color: 'black' },
    { id: 'b', name: 'Black Running T-Shirt', category: 'tops', color: 'black' },
  ]);
  assert.equal(kept.length, 2);
  assert.equal(dropped.length, 0);
  console.log('✓ name-only twins in a scan are not collapsed');
}

{
  const hash = 'bbbbbbbbbbbbbbbb';
  const wardrobe = [
    {
      id: '1',
      name: 'Cavani Grey Blazer',
      category: 'outerwear',
      color: 'grey',
      origin: 'owned',
      imagePhash: hash,
    },
  ];
  const { unique, duplicates } = filterAgainstWardrobe(
    [
      { id: 'n1', name: 'Grey Jacket', category: 'outerwear', color: 'grey', imagePhash: hash },
      { id: 'n2', name: 'Navy Hoodie', category: 'tops', color: 'navy', imagePhash: '0123456789abcdef' },
    ],
    wardrobe,
  );
  assert.equal(unique.length, 1);
  assert.equal(unique[0].id, 'n2');
  assert.equal(duplicates.length, 1);
  console.log('✓ wardrobe filter uses image hash over labels');
}

{
  const hash = 'cccccccccccccccc';
  const { unique, dropped } = partitionDigitizeCandidates(
    [
      { id: 'a', name: 'Black Shorts', category: 'bottoms', color: 'black', imagePhash: hash },
      { id: 'b', name: 'Black Shorts', category: 'bottoms', color: 'black', imagePhash: hash },
      { id: 'c', name: 'Black Shorts', category: 'bottoms', color: 'black', imagePhash: hash },
    ],
    [
      {
        id: 'w1',
        name: 'Black Shorts',
        category: 'bottoms',
        color: 'black',
        origin: 'owned',
        imagePhash: hash,
      },
    ],
  );
  assert.equal(unique.length, 0);
  assert.ok(dropped.length >= 2);
  console.log('✓ partition: batch + wardrobe via hash');
}

{
  const { unique, dropped } = partitionDigitizeCandidates(
    [
      {
        id: 'a',
        name: 'Grey Jacket',
        category: 'outerwear',
        scanSessionId: 'scan_1',
        sourceCropId: 'crop_x',
      },
      {
        id: 'b',
        name: 'Formal Outerwear',
        category: 'formal',
        scanSessionId: 'scan_1',
        sourceCropId: 'crop_x',
      },
    ],
    [],
  );
  assert.equal(unique.length, 1);
  assert.equal(dropped.length, 1);
  console.log('✓ partition: same crop+session across label drift');
}

{
  const { unique, dropped } = partitionDigitizeCandidates(
    [
      {
        id: 'shirt',
        name: 'Shirt',
        category: 'tops',
        sourceImageId: 'photo_flat',
        sourceCropId: 'crop_shirt',
        cropId: 'crop_shirt',
      },
      {
        id: 'trousers',
        name: 'Trousers',
        category: 'bottoms',
        sourceImageId: 'photo_flat',
        sourceCropId: 'crop_trousers',
        cropId: 'crop_trousers',
      },
    ],
    [],
  );
  assert.equal(unique.length, 2);
  assert.equal(dropped.length, 0);
  console.log('✓ partition: shirt+trousers from one photo stay distinct');
}

{
  const near = 'c0c0c0c0c0c0c0c0';
  const { unique, duplicates } = filterAgainstWardrobe(
    [{ id: 'n1', name: 'White Tee', category: 'tops', color: 'white', imagePhash: hexWithHammingDistance(near, 12) }],
    [{
      id: '1',
      name: 'White T-shirt',
      category: 'tops',
      color: 'white',
      origin: 'owned',
      imagePhash: near,
    }],
  );
  assert.equal(unique.length, 1, 'probable similar tees are not silently dropped');
  assert.equal(duplicates.length, 0);
  console.log('✓ probable similar tees stay unique (WARN, not silent skip)');
}

console.log('\nAll digitize dedup checks passed.\n');
