/**
 * Client wardrobe dedupe contract + D1–D25 matrix.
 * Run: npx --yes tsx utils/wardrobeDuplicateMatch.test.ts
 *
 * LAUNCH CONTRACT v2 (frozen with Dripn-Server):
 *   1. same-source scan  2. perceptual image  3. garment identity support  4. colour/material support
 */
import assert from 'assert';
import {
  attributeSimilarity,
  categoriesCompatible,
  decisionFromLocalMatches,
  DEDUPE_COPY,
  DHASH_AMBIGUOUS_MAX,
  dhashToImageSimilarity,
  findLocalWardrobeDuplicates,
  findLocalWithinBatchDuplicates,
  formatDuplicateNames,
  garmentFamily,
  hasDedupeOverride,
  hexWithHammingDistance,
  hammingDistanceHex,
  IMAGE_SIM_HARD,
  IMAGE_SIM_PROBABLE,
  CLIP_HARD,
  CLIP_POSSIBLE,
  LAUNCH_DEDUPE_CONTRACT,
  normalizeDuplicateDecision,
  shouldSuppressClipSimilarItemWarning,
  nameSuggestsGraphicDetail,
  namesGraphicPlainConflict,
  sameScanExactCrop,
  sameSourceDifferentCrop,
  scoreLocalDuplicateMatch,
} from './wardrobeDuplicateMatch.ts';

function assertEq(actual: unknown, expected: unknown, message: string) {
  assert.strictEqual(actual, expected, `${message} (got ${actual}, expected ${expected})`);
}

console.log('=== Client wardrobe duplicate match ===\n');

{
  assert.deepStrictEqual(
    [...LAUNCH_DEDUPE_CONTRACT.priority],
    [
      'same_source_scan',
      'clip_visual_embedding',
      'structural_garment_type',
      'dhash_near_identical_only',
      'colour_material_brand_support',
      'semantic_appearance_support_only',
    ],
  );
  assertEq(LAUNCH_DEDUPE_CONTRACT.imageSimHard, IMAGE_SIM_HARD, 'hard threshold');
  assertEq(LAUNCH_DEDUPE_CONTRACT.clipHard, CLIP_HARD, 'clip hard');
  assertEq(LAUNCH_DEDUPE_CONTRACT.neverMergeOnNameOnly, true, 'no name merge');
  assertEq(LAUNCH_DEDUPE_CONTRACT.neverSubstringCategory, true, 'no substring category');
  assertEq(LAUNCH_DEDUPE_CONTRACT.neverClipAloneHard, true, 'never clip alone');
  assertEq(garmentFamily('formal'), 'outerwear', 'formal family');
  assertEq(garmentFamily('shoes'), 'footwear', 'shoes family');
  assertEq(categoriesCompatible('outerwear', 'formal'), true, 'blazer/jacket family');
  assertEq(categoriesCompatible('outerwear', 'bottoms'), false, 'blazer vs trousers');
  console.log('✓ launch contract freeze');
}

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
    { name: 'Plain Black Tee', category: 'tops', color: 'black', subcategory: 't-shirt' },
    { name: 'Black Graphic Band Tee', category: 'tops', color: 'black', subcategory: 't-shirt' },
  );
  assert.ok(score < 0.82, `two black tees should not soft-block (got ${score})`);
  console.log('✓ two black tees not blocked');
}

{
  assert.strictEqual(formatDuplicateNames([{ name: 'A' }, { name: 'B' }]), 'A and B');
  const conflict = normalizeDuplicateDecision({
    type: 'classification_conflict',
    isDuplicate: true,
    matches: [{ id: 8, name: 'Shoes' }],
  });
  assertEq(conflict.type, 'classification_conflict', 'conflict type');
  assertEq(conflict.isDuplicate, true, 'conflict is duplicate');
  console.log('✓ format + classification_conflict normalize');
}

{
  assert.ok(nameSuggestsGraphicDetail('Nike HWPO Graphic Tee'), 'hwpo/graphic detail');
  assert.ok(!nameSuggestsGraphicDetail('White Tee'), 'plain generic tee');
  assert.ok(namesGraphicPlainConflict('Nike HWPO Graphic Tee', 'H&M White Tee'), 'graphic vs plain');
  assert.ok(!namesGraphicPlainConflict('Nike HWPO Graphic Tee', 'Nike HWPO Graphic Tee'), 'same graphic tee');

  assert.ok(
    shouldSuppressClipSimilarItemWarning(
      { name: 'Nike HWPO Graphic Tee', category: 'tops', brand: 'Nike', color: 'white' },
      { id: 1, name: 'H&M White Tee', category: 'tops', brand: 'H&M', color: 'white' },
    ),
    'Nike HWPO vs H&M plain suppresses similar_item',
  );
  assert.ok(
    !shouldSuppressClipSimilarItemWarning(
      { name: 'Nike HWPO Graphic Tee', category: 'tops', brand: 'Nike', color: 'white' },
      { id: 1, name: 'Nike HWPO Graphic Tee', category: 'tops', brand: 'Nike', color: 'white' },
    ),
    'same SKU re-photo keeps similar_item',
  );

  const suppressed = normalizeDuplicateDecision({
    type: 'similar_item',
    similarMatches: [{ id: 2, name: 'H&M White Tee', brand: 'H&M', category: 'tops' }],
    candidate: { name: 'Nike HWPO Graphic Tee', brand: 'Nike', category: 'tops', color: 'white' },
  });
  assertEq(suppressed.type, 'ok', 'CLIP false positive downgraded to ok');

  const kept = normalizeDuplicateDecision({
    type: 'similar_item',
    similarMatches: [{ id: 3, name: 'Grey Blazer', brand: 'Cavani', category: 'outerwear', color: 'grey' }],
    candidate: { name: 'Navy Blazer', brand: 'Cavani', category: 'outerwear', color: 'navy' },
  });
  assertEq(kept.type, 'similar_item', 'same-brand colour conflict still warns');

  const hardDupe = normalizeDuplicateDecision({
    type: 'duplicate',
    isDuplicate: true,
    matches: [{ id: 4, name: 'Grey Blazer', category: 'outerwear' }],
    candidate: { name: 'Different label', brand: 'Other', category: 'outerwear' },
  });
  assertEq(hardDupe.type, 'duplicate', 'hard duplicate unchanged by guard');
  console.log('✓ CLIP similar_item client guard');
}

console.log('\n--- Launch wardrobe dedupe matrix D1–D25 ---\n');

const SAME = 'c0c0c0c0c0c0c0c0';
const OTHER = '1f1f1f1f1f1f1f1f';
assert.ok(hammingDistanceHex(SAME, OTHER) > DHASH_AMBIGUOUS_MAX);

function d(
  id: string,
  scored: ReturnType<typeof scoreLocalDuplicateMatch>,
  { block = null, warn = null, allow = null, tier = null, reason = null }: {
    block?: boolean | null;
    warn?: boolean | null;
    allow?: boolean | null;
    tier?: string | null;
    reason?: string | null;
  },
) {
  if (block === true) {
    assertEq(scored.isDuplicate, true, `${id} must BLOCK`);
    assert.ok(scored.type === 'duplicate' || scored.type === 'classification_conflict', `${id} tier ${scored.type}`);
  }
  if (warn === true) {
    assertEq(scored.type, 'similar_item', `${id} must WARN`);
    assertEq(scored.isDuplicate, false, `${id} warn is not a hard block`);
  }
  if (allow === true) {
    assertEq(scored.isDuplicate, false, `${id} must ALLOW`);
    assertEq(scored.type, 'ok', `${id} allow`);
  }
  if (tier) assertEq(scored.type, tier, `${id} tier`);
  if (reason) assertEq(scored.reason, reason, `${id} reason`);
}

d('D1', scoreLocalDuplicateMatch(
  { name: 'Cavani Grey Blazer', category: 'outerwear', imagePhash: SAME },
  { name: 'Cavani Grey Blazer', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D1 exact same image twice → BLOCK');

{
  const a = { name: 'Grey Jacket', category: 'outerwear', sourceImageId: 'photo_1', cropId: 'crop_a' };
  const b = { name: 'Formal Outerwear', category: 'formal', sourceImageId: 'photo_1', cropId: 'crop_a' };
  assertEq(sameScanExactCrop(a, b), true, 'D2 exact crop');
  d('D2', scoreLocalDuplicateMatch(a, b), { block: true, reason: 'same_scan_exact_crop' });
  console.log('✓ D2 exact same crop from same scan → BLOCK');
}

{
  const angled = hexWithHammingDistance(SAME, 11);
  const scored = scoreLocalDuplicateMatch(
    { name: 'Grey Jacket', category: 'outerwear', imagePhash: angled },
    { name: 'Cavani Grey Blazer', category: 'formal', imagePhash: SAME },
  );
  d('D3', scored, { allow: true, reason: 'distinct_image' });
  assert.ok(scored.imageSimilarity != null && scored.imageSimilarity >= IMAGE_SIM_PROBABLE && scored.imageSimilarity < IMAGE_SIM_HARD, 'D3 dHash mid-band');
  console.log('✓ D3 slight angle without CLIP → ALLOW (CLIP gates possible)');
}

d('D4', scoreLocalDuplicateMatch(
  { name: 'Grey Blazer', category: 'outerwear', imagePhash: hexWithHammingDistance(SAME, 6) },
  { name: 'Grey Blazer', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D4 lighting change → BLOCK');

d('D5', scoreLocalDuplicateMatch(
  { name: 'Grey Blazer', category: 'outerwear', imagePhash: hexWithHammingDistance(SAME, 4) },
  { name: 'Grey Blazer', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D5 rembg vs original → BLOCK');

d('D6', scoreLocalDuplicateMatch(
  { name: 'Jacket', category: 'outerwear', imagePhash: SAME },
  { name: 'Blazer', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D6 jacket vs blazer same image → BLOCK');

d('D7', scoreLocalDuplicateMatch(
  { name: 'Blazer', category: 'formal', imagePhash: SAME },
  { name: 'Outerwear', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D7 blazer vs outerwear same image → BLOCK');

{
  const scored = scoreLocalDuplicateMatch(
    { name: 'Blazer', category: 'outerwear', imagePhash: SAME },
    { name: 'Dress shoes', category: 'shoes', imagePhash: SAME },
  );
  d('D8', scored, { block: true, tier: 'classification_conflict' });
  assertEq(scored.message, DEDUPE_COPY.conflict, 'D8 copy');
  console.log('✓ D8 blazer vs shoes same image → classification conflict');
}

d('D9', scoreLocalDuplicateMatch(
  { name: 'Grey Blazer', category: 'outerwear', color: 'grey', imagePhash: SAME },
  { name: 'Charcoal Blazer', category: 'outerwear', color: 'charcoal', imagePhash: SAME },
), { block: true });
console.log('✓ D9 grey vs charcoal → BLOCK');

d('D10', scoreLocalDuplicateMatch(
  { name: 'Grey Blazer', category: 'outerwear', color: 'grey', imagePhash: SAME },
  { name: 'Navy Blazer', category: 'outerwear', color: 'navy', imagePhash: SAME },
), { warn: true });
console.log('✓ D10 grey vs navy strong image → WARN');

d('D11', scoreLocalDuplicateMatch(
  { name: 'Shirt', category: 'tops', material: 'cotton', imagePhash: SAME },
  { name: 'Shirt', category: 'tops', material: 'linen', imagePhash: SAME },
), { warn: true });
console.log('✓ D11 cotton vs linen same image → WARN');

d('D12', scoreLocalDuplicateMatch(
  { name: 'Athletic shorts', category: 'activewear_bottoms', imagePhash: hexWithHammingDistance(SAME, 12) },
  { name: 'Sweat shorts', category: 'bottoms', imagePhash: SAME },
), { allow: true });
console.log('✓ D12 athletic vs sweat shorts mid-band without CLIP → ALLOW');

{
  const shirt = { name: 'Shirt', category: 'tops', sourceImageId: 'photo_flat', cropId: 'crop_shirt' };
  const trousers = { name: 'Trousers', category: 'bottoms', sourceImageId: 'photo_flat', cropId: 'crop_trousers' };
  assertEq(sameSourceDifferentCrop(shirt, trousers), true, 'D13 different crops');
  d('D13', scoreLocalDuplicateMatch(shirt, trousers), { allow: true, reason: 'same_source_different_crop' });
  console.log('✓ D13 shirt+trousers from one photo → SAVE BOTH');
}

d('D14', scoreLocalDuplicateMatch(
  { name: 'Belt', category: 'accessories', sourceImageId: 'photo_flat', cropId: 'crop_1' },
  { name: 'Watch', category: 'accessories', sourceImageId: 'photo_flat', cropId: 'crop_2' },
), { allow: true });
console.log('✓ D14 same-session different crops → SAVE BOTH');

d('D15', scoreLocalDuplicateMatch(
  { name: 'Shirt', category: 'tops', sourceImageId: 'photo_flat', cropId: 'crop_shirt' },
  { name: 'Light gray Top', category: 'tops', sourceImageId: 'photo_flat', cropId: 'crop_shirt' },
), { block: true, reason: 'same_scan_exact_crop' });
console.log('✓ D15 same crop twice → BLOCK');

d('D16', scoreLocalDuplicateMatch(
  { name: 'Grey Blazer', category: 'outerwear', color: 'grey', imagePhash: SAME },
  { name: 'Grey Blazer', category: 'outerwear', color: 'grey', imagePhash: OTHER },
), { allow: true });
console.log('✓ D16 two different grey blazers → SAVE BOTH');

d('D17', scoreLocalDuplicateMatch(
  { name: 'White Tee', category: 'tops', color: 'white', imagePhash: hexWithHammingDistance(SAME, 12) },
  { name: 'White T-shirt', category: 'tops', color: 'white', imagePhash: SAME },
), { allow: true });
console.log('✓ D17 two white tees mid-band without CLIP → ALLOW');

d('D18', scoreLocalDuplicateMatch(
  { name: 'Nike Air Force 1', category: 'shoes', brand: 'Nike', imagePhash: hexWithHammingDistance(SAME, 12) },
  { name: 'Nike Air Force 1', category: 'shoes', brand: 'Nike', imagePhash: SAME },
), { allow: true });
console.log('✓ D18 same-SKU Nike trainers mid-band without CLIP → ALLOW');

d('D19', scoreLocalDuplicateMatch(
  { name: 'Black Hoodie', category: 'tops', imagePhash: SAME },
  { name: 'Black Hoodie', category: 'tops', imagePhash: OTHER },
), { allow: true });
console.log('✓ D19 same name different images → SAVE BOTH');

d('D20', scoreLocalDuplicateMatch(
  { name: 'Cavani grey blazer', category: 'outerwear', imagePhash: SAME },
  { name: 'grey jacket', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D20 different name near-identical image → BLOCK');

d('D21', scoreLocalDuplicateMatch(
  { name: 'Oxford shirt', category: 'tops', imagePhash: hexWithHammingDistance(SAME, 13) },
  { name: 'Oxford shirt', category: 'tops', imagePhash: SAME },
), { allow: true });
console.log('✓ D21 folded vs hanging mid-band without CLIP → ALLOW');

d('D22', scoreLocalDuplicateMatch(
  { name: 'Coat', category: 'outerwear', imagePhash: hexWithHammingDistance(SAME, 16) },
  { name: 'Coat', category: 'outerwear', imagePhash: SAME },
), { allow: true });
console.log('✓ D22 coat angle mid-band without CLIP → ALLOW');
d('D22-strong', scoreLocalDuplicateMatch(
  { name: 'Coat', category: 'outerwear', imagePhash: hexWithHammingDistance(SAME, 2) },
  { name: 'Coat', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D22-strong near-identical → BLOCK');

d('D23', scoreLocalDuplicateMatch(
  { name: 'Blazer', category: 'outerwear', imagePhash: hexWithHammingDistance(SAME, 2) },
  { name: 'Blazer', category: 'outerwear', imagePhash: SAME },
), { block: true });
console.log('✓ D23 resized/compressed → BLOCK');

d('D24', scoreLocalDuplicateMatch(
  { name: 'Black Hoodie', category: 'tops', color: 'black', brand: 'Nike', imagePhash: SAME },
  { name: 'Black Hoodie', category: 'tops', color: 'black', brand: 'Adidas', imagePhash: OTHER },
), { allow: true });
console.log('✓ D24 two black hoodies different brands → SAVE BOTH');

d('D25', scoreLocalDuplicateMatch(
  { name: 'Gap striped shirt', category: 'tops', brand: 'Gap', imagePhash: SAME },
  { name: 'Gap striped shirt', category: 'tops', brand: 'Gap', imagePhash: OTHER },
), { allow: true });
console.log('✓ D25 two Gap striped shirts different pattern → SAVE BOTH');

{
  const scored = scoreLocalDuplicateMatch(
    { name: 'Item', category: 'outerwear', id: 'new', dedupeOverrideAgainst: ['42'] },
    { name: 'Item', category: 'outerwear', id: 42, imagePhash: SAME },
  );
  assertEq(hasDedupeOverride({ dedupeOverrideAgainst: ['42'] }, { id: 42 }), true, 'override detected');
  d('override', scored, { allow: true, reason: 'user_override' });
  assert.ok(dhashToImageSimilarity(0)! >= IMAGE_SIM_HARD);
  assert.ok(dhashToImageSimilarity(11)! < IMAGE_SIM_HARD && dhashToImageSimilarity(11)! >= IMAGE_SIM_PROBABLE);
  console.log('✓ user override + dHash mapping');
}

{
  const hash = 'aaaaaaaaaaaaaaaa';
  const matches = findLocalWardrobeDuplicates(
    { name: 'Grey Jacket', category: 'outerwear', imagePhash: hash },
    [
      { id: '1', name: 'Cavani Grey Blazer', category: 'outerwear', origin: 'owned', imagePhash: hash },
      { id: '2', name: 'White Sneakers', category: 'shoes', origin: 'owned', imagePhash: '0123456789abcdef' },
    ],
  );
  assertEq(matches.length, 1, 'one hash hit');
  const decision = decisionFromLocalMatches(matches);
  assertEq(decision.type, 'duplicate', 'local decision');
  const batch = findLocalWithinBatchDuplicates([
    { id: 'a', name: 'Shirt', category: 'tops', sourceImageId: 'photo_flat', cropId: 'crop_shirt' },
    { id: 'b', name: 'Trousers', category: 'bottoms', sourceImageId: 'photo_flat', cropId: 'crop_trousers' },
    { id: 'c', name: 'Shirt again', category: 'tops', sourceImageId: 'photo_flat', cropId: 'crop_shirt' },
  ]);
  assertEq(batch[1].matches.length, 0, 'D13 batch keeps shirt+trousers');
  assert.ok(batch[2].matches.length >= 1, 'D15 batch flags same crop');
  console.log('✓ local find + batch D13/D15');
}

console.log('\nAll client wardrobe duplicate tests passed.');
