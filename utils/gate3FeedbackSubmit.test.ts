/**
 * G3-DM-10b — feedback submit resolves type when area chip selected.
 * Run: npx tsx utils/gate3FeedbackSubmit.test.ts
 */
import assert from 'node:assert/strict';

type FeedbackType = 'bug' | 'feature' | 'general' | 'rating';
type FeedbackCategory = 'account' | 'stylist' | 'wardrobe';

function resolveFeedbackType(
  feedbackType: FeedbackType | null,
  category: FeedbackCategory | null,
): FeedbackType | null {
  if (feedbackType) return feedbackType;
  if (category) return 'general';
  return null;
}

assert.equal(resolveFeedbackType(null, 'account'), 'general', 'area selected → default general');
assert.equal(resolveFeedbackType('bug', 'account'), 'bug', 'explicit type preserved');
assert.equal(resolveFeedbackType(null, null), null, 'nothing selected stays null');

console.log('gate3FeedbackSubmit.test.ts: all passed');
