import * as Localization from 'expo-localization';

export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'AUD' | 'CAD' | 'JPY' | 'INR' | 'CNY' | 'CHF' | 'SEK' | 'NOK' | 'DKK' | 'NZD' | 'SGD' | 'HKD' | 'KRW' | 'BRL' | 'MXN' | 'ZAR' | 'AED';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  position: 'before' | 'after';
  thousandsSeparator: string;
  decimalSeparator: string;
}

const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', position: 'before', thousandsSeparator: '.', decimalSeparator: ',' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', position: 'before', thousandsSeparator: "'", decimalSeparator: '.' },
  SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', position: 'after', thousandsSeparator: ' ', decimalSeparator: ',' },
  NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', position: 'after', thousandsSeparator: ' ', decimalSeparator: ',' },
  DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone', position: 'after', thousandsSeparator: '.', decimalSeparator: ',' },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', position: 'before', thousandsSeparator: '.', decimalSeparator: ',' },
  MXN: { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', position: 'before', thousandsSeparator: ' ', decimalSeparator: ',' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', position: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
};

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  GB: 'GBP', UK: 'GBP',
  US: 'USD',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', 
  GR: 'EUR', FI: 'EUR', SK: 'EUR', SI: 'EUR', LT: 'EUR', LV: 'EUR', EE: 'EUR', CY: 'EUR', MT: 'EUR', LU: 'EUR',
  AU: 'AUD',
  CA: 'CAD',
  JP: 'JPY',
  IN: 'INR',
  CN: 'CNY',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  NZ: 'NZD',
  SG: 'SGD',
  HK: 'HKD',
  KR: 'KRW',
  BR: 'BRL',
  MX: 'MXN',
  ZA: 'ZAR',
  AE: 'AED', SA: 'AED', QA: 'AED', KW: 'AED', BH: 'AED', OM: 'AED',
};

const BASE_PRICES_GBP = {
  free: 0,
  basic: 4.99,
  premium: 9.99,
  vip: 9999,
};

const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.17,
  AUD: 1.93,
  CAD: 1.71,
  JPY: 189.5,
  INR: 105.8,
  CNY: 9.12,
  CHF: 1.11,
  SEK: 13.1,
  NOK: 13.5,
  DKK: 8.72,
  NZD: 2.08,
  SGD: 1.70,
  HKD: 9.91,
  KRW: 1680,
  BRL: 6.22,
  MXN: 21.9,
  ZAR: 23.1,
  AED: 4.66,
};

const ZERO_DECIMAL_CURRENCIES: CurrencyCode[] = ['JPY', 'KRW'];

class CurrencyService {
  private userCurrency: CurrencyCode = 'GBP';
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const locale = locales[0];
        const regionCode = locale.regionCode?.toUpperCase();
        
        if (regionCode && COUNTRY_TO_CURRENCY[regionCode]) {
          this.userCurrency = COUNTRY_TO_CURRENCY[regionCode];
        }
      }
    } catch (error) {
      this.userCurrency = 'GBP';
    }
    
    this.initialized = true;
  }

  getUserCurrency(): CurrencyCode {
    return this.userCurrency;
  }

  getCurrencyInfo(code?: CurrencyCode): CurrencyInfo {
    return CURRENCIES[code || this.userCurrency];
  }

  getCurrencySymbol(code?: CurrencyCode): string {
    return CURRENCIES[code || this.userCurrency].symbol;
  }

  convertFromGBP(amountGBP: number, targetCurrency?: CurrencyCode): number {
    const currency = targetCurrency || this.userCurrency;
    const rate = EXCHANGE_RATES[currency];
    const converted = amountGBP * rate;
    if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
      return Math.round(converted);
    }
    return Math.round(converted * 100) / 100;
  }

  formatPrice(amount: number, currencyCode?: CurrencyCode): string {
    const code = currencyCode || this.userCurrency;
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(code);
    
    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: isZeroDecimal ? 0 : 2,
        maximumFractionDigits: isZeroDecimal ? 0 : 2,
      }).format(amount);
    } catch {
      const currency = CURRENCIES[code];
      const formattedAmount = isZeroDecimal 
        ? Math.round(amount).toLocaleString()
        : amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      if (currency.position === 'before') {
        return `${currency.symbol}${formattedAmount}`;
      } else {
        return `${formattedAmount} ${currency.symbol}`;
      }
    }
  }

  getLocalizedPrices(): { free: string; basic: string; premium: string; vip: string } {
    const freeConverted = this.convertFromGBP(BASE_PRICES_GBP.free);
    const basicConverted = this.convertFromGBP(BASE_PRICES_GBP.basic);
    const premiumConverted = this.convertFromGBP(BASE_PRICES_GBP.premium);
    const vipConverted = this.convertFromGBP(BASE_PRICES_GBP.vip);

    return {
      free: this.formatPrice(freeConverted),
      basic: this.formatPrice(basicConverted),
      premium: this.formatPrice(premiumConverted),
      vip: this.formatPrice(vipConverted),
    };
  }

  getPlanPrice(planId: 'free' | 'basic' | 'premium' | 'vip'): string {
    const gbpAmount = BASE_PRICES_GBP[planId];
    const localAmount = this.convertFromGBP(gbpAmount);
    return this.formatPrice(localAmount);
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
