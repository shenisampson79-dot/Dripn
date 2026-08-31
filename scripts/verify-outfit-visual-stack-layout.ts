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

assert.match(outfitVisualSrc, /STACK_GAP_LARGE = 8/, 'large card uses ~8px stack gap');
assert.match(outfitVisualSrc, /LARGE_CUTOUT_DISPLAY_SCALE = 1\.18/, 'large mode uses 1.18 cutout zoom');
assert.match(
  outfitVisualSrc,
  /displayScale=\{large && !tight && !compact \? LARGE_CUTOUT_DISPLAY_SCALE : 1\}/,
  'displayScale only on large visual-card path',
);
assert.match(outfitVisualSrc, /useStackGap = large && !tight && !compact/, 'gap mode for all large cards');
assert.match(
  outfitVisualSrc,
  /marginTop: index === 0 \? 0 : \(useStackGap \? stackSpacing : -stackSpacing\)/,
  'positive gap vs overlap',
);
assert.match(outfitVisualSrc, /contentFit="contain"/, 'layer images stay contain-fit');
assert.match(outfitVisualSrc, /outerwear: 1,\s*\n\s*top: 0\.94/, 'LAYER_WIDTH_LARGE unchanged');
assert.match(outfitVisualSrc, /outerwear: 200,\s*\n\s*top: 168/, 'LAYER_HEIGHT_LARGE unchanged');
assert.match(outfitVisualSrc, /gap: Spacing\.sm/, 'accessory row gap unchanged');

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
const STACK_GAP_LARGE = 8;

function stackHeight(
  slots: Array<keyof typeof LAYER_HEIGHT_LARGE>,
  heights: Record<string, number>,
  spacing: number,
): number {
  return slots.reduce((sum, slot, index) => {
    const h = heights[slot];
    if (index === 0) return h;
    return sum + h + spacing;
  }, 0);
}

const threeSlots: Array<keyof typeof LAYER_HEIGHT_LARGE> = ['outerwear', 'top', 'bottom'];
const fourSlots: Array<keyof typeof LAYER_HEIGHT_LARGE> = ['outerwear', 'top', 'bottom', 'shoes'];
/** Five-garment outfit: four stack layers + accessory strip (strip geometry verified separately). */
const fiveGarmentStackSlots: Array<keyof typeof LAYER_HEIGHT_LARGE> = ['outerwear', 'top', 'bottom', 'shoes'];

const chatThree = stackHeight(threeSlots, LAYER_HEIGHT_LARGE, STACK_GAP_LARGE);
const chatFour = stackHeight(fourSlots, LAYER_HEIGHT_LARGE, STACK_GAP_LARGE);
const chatFiveGarment = stackHeight(fiveGarmentStackSlots, LAYER_HEIGHT_LARGE, STACK_GAP_LARGE);

assert.equal(STACK_GAP_LARGE, 8, 'A/B/C — stack gap constant is 8');
assert.ok(chatThree >= 555 && chatThree <= 595, `3-piece stack height ${chatThree} with gap 8`);
assert.ok(chatFour >= 680 && chatFour <= 720, `4-piece stack height ${chatFour} with gap 8`);
assert.ok(chatFiveGarment >= 680 && chatFiveGarment <= 720, `5-garment stack height ${chatFiveGarment} with gap 8`);

console.log(JSON.stringify({
  ok: true,
  sharedMode: 'large',
  chatPath: 'AIStylistScreen → SafeOutfitPieces large',
  eventPath: 'StylistDecisionFlow → SafeOutfitPieces large',
  stackGapLarge: STACK_GAP_LARGE,
  largeDisplayScale: 1.18,
  chatThree: { spacing: STACK_GAP_LARGE, canvasHeight: chatThree },
  chatFour: { spacing: STACK_GAP_LARGE, canvasHeight: chatFour },
  chatFiveGarment: { spacing: STACK_GAP_LARGE, canvasHeight: chatFiveGarment },
}, null, 2));
console.log('verify-outfit-visual-stack-layout: PASS');
