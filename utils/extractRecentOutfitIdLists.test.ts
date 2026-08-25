/**
 * recentOutfits extraction for Chat diversity — newest first, wardrobeVisual preferred.
 * Run: npx tsx utils/extractRecentOutfitIdLists.test.ts
 */
import assert from 'node:assert/strict';
import { extractRecentOutfitIdLists } from './extractRecentOutfitIdLists.ts';

{
  // Visual strip only (no outfitSuggestion) — must not produce []
  const lists = extractRecentOutfitIdLists([
    {
      role: 'assistant',
      wardrobeVisual: {
        pieces: [
          { wardrobeItemId: '59' },
          { wardrobeItemId: '84' },
          { wardrobeItemId: '122' },
        ],
      },
    },
    { role: 'user' },
  ]);
  assert.deepEqual(lists[0], ['59', '84', '122']);
}

{
  // Newest first when multiple looks
  const lists = extractRecentOutfitIdLists([
    {
      role: 'assistant',
      wardrobeVisual: { pieces: [{ id: '1' }, { id: '2' }, { id: '3' }] },
      outfitSuggestion: { items: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    },
    { role: 'user' },
    {
      role: 'assistant',
      wardrobeVisual: { pieces: [{ id: '59' }, { id: '84' }, { id: '122' }] },
      outfitSuggestion: { items: [{ id: '59' }, { id: '84' }, { id: '122' }] },
    },
  ]);
  assert.deepEqual(lists[0], ['59', '84', '122'], 'most recent look must be [0]');
  assert.deepEqual(lists[1], ['1', '2', '3']);
}

{
  // 3-look payload shape for review
  const lists = extractRecentOutfitIdLists([
    { role: 'assistant', wardrobeVisual: { pieces: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } },
    { role: 'user' },
    { role: 'assistant', wardrobeVisual: { pieces: [{ id: 'd' }, { id: 'e' }, { id: 'f' }] } },
    { role: 'user' },
    { role: 'assistant', wardrobeVisual: { pieces: [{ id: 'g' }, { id: 'h' }, { id: 'i' }] } },
  ], 5);
  assert.deepEqual(lists, [
    ['g', 'h', 'i'],
    ['d', 'e', 'f'],
    ['a', 'b', 'c'],
  ]);
  console.log('3-look recentOutfits payload:', JSON.stringify(lists));
}

console.log('extractRecentOutfitIdLists: PASS');
