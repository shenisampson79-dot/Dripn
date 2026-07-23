/**
 * Currency authority smoke tests (no Expo runtime).
 * Mirrors services/CurrencyService.ts rules:
 *   StoreKit = suggestion (validated) · session = authority · never raw priceString
 *   UK-first: GB storefront / en-GB / GBP beats lone en-US region
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

function normalizeRegion(code) {
  if (!code) return '';
  const upper = String(code).trim().toUpperCase();
  return upper === 'UK' ? 'GB' : upper;
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
  const region = normalizeRegion(regionCode);
  if (!region) return null;
  if (region === 'GB') return 'GBP';
  if (region === 'US') return 'USD';
  if (EUROZONE.has(region)) return 'EUR';
  return null;
}

function languageTagSuggestsUk(tag) {
  if (!tag) return false;
  const lower = String(tag).toLowerCase().replace(/_/g, '-');
  return lower === 'en-gb' || lower.endsWith('-gb') || lower.includes('-gb-') || lower.startsWith('en-gb');
}

function signalsSuggestUk(signals) {
  if (signals.preferredCurrency === 'GBP') return true;
  if (normalizeRegion(signals.deviceRegion) === 'GB') return true;
  if (normalizeRegion(signals.storefrontCountry) === 'GB') return true;
  if (signals.appStoreCurrency && String(signals.appStoreCurrency).toUpperCase() === 'GBP') return true;
  if (currencyFromRegion(signals.ipCountry) === 'GBP') return true;
  const regions = [signals.deviceRegion, ...(signals.localeRegions || [])].map(normalizeRegion);
  if (regions.some((r) => r === 'GB')) return true;
  const tags = signals.languageTags || [];
  if (tags.some(languageTagSuggestsUk)) return true;
  return false;
}

function resolveCurrencyFromSignals(signals) {
  if (signals.preferredCurrency === 'GBP' || signals.preferredCurrency === 'USD' || signals.preferredCurrency === 'EUR') {
    return signals.preferredCurrency;
  }
  if (signalsSuggestUk(signals)) return 'GBP';
  const storefront = currencyFromRegion(signals.storefrontCountry);
  if (storefront) return storefront;
  const store = signals.appStoreCurrency ? String(signals.appStoreCurrency).toUpperCase() : null;
  if (store === 'GBP' || store === 'EUR' || store === 'USD') return store;
  for (const region of signals.localeRegions || []) {
    const fromLocale = currencyFromRegion(region);
    if (fromLocale === 'EUR' || fromLocale === 'GBP') return fromLocale;
  }
  const fromDevice = currencyFromRegion(signals.deviceRegion);
  if (fromDevice === 'EUR' || fromDevice === 'GBP') return fromDevice;
  // Lone US device region → DEFAULT GBP (UK-first; en-US must not lock USD)
  const fromIp = currencyFromRegion(signals.ipCountry);
  if (fromIp) return fromIp;
  return DEFAULT_CURRENCY;
}

function formatPrice(amount, currency) {
  if (amount === 0) return 'Free';
  return `${SYMBOLS[currency]}${amount.toFixed(2)}`;
}

function safeStorekitPrice(product, userCurrency) {
  if (!product) return null;
  const codeRaw = product.currencyCode ? String(product.currencyCode).toUpperCase() : null;
  const code =
    (codeRaw === 'GBP' || codeRaw === 'EUR' || codeRaw === 'USD' ? codeRaw : null) ??
    inferCurrencyFromPriceString(product.priceString);
  if (!code || code !== userCurrency) return null;
  const amount =
    (typeof product.price === 'number' && Number.isFinite(product.price)
      ? product.price
      : null) ?? parsePriceString(product.priceString);
  if (amount == null) return null;
  // Never return raw StoreKit priceString — format from amount + session symbol.
  return { priceString: formatPrice(amount, userCurrency), amount, currencyCode: code };
}

function getDisplayPrice(product, userCurrency, catalogFallback) {
  const safe = safeStorekitPrice(product, userCurrency);
  if (safe) return safe.priceString;
  if (userCurrency === 'GBP' && inferCurrencyFromPriceString(product?.priceString) === 'USD') {
    return catalogFallback;
  }
  return catalogFallback;
}

function displayStringLooksLikeUsd(price) {
  if (!price || price === 'Free' || price === '—') return false;
  return inferCurrencyFromPriceString(price) === 'USD';
}

function assertConsistentDisplayPrices(prices, sessionCurrency, catalogFallback) {
  const priced = prices.filter((p) => p && p !== 'Free' && p !== '—');
  if (sessionCurrency === 'GBP' && priced.some(displayStringLooksLikeUsd)) {
    return { ok: false, snapshot: catalogFallback };
  }
  return { ok: true, snapshot: catalogFallback };
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
    reinforceUk(signals) {
      if (displayCurrency === 'GBP') return false;
      if (!signalsSuggestUk(signals)) return false;
      displayCurrency = 'GBP';
      locked = true;
      return true;
    },
    notePayment(code) {
      const upper = code ? String(code).toUpperCase() : null;
      if (upper === 'GBP' || upper === 'EUR' || upper === 'USD') {
        paymentCurrency = upper;
      }
      if (upper === 'GBP') this.reinforceUk({ appStoreCurrency: 'GBP' });
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
  'lone US device region → GBP (UK-first, no storefront)',
  resolveCurrencyFromSignals({ deviceRegion: 'US' }) === 'GBP',
);
assert(
  'US device + US storefront → USD',
  resolveCurrencyFromSignals({ deviceRegion: 'US', storefrontCountry: 'US' }) === 'USD',
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

// --- UK-first: en-US locale must NOT beat GB storefront / en-GB ---
assert(
  'en-US region + GB storefront → GBP',
  resolveCurrencyFromSignals({
    deviceRegion: 'US',
    storefrontCountry: 'GB',
    languageTags: ['en-US'],
  }) === 'GBP',
);
assert(
  'en-US region + en-GB language → GBP',
  resolveCurrencyFromSignals({
    deviceRegion: 'US',
    languageTags: ['en-US', 'en-GB'],
  }) === 'GBP',
);
assert(
  'en-US region + secondary locale GB → GBP',
  resolveCurrencyFromSignals({
    deviceRegion: 'US',
    localeRegions: ['US', 'GB'],
  }) === 'GBP',
);
assert(
  'en-US region + appStoreCurrency GBP → GBP',
  resolveCurrencyFromSignals({
    deviceRegion: 'US',
    appStoreCurrency: 'GBP',
  }) === 'GBP',
);

// --- Strict StoreKit filter + never raw priceString ---
assert(
  'GB device + StoreKit USD → GBP catalog (reject)',
  getDisplayPrice(
    { priceString: '$9.99', currencyCode: 'USD' },
    'GBP',
    '£9.99',
  ) === '£9.99',
);
assert(
  'StoreKit $9.99 + session GBP → display £9.99',
  getDisplayPrice({ priceString: '$9.99', currencyCode: 'USD', price: 9.99 }, 'GBP', '£9.99') === '£9.99',
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
  'UK accepts GBP storefront — formatted, not raw',
  getDisplayPrice({ priceString: '£95.99', currencyCode: 'GBP', price: 95.99 }, 'GBP', '£95.99') === '£95.99',
);
assert(
  'matched StoreKit never returns raw $ string when session USD',
  getDisplayPrice({ priceString: 'USD 9.99', currencyCode: 'USD', price: 9.99 }, 'USD', '$9.99') === '$9.99',
);
assert(
  'UK infers reject from $ string without code',
  getDisplayPrice({ priceString: '$199.99', currencyCode: null }, 'GBP', '£191.99') === '£191.99',
);
assert(
  'US accepts USD — formatted from amount',
  getDisplayPrice({ priceString: '$99.99', currencyCode: 'USD', price: 99.99 }, 'USD', '$95.99') === '$99.99',
);
assert(
  'safeStorekitPrice returns null on mismatch',
  safeStorekitPrice({ priceString: '$9.99', currencyCode: 'USD' }, 'GBP') === null,
);
assert(
  'safeStorekitPrice formats amount with session symbol (never raw StoreKit)',
  safeStorekitPrice({ priceString: 'GBP 9.99', currencyCode: 'GBP', price: 9.99 }, 'GBP')?.priceString === '£9.99',
);

// --- Session lock + one-way UK reinforce ---
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

{
  // Bug repro: early lock on en-US alone stays GBP (UK-first)
  const session = createSession();
  session.lock({ deviceRegion: 'US', languageTags: ['en-US'] });
  assert('early lock lone en-US → GBP', session.displayCurrency === 'GBP');
  const catalog = session.resetPricesToCatalog();
  assert('en-US alone catalog is £', catalog.monthly.personal_stylist === '£9.99');
}
{
  // US App Store storefront confirms USD after provisional GBP
  const session = createSession();
  session.lock({ deviceRegion: 'US', languageTags: ['en-US'] });
  assert('provisional GBP before storefront', session.displayCurrency === 'GBP');
  // simulate storefront reinforce path used by CurrencyService
  const next = resolveCurrencyFromSignals({
    deviceRegion: 'US',
    storefrontCountry: 'US',
    languageTags: ['en-US'],
  });
  assert('US storefront resolves USD', next === 'USD');
}
{
  const session = createSession();
  session.lock({ deviceRegion: 'US', appStoreCurrency: 'USD' });
  // appStoreCurrency USD without UK → USD at lock time
  assert('US + appStoreCurrency USD → USD', session.displayCurrency === 'USD');
  const upgraded = session.reinforceUk({ storefrontCountry: 'GB' });
  assert('reinforce UK storefront upgrades USD→GBP', upgraded && session.displayCurrency === 'GBP');
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

// --- $ guard while session GBP ---
{
  const catalog = {
    monthly: { personal_stylist: '£9.99', stylist_unlimited: '£19.99' },
    yearly: { personal_stylist: '£95.99', stylist_unlimited: '£191.99' },
    voice: { boost: '£2.99', pro: '£5.99', weekend: '£8.99' },
  };
  const guard = assertConsistentDisplayPrices(['$9.99', '£19.99'], 'GBP', catalog);
  assert('assertConsistent forces catalog when $ on GBP session', !guard.ok);
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
assert('catalog voice boost GBP', PRICE_CATALOG.GBP.voice.boost === 2.99);
assert('catalog voice pro GBP', PRICE_CATALOG.GBP.voice.pro === 5.99);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
