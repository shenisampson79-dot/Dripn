/**
 * Smoke checks for store-price currency gating (no Expo runtime).
 * Run: node scripts/test-currency-resolve.mjs
 */

function parsePriceString(price) {
  if (!price) return null;
  const match = String(price).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function inferCurrencyFromPriceString(priceString) {
  if (!priceString) return null;
  if (priceString.includes('£')) return 'GBP';
  if (priceString.includes('€')) return 'EUR';
  if (/^\$|\s\$|USD/i.test(priceString) || priceString.trim().startsWith('$')) return 'USD';
  if (priceString.includes('$')) return 'USD';
  return null;
}

function shouldAcceptStoreCurrency(userCurrency, storeCurrencyCode, priceString) {
  const code = storeCurrencyCode ? String(storeCurrencyCode).toUpperCase() : null;
  const inferred =
    (code === 'GBP' || code === 'EUR' || code === 'USD' ? code : null) ??
    inferCurrencyFromPriceString(priceString);
  if (!inferred) return false;
  return inferred === userCurrency;
}

function resolveStorePrice(userCurrency, storePriceString, storeCurrencyCode, fallback) {
  if (storePriceString && shouldAcceptStoreCurrency(userCurrency, storeCurrencyCode, storePriceString)) {
    return storePriceString;
  }
  return fallback;
}

function formatYearlySavings(monthlyPrice, yearlyPrice) {
  const monthly = parsePriceString(monthlyPrice);
  const yearly = parsePriceString(yearlyPrice);
  if (monthly == null || yearly == null) return '';
  const savings = monthly * 12 - yearly;
  if (!(savings > 0.009)) return '';
  const leading = yearlyPrice.match(/^[^\d\s.,]+/);
  const fromCode = inferCurrencyFromPriceString(yearlyPrice);
  const symbol =
    leading?.[0] ||
    (fromCode === 'GBP' ? '£' : fromCode === 'EUR' ? '€' : fromCode === 'USD' ? '$' : '£');
  return `${symbol}${savings.toFixed(2)}`;
}

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

assert(
  'UK rejects USD voice price',
  resolveStorePrice('GBP', '$9.99', 'USD', '£8.99') === '£8.99',
);
assert(
  'UK rejects USD yearly',
  resolveStorePrice('GBP', '$99.99', 'USD', '£95.99') === '£95.99',
);
assert(
  'UK accepts GBP storefront',
  resolveStorePrice('GBP', '£95.99', 'GBP', '£95.99') === '£95.99',
);
assert(
  'UK infers reject from $ string without code',
  resolveStorePrice('GBP', '$199.99', null, '£191.99') === '£191.99',
);
assert(
  'US accepts USD',
  resolveStorePrice('USD', '$99.99', 'USD', '$95.99') === '$99.99',
);
assert(
  'savings match £ prices',
  formatYearlySavings('£9.99', '£95.99') === '£23.89',
);
assert(
  'savings match $ prices (no mixed £)',
  formatYearlySavings('$9.99', '$99.99') === '$19.89',
);
assert(
  'unlimited GBP savings',
  formatYearlySavings('£19.99', '£191.99') === '£47.89',
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
