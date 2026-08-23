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
  findPendingOutfitClarify,
  isOutfitTaskAsk,
  isSingleLookWardrobeCreateAsk,
  isWardrobeHardLockAsk,
  isWardrobeOutfitRefineAsk,
  looksLikeOutfitClarifyCancel,
  looksLikeUnrelatedChatDuringOutfitClarify,
  resolveOutfitRoute,
} from '../utils/outfitClarifyContinuity';

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

const ASK_A1 =
  'I want to wear my running top with my smartest blazer for dinner tonight. Build the outfit around those two pieces.';
const REPLY_A3 = 'The black Next blazer.';
const ASK_B1 = 'I definitely want to wear my chambray shirt. Build the rest around it.';
const ASK_C2 = 'Who invented the little black dress?';
const ASK_D2 = 'Never mind, different question.';
const ASK_E2 = 'Keep the shoes but change the top and bottoms';

// ── Fixture A — Test 4 class (clarify continuity) ─────────────────────────

const a1 = resolveOutfitRoute({
  userText: ASK_A1,
  messages: [],
  wardrobeItems: wardrobe,
});
assert.equal(a1.route, 'outfit-from-wardrobe', 'A1 → outfit-from-wardrobe');
assert.ok(
  a1.route === 'outfit-from-wardrobe' && (a1.reason === 'outfit_task' || a1.reason === 'hard_lock'),
  'A1 reason is outfit task or hard lock',
);
assert.equal(
  a1.route === 'outfit-from-wardrobe' ? a1.userMessageForServer : '',
  ASK_A1,
  'A1 userMessage is original ask',
);

// A2: simulate server partial_lock_clarify — persist pending with partial lock (running top)
const partialLocks = advanceOutfitClarify({
  query: ASK_A1,
  prior: buildOutfitClarifyFromPartialLock({
    originalUserMessage: ASK_A1,
    occasion: 'evening_out',
    lockedItemIds: [],
    expectedLockCount: 2,
  }),
  wardrobeItems: wardrobe,
}).lockedItemIds;
// Prefer at least running top if matcher finds it
const locksAfterA1 = partialLocks.length
  ? partialLocks.slice(0, 1)
  : ['107'];
const pendingA2 = buildOutfitClarifyFromPartialLock({
  originalUserMessage: ASK_A1,
  occasion: 'evening_out',
  lockedItemIds: locksAfterA1,
  expectedLockCount: 2,
  weather: { temperature: 17, condition: 'clear' },
  lat: 51.5,
});
assert.equal(pendingA2.state, 'AWAITING_PIECE', 'A2 state AWAITING_PIECE');
assert.equal(pendingA2.originalUserMessage, ASK_A1, 'A2 stores original message');
assert.equal(pendingA2.occasion, 'evening_out');

const messagesAfterClarify = [
  { role: 'user' as const, content: ASK_A1 },
  {
    role: 'assistant' as const,
    content: 'I want to lock both pieces you named — Which blazer (or second piece) did you mean from your wardrobe?',
    outfitClarify: pendingA2,
  },
];
assert.ok(findPendingOutfitClarify(messagesAfterClarify), 'A2 findPending finds state');

// A3: natural short reply — must NOT go to resilient; must use frozen A1 as userMessage
const a3 = resolveOutfitRoute({
  userText: REPLY_A3,
  messages: messagesAfterClarify,
  wardrobeItems: wardrobe,
});
assert.equal(a3.route, 'outfit-from-wardrobe', 'A3 → outfit-from-wardrobe (not resilient)');
assert.equal(
  a3.route === 'outfit-from-wardrobe' ? a3.reason : '',
  'pending_ready',
  'A3 reason pending_ready',
);
assert.equal(
  a3.route === 'outfit-from-wardrobe' ? a3.userMessageForServer : '',
  ASK_A1,
  'A3 userMessageForServer is frozen A1 — NOT the short reply',
);
assert.notEqual(
  a3.route === 'outfit-from-wardrobe' ? a3.userMessageForServer : '',
  REPLY_A3,
  'A3 must not send short reply as main userMessage',
);
if (a3.route === 'outfit-from-wardrobe') {
  assert.ok(a3.lockedItemIds.length >= 2, 'A3 merged locks ≥ 2');
  assert.ok(
    a3.lockedItemIds.some((id) => id === '85' || id === String(85)),
    'A3 includes Next blazer id from short reply',
  );
  assert.equal(a3.occasion, 'evening_out');
}

// ── Fixture B — Test 3 class (hard lock, no clarify) ──────────────────────

assert.equal(isWardrobeHardLockAsk(ASK_B1), true, 'B1 isWardrobeHardLockAsk');
assert.equal(isOutfitTaskAsk(ASK_B1), true, 'B1 isOutfitTaskAsk');
// May or may not match classic single-look regex — hard lock must be enough
const b1 = resolveOutfitRoute({
  userText: ASK_B1,
  messages: [],
  wardrobeItems: wardrobe,
});
assert.equal(b1.route, 'outfit-from-wardrobe', 'B1 → outfit-from-wardrobe');
assert.ok(
  b1.route === 'outfit-from-wardrobe'
    && (b1.reason === 'hard_lock' || b1.reason === 'outfit_task'),
  'B1 via hard_lock or outfit_task',
);

// Natural hard lock without "from my wardrobe" / without requiring outfit keyword alone
assert.equal(
  isSingleLookWardrobeCreateAsk('I definitely want to wear my chambray shirt.'),
  false,
  'wear-my alone is not classic single-look (ok — hard lock covers with build-around)',
);
assert.equal(isWardrobeHardLockAsk(ASK_B1), true);

// ── Fixture C — unrelated drop ────────────────────────────────────────────

assert.equal(looksLikeUnrelatedChatDuringOutfitClarify(ASK_C2), true, 'C2 unrelated');
const c2 = resolveOutfitRoute({
  userText: ASK_C2,
  messages: messagesAfterClarify,
  wardrobeItems: wardrobe,
});
assert.equal(c2.route, 'drop_pending_unrelated', 'C2 drops pending — not outfit POST');

// ── Fixture D — cancel ────────────────────────────────────────────────────

assert.equal(looksLikeOutfitClarifyCancel(ASK_D2), true, 'D2 cancel');
const d2 = resolveOutfitRoute({
  userText: ASK_D2,
  messages: messagesAfterClarify,
  wardrobeItems: wardrobe,
});
assert.equal(d2.route, 'cancel_pending', 'D2 cancels pending');

// ── Fixture E — refine still works ────────────────────────────────────────

assert.equal(isWardrobeOutfitRefineAsk(ASK_E2), true, 'E2 refine ask');
const e2 = resolveOutfitRoute({
  userText: ASK_E2,
  messages: [
    {
      role: 'assistant',
      hasOutfitRecommendation: true,
      wardrobeVisual: { layout: 'stacked', pieces: [{ wardrobeItemId: '12' }] },
    },
  ],
  wardrobeItems: wardrobe,
  hasPriorOutfitItems: true,
});
assert.equal(e2.route, 'outfit-from-wardrobe', 'E2 → outfit-from-wardrobe refine');
assert.equal(
  e2.route === 'outfit-from-wardrobe' ? e2.reason : '',
  'refine',
  'E2 reason refine',
);

// Short reply without pending must NOT force outfit route (cold classification)
const coldShort = resolveOutfitRoute({
  userText: REPLY_A3,
  messages: [],
  wardrobeItems: wardrobe,
});
assert.equal(coldShort.route, 'other', 'cold short garment reply without pending → other/resilient');

console.log('verify-outfit-continuity-routing: ok (A–E)');
console.log(JSON.stringify({
  A1: a1.route,
  A3: a3.route === 'outfit-from-wardrobe' ? {
    route: a3.route,
    reason: a3.reason,
    userMessageFrozen: a3.userMessageForServer === ASK_A1,
    locks: a3.lockedItemIds,
  } : a3,
  B1: b1.route,
  C2: c2.route,
  D2: d2.route,
  E2: e2.route,
}, null, 2));
