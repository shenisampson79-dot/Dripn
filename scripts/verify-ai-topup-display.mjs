/**
 * AI Top-Up subscription display — no fabricated "—" prices; hide when unavailable.
 * Run: node scripts/verify-ai-topup-display.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const subscriptionSrc = readFileSync(
  resolve(root, 'screens/SubscriptionScreen.tsx'),
  'utf8',
);
const settingsSrc = readFileSync(resolve(root, 'screens/SettingsScreen.tsx'), 'utf8');

// No em-dash price fallback for AI top-up packs.
assert.doesNotMatch(
  subscriptionSrc,
  /aiTopUpPrices\.(standard|plus)\s*\|\|\s*['']—['']/,
  'SubscriptionScreen must not fabricate em-dash top-up prices',
);

// Pack list must be filtered to priced rows only.
assert.match(subscriptionSrc, /pricedAiTopUpPacks/);
assert.match(
  subscriptionSrc,
  /\.filter\(\(pack\): pack is typeof pack & \{ price: string \} => Boolean\(pack\.price\)\)/,
);

// Section hidden until prices resolve and at least one pack is priced.
assert.match(subscriptionSrc, /aiTopUpPricesResolved\s*\n\s*&& pricedAiTopUpPacks\.length > 0/);

// Settings usage meter still refetches on focus (unchanged entitlement display path).
assert.match(settingsSrc, /useFocusEffect/);
assert.match(settingsSrc, /loadAiUsage/);
assert.match(settingsSrc, /usedCents \/ Math\.max\(aiUsage\.budgetCents, 1\)/);

// Purchase/sync paths untouched — still wired through Apple IAP + server sync.
assert.match(subscriptionSrc, /purchaseAiTopUpPack/);
assert.match(subscriptionSrc, /syncAppleAiTopUpPurchase/);
assert.doesNotMatch(
  subscriptionSrc,
  /PRICE_CATALOG.*topup|topup.*PRICE_CATALOG/i,
  'Must not invent catalog prices for top-up in this RC',
);

console.log('verify-ai-topup-display.mjs: all passed');
