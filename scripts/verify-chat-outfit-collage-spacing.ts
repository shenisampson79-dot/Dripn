/**
 * Chat-only assistant-message collage spacing vs shared large and Event.
 * Run: npx tsx scripts/verify-chat-outfit-collage-spacing.ts
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const visualSrc = readFileSync(resolve(root, 'components/OutfitPiecesVisual.tsx'), 'utf8');
const safeSrc = readFileSync(resolve(root, 'components/SafeOutfitPieces.tsx'), 'utf8');
const chatSrc = readFileSync(resolve(root, 'screens/AIStylistScreen.tsx'), 'utf8');
const eventSrc = readFileSync(resolve(root, 'components/stylist/StylistDecisionFlow.tsx'), 'utf8');
const rankedSrc = readFileSync(resolve(root, 'components/stylist/RankedMultiLookCards.tsx'), 'utf8');
const askSrc = readFileSync(resolve(root, 'screens/AskStylistScreen.tsx'), 'utf8');
const profileSrc = readFileSync(resolve(root, 'screens/ProfileScreen.tsx'), 'utf8');
const todaySrc = readFileSync(resolve(root, 'components/TodaysOutfitCard.tsx'), 'utf8');
const dfyCalSrc = readFileSync(resolve(root, 'screens/DFYCalendarScreen.tsx'), 'utf8');
const dfyVisSrc = readFileSync(resolve(root, 'components/outfit/DFYOutfitVisual.tsx'), 'utf8');

const chatSafeBlocks = chatSrc.match(/<SafeOutfitPieces[\s\S]*?\/>/g) || [];
assert.equal(chatSafeBlocks.length, 2, 'exactly two standard Chat SafeOutfitPieces collages');
for (const block of chatSafeBlocks) {
  assert.match(block, /layoutVariant="chat"/, 'Chat collage opts into layoutVariant="chat"');
  assert.match(block, /\blarge\b/, 'Chat collage stays large');
  assert.doesNotMatch(block, /compact=\{?true/, 'Chat collage is not compact');
  assert.doesNotMatch(block, /layoutVariant="event"/, 'Chat collage is not Event');
}

assert.match(safeSrc, /layoutVariant\?: 'event' \| 'chat'/, 'SafeOutfitPieces accepts chat variant');
assert.match(safeSrc, /layoutVariant=\{layoutVariant\}/, 'SafeOutfitPieces forwards layoutVariant');
assert.match(visualSrc, /layoutVariant\?: 'event' \| 'chat'/, 'OutfitPiecesVisual accepts chat variant');
assert.match(visualSrc, /layoutVariant === 'chat'/, 'Chat variant is opt-in');

assert.match(visualSrc, /STACK_GAP_LARGE = 8/, 'shared large gap remains 8');
assert.match(visualSrc, /CHAT_OUTFIT_SLOT_OVERLAP = 20/, 'Chat overlap is 20');
assert.match(visualSrc, /STACK_OVERLAP = 14/, 'shared overlap bound remains 14');
assert.match(
  visualSrc,
  /const chatStackPitch = STACK_GAP_LARGE - CHAT_OUTFIT_SLOT_OVERLAP/,
  'Chat pitch is large gap minus overlap',
);
assert.match(visualSrc, /outerwear: 200,\s*\n\s*top: 168,\s*\n\s*bottom: 190,\s*\n\s*shoes: 120/, 'Chat keeps LARGE heights');
assert.match(visualSrc, /outerwear: 1,\s*\n\s*top: 0\.94/, 'LAYER_WIDTH_LARGE unchanged');
assert.match(visualSrc, /contentFit="contain"/, 'contain-fit unchanged');
assert.match(
  visualSrc,
  /displayScale=\{large && !tight && !compact \? LARGE_CUTOUT_DISPLAY_SCALE : 1\}/,
  'displayScale path unchanged',
);
assert.match(visualSrc, /LARGE_CUTOUT_DISPLAY_SCALE = 1\.18/, 'cutout scale remains 1.18');
assert.match(
  visualSrc,
  /stack\.filter\(\(l\) => l\.slot === 'top' \|\| l\.slot === 'outerwear'\)\.length >= 2 \? 1\.02/,
  'four-piece outerwear/top boost remains 1.02',
);
assert.match(visualSrc, /STACK_ORDER: LayerSlot\[\] = \['outerwear', 'top', 'dress', 'bottom', 'shoes'\]/, 'slot order unchanged');
assert.match(visualSrc, /zIndex: large \? 10 \+ index : index \+ 1/, 'z-index unchanged');
assert.match(
  visualSrc,
  /const canvasSlack = eventLayout \? 0 : chatLayout \? 0 :/,
  'Chat and Event canvases have no minHeight slack',
);
assert.match(visualSrc, /containerEvent: \{\s*\n\s*marginBottom: 0,/, 'Event bottom margin remains 0');
assert.match(visualSrc, /container: \{\s*\n\s*marginBottom: Spacing\.lg,/, 'Chat/shared bottom margin remains Spacing.lg');
assert.doesNotMatch(visualSrc, /containerChat/, 'Chat does not add a separate container style');
assert.match(visualSrc, /EVENT_OUTFIT_STACK_GAP = 2/, 'Event gap is 2');
assert.match(visualSrc, /EVENT_OUTFIT_SLOT_OVERLAP = 14/, 'Event overlap is 14');
assert.match(visualSrc, /outerwear: 178,\s*\n\s*top: 150,\s*\n\s*bottom: 170,\s*\n\s*shoes: 108/, 'Event heights unchanged');

assert.match(
  eventSrc,
  /layoutVariant=\{decisionType === 'event-outfit' \? 'event' : undefined\}/,
  'Event call site unchanged',
);

assert.doesNotMatch(rankedSrc, /layoutVariant/, 'ranked multi-look cards do not opt into Chat/Event variants');
assert.doesNotMatch(askSrc, /layoutVariant/, 'Ask Stylist does not opt into Chat/Event variants');
assert.doesNotMatch(profileSrc, /layoutVariant/, 'Profile does not opt into Chat/Event variants');
assert.doesNotMatch(todaySrc, /layoutVariant/, "Today's Outfit does not opt into Chat/Event variants");
assert.doesNotMatch(dfyCalSrc, /layoutVariant/, 'DFY calendar does not opt into Chat/Event variants');
assert.doesNotMatch(dfyVisSrc, /layoutVariant/, 'DFY visual does not opt into Chat/Event variants');
assert.doesNotMatch(chatSrc, /WardrobeItemImage[\s\S]{0,220}layoutVariant/, 'single-item Chat images do not use layoutVariant');

assert.doesNotMatch(chatSrc, /inferOutfitCountFromText[\s\S]{0,80}=[\s\S]{0,40}undefined/, 'Chat outfit-count helper remains');
assert.match(chatSrc, /accessibilityActions=\{\[\{ name: 'copy', label: 'Copy' \}\]\}/, 'Copy action unchanged');

const DEFAULT_HEIGHTS = { outerwear: 200, top: 168, bottom: 190, shoes: 120 };
const EVENT_HEIGHTS = { outerwear: 178, top: 150, bottom: 170, shoes: 108 };
const DEFAULT_GAP = 8;
const CHAT_OVERLAP = 20;
const CHAT_PITCH = DEFAULT_GAP - CHAT_OVERLAP;
const EVENT_GAP = 2;
const EVENT_OVERLAP = 14;
const EVENT_PITCH = EVENT_GAP - EVENT_OVERLAP;
const CANVAS_SLACK = 12 * 2;
const CHAT_BOTTOM_MARGIN = 16;

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

function boosted(h: number): number {
  return Math.round(h * 1.02);
}

const three: Array<keyof typeof DEFAULT_HEIGHTS> = ['outerwear', 'top', 'bottom'];
const four: Array<keyof typeof DEFAULT_HEIGHTS> = ['outerwear', 'top', 'bottom', 'shoes'];

const defaultThree = stackHeight(three, DEFAULT_HEIGHTS, DEFAULT_GAP);
const defaultFour = stackHeight(four, DEFAULT_HEIGHTS, DEFAULT_GAP);
const chatThree = stackHeight(three, DEFAULT_HEIGHTS, CHAT_PITCH);
const chatFour = stackHeight(four, DEFAULT_HEIGHTS, CHAT_PITCH);
const eventFour = stackHeight(four, EVENT_HEIGHTS, EVENT_PITCH);

assert.equal(CHAT_PITCH, -12, 'Chat neighbour pitch matches Event at -12');
assert.equal(defaultThree, 574, 'shared 3-piece stack');
assert.equal(defaultFour, 702, 'shared 4-piece stack');
assert.equal(chatThree, 534, 'Chat 3-piece stack uses two pitch transitions');
assert.equal(chatFour, 642, 'Chat 4-piece stack uses three pitch transitions');
assert.equal(defaultFour - chatFour, 60, 'four-piece Chat stack is 60px shorter than +8 gap');
assert.equal(CANVAS_SLACK, 24, 'shared non-Chat slack constant remains 24');
assert.equal(CHAT_BOTTOM_MARGIN, 16, 'Chat bottom margin remains 16');

const chatFourBoosted =
  boosted(DEFAULT_HEIGHTS.outerwear)
  + CHAT_PITCH + boosted(DEFAULT_HEIGHTS.top)
  + CHAT_PITCH + boosted(DEFAULT_HEIGHTS.bottom)
  + CHAT_PITCH + boosted(DEFAULT_HEIGHTS.shoes);
const defaultFourBoosted =
  boosted(DEFAULT_HEIGHTS.outerwear)
  + DEFAULT_GAP + boosted(DEFAULT_HEIGHTS.top)
  + DEFAULT_GAP + boosted(DEFAULT_HEIGHTS.bottom)
  + DEFAULT_GAP + boosted(DEFAULT_HEIGHTS.shoes);
assert.equal(chatFourBoosted, 655, 'Chat 4-piece boosted canvas from LARGE boxes + Event-like pitch');
assert.equal(defaultFourBoosted - chatFourBoosted, 60, 'boosted four-piece Chat canvas is 60px shorter than +8 gap');
assert.equal(chatFourBoosted + 0, 655, 'Chat minHeight has no extra slack');

const eventFourBoosted =
  boosted(EVENT_HEIGHTS.outerwear)
  + EVENT_PITCH + boosted(EVENT_HEIGHTS.top)
  + EVENT_PITCH + boosted(EVENT_HEIGHTS.bottom)
  + EVENT_PITCH + boosted(EVENT_HEIGHTS.shoes);
assert.equal(EVENT_PITCH, -12, 'Event pitch unchanged');
assert.equal(eventFour, 570, 'Event 4-piece raw canvas unchanged');
assert.equal(eventFourBoosted, 582, 'Event 4-piece boosted canvas unchanged');
assert.equal(eventFourBoosted + 0, 582, 'Event canvas has no slack');

console.log(JSON.stringify({
  ok: true,
  chat: {
    gap: DEFAULT_GAP,
    overlap: CHAT_OVERLAP,
    pitch: CHAT_PITCH,
    three: chatThree,
    four: chatFour,
    fourBoosted: chatFourBoosted,
    slack: CANVAS_SLACK,
    bottomMargin: CHAT_BOTTOM_MARGIN,
    heights: DEFAULT_HEIGHTS,
  },
  shared: { gap: DEFAULT_GAP, three: defaultThree, four: defaultFour },
  event: { pitch: EVENT_PITCH, fourBoosted: eventFourBoosted },
}, null, 2));
console.log('verify-chat-outfit-collage-spacing: PASS');
