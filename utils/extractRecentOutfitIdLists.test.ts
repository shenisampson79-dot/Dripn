/**
 * recentOutfits extraction for Chat diversity — newest first, wardrobeVisual preferred.
 * Run: npx tsx utils/extractRecentOutfitIdLists.test.ts
 */
import assert from 'node:assert/strict';
import { extractCurrentLookItemIds, extractRecentOutfitIdLists } from './extractRecentOutfitIdLists.ts';

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

{
  const stale = {
    role: 'assistant',
    wardrobeVisual: {
      pieces: [
        { wardrobeItemId: '201', name: 'Cavani gray windowpane check blazer' },
        { wardrobeItemId: '142', name: 'Charles Tyrwhitt pink dress shirt' },
        { wardrobeItemId: '88', name: 'NEXT light gray belted chino shorts' },
        { wardrobeItemId: '50', name: 'brown chelsea boots' },
      ],
    },
    looks: [{ itemIds: ['201', '142', '88', '50'] }],
  };
  const displayed = {
    role: 'assistant',
    wardrobeVisual: {
      pieces: [
        { wardrobeItemId: '10', name: 'blue and black checkered button-up shirt' },
        { wardrobeItemId: '20', name: 'Next black coated slim trousers' },
        { wardrobeItemId: '30', name: 'Converse black low-top sneakers' },
        { wardrobeItemId: '40', name: 'Barbour brown quilted jacket' },
      ],
    },
    outfitSuggestion: {
      items: [{ id: '10' }, { id: '20' }, { id: '30' }, { id: '40' }],
    },
  };
  const wardrobe = [
    { id: '10', name: 'blue and black checkered button-up shirt' },
    { id: '20', name: 'Next black coated slim trousers' },
    { id: '30', name: 'Converse black low-top sneakers' },
    { id: '40', name: 'Barbour brown quilted jacket' },
    { id: '201', name: 'Cavani gray windowpane check blazer' },
    { id: '142', name: 'Charles Tyrwhitt pink dress shirt' },
    { id: '88', name: 'NEXT light gray belted chino shorts' },
  ];

  const current = extractCurrentLookItemIds([
    stale,
    { role: 'user' },
    displayed,
    { role: 'user' },
  ], wardrobe);
  assert.deepEqual(current, ['10', '20', '30', '40'], '1: displayed visual IDs are the current look');
  assert.ok(!current.includes('201') && !current.includes('142') && !current.includes('88'), '3: stale IDs excluded');

  const visualWithoutIds = extractCurrentLookItemIds([
    stale,
    { role: 'user' },
    {
      role: 'assistant',
      wardrobeVisual: {
        pieces: [
          { name: 'blue and black checkered button-up shirt' },
          { name: 'Next black coated slim trousers' },
          { name: 'Converse black low-top sneakers' },
          { name: 'Barbour brown quilted jacket' },
        ],
      },
      looks: [{ itemIds: ['201', '142', '88', '50'] }],
    },
  ], wardrobe);
  assert.deepEqual(
    visualWithoutIds,
    ['10', '20', '30', '40'],
    'displayed names must not fall back to stale looks[]',
  );
}

console.log('extractCurrentLookItemIds: PASS');
