/**
 * Hard outfit validity in the wardrobe allocator.
 * Run: npx tsx scripts/verify-allocator-hard-validity.ts
 */
import type { WardrobeItem } from '../contexts/WardrobeContext';
import { isOutfitValid, detectOutfitClashes } from '../utils/outfitClashRules';
import { allocateSingleDayOutfit } from '../utils/wardrobeAllocationEngine';

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

const dressShirt = item({ id: 'dress-shirt', category: 'tops', name: 'White Dress Shirt', color: 'white' });
const graphicTee = item({ id: 'tee', category: 'tops', name: 'Graphic T-Shirt', color: 'white' });
const crewNeck = item({ id: 'crew', category: 'tops', name: 'Navy Crew Neck', color: 'navy' });
const hoodie = item({ id: 'hoodie', category: 'outerwear', name: 'Black Puffer Hoodie', color: 'black' });
const joggers = item({ id: 'joggers', category: 'bottoms', name: 'Black Joggers', color: 'black' });
const chinos = item({ id: 'chinos', category: 'bottoms', name: 'Khaki Chinos', color: 'beige' });
const loafers = item({ id: 'loafers', category: 'shoes', name: 'Brown Loafers', color: 'brown' });
const tie = item({ id: 'tie', category: 'accessories', name: 'Silk Tie', color: 'burgundy' });
const trainers = item({ id: 'trainers', category: 'shoes', name: 'White Trainers', color: 'white' });
const jeans = item({ id: 'jeans', category: 'bottoms', name: 'Blue Jeans', color: 'denim' });

console.log('=== Allocator hard validity (StyleWise) ===\n');

assert(!isOutfitValid([tie, graphicTee, chinos, loafers]), 'tie + t-shirt must be invalid');
assert(detectOutfitClashes([tie, graphicTee])?.id === 'tie_tshirt', 'tie + t-shirt → tie_tshirt');
assert(!isOutfitValid([tie, crewNeck, chinos, loafers]), 'tie + crew neck must be invalid');
assert(isOutfitValid([tie, dressShirt, chinos, loafers]), 'tie + dress shirt must be valid');

const allocated = allocateSingleDayOutfit({
  wardrobe: [graphicTee, jeans, trainers, tie],
  occasionType: 'casual_day',
});
assert(allocated.ok === true, `expected allocation ok, got ${JSON.stringify(allocated)}`);
if (allocated.ok) {
  assert(!allocated.itemIds.includes('tie'), `tie must not attach to tee, got ${allocated.itemIds.join(',')}`);
  assert(isOutfitValid(allocated.items), 'allocated tee outfit must be hard-valid');
}

const formal = allocateSingleDayOutfit({
  wardrobe: [dressShirt, chinos, loafers, tie],
  occasionType: 'work_outfit',
});
assert(formal.ok === true, `expected formal allocation ok, got ${JSON.stringify(formal)}`);
if (formal.ok) {
  assert(isOutfitValid(formal.items), 'allocated dress-shirt outfit must be hard-valid');
  if (formal.itemIds.includes('tie')) {
    assert(formal.itemIds.includes('dress-shirt'), 'tie only with dress shirt');
  }
}

const workMixed = allocateSingleDayOutfit({
  wardrobe: [hoodie, graphicTee, joggers, trainers, dressShirt, chinos, loafers],
  occasionType: 'work_outfit',
});
assert(workMixed.ok === true, `expected mixed wardrobe work allocation, got ${JSON.stringify(workMixed)}`);
if (workMixed.ok) {
  assert(!workMixed.itemIds.includes('hoodie'), 'work_outfit must not pick hoodies');
  assert(!workMixed.itemIds.includes('joggers'), 'work_outfit must not pick joggers');
  assert(!workMixed.itemIds.includes('trainers'), 'work_outfit must not pick trainers');
  assert(isOutfitValid(workMixed.items), 'work outfit must be hard-valid');
}

console.log('All StyleWise allocator hard-validity checks passed.');
