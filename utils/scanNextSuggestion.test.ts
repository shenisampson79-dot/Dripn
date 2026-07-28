/**
 * Quick checks for scan-next suggestion engine.
 */
import assert from 'node:assert/strict';
import {
  countScanSlots,
  estimateOutfitCombos,
  getScanNextSuggestion,
  unlockGainIfAdd,
} from './scanNextSuggestion.ts';

console.log('=== scanNextSuggestion ===\n');

{
  const counts = countScanSlots([
    { category: 'tops' },
    { category: 'tops' },
    { category: 'bottoms' },
  ]);
  assert.equal(counts.tops, 2);
  assert.equal(counts.bottoms, 1);
  assert.equal(estimateOutfitCombos(counts), 0, 'no shoes → 0 looks');
  const withShoes = { ...counts, shoes: 1, outerwear: 0, dresses: 0 };
  assert.equal(estimateOutfitCombos(withShoes), 2);
  assert.equal(unlockGainIfAdd(withShoes, 'bottoms'), 2, 'extra bottom doubles with 2 tops');
  console.log('✓ combo math');
}

{
  const s = getScanNextSuggestion({
    wardrobe: [{ category: 'tops' }, { category: 'bottoms' }],
  });
  assert.ok(s);
  assert.equal(s!.slot, 'shoes');
  assert.match(s!.chip.toLowerCase(), /shoe/);
  console.log('✓ gap: shoes');
}

{
  const s = getScanNextSuggestion({
    wardrobe: [
      { category: 'tops' },
      { category: 'bottoms' },
      { category: 'shoes' },
    ],
    lastCategory: 'tops',
  });
  assert.ok(s);
  assert.equal(s!.slot, 'outerwear');
  console.log('✓ gap: outerwear after base set');
}

{
  const s = getScanNextSuggestion({
    wardrobe: [
      { category: 'tops' },
      { category: 'tops' },
      { category: 'bottoms' },
      { category: 'shoes' },
      { category: 'outerwear' },
    ],
    lastCategory: 'tops',
  });
  assert.ok(s);
  assert.equal(s!.slot, 'bottoms');
  assert.match(s!.chip.toLowerCase(), /trouser|jean/);
  console.log('✓ sequence: after top → bottoms');
}

{
  const s = getScanNextSuggestion({
    wardrobe: [
      { category: 'tops', color: 'black' },
      { category: 'tops', color: 'navy' },
      { category: 'bottoms', color: 'black' },
      { category: 'shoes', color: 'black' },
      { category: 'outerwear', color: 'charcoal' },
    ],
  });
  assert.ok(s);
  assert.equal(s!.reason, 'colour_gap');
  assert.match(s!.chip.toLowerCase(), /white|beige/);
  console.log('✓ colour gap');
}

console.log('\nAll scanNextSuggestion tests passed.');
