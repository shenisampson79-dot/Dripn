/**
 * Fashion colour taxonomy — base + category + temperature.
 * Run: npx tsx utils/fashionColorTaxonomy.test.ts
 */
import assert from 'node:assert/strict';
import {
  baseColorFromHue,
  classifyFashionColor,
  fashionCategoryHarmonyAdjustment,
  scoreFashionPalette,
  toBaseColor,
} from './fashionColorTaxonomy';

function case_(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}`);
    throw e;
  }
}

case_('TEAL_NORMALIZES_TO_BLUE_BOLD', () => {
  assert.equal(toBaseColor('teal'), 'blue');
  assert.equal(toBaseColor('cyan'), 'blue');
  const p = classifyFashionColor('teal');
  assert.equal(p.base, 'blue');
  assert.equal(p.category, 'bold');
  assert.equal(p.temperature, 'cool');
});

case_('TEAL_RGB_HUE_BAND_TO_BLUE', () => {
  // Approx teal RGB
  const p = classifyFashionColor('other', { r: 40, g: 150, b: 165 });
  assert.equal(p.base, 'blue');
  const hslBase = baseColorFromHue(175, 0.6, 0.4);
  assert.equal(hslBase, 'blue');
});

case_('BEIGE_IS_NEUTRAL', () => {
  const p = classifyFashionColor('beige');
  assert.equal(p.category, 'neutral');
});

case_('LIGHT_PINK_IS_PASTEL', () => {
  const p = classifyFashionColor('light pink');
  assert.equal(p.base, 'pink');
  assert.equal(p.category, 'pastel');
});

case_('BLACK_SHORTS_ARE_DARK_NOT_SHADOW', () => {
  const p = classifyFashionColor('black');
  assert.equal(p.base, 'black');
  assert.equal(p.category, 'dark');
});

case_('OLIVE_IS_EARTH', () => {
  const p = classifyFashionColor('olive');
  assert.equal(p.base, 'green');
  assert.equal(p.category, 'earth');
});

case_('HARMONY_NEUTRAL_BOLD_BALANCED', () => {
  assert.ok(fashionCategoryHarmonyAdjustment('neutral', 'bold') >= 10);
  assert.ok(fashionCategoryHarmonyAdjustment('bold', 'bold') < 0);
});

case_('PALETTE_SCORE_NEUTRAL_BOLD_BEATS_BOLD_BOLD', () => {
  const balanced = scoreFashionPalette([
    { color: 'black' },
    { color: 'red' },
  ]);
  const risky = scoreFashionPalette([
    { color: 'red' },
    { color: 'yellow' },
  ]);
  assert.ok(balanced.adjustment > risky.adjustment);
  assert.ok(balanced.adjustment >= 6);
  assert.ok(risky.adjustment <= 0);
});

console.log('fashionColorTaxonomy.test.ts: all passed');
