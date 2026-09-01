/**
 * P1-A — optional outerwear beam monopoly guard (deterministic).
 * Run: npx tsx scripts/verify-beam-optional-outerwear-diversity.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  beamHasOptionalOuterwearMonopoly,
  beamOptionalOuterwearIds,
  ensureBeamOptionalOuterwearDiversity,
} from '../utils/beamOptionalOuterwearDiversity';
import { finalizeOptionalOuterwearBeam } from '../utils/wardrobeAllocationEngine';

function item(
  partial: Partial<WardrobeItem> & Pick<WardrobeItem, 'id' | 'category' | 'name'>,
): WardrobeItem {
  return {
    userId: 'u1',
    imageUri: '',
    color: 'grey',
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function trio(topId: string, bottomId: string, shoeId: string) {
  return [
    item({ id: topId, category: 'tops', name: `Top ${topId}`, color: 'white' }),
    item({ id: bottomId, category: 'bottoms', name: `Bottom ${bottomId}`, color: 'navy' }),
    item({ id: shoeId, category: 'shoes', name: `Shoe ${shoeId}`, color: 'brown' }),
  ];
}

const outerwearPool = [
  item({ id: '49', category: 'outerwear', name: 'Navy Blazer', color: 'navy' }),
  item({ id: '50', category: 'outerwear', name: 'Grey Blazer', color: 'grey' }),
  item({ id: '107', category: 'outerwear', name: 'Black Blazer', color: 'black' }),
  item({ id: '111', category: 'outerwear', name: 'Charcoal Blazer', color: 'charcoal' }),
  item({ id: '131', category: 'outerwear', name: 'Brown Blazer', color: 'brown' }),
];

function findAlt(base: WardrobeItem[], exclude: Set<string>) {
  return outerwearPool.find((ow) => !exclude.has(String(ow.id)));
}

// A — monopoly broken when alternatives exist
const monopolizedBeam = Array.from({ length: 12 }, (_, i) => ({
  score: 1000 - i,
  items: [...trio(`t${i}`, `b${i}`, `s${i}`), outerwearPool[1]], // all id 50
}));
assert.equal(beamHasOptionalOuterwearMonopoly(monopolizedBeam), true);
const diversified = ensureBeamOptionalOuterwearDiversity(monopolizedBeam, findAlt);
assert.equal(beamHasOptionalOuterwearMonopoly(diversified), false);
assert.ok(diversified.some((c) => c.items.some((i) => String(i.id) === '50')), 'dominant outerwear still represented');
assert.ok(
  diversified.some((c) => c.items.some((i) => String(i.id) !== '50')),
  'at least one alternative outerwear represented',
);
console.log('A: monopoly broken when alternatives exist — PASS');

// B — highest-ranked outerwear remains represented
const topScore = Math.max(...diversified.map((c) => c.score ?? 0));
const topCandidate = diversified.find((c) => (c.score ?? 0) === topScore)!;
assert.ok(topCandidate.items.some((i) => String(i.id) === '50'), 'top-scored candidate keeps rank-1 outerwear');
console.log('B: highest-ranked outerwear still represented — PASS');

// C — single valid outerwear unchanged
const loneOuterwear = [item({ id: 'only', category: 'outerwear', name: 'Only Blazer', color: 'grey' })];
const loneBeam = Array.from({ length: 4 }, (_, i) => ({
  score: 90 - i,
  items: [...trio(`lt${i}`, `lb${i}`, `ls${i}`), loneOuterwear[0]],
}));
const loneResult = ensureBeamOptionalOuterwearDiversity(loneBeam, () => undefined);
assert.deepEqual(
  loneResult.map((c) => c.items.find((i) => i.category === 'outerwear')?.id),
  loneBeam.map((c) => c.items.find((i) => i.category === 'outerwear')?.id),
);
console.log('C: single valid outerwear unchanged — PASS');

// D — no item-id-specific logic in source
const guardPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../utils/beamOptionalOuterwearDiversity.ts');
const enginePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../utils/wardrobeAllocationEngine.ts');
const guardSrc = fs.readFileSync(guardPath, 'utf8');
const engineSrc = fs.readFileSync(enginePath, 'utf8');
assert.doesNotMatch(guardSrc, /blacklist|banItem|excludeItem/i, 'guard must not blacklist items');
assert.doesNotMatch(engineSrc, /finalizeOptionalOuterwearBeam[\s\S]*\b50\b/, 'allocator hook must not special-case item 50');
console.log('D: no item-id-specific logic — PASS');

// E — non-outerwear slots unchanged
const beforeTopIds = monopolizedBeam.map((c) => c.items.find((i) => i.category === 'tops')?.id);
const afterTopIds = diversified.map((c) => c.items.find((i) => i.category === 'tops')?.id);
assert.deepEqual(beforeTopIds, afterTopIds, 'top slots unchanged');
const beforeBottomIds = monopolizedBeam.map((c) => c.items.find((i) => i.category === 'bottoms')?.id);
const afterBottomIds = diversified.map((c) => c.items.find((i) => i.category === 'bottoms')?.id);
assert.deepEqual(beforeBottomIds, afterBottomIds, 'bottom slots unchanged');
console.log('E: non-outerwear selection unchanged — PASS');

// Allocator hook — finalizeOptionalOuterwearBeam uses same guard
const viaAllocator = finalizeOptionalOuterwearBeam(monopolizedBeam, outerwearPool);
assert.equal(beamHasOptionalOuterwearMonopoly(viaAllocator), false);
const viaIds = new Set(beamOptionalOuterwearIds(viaAllocator));
assert.ok(viaIds.has('50') && viaIds.size >= 2, 'allocator hook preserves dominant + alternative');
console.log('finalizeOptionalOuterwearBeam integration — PASS');

console.log('verify-beam-optional-outerwear-diversity: ok');
