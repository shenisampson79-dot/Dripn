/**
 * Comprehensive outfit clash + merge tests.
 * Run: npx tsx scripts/verify-outfit-score.ts
 */
import {
  computeLocalOutfitScore,
  mergeOutfitScores,
  isShortsItem,
  analyzeOutfitAesthetic,
} from '../utils/outfitCompatibilityScore';
import { detectOutfitClashes, detectAllOutfitClashes, isOutfitValid } from '../utils/outfitClashRules';
import { getStyleTagDatasetEntryCount } from '../utils/outfitStyleTagMatcher';
import calibrationData from '../data/outfitStyleCalibration.json';
import calibrationExtended from '../data/outfitStyleCalibrationExtended.json';
import pairwiseData from '../data/outfitStylePairwiseCalibration.json';
import { scoreColorHarmony, detectWheelRelationship } from '../utils/outfitColorHarmony';
import { scoreOutfitSilhouette } from '../utils/outfitSilhouetteScore';
import { computeUnifiedOutfitScore } from '../utils/outfitUnifiedScore';
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
  { id: 'joggers_dressy_boots', items: [
    item({ id: 'tee-cream', category: 'tops', name: 'Cream T-Shirt', color: 'cream' }),
    item({ id: 'sweats', category: 'bottoms', name: 'Grey Sweatpants', color: 'gray' }),
    item({ id: 'chelsea', category: 'shoes', name: 'Black Leather Chelsea Boots', color: 'black' }),
  ], maxScore: 35 },
  { id: 'trainers_suit', items: [trainers, suitTrousers, shirt], maxScore: 35 },
  { id: 'hoodie_formal_trousers', items: [hoodie, item({ id: 'dress-trousers', category: 'bottoms', name: 'Dress Trousers', color: 'charcoal' }), oxfords], maxScore: 40 },
  { id: 'shorts_formal_shoes', items: [shorts, oxfords], maxScore: 50 },
  { id: 'shorts_boots', items: [shorts, workBoots, shirt], maxScore: 60 },
  { id: 'tier_spread_3', items: [leggings, hoodie, shirt], maxScore: 55 },
  { id: 'tier_spread_2_athletic_formal', items: [tank, blazer], maxScore: 65 },
  { id: 'dress_shorts', items: [dress, shorts], maxScore: 45 },
  { id: 'joggers_blazer', items: [joggers, blazer], maxScore: 45 },
  { id: 'athletic_outerwear_formal', items: [puffer, tie, oxfords], maxScore: 55 },
  { id: 'athletic_top_non_athletic_shoes', items: [tank, clogs], maxScore: 75 },
  { id: 'blazer_hoodie_no_jeans', items: [blazer, hoodie, chinos], maxScore: 45 },
  { id: 'structured_shirt_sweat_bottom', items: [
    item({ id: 'denim-shirt', category: 'tops', name: 'Blue Denim Shirt', color: 'blue' }),
    item({ id: 'sweat-shorts', category: 'bottoms', name: 'Grey Sweat Shorts', color: 'gray' }),
    trainers,
  ], maxScore: 30 },
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
  if (detected?.severity === 'fatal' || detected?.severity === 'major') {
    assert(
      scored.clashId === detected.id,
      `${clashCase.id}: primary clashId should be ${detected.id}, got ${scored.clashId}`,
    );
  }
}

// ── Taste calibration (good vs bad pairs) ─────────────────────────────────
const creamTee = item({ id: 'cream-tee', category: 'tops', name: 'Cream T-Shirt', color: 'cream' });
const greySweats = item({ id: 'sweats', category: 'bottoms', name: 'Grey Sweatpants', color: 'gray' });
const chelseaBoots = item({ id: 'chelsea', category: 'shoes', name: 'Black Leather Chelsea Boots', color: 'black' });
const whiteSneakers = item({ id: 'sneakers', category: 'shoes', name: 'White Leather Sneakers', color: 'white' });

const joggersChelsea = computeLocalOutfitScore([creamTee, greySweats, chelseaBoots]);
const joggersSneakers = computeLocalOutfitScore([creamTee, greySweats, whiteSneakers]);

assert(joggersChelsea.score <= 40, `joggers+chelsea must score ≤40 (taste rejection), got ${joggersChelsea.score}`);
assert(joggersSneakers.score >= 55, `joggers+sneakers should score ≥55 (valid athleisure), got ${joggersSneakers.score}`);
assert(joggersSneakers.score > joggersChelsea.score + 20, 'sneakers look must beat chelsea look by wide margin');
assert(
  joggersChelsea.clashId?.startsWith('aesthetic_') || joggersChelsea.hardCap != null,
  'joggers+chelsea should trigger aesthetic hard cap',
);

const mergedJoggersChelsea = mergeOutfitScores(joggersChelsea, {
  score: 78,
  verdict: 'Good combo',
  analysis: 'Neutral and complete',
});
assert(mergedJoggersChelsea.score <= 40, `AI must not inflate taste rejection, got ${mergedJoggersChelsea.score}`);

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

// ── Structured shirt + sweat bottoms vs tee + sweat bottoms ───────────────
const denimShirtSweatShorts = [
  item({ id: 'denim-sh', category: 'tops', name: 'Blue Denim Shirt', color: 'blue' }),
  item({ id: 'grey-ss', category: 'bottoms', name: 'Grey Sweat Shorts', color: 'gray' }),
  trainers,
];
const teeSweatShorts = [
  item({ id: 'plain-tee', category: 'tops', name: 'White T-Shirt', color: 'white' }),
  item({ id: 'grey-ss2', category: 'bottoms', name: 'Grey Sweat Shorts', color: 'gray' }),
  trainers,
];
assert(
  detectAllOutfitClashes(denimShirtSweatShorts).some((c) => c.id === 'structured_shirt_sweat_bottom'),
  'denim shirt + grey sweat shorts must clash',
);
assert(!isOutfitValid(denimShirtSweatShorts), 'denim shirt + sweat shorts must fail isOutfitValid');
assert(
  !detectAllOutfitClashes(teeSweatShorts).some((c) => c.id === 'structured_shirt_sweat_bottom'),
  'tee + sweat shorts must NOT hard-clash as structured_shirt_sweat_bottom',
);
assert(isOutfitValid(teeSweatShorts), 'tee + sweat shorts should remain valid');

// ── Style tag dataset coverage ─────────────────────────────────────────────
assert(getStyleTagDatasetEntryCount() >= 100, `style tag dataset should have 100+ entries, got ${getStyleTagDatasetEntryCount()}`);

// ── Calibration dataset (good vs bad taste boundaries) ───────────────────
type CalibrationExample = {
  id: string;
  items: Array<{ name: string; category: string; color?: string }>;
  label: 'good' | 'bad';
  minScore?: number;
  maxScore?: number;
  primaryStyle?: string;
};

function calibrationItem(
  partial: { name: string; category: string; color?: string },
  index: number,
): WardrobeItem {
  return item({
    id: `cal-${index}`,
    name: partial.name,
    category: partial.category,
    color: partial.color || 'black',
  });
}

for (const example of [
  ...(calibrationData.examples as CalibrationExample[]),
  ...(calibrationExtended.examples as CalibrationExample[]),
]) {
  const items = example.items.map((piece, index) => calibrationItem(piece, index));
  const scored = computeLocalOutfitScore(items);
  const aesthetic = analyzeOutfitAesthetic(items);

  if (example.label === 'good') {
    assert(
      scored.score >= (example.minScore ?? 60),
      `${example.id}: good outfit scored ${scored.score}, expected ≥${example.minScore ?? 60}`,
    );
    if (example.maxScore != null) {
      assert(scored.score <= example.maxScore, `${example.id}: good outfit scored ${scored.score}, expected ≤${example.maxScore}`);
    }
    if (example.primaryStyle) {
      assert(
        aesthetic.primaryStyle === example.primaryStyle
          || aesthetic.styleScores[example.primaryStyle as keyof typeof aesthetic.styleScores],
        `${example.id}: expected primary style ${example.primaryStyle}, got ${aesthetic.primaryStyle}`,
      );
    }
  } else {
    assert(
      scored.score <= (example.maxScore ?? 45),
      `${example.id}: bad outfit scored ${scored.score}, expected ≤${example.maxScore ?? 45}`,
    );
  }
}

// ── Pairwise comparison (A must beat B by margin) ─────────────────────────
type PairwiseExample = {
  id: string;
  outfitA: CalibrationExample['items'];
  outfitB: CalibrationExample['items'];
  better: 'A' | 'B';
  minMargin?: number;
};

const pairwiseMargin = (pairwiseData as { minMargin?: number }).minMargin ?? 15;

for (const pair of (pairwiseData as { pairs: PairwiseExample[] }).pairs) {
  const itemsA = pair.outfitA.map((piece, index) => calibrationItem(piece, index));
  const itemsB = pair.outfitB.map((piece, index) => calibrationItem(piece, index + 100));
  const scoreA = computeLocalOutfitScore(itemsA).score;
  const scoreB = computeLocalOutfitScore(itemsB).score;
  const margin = pair.minMargin ?? pairwiseMargin;

  if (pair.better === 'A') {
    assert(
      scoreA > scoreB + margin - 1,
      `${pair.id}: A (${scoreA}) should beat B (${scoreB}) by ≥${margin}`,
    );
  } else {
    assert(
      scoreB > scoreA + margin - 1,
      `${pair.id}: B (${scoreB}) should beat A (${scoreA}) by ≥${margin}`,
    );
  }
}

// ── Color harmony sanity ───────────────────────────────────────────────────
const neutralOutfit = scoreColorHarmony([
  { color: 'black' }, { color: 'white' }, { color: 'gray' },
], 'minimalist');
assert(neutralOutfit.score >= 75, `neutral palette should score high, got ${neutralOutfit.score}`);

const loudOutfit = scoreColorHarmony([
  { color: 'multicolor' }, { color: 'red' }, { color: 'orange' },
], 'minimalist');
assert(loudOutfit.score <= 55, `loud minimalist palette should score low, got ${loudOutfit.score}`);

// ── Silhouette sanity ───────────────────────────────────────────────────────
const tapered = scoreOutfitSilhouette([
  { name: 'Slim Fit Blazer', category: 'outerwear' },
  { name: 'White Oxford Shirt', category: 'tops' },
  { name: 'Tapered Chinos', category: 'bottoms' },
  { name: 'Brown Loafers', category: 'shoes' },
], 'smart_casual');
assert(tapered.overall >= 7, `tapered smart casual should silhouette ≥7, got ${tapered.overall}`);

const boxy = scoreOutfitSilhouette([
  { name: 'Oversized Hoodie', category: 'tops' },
  { name: 'Baggy Cargo Pants', category: 'bottoms' },
], 'classic_tailoring');
assert(boxy.overall <= 6, `double baggy for tailoring should silhouette ≤6, got ${boxy.overall}`);

// ── Color wheel relationships ───────────────────────────────────────────────
assert(
  detectWheelRelationship([210, 215]) === 'monochromatic',
  'near-identical blues should be monochromatic',
);
assert(
  detectWheelRelationship([0, 40]) === 'analogous',
  'red + orange should be analogous',
);
assert(
  detectWheelRelationship([0, 180]) === 'complementary',
  'red + cyan should be complementary',
);
assert(
  detectWheelRelationship([0, 120, 240]) === 'triadic',
  'red + green + blue should be triadic',
);
assert(
  detectWheelRelationship([0, 100]) === 'clashing',
  'distant warm/cool hues should clash',
);

// ── Seasonal palette match ──────────────────────────────────────────────────
const autumnPalette = scoreColorHarmony(
  [{ color: 'olive' }, { color: 'rust' }, { color: 'cream' }],
  'classic_tailoring',
  'Autumn',
);
assert(
  autumnPalette.seasonalMatch != null && autumnPalette.seasonalMatch >= 70,
  `autumn palette for Autumn season should match ≥70, got ${autumnPalette.seasonalMatch}`,
);

const summerMismatch = scoreColorHarmony(
  [{ color: 'orange' }, { color: 'rust' }, { color: 'gold' }],
  'classic_tailoring',
  'Summer',
);
assert(
  summerMismatch.seasonalMatch != null && summerMismatch.seasonalMatch < 60,
  `warm earth palette for Summer should score <60, got ${summerMismatch.seasonalMatch}`,
);

// ── Unified scoring engine ───────────────────────────────────────────────────
const unifiedGood = computeUnifiedOutfitScore([shirt, trousers, loafers, blazer]);
assert(
  unifiedGood.record.final_score >= 0.65,
  `unified good tailoring should score ≥0.65, got ${unifiedGood.record.final_score}`,
);
assert(unifiedGood.record.label === 'good' || unifiedGood.record.label === 'average', 'tailoring should not label bad');

const unifiedBad = computeUnifiedOutfitScore([
  item({ id: 'neon-h', category: 'tops', name: 'Neon Green Hoodie', color: 'multicolor' }),
  item({ id: 'red-s', category: 'bottoms', name: 'Red Shorts', color: 'red' }),
  item({ id: 'pur-s', category: 'shoes', name: 'Purple Sneakers', color: 'purple' }),
]);
assert(
  unifiedBad.record.final_score <= 0.65,
  `unified loud clash outfit should score ≤0.65, got ${unifiedBad.record.final_score}`,
);
assert(unifiedBad.record.label !== 'good', 'loud clash should not label good');
assert(
  unifiedBad.record.color.clash_penalty >= 0.4,
  'loud palette should carry colour clash penalty',
);

const joggersChelseaUnified = computeUnifiedOutfitScore([
  creamTee,
  greySweats,
  chelseaBoots,
]);
assert(
  joggersChelseaUnified.record.final_score <= 0.45,
  `unified taste rejection should cap sweats+chelsea ≤0.45, got ${joggersChelseaUnified.record.final_score}`,
);
assert(unifiedGood.record.feedback.length >= 0, 'feedback array should exist');

const totalCalibration =
  calibrationData.examples.length + calibrationExtended.examples.length;

console.log(
  `verify-outfit-score: ${CLASH_MATRIX.length} clash rules + ${totalCalibration} calibration + ${pairwiseData.pairs.length} pairwise + unified engine passed`,
);
