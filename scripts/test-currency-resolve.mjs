/**
 * Currency authority smoke tests (no Expo runtime).
 * Mirrors services/CurrencyService.ts rules:
 *   StoreKit = suggestion (validated) · session = authority · never switch mid-session
 *
 * Run: node scripts/test-currency-resolve.mjs
 */

const DEFAULT_CURRENCY = 'GBP';

const PRICE_CATALOG = {
  GBP: {
    personal_stylist: { monthly: 9.99, yearly: 95.99 },
    stylist_unlimited: { monthly: 19.99, yearly: 191.99 },
    voice: { boost: 2.99, pro: 5.99, weekend: 8.99 },
  },
  USD: {
    personal_stylist: { monthly: 9.99, yearly: 95.99 },
    stylist_unlimited: { monthly: 19.99, yearly: 191.99 },
    voice: { boost: 2.99, pro: 5.99, weekend: 8.99 },
  },
  EUR: {
    personal_stylist: { monthly: 9.99, yearly: 95.99 },
    stylist_unlimited: { monthly: 19.99, yearly: 191.99 },
    voice: { boost: 2.99, pro: 5.99, weekend: 8.99 },
  },
};

const SYMBOLS = { GBP: '£', EUR: '€', USD: '$' };
const EUROZONE = new Set([
  'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'AT', 'IE', 'GR',
  'FI', 'SK', 'SI', 'LT', 'LV', 'EE', 'CY', 'MT', 'LU', 'HR',
]);

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

function currencyFromRegion(regionCode) {
  if (!regionCode) return null;
  const region = String(regionCode).toUpperCase();
  if (region === 'GB' || region === 'UK') return 'GBP';
  if (region === 'US') return 'USD';
  if (EUROZONE.has(region)) return 'EUR';
  return null;
}

function resolveCurrencyFromSignals(signals) {
  const fromDevice = currencyFromRegion(signals.deviceRegion);
  if (fromDevice) return fromDevice;
  const store = signals.appStoreCurrency ? String(signals.appStoreCurrency).toUpperCase() : null;
  if (store === 'GBP' || store === 'EUR' || store === 'USD') return store;
  const fromIp = currencyFromRegion(signals.ipCountry);
  if (fromIp) return fromIp;
  return DEFAULT_CURRENCY;
}

function safeStorekitPrice(product, userCurrency) {
  if (!product) return null;
  const codeRaw = product.currencyCode ? String(product.currencyCode).toUpperCase() : null;
  const code =
    (codeRaw === 'GBP' || codeRaw === 'EUR' || codeRaw === 'USD' ? codeRaw : null) ??
    inferCurrencyFromPriceString(product.priceString);
  if (!code || code !== userCurrency) return null;
  const priceString = product.priceString?.trim?.() || product.priceString;
  if (!priceString) return null;
  const amount =
    (typeof product.price === 'number' && Number.isFinite(product.price)
      ? product.price
      : null) ?? parsePriceString(priceString);
  if (amount == null) return null;
  return { priceString, amount, currencyCode: code };
}

function formatPrice(amount, currency) {
  return `${SYMBOLS[currency]}${amount.toFixed(2)}`;
}

function getDisplayPrice(product, userCurrency, catalogFallback) {
  const safe = safeStorekitPrice(product, userCurrency);
  return safe?.priceString ?? catalogFallback;
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
    (fromCode ? SYMBOLS[fromCode] : SYMBOLS.GBP);
  return `${symbol}${savings.toFixed(2)}`;
}

function detectSharedPriceCurrency(prices) {
  let shared = null;
  for (const price of prices) {
    if (!price || price === 'Free') continue;
    const inferred = inferCurrencyFromPriceString(price);
    if (!inferred) continue;
    if (shared == null) {
      shared = inferred;
      continue;
    }
    if (shared !== inferred) return null;
  }
  return shared;
}

/** Minimal session lock harness */
function createSession() {
  let locked = false;
  let displayCurrency = DEFAULT_CURRENCY;
  let paymentCurrency = null;

  return {
    lock(signals) {
      if (locked) return displayCurrency;
      displayCurrency = resolveCurrencyFromSignals(signals);
      locked = true;
      return displayCurrency;
    },
    notePayment(code) {
      const upper = code ? String(code).toUpperCase() : null;
      if (upper === 'GBP' || upper === 'EUR' || upper === 'USD') {
        paymentCurrency = upper;
      }
      // Must NOT override locked display currency
    },
    get displayCurrency() {
      return displayCurrency;
    },
    get paymentCurrency() {
      return paymentCurrency;
    },
    get locked() {
      return locked;
    },
    catalogSnapshot() {
      const c = PRICE_CATALOG[displayCurrency];
      return {
        monthly: {
          personal_stylist: formatPrice(c.personal_stylist.monthly, displayCurrency),
          stylist_unlimited: formatPrice(c.stylist_unlimited.monthly, displayCurrency),
        },
        yearly: {
          personal_stylist: formatPrice(c.personal_stylist.yearly, displayCurrency),
          stylist_unlimited: formatPrice(c.stylist_unlimited.yearly, displayCurrency),
        },
        voice: {
          boost: formatPrice(c.voice.boost, displayCurrency),
          pro: formatPrice(c.voice.pro, displayCurrency),
          weekend: formatPrice(c.voice.weekend, displayCurrency),
        },
      };
    },
    resetPricesToCatalog() {
      return this.catalogSnapshot();
    },
  };
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

// --- Signal resolution ---
assert(
  'GB device → GBP even if StoreKit USD',
  resolveCurrencyFromSignals({ deviceRegion: 'GB', appStoreCurrency: 'USD' }) === 'GBP',
);
assert(
  'US device → USD',
  resolveCurrencyFromSignals({ deviceRegion: 'US' }) === 'USD',
);
assert(
  'DE device → EUR',
  resolveCurrencyFromSignals({ deviceRegion: 'DE' }) === 'EUR',
);
assert(
  'unknown device + StoreKit EUR → EUR',
  resolveCurrencyFromSignals({ deviceRegion: 'JP', appStoreCurrency: 'EUR' }) === 'EUR',
);
assert(
  'unknown + no store → DEFAULT GBP',
  resolveCurrencyFromSignals({ deviceRegion: 'JP' }) === 'GBP',
);
assert(
  'ipCountry used when device unknown',
  resolveCurrencyFromSignals({ deviceRegion: '', ipCountry: 'GB' }) === 'GBP',
);

// --- Strict StoreKit filter ---
assert(
  'GB device + StoreKit USD → GBP catalog (reject)',
  getDisplayPrice(
    { priceString: '$9.99', currencyCode: 'USD' },
    'GBP',
    '£9.99',
  ) === '£9.99',
);
assert(
  'UK rejects USD voice price',
  getDisplayPrice({ priceString: '$9.99', currencyCode: 'USD' }, 'GBP', '£8.99') === '£8.99',
);
assert(
  'UK rejects USD yearly',
  getDisplayPrice({ priceString: '$99.99', currencyCode: 'USD' }, 'GBP', '£95.99') === '£95.99',
);
assert(
  'UK accepts GBP storefront',
  getDisplayPrice({ priceString: '£95.99', currencyCode: 'GBP' }, 'GBP', '£95.99') === '£95.99',
);
assert(
  'UK infers reject from $ string without code',
  getDisplayPrice({ priceString: '$199.99', currencyCode: null }, 'GBP', '£191.99') === '£191.99',
);
assert(
  'US accepts USD',
  getDisplayPrice({ priceString: '$99.99', currencyCode: 'USD' }, 'USD', '$95.99') === '$99.99',
);
assert(
  'safeStorekitPrice returns null on mismatch',
  safeStorekitPrice({ priceString: '$9.99', currencyCode: 'USD' }, 'GBP') === null,
);

// --- Session lock ---
{
  const session = createSession();
  session.lock({ deviceRegion: 'GB', appStoreCurrency: 'USD' });
  assert('session locks to GBP for GB device', session.displayCurrency === 'GBP');
  session.notePayment('USD');
  assert('paymentCurrency can differ', session.paymentCurrency === 'USD');
  assert('display stays GBP after StoreKit note', session.displayCurrency === 'GBP');
  const before = session.displayCurrency;
  session.lock({ deviceRegion: 'US', appStoreCurrency: 'USD' });
  assert('session lock: no mid-session switch', session.displayCurrency === before && before === 'GBP');
}

// --- Cancel does not leave USD ---
{
  const session = createSession();
  session.lock({ deviceRegion: 'GB' });
  let ui = {
    personal: getDisplayPrice({ priceString: '$9.99', currencyCode: 'USD' }, session.displayCurrency, '£9.99'),
    yearly: getDisplayPrice({ priceString: '$99.99', currencyCode: 'USD' }, session.displayCurrency, '£95.99'),
  };
  // Simulate a buggy path that somehow held $ then cancel resets
  ui = { personal: '$9.99', yearly: '$99.99' };
  const reset = session.resetPricesToCatalog();
  ui = {
    personal: reset.monthly.personal_stylist,
    yearly: reset.yearly.personal_stylist,
  };
  assert('cancel does not leave USD', !ui.personal.includes('$') && ui.personal.startsWith('£'));
  assert('cancel restores GBP yearly', ui.yearly === '£95.99');
}

// --- Savings currency-safe ---
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
assert(
  'mixed prices detected',
  detectSharedPriceCurrency(['£9.99', '$95.99']) === null,
);
assert(
  'consistent £ prices ok',
  detectSharedPriceCurrency(['£9.99', '£95.99']) === 'GBP',
);

// --- Catalog amounts match live StyleWise ---
assert('catalog personal monthly GBP', PRICE_CATALOG.GBP.personal_stylist.monthly === 9.99);
assert('catalog personal yearly GBP', PRICE_CATALOG.GBP.personal_stylist.yearly === 95.99);
assert('catalog unlimited monthly GBP', PRICE_CATALOG.GBP.stylist_unlimited.monthly === 19.99);
assert('catalog voice weekend GBP', PRICE_CATALOG.GBP.voice.weekend === 8.99);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
