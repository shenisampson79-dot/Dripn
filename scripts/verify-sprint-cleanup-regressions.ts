/**
 * Event recent outfit history + Ruby greeting pluralization regressions.
 * Run: npx tsx scripts/verify-sprint-cleanup-regressions.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  extractEventRecentOutfitIdLists,
  outfitPiecesToIdList,
} from '../utils/extractEventRecentOutfitIdLists';
import { getStylistGreeting, STYLISTS } from '../services/PersonalStylistService';

console.log('=== verify-sprint-cleanup-regressions ===\n');

{
  const ids = outfitPiecesToIdList([
    { wardrobeItemId: '1' },
    { wardrobeItemId: '2' },
    { wardrobeItemId: '3' },
  ]);
  assert.deepEqual(ids, ['1', '2', '3']);
  const lists = extractEventRecentOutfitIdLists([], [
    { wardrobeItemId: '10' },
    { wardrobeItemId: '11' },
    { wardrobeItemId: '12' },
  ]);
  assert.equal(lists.length, 1);
  assert.deepEqual(lists[0], ['10', '11', '12']);
}

{
  const greeting = getStylistGreeting(
    STYLISTS.ruby,
    'Alex',
    (key) => {
      if (key === 'aiStylist.welcomeReady') {
        return "Hello {name}! I've been through your wardrobe — {count} pieces, with {tops} tops, {bottoms} bottoms, and {shoes} pairs of shoes.";
      }
      return '';
    },
    { totalOwned: 8, tops: 1, bottoms: 3, shoes: 1 },
  );
  assert.match(greeting, /1 top,/);
  assert.match(greeting, /1 pair of shoes/);
  assert.doesNotMatch(greeting, /1 tops/);
  assert.doesNotMatch(greeting, /1 pairs of shoes/);
}

{
  const flowSrc = readFileSync(resolve(__dirname, '../components/stylist/StylistDecisionFlow.tsx'), 'utf8');
  assert.match(flowSrc, /eventHasDisplayableImage/);
}

{
  const hookSrc = readFileSync(resolve(__dirname, '../hooks/useStylistDecision.ts'), 'utf8');
  assert.match(hookSrc, /recentOutfits/);
  assert.match(hookSrc, /eventRecentOutfitsRef/);
  assert.match(hookSrc, /loadEventRecentOutfitHistory/);
  assert.match(hookSrc, /appendEventRecentOutfitHistory/);
}

{
  const chatSrc = readFileSync(resolve(__dirname, '../screens/AIStylistScreen.tsx'), 'utf8');
  assert.match(chatSrc, /renderStickyChatHeader/);
  assert.match(chatSrc, /outfitPublished/);
}

console.log('All sprint cleanup regression checks passed.');
