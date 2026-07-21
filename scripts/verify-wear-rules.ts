/**
 * Wear / reuse constraint checks for wardrobe allocation.
 * Run: npx tsx scripts/verify-wear-rules.ts
 */
import type { WardrobeItem } from '../contexts/WardrobeContext';
import { allocateSingleDayOutfit } from '../utils/wardrobeAllocationEngine';
import {
  applyWearIncrement,
  canWearItem,
  DEFAULT_LAUNDRY_PROFILE,
  getEffectiveWearRule,
} from '../utils/wearRules';

function item(partial: Partial<WardrobeItem> & Pick<WardrobeItem, 'id' | 'category' | 'name'>): WardrobeItem {
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

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const today = new Date('2026-07-21T12:00:00Z');
const top = item({
  id: 'top1',
  category: 'tops',
  name: 'White Tee',
  lastWorn: '2026-07-20T12:00:00Z',
  wearCountSinceWash: 0,
});
const bottom = item({ id: 'bot1', category: 'bottoms', name: 'Jeans' });
const shoes = item({ id: 'shoe1', category: 'shoes', name: 'Sneakers' });

console.log('=== Wear rules (StyleWise) ===\n');

assert(!canWearItem({ ...top, isDirty: true }, today), 'dirty items must never pass canWearItem');

const afterWear = applyWearIncrement(top, DEFAULT_LAUNDRY_PROFILE, today);
const rule = getEffectiveWearRule(top, DEFAULT_LAUNDRY_PROFILE);
assert(
  afterWear.isDirty === afterWear.wearCountSinceWash >= rule.wearsBeforeWash,
  'wear increment should mark dirty at max wears',
);

const dirtyTop = item({ ...top, isDirty: true });
const cleanPool = allocateSingleDayOutfit({
  wardrobe: [dirtyTop, bottom, shoes],
  occasionType: 'casual_day',
});
assert(cleanPool.ok === false, 'allocator must fail when only top is dirty');

const freshTop = item({ id: 'top2', category: 'tops', name: 'Fresh Tee' });
const withFresh = allocateSingleDayOutfit({
  wardrobe: [dirtyTop, freshTop, bottom, shoes],
  occasionType: 'casual_day',
});
assert(withFresh.ok === true, 'allocator should skip dirty item when clean alternative exists');
if (withFresh.ok) {
  assert(!withFresh.itemIds.includes(String(dirtyTop.id)), 'dirty top must not be allocated');
}

console.log('All StyleWise wear-rules checks passed.');
