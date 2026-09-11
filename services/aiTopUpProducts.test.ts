/**
 * Run: npx tsx services/aiTopUpProducts.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPLE_AI_TOPUP_PRODUCT_IDS,
  acceptAiTopUpStorefrontPrice,
  creditsForAiTopUpProductId,
  displayNameForAiTopUpProductId,
  isAiTopUpProductId,
  mapAiTopUpPricesFromStoreProducts,
  resolveAiTopUpFromProductId,
} from './aiTopUpProducts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appleIap = fs.readFileSync(path.join(ROOT, 'services', 'AppleIAPService.ts'), 'utf8');
const getAiTopUpPrices = appleIap.slice(
  appleIap.indexOf('async getAiTopUpPrices'),
  appleIap.indexOf('private async purchaseProductById'),
);
assert.match(getAiTopUpPrices, /mapAiTopUpPricesFromStoreProducts\(storeProducts\)/);
assert.doesNotMatch(getAiTopUpPrices, /safeStorekitPrice/);

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

{
  const accepted = acceptAiTopUpStorefrontPrice(
    {
      identifier: APPLE_AI_TOPUP_PRODUCT_IDS.standard,
      priceString: '$4.99',
      currencyCode: 'USD',
      price: 4.99,
    },
    'GBP',
  );
  assert.ok(accepted, 'non-empty StoreKit Top-Up price survives session/storefront currency mismatch');
  assert.equal(accepted.priceString, '$4.99');
  assert.equal(accepted.currencyCode, 'USD');
  const mapped = mapAiTopUpPricesFromStoreProducts(
    [{
      identifier: APPLE_AI_TOPUP_PRODUCT_IDS.standard,
      priceString: '$4.99',
      currencyCode: 'USD',
      price: 4.99,
    }],
    'GBP',
  );
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].productId, 'com.dripn.ai.topup');
  assert.equal(mapped[0].priceString, '$4.99');
}

{
  assert.equal(
    acceptAiTopUpStorefrontPrice({
      identifier: APPLE_AI_TOPUP_PRODUCT_IDS.standard,
      priceString: '',
      currencyCode: 'USD',
    }, 'GBP'),
    null,
  );
  assert.deepEqual(
    mapAiTopUpPricesFromStoreProducts(
      [{ identifier: APPLE_AI_TOPUP_PRODUCT_IDS.standard, priceString: '   ', currencyCode: 'GBP' }],
      'GBP',
    ),
    [],
  );
  assert.deepEqual(mapAiTopUpPricesFromStoreProducts([], 'GBP'), []);
}

console.log('aiTopUpProducts.test.ts: all passed');
