/**
 * Client mirror of server scripts/test-outfit-compatibility-guard.mjs
 * Run: npx tsx utils/outfitCompatibilityGuard.test.ts
 */
import assert from 'node:assert/strict';
import {
  COMPAT_CODES,
  outfitCompatibilityGuard,
  presentCanonicalOutfit,
  canonicalItemIds,
  assertStripMatchesCanonical,
} from './outfitCompatibilityGuard.ts';
import type { WardrobeItem } from '@/contexts/WardrobeContext';

function item(id: string, name: string, category: string): WardrobeItem {
  return { id, name, category } as WardrobeItem;
}

const pairing = { requireCoreRoles: false as const, mode: 'diagnose' as const };

const singlet = item('singlet', 'Asics running singlet', 'activewear_tops');
const runShorts = item('run-shorts', 'Nike running shorts', 'activewear_bottoms');
const trainers = item('trainers', 'Nike running trainers', 'shoes');
const blazer = item('blazer', 'Cavani grey windowpane blazer', 'outerwear');
const trousers = item('trousers', 'Next black slim trousers', 'bottoms');
const insulated = item('rab', 'Rab insulated winter jacket', 'outerwear');
const whiteTee = item('tee', 'White cotton t-shirt', 'tops');
const chinos = item('chinos', 'Beige chinos', 'bottoms');
const loafers = item('loafers', 'Brown leather loafers', 'shoes');
const dressShirt = item('shirt', 'White dress shirt', 'tops');
const tie = item('tie', 'Navy silk necktie', 'accessories');
const hoodie = item('hoodie', 'Grey pullover hoodie', 'tops');
const swimShorts = item('swim', 'Navy swim shorts', 'swimwear');
const slides = item('slides', 'Black pool slides', 'shoes');
const dress = item('dress', 'Black midi dress', 'dresses');
const heels = item('heels', 'Nude court heels', 'shoes');
const pullover = item('pullover', 'Nike athletic pullover', 'tops');
const joggers = item('joggers', 'Black joggers', 'bottoms');
const casualTrainers = item('nb', 'New Balance lifestyle trainers', 'shoes');
const winterCoat = item('coat', 'Navy winter coat', 'outerwear');
const beachShorts = item('linen-shorts', 'Linen beach shorts', 'bottoms');
const chinoShorts = item('chino-shorts', 'Khaki chino shorts', 'bottoms');
const boatShoes = item('boat', 'Brown boat shoes', 'shoes');

function expectPass(label: string, items: WardrobeItem[]) {
  const g = outfitCompatibilityGuard(items, pairing);
  assert.equal(g.passed, true, `${label} should PASS, got ${JSON.stringify(g.passed ? [] : g.reasons)}`);
}

function expectReject(label: string, items: WardrobeItem[], code: string) {
  const g = outfitCompatibilityGuard(items, pairing);
  assert.equal(g.passed, false, `${label} should REJECT`);
  if (!g.passed) {
    assert.ok(
      g.reasons.some((r) => r.code === code || r.clashId === code || r.detail === code),
      `${label} expected ${code}, got ${g.reasons.map((r) => r.code).join(',')}`,
    );
  }
}

expectPass('running singlet + running shorts + trainers', [singlet, runShorts, trainers]);
expectReject('running singlet + blazer + tailored trousers', [singlet, blazer, trousers], COMPAT_CODES.ATHLETIC_TAILORED_CLASH);
expectReject('running singlet + insulated winter jacket', [singlet, insulated], COMPAT_CODES.THERMAL_MISMATCH);
expectPass('white tee + blazer + chinos + loafers', [whiteTee, blazer, chinos, loafers]);
expectPass('dress shirt + tie + tailored trousers + loafers', [dressShirt, tie, trousers, loafers]);
expectReject('hoodie + formal tie', [hoodie, tie], COMPAT_CODES.FORMALITY_MISMATCH);
expectPass('swim shorts + slides', [swimShorts, slides]);
expectPass('one-piece dress + shoes', [dress, heels]);
expectPass('athletic pullover + tee + joggers + trainers', [pullover, whiteTee, joggers, casualTrainers]);
expectReject('winter coat + lightweight beach shorts', [winterCoat, beachShorts], COMPAT_CODES.THERMAL_MISMATCH);
expectPass('chino shorts + boat shoes', [chinoShorts, boatShoes]);

const incomplete = outfitCompatibilityGuard([blazer, trousers], { requireCoreRoles: true, mode: 'generate' });
assert.equal(incomplete.passed, false, 'blazer + trousers must fail missing roles in generate mode');

const presented = presentCanonicalOutfit([whiteTee, blazer, chinos, loafers], { source: 'qsc' });
assert.ok(presented, 'canonical freeze of a passing look');
assert.ok(presented && assertStripMatchesCanonical(canonicalItemIds(presented), presented), 'strip IDs === canonical IDs');
assert.equal(presentCanonicalOutfit([singlet, insulated], { source: 'chat' }), null, 'failed look is not presented');

console.log('client outfitCompatibilityGuard: 10 launch cases + completeness + canonical freeze passed');
