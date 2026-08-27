/**
 * Deterministic outfit continuity routing fixtures (natural wording).
 * Spec: docs/qa/STYLIST_CHAT_OUTFIT_CONTINUITY_SPEC.md
 *
 * Run: npx tsx scripts/verify-outfit-continuity-routing.ts
 */
import assert from 'node:assert/strict';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  advanceOutfitClarify,
  buildOutfitClarifyFromPartialLock,
  buildOutfitClarifyFromTierBNarrow,
  clearOutfitClarify,
  evaluateOutfitClarifyReadiness,
  findPendingOutfitClarify,
  inferItemStructuralSlot,
  isOutfitClarifyReady,
  isOutfitTaskAsk,
  isSingleLookWardrobeCreateAsk,
  isStylingAdviceHowAsk,
  isWardrobeHardLockAsk,
  isWardrobeOutfitRefineAsk,
  looksLikeOutfitClarifyCancel,
  looksLikeUnrelatedChatDuringOutfitClarify,
  resolveOutfitRoute,
} from '../utils/outfitClarifyContinuity';
import { assertCanonicalOutfitVisual } from '../utils/canonicalOutfitVisualAuthority';

function item(
  partial: Partial<WardrobeItem> & Pick<WardrobeItem, 'id' | 'category' | 'name'>,
): WardrobeItem {
  return {
    userId: 'u1',
    imageUri: '',
    color: 'black',
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

const wardrobe: WardrobeItem[] = [
  item({ id: '107', category: 'tops', name: 'Black Running Top', brand: 'Nike', color: 'black' }),
  item({ id: '85', category: 'outerwear', name: 'Black Next Blazer', brand: 'Next', color: 'black' }),
  item({ id: '90', category: 'tops', name: 'Blue Chambray Shirt', brand: 'Uniqlo', color: 'blue' }),
  item({ id: '12', category: 'shoes', name: 'White Trainers', brand: 'Nike', color: 'white' }),
];

const extendedWardrobe: WardrobeItem[] = [
  ...wardrobe,
  item({ id: '201', category: 'outerwear', name: 'Grey Blazer', brand: 'Cavani', color: 'grey' }),
  item({ id: '202', category: 'outerwear', name: 'Navy Blazer', brand: 'M&S', color: 'navy' }),
  item({ id: '203', category: 'outerwear', name: 'Black Leather Jacket', brand: 'AllSaints', color: 'black' }),
  item({ id: '301', category: 'tops', name: 'Black Cotton Tee', brand: 'Uniqlo', color: 'black' }),
  item({ id: '302', category: 'tops', name: 'Black Polo', brand: 'Lacoste', color: 'black' }),
];

const ASK_A1 =
  'I want to wear my running top with my smartest blazer for dinner tonight. Build the outfit around those two pieces.';
const REPLY_A3 = 'The black Next blazer.';
const ASK_B1 = 'I definitely want to wear my chambray shirt. Build the rest around it.';
const ASK_C2 = 'Who invented the little black dress?';
const ASK_D2 = 'Never mind, different question.';
const ASK_E2 = 'Keep the shoes but change the top and bottoms';

function pendingDual(lockedItemIds: string[]) {
  return buildOutfitClarifyFromPartialLock({
    originalUserMessage: ASK_A1,
    occasion: 'evening_out',
    lockedItemIds,
    expectedLockCount: 2,
    pendingSlot: 'blazer',
    weather: { temperature: 17, condition: 'clear' },
    lat: 51.5,
  });
}

function messagesWithPending(pending: ReturnType<typeof pendingDual>) {
  return [
    { role: 'user' as const, content: ASK_A1 },
    {
      role: 'assistant' as const,
      content: 'Which blazer did you mean from your wardrobe?',
      outfitClarify: pending,
    },
  ];
}

const matrix: Record<string, 'PASS' | 'FAIL'> = {};

// ── Fixture A — Test 4 class (clarify continuity) ─────────────────────────

const a1 = resolveOutfitRoute({
  userText: ASK_A1,
  messages: [],
  wardrobeItems: wardrobe,
});
assert.equal(a1.route, 'outfit-from-wardrobe', 'A1 → outfit-from-wardrobe');
matrix['one-piece hard lock (B covers); initial outfit ask routes'] = a1.route === 'outfit-from-wardrobe' ? 'PASS' : 'FAIL';

const pendingA2 = pendingDual(['107']);
const messagesAfterClarify = messagesWithPending(pendingA2);
assert.ok(findPendingOutfitClarify(messagesAfterClarify), 'A2 findPending finds state');
matrix['two-piece partial lock persisted'] = 'PASS';

const a3 = resolveOutfitRoute({
  userText: REPLY_A3,
  messages: messagesAfterClarify,
  wardrobeItems: wardrobe,
});
assert.equal(a3.route, 'outfit-from-wardrobe', 'A3 → outfit-from-wardrobe');
assert.equal(a3.route === 'outfit-from-wardrobe' ? a3.reason : '', 'pending_ready');
if (a3.route === 'outfit-from-wardrobe') {
  assert.equal(a3.lockedItemIds.length, 2, 'A3 must have exactly two locks');
  assert.ok(a3.lockedItemIds.includes('107'), 'A3 keeps running top lock');
  assert.ok(a3.lockedItemIds.includes('85'), 'A3 adds Next blazer lock');
  assert.ok(a3.userMessageForServer.startsWith(ASK_A1));
  assert.ok(a3.userMessageForServer.includes('User confirmed piece:'));
}
matrix['correct blazer resolves slot → READY with two locks'] =
  a3.route === 'outfit-from-wardrobe'
  && a3.route === 'outfit-from-wardrobe'
  && a3.lockedItemIds.length === 2
  && a3.lockedItemIds.includes('107')
  && a3.lockedItemIds.includes('85')
    ? 'PASS'
    : 'FAIL';
matrix['short clarification reply'] = a3.route === 'outfit-from-wardrobe' ? 'PASS' : 'FAIL';

// Brand lives on brand field, not name — short reply must still resolve
const brandOnlyWardrobe: WardrobeItem[] = [
  item({ id: '107', category: 'tops', name: 'Performance Running Top', brand: 'Nike', color: 'black' }),
  item({ id: '85', category: 'outerwear', name: 'Wool Blazer', brand: 'Next', color: 'black' }),
];
const a3Brand = resolveOutfitRoute({
  userText: REPLY_A3,
  messages: messagesWithPending(pendingDual(['107'])),
  wardrobeItems: brandOnlyWardrobe,
});
assert.equal(a3Brand.route, 'outfit-from-wardrobe');
if (a3Brand.route === 'outfit-from-wardrobe') {
  assert.equal(a3Brand.lockedItemIds.length, 2);
  assert.ok(a3Brand.lockedItemIds.includes('85'));
}

// ── Slot validation regressions ───────────────────────────────────────────

const wrongSlot = resolveOutfitRoute({
  userText: 'The black tee.',
  messages: messagesWithPending(pendingDual(['107'])),
  wardrobeItems: extendedWardrobe,
});
assert.equal(wrongSlot.route, 'awaiting_more', 'wrong-slot tee → awaiting_more');
if (wrongSlot.route === 'awaiting_more') {
  assert.deepEqual(wrongSlot.pending.lockedItemIds, ['107'], 'wrong-slot preserves prior lock');
  assert.ok(wrongSlot.clarifyHint?.includes('blazer'), 'wrong-slot hint mentions blazer');
}
matrix['wrong-slot tee rejected'] = wrongSlot.route === 'awaiting_more' ? 'PASS' : 'FAIL';

const underCount = advanceOutfitClarify({
  query: REPLY_A3,
  prior: pendingDual([]),
  wardrobeItems: brandOnlyWardrobe,
});
assert.equal(underCount.ready, false, '1/2 locks → NOT READY');
assert.equal(underCount.lockedItemIds.length, 1, 'partial blazer lock stored');
matrix['only 1/2 locks → NOT READY'] = !underCount.ready && underCount.lockedItemIds.length === 1 ? 'PASS' : 'FAIL';

const ambiguous = resolveOutfitRoute({
  userText: 'The black one.',
  messages: messagesWithPending(pendingDual(['107'])),
  wardrobeItems: [
    item({ id: '107', category: 'tops', name: 'Performance Running Top', brand: 'Nike', color: 'black' }),
    item({ id: '85', category: 'outerwear', name: 'Black Next Blazer', brand: 'Next', color: 'black' }),
    item({ id: '86', category: 'outerwear', name: 'Black Wool Blazer', brand: 'M&S', color: 'black' }),
  ],
});
assert.equal(ambiguous.route, 'awaiting_more', 'ambiguous black blazers → clarify');
assert.ok(
  ambiguous.route === 'awaiting_more' && ambiguous.clarifyHint?.includes('two'),
  'ambiguity hint distinguishes options',
);
matrix['ambiguous black blazers → clarify'] = ambiguous.route === 'awaiting_more' ? 'PASS' : 'FAIL';

const unresolvable = resolveOutfitRoute({
  userText: 'Something random xyz.',
  messages: messagesAfterClarify,
  wardrobeItems: wardrobe,
});
assert.equal(unresolvable.route, 'awaiting_more');
if (unresolvable.route === 'awaiting_more') {
  assert.deepEqual(unresolvable.pending.lockedItemIds, ['107']);
  assert.equal(unresolvable.pending.originalUserMessage, ASK_A1);
}
matrix['unresolvable reply → clarify while preserving task'] = unresolvable.route === 'awaiting_more' ? 'PASS' : 'FAIL';

const correction = resolveOutfitRoute({
  userText: 'Actually use the grey one instead.',
  messages: messagesWithPending(
    buildOutfitClarifyFromPartialLock({
      originalUserMessage: ASK_A1,
      occasion: 'evening_out',
      lockedItemIds: ['107', '85'],
      expectedLockCount: 2,
      pendingSlot: 'blazer',
    }),
  ),
  wardrobeItems: extendedWardrobe,
});
assert.equal(correction.route, 'outfit-from-wardrobe', 'correction → outfit POST');
if (correction.route === 'outfit-from-wardrobe') {
  assert.ok(correction.lockedItemIds.includes('107'), 'correction keeps running top');
  assert.ok(correction.lockedItemIds.includes('201'), 'correction adds grey blazer');
  assert.ok(!correction.lockedItemIds.includes('85'), 'correction removes replaced black blazer');
  assert.equal(correction.lockedItemIds.length, 2);
}
matrix['correction replaces same-slot lock'] =
  correction.route === 'outfit-from-wardrobe'
  && correction.lockedItemIds.includes('201')
  && !correction.lockedItemIds.includes('85')
    ? 'PASS'
    : 'FAIL';

// Generic phrase coverage (same mechanism, not phrase-specific)
const cavani = resolveOutfitRoute({
  userText: 'Use my Cavani grey blazer.',
  messages: messagesWithPending(pendingDual(['107'])),
  wardrobeItems: extendedWardrobe,
});
assert.equal(cavani.route, 'outfit-from-wardrobe');
if (cavani.route === 'outfit-from-wardrobe') {
  assert.ok(cavani.lockedItemIds.includes('201'));
  assert.equal(cavani.lockedItemIds.length, 2);
}

// Readiness predicate unit checks
const pendingForReady = pendingDual(['107', '85']);
assert.equal(
  evaluateOutfitClarifyReadiness(pendingForReady, ['107', '85'], wardrobe),
  true,
  'readiness: top + blazer satisfied',
);
assert.equal(
  evaluateOutfitClarifyReadiness(pendingForReady, ['107', '301'], extendedWardrobe),
  false,
  'readiness: top + tee is NOT satisfied',
);
assert.equal(inferItemStructuralSlot(wardrobe[0]), 'top');
assert.equal(inferItemStructuralSlot(wardrobe[1]), 'blazer_or_outerwear');

// ── Fixture B — hard lock ─────────────────────────────────────────────────

const b1 = resolveOutfitRoute({ userText: ASK_B1, messages: [], wardrobeItems: wardrobe });
assert.equal(b1.route, 'outfit-from-wardrobe');
assert.equal(isWardrobeHardLockAsk(ASK_B1), true);
matrix['one-piece hard lock'] = b1.route === 'outfit-from-wardrobe' ? 'PASS' : 'FAIL';

// ── Fixture C — unrelated ─────────────────────────────────────────────────

const c2 = resolveOutfitRoute({
  userText: ASK_C2,
  messages: messagesAfterClarify,
  wardrobeItems: wardrobe,
});
assert.equal(c2.route, 'drop_pending_unrelated');
matrix['unrelated escape'] = c2.route === 'drop_pending_unrelated' ? 'PASS' : 'FAIL';

// ── Fixture D — cancel ────────────────────────────────────────────────────

const d2 = resolveOutfitRoute({
  userText: ASK_D2,
  messages: messagesAfterClarify,
  wardrobeItems: wardrobe,
});
assert.equal(d2.route, 'cancel_pending');
matrix['cancel'] = d2.route === 'cancel_pending' ? 'PASS' : 'FAIL';

// ── Fixture E — refine ────────────────────────────────────────────────────

const e2 = resolveOutfitRoute({
  userText: ASK_E2,
  messages: [{
    role: 'assistant',
    hasOutfitRecommendation: true,
    wardrobeVisual: { layout: 'stacked', pieces: [{ wardrobeItemId: '12' }] },
  }],
  wardrobeItems: wardrobe,
  hasPriorOutfitItems: true,
});
assert.equal(e2.route, 'outfit-from-wardrobe');
assert.equal(e2.route === 'outfit-from-wardrobe' ? e2.reason : '', 'refine');

// ── Publish / refuse clears state ─────────────────────────────────────────

const cleared = clearOutfitClarify(pendingA2);
assert.ok(cleared && cleared.state === 'DONE');
assert.equal(isOutfitClarifyReady(cleared, wardrobe), false);
matrix['publish/refuse clears state'] = cleared?.state === 'DONE' ? 'PASS' : 'FAIL';

// Cold short reply without pending → other/resilient
const coldShort = resolveOutfitRoute({
  userText: REPLY_A3,
  messages: [],
  wardrobeItems: wardrobe,
});
assert.equal(coldShort.route, 'other');

// ── Fixture F — Tier-B conversational continuity ─────────────────────────

const ASK_F1 = 'Put together a casual outfit for me today.';
const REPLY_F2_COFFEE = "Relaxed everyday — I'm just going out for coffee and a walk.";
const REPLY_F2_DRINKS = 'Lunch or drinks — going to the pub';

const f1 = resolveOutfitRoute({
  userText: ASK_F1,
  messages: [],
  wardrobeItems: wardrobe,
});
assert.equal(f1.route, 'outfit-from-wardrobe');
assert.equal(f1.route === 'outfit-from-wardrobe' ? f1.reason : '', 'outfit_task');
matrix['Tier B cold ask → outfit-from-wardrobe'] = f1.route === 'outfit-from-wardrobe' ? 'PASS' : 'FAIL';

const pendingF = buildOutfitClarifyFromTierBNarrow({
  originalUserMessage: ASK_F1,
  occasion: 'casual_day',
  weather: { temperature: 22, condition: 'clear' },
  lat: 51.5,
});
assert.equal(pendingF.flow, 'outfit_tier_b_narrow');
assert.equal(pendingF.expectedLockCount, 0);

const messagesAfterTierB = [
  { role: 'user' as const, content: ASK_F1 },
  {
    role: 'assistant' as const,
    content: "I've got a lot of good options here — what are you dressing for?",
    hasOutfitRecommendation: false,
    outfitClarify: pendingF,
  },
];
assert.ok(findPendingOutfitClarify(messagesAfterTierB), 'F2 findPending finds Tier-B state');

// Without pending, narrowing reply alone must NOT look like an outfit ask (resilient trap).
const coldNarrow = resolveOutfitRoute({
  userText: REPLY_F2_COFFEE,
  messages: [],
  wardrobeItems: wardrobe,
});
assert.equal(coldNarrow.route, 'other', 'cold Tier-B reply alone → other/resilient');
matrix['cold Tier-B reply alone → other'] = coldNarrow.route === 'other' ? 'PASS' : 'FAIL';

const f2Coffee = resolveOutfitRoute({
  userText: REPLY_F2_COFFEE,
  messages: messagesAfterTierB,
  wardrobeItems: wardrobe,
});
assert.equal(f2Coffee.route, 'outfit-from-wardrobe', 'F2 coffee with pending → outfit-from-wardrobe');
assert.equal(f2Coffee.route === 'outfit-from-wardrobe' ? f2Coffee.reason : '', 'tier_b_ready');
if (f2Coffee.route === 'outfit-from-wardrobe') {
  assert.equal(f2Coffee.tierBStillBroad, true);
  assert.equal(f2Coffee.lockedItemIds.length, 0);
  assert.equal(f2Coffee.occasion, 'casual_day');
  assert.ok(f2Coffee.userMessageForServer.startsWith(ASK_F1));
  assert.ok(f2Coffee.userMessageForServer.includes('User narrowed intent:'));
  assert.ok(!(f2Coffee as { tierBNarrowResolved?: boolean }).tierBNarrowResolved);
}
matrix['Tier-B coffee reply → still broad, no bypass flag'] =
  f2Coffee.route === 'outfit-from-wardrobe'
  && f2Coffee.reason === 'tier_b_ready'
  && f2Coffee.tierBStillBroad === true
  && f2Coffee.occasion === 'casual_day'
    ? 'PASS'
    : 'FAIL';

const f2Drinks = resolveOutfitRoute({
  userText: REPLY_F2_DRINKS,
  messages: messagesAfterTierB,
  wardrobeItems: wardrobe,
});
assert.equal(f2Drinks.route, 'outfit-from-wardrobe');
if (f2Drinks.route === 'outfit-from-wardrobe') {
  assert.equal(f2Drinks.reason, 'tier_b_ready');
  assert.equal(f2Drinks.tierBStillBroad, false);
  assert.equal(f2Drinks.occasion, 'smart_casual');
  assert.equal(f2Drinks.lockedItemIds.length, 0);
}
matrix['Tier-B drinks reply → smart_casual occasionOverride'] =
  f2Drinks.route === 'outfit-from-wardrobe'
  && f2Drinks.occasion === 'smart_casual'
  && f2Drinks.tierBStillBroad === false
    ? 'PASS'
    : 'FAIL';

const fCancel = resolveOutfitRoute({
  userText: 'Never mind, different question.',
  messages: messagesAfterTierB,
  wardrobeItems: wardrobe,
});
assert.equal(fCancel.route, 'cancel_pending');
matrix['Tier-B cancel drops pending'] = fCancel.route === 'cancel_pending' ? 'PASS' : 'FAIL';

const fUnrelated = resolveOutfitRoute({
  userText: 'Who invented the little black dress?',
  messages: messagesAfterTierB,
  wardrobeItems: wardrobe,
});
assert.equal(fUnrelated.route, 'drop_pending_unrelated');
matrix['Tier-B unrelated drops pending'] = fUnrelated.route === 'drop_pending_unrelated' ? 'PASS' : 'FAIL';

// Ivy C2 residual: advice how-to must NOT enter outfit-from-wardrobe / Tier B
const C2_SMARTER = 'How would I make it look smarter without looking overdressed?';
assert.equal(isStylingAdviceHowAsk(C2_SMARTER), true);
assert.equal(isOutfitTaskAsk(C2_SMARTER), false);
assert.equal(isWardrobeOutfitRefineAsk(C2_SMARTER), false);
const c2SmarterRoute = resolveOutfitRoute({
  userText: C2_SMARTER,
  messages: [
    { role: 'user', content: 'Can I wear loafers with jeans?' },
    { role: 'assistant', content: 'Yes. Wear loafers with jeans.' },
    { role: 'user', content: 'What if the jeans are distressed?' },
    { role: 'assistant', content: 'Yes, but be careful with heavy distressing.' },
  ],
  wardrobeItems: wardrobe,
  hasPriorOutfitItems: false,
});
assert.equal(c2SmarterRoute.route, 'other');
matrix['C2 smarter advice stays other (not outfit-from-wardrobe)'] =
  c2SmarterRoute.route === 'other' ? 'PASS' : 'FAIL';

const C6_SMARTER = 'make it smarter but still relaxed';
assert.equal(isStylingAdviceHowAsk(C6_SMARTER), true);
assert.equal(isOutfitTaskAsk(C6_SMARTER), false);
assert.equal(isWardrobeOutfitRefineAsk(C6_SMARTER), false);
assert.equal(isWardrobeOutfitRefineAsk("I don't like that, give another option"), false);
const c6Route = resolveOutfitRoute({
  userText: C6_SMARTER,
  messages: [
    { role: 'user', content: 'Can I wear loafers with jeans?' },
    { role: 'assistant', content: 'Yes.' },
  ],
  wardrobeItems: wardrobe,
  hasPriorOutfitItems: true,
});
assert.equal(c6Route.route, 'other');
matrix['C6 smarter-but-relaxed stays other'] = c6Route.route === 'other' ? 'PASS' : 'FAIL';
matrix['short make it smarter still refine'] =
  isWardrobeOutfitRefineAsk('make it smarter') ? 'PASS' : 'FAIL';

// Explicit create still routes
assert.equal(isOutfitTaskAsk('Create an outfit from my wardrobe for tonight'), true);
matrix['explicit create still outfit task'] =
  isOutfitTaskAsk('Create an outfit from my wardrobe for tonight') ? 'PASS' : 'FAIL';

// Visual authority: published strip IDs must equal canonical itemIds
const visualOk = assertCanonicalOutfitVisual({
  itemIds: ['140', '43', '132'],
  wardrobeVisual: {
    layout: 'stacked',
    pieces: [
      { wardrobeItemId: '140' },
      { wardrobeItemId: '43' },
      { wardrobeItemId: '132' },
    ],
  },
});
assert.equal(visualOk.ok, true);
const visualPadFail = assertCanonicalOutfitVisual({
  itemIds: ['140', '43', '132'],
  wardrobeVisual: {
    layout: 'stacked',
    pieces: [
      { wardrobeItemId: '140' },
      { wardrobeItemId: '43' },
      { wardrobeItemId: '132' },
      { wardrobeItemId: '84' },
    ],
  },
});
assert.equal(visualPadFail.ok, false);
assert.equal(visualPadFail.wardrobeVisual, null);
matrix['visual authority rejects padded outerwear ID'] = !visualPadFail.ok && visualPadFail.wardrobeVisual == null
  ? 'PASS'
  : 'FAIL';

const allPass = Object.values(matrix).every((v) => v === 'PASS');

console.log('verify-outfit-continuity-routing: ok (A–F + slot regressions)');
console.log(JSON.stringify({
  matrix,
  allPass,
  A3: a3.route === 'outfit-from-wardrobe' ? { locks: a3.lockedItemIds, reason: a3.reason } : a3,
  F2_coffee: f2Coffee.route === 'outfit-from-wardrobe'
    ? { reason: f2Coffee.reason, occasion: f2Coffee.occasion, tierBStillBroad: f2Coffee.tierBStillBroad }
    : f2Coffee,
  F2_drinks: f2Drinks.route === 'outfit-from-wardrobe'
    ? { reason: f2Drinks.reason, occasion: f2Drinks.occasion, tierBStillBroad: f2Drinks.tierBStillBroad }
    : f2Drinks,
}, null, 2));

if (!allPass) {
  process.exit(1);
}
