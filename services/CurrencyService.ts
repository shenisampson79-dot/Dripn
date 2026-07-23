import * as Localization from 'expo-localization';
import { apiService } from '@/services/ApiService';

export type SimpleCurrency = 'GBP' | 'EUR' | 'USD';

export interface CurrencyInfo {
  code: SimpleCurrency;
  symbol: string;
  name: string;
}

const CURRENCIES: Record<SimpleCurrency, CurrencyInfo> = {
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

const DEFAULT_SUBSCRIPTION_PRICES: SubscriptionPrices = {
  personal_stylist: { monthly: 9.99, yearly: 95.99 },
  stylist_unlimited: { monthly: 19.99, yearly: 191.99 },
};

const DEFAULT_DFY_PRICES: DfyPrices = {
  outfit_setup: 19.99,
  wardrobe_setup: 39.99,
};

export function parsePriceString(price: string | undefined | null): number | null {
  if (!price) return null;
  const match = price.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function centsToAmount(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 100 ? value / 100 : value;
}

function isSimpleCurrency(code: string | null | undefined): code is SimpleCurrency {
  return code === 'GBP' || code === 'EUR' || code === 'USD';
}

/** Infer currency from a StoreKit / formatted price string when currencyCode is missing. */
export function inferCurrencyFromPriceString(priceString: string | null | undefined): SimpleCurrency | null {
  if (!priceString) return null;
  if (priceString.includes('£')) return 'GBP';
  if (priceString.includes('€')) return 'EUR';
  // US dollar (avoid matching other locales that put $ after the amount)
  if (/^\$|\s\$|USD/i.test(priceString) || priceString.trim().startsWith('$')) return 'USD';
  if (priceString.includes('$')) return 'USD';
  return null;
}

function detectPreferredCurrency(): SimpleCurrency {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const locale = locales[0];
      const regionCode = locale.regionCode?.toUpperCase();
      const localeCurrency = (locale as { currencyCode?: string }).currencyCode?.toUpperCase();

      if (regionCode === 'GB' || regionCode === 'UK') return 'GBP';
      if (regionCode === 'US') return 'USD';
      if (regionCode && EUROZONE_COUNTRIES.includes(regionCode)) return 'EUR';
      if (isSimpleCurrency(localeCurrency)) return localeCurrency;
    }
  } catch {
    // Fall through to GBP — never leave callers on an uninitialized USD default.
  }
  return 'GBP';
}

class CurrencyService {
  // Prefer GBP until initialize() runs — never flash USD for UK users.
  private userCurrency: SimpleCurrency = 'GBP';
  private initialized = false;
  private subscriptionPrices: SubscriptionPrices = {
    personal_stylist: { ...DEFAULT_SUBSCRIPTION_PRICES.personal_stylist },
    stylist_unlimited: { ...DEFAULT_SUBSCRIPTION_PRICES.stylist_unlimited },
  };
  private dfyPrices: DfyPrices = { ...DEFAULT_DFY_PRICES };
  private refreshInFlight: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.userCurrency = detectPreferredCurrency();
      this.initialized = true;
    }

    await this.refreshPrices();
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
        this.dfyPrices = { ...DEFAULT_DFY_PRICES };
      }
    }
  }

  getUserCurrency(): SimpleCurrency {
    return this.userCurrency;
  }

  getCurrencyInfo(code?: SimpleCurrency): CurrencyInfo {
    return CURRENCIES[code || this.userCurrency];
  }

  getCurrencySymbol(code?: SimpleCurrency): string {
    return CURRENCIES[code || this.userCurrency].symbol;
  }

  /**
   * Only accept App Store / RevenueCat price strings when they match the
   * user's preferred currency. Prevents USD storefront prices from overwriting
   * GBP catalog display after purchase sheet open/cancel.
   */
  shouldAcceptStoreCurrency(storeCurrencyCode?: string | null, priceString?: string | null): boolean {
    const inferred =
      (isSimpleCurrency(storeCurrencyCode?.toUpperCase() ?? null)
        ? (storeCurrencyCode!.toUpperCase() as SimpleCurrency)
        : null) ?? inferCurrencyFromPriceString(priceString ?? undefined);
    if (!inferred) return false;
    return inferred === this.userCurrency;
  }

  /**
   * Prefer storefront price when currency matches; otherwise keep catalog fallback.
   * Never treats cancel/error as a reason to switch currency.
   */
  resolveStorePrice(
    storePriceString: string | null | undefined,
    storeCurrencyCode: string | null | undefined,
    fallback: string,
  ): string {
    if (
      storePriceString &&
      this.shouldAcceptStoreCurrency(storeCurrencyCode, storePriceString)
    ) {
      return storePriceString;
    }
    return fallback;
  }

  formatPrice(amount: number, code?: SimpleCurrency): string {
    const symbol = this.getCurrencySymbol(code);
    if (amount === 0) {
      return 'Free';
    }
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Yearly vs monthly×12 savings, using the same currency symbol as the
   * displayed yearly price (or the preferred catalog currency).
   */
  formatYearlySavings(monthlyPrice: string, yearlyPrice: string): string {
    const monthly = parsePriceString(monthlyPrice);
    const yearly = parsePriceString(yearlyPrice);
    if (monthly == null || yearly == null) return '';

    const savings = monthly * 12 - yearly;
    if (!(savings > 0.009)) return '';

    const leading = yearlyPrice.match(/^[^\d\s.,]+/);
    const fromCode = inferCurrencyFromPriceString(yearlyPrice);
    const displaySymbol = leading?.[0] || (fromCode ? CURRENCIES[fromCode].symbol : this.getCurrencySymbol());
    return `${displaySymbol}${savings.toFixed(2)}`;
  }

  getLocalizedPrices(): { free: string; personal_stylist: string; stylist_unlimited: string } {
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

  getDFYPrices(): { outfit_setup: string; wardrobe_setup: string } {
    const symbol = this.getCurrencySymbol();
    return {
      outfit_setup: `${symbol}${this.dfyPrices.outfit_setup.toFixed(2)}`,
      wardrobe_setup: `${symbol}${this.dfyPrices.wardrobe_setup.toFixed(2)}`,
    };
  }

  getYearlyPrices(): { free: string; personal_stylist: string; stylist_unlimited: string } {
    return {
      free: 'Free',
      personal_stylist: this.formatPrice(this.subscriptionPrices.personal_stylist.yearly),
      stylist_unlimited: this.formatPrice(this.subscriptionPrices.stylist_unlimited.yearly),
    };
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
