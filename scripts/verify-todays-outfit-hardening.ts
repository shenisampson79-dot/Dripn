/**
 * Today's outfit hardening checks — local path, labels, timeout budget, clash rules.
 * Run: npx tsx scripts/verify-todays-outfit-hardening.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { WardrobeItem } from '../contexts/WardrobeContext';
import { isOutfitValid } from '../utils/outfitClashRules';
import { outfitMeetsOccasionStandard } from '../utils/fashionEditorialRubric';
import {
  allocateSingleDayOutfit,
  SINGLE_DAY_POOL_CAP,
} from '../utils/wardrobeAllocationEngine';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

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

const dressShirt = item({ id: 'dress-shirt', category: 'tops', name: 'White Dress Shirt', color: 'white' });
const chinos = item({ id: 'chinos', category: 'bottoms', name: 'Khaki Chinos', color: 'beige' });
const loafers = item({ id: 'loafers', category: 'shoes', name: 'Brown Loafers', color: 'brown' });
const tie = item({ id: 'tie', category: 'accessories', name: 'Silk Tie', color: 'burgundy' });
const graphicTee = item({ id: 'tee', category: 'tops', name: 'Graphic T-Shirt', color: 'white' });
const jeans = item({ id: 'jeans', category: 'bottoms', name: 'Blue Jeans', color: 'denim' });
const trainers = item({ id: 'trainers', category: 'shoes', name: 'White Trainers', color: 'white' });
const hoodie = item({ id: 'hoodie', category: 'outerwear', name: 'Black Hoodie', color: 'black' });
const joggers = item({ id: 'joggers', category: 'bottoms', name: 'Black Joggers', color: 'black' });

console.log('=== Today\'s outfit hardening (StyleWise) ===\n');

const generatorSource = readFileSync(
  resolve(__dirname, '../services/TodaysOutfitGenerator.ts'),
  'utf8',
);
const generatedSource = readFileSync(
  resolve(__dirname, '../utils/generatedOutfit.ts'),
  'utf8',
);
const cardSource = readFileSync(
  resolve(__dirname, '../components/TodaysOutfitCard.tsx'),
  'utf8',
);
const traceSource = readFileSync(
  resolve(__dirname, '../utils/todaysOutfitTrace.ts'),
  'utf8',
);

assert(SINGLE_DAY_POOL_CAP <= 16, 'single-day pool must be bounded');
assert(
  generatorSource.includes('TODAYS_OUTFIT_GENERATION_BUDGET_MS = 2000'),
  'generation budget must be 2s',
);
assert(
  generatorSource.includes('void enrichOutfitWeatherInBackground'),
  'weather must enrich in background only',
);
assert(
  generatorSource.includes('Promise.race') && generatorSource.includes('fetchWeatherSnapshot'),
  'weather fetch must be time-boxed via Promise.race',
);
assert(generatorSource.includes('generateLocalTiered'), 'tiered local fallback must exist');
assert(
  generatorSource.includes("'strict'")
    && generatorSource.includes("'relaxed'")
    && generatorSource.includes("'minimal'")
    && generatorSource.includes("'emergency'"),
  'all fallback tiers must be present',
);
assert(generatorSource.includes('stableTodaysOutfitId'), 'stable outfit id helper required');
assert(generatorSource.includes('reconcileHonestOccasion'), 'label must be derived after validation');
assert(generatedSource.includes('skipDecorate'), 'skipDecorate flag must exist');
assert(cardSource.includes("'idle' | 'loading' | 'ready' | 'error'"), 'card state machine types required');
assert(cardSource.includes('actionOutfitIdRef'), 'stable outfit id gate required for actions');
assert(cardSource.includes('prewarmTodaysWardrobeOutfit'), 'prewarm at launch required');
assert(traceSource.includes('traceTodaysOutfit'), 'debug trace helper required');

const work = allocateSingleDayOutfit({
  wardrobe: [hoodie, graphicTee, joggers, trainers, dressShirt, chinos, loafers, tie],
  occasionType: 'work_outfit',
});
assert(work.ok === true, 'work allocation must succeed');
if (work.ok) {
  assert(!work.itemIds.includes('hoodie'), 'work_outfit must filter hoodies');
  assert(!work.itemIds.includes('joggers'), 'work_outfit must filter joggers');
  assert(!work.itemIds.includes('trainers'), 'work_outfit must filter trainers');
  assert(isOutfitValid(work.items), 'allocator work outfit must pass fatal/major gate');
  assert(outfitMeetsOccasionStandard(work.items, 'work_outfit'), 'work label must match allocated items');
}

const casual = allocateSingleDayOutfit({
  wardrobe: [graphicTee, jeans, trainers, tie],
  occasionType: 'casual_day',
});
assert(casual.ok === true, 'casual allocation must succeed');
if (casual.ok) {
  assert(!casual.itemIds.includes('tie'), 'tie must not attach to tee');
  assert(isOutfitValid(casual.items), 'casual outfit must be hard-valid');
}

console.log('All Today\'s outfit hardening checks passed.');
