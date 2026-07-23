/**
 * Verify garment taxonomy classifier + subtype-aware clashes (mirrors server tests).
 * Run: npm run verify:garment-taxonomy
 */
import assert from 'assert';
import {
  classifyGarment,
  getGarmentDb,
  getGarmentBySubtype,
  resolveStyleProfileKey,
  scoreOutfitSubtypeCompatibility,
  scoreFootwearDirection,
  scoreStyleProfileBias,
} from '../utils/garmentTaxonomy';
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
const footwear = db.filter((g) => g.category === 'footwear');
assert.ok(db.length >= 55, `expected ≥55 subtypes, got ${db.length}`);
assert.ok(footwear.length >= 15, `expected ≥15 footwear subtypes, got ${footwear.length}`);

// Alias resolution
assert.equal(getGarmentBySubtype('dress_shoe')?.subtype, 'oxfords');
assert.equal(getGarmentBySubtype('loafer')?.subtype, 'loafers');
assert.equal(getGarmentBySubtype('sandals')?.subtype, 'leather_sandals');

// Classifier smoke
assert.equal(classifyGarment(item({ category: 'bottoms', name: 'Navy Tailored Shorts' })).subtype, 'tailored_shorts');
assert.equal(classifyGarment(item({ category: 'bottoms', name: 'Grey Sweat Shorts' })).subtype, 'athletic_shorts');
assert.equal(classifyGarment(item({ category: 'tops', name: 'White Oxford Shirt' })).subtype, 'oxford_shirt');
assert.equal(classifyGarment(item({ category: 'tops', name: 'Blue Button-Up Shirt' })).subtype, 'oxford_shirt');
assert.equal(classifyGarment(item({ category: 'outerwear', name: 'Grey Windowpane Blazer' })).subtype, 'blazer');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Hoka Clifton Runners' })).subtype, 'runner');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Salomon Trail Sneakers' })).subtype, 'runner');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'White Chunky Trainers', color: 'white' })).subtype, 'chunky_trainer');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'White Leather Low-Top Sneakers', color: 'white' })).subtype, 'minimal_sneaker');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Stan Smith Court Sneakers' })).subtype, 'minimal_sneaker');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Common Projects White Leather Low-Top' })).subtype, 'minimal_sneaker');
assert.equal(classifyGarment(item({ category: 'dresses', name: 'Black Slip Dress' })).subtype, 'slip_dress');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Black Stiletto Heels' })).subtype, 'stilettos');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Nude Block Heels' })).subtype, 'block_heels');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Brown Leather Loafers' })).subtype, 'loafers');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Black Oxford Shoes' })).subtype, 'oxfords');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Brown Derby Shoes' })).subtype, 'derby');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Black Chelsea Boots' })).subtype, 'chelsea_boots');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Desert Boots' })).subtype, 'chelsea_boots');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Doc Martens Combat Boots' })).subtype, 'combat_boots');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Pool Slides' })).subtype, 'slides');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Birkenstock Leather Sandals' })).subtype, 'leather_sandals');
assert.equal(classifyGarment(item({ category: 'shoes', name: 'Canvas Espadrilles' })).subtype, 'espadrilles');

// 1) tailored_shorts + oxford + loafer OK
const tailoredOk = [
  item({ category: 'bottoms', name: 'Navy Tailored Shorts' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'shoes', name: 'Brown Leather Loafers' }),
];
const tailoredClash = detectOutfitClashes(tailoredOk);
assert.ok(
  !tailoredClash || (tailoredClash.severity !== 'fatal' && tailoredClash.severity !== 'major'),
  `tailored shorts look should not hard-fail, got ${tailoredClash?.id}`,
);
assert.ok(isOutfitValid(tailoredOk), 'tailored_shorts+oxford+loafer must be valid');
assert.equal(classifyItem(tailoredOk[0]).isTailoredShorts, true);

// 2) athletic_shorts + blazer hard fail
const athleticFail = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Tee' }),
  item({ category: 'bottoms', name: 'Black Athletic Shorts' }),
  item({ category: 'shoes', name: 'White Trainers' }),
];
const athleticClash = detectAllOutfitClashes(athleticFail);
assert.ok(
  athleticClash.some((c) => c.id === 'athletic_shorts_blazer' || c.id === 'blazer_shorts'),
  `expected athletic_shorts+blazer clash, got ${athleticClash.map((c) => c.id)}`,
);
assert.ok(!isOutfitValid(athleticFail), 'athletic_shorts+blazer must fail hard validity');

// 3) blazer + chunky_trainer fail
const chunkyFail = [
  item({ category: 'outerwear', name: 'Grey Windowpane Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Khaki Chinos' }),
  item({ category: 'shoes', name: 'White Chunky Trainers', color: 'white' }),
];
const chunkyClash = detectAllOutfitClashes(chunkyFail);
assert.ok(
  chunkyClash.some((c) => c.id === 'blazer_chunky_trainers' || c.id === 'footwear_lane_mismatch'),
  `expected blazer_chunky_trainers, got ${chunkyClash.map((c) => c.id)}`,
);
assert.ok(!isOutfitValid(chunkyFail), 'blazer+chunky must fail');
const chunkyScore = scoreOutfitSubtypeCompatibility(chunkyFail);
assert.ok(chunkyScore.adjustment < 0, 'chunky+blazer soft score should be low');

// 4) blazer + minimal_sneaker + chinos OK
const softOk = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Khaki Chinos' }),
  item({ category: 'shoes', name: 'White Leather Sneakers', color: 'white' }),
];
assert.ok(isOutfitValid(softOk), 'blazer+minimal_sneaker+chinos must be valid');
const softClashes = detectAllOutfitClashes(softOk);
assert.ok(
  !softClashes.some((c) => c.severity === 'fatal' || c.severity === 'major'),
  `soft path should not major-clash, got ${softClashes.map((c) => c.id)}`,
);

// 5) chelsea + blazer + trousers high
const chelseaOk = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Grey Tailored Trousers' }),
  item({ category: 'shoes', name: 'Black Chelsea Boots' }),
];
assert.ok(isOutfitValid(chelseaOk), 'chelsea+blazer+trousers must be valid');
const chelseaDir = scoreFootwearDirection(chelseaOk);
assert.ok(
  chelseaDir.adjustment >= 0 || chelseaDir.signals.some((s) => s.id === 'footwear_anchor_ok'),
  'chelsea should anchor tailored positively',
);
const chelseaPair = scoreOutfitSubtypeCompatibility(chelseaOk);
assert.ok(chelseaPair.adjustment > chunkyScore.adjustment, 'chelsea look should score higher than chunky+blazer');

// 6) slip_dress + stilettos OK
const slipHeels = [
  item({ category: 'dresses', name: 'Black Slip Dress' }),
  item({ category: 'shoes', name: 'Black Stiletto Heels' }),
];
assert.ok(isOutfitValid(slipHeels), 'slip_dress+stilettos must be valid');
const slipHeelsClash = detectOutfitClashes(slipHeels);
assert.ok(
  !slipHeelsClash || (slipHeelsClash.severity !== 'fatal' && slipHeelsClash.severity !== 'major'),
  `slip+stilettos should not hard-fail, got ${slipHeelsClash?.id}`,
);

// 7) slip_dress + chunky_trainer fail
const slipChunky = [
  item({ category: 'dresses', name: 'Black Slip Dress' }),
  item({ category: 'shoes', name: 'White Chunky Trainers', color: 'white' }),
];
const slipChunkyClash = detectAllOutfitClashes(slipChunky);
assert.ok(
  slipChunkyClash.some((c) => c.id === 'slip_dress_chunky_trainer' || c.id === 'footwear_lane_mismatch'),
  `expected slip_dress_chunky_trainer, got ${slipChunkyClash.map((c) => c.id)}`,
);
assert.ok(!isOutfitValid(slipChunky), 'slip_dress+chunky must fail');

// 8) slip_dress + combat fail
const slipCombat = [
  item({ category: 'dresses', name: 'Black Slip Dress' }),
  item({ category: 'shoes', name: 'Black Combat Boots' }),
];
assert.ok(!isOutfitValid(slipCombat), 'slip_dress+combat must fail');
assert.ok(
  detectAllOutfitClashes(slipCombat).some((c) => c.id === 'slip_dress_combat_boots' || c.id === 'footwear_lane_mismatch'),
  'expected slip_dress_combat_boots',
);

// 9) oxfords + suit OK
const oxfordSuit = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Navy Suit Trousers' }),
  item({ category: 'shoes', name: 'Black Oxford Shoes' }),
];
assert.ok(isOutfitValid(oxfordSuit), 'oxfords+suit must be valid');

// 10) slides + blazer fail
const slidesBlazer = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Khaki Chinos' }),
  item({ category: 'shoes', name: 'Black Pool Slides' }),
];
assert.ok(!isOutfitValid(slidesBlazer), 'slides+blazer must fail');
assert.ok(
  detectAllOutfitClashes(slidesBlazer).some((c) => c.id === 'blazer_slides' || c.id === 'footwear_lane_mismatch'),
  'expected blazer_slides',
);

// 11) leather_sandals + linen OK
const sandalLinen = [
  item({ category: 'tops', name: 'Beige Linen Shirt' }),
  item({ category: 'bottoms', name: 'Beige Linen Shorts' }),
  item({ category: 'shoes', name: 'Brown Leather Sandals' }),
];
assert.ok(isOutfitValid(sandalLinen), 'leather_sandals+linen must be valid');

// Soft pairing / profile
const pair = scoreOutfitSubtypeCompatibility(tailoredOk);
assert.ok(typeof pair.adjustment === 'number');
assert.equal(resolveStyleProfileKey({ stylePreference: 'luxury' }), 'LUXURY');
assert.equal(resolveStyleProfileKey({ lifestyle: 'minimalist' }), 'MINIMALIST');
const bias = scoreStyleProfileBias(softOk, { stylePreference: 'luxury' });
assert.ok(bias.profile === 'LUXURY');
assert.ok(bias.adjustment > 0, 'luxury profile should bonus blazer/oxford');

// Occasion lock
const formalSlides = detectAllOutfitClashes(slidesBlazer, { occasion: 'formal' });
assert.ok(
  formalSlides.some((c) => c.id === 'occasion_footwear_lock' || c.id === 'blazer_slides'),
  'formal occasion should lock low-formality footwear',
);

console.log(`verify-garment-taxonomy: passed (${db.length} subtypes, ${footwear.length} footwear).`);
