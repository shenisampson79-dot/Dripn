import * as Localization from 'expo-localization';

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
  'FI', 'SK', 'SI', 'LT', 'LV', 'EE', 'CY', 'MT', 'LU', 'HR'
];

const UK_COUNTRIES = ['GB', 'UK'];

class CurrencyService {
  private userCurrency: SimpleCurrency = 'USD';
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const locale = locales[0];
        const regionCode = locale.regionCode?.toUpperCase();
        
        if (regionCode) {
          if (UK_COUNTRIES.includes(regionCode)) {
            this.userCurrency = 'GBP';
          } else if (EUROZONE_COUNTRIES.includes(regionCode)) {
            this.userCurrency = 'EUR';
          } else {
            this.userCurrency = 'USD';
          }
        }
      }
    } catch (error) {
      this.userCurrency = 'USD';
    }
    
    this.initialized = true;
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

  getLocalizedPrices(): { free: string; personal_stylist: string } {
    return {
      free: 'Free',
      personal_stylist: this.formatPrice(14.99),
    };
  }

  getPersonalStylistPrice(): string {
    return this.formatPrice(14.99);
  }

  getDFYPrices(): { outfit_setup: string; wardrobe_setup: string } {
    const symbol = this.getCurrencySymbol();
    return {
      outfit_setup: `${symbol}19`,
      wardrobe_setup: `${symbol}39.99`,
    };
  }
}


export const currencyService = new CurrencyService();
export default currencyService;
