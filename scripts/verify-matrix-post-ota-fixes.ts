/**
 * Post-OTA device matrix remaining fixes — regressions.
 * Run: npx tsx scripts/verify-matrix-post-ota-fixes.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  extractEventRecentOutfitIdLists,
  resolveEventOutfitHistoryPieces,
} from '../utils/extractEventRecentOutfitIdLists';

const root = resolve(__dirname, '..');
const welcomeSrc = readFileSync(resolve(root, 'screens/WelcomeScreen.tsx'), 'utf8');
const hookSrc = readFileSync(resolve(root, 'hooks/useStylistDecision.ts'), 'utf8');
const chatSrc = readFileSync(resolve(root, 'screens/AIStylistScreen.tsx'), 'utf8');
const productSrc = readFileSync(resolve(root, 'components/stylist/ProductCard.tsx'), 'utf8');
const shopThumbSrc = readFileSync(resolve(root, 'utils/shopThumbAssets.ts'), 'utf8');
const ensureShopSrc = readFileSync(resolve(root, 'utils/ensureShopImage.ts'), 'utf8');
const historySrc = readFileSync(resolve(root, 'utils/eventRecentOutfitHistory.ts'), 'utf8');

console.log('=== verify-matrix-post-ota-fixes ===\n');

// A. Home display order
{
  const wardrobeIdx = welcomeSrc.indexOf("welcome.featureWardrobeTitle");
  const talkIdx = welcomeSrc.indexOf("welcome.featureTalkStylistTitle");
  const stopIdx = welcomeSrc.indexOf("welcome.featureStopGuessingTitle");
  const lookIdx = welcomeSrc.indexOf("welcome.featureLookGoodTitle");
  assert.ok(wardrobeIdx > 0 && talkIdx > wardrobeIdx, 'shopping first');
  assert.ok(stopIdx > talkIdx, 'wardrobe third');
  assert.ok(lookIdx > stopIdx, 'confidence last');
}

// B. Event history persistence wiring
{
  assert.match(hookSrc, /loadEventRecentOutfitHistory/);
  assert.match(hookSrc, /appendEventRecentOutfitHistory/);
  assert.match(hookSrc, /Event recentOutfits hydrated/);
  assert.match(historySrc, /loadEventRecentOutfitHistory/);
  assert.doesNotMatch(hookSrc, /resetFlow[\s\S]{0,400}eventRecentOutfitsRef\.current\s*=\s*\[\]/);
}

{
  const prior = extractEventRecentOutfitIdLists([], [
    { wardrobeItemId: '142' },
    { wardrobeItemId: '85' },
    { wardrobeItemId: '121' },
    { wardrobeItemId: '50' },
  ]);
  assert.deepEqual(prior[0], ['142', '85', '121', '50']);
  const shopPrior = extractEventRecentOutfitIdLists([], resolveEventOutfitHistoryPieces({
    displayState: 'SHOP_REQUIRED',
    outfitPieces: null,
    retailOutfit: {
      products: [{ id: 'fw-f-top-blouse' }, { id: 'fw-f-bottom-midi' }, { id: 'fw-f-shoes-heel' }],
    },
  })!);
  assert.equal(shopPrior.length, 1);
  const second = extractEventRecentOutfitIdLists(prior, [
    { wardrobeItemId: '10' },
    { wardrobeItemId: '11' },
    { wardrobeItemId: '12' },
  ]);
  assert.equal(second.length, 2);
}

// C. SHOP_REQUIRED — conservative thumbs only; no category/title guessing
{
  assert.match(shopThumbSrc, /isFeminineShopProduct/);
  assert.match(shopThumbSrc, /pexels-photo-804069/);
  assert.match(shopThumbSrc, /pexels-photo-5264927/);
  assert.match(shopThumbSrc, /if \(feminine\) return false/);
  assert.doesNotMatch(shopThumbSrc, /\/white\|poplin/);
  assert.doesNotMatch(ensureShopSrc, /CATEGORY_FALLBACK/);
  assert.match(ensureShopSrc, /return null/);
  assert.match(productSrc, /ensureShopImage\(product, gender\)/);
  assert.match(productSrc, /shopping-bag/);
}

// D. Chat composer — Android skips Reanimated keyboard hook; iOS keeps animated pad
{
  function extractNamedFunction(src: string, name: string): string {
    const start = src.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} is present`);
    const paramOpen = start + `function ${name}`.length;
    assert.equal(src[paramOpen], '(', `${name} has a parameter list`);
    let parenDepth = 0;
    let i = paramOpen;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(') parenDepth += 1;
      else if (ch === ')') {
        parenDepth -= 1;
        if (parenDepth === 0) {
          i += 1;
          break;
        }
      }
    }
    assert.ok(parenDepth === 0, `${name} parameter list is closed`);
    while (i < src.length && /\s/.test(src[i])) i += 1;
    const brace = i;
    assert.equal(src[brace], '{', `${name} has a body after its parameter list`);
    let depth = 0;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    assert.fail(`${name} is closed`);
  }

  const parentScreen = extractNamedFunction(chatSrc, 'AIStylistScreen');
  const animatedPad = extractNamedFunction(chatSrc, 'StylistComposerAnimatedPad');
  const composerPad = extractNamedFunction(chatSrc, 'StylistComposerPad');

  assert.match(chatSrc, /KeyboardStickyView offset=\{\{ closed: -tabBarHeight/);
  assert.match(parentScreen, /useKeyboardState/);
  assert.doesNotMatch(
    parentScreen,
    /useReanimatedKeyboardAnimation\s*\(/,
    'AIStylistScreen does not invoke useReanimatedKeyboardAnimation directly',
  );
  assert.match(
    animatedPad,
    /useReanimatedKeyboardAnimation\s*\(/,
    'Reanimated keyboard hook is confined to StylistComposerAnimatedPad',
  );
  assert.doesNotMatch(
    composerPad,
    /useReanimatedKeyboardAnimation\s*\(/,
    'StylistComposerPad does not call the Reanimated keyboard hook',
  );
  assert.match(
    composerPad,
    /if \(Platform\.OS === 'android'\)/,
    'static pad is selected on all Android versions',
  );
  assert.doesNotMatch(
    composerPad,
    /Platform\.Version|API_LEVEL|<= 28/,
    'Android pad is not gated by API level',
  );
  assert.match(
    composerPad,
    /<View style=\{\{ backgroundColor, paddingBottom: Spacing\.md \}\}>/,
    'static Android pad retains paddingBottom Spacing.md',
  );
  assert.match(
    composerPad,
    /<StylistComposerAnimatedPad backgroundColor=\{backgroundColor\}>/,
    'non-Android path retains the animated pad',
  );
  assert.match(
    animatedPad,
    /paddingBottom: keyboardHeight\.value === 0 \? Spacing\.md : Spacing\.sm/,
    'iOS animated pad keeps md closed / sm open inset',
  );
  assert.doesNotMatch(
    chatSrc,
    /paddingBottom: keyboardHeight\.value === 0 \? tabBarHeight/,
    'removed double tabBarHeight pad on composer',
  );
}

console.log('All matrix post-OTA fix checks passed.');
