/**
 * Launch: no Decisions/QSC → Stylist Chat refine CTA.
 *
 * Run: npx tsx scripts/verify-decisions-refine-cta-removal.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  shouldShowDecisionRefineCta,
  shouldShowSanityFollowUpCta,
  type SanityFollowUpResponse,
} from '../utils/sanityFollowUpCta';

const flowPath = resolve(__dirname, '../components/stylist/StylistDecisionFlow.tsx');
const hubPath = resolve(__dirname, '../screens/StylistHubScreen.tsx');
const flowSrc = readFileSync(flowPath, 'utf8');
const hubSrc = readFileSync(hubPath, 'utf8');

function base(partial: Partial<SanityFollowUpResponse>): SanityFollowUpResponse {
  return {
    recommendation: 'Looks good.',
    reasoning: 'Clean casual.',
    ...partial,
  };
}

const res = base({ styleRating: 8.2, stylistNote: 'This works.' });

for (const flow of ['sanity-check', 'event-outfit', 'shopping'] as const) {
  assert.equal(
    shouldShowDecisionRefineCta(flow, res),
    false,
    `${flow} must not show refine CTA`,
  );
}

assert.equal(shouldShowSanityFollowUpCta(res), false, 'QSC alias still off');

// UI gate — no hardcoded event/shopping refine paths
assert.ok(
  flowSrc.includes('shouldShowDecisionRefineCta'),
  'StylistDecisionFlow must use shouldShowDecisionRefineCta',
);
assert.ok(
  !/decisionType === 'event-outfit'\s*\|\|\s*decisionType === 'shopping'/.test(flowSrc),
  'must not hardcode event/shopping refine CTA',
);
assert.ok(
  !/showFollowUp\s*=\s*\(isQsc && shouldShowSanityFollowUpCta/.test(flowSrc),
  'must not use legacy QSC-only gate for showFollowUp',
);

// Shopping already-owned chat handoff gated too
assert.match(
  flowSrc,
  /shouldShowDecisionRefineCta\(decisionType, res\)\s*\?\s*\(\s*\n?\s*<Pressable[\s\S]*?showAlternatives/,
  'Show alternatives must be gated by shouldShowDecisionRefineCta',
);

// Refine label only inside showFollowUp branch (dead at launch — preserved for re-enable)
assert.ok(
  flowSrc.includes("stylistFlow.refineWithStylist"),
  'refine label key may remain for future re-enable behind gate',
);
assert.ok(
  flowSrc.includes('flow.continueInChat'),
  'continueInChat handler preserved (not deleted)',
);

// Core result actions intact
for (const action of [
  'flow.completeAndClose',
  'flow.resetFlow',
  'flow.refreshStaleRecommendation',
]) {
  assert.ok(flowSrc.includes(action), `${action} must remain`);
}

// Shopping/Event: Done + Start over only — no Don't like / Edit & re-run on result card
assert.doesNotMatch(flowSrc, /outfitFeedback\.dontLike/, 'Don\'t like must not appear on Decisions result');
assert.doesNotMatch(flowSrc, /stylistFlow\.editAndRerun/, 'Edit & re-run must not appear on Decisions result');
assert.doesNotMatch(flowSrc, /flow\.rejectAndClose/, 'rejectAndClose must not appear on Decisions result UI');
assert.doesNotMatch(flowSrc, /flow\.editAndRerun/, 'editAndRerun must not appear on Decisions result UI');
assert.ok(flowSrc.includes('stylistFlow.done'), 'Done CTA must remain');
assert.ok(flowSrc.includes('stylistFlow.startOver'), 'Start over CTA must remain');

// Verdict rendering intact
assert.ok(flowSrc.includes('resolveStylistResultDisplayState'), 'verdict display preserved');
assert.ok(flowSrc.includes('formatDecisionResultPresentation'), 'structured result presentation preserved');
assert.ok(flowSrc.includes('renderDecisionResultHierarchy'), 'hierarchy renderer preserved');
assert.ok(flowSrc.includes('renderMarkdownText'), 'markdown body rendering preserved');

// Standalone Stylist Chat entry elsewhere untouched
assert.ok(hubSrc.includes('navigation.navigate("AIStylist")'), 'Stylist hub chat tile intact');

// Reasoning / continuity modules not edited by this task (read-only sentinel)
const continuitySrc = readFileSync(resolve(__dirname, '../utils/decisionContinuity.ts'), 'utf8');
assert.ok(continuitySrc.includes('buildDecisionContinuity'), 'decisionContinuity preserved');

console.log('verify-decisions-refine-cta-removal: all passed');
