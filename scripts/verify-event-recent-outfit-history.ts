/**
 * Event Surprise Me cross-event recent-outfit transport regression.
 * Run: npx tsx scripts/verify-event-recent-outfit-history.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  extractEventRecentOutfitIdLists,
  resolveEventOutfitHistoryPieces,
} from '../utils/extractEventRecentOutfitIdLists';

/** Mirror of Dripn-Server index.js normalizeDecisionRecentOutfits (history transport only). */
function normalizeDecisionRecentOutfits(body: {
  recentOutfits?: unknown;
  priorOutfits?: unknown;
}): string[][] {
  const lists: string[][] = [];
  const entries = [
    ...(Array.isArray(body?.recentOutfits) ? body.recentOutfits : []),
    ...(Array.isArray(body?.priorOutfits) ? body.priorOutfits : []),
  ];
  for (const entry of entries) {
    if (Array.isArray(entry)) {
      const normalized = entry.map(String).filter(Boolean);
      if (normalized.length >= 2) lists.push(normalized);
    } else if (entry && typeof entry === 'object') {
      const ids = (entry as { itemIds?: unknown; wardrobeItemIds?: unknown; ids?: unknown }).itemIds
        || (entry as { wardrobeItemIds?: unknown }).wardrobeItemIds
        || (entry as { ids?: unknown }).ids
        || [];
      const normalized = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);
      if (normalized.length >= 2) lists.push(normalized);
    }
  }
  return lists.slice(0, 5);
}

const root = resolve(__dirname, '..');
const hookSrc = readFileSync(resolve(root, 'hooks/useStylistDecision.ts'), 'utf8');
const historySrc = readFileSync(resolve(root, 'utils/eventRecentOutfitHistory.ts'), 'utf8');
const extractSrc = readFileSync(resolve(root, 'utils/extractEventRecentOutfitIdLists.ts'), 'utf8');

console.log('=== verify-event-recent-outfit-history ===\n');

// Wiring: SHOP_REQUIRED retail ids persist + submit reload
{
  assert.match(hookSrc, /resolveEventOutfitHistoryPieces/);
  assert.match(hookSrc, /loadEventRecentOutfitHistory\(user\.id\)/);
  assert.match(extractSrc, /resolveEventOutfitHistoryPieces/);
  assert.match(extractSrc, /retailOutfit/);
  assert.doesNotMatch(historySrc, /eventType|dressCode|occasion/);
  assert.match(historySrc, /@dripn_event_recent_outfits_\$\{userId\}/);
}

// Request A: formal wedding SHOP_REQUIRED Surprise Me
const requestAResult = {
  displayState: 'SHOP_REQUIRED',
  status: 'SHOP_REQUIRED',
  type: 'shop_required',
  outfitPieces: null,
  retailOutfit: {
    products: [
      { id: 'fw-f-top-blouse' },
      { id: 'fw-f-bottom-midi' },
      { id: 'fw-f-shoes-heel' },
      { id: 'fw-f-outer-blazer' },
    ],
  },
};
const requestAPieces = resolveEventOutfitHistoryPieces(requestAResult);
assert.ok(requestAPieces, 'Request A must yield persistable identity');
const persistedHistory = extractEventRecentOutfitIdLists([], requestAPieces);
assert.equal(persistedHistory.length, 1);

// Request B: formal/cocktail dinner/date — same user, different event type
const requestBBody = {
  decisionType: 'event_outfit',
  surpriseMe: true,
  eventDetails: {
    eventType: 'dinner',
    dressCode: 'cocktail',
    timeOfDay: 'evening_out',
  },
  recentOutfits: persistedHistory,
};
const normalized = normalizeDecisionRecentOutfits(requestBBody);
const recentOutfitCount = normalized.length;
assert.ok(recentOutfitCount >= 1, 'Request B must carry Request A history');
assert.deepEqual(normalized[0], [
  'fw-f-top-blouse',
  'fw-f-bottom-midi',
  'fw-f-shoes-heel',
  'fw-f-outer-blazer',
]);

// Different users do not share history (key is per userId)
{
  assert.match(historySrc, /HISTORY_KEY = \(userId: string\) => `@dripn_event_recent_outfits_\$\{userId\}`/);
  assert.doesNotMatch(historySrc, /global|shared|all_users/i);
}

// No allocator/ranking hooks touched in this RC
{
  assert.doesNotMatch(hookSrc, /allocateWithMode|beam|rankOutfit|softRepeatPenalty/);
  assert.doesNotMatch(extractSrc, /allocateWithMode|beam|rankOutfit|softRepeatPenalty/);
}

console.log('All event recent-outfit history checks passed.');
console.log(`REQUEST B recentOutfitCount=${recentOutfitCount}`);
