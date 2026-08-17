/**
 * Sanity follow-up CTA visibility.
 * Launch: QSC never offers Refine→Chat.
 * Run: npx tsx scripts/verify-sanity-follow-up-cta.ts
 */
import assert from 'node:assert/strict';
import {
  shouldShowSanityFollowUpCta,
  type SanityFollowUpResponse,
} from '../utils/sanityFollowUpCta';

function base(partial: Partial<SanityFollowUpResponse>): SanityFollowUpResponse {
  return {
    recommendation: 'Looks good.',
    reasoning: 'Clean casual.',
    ...partial,
  };
}

console.log('=== Sanity follow-up CTA (launch: always off) ===\n');

assert.equal(shouldShowSanityFollowUpCta(base({})), false, 'decisive pass hides CTA');

assert.equal(
  shouldShowSanityFollowUpCta(
    base({ stylistNote: 'Want me to pull a tee from your wardrobe?' }),
  ),
  false,
  'question still hides CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(
    base({
      stylistNote:
        'The outfit as a whole does not work well — major formality clash. Swap the singlet for a covered tee.',
    }),
  ),
  false,
  'swap critique still hides CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(
    base({
      outfitPieces: [{ type: 'recommended' }],
    }),
  ),
  false,
  'recommended piece still hides CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(base({ styleRating: 5.8 })),
  false,
  'low score still hides CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(base({ styleRating: 8.2, stylistNote: 'This works.' })),
  false,
  'high score still hides CTA',
);

assert.equal(shouldShowSanityFollowUpCta(null), false, 'null hides CTA');
assert.equal(shouldShowSanityFollowUpCta(undefined), false, 'undefined hides CTA');

console.log('All sanity follow-up checks passed.\n');
