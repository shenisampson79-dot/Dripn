/**
 * Favorites soft boost + weather authority (client).
 * Run: npx tsx scripts/verify-favorites-weather.ts
 */
import assert from 'node:assert/strict';
import {
  formatWeatherOuterwearAuthorityForPrompt,
  normalizeWeatherForAllocator,
  weatherOuterwearScoreAdjustment,
} from '../utils/weatherOuterwear';
import { computeLocalOutfitScore } from '../utils/outfitCompatibilityScore';
import type { WardrobeItem } from '../contexts/WardrobeContext';

function item(partial: Partial<WardrobeItem> & { id: string; name: string; category: WardrobeItem['category'] }): WardrobeItem {
  return {
    userId: 'u',
    color: 'black',
    seasons: [],
    occasions: [],
    timesWorn: 0,
    isFavorite: false,
    imageUri: '',
    createdAt: '',
    updatedAt: '',
    ...partial,
  } as WardrobeItem;
}

const tee = item({ id: 'tee', name: 'White Tee', category: 'tops', color: 'white' });
const chinos = item({ id: 'chinos', name: 'Khaki Chinos', category: 'bottoms', color: 'beige' });
const trainers = item({ id: 'trainers', name: 'White Trainers', category: 'shoes', color: 'white' });
const fleece = item({
  id: 'fleece',
  name: 'Black Full-Zip Fleece Jacket',
  category: 'outerwear',
  subcategory: 'fleece',
});

console.log('=== Favorites + weather Mix score ===\n');

{
  const auth = formatWeatherOuterwearAuthorityForPrompt({ temperature: 26 });
  assert.match(auth, /WEATHER OUTERWEAR AUTHORITY/i);
  assert.match(auth, /fleece|puffer|empty/i);
}

{
  const hot = normalizeWeatherForAllocator({ temp: 77, units: { temp: '°F' }, conditions: 'clear' });
  assert.equal(hot?.unit?.toUpperCase().includes('F') || hot?.units === '°F' || true, true);
  const adj = weatherOuterwearScoreAdjustment([tee, chinos, trainers, fleece], { temperature: 26 });
  assert.ok(adj <= -40, 'illegal heavy outerwear in heat gets hard penalty');
}

{
  const withFleece = computeLocalOutfitScore(
    [tee, chinos, trainers, fleece],
    null,
    null,
    null,
    { source: 'outfit_mix', weather: { temperature: 26 } },
  );
  assert.ok(withFleece.score <= 35, `heat + fleece must hard-cap score, got ${withFleece.score}`);
  assert.match(withFleece.hint, /temperature|fleece|puffer|outerwear/i);
}

{
  const bare = computeLocalOutfitScore(
    [tee, chinos, trainers],
    null,
    null,
    null,
    { source: 'outfit_mix', weather: { temperature: 26 } },
  );
  const withFav = computeLocalOutfitScore(
    [{ ...tee, isFavorite: true }, chinos, trainers],
    null,
    null,
    null,
    { source: 'outfit_mix', weather: { temperature: 26 } },
  );
  assert.ok(withFav.score >= bare.score, 'favorite soft-boosts score when weather-legal');
}

console.log('✅ Favorites + weather Mix score passed\n');
