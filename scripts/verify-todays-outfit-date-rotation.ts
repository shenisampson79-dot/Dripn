/**
 * Today's Outfit dateKey + soft anti-repeat checks.
 * Run: npx tsx scripts/verify-todays-outfit-date-rotation.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { localDateKey, TODAYS_OUTFIT_ANTI_REPEAT_DAYS } from '../utils/localDateKey';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import { allocateSingleDayOutfit } from '../utils/wardrobeAllocationEngine';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function item(partial: Partial<WardrobeItem> & Pick<WardrobeItem, 'id' | 'category' | 'name'>): WardrobeItem {
  return {
    userId: 'u1',
    imageUri: '',
    color: 'black',
    seasons: ['all-season'],
    occasions: ['everyday', 'casual', 'work'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

console.log("=== Today's outfit dateKey + anti-repeat ===\n");

const generatorSource = readFileSync(
  resolve(__dirname, '../services/TodaysOutfitGenerator.ts'),
  'utf8',
);
const cardSource = readFileSync(
  resolve(__dirname, '../components/TodaysOutfitCard.tsx'),
  'utf8',
);
const prefsSource = readFileSync(
  resolve(__dirname, '../utils/todaysOutfitPrefs.ts'),
  'utf8',
);

// Local calendar key — not UTC ISO
const localNoon = new Date(2026, 6, 22, 12, 0, 0); // 22 Jul 2026 local
assert(localDateKey(localNoon) === '2026-07-22', 'localDateKey must use local Y-M-D');

const lateUtcSkew = new Date(Date.UTC(2026, 6, 22, 23, 30, 0)); // may be Jul 23 in UTC+ timezones
const localFromSkew = localDateKey(lateUtcSkew);
assert(/^\d{4}-\d{2}-\d{2}$/.test(localFromSkew), 'localDateKey format');
assert(
  !generatorSource.includes("toISOString().slice(0, 10)"),
  'TodaysOutfitGenerator must not use UTC ISO dateKey',
);
assert(
  generatorSource.includes('getRecentTodaysOutfitItemIds')
    || generatorSource.includes('HISTORY_KEY'),
  'anti-repeat history required',
);
assert(
  generatorSource.includes('penalizeItemIds') && generatorSource.includes('priorOutfits'),
  'server + offline anti-repeat wiring required',
);
assert(
  generatorSource.includes('dateKey:') && generatorSource.includes('itemIds:'),
  'generate logging must include dateKey + itemIds',
);
assert(cardSource.includes('day_rollover') || cardSource.includes('ensureFreshForToday'), 'day rollover required');
assert(cardSource.includes('auto_popup') || cardSource.includes('maybeAutoOpenPopup'), 'auto popup required');
assert(prefsSource.includes('getHours()'), 'popup window uses local hours');
assert(TODAYS_OUTFIT_ANTI_REPEAT_DAYS >= 5, 'anti-repeat window should cover several days');

const teeA = item({ id: 'tee-a', category: 'tops', name: 'Cream Tee', color: 'cream' });
const teeB = item({ id: 'tee-b', category: 'tops', name: 'Blue Tee', color: 'blue' });
const pantsA = item({ id: 'pants-a', category: 'bottoms', name: 'Black Trousers', color: 'black' });
const pantsB = item({ id: 'pants-b', category: 'bottoms', name: 'Grey Trousers', color: 'grey' });
const shoesA = item({ id: 'shoes-a', category: 'shoes', name: 'Brown Shoes', color: 'brown' });
const shoesB = item({ id: 'shoes-b', category: 'shoes', name: 'Black Shoes', color: 'black' });
const jacket = item({ id: 'jacket', category: 'outerwear', name: 'Black Puffer', color: 'black' });
const bag = item({ id: 'bag', category: 'accessories', name: 'Tote', color: 'cream', subcategory: 'bag' });

const wardrobe = [teeA, teeB, pantsA, pantsB, shoesA, shoesB, jacket, bag];

const day1 = allocateSingleDayOutfit({
  wardrobe,
  occasionType: 'work_outfit',
});
assert(day1.ok === true, 'day1 allocation must succeed');

const prior = day1.ok ? [day1.items] : [];
const day2 = allocateSingleDayOutfit({
  wardrobe,
  occasionType: 'work_outfit',
  priorOutfits: prior,
});
assert(day2.ok === true, 'day2 allocation must succeed');

if (day1.ok && day2.ok) {
  const sameExact =
    [...day1.itemIds].sort().join('|') === [...day2.itemIds].sort().join('|');
  // Soft diversity should usually break exact repeats when alternatives exist
  assert(
    !sameExact,
    'priorOutfits soft anti-repeat should change the outfit when alternatives exist',
  );
}

console.log('All dateKey + anti-repeat checks passed.');
