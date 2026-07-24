/**
 * Sanity follow-up CTA visibility.
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

console.log('=== Sanity follow-up CTA ===\n');

assert.equal(shouldShowSanityFollowUpCta(base({})), false, 'decisive pass should hide CTA');

assert.equal(
  shouldShowSanityFollowUpCta(
    base({ stylistNote: 'Want me to pull a tee from your wardrobe?' }),
  ),
  true,
  'question should show CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(
    base({
      stylistNote:
        'The outfit as a whole does not work well — major formality clash. Swap the singlet for a covered tee.',
    }),
  ),
  true,
  'swap critique should show CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(
    base({
      outfitPieces: [{ type: 'recommended' }],
    }),
  ),
  true,
  'recommended piece should show CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(base({ styleRating: 5.8 })),
  true,
  'low score should show CTA',
);

assert.equal(
  shouldShowSanityFollowUpCta(base({ styleRating: 8.2, stylistNote: 'This works.' })),
  false,
  'high score approval should hide CTA',
);

console.log('All sanity follow-up checks passed.\n');
