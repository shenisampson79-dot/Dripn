/**
 * Run: npx tsx services/aiTopUpProducts.test.ts
 */
import assert from 'node:assert/strict';
import {
  APPLE_AI_TOPUP_PRODUCT_IDS,
  creditsForAiTopUpProductId,
  displayNameForAiTopUpProductId,
  isAiTopUpProductId,
  resolveAiTopUpFromProductId,
} from './aiTopUpProducts';

assert.equal(APPLE_AI_TOPUP_PRODUCT_IDS.standard, 'com.dripn.ai.topup');
assert.equal(APPLE_AI_TOPUP_PRODUCT_IDS.plus, 'com.dripn.ai.topup.600');

assert.equal(creditsForAiTopUpProductId('com.dripn.ai.topup'), 300);
assert.equal(displayNameForAiTopUpProductId('com.dripn.ai.topup'), 'AI Top-Up');

assert.equal(creditsForAiTopUpProductId('com.dripn.ai.topup.600'), 600);
assert.equal(displayNameForAiTopUpProductId('com.dripn.ai.topup.600'), 'AI Top-Up Plus');

const standard = resolveAiTopUpFromProductId('com.dripn.ai.topup');
assert.equal(standard?.packId, 'standard');
assert.equal(standard?.credits, 300);
assert.equal(standard?.displayName, 'AI Top-Up');

const plus = resolveAiTopUpFromProductId('com.dripn.ai.topup.600');
assert.equal(plus?.packId, 'plus');
assert.equal(plus?.credits, 600);
assert.equal(plus?.displayName, 'AI Top-Up Plus');

assert.equal(isAiTopUpProductId('com.dripn.ai.topup'), true);
assert.equal(isAiTopUpProductId('com.dripn.ai.topup.600'), true);
assert.equal(isAiTopUpProductId('com.dripn.ai.topup.300'), false);
assert.equal(creditsForAiTopUpProductId('com.dripn.ai.topup.300'), null);
assert.equal(displayNameForAiTopUpProductId('com.dripn.ai.topup.300'), null);
assert.equal(resolveAiTopUpFromProductId('com.dripn.ai.topup.300'), null);
assert.equal(isAiTopUpProductId('com.dripn.ai.topup.small'), false);
assert.equal(isAiTopUpProductId('com.dripn.ai.topup.large'), false);
assert.equal(isAiTopUpProductId('com.dripn.voice.boost.30'), false);
assert.equal(creditsForAiTopUpProductId('com.dripn.voice.boost.30'), null);
assert.equal(displayNameForAiTopUpProductId('com.dripn.personal_stylist.monthly'), null);

console.log('aiTopUpProducts.test.ts: all passed');
