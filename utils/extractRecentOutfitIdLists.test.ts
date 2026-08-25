/**
 * recentOutfits extraction for Chat diversity — newest first, wardrobeVisual preferred.
 * Run: npx tsx utils/extractRecentOutfitIdLists.test.ts
 *
 * (Mirrors AIStylistScreen helper — keep in sync if that helper moves.)
 */
import assert from 'node:assert/strict';

type Msg = {
  role: string;
  wardrobeVisual?: { pieces?: Array<{ wardrobeItemId?: string; id?: string }> } | null;
  looks?: Array<{ itemIds?: Array<string | number> }>;
  outfitSuggestion?: { items?: Array<{ id?: string | number }> };
};

function extractRecentOutfitIdLists(messages: Msg[], limit = 5): string[][] {
  const out: string[][] = [];
  for (let i = messages.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    let ids: string[] = [];
    const pieces = msg.wardrobeVisual?.pieces;
    if (Array.isArray(pieces) && pieces.length) {
      ids = pieces
        .map((p) => p?.wardrobeItemId ?? p?.id)
        .filter((id) => id != null && String(id).trim())
        .map(String);
    }
    if (ids.length < 2 && Array.isArray(msg.looks?.[0]?.itemIds) && msg.looks[0].itemIds.length) {
      ids = msg.looks[0].itemIds.map(String);
    }
    if (ids.length < 2 && Array.isArray(msg.outfitSuggestion?.items) && msg.outfitSuggestion.items.length) {
      ids = msg.outfitSuggestion.items
        .map((it) => String(it?.id || ''))
        .filter(Boolean);
    }
    if (ids.length >= 2) out.push(ids);
  }
  return out;
}

{
  // Visual strip only (no outfitSuggestion) — previously missed → empty recentOutfits
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
    { role: 'user', content: 'again' } as Msg,
  ]);
  assert.deepEqual(lists[0], ['59', '84', '122']);
}

{
  // Newest first when multiple looks
  const lists = extractRecentOutfitIdLists([
    {
      role: 'assistant',
      wardrobeVisual: { pieces: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    },
    { role: 'user' } as Msg,
    {
      role: 'assistant',
      wardrobeVisual: { pieces: [{ id: '59' }, { id: '84' }, { id: '122' }] },
    },
  ]);
  assert.deepEqual(lists[0], ['59', '84', '122'], 'most recent look must be [0] for diversityBan*');
  assert.deepEqual(lists[1], ['1', '2', '3']);
}

console.log('extractRecentOutfitIdLists: PASS');
