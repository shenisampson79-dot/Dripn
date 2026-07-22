/**
 * Safe Rendering Layer chaos / unit checks.
 * Run: npx tsx scripts/verify-safe-render.ts
 */
import {
  sanitizeOutfit,
  sanitizeOutfitPieces,
  sanitizeWardrobeVisual,
  toOutfitViewModel,
} from '../utils/safeRender';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log('=== Safe Render Layer (StyleWise) ===\n');

{
  assert(sanitizeOutfitPieces(null).length === 0, 'null pieces → []');
  assert(sanitizeOutfitPieces(undefined).length === 0, 'undefined pieces → []');
  assert(sanitizeOutfitPieces('bad').length === 0, 'non-array → []');
  assert(sanitizeOutfitPieces([null, undefined, 3, 'x']).length === 0, 'null/primitive entries dropped');
}

{
  const ok = sanitizeOutfitPieces([
    { wardrobeItemId: 'abc', name: 'Navy Blazer' },
    { wardrobeItemId: 42, imageUrl: 'https://example.com/a.jpg' },
    { name: 'Name only shoe' },
    null,
    { wardrobeItemId: null },
    { wardrobeItemId: '' },
    {},
  ], { log: false });
  assert(ok.length === 3, `valid pieces kept (got ${ok.length})`);
  assert(ok[0].wardrobeItemId === 'abc', 'string id preserved');
  assert(ok[1].wardrobeItemId === 42, 'numeric id preserved');
}

{
  // ID-only pieces pending client hydrate must NOT be dropped.
  const pending = sanitizeOutfitPieces([
    { wardrobeItemId: '50', name: 'Cavani Blazer', imageUrl: null },
    { wardrobeItemId: 59, name: 'Primark Tee', imageUrl: '' },
    { wardrobeItemId: '45', name: 'Khaki Cargos' },
  ], { log: false });
  assert(pending.length === 3, `id-only pending hydrate kept (got ${pending.length})`);
  const visual = sanitizeWardrobeVisual({
    layout: 'stacked',
    source: 'wardrobe',
    pieces: pending,
  }, { log: false });
  assert(visual != null && visual.pieces.length === 3, 'wardrobeVisual with id-only pieces stays renderable');
}

{
  assert(sanitizeOutfit(null) === null, 'null outfit → null');
  assert(sanitizeOutfit({ pieces: [null] }) === null, 'outfit with only null pieces → null');
  const o = sanitizeOutfit({ title: 'Look 1', sectionIndex: 2, pieces: [{ name: 'Tee' }] });
  assert(o != null && o.pieces.length === 1 && o.sectionIndex === 2, 'valid outfit sanitized');
}

{
  assert(sanitizeWardrobeVisual(null) === null, 'null visual → null');
  assert(sanitizeWardrobeVisual({ layout: 'stacked', pieces: [null, {}] }) === null, 'all-bad stacked → null');
  const stacked = sanitizeWardrobeVisual({
    layout: 'stacked',
    pieces: [{ wardrobeItemId: '1', name: 'Top' }, null, { name: 'Bottom' }],
  });
  assert(stacked != null && stacked.layout === 'stacked' && stacked.pieces.length === 2, 'stacked strips nulls');

  const multi = sanitizeWardrobeVisual({
    layout: 'multi',
    outfits: [
      { sectionIndex: 0, pieces: [null] },
      { sectionIndex: 1, pieces: [{ name: 'Dress' }, { wardrobeItemId: '9' }] },
    ],
  });
  assert(multi != null && multi.layout === 'stacked' && multi.pieces.length === 2, 'multi collapses to one valid outfit');
}

{
  assert(toOutfitViewModel(null) === null, 'VM null');
  assert(toOutfitViewModel([null]) === null, 'VM empty after sanitize');
  const vm = toOutfitViewModel([{ wardrobeItemId: 'w1', imageUrl: 'https://x' }], { label: 'Test' });
  assert(vm != null && vm.pieces.length === 1 && vm.label === 'Test', 'VM from pieces array');
}

// Must never throw on garbage
{
  const garbage = [undefined, null, 0, false, '', { pieces: null }, { layout: 'multi' }, [[[]]]];
  for (const g of garbage) {
    sanitizeOutfitPieces(g as any);
    sanitizeOutfit(g);
    sanitizeWardrobeVisual(g as any);
    toOutfitViewModel(g);
  }
  assert(true, 'garbage inputs never throw');
}

console.log('All safe-render checks passed.');
