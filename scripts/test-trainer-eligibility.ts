/**
 * Launch freeze: client trainer eligibility (mirrors server footwear regressions).
 * Run: npx tsx scripts/test-trainer-eligibility.ts
 */
import assert from 'node:assert/strict';
import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  isChunkyOrTechTrainer,
  isFashionTrainer,
  isCasualTrainer,
  detectOutfitClashes,
  isOutfitValid,
  evaluateTrainerEligibility,
} from '../utils/outfitClashRules';
import { isOuterwearItem } from '../utils/completeOutfit';

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

const kukini = item({
  id: 'kukini',
  name: 'Nike cream and grey air kukini trainers',
  category: 'shoes',
  color: 'cream',
  brand: 'Nike',
});
const running = item({
  id: 'pegasus',
  name: 'Nike Pegasus running trainers',
  category: 'shoes',
  color: 'black',
});
const lifestyle = item({
  id: 'leather-lowtop',
  name: 'White leather low-top sneakers',
  category: 'shoes',
  color: 'white',
});
const loafers = item({
  id: 'loafers',
  name: 'Black leather loafers',
  category: 'shoes',
  color: 'black',
});
const oxfords = item({
  id: 'oxfords',
  name: 'Black leather oxfords',
  category: 'shoes',
  color: 'black',
});
const shirt = item({
  id: 'gap-shirt',
  name: 'Gap white and light blue striped button-down shirt',
  category: 'tops',
});
const blazer = item({
  id: 'cavani-blazer',
  name: 'Cavani gray windowpane check blazer',
  category: 'outerwear',
});
const chinos = item({
  id: 'chinos',
  name: 'Beige casual chinos',
  category: 'bottoms',
});
const trousers = item({
  id: 'next-trousers',
  name: 'Next black coated slim trousers',
  category: 'bottoms',
});

assert.equal(isChunkyOrTechTrainer(kukini), true);
assert.equal(isFashionTrainer(kukini), false);
assert.equal(isCasualTrainer(kukini), true);
assert.equal(isFashionTrainer(lifestyle), true);
assert.equal(isChunkyOrTechTrainer(lifestyle), false);
assert.equal(isChunkyOrTechTrainer(running), true);
assert.equal(isOuterwearItem(trousers), false, 'coated trousers are not outerwear');

function reject(items: WardrobeItem[], opts: { occasion?: string; workDressCode?: string }, label: string) {
  const clash = detectOutfitClashes(items, opts);
  assert.ok(clash, `${label}: expected clash`);
  assert.ok(
    clash.severity === 'fatal' || clash.severity === 'major',
    `${label}: expected fatal/major, got ${clash.severity} (${clash.id})`,
  );
  assert.equal(isOutfitValid(items, opts), false, `${label}: isOutfitValid should be false`);
}

function allow(items: WardrobeItem[], opts: { occasion?: string; workDressCode?: string }, label: string) {
  assert.equal(
    isOutfitValid(items, opts),
    true,
    `${label}: should be valid, got ${detectOutfitClashes(items, opts)?.id}`,
  );
}

reject(
  [shirt, blazer, chinos, kukini],
  { occasion: 'work_outfit', workDressCode: 'smart_casual' },
  'Kukini + blazer + chinos',
);
reject(
  [shirt, trousers, running],
  { occasion: 'casual_day' },
  'running trainers + tailored trousers',
);
allow(
  [shirt, chinos, lifestyle],
  { occasion: 'work_outfit', workDressCode: 'creative' },
  'clean white leather low-top + chinos in creative workplace',
);
allow(
  [shirt, blazer, chinos, loafers],
  { occasion: 'work_outfit', workDressCode: 'smart_casual' },
  'loafers + blazer + chinos',
);
allow(
  [shirt, trousers, oxfords],
  { occasion: 'work_outfit', workDressCode: 'business_formal' },
  'derby/Oxford + business formal',
);

assert.equal(
  evaluateTrainerEligibility(lifestyle, { workDressCode: 'creative', occasion: 'work_outfit', items: [shirt, chinos, lifestyle] }).allowed,
  true,
);
assert.equal(
  evaluateTrainerEligibility(kukini, { workDressCode: 'creative', occasion: 'work_outfit', items: [shirt, blazer, chinos, kukini] }).allowed,
  false,
);

console.log('client trainer eligibility freeze tests passed');
