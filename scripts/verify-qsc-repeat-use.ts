/**
 * QSC repeat-use — completed result must expose Start over → fresh input.
 *
 * Run: npx tsx scripts/verify-qsc-repeat-use.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { shouldShowDecisionRefineCta } from '../utils/sanityFollowUpCta';

const flowPath = resolve(__dirname, '../components/stylist/StylistDecisionFlow.tsx');
const hookPath = resolve(__dirname, '../hooks/useStylistDecision.ts');
const managerPath = resolve(__dirname, '../services/DecisionSessionManager.ts');
const flowSrc = readFileSync(flowPath, 'utf8');
const hookSrc = readFileSync(hookPath, 'utf8');
const managerSrc = readFileSync(managerPath, 'utf8');

// CASE 1 — completed QSC response: Start over + Done visible in source
const responseActionsMatches = [
  ...flowSrc.matchAll(
    /<View style=\{styles\.responseActions\}>[\s\S]*?<\/View>/g,
  ),
];
assert.ok(responseActionsMatches.length >= 2, 'multiple responseActions blocks expected');
const qscResponseActions = responseActionsMatches
  .map((m) => m[0])
  .find((block) => block.includes("const isQsc = decisionType === 'sanity-check'"));
assert.ok(qscResponseActions, 'QSC responseActions block must exist');
const responseActions = qscResponseActions;

assert.match(
  responseActions,
  /const isQsc = decisionType === 'sanity-check'/,
  'QSC branch must exist in response actions',
);
assert.match(
  responseActions,
  /renderPrimaryButton\(t\('stylistFlow\.done'\)/,
  'Done primary CTA must remain on non-refine response',
);
assert.match(
  responseActions,
  /flow\.completeAndClose\(\)/,
  'Done must still call completeAndClose',
);

// QSC must not be Done-only — Start over on response when isQsc
assert.match(
  responseActions,
  /!isQsc \?[\s\S]*flow\.resetFlow\(\)/,
  'non-QSC flows retain resetFlow in secondary actions',
);
const qscStartOverBranches =
  responseActions.match(/!isQsc \?[\s\S]*?:\s*\(\s*\n?\s*<Pressable onPress=\{\(\) => flow\.resetFlow\(\)\}/g)
  ?? [];
assert.ok(qscStartOverBranches.length >= 2, 'QSC Start over branch required in stale and normal response paths');

// CASE 2 — resetFlow contract in hook (Start over target)
assert.match(hookSrc, /const resetFlow = \(\) => \{/, 'resetFlow must exist');
assert.match(hookSrc, /decisionSessionManager\.clearSession/, 'resetFlow clears persisted session');
assert.match(hookSrc, /setResponse\(null\)/, 'resetFlow clears in-memory result');
assert.match(hookSrc, /setStep\(/, 'resetFlow restores draft step');

// Fresh input: Camera/Gallery/Wardrobe after reset (input step layout)
const sanityBlock = flowSrc.match(/const renderSanityInput = \(\) => \([\s\S]*?\n  \);/);
assert.ok(sanityBlock, 'renderSanityInput must exist');
const sanity = sanityBlock[0];
assert.match(sanity, /renderUploadActions\(\)/, 'Camera/Gallery row on fresh input');
assert.match(flowSrc, /onPress=\{flow\.handlePickImage\}/, 'Gallery handler preserved');
assert.match(flowSrc, /onPress=\{flow\.handleTakePhoto\}/, 'Camera handler preserved');
assert.match(sanity, /DecisionWardrobePicker/, 'Wardrobe picker on input step');

// CASE 3 — re-entry: completed session derives response; Start over still in UI source
assert.match(
  managerSrc,
  /if \(session\.result\) return 'response'/,
  'getDerivedStep opens completed sessions on response',
);
assert.match(
  hookSrc,
  /applySessionToState\(nextSession\)/,
  'hydrate restores persisted completed session',
);
assert.match(
  flowSrc,
  /flow\.step === 'response' \? renderResponse\(\)/,
  'response step renders completed verdict until reset',
);

// CASE 4 — Refine→Ivy remains absent
assert.equal(
  shouldShowDecisionRefineCta('sanity-check', { styleRating: 8.2, recommendation: 'ok' }),
  false,
  'Refine CTA must stay off for QSC',
);
assert.ok(
  flowSrc.includes('shouldShowDecisionRefineCta'),
  'refine gate preserved',
);
assert.ok(
  !/isQsc && shouldShowSanityFollowUpCta/.test(flowSrc),
  'must not re-enable QSC refine path',
);

console.log('verify-qsc-repeat-use: all cases passed');
