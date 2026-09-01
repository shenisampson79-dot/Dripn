/**
 * QSC input: notes stay keyboard-safe; Get Verdict looks disabled then illuminates.
 * Run: npx tsx scripts/verify-qsc-input-cta-keyboard.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const flowSrc = readFileSync(resolve(root, 'components', 'stylist', 'StylistDecisionFlow.tsx'), 'utf8');
const hookSrc = readFileSync(resolve(root, 'hooks', 'useStylistDecision.ts'), 'utf8');

assert.match(
  flowSrc,
  /if \(flow\.step === 'input' && decisionType === 'sanity-check'\) \{[\s\S]*?label: t\('stylistFlow\.getVerdict'\)/,
  'QSC Get Verdict is shown on input without hiding behind canProceed',
);
assert.match(
  flowSrc,
  /disabled: !canSubmit/,
  'incomplete QSC selection uses disabled-looking CTA',
);
assert.match(
  flowSrc,
  /Boolean\(stickyCta\.disabled\)/,
  'sticky CTA disabled flag is wired into primary button opacity',
);
assert.match(
  flowSrc,
  /keyboardDismissMode=\{decisionType === 'sanity-check' \? 'none' : 'on-drag'\}/,
  'QSC must not dismiss keyboard on scroll/drag',
);
assert.match(
  flowSrc,
  /decisionType !== 'sanity-check'[\s\S]*?scrollRef\.current\?\.scrollTo/,
  'QSC notes focus scrolls the field above the keyboard/CTA',
);

const sanity = flowSrc.match(/const renderSanityInput = \(\) => \([\s\S]*?\n  \);/)?.[0] || '';
assert.match(sanity, /renderUploadActions\(\)/, 'Gallery/Camera row preserved');
assert.ok(
  sanity.indexOf('<DecisionWardrobePicker') < sanity.indexOf('renderContextChips('),
  'notes/context still follow wardrobe — selection UI not redesigned',
);

assert.match(hookSrc, /resolveQscEvaluateSubmitSelection/, 'selection-integrity submit helper preserved');
assert.match(hookSrc, /clearQscWardrobeSelectionForFreshStart/, 'fresh QSC start still clears stale IDs');
assert.match(hookSrc, /selectedContexts: activeContexts/, 'NL chips still submitted');
assert.match(hookSrc, /buildDecisionContext\(\)/, 'compiled context still submitted');
assert.doesNotMatch(hookSrc, /resolveQscScorePercent/, 'client still does not score QSC');

assert.match(
  flowSrc,
  /if \(flow\.step === 'input' && flow\.canProceedFromInput\(\)\) \{[\s\S]*?decisionType === 'shopping'/,
  'Shopping CTA gating unchanged',
);
assert.match(
  flowSrc,
  /if \(decisionType === 'event-outfit'\) \{[\s\S]*?stylistFlow\.getRecommendation/,
  'Event CTA label unchanged',
);

console.log('verify-qsc-input-cta-keyboard: ok');
