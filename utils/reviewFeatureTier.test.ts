import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyServerReviewFeatureEntitlement,
  authoritativeBillingTierFromHydrate,
  effectiveFeatureTierFromTesterOverride,
  featureAccessTier,
  omitClientControlledFeatureEntitlement,
} from './subscriptionTier';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

{
  assert.equal(
    effectiveFeatureTierFromTesterOverride({
      isTester: false,
      tierOverride: null,
      billingTier: 'free',
    }),
    'free',
    'normal Free user → Free features',
  );
}

{
  assert.equal(
    effectiveFeatureTierFromTesterOverride({
      isTester: false,
      tierOverride: null,
      billingTier: 'personal_stylist',
    }),
    'personal_stylist',
    'genuine Personal Stylist subscriber unchanged',
  );
}

{
  assert.equal(
    effectiveFeatureTierFromTesterOverride({
      isTester: true,
      tierOverride: 'personal_stylist',
      billingTier: 'free',
    }),
    'personal_stylist',
    'tester + personal_stylist override → Personal Stylist feature access',
  );
}

{
  const login = applyServerReviewFeatureEntitlement(
    { subscriptionTier: 'free', isTester: false, featureTier: 'free' },
    { subscriptionTier: 'free', isTester: true, featureTier: 'personal_stylist' },
  );
  assert.equal(login.subscriptionTier, 'free', 'login billing stays Free');
  assert.equal(login.isTester, true);
  assert.equal(login.featureTier, 'personal_stylist', 'tester override survives login');

  const me = applyServerReviewFeatureEntitlement(login, {
    subscriptionTier: 'free',
    isTester: true,
    featureTier: 'personal_stylist',
  });
  assert.equal(me.featureTier, 'personal_stylist', 'survives /api/auth/me');
  assert.equal(me.subscriptionTier, 'free');

  const relaunch = applyServerReviewFeatureEntitlement(me, {
    subscriptionTier: 'free',
    isTester: true,
    featureTier: 'personal_stylist',
  });
  assert.equal(relaunch.featureTier, 'personal_stylist', 'survives foreground/relaunch hydrate');
}

{
  const afterRevoke = applyServerReviewFeatureEntitlement(
    { subscriptionTier: 'free', isTester: true, featureTier: 'personal_stylist' },
    { subscriptionTier: 'free', isTester: false, featureTier: 'free', tierOverride: null },
  );
  assert.equal(afterRevoke.isTester, false);
  assert.equal(afterRevoke.featureTier, 'free', 'removing tester/override returns Free features');
  assert.equal(afterRevoke.subscriptionTier, 'free');
}

{
  assert.equal(
    effectiveFeatureTierFromTesterOverride({
      isTester: false,
      tierOverride: 'personal_stylist',
      billingTier: 'free',
    }),
    'free',
    'non-tester override cannot grant paid access',
  );
  assert.equal(
    featureAccessTier({
      subscriptionTier: 'free',
      isTester: false,
      featureTier: 'personal_stylist',
      tierOverride: 'personal_stylist',
    }),
    'free',
    'local featureTier without isTester cannot grant paid access',
  );
}

{
  assert.equal(
    authoritativeBillingTierFromHydrate({
      serverBillingTier: 'free',
      profileJsonTier: 'personal_stylist',
      localTier: 'personal_stylist',
    }),
    'free',
    'billing hydrate ignores profile JSON and local paid sticky',
  );
  const stripped = omitClientControlledFeatureEntitlement({
    country: 'GB',
    subscriptionTier: 'stylist_unlimited',
    featureTier: 'stylist_unlimited',
    isTester: true,
    tierOverride: 'pro',
    billingPlatform: 'apple',
  });
  assert.equal(stripped.country, 'GB');
  assert.equal(Object.prototype.hasOwnProperty.call(stripped, 'subscriptionTier'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stripped, 'featureTier'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stripped, 'isTester'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stripped, 'tierOverride'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stripped, 'billingPlatform'), false);
}

{
  const subscriptionSrc = fs.readFileSync(path.join(ROOT, 'screens/SubscriptionScreen.tsx'), 'utf8');
  assert.match(
    subscriptionSrc,
    /normalizeTier\(user\?\.subscriptionTier\)/,
    'Subscription screen continues to display billing subscriptionTier',
  );
  assert.equal(
    /featureAccessTier|user\?\.featureTier/.test(subscriptionSrc),
    false,
    'Subscription screen must not fabricate paid ownership from featureTier',
  );
}

console.log('reviewFeatureTier: all passed');
