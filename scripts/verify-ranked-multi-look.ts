/**
 * Ranked multi-look card builder — equal-size decision hierarchy.
 * Run: npx tsx scripts/verify-ranked-multi-look.ts
 */
import assert from 'node:assert/strict';
import {
  buildRankedLookCards,
  multiLookIntroText,
  roleLabelFor,
} from '../utils/rankedMultiLook.ts';

const content = `Here are a few options:

Look 1 – Best option
Grey hoodie, black jeans, white trainers
This is your strongest option — the colours sit cleanly together. It just works.

Look 2 – Easy option
Navy tee, khaki cargos, brown boots
This is the easiest to wear — it stays simple and versatile. You cannot really go wrong with it.

Look 3 – More expressive
Green overshirt, black jeans, black boots
This is a bit more expressive — the layering adds depth without looking overdone. It stands out more.
`;

const outfits = [
  {
    title: 'Look 1 – Best option',
    sectionIndex: 0,
    pieces: [
      { wardrobeItemId: '1', name: 'Grey hoodie', role: 'top' },
      { wardrobeItemId: '2', name: 'Black jeans', role: 'bottom' },
      { wardrobeItemId: '3', name: 'White trainers', role: 'shoes' },
    ],
  },
  {
    title: 'Look 2 – Easy option',
    sectionIndex: 1,
    pieces: [
      { wardrobeItemId: '4', name: 'Navy tee', role: 'top' },
      { wardrobeItemId: '5', name: 'Khaki cargos', role: 'bottom' },
      { wardrobeItemId: '6', name: 'Brown boots', role: 'shoes' },
    ],
  },
  {
    title: 'Look 3 – More expressive',
    sectionIndex: 2,
    pieces: [
      { wardrobeItemId: '7', name: 'Green overshirt', role: 'top' },
      { wardrobeItemId: '8', name: 'Black jeans', role: 'bottom' },
      { wardrobeItemId: '9', name: 'Black boots', role: 'shoes' },
    ],
  },
];

const looks = [
  { role: 'hero', roleLabel: 'Best option', reason: 'This is your strongest option — clean balance.', itemIds: ['1', '2', '3'] },
  { role: 'safe', roleLabel: 'Easy option', reason: 'This is the easiest to wear — simple and neutral.', itemIds: ['4', '5', '6'] },
  { role: 'bold', roleLabel: 'More expressive', reason: 'This is a bit more expressive — clearer personality.', itemIds: ['7', '8', '9'] },
];

const cards = buildRankedLookCards({ outfits, looks, content });
assert.equal(cards.length, 3);
assert.equal(cards[0].role, 'hero');
assert.equal(cards[0].isPrimary, true);
assert.equal(cards[0].primaryCta, 'wear');
assert.equal(cards[1].primaryCta, 'try');
assert.equal(cards[2].primaryCta, 'try');
assert.equal(cards[0].roleLabel, 'Best option');
assert.ok(cards.every((c) => c.pieces.length >= 2));
assert.equal(multiLookIntroText(content), 'Here are a few options:');
assert.equal(roleLabelFor('hero'), 'Best option');

// Title-only fallback (no looks metadata)
const fromTitles = buildRankedLookCards({ outfits, content });
assert.equal(fromTitles[0].role, 'hero');
assert.equal(fromTitles[1].role, 'safe');
assert.equal(fromTitles[2].role, 'bold');

console.log('verify-ranked-multi-look: equal-size ranked cards passed');
