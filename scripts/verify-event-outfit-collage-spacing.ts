/**
 * Event-only YOUR OUTFIT collage spacing vs shared large defaults.
 * Run: node --experimental-strip-types scripts/verify-event-outfit-collage-spacing.ts
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getOutfitPieceSlot } from '../utils/outfitVisualSlotResolve.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const visualSrc = readFileSync(resolve(root, 'components/OutfitPiecesVisual.tsx'), 'utf8');
const safeSrc = readFileSync(resolve(root, 'components/SafeOutfitPieces.tsx'), 'utf8');
const eventSrc = readFileSync(resolve(root, 'components/stylist/StylistDecisionFlow.tsx'), 'utf8');
const chatSrc = readFileSync(resolve(root, 'screens/AIStylistScreen.tsx'), 'utf8');
const askSrc = readFileSync(resolve(root, 'screens/AskStylistScreen.tsx'), 'utf8');
const rankedSrc = readFileSync(resolve(root, 'components/stylist/RankedMultiLookCards.tsx'), 'utf8');
const profileSrc = readFileSync(resolve(root, 'screens/ProfileScreen.tsx'), 'utf8');
const dfyCalSrc = readFileSync(resolve(root, 'screens/DFYCalendarScreen.tsx'), 'utf8');
const dfyVisSrc = readFileSync(resolve(root, 'components/outfit/DFYOutfitVisual.tsx'), 'utf8');
const todaySrc = readFileSync(resolve(root, 'components/TodaysOutfitCard.tsx'), 'utf8');

assert.match(visualSrc, /STACK_GAP_LARGE = 8/, 'shared large gap remains 8');
assert.match(visualSrc, /LARGE_CUTOUT_DISPLAY_SCALE = 1\.18/, 'cutout scale remains 1.18');
assert.match(visualSrc, /outerwear: 200,\s*\n\s*top: 168,\s*\n\s*bottom: 190,\s*\n\s*shoes: 120/, 'shared LAYER_HEIGHT_LARGE unchanged');
assert.match(visualSrc, /contentFit="contain"/, 'contain-fit unchanged');
assert.match(visualSrc, /EVENT_OUTFIT_STACK_GAP = 2/, 'Event gap is 2');
assert.match(visualSrc, /EVENT_OUTFIT_SLOT_OVERLAP = 14/, 'Event stack overlap is 14');
assert.match(visualSrc, /STACK_OVERLAP = 14/, 'overlap bound matches default STACK_OVERLAP');
assert.match(visualSrc, /outerwear: 178,\s*\n\s*top: 150,\s*\n\s*bottom: 170,\s*\n\s*shoes: 108/, 'Event slot heights restored');
assert.match(visualSrc, /layoutVariant === 'event'/, 'Event variant is opt-in');
assert.match(visualSrc, /Math\.max\(0, EVENT_OUTFIT_STACK_GAP\) - EVENT_OUTFIT_SLOT_OVERLAP/, 'Event pitch is gap minus overlap');
assert.match(
  visualSrc,
  /const safePad = \(large \? SLOT_SAFE_PAD_LARGE : SLOT_SAFE_PAD\)\[layer\.slot\]/,
  'Event keeps shared LARGE inner padding',
);
assert.doesNotMatch(visualSrc, /outerwear: 142,/, 'rejected shorter Event heights are gone');
assert.match(visualSrc, /const canvasSlack = eventLayout \? 0 :/, 'Event canvas has no minHeight slack');
assert.match(visualSrc, /containerEvent: \{\s*\n\s*marginBottom: 0,/, 'Event collage bottom margin is 0');
assert.match(visualSrc, /marginBottom: Spacing\.lg,/, 'shared collage container still uses Spacing.lg');
assert.match(visualSrc, /containerLarge: \{\s*\n\s*overflow: 'visible'/, 'large collage overflow remains visible');
assert.match(visualSrc, /eventLayout && styles\.containerEvent/, 'Event-only zero bottom margin opt-in');
assert.match(eventSrc, /section: \{\s*\n\s*gap: Spacing\.md,/, 'Event parent section gap remains Spacing.md');
assert.match(
  visualSrc,
  /displayScale=\{large && !tight && !compact \? LARGE_CUTOUT_DISPLAY_SCALE : 1\}/,
  'displayScale path unchanged',
);
assert.match(visualSrc, /STACK_ORDER: LayerSlot\[\] = \['outerwear', 'top', 'dress', 'bottom', 'shoes'\]/, 'slot order unchanged');
assert.doesNotMatch(eventSrc, /tight=\{?true/, 'Event does not enable tight overlap');

assert.match(
  eventSrc,
  /layoutVariant=\{decisionType === 'event-outfit' \? 'event' : undefined\}/,
  'only event-outfit opts into Event spacing',
);
assert.match(safeSrc, /layoutVariant=\{layoutVariant\}/, 'SafeOutfitPieces forwards layoutVariant');

assert.doesNotMatch(chatSrc, /layoutVariant="event"/, 'chat does not opt into Event collage spacing');
assert.doesNotMatch(chatSrc, /layoutVariant=\{?'event'/, 'chat does not pass Event variant');

for (const [name, src] of [
  ['ask', askSrc],
  ['ranked', rankedSrc],
  ['profile', profileSrc],
  ['dfy calendar', dfyCalSrc],
  ['dfy visual', dfyVisSrc],
  ['today', todaySrc],
] as const) {
  assert.doesNotMatch(src, /layoutVariant/, `${name} does not opt into Event collage spacing`);
}

const DEFAULT_HEIGHTS = { outerwear: 200, top: 168, bottom: 190, shoes: 120 };
const EVENT_HEIGHTS = { outerwear: 178, top: 150, bottom: 170, shoes: 108 };
const DEFAULT_GAP = 8;
const EVENT_GAP = 2;
const EVENT_OVERLAP = 14;
const EVENT_PITCH = EVENT_GAP - EVENT_OVERLAP;
const PREVIOUS_EVENT_CANVAS = 624;

function stackHeight(
  slots: Array<keyof typeof DEFAULT_HEIGHTS>,
  heights: Record<string, number>,
  spacing: number,
): number {
  return slots.reduce((sum, slot, index) => {
    const h = heights[slot];
    if (index === 0) return h;
    return sum + h + spacing;
  }, 0);
}

const three: Array<keyof typeof DEFAULT_HEIGHTS> = ['outerwear', 'top', 'bottom'];
const four: Array<keyof typeof DEFAULT_HEIGHTS> = ['outerwear', 'top', 'bottom', 'shoes'];

const defaultThree = stackHeight(three, DEFAULT_HEIGHTS, DEFAULT_GAP);
const defaultFour = stackHeight(four, DEFAULT_HEIGHTS, DEFAULT_GAP);
const eventThree = stackHeight(three, EVENT_HEIGHTS, EVENT_PITCH);
const eventFour = stackHeight(four, EVENT_HEIGHTS, EVENT_PITCH);

assert.equal(defaultThree, 574, 'shared 3-piece stack');
assert.equal(defaultFour, 702, 'shared 4-piece stack');
assert.equal(EVENT_PITCH, -12, 'Event neighbour pitch is -12');
assert.equal(eventThree, 474, 'Event 3-piece canvas from restored boxes + pitch');
assert.equal(eventFour, 570, 'Event 4-piece raw canvas (no boost)');
function boosted(h: number): number {
  return Math.round(h * 1.02);
}
const eventFourBoosted =
  boosted(EVENT_HEIGHTS.outerwear)
  + EVENT_PITCH + boosted(EVENT_HEIGHTS.top)
  + EVENT_PITCH + boosted(EVENT_HEIGHTS.bottom)
  + EVENT_PITCH + boosted(EVENT_HEIGHTS.shoes);
assert.equal(eventFourBoosted, 582, 'Event 4-piece canvas with 1.02 boost and pitch');
assert.equal(eventFourBoosted + 0, 582, 'Event canvas minHeight equals overlapped stack (no 24px slack)');
assert.ok(eventFourBoosted < PREVIOUS_EVENT_CANVAS, 'overlapped canvas is shorter than +2 gap stack');
assert.ok(eventThree < defaultThree && eventFour < defaultFour, 'Event stacks are shorter');
assert.ok(EVENT_GAP >= 0 && EVENT_GAP < DEFAULT_GAP, 'Event gap constant stays non-negative');
assert.ok(EVENT_OVERLAP <= 14, 'Event overlap does not exceed STACK_OVERLAP');

assert.equal(getOutfitPieceSlot({ role: 'shoes', name: 'white sneakers' }), 'shoes');
assert.equal(getOutfitPieceSlot({ role: 'shoes', name: 'black ankle boots' }), 'shoes');
assert.equal(getOutfitPieceSlot({ role: 'shoes', name: 'tall leather boots' }), 'shoes');
assert.equal(EVENT_HEIGHTS.shoes, 108, 'sneakers and boots share Event shoes height 108');
assert.equal(
  getOutfitPieceSlot({ name: 'Charles Tyrwhitt light pink dress shirt', category: 'tops' }),
  'top',
  'dress shirt remains a top slot',
);

assert.equal(getOutfitPieceSlot({ role: 'outerwear', name: 'navy coat' }), 'outerwear');
assert.equal(getOutfitPieceSlot({ role: 'top', name: 'white shirt' }), 'top');
assert.equal(getOutfitPieceSlot({ role: 'bottom', name: 'chinos' }), 'bottom');

console.log(JSON.stringify({
  ok: true,
  shared: { gap: DEFAULT_GAP, three: defaultThree, four: defaultFour, heights: DEFAULT_HEIGHTS },
  event: { gap: EVENT_GAP, pitch: EVENT_PITCH, overlap: EVENT_OVERLAP, three: eventThree, four: eventFour, heights: EVENT_HEIGHTS },
  scale: 1.18,
}, null, 2));
console.log('verify-event-outfit-collage-spacing: PASS');
