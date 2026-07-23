/**
 * StyleWise Outfit Intent verification (mirrors server scripts/test-outfit-intent.mjs).
 * Run: npm run verify:outfit-intent
 */
import assert from 'assert';
import {
  resolveOutfitIntent,
  intentScore,
  scoreOutfitIntentBias,
  listOutfitIntents,
  loadOutfitIntent,
} from '../utils/outfitIntent';
import { getOutfitIntents } from '../utils/garmentTaxonomy';
import { isOutfitValid, detectAllOutfitClashes } from '../utils/outfitClashRules';

function item(partial: Record<string, unknown>) {
  return {
    id: String(partial.id || Math.random().toString(36).slice(2, 8)),
    seasons: ['summer'],
    occasions: ['casual'],
    color: (partial.color as string) || 'navy',
    ...partial,
  };
}

const intents = getOutfitIntents();
assert.ok(Object.keys(intents).length >= 4, 'expected core outfit intents');
for (const name of ['effortless', 'power', 'date_night', 'editorial', 'casual_day', 'smart_casual']) {
  assert.ok((intents as any)[name], `missing intent ${name}`);
}
assert.ok(listOutfitIntents().includes('power'));
assert.ok(loadOutfitIntent('power')?.preferredSubtypes?.includes('blazer'));

assert.equal(resolveOutfitIntent({ query: 'power dressing for my interview' }).name, 'power');
assert.equal(resolveOutfitIntent({ query: 'effortless summer look' }).name, 'effortless');
assert.equal(resolveOutfitIntent({ query: 'date night dinner' }).name, 'date_night');
assert.equal(resolveOutfitIntent({ query: 'editorial runway vibe' }).name, 'editorial');
assert.equal(resolveOutfitIntent({ occasion: 'work_outfit' }).name, 'power');
assert.equal(resolveOutfitIntent({ source: 'outfit_mix' }).name, 'casual_day');

const powerBlazer = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Grey Tailored Trousers' }),
  item({ category: 'shoes', name: 'Black Oxford Shoes' }),
];
const powerSlides = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Grey Tailored Trousers' }),
  item({ category: 'shoes', name: 'Pool Slides' }),
];
assert.ok(intentScore(powerBlazer, 'power').adjustment > intentScore(powerSlides, 'power').adjustment);

const effortLinen = [
  item({ category: 'tops', name: 'Beige Linen Shirt', color: 'beige' }),
  item({ category: 'bottoms', name: 'Khaki Chinos', color: 'khaki' }),
  item({ category: 'shoes', name: 'White Leather Low-Top Sneakers', color: 'white' }),
];
const effortFormal = [
  item({ category: 'outerwear', name: 'Navy Blazer' }),
  item({ category: 'tops', name: 'White Oxford Shirt' }),
  item({ category: 'bottoms', name: 'Grey Tailored Trousers' }),
  item({ category: 'shoes', name: 'Black Oxford Shoes' }),
];
assert.ok(intentScore(effortLinen, 'effortless').adjustment > intentScore(effortFormal, 'effortless').adjustment);

const dateSlip = [
  item({ category: 'dresses', name: 'Black Slip Dress', color: 'black' }),
  item({ category: 'shoes', name: 'Black Stiletto Heels', color: 'black' }),
];
const dateGym = [
  item({ category: 'tops', name: 'Grey Hoodie' }),
  item({ category: 'bottoms', name: 'Black Athletic Shorts' }),
  item({ category: 'shoes', name: 'Hoka Clifton Runners' }),
];
assert.ok(intentScore(dateSlip, 'date_night').adjustment > intentScore(dateGym, 'date_night').adjustment);

const editorialBold = [
  item({ category: 'outerwear', name: 'Denim Jacket' }),
  item({ category: 'tops', name: 'Oversized Graphic Tee', color: 'white' }),
  item({ category: 'bottoms', name: 'Black Jeans', color: 'black' }),
  item({ category: 'shoes', name: 'Doc Martens Combat Boots', color: 'black' }),
] as any[];
assert.ok(isOutfitValid(editorialBold));
assert.equal(
  detectAllOutfitClashes(editorialBold).filter((c) => c.severity === 'fatal' || c.severity === 'major').length,
  0,
);
assert.ok(intentScore(editorialBold, 'editorial').adjustment >= -4);

const bias = scoreOutfitIntentBias(powerBlazer, { occasion: 'work_outfit', source: 'allocator' });
assert.equal(bias.resolvedName, 'power');
assert.ok((bias.adjustment || 0) > 0);

console.log('verify-outfit-intent: resolution + soft scoring assertions passed');
