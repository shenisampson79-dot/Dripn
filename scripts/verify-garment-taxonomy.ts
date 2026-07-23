/**
 * Verify garment taxonomy classifier + subtype-aware clashes (mirrors server tests).
 * Run: npx tsx scripts/verify-garment-taxonomy.ts
 */
import assert from 'assert';
import { classifyGarment, getGarmentDb, resolveStyleProfileKey } from '../utils/garmentTaxonomy';
import {
  classifyItem,
  detectAllOutfitClashes,
  detectOutfitClashes,
  isOutfitValid,
} from '../utils/outfitClashRules';
import type { WardrobeItem } from '../contexts/WardrobeContext';

function item(partial: Partial<WardrobeItem> & { name: string; category: WardrobeItem['category'] }): WardrobeItem {
  return {
    id: partial.id || Math.random().toString(36).slice(2, 8),
    seasons: ['summer'],
    occasions: ['casual'],
    color: partial.color || 'navy',
    ...partial,
  } as WardrobeItem;
}

const db = getGarmentDb();
assert.ok(db.length >= 40, `expected ≥40 subtypes, got ${db.length}`);

assert.equal(classifyGarment(item({ category: 'bottoms', name: 'Navy Tailored Shorts' })).subtype, 'tailored_shorts');
assert.equal(classifyGarment(item({ category: 'bottoms', name: 'Grey Sweat Shorts' })).subtype, 'athletic_shorts');
assert.equal(classifyGarment(item({ category: 'tops', name: 'White Oxford Shirt' })).subtype, 'oxford_shirt');
assert.equal(classifyGarment(item({ category: 'outerwear', name: 'Grey Windowpane Blazer' })).subtype, 'blazer');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Hoka Clifton Runners' })).subtype, 'chunky_trainer');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'White Leather Low-Top Sneakers', color: 'white' })).subtype, 'minimal_sneaker');
assert.equal(classifyGarment(item({ category: 'dresses', name: 'Black Slip Dress' })).subtype, 'slip_dress');

const tailoredOk = [
  item({ category: 'bottoms', name: 'Navy Tailored Shorts' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'shoes', name: 'Brown Leather Loafers' }),
];
assert.ok(isOutfitValid(tailoredOk), 'tailored_shorts+oxford+loafer must be valid');
assert.equal(classifyItem(tailoredOk[0]).isTailoredShorts, true);

const athleticFail = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Tee' }),
  item({ category: 'bottoms', name: 'Black Athletic Shorts' }),
  item({ category: 'shoes', name: 'White Trainers' }),
];
assert.ok(!isOutfitValid(athleticFail), 'athletic_shorts+blazer must fail');
assert.ok(
  detectAllOutfitClashes(athleticFail).some((c) => c.id === 'athletic_shorts_blazer' || c.id === 'blazer_shorts'),
);

const chunkyFail = [
  item({ category: 'outerwear', name: 'Grey Windowpane Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Khaki Chinos' }),
  item({ category: 'shoes', name: 'White Chunky Trainers', color: 'white' }),
];
assert.ok(!isOutfitValid(chunkyFail));
assert.ok(detectAllOutfitClashes(chunkyFail).some((c) => c.id === 'blazer_chunky_trainers'));

const softOk = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Khaki Chinos' }),
  item({ category: 'shoes', name: 'White Leather Sneakers', color: 'white' }),
];
assert.ok(isOutfitValid(softOk));

const slipHeels = [
  item({ category: 'dresses', name: 'Black Slip Dress' }),
  item({ category: 'shoes', name: 'Black Heels' }),
];
assert.ok(isOutfitValid(slipHeels));
const slipHeelsClash = detectOutfitClashes(slipHeels);
assert.ok(!slipHeelsClash || (slipHeelsClash.severity !== 'fatal' && slipHeelsClash.severity !== 'major'));

const slipChunky = [
  item({ category: 'dresses', name: 'Black Slip Dress' }),
  item({ category: 'shoes', name: 'White Chunky Trainers', color: 'white' }),
];
assert.ok(!isOutfitValid(slipChunky));
assert.ok(detectAllOutfitClashes(slipChunky).some((c) => c.id === 'slip_dress_chunky_trainer'));

assert.equal(resolveStyleProfileKey({ stylePreference: 'luxury' }), 'LUXURY');

console.log(`verify-garment-taxonomy: passed (${db.length} subtypes)`);
