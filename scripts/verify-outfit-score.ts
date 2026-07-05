/**
 * Comprehensive outfit clash + merge tests.
 * Run: npx tsx scripts/verify-outfit-score.ts
 */
import {
  computeLocalOutfitScore,
  mergeOutfitScores,
  isShortsItem,
} from '../utils/outfitCompatibilityScore';
import { detectOutfitClashes, detectAllOutfitClashes } from '../utils/outfitClashRules';
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

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

type ClashCase = {
  id: string;
  items: WardrobeItem[];
  maxScore: number;
  minScore?: number;
};

const blazer = item({ id: 'blazer', category: 'outerwear', name: 'Navy Blazer', color: 'navy' });
const shorts = item({ id: 'shorts', category: 'bottoms', name: 'Black Shorts', color: 'black' });
const trainers = item({ id: 'trainers', category: 'shoes', name: 'White Trainers', color: 'white' });
const shirt = item({ id: 'shirt', category: 'tops', name: 'White Dress Shirt', color: 'white' });
const trousers = item({ id: 'trousers', category: 'bottoms', name: 'Navy Trousers', color: 'navy' });
const shortSleeve = item({ id: 'ss-tee', category: 'tops', name: 'Short Sleeve Tee', color: 'gray' });
const loafers = item({ id: 'loafers', category: 'shoes', name: 'Brown Loafers', color: 'brown' });
const tank = item({ id: 'tank', category: 'activewear_tops', name: 'Running Tank', color: 'black' });
const hoodedJacket = item({ id: 'hood-jacket', category: 'outerwear', name: 'Hooded Jacket', color: 'gray' });
const workBoots = item({ id: 'boots', category: 'shoes', name: 'Brown Lace-up Boots', color: 'brown' });
const tie = item({ id: 'tie', category: 'accessories', name: 'Silk Tie', color: 'burgundy' });
const jersey = item({ id: 'jersey', category: 'tops', name: 'Football Jersey', color: 'red' });
const graphicTee = item({ id: 'tee', category: 'tops', name: 'Graphic T-Shirt', color: 'white' });
const swimTrunks = item({ id: 'swim', category: 'swimwear', name: 'Swim Trunks', color: 'blue' });
const pajamas = item({ id: 'pjs', category: 'sleepwear', name: 'Cotton Pyjamas', color: 'gray' });
const gown = item({ id: 'gown', category: 'dresses', name: 'Evening Gown', color: 'black' });
const oxfords = item({ id: 'oxfords', category: 'shoes', name: 'Black Oxford Dress Shoes', color: 'black' });
const heels = item({ id: 'heels', category: 'shoes', name: 'Black Stiletto Heels', color: 'black' });
const uggs = item({ id: 'uggs', category: 'shoes', name: 'Tan UGG Boots', color: 'tan' });
const jeans = item({ id: 'jeans', category: 'bottoms', name: 'Blue Jeans', color: 'denim' });
const dress = item({ id: 'dress', category: 'dresses', name: 'Midi Dress', color: 'green' });
const suitTrousers = item({ id: 'suit-pants', category: 'formal', name: 'Suit Trousers', color: 'charcoal' });
const joggers = item({ id: 'joggers', category: 'activewear_bottoms', name: 'Grey Joggers', color: 'gray' });
const hoodie = item({ id: 'hoodie', category: 'tops', name: 'Grey Hoodie', color: 'gray' });
const chinos = item({ id: 'chinos', category: 'bottoms', name: 'Khaki Chinos', color: 'beige' });
const leggings = item({ id: 'leggings', category: 'activewear_bottoms', name: 'Black Leggings', color: 'black' });
const puffer = item({ id: 'puffer', category: 'outerwear', name: 'Black Puffer Jacket', color: 'black' });
const clogs = item({ id: 'clogs', category: 'shoes', name: 'Leather Clogs', color: 'brown' });

const CLASH_MATRIX: ClashCase[] = [
  { id: 'tie_jersey', items: [tie, jersey], maxScore: 15 },
  { id: 'tie_athletic_top', items: [tie, tank], maxScore: 15 },
  { id: 'tie_tshirt', items: [tie, graphicTee], maxScore: 20 },
  { id: 'swimwear_formal', items: [swimTrunks, blazer], maxScore: 20 },
  { id: 'sleepwear_formal', items: [pajamas, blazer, oxfords], maxScore: 25 },
  { id: 'tier1_tier5', items: [tank, gown], maxScore: 20 },
  { id: 'athletic_formal_shoes', items: [tank, oxfords], maxScore: 25 },
  { id: 'athletic_boots_shorts', items: [tank, shorts, workBoots], maxScore: 25 },
  { id: 'athletic_boots', items: [tank, chinos, workBoots], maxScore: 30 },
  { id: 'athletic_heels', items: [leggings, heels], maxScore: 30 },
  { id: 'blazer_athletic_top', items: [blazer, item({ id: 'vest', category: 'activewear_tops', name: 'Running Vest', color: 'black' }), chinos, trainers], maxScore: 15 },
  { id: 'blazer_shorts_uggs', items: [blazer, shorts, uggs], maxScore: 25 },
  { id: 'blazer_shorts_trainers', items: [blazer, shorts, trainers], maxScore: 30 },
  { id: 'blazer_shorts', items: [blazer, shorts, loafers], maxScore: 35 },
  { id: 'evening_athletic_bottom', items: [gown, shorts], maxScore: 25 },
  { id: 'dress_jeans', items: [dress, jeans], maxScore: 35 },
  { id: 'formal_shoes_athletic', items: [joggers, oxfords], maxScore: 30 },
  { id: 'trainers_suit', items: [trainers, suitTrousers, shirt], maxScore: 35 },
  { id: 'hoodie_formal_trousers', items: [hoodie, item({ id: 'dress-trousers', category: 'bottoms', name: 'Dress Trousers', color: 'charcoal' }), oxfords], maxScore: 40 },
  { id: 'blazer_trainers', items: [blazer, chinos, trainers], maxScore: 55 },
  { id: 'shorts_formal_shoes', items: [shorts, oxfords], maxScore: 50 },
  { id: 'shorts_boots', items: [shorts, workBoots, shirt], maxScore: 60 },
  { id: 'tier_spread_3', items: [leggings, hoodie, shirt], maxScore: 55 },
  { id: 'tier_spread_2_athletic_formal', items: [tank, blazer], maxScore: 65 },
  { id: 'dress_shorts', items: [dress, shorts], maxScore: 45 },
  { id: 'joggers_blazer', items: [joggers, blazer], maxScore: 45 },
  { id: 'athletic_outerwear_formal', items: [puffer, tie, oxfords], maxScore: 55 },
  { id: 'athletic_top_non_athletic_shoes', items: [tank, clogs], maxScore: 75, minScore: 60 },
  { id: 'blazer_hoodie_no_jeans', items: [blazer, hoodie, chinos], maxScore: 80, minScore: 65 },
];

// ── Detector sanity ────────────────────────────────────────────────────────
assert(!isShortsItem(shortSleeve), 'short sleeve top must not count as shorts');

// ── Every clash rule fires and scores low ──────────────────────────────────
for (const clashCase of CLASH_MATRIX) {
  const allMatched = detectAllOutfitClashes(clashCase.items);
  assert(
    allMatched.some((rule) => rule.id === clashCase.id),
    `expected ${clashCase.id} to match, got [${allMatched.map((r) => r.id).join(', ')}]`,
  );

  const detected = detectOutfitClashes(clashCase.items);
  const scored = computeLocalOutfitScore(clashCase.items);
  assert(
    scored.score <= clashCase.maxScore,
    `${clashCase.id}: score ${scored.score} exceeds max ${clashCase.maxScore}`,
  );
  if (clashCase.minScore != null) {
    assert(
      scored.score >= clashCase.minScore,
      `${clashCase.id}: score ${scored.score} below min ${clashCase.minScore}`,
    );
  }
  assert(scored.clashId === detected?.id, `${clashCase.id}: primary clashId should be ${detected?.id}, got ${scored.clashId}`);
}

// ── Known bad combos ───────────────────────────────────────────────────────
const blazerShortsTrainers = computeLocalOutfitScore([blazer, shorts, trainers]);
assert(blazerShortsTrainers.score < 40, `blazer+shorts+trainers should score low, got ${blazerShortsTrainers.score}`);
assert(blazerShortsTrainers.clashId != null, 'clash id expected');

const gymClash = computeLocalOutfitScore([hoodedJacket, tank, shorts, workBoots]);
assert(gymClash.score < 35, `athletic tank + shorts + boots should score low, got ${gymClash.score}`);
assert(/clash|gym/i.test(gymClash.hint), 'gym clash hint expected');

// ── Good outfit beats clashes ──────────────────────────────────────────────
const strong = computeLocalOutfitScore([shirt, trousers, loafers, blazer]);
assert(strong.score > blazerShortsTrainers.score + 15, 'tailored combo should beat clash combo');
assert(strong.score <= 100, 'score must not exceed 100');
assert(!strong.clashId, 'strong outfit should have no clash id');

const scores = new Set([
  computeLocalOutfitScore([shirt, trousers, trainers]).score,
  computeLocalOutfitScore([shirt, shorts, trainers]).score,
  computeLocalOutfitScore([blazer, trousers, trainers]).score,
]);
assert(scores.size >= 2, 'different outfits should not all tie to one score');

// ── AI merge must not inflate clashes ──────────────────────────────────────
const merged = mergeOutfitScores(blazerShortsTrainers, {
  score: 78,
  hardRuleViolations: ['Rule 2: Formality mismatch (blazer + shorts)'],
  hardCapApplied: 'Rule 2 (blazer + shorts = 28/100)',
});
assert(merged.score <= 40, `AI must not inflate hard clash above cap, got ${merged.score}`);

const mergedGym = mergeOutfitScores(gymClash, {
  score: 89,
  verdict: 'Strong outfit',
});
assert(mergedGym.score < 40, `AI must not keep 89% on gym+boots clash, got ${mergedGym.score}`);

const mergedGood = mergeOutfitScores(strong, { score: 84, verdict: 'Excellent combo' });
assert(mergedGood.score >= 70 && mergedGood.score <= 100, `blended good score out of range: ${mergedGood.score}`);

const userOutfit = computeLocalOutfitScore([
  blazer,
  item({ id: 'running-vest', category: 'activewear_tops', name: 'Running Vest', color: 'black' }),
  chinos,
  trainers,
]);
assert(userOutfit.score <= 15, `blazer + running vest should score ~10%, got ${userOutfit.score}`);
assert(userOutfit.clashId === 'blazer_athletic_top', `expected blazer_athletic_top, got ${userOutfit.clashId}`);

console.log(`verify-outfit-score: ${CLASH_MATRIX.length} clash rules + merge checks passed`);
