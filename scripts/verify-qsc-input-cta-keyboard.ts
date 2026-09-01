/**
 * QSC input presentation rollback to 8df0c290.
 * Notes first; Get Verdict only when canProceed (full-lit, not always-pinned).
 * Run: npx tsx scripts/verify-qsc-input-cta-keyboard.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const flowSrc = readFileSync(resolve(root, 'components', 'stylist', 'StylistDecisionFlow.tsx'), 'utf8');
const hookSrc = readFileSync(resolve(root, 'hooks', 'useStylistDecision.ts'), 'utf8');

const sanity = flowSrc.match(/const renderSanityInput = \(\) => \([\s\S]*?\n  \);/)?.[0] || '';
assert.ok(sanity, 'renderSanityInput must exist');

const contextIdx = sanity.indexOf('renderContextChips(');
const uploadIdx = sanity.indexOf('renderUploadActions()');
const wardrobeIdx = sanity.indexOf('<DecisionWardrobePicker');
assert.ok(contextIdx >= 0 && uploadIdx >= 0 && wardrobeIdx >= 0);
assert.ok(contextIdx < uploadIdx, 'known-good: notes/context above photos');
assert.ok(uploadIdx < wardrobeIdx, 'Gallery/Camera still precede wardrobe');
assert.ok(
  !/selectedWardrobeIds\.length/.test(sanity),
  'photo controls must not require a wardrobe pre-selection',
);

assert.match(
  flowSrc,
  /if \(flow\.step === 'input' && flow\.canProceedFromInput\(\)\) \{[\s\S]*?stylistFlow\.getVerdict/,
  'Get Verdict appears only when submit requirements are met (illuminated CTA)',
);
assert.doesNotMatch(
  flowSrc,
  /if \(flow\.step === 'input' && decisionType === 'sanity-check'\) \{[\s\S]*?disabled: !canSubmit/,
  'must not keep a permanently pinned disabled QSC footer',
);
assert.match(
  flowSrc,
  /keyboardDismissMode="on-drag"/,
  'keyboard dismiss restored to known-good shared scroll mode',
);
assert.match(
  flowSrc,
  /renderPrimaryButton\(stickyCta\.label, stickyCta\.onPress, false, stickyCta\.loading\)/,
  'visible Get Verdict uses the enabled/illuminated primary style',
);

assert.match(hookSrc, /resolveQscEvaluateSubmitSelection/, 'selection-integrity submit helper preserved');
assert.match(hookSrc, /clearQscWardrobeSelectionForFreshStart/, 'fresh QSC start still clears stale IDs');
assert.match(hookSrc, /selectedContexts: activeContexts/, 'NL chips still submitted');
assert.match(hookSrc, /buildDecisionContext\(\)/, 'compiled context still submitted');
assert.doesNotMatch(hookSrc, /resolveQscScorePercent/, 'client still does not score QSC');

console.log('verify-qsc-input-cta-keyboard: ok');
