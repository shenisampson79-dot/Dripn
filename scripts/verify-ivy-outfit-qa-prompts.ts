/**
 * Quick regression for Ivy QA prompts (client occasion + multi-day + refine gates).
 * Run: npx tsx scripts/verify-ivy-outfit-qa-prompts.ts
 */
import assert from 'node:assert/strict';
import {
  inferOutfitOccasionFromAsk,
  raiseOccasionForRefine,
} from '../utils/inferOutfitOccasionFromAsk';
import { buildDeterministicOutfitExplain } from '../utils/buildDeterministicOutfitExplain';
import { calendarSeasonWeatherHint, isHeavyOuterwear } from '../utils/weatherOuterwear';
import { passesEditorialOccasionGate } from '../utils/fashionEditorialRubric';
import {
  advanceMultiDayTravelClarify,
  isMultiDayTravelOutfitAsk,
  isMultiDayReady,
} from '../utils/multiDayTravelClarify';
import {
  elevatedCandidateBanReason,
  occasionToFormalityBand,
} from '../utils/occasionFormalityBands';
import type { WardrobeItem } from '../contexts/WardrobeContext';

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

// A/D occasion inference
assert.equal(
  inferOutfitOccasionFromAsk('Create an outfit for me today, I am meeting friends at the pub.'),
  'casual_day',
);
assert.equal(
  inferOutfitOccasionFromAsk("Create an outfit for tomorrow. It's casual, but I'm going somewhere nice for dinner."),
  'evening_out',
);

// C7 — solemn ceremony must not fall through to casual_day
assert.equal(
  inferOutfitOccasionFromAsk('What should I wear to a funeral?'),
  'work_outfit',
);
assert.equal(
  inferOutfitOccasionFromAsk('Create an outfit for a casual day at the park.'),
  'casual_day',
);
assert.equal(
  inferOutfitOccasionFromAsk('What should I wear to work tomorrow?'),
  'work_outfit',
);

assert.equal(
  raiseOccasionForRefine('casual_day', "I don't like this outfit as I don't think wearing cargo shorts and chunky boots to a nice dinner is appropriate. Give me another option"),
  'evening_out',
);

// Multi-day clarify flow
assert.equal(
  isMultiDayTravelOutfitAsk("I'm away for three days. Create an outfit for each day"),
  true,
);
const first = advanceMultiDayTravelClarify({
  query: "I'm away for three days. Create an outfit for each day",
  stylistId: 'ivy',
});
assert.equal(first.state, 'AWAITING_SLOTS');
assert.ok(first.clarifyCopy && /Where are you heading/i.test(first.clarifyCopy));
const filled = advanceMultiDayTravelClarify({
  query: 'Barcelona, leisure, July, one nice dinner',
  priorSlots: first.slots,
  stylistId: 'ivy',
});
assert.equal(filled.state, 'READY');
assert.ok(isMultiDayReady(filled.slots));
assert.equal(filled.slots.destination, 'Barcelona');
assert.equal(filled.slots.tripType, 'leisure');

// B deterministic explain is not the generic filler
const explain = buildDeterministicOutfitExplain({
  items: [
    item({ id: '1', category: 'tops', name: 'Cream Tee' }),
    item({ id: '2', category: 'bottoms', name: 'Navy Chinos' }),
    item({ id: '3', category: 'shoes', name: 'Brown Loafers' }),
  ],
  occasionType: 'evening_out',
  userAsk: 'nice dinner',
});
assert.ok(explain.length > 0, 'explain non-empty');
assert.doesNotMatch(explain, /Here's a casual day look/i);
assert.match(explain, /evening|dinner|why these/i);

// A calendar season blocks heavy fleece in NH summer
const summerHint = calendarSeasonWeatherHint(new Date('2026-08-21T12:00:00Z'), 51.5);
assert.ok(summerHint && summerHint.temperature! >= 20, 'Aug NH warm hint');
const fleece = item({
  id: 'fleece',
  category: 'outerwear',
  name: 'Black Full-Zip Fleece Jacket',
  subcategory: 'fleece',
});
assert.ok(isHeavyOuterwear(fleece), 'fleece is heavy');

// D dinner gates — formality band + editorial
assert.equal(occasionToFormalityBand('evening_out'), 'evening_out');
assert.equal(
  elevatedCandidateBanReason(
    item({ id: 'c', category: 'bottoms', name: 'Olive Cargo Shorts', subcategory: 'cargo_shorts' }),
    'evening_out',
  ),
  'cargo_shorts',
);
assert.equal(
  elevatedCandidateBanReason(
    item({ id: 'b', category: 'shoes', name: 'Chunky Hiking Boots' }),
    'evening_out',
  ),
  'chunky_outdoor_boot',
);
assert.equal(
  passesEditorialOccasionGate(
    item({ id: 'c', category: 'bottoms', name: 'Olive Cargo Shorts', subcategory: 'cargo_shorts' }),
    'evening_out',
  ),
  false,
);
assert.equal(
  passesEditorialOccasionGate(
    item({ id: 'j', category: 'outerwear', name: 'Adidas Sports Jacket' }),
    'evening_out',
  ),
  false,
);
assert.equal(
  passesEditorialOccasionGate(
    item({ id: 'b', category: 'shoes', name: 'Timberland Hiking Boots' }),
    'evening_out',
  ),
  false,
);

console.log('verify-ivy-outfit-qa-prompts: ok');
