/**
 * Run: npx tsx utils/decisionAccessGate.test.ts
 */
import assert from 'node:assert/strict';
import {
  canSubmitDecisionAtGuard,
  evaluateLocalDecisionAccess,
  FREE_DAILY_DECISION_REASON,
  getDecisionPaywallCopy,
  getDecisionPaywallModalCopy,
  resolveDecisionUpgradeModalVisible,
  sanitizeDecisionAccessStatus,
  shouldShowDecisionUpgradeModal,
} from '../utils/decisionAccessGate';

// A — personal_stylist, local count 0
assert.equal(
  evaluateLocalDecisionAccess('personal_stylist', 0).canMakeDecision,
  true,
  'PS tier allows with zero local decisions',
);

// B — personal_stylist, local count >= 1 (must stay unlimited daily)
assert.equal(
  evaluateLocalDecisionAccess('personal_stylist', 1).canMakeDecision,
  true,
  'PS tier allows even after local daily increment',
);
assert.equal(
  evaluateLocalDecisionAccess('personal_stylist', 9).canMakeDecision,
  true,
  'PS tier ignores high local daily count',
);

// C — stale modal clears when access re-evaluates allowed
assert.equal(
  resolveDecisionUpgradeModalVisible(true, true, 'free'),
  false,
  'modal dismissed when canMakeDecision true',
);
assert.equal(
  resolveDecisionUpgradeModalVisible(true, false, 'free'),
  false,
  'modal stays hidden when access open and paywall suppressed',
);
assert.equal(
  resolveDecisionUpgradeModalVisible(false, true, 'free'),
  true,
  'modal shown when blocked and paywall requested',
);
assert.equal(
  resolveDecisionUpgradeModalVisible(false, true, 'personal_stylist'),
  false,
  'PS never shows daily upgrade modal even if latched blocked',
);

// D — PS paywall never upsells Personal Stylist
const psPaywall = getDecisionPaywallCopy('personal_stylist');
assert.doesNotMatch(
  `${psPaywall.headline} ${psPaywall.body} ${psPaywall.cta}`,
  /Upgrade to Personal Stylist/i,
  'PS decision paywall must not say Upgrade to Personal Stylist',
);
const proPaywall = getDecisionPaywallCopy('stylist_unlimited');
assert.doesNotMatch(
  `${proPaywall.headline} ${proPaywall.body} ${proPaywall.cta}`,
  /Upgrade to Personal Stylist/i,
  'Pro decision paywall must not say Upgrade to Personal Stylist',
);

// E — free, count 0
assert.equal(
  evaluateLocalDecisionAccess('free', 0).canMakeDecision,
  true,
  'free tier first decision allowed',
);

// F — free, count >= 1
const freeBlocked = evaluateLocalDecisionAccess('free', 1);
assert.equal(freeBlocked.canMakeDecision, false, 'free tier second decision blocked');
assert.match(
  freeBlocked.reason || '',
  /your decision for today/i,
  'free tier blocked reason mentions daily limit',
);
const freePaywall = getDecisionPaywallCopy('free', freeBlocked.reason);
assert.match(freePaywall.cta, /Upgrade to Personal Stylist/i, 'free tier CTA upsells PS');

// Stale guard — unlimited tier bypasses latched free accessStatus
assert.equal(
  canSubmitDecisionAtGuard('personal_stylist', { canMakeDecision: false }),
  true,
  'PS guard ignores stale canMakeDecision false',
);
assert.equal(
  canSubmitDecisionAtGuard('stylist_unlimited', { canMakeDecision: false }),
  true,
  'Pro guard ignores stale canMakeDecision false',
);
assert.equal(
  canSubmitDecisionAtGuard('free', { canMakeDecision: false }),
  false,
  'free guard respects blocked accessStatus',
);
assert.equal(
  canSubmitDecisionAtGuard('free', { canMakeDecision: true }),
  true,
  'free guard allows when access open',
);
assert.equal(
  canSubmitDecisionAtGuard('free', null),
  true,
  'free guard allows before accessStatus hydrates',
);
assert.equal(
  canSubmitDecisionAtGuard('free', { canMakeDecision: false }, false),
  true,
  'auth loading must not latch daily gate',
);

// G — sanitize stale free snapshot for unlimited tier
const sanitized = sanitizeDecisionAccessStatus('personal_stylist', {
  canMakeDecision: false,
  reason: FREE_DAILY_DECISION_REASON,
});
assert.equal(sanitized.canMakeDecision, true, 'sanitize clears blocked flag for PS');
assert.equal(sanitized.reason, undefined, 'sanitize clears stale daily reason for PS');

// H — presentation gate suppresses latched modal for PS / auth loading
assert.equal(
  shouldShowDecisionUpgradeModal(true, 'personal_stylist'),
  false,
  'latched modal hidden for PS tier',
);
assert.equal(
  shouldShowDecisionUpgradeModal(true, 'free'),
  true,
  'latched modal visible for free tier',
);
assert.equal(
  shouldShowDecisionUpgradeModal(true, 'free', false),
  false,
  'latched modal hidden while auth hydrates',
);

// I — modal copy ignores stale daily reason on unlimited tier
const psModal = getDecisionPaywallModalCopy('personal_stylist', {
  reason: FREE_DAILY_DECISION_REASON,
});
assert.doesNotMatch(
  `${psModal.body} ${psModal.cta}`,
  /your decision for today|Upgrade to Personal Stylist/i,
  'PS modal ignores stale free daily reason',
);

console.log('decisionAccessGate.test.ts: all passed');
