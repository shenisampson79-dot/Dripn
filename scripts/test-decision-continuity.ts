/**
 * Client QSC → Chat continuity: visible seed must never dump engine instructions.
 * Run: npx tsx scripts/test-decision-continuity.ts
 */
import assert from 'node:assert/strict';
import {
  buildFollowUpPrompt,
  buildUserVisibleFollowUp,
  toApiDecisionContinuity,
  type DecisionContinuityPayload,
} from '../utils/decisionContinuity';

console.log('=== Client decision continuity ===\n');

const base = {
  decisionSessionId: 'sess-qsc-1',
  flow: 'sanity-check' as const,
  stylistId: 'ivy',
  completedAt: new Date().toISOString(),
  goalText: '',
  selectedContexts: [] as string[],
  selectedWardrobeIds: [] as string[],
  uploadedImageCount: 1,
  verdict: {
    recommendation:
      "I couldn't get a confident read on this look. Try again with the full outfit clearly in frame.",
    reasoning: '',
    styleRating: null,
    ratingLabel: null,
    outfitSummary: null,
    outfitPieces: undefined,
    recommendedIndex: null,
  },
};

const visible = buildUserVisibleFollowUp(base);
assert.match(visible, /finish this look from my wardrobe/i);
assert.doesNotMatch(visible, /Following on from my|keep every piece|base top under a blazer|do not invent/i);
assert.doesNotMatch(visible, /confident read|full outfit clearly in frame/i);
console.log('✓ user-visible QSC seed is short and human');

const engine = buildFollowUpPrompt(base);
assert.match(engine, /Following on from my Quick Sanity Check/i);
assert.doesNotMatch(engine, /base top under a blazer/i);
console.log('✓ engine follow-up no longer seeds blazer as an example');

const payload: DecisionContinuityPayload = {
  ...base,
  followUpPrompt: engine,
  userVisibleFollowUp: visible,
};
const api = toApiDecisionContinuity(payload);
assert.ok(api);
assert.equal('followUpPrompt' in (api as object), false);
assert.equal('userVisibleFollowUp' in (api as object), false);
assert.equal(api?.decisionSessionId, 'sess-qsc-1');
console.log('✓ API continuity omits chat seeds');

console.log('\nclient decision-continuity: passed');
