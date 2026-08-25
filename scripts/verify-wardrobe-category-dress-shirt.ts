/**
 * Dress shirt must never normalize to dresses (Outfit 2 / item-142 class).
 * Run: npx tsx scripts/verify-wardrobe-category-dress-shirt.ts
 */
import assert from 'assert';
import { normalizeWardrobeCategory } from '../utils/wardrobeCategories';

assert.equal(
  normalizeWardrobeCategory('dresses', {
    name: 'Charles Tyrwhitt Slim Fit Dress Shirt',
    subcategory: 'dress_shirt',
  }),
  'tops',
  'legacy dresses + dress shirt → tops',
);

assert.equal(
  normalizeWardrobeCategory('tops', {
    name: 'Pink Dress Shirt',
    subcategory: 'dress_shirt',
  }),
  'tops',
);

assert.equal(
  normalizeWardrobeCategory('dresses', {
    name: 'Cream Short-sleeve Button-up Shirt',
    subcategory: 'shirt',
  }),
  'tops',
);

assert.equal(
  normalizeWardrobeCategory('tops', {
    name: 'Black Midi Dress',
    subcategory: 'midi_dress',
  }),
  'dresses',
  'true dresses still map to dresses',
);

assert.equal(
  normalizeWardrobeCategory('dresses', {
    name: 'Black Evening Gown',
    subcategory: 'gown',
  }),
  'dresses',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      dressShirtFromDresses: 'tops',
      midiDress: 'dresses',
    },
    null,
    2,
  ),
);
console.log('verify-wardrobe-category-dress-shirt: PASS');
