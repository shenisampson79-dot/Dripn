/**
 * Client wardrobe duplicate attribute heuristics.
 * Run: npx --yes tsx utils/wardrobeDuplicateMatch.test.ts
 * or: node --experimental-strip-types utils/wardrobeDuplicateMatch.test.ts (Node 22+)
 */
import assert from 'assert';
import {
  attributeSimilarity,
  findLocalWardrobeDuplicates,
  formatDuplicateNames,
} from './wardrobeDuplicateMatch.ts';

console.log('=== Client wardrobe duplicate match ===\n');

{
  const score = attributeSimilarity(
    { name: 'Black Leather Jacket', category: 'outerwear', color: 'black' },
    { name: 'Black Leather Jacket', category: 'outerwear', color: 'black' },
  );
  assert.ok(score >= 0.82, `exact name should match (got ${score})`);
  console.log('✓ exact name+category');
}

{
  const score = attributeSimilarity(
    { name: 'Plain Black Tee', category: 'tops', color: 'black' },
    { name: 'Black Graphic Band Tee', category: 'tops', color: 'black' },
  );
  assert.ok(score < 0.82, `two black tees should not soft-block (got ${score})`);
  console.log('✓ two black tees not blocked');
}

{
  const matches = findLocalWardrobeDuplicates(
    { name: 'Tan Trench Coat', category: 'outerwear', color: 'tan', brand: 'Burberry' },
    [
      {
        id: '1',
        name: 'Tan Trench Coat',
        category: 'outerwear',
        color: 'tan',
        brand: 'Burberry',
        origin: 'owned',
      },
      {
        id: '2',
        name: 'White Sneakers',
        category: 'shoes',
        color: 'white',
        origin: 'owned',
      },
    ],
  );
  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].id, '1');
  console.log('✓ findLocalWardrobeDuplicates');
}

{
  assert.strictEqual(formatDuplicateNames([{ name: 'A' }]), 'A');
  assert.strictEqual(formatDuplicateNames([{ name: 'A' }, { name: 'B' }]), 'A and B');
  console.log('✓ formatDuplicateNames');
}

console.log('\nAll client wardrobe duplicate tests passed.');
