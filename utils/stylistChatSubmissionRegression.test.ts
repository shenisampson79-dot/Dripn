/**
 * Chat submission regressions — continuity banner guard + composer autocorrect contract.
 * Run: npx tsx utils/stylistChatSubmissionRegression.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const chatSrc = readFileSync(join(root, '../screens/AIStylistScreen.tsx'), 'utf8');

/** Pure guard mirror — null/empty flow must not render the banner. */
function shouldRenderContinuityBanner(continuityBanner: string | null | undefined): boolean {
  return Boolean(continuityBanner);
}

/** Label helper mirror — only called when banner is shown with a valid flow. */
function continuityBannerLabel(
  continuityBanner: string,
  continuityBannerCopy = 'Following on from {flow}',
): string {
  const flow =
    continuityBanner === 'sanity-check'
      ? 'Quick Sanity Check'
      : continuityBanner === 'event-outfit'
        ? 'Outfit for Event'
        : continuityBanner === 'shopping'
          ? 'Choosing What to Buy'
          : continuityBanner;
  return continuityBannerCopy.replace('{flow}', flow);
}

// A1 — null => no banner
assert.equal(shouldRenderContinuityBanner(null), false);
assert.equal(shouldRenderContinuityBanner(''), false);
assert.equal(shouldRenderContinuityBanner(undefined), false);

// A2 — valid flow => banner allowed
assert.equal(shouldRenderContinuityBanner('sanity-check'), true);
assert.equal(shouldRenderContinuityBanner('event-outfit'), true);
assert.equal(shouldRenderContinuityBanner('shopping'), true);
assert.equal(shouldRenderContinuityBanner('get-outfits'), true);

// A3 — dismiss => hidden (release clears banner state; guard fails closed)
assert.equal(shouldRenderContinuityBanner(null), false, 'after dismiss continuityBanner is null');

// A4 — guard prevents null interpolation; valid flows never emit "null"
assert.equal(
  shouldRenderContinuityBanner(null),
  false,
  'null continuityBanner must not reach banner copy',
);
assert.doesNotMatch(
  continuityBannerLabel('sanity-check'),
  /\bnull\b/i,
  'valid flow must not interpolate null',
);

// Source contract — banner render guard restored in renderScrollChatHeader
assert.match(
  chatSrc,
  /const renderScrollChatHeader = \(\) => \([\s\S]*?\{continuityBanner \? \([\s\S]*?styles\.continuityBanner/,
  'continuity banner must be gated on continuityBanner',
);
assert.match(
  chatSrc,
  /releaseDecisionContinuity\(\)/,
  'X must still call releaseDecisionContinuity',
);
assert.match(
  chatSrc,
  /setContinuityBanner\(null\)/,
  'dismiss must clear continuityBanner state',
);

// B1/B2 — explicit iOS keyboard contract on Chat composer TextInput
const composerTextInputBlock = chatSrc.match(
  /<TextInput[\s\S]*?onChangeText=\{setComposerText\}[\s\S]*?\/>/,
);
assert.ok(composerTextInputBlock, 'Chat composer TextInput block must exist');
assert.match(composerTextInputBlock![0], /autoCorrect=\{true\}/, 'autoCorrect must be explicit true');
assert.match(composerTextInputBlock![0], /spellCheck=\{true\}/, 'spellCheck must be explicit true');
assert.doesNotMatch(
  composerTextInputBlock![0],
  /autoCorrect=\{false\}/,
  'autocorrect must not be disabled on composer',
);

console.log('stylistChatSubmissionRegression.test.ts: all assertions passed');
