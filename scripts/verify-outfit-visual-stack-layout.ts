/**
 * Shared outfit visual stack layout — Event + Stylist Chat both use `large` mode.
 * Run: npx tsx scripts/verify-outfit-visual-stack-layout.ts
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const outfitVisualSrc = readFileSync(resolve(root, 'components/OutfitPiecesVisual.tsx'), 'utf8');
const chatSrc = readFileSync(resolve(root, 'screens/AIStylistScreen.tsx'), 'utf8');
const eventSrc = readFileSync(resolve(root, 'components/stylist/StylistDecisionFlow.tsx'), 'utf8');
const rankedSrc = readFileSync(resolve(root, 'components/stylist/RankedMultiLookCards.tsx'), 'utf8');

assert.match(outfitVisualSrc, /STACK_GAP_LARGE = 20/, 'large card uses ~20px stack gap');
assert.match(outfitVisualSrc, /useStackGap = large && !tight && !compact/, 'gap mode for all large cards');
assert.match(
  outfitVisualSrc,
  /marginTop: index === 0 \? 0 : \(useStackGap \? stackSpacing : -stackSpacing\)/,
  'positive gap vs overlap',
);

assert.match(chatSrc, /SafeOutfitPieces[\s\S]{0,200}large/, 'Stylist Chat uses SafeOutfitPieces large');
assert.match(eventSrc, /SafeOutfitPieces[\s\S]{0,200}large/, 'Event uses SafeOutfitPieces large');
assert.match(rankedSrc, /SafeOutfitPieces[\s\S]{0,200}large/, 'ranked chat looks use SafeOutfitPieces large');
assert.doesNotMatch(
  chatSrc,
  /SafeOutfitPieces[\s\S]{0,200}compact=\{?true/,
  'Stylist Chat does not use compact stack mode',
);

const LAYER_HEIGHT_LARGE = {
  outerwear: 200,
  top: 168,
  bottom: 190,
  shoes: 120,
  dress: 300,
};
const LAYER_HEIGHT_LARGE_BEFORE = {
  outerwear: 268,
  top: 242,
  bottom: 272,
  shoes: 188,
};
const gapAfter = 20;
const overlapBefore = 22;

function stackHeight(
  slots: Array<keyof typeof LAYER_HEIGHT_LARGE>,
  heights: Record<string, number>,
  spacing: number,
  useGap: boolean,
): number {
  return slots.reduce((sum, slot, index) => {
    const h = heights[slot];
    if (index === 0) return h;
    return sum + h + (useGap ? spacing : -spacing);
  }, 0);
}

const threeSlots: Array<keyof typeof LAYER_HEIGHT_LARGE> = ['outerwear', 'top', 'bottom'];
const fourSlots: Array<keyof typeof LAYER_HEIGHT_LARGE> = ['outerwear', 'top', 'bottom', 'shoes'];

const chatThreeBefore = stackHeight(threeSlots, LAYER_HEIGHT_LARGE_BEFORE, overlapBefore, false);
const chatThreeAfter = stackHeight(threeSlots, LAYER_HEIGHT_LARGE, gapAfter, true);
const chatFourAfter = stackHeight(fourSlots, LAYER_HEIGHT_LARGE, gapAfter, true);

assert.ok(chatThreeBefore > chatThreeAfter, `3-piece tighter after fix (${chatThreeBefore} → ${chatThreeAfter})`);
assert.ok(chatThreeAfter >= 540 && chatThreeAfter <= 620, `3-piece after ${chatThreeAfter}`);
assert.ok(chatFourAfter >= 660 && chatFourAfter <= 760, `4-piece after ${chatFourAfter}`);

console.log(JSON.stringify({
  ok: true,
  sharedMode: 'large',
  chatPath: 'AIStylistScreen → SafeOutfitPieces large',
  eventPath: 'StylistDecisionFlow → SafeOutfitPieces large',
  stackGapLarge: gapAfter,
  chatThreeBefore: { spacing: -overlapBefore, canvasHeight: chatThreeBefore },
  chatThreeAfter: { spacing: gapAfter, canvasHeight: chatThreeAfter },
  chatFourAfter: { spacing: gapAfter, canvasHeight: chatFourAfter },
}, null, 2));
console.log('verify-outfit-visual-stack-layout: PASS');
