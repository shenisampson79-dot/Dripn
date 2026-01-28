import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://0ff35e7b-c52b-436f-bc3a-caa12ac9e07a-00-ladpqjdev6jc.spock.replit.dev:3000';

export interface Retailer {
  name: string;
  category: 'luxury' | 'contemporary' | 'fast-fashion' | 'sportswear' | 'department-store' | 'online' | 'basics';
  hasLocalStores: boolean;
  shipsToCountry: boolean;
  website?: string;
}

export interface RetailerSuggestionsResponse {
  country: string;
  retailers: Retailer[];
  cachedAt?: number;
}

const CACHE_KEY = '@dripn_retailer_suggestions';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

class RetailerServiceImpl {
  private cache: Map<string, RetailerSuggestionsResponse> = new Map();
  
  async getRetailerSuggestions(country: string): Promise<Retailer[]> {
    const cacheKey = country.toLowerCase().replace(/\s+/g, '-');
    
    const cached = this.cache.get(cacheKey);
    if (cached && cached.cachedAt && Date.now() - cached.cachedAt < CACHE_DURATION) {
      return cached.retailers;
    }
    
    try {
      const storedCache = await AsyncStorage.getItem(`${CACHE_KEY}_${cacheKey}`);
      if (storedCache) {
        const parsed: RetailerSuggestionsResponse = JSON.parse(storedCache);
        if (parsed.cachedAt && Date.now() - parsed.cachedAt < CACHE_DURATION) {
          this.cache.set(cacheKey, parsed);
          return parsed.retailers;
        }
      }
    } catch (error) {
      console.log('Error reading retailer cache:', error);
    }
    
    try {
      const response = await fetch(
        `${API_URL}/api/retailers/suggestions?country=${encodeURIComponent(country)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch retailers: ${response.status}`);
      }
      
      const data = await response.json();
      const retailers: Retailer[] = data.retailers || [];
      
      const cacheData: RetailerSuggestionsResponse = {
        country,
        retailers,
        cachedAt: Date.now(),
      };
      
      this.cache.set(cacheKey, cacheData);
      
      try {
        await AsyncStorage.setItem(`${CACHE_KEY}_${cacheKey}`, JSON.stringify(cacheData));
      } catch (error) {
        console.log('Error saving retailer cache:', error);
      }
      
      return retailers;
    } catch (error) {
      console.log('Error fetching retailer suggestions:', error);
      return this.getFallbackRetailers(country);
    }
  }
  
  private getFallbackRetailers(country: string): Retailer[] {
    const commonRetailers: Retailer[] = [
      { name: 'ASOS', category: 'online', hasLocalStores: false, shipsToCountry: true },
      { name: 'Zara', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
      { name: 'H&M', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
      { name: 'Nike', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
      { name: 'Net-a-Porter', category: 'luxury', hasLocalStores: false, shipsToCountry: true },
      { name: 'Nordstrom', category: 'department-store', hasLocalStores: false, shipsToCountry: true },
      { name: 'Uniqlo', category: 'basics', hasLocalStores: true, shipsToCountry: true },
      { name: 'Massimo Dutti', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
    ];
    
    return commonRetailers;
  }
  
  getRetailersByCategory(retailers: Retailer[], category?: Retailer['category']): Retailer[] {
    if (!category) return retailers;
    return retailers.filter(r => r.category === category);
  }
  
  getLocalRetailers(retailers: Retailer[]): Retailer[] {
    return retailers.filter(r => r.hasLocalStores);
  }
  
  getOnlineRetailers(retailers: Retailer[]): Retailer[] {
    return retailers.filter(r => !r.hasLocalStores && r.shipsToCountry);
  }
  
  getCategoryLabel(category: Retailer['category']): string {
    const labels: Record<Retailer['category'], string> = {
      'luxury': 'Luxury',
      'contemporary': 'Contemporary',
      'fast-fashion': 'Fast Fashion',
      'sportswear': 'Sportswear',
      'department-store': 'Department Store',
      'online': 'Online Only',
      'basics': 'Basics & Essentials',
    };
    return labels[category] || category;
  }
  
  async clearCache(): Promise<void> {
    this.cache.clear();
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  }
}

export const RetailerService = new RetailerServiceImpl();
