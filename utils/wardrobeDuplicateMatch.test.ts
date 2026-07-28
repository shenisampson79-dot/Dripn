/**
 * Client wardrobe duplicate attribute heuristics.
 * Run: npx --yes tsx utils/wardrobeDuplicateMatch.test.ts
 * or: node --experimental-strip-types utils/wardrobeDuplicateMatch.test.ts (Node 22+)
 */
import assert from 'assert';
import {
  attributeSimilarity,
  findLocalWardrobeDuplicates,
  findLocalWithinBatchDuplicates,
  formatDuplicateNames,
  normalizeDuplicateDecision,
} from './wardrobeDuplicateMatch.ts';

console.log('=== Client wardrobe duplicate match ===\n');

{
  const score = attributeSimilarity(
    { name: 'Light gray Top', category: 'tops', color: 'light gray' },
    { name: 'Light gray Top', category: 'tops', color: 'light gray' },
  );
  assert.ok(score < 0.82, `generic detector labels must not exact-dupe (got ${score})`);
  console.log('✓ generic Light gray Top not blocked');
}

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
    { name: 'Plain Black Tee', category: 'tops', color: 'black', subcategory: 't-shirt' },
    { name: 'Black Graphic Band Tee', category: 'tops', color: 'black', subcategory: 't-shirt' },
  );
  assert.ok(score < 0.82, `two black tees should not soft-block (got ${score})`);
  console.log('✓ two black tees not blocked');
}

{
  const score = attributeSimilarity(
    { name: 'Black Puffer Jacket', category: 'outerwear', color: 'black', subcategory: 'puffer' },
    { name: 'Black Wool Coat', category: 'outerwear', color: 'black', subcategory: 'wool coat' },
  );
  assert.ok(score < 0.82, `puffer vs wool should not soft-block (got ${score})`);
  console.log('✓ puffer vs wool coat not soft-blocked');
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

{
  const dupe = normalizeDuplicateDecision({
    type: 'duplicate',
    isDuplicate: true,
    matches: [{ id: 1, name: 'Jacket' }],
  });
  assert.strictEqual(dupe.type, 'duplicate');
  assert.strictEqual(dupe.isDuplicate, true);

  const similar = normalizeDuplicateDecision({
    type: 'similar_item',
    isDuplicate: false,
    similarMatches: [{ id: 2, name: 'Coat', message: 'Different fabric' }],
  });
  assert.strictEqual(similar.type, 'similar_item');
  assert.strictEqual(similar.isDuplicate, false);

  const owned = normalizeDuplicateDecision({
    type: 'already_owned',
    isDuplicate: true,
    matches: [{ id: 3, name: 'Parka' }],
  });
  assert.strictEqual(owned.type, 'already_owned');

  const batch = findLocalWithinBatchDuplicates([
    { id: 'a', name: 'Tan Trench Coat', category: 'outerwear', color: 'tan', brand: 'Burberry' },
    { id: 'b', name: 'Tan Trench Coat', category: 'outerwear', color: 'tan', brand: 'Burberry' },
    { id: 'c', name: 'White Tee', category: 'tops', color: 'white' },
  ]);
  assert.strictEqual(batch[0].matches.length, 0, 'keeps first occurrence');
  assert.ok(batch[1].matches.length >= 1, 'flags later duplicate only');
  assert.strictEqual(batch[2].matches.length, 0, 'unique item not flagged');
  console.log('✓ normalize + within-batch');
}

console.log('\nAll client wardrobe duplicate tests passed.');
