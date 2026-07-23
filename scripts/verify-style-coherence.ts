/**
 * Style Coherence + Stylist Voice verification.
 * Run: npx tsx scripts/verify-style-coherence.ts
 */
import {
  computeLocalOutfitScore,
  getStyleLane,
  classifyFootwear,
  evaluateStyleCoherence,
  buildStylistAnalysis,
} from '../utils/outfitCompatibilityScore';
import { DEFAULT_SMART_CASUAL_REGIONAL } from '../utils/outfitRegionalContext';
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

const blazer = item({ id: 'blazer', category: 'outerwear', name: 'Grey Windowpane Blazer', color: 'gray' });
const polo = item({ id: 'polo', category: 'tops', name: 'Green Polo Shirt', color: 'green' });
const trackBottoms = item({ id: 'track', category: 'bottoms', name: 'Navy Tracksuit Bottoms', color: 'navy' });
const chunky = item({ id: 'chunky', category: 'shoes', name: 'White Chunky Trainers', color: 'white' });
const oxford = item({ id: 'oxford', category: 'tops', name: 'White Oxford Shirt', color: 'white' });
const khaki = item({ id: 'khaki', category: 'bottoms', name: 'Khaki Chinos', color: 'beige' });
const whiteMinimal = item({ id: 'samba', category: 'shoes', name: 'Plain White Leather Sneakers', color: 'white' });
const tee = item({ id: 'tee', category: 'tops', name: 'Cream T-Shirt', color: 'cream' });
const jeans = item({ id: 'jeans', category: 'bottoms', name: 'Blue Jeans', color: 'denim' });
const outdoorCasual = [tee, jeans, whiteMinimal];

// ── Lane classification ──────────────────────────────────────────────────
assert(getStyleLane(blazer) === 'tailored', `blazer lane expected tailored, got ${getStyleLane(blazer)}`);
assert(getStyleLane(trackBottoms) === 'athleisure', `track bottoms expected athleisure, got ${getStyleLane(trackBottoms)}`);
assert(getStyleLane(chunky) === 'street' || getStyleLane(chunky) === 'athleisure', `chunky expected street/athleisure, got ${getStyleLane(chunky)}`);
assert(getStyleLane(khaki) === 'casual', `khaki expected casual, got ${getStyleLane(khaki)}`);
assert(classifyFootwear(chunky) === 'chunky_sneaker', `chunky footwear class, got ${classifyFootwear(chunky)}`);
assert(classifyFootwear(whiteMinimal) === 'minimal_sneaker', `minimal footwear class, got ${classifyFootwear(whiteMinimal)}`);

// ── Screenshot outfit 1: blazer + track + chunky → nuke ─────────────────
const chaosLook = [blazer, polo, trackBottoms, chunky];
const chaosCoherence = evaluateStyleCoherence(chaosLook);
assert(chaosCoherence.signals.multiLaneChaos || chaosCoherence.signals.tailoringClash, 'chaos look must signal multi-lane or tailoring clash');
assert(chaosCoherence.signals.footwearMismatch || chaosCoherence.signals.tailoringClash, 'chaos look must flag footwear or tailoring');
assert(chaosCoherence.hardCap != null && chaosCoherence.hardCap <= 42, `chaos hardCap ≤42, got ${chaosCoherence.hardCap}`);

const chaosScore = computeLocalOutfitScore(chaosLook);
assert(chaosScore.score <= 40, `blazer+track+chunky must score ≤40, got ${chaosScore.score}`);
assert(chaosScore.signals?.tailoringClash || chaosScore.signals?.multiLaneChaos, 'score path must expose chaos signals');

const outdoor = computeLocalOutfitScore(outdoorCasual);
assert(
  chaosScore.score + 25 < outdoor.score,
  `chaos (${chaosScore.score}) must be ≪ outdoor casual (${outdoor.score})`,
);

const chaosVoice = buildStylistAnalysis(chaosLook, {
  score: chaosScore.score,
  signals: chaosScore.signals,
  aesthetic: chaosScore.aesthetic,
  hint: chaosScore.hint,
});
assert(chaosVoice.overallTone === 'off' || chaosVoice.overallTone === 'mixed', `chaos tone off/mixed, got ${chaosVoice.overallTone}`);
assert(/blazer|track|jogger|lane|chunky|trainer/i.test(chaosVoice.summary), `chaos summary must name conflict: ${chaosVoice.summary}`);
assert((chaosVoice.adjustments?.length || 0) >= 1 && (chaosVoice.adjustments?.length || 0) <= 2, 'chaos adjustments 1–2');
assert(chaosVoice.items.some((i) => i.verdict === 'fights' || i.verdict === 'swap'), 'chaos must mark fighting pieces');

// ── Screenshot outfit 2: blazer + khaki + white minimal → high ──────────
const smartLook = [blazer, oxford, khaki, whiteMinimal];
const smartCoherence = evaluateStyleCoherence(smartLook);
assert(!smartCoherence.signals.multiLaneChaos, 'smart look must not be multi-lane chaos');
assert(!smartCoherence.signals.tailoringClash, 'smart look must not tailoring-clash');
assert(!smartCoherence.signals.footwearMismatch, 'minimal white sneakers OK under blazer');
assert(smartCoherence.signals.lanesPresent.includes('tailored'), 'smart look has tailored');
assert(smartCoherence.signals.lanesPresent.includes('casual'), 'smart look has casual');
assert(!smartCoherence.signals.invalidTwoLaneMix, 'tailored+casual is allowed');

const smartScore = computeLocalOutfitScore(smartLook, DEFAULT_SMART_CASUAL_REGIONAL);
assert(smartScore.score >= 75, `blazer+khaki+white minimal must score ≥75, got ${smartScore.score}`);
assert(smartScore.score > chaosScore.score + 30, `smart (${smartScore.score}) must crush chaos (${chaosScore.score})`);

const smartVoice = buildStylistAnalysis(smartLook, {
  score: smartScore.score,
  signals: smartScore.signals,
  aesthetic: smartScore.aesthetic,
  hint: smartScore.hint,
});
if (smartScore.score >= 90) {
  assert(smartVoice.overallTone === 'excellent', `≥90 must be excellent, got ${smartVoice.overallTone}`);
  assert(!smartVoice.adjustments?.length, 'excellent must have zero adjustments');
  assert(smartVoice.items.every((i) => i.verdict === 'works'), 'excellent items all works');
  assert(!/refine footwear|confused|commit to one style lane/i.test(smartVoice.summary), `excellent no nag: ${smartVoice.summary}`);
  assert(!smartVoice.items.some((i) => /refine footwear/i.test(i.comment)), 'excellent item comments no refine footwear');
}

// ── Invalid 2-lane: tailored + athleisure ───────────────────────────────
const tailoredAthleisure = [
  blazer,
  item({ id: 'joggers', category: 'activewear_bottoms', name: 'Grey Joggers', color: 'gray' }),
];
const ta = evaluateStyleCoherence(tailoredAthleisure);
assert(ta.signals.tailoringClash || ta.signals.invalidTwoLaneMix || ta.signals.laneConflict, 'tailored+athleisure must conflict');
assert(ta.hardCap != null && ta.hardCap <= 55, `tailoring clash cap ≤55, got ${ta.hardCap}`);

// ── Allowed: street + casual ────────────────────────────────────────────
const streetCasual = [
  item({ id: 'hoodie', category: 'tops', name: 'Grey Hoodie', color: 'gray' }),
  jeans,
  whiteMinimal,
];
const sc = evaluateStyleCoherence(streetCasual);
assert(!sc.signals.invalidTwoLaneMix, 'street+casual allowed');
assert(sc.mode === 'adjust', 'street+casual soft path');

console.log(
  `verify-style-coherence: chaos=${chaosScore.score} smart=${smartScore.score} outdoor=${outdoor.score} — lanes/footwear/multi-lane/excellent OK`,
);
