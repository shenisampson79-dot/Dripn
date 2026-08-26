/**
 * Occasion continuity across hydrate + accessory visual slots.
 * Run: npx tsx scripts/verify-outfit-occasion-hydration.ts
 */
import assert from 'assert';
import {
  asStructuredOutfitOccasion,
  extractPriorOutfitOccasion,
  pickPersistedOutfitOccasion,
} from '../utils/extractPriorOutfitOccasion';
import { raiseOccasionForRefine } from '../utils/inferOutfitOccasionFromAsk';
import { resolveOutfitVisualSlots } from '../utils/outfitVisualSlots';

// ── Structured field gate (no prose inference) ─────────────────────────────
assert.equal(asStructuredOutfitOccasion('smart_casual'), 'smart_casual');
assert.equal(asStructuredOutfitOccasion('Smart Casual'), 'smart_casual');
assert.equal(asStructuredOutfitOccasion('drinks'), null, 'prose label must not become occasion');
assert.equal(asStructuredOutfitOccasion('lunch or drinks'), null);

// ── Persist → hydrate class (normalize equivalent via pickPersisted) ───────
const published = {
  role: 'assistant' as const,
  outfitOccasion: 'smart_casual',
  wardrobeVisual: { pieces: [{ wardrobeItemId: 1 }] },
};
const hydrated = {
  role: 'assistant' as const,
  // Simulate old bug: wardrobeVisual kept, outfitOccasion dropped — then restored from sibling fields
  outfitSuggestion: { occasion: 'smart_casual', items: [], reason: '' },
};
assert.equal(pickPersistedOutfitOccasion(published), 'smart_casual');
assert.equal(pickPersistedOutfitOccasion(hydrated), 'smart_casual');

// Force-close / reload: messages after normalize must still yield prior
const afterReload = [
  { role: 'user' as const, content: 'Lunch or drinks' },
  {
    role: 'assistant' as const,
    outfitOccasion: 'smart_casual', // restored by normalizeChatMessage
    wardrobeVisual: { pieces: [{ wardrobeItemId: '59' }, { wardrobeItemId: '118' }] },
  },
];
assert.equal(extractPriorOutfitOccasion(afterReload), 'smart_casual');
assert.equal(
  raiseOccasionForRefine(
    extractPriorOutfitOccasion(afterReload),
    'Give me another option for the same kind of lunch or drinks.',
  ),
  'smart_casual',
);

// Fresh no-prior still defaults via raiseOccasionForRefine
assert.equal(
  raiseOccasionForRefine(null, 'Give me another option.'),
  'casual_day',
);

// Explicit new occasion still overrides
assert.equal(
  raiseOccasionForRefine('smart_casual', 'Change it to dinner.'),
  'evening_out',
);

// styleSession only when already structured (not "drinks")
assert.equal(
  pickPersistedOutfitOccasion({
    role: 'assistant',
    styleSession: { occasion: 'drinks' },
  }),
  null,
);
assert.equal(
  pickPersistedOutfitOccasion({
    role: 'assistant',
    styleSession: { occasion: 'evening_out' },
  }),
  'evening_out',
);

// ── Accessory visibility slots ─────────────────────────────────────────────
const fourPiece = [
  { role: 'top', name: 'White Shirt', wardrobeItemId: 140, category: 'tops', imageUrl: 'https://example.com/t.jpg' },
  { role: 'bottom', name: 'Navy Trousers', wardrobeItemId: 158, category: 'bottoms', imageUrl: 'https://example.com/b.jpg' },
  { role: 'shoes', name: 'Brown Loafers', wardrobeItemId: 122, category: 'shoes', imageUrl: 'https://example.com/s.jpg' },
  {
    role: 'accessory',
    name: 'Navy Polka Dot Necktie',
    wardrobeItemId: 48,
    category: 'accessories',
    imageUrl: 'https://example.com/a.jpg',
  },
];
const slots = resolveOutfitVisualSlots(fourPiece);
assert.deepEqual(
  slots.sort(),
  ['accessory', 'bottom', 'shoes', 'top'].sort(),
  `expected four roles, got ${JSON.stringify(slots)}`,
);
assert.ok(slots.includes('accessory'), 'canonical accessory must be in visual slots');

// Dress layout still suppresses top (do not reopen dress-shirt work)
const dressLook = [
  { role: 'dress', name: 'Black Midi Dress', wardrobeItemId: 9, category: 'dresses', imageUrl: 'https://example.com/d.jpg' },
  { role: 'shoes', name: 'Heels', wardrobeItemId: 10, category: 'shoes', imageUrl: 'https://example.com/h.jpg' },
  { role: 'accessory', name: 'Clutch', wardrobeItemId: 11, category: 'bags', imageUrl: 'https://example.com/c.jpg' },
];
const dressSlots = resolveOutfitVisualSlots(dressLook);
assert.ok(dressSlots.includes('dress'));
assert.ok(dressSlots.includes('shoes'));
assert.ok(dressSlots.includes('accessory'));
assert.ok(!dressSlots.includes('top'));
assert.ok(!dressSlots.includes('bottom'));

console.log(JSON.stringify({
  ok: true,
  sameKindAfterHydrate: 'smart_casual',
  fourPieceSlots: slots,
  dressSlots,
}, null, 2));
console.log('verify-outfit-occasion-hydration: PASS');
