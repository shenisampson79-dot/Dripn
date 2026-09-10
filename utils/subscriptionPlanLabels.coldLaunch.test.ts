/**
 * Cold launch must not render Free for a paid user before /api/auth/me.
 * Run: npx tsx utils/subscriptionPlanLabels.coldLaunch.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coldLaunchSubscriptionLabelSequence,
  resolveSubscriptionDisplayLabel,
} from '@/utils/subscriptionPlanLabels';
import { reconcileSubscriptionTier } from '@/utils/subscriptionTier';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const authSrc = fs.readFileSync(path.join(ROOT, 'contexts/AuthContext.tsx'), 'utf8');

{
  const frames = coldLaunchSubscriptionLabelSequence({
    localTier: undefined,
    meTier: 'stylist_unlimited',
  });
  assert.notEqual(
    frames[0],
    'Free',
    'process start (no user yet) must not render Free before /me',
  );
  assert.notEqual(
    frames[1],
    'Free',
    'authenticated paid cold start must not render Free while /me is in flight',
  );
  assert.equal(frames[2], 'Stylist Pro', 'authoritative /me Pro renders Stylist Pro');
}

assert.equal(
  resolveSubscriptionDisplayLabel({
    subscriptionTier: 'free',
    billingResolved: true,
  }),
  'Free',
  'genuine resolved Free still renders Free',
);

assert.equal(
  reconcileSubscriptionTier({
    local: 'stylist_unlimited',
    remote: 'free',
  }),
  'free',
  'authoritative /me Free still downgrades local Pro',
);

const loadUserStart = authSrc.indexOf('const loadUser = async () => {');
const loadUserEnd = authSrc.indexOf('const saveUserLocalOnly');
const loadUserSrc = authSrc.slice(loadUserStart, loadUserEnd);
assert.match(loadUserSrc, /apiService\.getMe\(\)/, 'cold start still hydrates via /me');
const getMeIdx = loadUserSrc.indexOf('apiService.getMe()');
const publishLocalIdx = loadUserSrc.indexOf('setUser(localUser)');
assert.ok(
  publishLocalIdx === -1 || publishLocalIdx > getMeIdx,
  'must not publish coerced-local user (often Free) before /me resolves',
);

console.log('subscriptionPlanLabels.coldLaunch.test.ts: all passed');
