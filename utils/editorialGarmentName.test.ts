/**
 * Client mirror: editorial casing matrix (keep in sync with server test-editorial-garment-casing.mjs).
 * Run: npx tsx utils/editorialGarmentName.test.ts
 * or:  node --experimental-strip-types utils/editorialGarmentName.test.ts
 */
import assert from 'node:assert/strict';
import { editorialGarmentName, sanitizeWardrobeItemName, formatWardrobeItemDisplayName } from './wardrobeItemName.ts';

const MATRIX = [
  ['Nike White Leather Low-Top Trainers', 'Nike', 'Nike white leather low-top trainers'],
  ['Gap White And Light Blue Striped Button-Down Shirt', 'Gap', 'Gap white and light blue striped button-down shirt'],
  ['Next Black Coated Slim Trousers', 'Next', 'Next black coated slim trousers'],
  ['gap white striped shirt', 'Gap', 'Gap white striped shirt'],
  ['adidas Ultraboost Running Shoes', 'adidas', 'adidas ultraboost running shoes'],
  ['lululemon Align Leggings', 'lululemon', 'lululemon align leggings'],
  ['Black Running T-Shirt', undefined, 'black running t-shirt'],
] as const;

for (const [input, brand, expect] of MATRIX) {
  const got = editorialGarmentName(input, { brand: brand || null });
  assert.equal(got, expect, `${input} → ${got}`);
  assert.equal(sanitizeWardrobeItemName(input, { brand: brand || null }), expect);
}

{
  const missing = formatWardrobeItemDisplayName({
    name: 'null black long sleeve button-up shirt',
    brand: 'null',
    color: null,
  });
  assert.equal(missing, 'black long sleeve button-up shirt');
  assert.doesNotMatch(missing, /\bnull\b/i);
  const complete = formatWardrobeItemDisplayName({
    name: 'Gap White And Light Blue Striped Button-Down Shirt',
    brand: 'Gap',
    color: 'white',
  });
  assert.equal(complete, 'Gap white and light blue striped button-down shirt');
}

console.log(`editorial garment casing matrix: ${MATRIX.length} cases passed`);
