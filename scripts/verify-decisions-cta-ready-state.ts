/**
 * Decisions sticky CTAs: ready uses theme.link / theme.buttonText.
 * Incomplete visibility and readiness predicates stay unchanged.
 * Run: npx tsx scripts/verify-decisions-cta-ready-state.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const flowSrc = readFileSync(resolve(root, 'components', 'stylist', 'StylistDecisionFlow.tsx'), 'utf8');
const hookSrc = readFileSync(resolve(root, 'hooks', 'useStylistDecision.ts'), 'utf8');
const themeSrc = readFileSync(resolve(root, 'constants', 'theme.ts'), 'utf8');

assert.match(flowSrc, /const renderDecisionReadyCta = \(/, 'local ready/inactive CTA helper');
assert.match(flowSrc, /const fill = ready \? theme\.link : theme\.backgroundSecondary/, 'ready fill is theme.link');
assert.match(flowSrc, /const labelColor = ready \? theme\.buttonText : theme\.tabIconDefault/, 'ready label is theme.buttonText');

assert.match(
  flowSrc,
  /label: t\('stylistFlow\.getVerdict'\)[\s\S]*?useReadyAccent: true/,
  '2: QSC Get verdict uses ready accent when shown',
);
assert.match(
  flowSrc,
  /label: t\('stylistFlow\.continue'\)[\s\S]*?useReadyAccent: true/,
  '4: Event Continue uses ready accent when shown',
);
assert.match(
  flowSrc,
  /decisionType === 'shopping'[\s\S]*?stylistFlow\.getRecommendation[\s\S]*?useReadyAccent: true/,
  '6: Shopping Get recommendation uses ready accent when shown',
);

assert.match(
  flowSrc,
  /if \(flow\.step === 'input' && flow\.canProceedFromInput\(\)\) \{[\s\S]*?stylistFlow\.getVerdict/,
  '1: QSC CTA still hidden until canProceedFromInput',
);
assert.match(
  flowSrc,
  /if \(!flow\.eventDetails\.eventType \|\| !flow\.eventDetails\.dressCode\) return null/,
  '3: Event Continue still hidden until eventType and dressCode',
);
assert.match(
  flowSrc,
  /if \(flow\.step === 'input' && flow\.canProceedFromInput\(\)\) \{[\s\S]*?decisionType === 'shopping'/,
  '5: Shopping CTA still hidden until canProceedFromInput',
);

assert.match(themeSrc, /const tintColorLight = "#4A3428"/, '7/8 light ready fill is mocha tint');
assert.match(themeSrc, /const tintColorDark = "#C9A87C"/, '7/8 dark ready fill is gold tint');
assert.match(themeSrc, /link: tintColorLight/, 'light theme.link is the mocha tint');
assert.match(themeSrc, /link: tintColorDark/, 'dark theme.link is the gold tint');
assert.match(themeSrc, /buttonText: "#FFFFFF"/, 'on-accent button text is white in both schemes');

assert.match(flowSrc, /keyboardDismissMode="on-drag"/, 'keyboard dismiss unchanged');
assert.match(flowSrc, /<KeyboardStickyView offset=\{\{ closed: 0, opened: 0 \}\}>/, 'sticky footer chrome unchanged');
assert.doesNotMatch(flowSrc, /if \(flow\.step === 'input' && decisionType === 'sanity-check'\) \{[\s\S]*?disabled: !canSubmit/);

assert.match(
  hookSrc,
  /decisionType === 'sanity-check'[\s\S]*return images\.length >= 1 \|\| selectedWardrobeIds\.length >= 1/,
  '10: QSC readiness predicate unchanged',
);
assert.match(
  hookSrc,
  /decisionType === 'shopping'[\s\S]*return images\.length >= 1 \|\| contextNotes\.trim\(\)\.length > 0 \|\| activeContexts\.length > 0/,
  '10: Shopping readiness predicate unchanged',
);
assert.match(hookSrc, /resolveQscEvaluateSubmitSelection/, 'selection-integrity preserved');
assert.doesNotMatch(hookSrc, /resolveQscScorePercent/);

console.log('verify-decisions-cta-ready-state: ok');
