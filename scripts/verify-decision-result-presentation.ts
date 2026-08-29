/**
 * Decisions result presentation — scannable hierarchy formatter + render contract.
 * Run: npx tsx scripts/verify-decision-result-presentation.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveStylistResultDisplayState } from '../utils/stylistResultDisplayState';
import {
  VERDICT_BAND_RETHINK_MAX,
  VERDICT_BAND_TWEAK_MAX,
  formatDecisionResultPresentation,
  isBottomLineCandidate,
  ratingLabelAsVerdictChip,
  resolveScoreDisplay,
  resolveVerdictLabel,
  splitIntoSentences,
  verdictFromStyleRating,
} from '../utils/decisionResultPresentation';
import { ENGINE_LEAK_SENTINEL } from '../utils/stylistPresentationBoundary';

type TestResponse = Parameters<typeof formatDecisionResultPresentation>[0];

function base(overrides: Partial<TestResponse> = {}): TestResponse {
  return {
    recommendation: '',
    reasoning: '',
    ...overrides,
  };
}

console.log('=== verify-decision-result-presentation ===\n');

// QSC: outfitScore renders X.X/10; ratingLabel independent
{
  const display = formatDecisionResultPresentation(
    base({ outfitScore: 8.2, ratingLabel: 'Works', message: 'Looks polished for work.' }),
    'sanity-check',
  );
  assert.equal(display.verdictLabel, 'WORKS');
  assert.equal(display.scoreDisplay, '8.2/10');
  assert.doesNotMatch(display.scoreDisplay || '', /%/);
  assert.ok(display.summary);
}

// QSC: ratingLabel without outfitScore — verdict only, no numeric score
{
  const display = formatDecisionResultPresentation(
    base({ ratingLabel: 'Works', message: 'Looks polished for work.' }),
    'sanity-check',
  );
  assert.equal(display.verdictLabel, 'WORKS');
  assert.equal(display.scoreDisplay, null);
}

// Internal styleRating never drives QSC display (use outfitScore only)
{
  const display = formatDecisionResultPresentation(
    base({ styleRating: 8.2, message: 'Looks polished for work.' }),
    'sanity-check',
  );
  assert.equal(display.scoreDisplay, null);
}

// Verdict bands on customer-facing styleRating
assert.equal(verdictFromStyleRating(8.2), 'WORKS');
assert.equal(verdictFromStyleRating(6.5), 'NEEDS A TWEAK');
assert.equal(verdictFromStyleRating(5.4), 'RETHINK IT');
assert.equal(VERDICT_BAND_TWEAK_MAX, 7.0);
assert.equal(VERDICT_BAND_RETHINK_MAX, 5.4);

// Do not manufacture NEEDS A TWEAK from binary verdict alone
{
  assert.equal(resolveVerdictLabel({ verdict: 'works' }), 'WORKS');
  assert.equal(resolveVerdictLabel({ verdict: 'doesnt_work' }), 'RETHINK IT');
  assert.equal(resolveVerdictLabel({ verdict: 'doesnt_work', styleRating: null }), 'RETHINK IT');
  assert.notEqual(resolveVerdictLabel({ verdict: 'works' }), 'NEEDS A TWEAK');
}

// Prefer explicit short ratingLabel verdict chips when present
{
  assert.equal(ratingLabelAsVerdictChip('NEEDS A TWEAK'), 'NEEDS A TWEAK');
  assert.equal(ratingLabelAsVerdictChip('Strong overall with one tweak needed.'), null);
  assert.equal(
    resolveVerdictLabel({ ratingLabel: 'NEEDS A TWEAK', styleRating: 8.2 }),
    'NEEDS A TWEAK',
  );
}

// Long prose becomes scannable
{
  const essay =
    'Strong overall. One small refinement would make it sharper. '
    + 'Black overcoat and white shirt create a strong foundation. '
    + 'Light blue jeans keep the outfit smart-casual. '
    + 'Brown boots work, but another brown detail would tie them in. '
    + "You're good to go.";
  const display = formatDecisionResultPresentation(
    base({ outfitScore: 8.2, message: essay }),
    'sanity-check',
  );
  assert.ok(display.summary, 'summary present');
  assert.ok(display.bullets.length >= 2 && display.bullets.length <= 4, '2–4 WHY points');
  assert.ok(display.bottomLine && /good to go/i.test(display.bottomLine), 'bottom line when action-like');
  assert.ok(!display.bullets.some((b) => /good to go/i.test(b)), 'bottom line not duplicated in bullets');
}

// Short prose remains sensible
{
  const display = formatDecisionResultPresentation(
    base({ outfitScore: 7.8, message: 'This works for a smart-casual office day.' }),
    'sanity-check',
  );
  assert.equal(display.bullets.length, 0);
  assert.match(display.summary || '', /works/i);
}

// Event and Shopping never show numeric outfit score
{
  assert.equal(resolveScoreDisplay('event-outfit', 7.2), null);
  assert.equal(resolveScoreDisplay('shopping', 8.5), null);
  assert.equal(resolveScoreDisplay('sanity-check', 8.2), '8.2/10');
  const eventDisplay = formatDecisionResultPresentation(
    base({ outfitScore: 7.2, styleRating: 7.2, message: 'Smart casual for dinner.' }),
    'event-outfit',
  );
  assert.equal(eventDisplay.scoreDisplay, null);
  const shopDisplay = formatDecisionResultPresentation(
    base({ outfitScore: 8.0, message: 'Option 2 wins.' }),
    'shopping',
  );
  assert.equal(shopDisplay.scoreDisplay, null);
}

// Shopping multi prose structured
{
  const display = formatDecisionResultPresentation(
    base({
      message: 'Option 2 is the best buy. It balances price and versatility. The leather quality looks stronger than option 1.',
      recommendedIndex: 1,
    }),
    'shopping',
  );
  assert.ok(display.summary);
  assert.ok(display.bullets.length >= 1);
}

// unifiedScore never exposed via formatter output
{
  const display = formatDecisionResultPresentation(
    base({
      outfitScore: 8,
      message: 'Looks good.',
      ...({ unifiedScore: { style_score: 0.91, feedback: ['Internal only'] } } as object),
    }),
    'sanity-check',
  );
  const blob = JSON.stringify(display);
  assert.doesNotMatch(blob, /style_score|color_score|fit_score|Internal only/);
}

// Sentinel leak protection
{
  const display = formatDecisionResultPresentation(
    base({ message: ENGINE_LEAK_SENTINEL, styleRating: 8 }),
    'sanity-check',
  );
  assert.doesNotMatch(JSON.stringify(display), new RegExp(ENGINE_LEAK_SENTINEL, 'i'));
}

// Bottom line not blindly assigned
{
  assert.equal(isBottomLineCandidate('Brown boots work, but another brown detail would tie them in.'), false);
  assert.equal(isBottomLineCandidate("You're good to go."), true);
}

// Sentence segmentation preserves punctuation
{
  const parts = splitIntoSentences('First point. Second point! Third point?');
  assert.equal(parts.length, 3);
  assert.match(parts[0], /\.$/);
  assert.match(parts[1], /!$/);
}

// EVENT routing unchanged
{
  assert.equal(
    resolveStylistResultDisplayState({ displayState: 'REJECTED_WARDROBE_FIX', isFallback: true }, 'event-outfit'),
    'REJECTED_WARDROBE_FIX',
  );
  assert.equal(
    resolveStylistResultDisplayState({ displayState: 'SHOP_REQUIRED', retailOutfit: { products: [{ id: '1' }] } }, 'event-outfit'),
    'SHOP_REQUIRED',
  );
}

// Event: message summary + distinct reasoning → WHY bullets (deduped)
{
  const display = formatDecisionResultPresentation(
    base({
      message: 'Smart casual polish for the dinner.',
      reasoning: 'The navy blazer anchors the look. Cream trousers keep it evening-appropriate. Loafers finish it cleanly.',
    }),
    'event-outfit',
  );
  assert.match(display.summary || '', /Smart casual/i);
  assert.ok(display.bullets.length >= 2, 'reasoning becomes WHY bullets');
  assert.ok(!display.bullets.some((b) => /Smart casual polish/i.test(b)), 'summary not duplicated in bullets');
}

// Event: duplicate reasoning omitted
{
  const display = formatDecisionResultPresentation(
    base({
      message: 'Smart casual polish for the dinner.',
      reasoning: 'Smart casual polish for the dinner.',
    }),
    'event-outfit',
  );
  assert.match(display.summary || '', /Smart casual/i);
  assert.equal(display.bullets.length, 0);
}

// SHOPPING DO_NOT_BUY routing unchanged
{
  assert.equal(
    resolveStylistResultDisplayState({ purchaseDecision: { decision: 'DO_NOT_BUY' }, status: 'SHOP_REQUIRED' }, 'shopping'),
    'APPROVED',
  );
}

// Render contract in StylistDecisionFlow
{
  const flowSrc = readFileSync(resolve(__dirname, '../components/stylist/StylistDecisionFlow.tsx'), 'utf8');
  assert.match(flowSrc, /formatDecisionResultPresentation/);
  assert.match(flowSrc, /renderDecisionResultHierarchy/);
  assert.match(flowSrc, /WHY/);
  assert.doesNotMatch(flowSrc, /qscPercent/);
  assert.match(flowSrc, /responseOptionThumbWinner/);
  assert.match(flowSrc, /flow\.resetFlow\(\)/);
  assert.match(flowSrc, /stylistFlow\.done/);
  assert.match(flowSrc, /% match/);
}

// Hook: QSC outfitScore + ratingLabel; event reasoning kept with message
{
  const hookSrc = readFileSync(resolve(__dirname, '../hooks/useStylistDecision.ts'), 'utf8');
  assert.match(hookSrc, /outfitScore/);
  assert.match(hookSrc, /decisionType === 'sanity-check'\)[\s\S]*return label/);
  assert.match(hookSrc, /mappedType === 'event_outfit'\) return raw/);
  assert.match(hookSrc, /styleRating: null/);
}

console.log('All decision result presentation checks passed.');
