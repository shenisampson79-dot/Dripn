/**
 * Sticky shorts classification tests.
 * Run: npx tsx utils/stickyShortsSubtype.test.ts
 */
import assert from 'node:assert/strict';
import {
  stickShortsSubtype,
  SHORTS_DOWNGRADE_MIN_CONF,
} from './stickyShortsSubtype';
import {
  garmentSpecificityRank,
  resolveFusedIdentity,
  coreGarmentToken,
} from './visionTrust';

// Upgrade athletic → chino always allowed.
assert.equal(
  stickShortsSubtype({
    prev: 'athletic_shorts',
    next: 'chino_shorts',
    nextConfidence: 0.7,
    prevStability: 0.9,
  }),
  'chino_shorts',
);

// Sticky chino refuses soft athletic.
assert.equal(
  stickShortsSubtype({
    prev: 'chino_shorts',
    next: 'athletic_shorts',
    nextConfidence: 0.85,
    prevStability: 0.7,
  }),
  'chino_shorts',
);

// Strong Vision may downgrade when sticky.
assert.equal(
  stickShortsSubtype({
    prev: 'chino_shorts',
    next: 'athletic_shorts',
    nextConfidence: SHORTS_DOWNGRADE_MIN_CONF,
    prevStability: 0.7,
  }),
  'athletic_shorts',
);

// tailored vs athletic ranks
assert.ok(
  garmentSpecificityRank({ name: 'White Chino Shorts', subcategory: 'chino_shorts' })
    > garmentSpecificityRank({ name: 'Athletic Shorts', subcategory: 'athletic_shorts' }) + 2,
);

assert.equal(
  coreGarmentToken({ name: 'White Chino Shorts', subcategory: 'chino_shorts' }),
  'chino_shorts',
);
assert.equal(
  coreGarmentToken({ name: 'Black Athletic Shorts', subcategory: 'athletic_shorts' }),
  'athletic_shorts',
);

{
  const fused = resolveFusedIdentity(
    { name: 'White Chino Shorts', subcategory: 'chino_shorts', confidence: 0.9 },
    { name: 'Athletic Shorts', subcategory: 'athletic_shorts', confidence: 0.85 },
  );
  assert.equal(fused.adopted, 'prev', 'chino holds against soft athletic peer');
  assert.match(fused.reason, /specificity/i);
}

{
  const fused = resolveFusedIdentity(
    { name: 'White Chino Shorts', subcategory: 'chino_shorts', confidence: 0.9 },
    { name: 'Athletic Shorts', subcategory: 'athletic_shorts', confidence: 0.95 },
  );
  assert.equal(fused.adopted, 'next', 'very strong athletic peer may override');
}

console.log('stickyShortsSubtype.test.ts: ok');
