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
  stylist_unlimited: { monthly: 19.99, yearly: 179.99 },
};

const DEFAULT_DFY_PRICES: DfyPrices = {
  outfit_setup: 19.99,
  wardrobe_setup: 39.99,
};

function parsePriceString(price: string | undefined): number | null {
  if (!price) return null;
  const match = price.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function centsToAmount(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 100 ? value / 100 : value;
}

class CurrencyService {
  private userCurrency: SimpleCurrency = 'USD';
  private initialized = false;
  private subscriptionPrices: SubscriptionPrices = { ...DEFAULT_SUBSCRIPTION_PRICES };
  private dfyPrices: DfyPrices = { ...DEFAULT_DFY_PRICES };
  private refreshInFlight: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (!this.initialized) {
      try {
        this.userCurrency = 'GBP';

        const locales = Localization.getLocales();
        if (locales && locales.length > 0) {
          const locale = locales[0];
          const regionCode = locale.regionCode?.toUpperCase();

          if (regionCode && EUROZONE_COUNTRIES.includes(regionCode)) {
            this.userCurrency = 'EUR';
          }
        }
      } catch {
        this.userCurrency = 'GBP';
      }

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

  formatPrice(amount: number): string {
    const symbol = this.getCurrencySymbol();
    if (amount === 0) {
      return 'Free';
    }
    return `${symbol}${amount.toFixed(2)}`;
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
