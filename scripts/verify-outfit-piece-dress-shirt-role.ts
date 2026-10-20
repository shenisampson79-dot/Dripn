/**
 * Dress-shirt display role + collage slot (Event / Ask Stylist).
 * Shirt-dress / shirtdress stays a dress. Does not mutate wardrobe records.
 * Run: node --experimental-strip-types scripts/verify-outfit-piece-dress-shirt-role.ts
 */
import assert from 'assert';
import { formatOutfitPieceRoleLabel } from '../utils/outfitPieceRoleLabel.ts';
import { getOutfitPieceSlot } from '../utils/outfitVisualSlotResolve.ts';

function assertTops(role: string, name: string, label: string) {
  assert.equal(formatOutfitPieceRoleLabel(role, { name, category: 'dresses' }), 'Tops', label);
  assert.equal(getOutfitPieceSlot({ role, category: 'dresses', name }), 'top', `${label} slot`);
}

function assertDresses(role: string, name: string, label: string) {
  assert.equal(formatOutfitPieceRoleLabel(role, { name, category: 'dresses' }), 'Dresses', label);
  assert.equal(getOutfitPieceSlot({ role, category: 'dresses', name }), 'dress', `${label} slot`);
}

const SCREENSHOT_SHIRT = 'charles tyrwhitt light pink dress shirt';

assertTops('dresses', SCREENSHOT_SHIRT, 'screenshot dress shirt');
assertTops('dresses', 'white dress shirt', 'dress shirt');
assertTops('dresses', 'white dress-shirt', 'dress-shirt');
assertTops('dresses', 'white dressshirt', 'dressshirt');
assertTops('dress', 'navy dress shirt', 'singular dress role + dress shirt');

assertDresses('dresses', 'navy shirt dress', 'shirt dress');
assertDresses('dresses', 'navy shirt-dress', 'shirt-dress');
assertDresses('dresses', 'navy shirtdress', 'shirtdress');

assert.equal(
  getOutfitPieceSlot({ role: 'dresses', category: 'tops', name: 'navy shirtdress' }),
  'dress',
  'role dresses / category tops + shirtdress → dress',
);
assert.equal(
  formatOutfitPieceRoleLabel('dresses', { name: 'navy shirtdress', category: 'tops' }),
  'Dresses',
  'role dresses / category tops + shirtdress label',
);
assert.equal(
  getOutfitPieceSlot({ role: 'top', category: 'dresses', name: 'navy shirt dress' }),
  'dress',
  'role top / category dresses + shirt dress → dress',
);
assert.equal(
  formatOutfitPieceRoleLabel('top', { name: 'navy shirt dress', category: 'dresses' }),
  'Dresses',
  'role top / category dresses + shirt dress label',
);

assert.equal(
  formatOutfitPieceRoleLabel('dresses', { name: 'Black Midi Dress', category: 'dresses' }),
  'Dresses',
  'genuine midi dress label stays Dresses',
);
assert.equal(
  getOutfitPieceSlot({ role: 'dresses', category: 'dresses', name: 'Black Midi Dress' }),
  'dress',
  'genuine midi dress slot',
);
assert.equal(
  getOutfitPieceSlot({ role: 'dress', category: 'dresses', name: 'Black Evening Gown' }),
  'dress',
  'gown stays dress slot',
);

assert.equal(
  getOutfitPieceSlot({ role: 'shoes', category: 'shoes', name: 'black dress shoes' }),
  'shoes',
  'dress shoes with shoes role',
);
assert.equal(
  getOutfitPieceSlot({ role: 'piece', name: 'black dress shoes' }),
  'shoes',
  'dress shoes inferred from name',
);
assert.equal(
  formatOutfitPieceRoleLabel('dresses', { name: 'black dress shoes', category: 'dresses' }),
  'Shoes',
  'mis-roled dress shoes label',
);
assert.equal(
  getOutfitPieceSlot({ role: 'dresses', category: 'dresses', name: 'black dress shoes' }),
  'shoes',
  'mis-roled dress shoes slot',
);

assert.equal(formatOutfitPieceRoleLabel('top', { name: 'white oxford shirt' }), 'Top');
assert.equal(getOutfitPieceSlot({ role: 'top', category: 'tops', name: 'white oxford shirt' }), 'top');
assert.equal(getOutfitPieceSlot({ role: 'shirt', name: 'blue shirt' }), 'top');

assert.equal(getOutfitPieceSlot({ role: 'outerwear', category: 'outerwear', name: 'navy blazer' }), 'outerwear');
assert.equal(getOutfitPieceSlot({ role: 'bottom', category: 'bottoms', name: 'chinos' }), 'bottom');
assert.equal(getOutfitPieceSlot({ role: 'accessory', category: 'accessories', name: 'leather belt' }), 'accessory');
assert.equal(formatOutfitPieceRoleLabel('outerwear'), 'Outerwear');
assert.equal(formatOutfitPieceRoleLabel('bottom'), 'Bottom');
assert.equal(formatOutfitPieceRoleLabel('shoes'), 'Shoes');

console.log(
  JSON.stringify(
    {
      ok: true,
      screenshotShirt: { label: 'Tops', slot: 'top' },
      dressShirtVariants: 'top',
      shirtDressVariants: 'dress',
      midiDress: { label: 'Dresses', slot: 'dress' },
      dressShoes: { slot: 'shoes' },
      oxford: { label: 'Top', slot: 'top' },
    },
    null,
    2,
  ),
);
console.log('verify-outfit-piece-dress-shirt-role: PASS');
