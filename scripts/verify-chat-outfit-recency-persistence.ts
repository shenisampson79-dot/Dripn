/**
 * Chat outfit recency persistence + cross-source merge regression.
 * Run: npx tsx scripts/verify-chat-outfit-recency-persistence.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CHAT_OUTFIT_RECENCY_MAX_LISTS,
  prependChatOutfitIdList,
  outfitItemIdsFromPublishedTurn,
} from '../utils/chatRecentOutfitHistory';
import {
  mergeOutfitRecencyLists,
  MERGED_OUTFIT_RECENCY_MAX,
} from '../utils/mergeChatOutfitRecencySources';

const root = resolve(import.meta.dirname, '..');
const screenSrc = readFileSync(resolve(root, 'screens/AIStylistScreen.tsx'), 'utf8');
const chatHistorySrc = readFileSync(resolve(root, 'utils/chatRecentOutfitHistory.ts'), 'utf8');
const mergeSrc = readFileSync(resolve(root, 'utils/mergeChatOutfitRecencySources.ts'), 'utf8');

const REPEAT = ['59', '155', '121', '50'];

// A. Persist tuple helper
{
  const next = prependChatOutfitIdList([], REPEAT);
  assert.deepEqual(next[0], REPEAT);
  assert.equal(next.length, 1);
}

// B. Survives transcript-reset semantics (prepend after "clear" = empty live messages)
{
  const afterClearLive: string[][] = [];
  const persisted = prependChatOutfitIdList([], REPEAT);
  const merged = mergeOutfitRecencyLists([...afterClearLive, ...persisted]);
  assert.ok(
    merged.some((tuple) => tuple.join(',') === REPEAT.join(',')),
    'persisted Chat recency survives empty live messages',
  );
}

// C. Merge dedupe + bound
{
  const merged = mergeOutfitRecencyLists([
    ['59', '155', '121', '50'],
    ['59', '155', '121', '50'],
    ['10', '11', '12'],
    ['20', '21', '22'],
    ['30', '31', '32'],
    ['40', '41', '42'],
    ['50', '51', '52'],
    ['60', '61', '62'],
    ['70', '71', '72'],
  ], MERGED_OUTFIT_RECENCY_MAX);
  assert.equal(merged.length, MERGED_OUTFIT_RECENCY_MAX);
  assert.deepEqual(merged[0], REPEAT);
  assert.ok(!merged.some((t, i) => merged.findIndex((u) => u.join() === t.join()) !== i));
}

// D. Cross-source merge order: live → persisted chat → event → gon
{
  const merged = mergeOutfitRecencyLists([
    ...extractOrderFixture().live,
    ...extractOrderFixture().persistedChat,
    ...extractOrderFixture().event,
    ...extractOrderFixture().gon,
  ]);
  assert.deepEqual(merged[0], ['1', '2', '3']);
  assert.ok(merged.some((t) => t.join() === '59,155,121,50'));
}

function extractOrderFixture() {
  return {
    live: [['1', '2', '3']],
    persistedChat: [['59', '155', '121', '50']],
    event: [['4', '5', '6']],
    gon: [['7', '8', '9']],
  };
}

// Published turn id extraction
{
  const ids = outfitItemIdsFromPublishedTurn(
    {
      role: 'assistant',
      wardrobeVisual: {
        pieces: [
          { wardrobeItemId: '59' },
          { wardrobeItemId: '155' },
          { wardrobeItemId: '121' },
          { wardrobeItemId: '50' },
        ],
      },
    },
    null,
  );
  assert.deepEqual(ids, REPEAT);
}

// Wiring: clearChat must NOT clear outfit recency store
{
  assert.match(screenSrc, /resolveChatOutfitRecencyForRequest/);
  assert.match(screenSrc, /appendChatRecentOutfitHistory/);
  assert.doesNotMatch(screenSrc, /clearChatRecentOutfitHistory/);
  assert.match(chatHistorySrc, /@dripn_chat_recent_outfits_\$\{userId\}/);
  assert.match(mergeSrc, /loadEventRecentOutfitHistory/);
  assert.match(mergeSrc, /loadGetOutfitsSession/);
  assert.match(mergeSrc, /loadChatRecentOutfitHistory/);
  assert.equal(CHAT_OUTFIT_RECENCY_MAX_LISTS, 7);
}

console.log('verify-chat-outfit-recency-persistence — all passed');
