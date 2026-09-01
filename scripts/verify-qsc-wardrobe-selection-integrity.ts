/**
 * QSC evaluate_outfit: visible selection must equal submitted IDs/images.
 * Run: npx tsx scripts/verify-qsc-wardrobe-selection-integrity.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  clearQscWardrobeSelectionForFreshStart,
  resolveQscEvaluateSubmitSelection,
  visibleQscWardrobeIds,
} from '../utils/qscEvaluateSelection';

const root = resolve(__dirname, '..');
const hookPath = resolve(root, 'hooks', 'useStylistDecision.ts');
const hookSrc = readFileSync(hookPath, 'utf8');
const items = [
  { id: '62', name: 'Barbour', enhancedImageUri: 'file://barbour.jpg' },
  { id: '47', name: 'Oxford', enhancedImageUri: 'file://oxford.jpg' },
  { id: '53', name: 'Blue jeans', enhancedImageUri: 'file://jeans.jpg' },
  { id: '129', name: 'Chelsea boots', enhancedImageUri: 'file://chelsea.jpg' },
  { id: '55', name: 'Football jersey', enhancedImageUri: 'file://jersey.jpg' },
  { id: '157', name: 'Track trousers', enhancedImageUri: 'file://track.jpg' },
  { id: '119', name: 'Running trainers', enhancedImageUri: 'file://trainers.jpg' },
];

const FOUR = ['62', '47', '53', '129'];
const LEAKED = ['62', '47', '53', '129', '55', '157', '119'];

function submit(selected: string[], gallery: string[] = []) {
  return resolveQscEvaluateSubmitSelection({
    selectedWardrobeIds: selected,
    galleryImages: gallery,
    wardrobeItems: items,
    maxWardrobeItems: 8,
  });
}

// 1 — select 4 wardrobe pieces → exactly those 4 IDs/images
const four = submit(FOUR);
assert.deepEqual(four.selectedWardrobeIds, FOUR, '1: submitted IDs are the 4 visible picks');
assert.equal(four.imageUris.length, 4, '1: four images');
assert.equal(four.usedWardrobe, true);

// 2 — reset/start fresh then choose 4 different items → old IDs do not submit
const afterReset = clearQscWardrobeSelectionForFreshStart({
  selectedWardrobeIds: LEAKED,
  images: ['file://old-1.jpg', 'file://old-2.jpg'],
  imageDataUris: ['data:image/jpeg;base64,old'],
});
assert.deepEqual(afterReset.selectedWardrobeIds, [], '2: fresh start clears prior IDs');
assert.deepEqual(afterReset.images, [], '2: fresh start clears prior outfit images');
assert.deepEqual(afterReset.imageDataUris, [], '2: fresh start clears prior image payloads');
const secondLook = submit(['55', '157', '119', '47']);
assert.deepEqual(secondLook.selectedWardrobeIds, ['55', '157', '119', '47']);
assert.ok(!secondLook.selectedWardrobeIds.includes('62'), '2: Barbour from prior look absent');
assert.ok(!secondLook.selectedWardrobeIds.includes('129'), '2: prior Chelsea absent');

// 3 — deselect an item → absent from IDs/images
const deselected = FOUR.filter((id) => id !== '53');
const afterDeselect = submit(deselected);
assert.equal(afterDeselect.selectedWardrobeIds.includes('53'), false, '3: deselected jeans absent');
assert.equal(afterDeselect.selectedWardrobeIds.length, 3);
assert.equal(afterDeselect.imageUris.length, 3);

// 4 — re-enter QSC after previous result → previous outfit does not leak
const previousResultIds = LEAKED;
const reentryInput = clearQscWardrobeSelectionForFreshStart({
  selectedWardrobeIds: previousResultIds,
});
const reentrySubmit = submit([...reentryInput.selectedWardrobeIds, ...FOUR]);
assert.deepEqual(reentrySubmit.selectedWardrobeIds, FOUR, '4: only the new 4 after clearing prior result');
assert.equal(reentrySubmit.imageUris.length, 4);

// 5 — photo-only QSC unchanged (no wardrobe IDs)
const photo = submit([], ['file://outfit-photo.jpg']);
assert.deepEqual(photo.selectedWardrobeIds, []);
assert.deepEqual(photo.imageUris, ['file://outfit-photo.jpg']);
assert.equal(photo.usedWardrobe, false);

// Wardrobe picks must not merge leftover gallery images
const noMerge = submit(FOUR, ['file://stale-photo.jpg', 'file://stale-2.jpg']);
assert.deepEqual(noMerge.selectedWardrobeIds, FOUR);
assert.equal(noMerge.imageUris.length, 4);
assert.ok(!noMerge.imageUris.includes('file://stale-photo.jpg'), 'wardrobe submit ignores leftover photos');

// Hidden / no-uri IDs must not count as visible or submit
const ghost = visibleQscWardrobeIds(['62', '999', '53'], items);
assert.deepEqual(ghost, ['62', '53']);

assert.match(hookSrc, /buildDecisionContext\(\)/, '6: QSC still sends compiled context');
assert.match(hookSrc, /selectedContexts: activeContexts/, '6: chips still submitted');
assert.match(hookSrc, /context,/, '6: context field still on the decision request');

// 7 — client must not alter server QSC scoring
assert.doesNotMatch(hookSrc, /resolveQscScorePercent/, '7: client does not call QSC scorer');
assert.match(
  hookSrc,
  /clearQscWardrobeSelectionForFreshStart/,
  'stale QSC unlock must clear prior wardrobe IDs',
);
assert.match(
  hookSrc,
  /resolveQscEvaluateSubmitSelection/,
  'QSC submit must use selection integrity helper',
);

console.log('verify-qsc-wardrobe-selection-integrity: ok');
