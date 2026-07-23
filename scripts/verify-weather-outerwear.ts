/**
 * Hard weather outerwear gates — fleece/puffer impossible when hot (client).
 * Run: npx tsx scripts/verify-weather-outerwear.ts
 */
import type { WardrobeItem } from '../contexts/WardrobeContext';
import { isOuterwearItem } from '../utils/completeOutfit';
import { allocateSingleDayOutfit } from '../utils/wardrobeAllocationEngine';
import {
  WEATHER_OUTERWEAR_THRESHOLDS_C,
  filterOuterwearCandidatesForWeather,
  isHeavyOuterwear,
  isLightOuterwear,
  outerwearWeatherPolicy,
  stripIllegalOuterwearForWeather,
} from '../utils/weatherOuterwear';

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

const tee = item({ id: 'tee', category: 'tops', name: 'White Tee', color: 'white' });
const chinos = item({ id: 'chinos', category: 'bottoms', name: 'Khaki Chinos', color: 'beige' });
const trainers = item({ id: 'trainers', category: 'shoes', name: 'White Trainers', color: 'white' });
const fleece = item({
  id: 'fleece',
  category: 'outerwear',
  name: 'Black Full-Zip Fleece Jacket',
  color: 'black',
  subcategory: 'fleece',
});
const puffer = item({
  id: 'puffer',
  category: 'outerwear',
  name: 'Navy Puffer Jacket',
  color: 'navy',
});
const blazer = item({
  id: 'blazer',
  category: 'outerwear',
  name: 'Navy Blazer',
  color: 'navy',
});

const wardrobe = [tee, chinos, trainers, fleece, puffer, blazer];

console.log('=== Weather outerwear hard gates (StyleWise) ===\n');
console.log('Thresholds °C:', WEATHER_OUTERWEAR_THRESHOLDS_C);

assert(isHeavyOuterwear(fleece), 'full-zip fleece must be heavy');
assert(isHeavyOuterwear(puffer), 'puffer must be heavy');
assert(!isHeavyOuterwear(blazer), 'blazer must not be heavy');
assert(isLightOuterwear(blazer), 'blazer must be light');

assert(outerwearWeatherPolicy(25).forceEmpty === true, '25°C forceEmpty');
assert(outerwearWeatherPolicy(22).blockHeavy === true, '22°C blockHeavy');
assert(outerwearWeatherPolicy(8).requireWhenAvailable === true, '8°C require');

assert(
  filterOuterwearCandidatesForWeather([fleece, puffer, blazer], { temperature: 25 }).length === 0,
  '25°C pool empty',
);
assert(
  !filterOuterwearCandidatesForWeather([fleece, puffer, blazer], { temperature: 22 })
    .some((i) => i.id === 'fleece' || i.id === 'puffer'),
  '22°C excludes fleece/puffer',
);

{
  const stripped = stripIllegalOuterwearForWeather(
    [tee, chinos, trainers, fleece],
    { temperature: 25, condition: 'clear' },
  );
  assert(!stripped.some((i) => i.id === 'fleece'), 'strip removes fleece at 25°C');
}

{
  const result = allocateSingleDayOutfit({
    wardrobe,
    occasionType: 'casual_day',
    weather: { temperature: 25, condition: 'clear' },
  });
  assert(result.ok, `25°C allocate ok: ${'message' in result ? result.message : ''}`);
  if (result.ok) {
    assert(!result.itemIds.includes('fleece'), '25°C NEVER includes fleece');
    assert(!result.itemIds.includes('puffer'), '25°C NEVER includes puffer');
    assert(result.items.filter(isOuterwearItem).length === 0, '25°C zero outerwear');
    console.log('  25°C:', result.items.map((i) => i.name).join(' + '));
  }
}

{
  const result = allocateSingleDayOutfit({
    wardrobe,
    occasionType: 'casual_day',
    weather: { temperature: 8, condition: 'clear' },
  });
  assert(result.ok, '8°C allocate ok');
  if (result.ok) {
    assert(result.items.some(isOuterwearItem), '8°C requires outerwear when available');
    console.log('  8°C:', result.items.map((i) => i.name).join(' + '));
  }
}

console.log('\nAll StyleWise weather-outerwear hard-gate checks passed.');
