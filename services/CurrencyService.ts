import * as Localization from 'expo-localization';
import { apiService } from '@/services/ApiService';

/** Canonical currencies StyleWise displays / catalogs. */
export type Currency = 'GBP' | 'USD' | 'EUR';
/** @deprecated Prefer `Currency` — kept for existing imports. */
export type SimpleCurrency = Currency;

export const DEFAULT_CURRENCY: Currency = 'GBP';

export interface CurrencyInfo {
  code: Currency;
  symbol: string;
  name: string;
}

export type CurrencySignal = {
  deviceRegion: string;
  appStoreCurrency?: string;
  ipCountry?: string;
};

const CURRENCIES: Record<Currency, CurrencyInfo> = {
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
};

const EUROZONE_COUNTRIES = [
  'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'AT', 'IE', 'GR',
  'FI', 'SK', 'SI', 'LT', 'LV', 'EE', 'CY', 'MT', 'LU', 'HR',
];

type SubscriptionPriceKey = 'personal_stylist' | 'stylist_unlimited';

interface SubscriptionPrices {
  personal_stylist: { monthly: number; yearly: number };
  stylist_unlimited: { monthly: number; yearly: number };
}

interface DfyPrices {
  outfit_setup: number;
  wardrobe_setup: number;
}

interface VoicePackPrices {
  boost: number;
  pro: number;
  weekend: number;
}

/**
 * Static catalog — live StyleWise amounts (Personal / Unlimited / DFY / voice).
 * Same numeric points across currencies; StoreKit may overlay when currency matches.
 */
export const PRICE_CATALOG: Record<
  Currency,
  {
    personal_stylist: { monthly: number; yearly: number };
    stylist_unlimited: { monthly: number; yearly: number };
    dfy: DfyPrices;
    voice: VoicePackPrices;
  }
> = {
  GBP: {
    personal_stylist: { monthly: 9.99, yearly: 95.99 },
    stylist_unlimited: { monthly: 19.99, yearly: 191.99 },
    dfy: { outfit_setup: 19.99, wardrobe_setup: 39.99 },
    voice: { boost: 2.99, pro: 5.99, weekend: 8.99 },
  },
  USD: {
    personal_stylist: { monthly: 9.99, yearly: 95.99 },
    stylist_unlimited: { monthly: 19.99, yearly: 191.99 },
    dfy: { outfit_setup: 19.99, wardrobe_setup: 39.99 },
    voice: { boost: 2.99, pro: 5.99, weekend: 8.99 },
  },
  EUR: {
    personal_stylist: { monthly: 9.99, yearly: 95.99 },
    stylist_unlimited: { monthly: 19.99, yearly: 191.99 },
    dfy: { outfit_setup: 19.99, wardrobe_setup: 39.99 },
    voice: { boost: 2.99, pro: 5.99, weekend: 8.99 },
  },
};

const DEFAULT_SUBSCRIPTION_PRICES: SubscriptionPrices = {
  personal_stylist: { ...PRICE_CATALOG.GBP.personal_stylist },
  stylist_unlimited: { ...PRICE_CATALOG.GBP.stylist_unlimited },
};

const DEFAULT_DFY_PRICES: DfyPrices = { ...PRICE_CATALOG.GBP.dfy };

export type CatalogPriceSnapshot = {
  monthly: { free: string; personal_stylist: string; stylist_unlimited: string };
  yearly: { free: string; personal_stylist: string; stylist_unlimited: string };
  dfy: { outfit_setup: string; wardrobe_setup: string };
  voice: { boost: string; pro: string; weekend: string };
};

export type StoreKitPriceLike = {
  priceString?: string | null;
  currencyCode?: string | null;
  price?: number | null;
} | null | undefined;

export function parsePriceString(price: string | undefined | null): number | null {
  if (!price) return null;
  const match = price.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function centsToAmount(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 100 ? value / 100 : value;
}

function isCurrency(code: string | null | undefined): code is Currency {
  return code === 'GBP' || code === 'EUR' || code === 'USD';
}

/** Infer currency from a StoreKit / formatted price string when currencyCode is missing. */
export function inferCurrencyFromPriceString(priceString: string | null | undefined): Currency | null {
  if (!priceString) return null;
  if (priceString.includes('£')) return 'GBP';
  if (priceString.includes('€')) return 'EUR';
  if (/^\$|\s\$|USD/i.test(priceString) || priceString.trim().startsWith('$')) return 'USD';
  if (priceString.includes('$')) return 'USD';
  return null;
}

function currencyFromRegion(regionCode: string | null | undefined): Currency | null {
  if (!regionCode) return null;
  const region = regionCode.toUpperCase();
  if (region === 'GB' || region === 'UK') return 'GBP';
  if (region === 'US') return 'USD';
  if (EUROZONE_COUNTRIES.includes(region)) return 'EUR';
  return null;
}

function readDeviceRegion(): string {
  try {
    const locales = Localization.getLocales();
    const region = locales?.[0]?.regionCode?.toUpperCase();
    if (region) return region;
  } catch {
    // ignore
  }
  return '';
}

/**
 * Multi-signal reconciliation (priority order):
 * deviceRegion → appStoreCurrency (validated) → ipCountry → DEFAULT GBP
 */
export function resolveCurrencyFromSignals(signals: CurrencySignal): Currency {
  const fromDevice = currencyFromRegion(signals.deviceRegion);
  if (fromDevice) return fromDevice;

  const store = signals.appStoreCurrency?.toUpperCase();
  if (isCurrency(store)) return store;

  const fromIp = currencyFromRegion(signals.ipCountry);
  if (fromIp) return fromIp;

  return DEFAULT_CURRENCY;
}

/**
 * Detect currency symbol / code shared by displayed price strings.
 * Returns null when symbols conflict (mixed £ + $).
 */
export function detectSharedPriceCurrency(
  prices: Array<string | null | undefined>,
): Currency | null {
  let shared: Currency | null = null;
  for (const price of prices) {
    if (!price || price === 'Free' || price === '—') continue;
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

class CurrencyService {
  /** Session-locked display currency — never switches mid-session. */
  private displayCurrency: Currency = DEFAULT_CURRENCY;
  /** StoreKit / Apple sheet currency when it differs from display. */
  private paymentCurrency: Currency | null = null;
  private sessionLocked = false;
  private initialized = false;
  private subscriptionPrices: SubscriptionPrices = {
    personal_stylist: { ...DEFAULT_SUBSCRIPTION_PRICES.personal_stylist },
    stylist_unlimited: { ...DEFAULT_SUBSCRIPTION_PRICES.stylist_unlimited },
  };
  private dfyPrices: DfyPrices = { ...DEFAULT_DFY_PRICES };
  private refreshInFlight: Promise<void> | null = null;
  private ipCountryCache: string | null = null;
  private ipLookupStarted = false;

  /**
   * Resolve ONCE per session and lock. StoreKit must not override after lock.
   */
  async initialize(signals?: Partial<CurrencySignal>): Promise<void> {
    if (!this.sessionLocked) {
      const deviceRegion = signals?.deviceRegion ?? readDeviceRegion();
      this.displayCurrency = resolveCurrencyFromSignals({
        deviceRegion,
        appStoreCurrency: signals?.appStoreCurrency,
        ipCountry: signals?.ipCountry ?? this.ipCountryCache ?? undefined,
      });
      this.sessionLocked = true;
      this.seedAmountsFromCatalog(this.displayCurrency);
    }

    this.initialized = true;
    this.kickIpCountryLookupSoft();
    await this.refreshPrices();
  }

  /** Soft geo-IP — never blocks UI; only used if somehow unlocked (tests / early). */
  private kickIpCountryLookupSoft(): void {
    if (this.ipLookupStarted || this.ipCountryCache) return;
    this.ipLookupStarted = true;
    // Prefer device region for UX; IP is advisory and ignored once session is locked.
    Promise.resolve()
      .then(async () => {
        // No dedicated client geo endpoint — leave cache empty unless a future API appears.
        return null as string | null;
      })
      .then((country) => {
        if (country) this.ipCountryCache = country.toUpperCase();
      })
      .catch(() => {});
  }

  private seedAmountsFromCatalog(code: Currency): void {
    const catalog = PRICE_CATALOG[code];
    this.subscriptionPrices = {
      personal_stylist: { ...catalog.personal_stylist },
      stylist_unlimited: { ...catalog.stylist_unlimited },
    };
    this.dfyPrices = { ...catalog.dfy };
  }

  /**
   * Record Apple payment currency without changing locked display currency.
   * If session is not yet locked, validated StoreKit currency may participate in resolution.
   */
  notePaymentCurrency(storeCurrencyCode?: string | null): void {
    const code = storeCurrencyCode?.toUpperCase();
    if (!isCurrency(code)) return;
    this.paymentCurrency = code;
    if (!this.sessionLocked) {
      this.displayCurrency = resolveCurrencyFromSignals({
        deviceRegion: readDeviceRegion(),
        appStoreCurrency: code,
        ipCountry: this.ipCountryCache ?? undefined,
      });
      this.sessionLocked = true;
      this.seedAmountsFromCatalog(this.displayCurrency);
    }
  }

  /** Test / harness only — do not call from UI. */
  unlockSessionForTests(): void {
    this.sessionLocked = false;
    this.displayCurrency = DEFAULT_CURRENCY;
    this.paymentCurrency = null;
    this.initialized = false;
  }

  /** Test helper: lock an explicit currency without device APIs. */
  lockSessionCurrencyForTests(currency: Currency): void {
    this.displayCurrency = currency;
    this.sessionLocked = true;
    this.initialized = true;
    this.seedAmountsFromCatalog(currency);
  }

  async refreshPrices(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.fetchPricesFromServer().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async fetchPricesFromServer(): Promise<void> {
    await Promise.all([this.fetchSubscriptionPrices(), this.fetchDfyPrices()]);
  }

  private mapPlanToSubscriptionKey(plan: {
    id?: string;
    tier?: string;
    legacy?: boolean;
  }): SubscriptionPriceKey | null {
    if (plan.legacy) return null;

    const tier = plan.tier ?? plan.id;
    if (tier === 'personal_stylist' || tier === 'style_chat') {
      return 'personal_stylist';
    }
    if (tier === 'stylist_unlimited') {
      return 'stylist_unlimited';
    }
    return null;
  }

  private async fetchSubscriptionPrices(): Promise<void> {
    try {
      const response = await apiService.getSubscriptionPlans();
      const plans = response.plans ?? [];

      for (const plan of plans) {
        const key = this.mapPlanToSubscriptionKey(plan);
        if (!key) continue;

        const monthly =
          centsToAmount(plan.monthlyPriceAmount) ??
          parsePriceString(plan.monthlyPrice);
        const yearly =
          centsToAmount(plan.yearlyPriceAmount) ??
          parsePriceString(plan.yearlyPrice);

        if (monthly != null) {
          this.subscriptionPrices[key].monthly = monthly;
        }
        if (yearly != null) {
          this.subscriptionPrices[key].yearly = yearly;
        }
      }
    } catch {
      // Keep cached defaults when the plans API is unavailable.
    }
  }

  private async fetchDfyPrices(): Promise<void> {
    try {
      const response = await apiService.getDFYProducts();
      const products = response.products ?? [];

      for (const product of products) {
        const amount =
          centsToAmount((product as { amount?: number }).amount ?? product.priceAmount) ??
          parsePriceString(product.price);

        if (amount == null) continue;

        if (product.id === 'outfit_setup' || product.type === 'lite') {
          this.dfyPrices.outfit_setup = amount;
        }
        if (product.id === 'core_wardrobe' || product.type === 'core') {
          this.dfyPrices.wardrobe_setup = amount;
        }
      }
    } catch {
      try {
        const comparison = await apiService.getDfyComparison();
        const litePrice = parsePriceString(comparison.liteCard?.price);
        const corePrice = parsePriceString(comparison.coreCard?.price);

        if (litePrice != null) this.dfyPrices.outfit_setup = litePrice;
        if (corePrice != null) this.dfyPrices.wardrobe_setup = corePrice;
      } catch {
        this.dfyPrices = { ...PRICE_CATALOG[this.displayCurrency].dfy };
      }
    }
  }

  getUserCurrency(): Currency {
    return this.displayCurrency;
  }

  getSessionCurrency(): Currency {
    return this.displayCurrency;
  }

  getDisplayCurrency(): Currency {
    return this.displayCurrency;
  }

  getPaymentCurrency(): Currency | null {
    return this.paymentCurrency;
  }

  isSessionLocked(): boolean {
    return this.sessionLocked;
  }

  getCurrencyInfo(code?: Currency): CurrencyInfo {
    return CURRENCIES[code || this.displayCurrency];
  }

  getCurrencySymbol(code?: Currency): string {
    return CURRENCIES[code || this.displayCurrency].symbol;
  }

  /**
   * Strict StoreKit filter: reject when product currency ≠ session display currency.
   * Sandbox / TestFlight USD must not overwrite GBP catalog.
   */
  safeStorekitPrice(
    product: StoreKitPriceLike,
    userCurrency: Currency = this.displayCurrency,
  ): { priceString: string; amount: number; currencyCode: Currency } | null {
    if (!product) return null;

    const codeRaw = product.currencyCode?.toUpperCase() ?? null;
    const code =
      (isCurrency(codeRaw) ? codeRaw : null) ??
      inferCurrencyFromPriceString(product.priceString ?? undefined);

    if (!code || code !== userCurrency) {
      if (typeof __DEV__ !== 'undefined' && __DEV__ && product.priceString) {
        console.warn(
          `[CurrencyAuthority] Rejected StoreKit price ${product.priceString} (${code ?? 'unknown'}) ≠ session ${userCurrency}`,
        );
      }
      return null;
    }

    const priceString = product.priceString?.trim();
    if (!priceString) return null;

    const amount =
      (typeof product.price === 'number' && Number.isFinite(product.price)
        ? product.price
        : null) ?? parsePriceString(priceString);
    if (amount == null) return null;

    return { priceString, amount, currencyCode: code };
  }

  /**
   * Display price: StoreKit only when safe match, else catalog / fallback.
   */
  getDisplayPrice(
    storeProduct: StoreKitPriceLike,
    catalogFallback: string,
    userCurrency: Currency = this.displayCurrency,
  ): string {
    const safe = this.safeStorekitPrice(storeProduct, userCurrency);
    return safe?.priceString ?? catalogFallback;
  }

  /**
   * Only accept App Store / RevenueCat price strings when they match session currency.
   */
  shouldAcceptStoreCurrency(storeCurrencyCode?: string | null, priceString?: string | null): boolean {
    return this.safeStorekitPrice(
      { currencyCode: storeCurrencyCode, priceString },
      this.displayCurrency,
    ) != null;
  }

  /**
   * Prefer storefront price when currency matches; otherwise keep catalog fallback.
   */
  resolveStorePrice(
    storePriceString: string | null | undefined,
    storeCurrencyCode: string | null | undefined,
    fallback: string,
  ): string {
    return this.getDisplayPrice(
      { priceString: storePriceString, currencyCode: storeCurrencyCode },
      fallback,
    );
  }

  formatPrice(amount: number, code?: Currency): string {
    const symbol = this.getCurrencySymbol(code);
    if (amount === 0) {
      return 'Free';
    }
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Yearly vs monthly×12 savings — symbol always matches the displayed prices.
   */
  formatYearlySavings(monthlyPrice: string, yearlyPrice: string): string {
    const monthly = parsePriceString(monthlyPrice);
    const yearly = parsePriceString(yearlyPrice);
    if (monthly == null || yearly == null) return '';

    const savings = monthly * 12 - yearly;
    if (!(savings > 0.009)) return '';

    const shared = detectSharedPriceCurrency([monthlyPrice, yearlyPrice]);
    const leading = yearlyPrice.match(/^[^\d\s.,]+/);
    const fromCode = inferCurrencyFromPriceString(yearlyPrice);
    const displaySymbol =
      leading?.[0] ||
      (shared ? CURRENCIES[shared].symbol : null) ||
      (fromCode ? CURRENCIES[fromCode].symbol : this.getCurrencySymbol());
    return `${displaySymbol}${savings.toFixed(2)}`;
  }

  getLocalizedPrices(): CatalogPriceSnapshot['monthly'] {
    return {
      free: 'Free',
      personal_stylist: this.formatPrice(this.subscriptionPrices.personal_stylist.monthly),
      stylist_unlimited: this.formatPrice(this.subscriptionPrices.stylist_unlimited.monthly),
    };
  }

  getPersonalStylistPrice(): string {
    return this.formatPrice(this.subscriptionPrices.personal_stylist.monthly);
  }

  getStylistUnlimitedPrice(): string {
    return this.formatPrice(this.subscriptionPrices.stylist_unlimited.monthly);
  }

  getDFYPrices(): CatalogPriceSnapshot['dfy'] {
    return {
      outfit_setup: this.formatPrice(this.dfyPrices.outfit_setup),
      wardrobe_setup: this.formatPrice(this.dfyPrices.wardrobe_setup),
    };
  }

  getYearlyPrices(): CatalogPriceSnapshot['yearly'] {
    return {
      free: 'Free',
      personal_stylist: this.formatPrice(this.subscriptionPrices.personal_stylist.yearly),
      stylist_unlimited: this.formatPrice(this.subscriptionPrices.stylist_unlimited.yearly),
    };
  }

  getVoicePackPrices(): CatalogPriceSnapshot['voice'] {
    const voice = PRICE_CATALOG[this.displayCurrency].voice;
    return {
      boost: this.formatPrice(voice.boost),
      pro: this.formatPrice(voice.pro),
      weekend: this.formatPrice(voice.weekend),
    };
  }

  getVoicePackPrice(packId: string): string {
    const voice = this.getVoicePackPrices();
    if (packId === 'boost' || packId === 'pro' || packId === 'weekend') {
      return voice[packId];
    }
    return this.formatPrice(PRICE_CATALOG[this.displayCurrency].voice.boost);
  }

  /**
   * Canonical catalog snapshot for session currency.
   * Use on load (initial state) and on purchase cancel / error.
   */
  resetPricesToCatalog(): CatalogPriceSnapshot {
    return {
      monthly: this.getLocalizedPrices(),
      yearly: this.getYearlyPrices(),
      dfy: this.getDFYPrices(),
      voice: this.getVoicePackPrices(),
    };
  }

  /**
   * Hard UI guard: all displayed price strings must share one currency.
   * On mismatch: __DEV__ logs loudly; production falls back to catalog (never crash users).
   */
  assertConsistentDisplayPrices(
    prices: Array<string | null | undefined>,
    fallback?: CatalogPriceSnapshot,
  ): { ok: boolean; snapshot: CatalogPriceSnapshot } {
    const catalogFallback = fallback ?? this.resetPricesToCatalog();
    const priced = prices.filter((p) => p && p !== 'Free' && p !== '—') as string[];
    const inferred = priced
      .map((p) => inferCurrencyFromPriceString(p))
      .filter((c): c is Currency => c != null);
    const mixed =
      inferred.length >= 2 && inferred.some((c) => c !== inferred[0]);
    const shared = detectSharedPriceCurrency(prices);

    if (mixed || (shared == null && inferred.length >= 2)) {
      const message = `[CurrencyAuthority] Mixed currency symbols in paywall UI: ${priced.join(', ')}`;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error(message);
      } else {
        console.warn(message);
      }
      return { ok: false, snapshot: catalogFallback };
    }
    if (shared && shared !== this.displayCurrency) {
      const message = `[CurrencyAuthority] Display currency ${shared} ≠ session ${this.displayCurrency}`;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error(message);
      } else {
        console.warn(message);
      }
      return { ok: false, snapshot: catalogFallback };
    }
    return { ok: true, snapshot: catalogFallback };
  }
}

export const currencyService = new CurrencyService();
export default currencyService;

/** Pure helper for scripts / tests — mirrors authority filter without Expo. */
export function safeStorekitPricePure(
  product: StoreKitPriceLike,
  userCurrency: Currency,
): { priceString: string; amount: number; currencyCode: Currency } | null {
  if (!product) return null;
  const codeRaw = product.currencyCode?.toUpperCase() ?? null;
  const code =
    (isCurrency(codeRaw) ? codeRaw : null) ??
    inferCurrencyFromPriceString(product.priceString ?? undefined);
  if (!code || code !== userCurrency) return null;
  const priceString = product.priceString?.trim();
  if (!priceString) return null;
  const amount =
    (typeof product.price === 'number' && Number.isFinite(product.price)
      ? product.price
      : null) ?? parsePriceString(priceString);
  if (amount == null) return null;
  return { priceString, amount, currencyCode: code };
}
