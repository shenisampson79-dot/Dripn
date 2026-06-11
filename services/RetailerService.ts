import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config/api';

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

const CACHE_KEY = '@dripn_retailer_suggestions_v3';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const UK_RETAILERS: Retailer[] = [
  { name: 'ASOS', category: 'online', hasLocalStores: false, shipsToCountry: true },
  { name: 'Zara', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'H&M', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Marks & Spencer', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'John Lewis', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Next', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'River Island', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Primark', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: false },
  { name: 'Topshop', category: 'fast-fashion', hasLocalStores: false, shipsToCountry: true },
  { name: 'Selfridges', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Harvey Nichols', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Harrods', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Net-a-Porter', category: 'luxury', hasLocalStores: false, shipsToCountry: true },
  { name: 'Matches Fashion', category: 'luxury', hasLocalStores: false, shipsToCountry: true },
  { name: 'Flannels', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Reiss', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Ted Baker', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'AllSaints', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Whistles', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Phase Eight', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Hobbs', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Karen Millen', category: 'contemporary', hasLocalStores: false, shipsToCountry: true },
  { name: 'LK Bennett', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Jigsaw', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Massimo Dutti', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'COS', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: '& Other Stories', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Arket', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Uniqlo', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'The White Company', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Boden', category: 'basics', hasLocalStores: false, shipsToCountry: true },
  { name: 'White Stuff', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'FatFace', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Jack Wills', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Superdry', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Mango', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Nike', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Adidas', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Gymshark', category: 'sportswear', hasLocalStores: false, shipsToCountry: true },
  { name: 'Lululemon', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'JD Sports', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'New Balance', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Under Armour', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'END Clothing', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Size?', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Boohoo', category: 'fast-fashion', hasLocalStores: false, shipsToCountry: true },
  { name: 'PrettyLittleThing', category: 'fast-fashion', hasLocalStores: false, shipsToCountry: true },
  { name: 'Rixo', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Nordstrom', category: 'department-store', hasLocalStores: false, shipsToCountry: true },
  { name: 'Gap', category: 'basics', hasLocalStores: true, shipsToCountry: true },
];

const US_RETAILERS: Retailer[] = [
  { name: 'Nordstrom', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Macy\'s', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Bloomingdale\'s', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Saks Fifth Avenue', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Neiman Marcus', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Net-a-Porter', category: 'luxury', hasLocalStores: false, shipsToCountry: true },
  { name: 'ASOS', category: 'online', hasLocalStores: false, shipsToCountry: true },
  { name: 'Zara', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'H&M', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Gap', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Banana Republic', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'J.Crew', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Anthropologie', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Free People', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Urban Outfitters', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Nike', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Adidas', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Lululemon', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Uniqlo', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Everlane', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Reformation', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Madewell', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Ralph Lauren', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Tommy Hilfiger', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Calvin Klein', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
];

const AU_RETAILERS: Retailer[] = [
  { name: 'David Jones', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Myer', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Country Road', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Witchery', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Seed Heritage', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Trenery', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'ASOS', category: 'online', hasLocalStores: false, shipsToCountry: true },
  { name: 'The Iconic', category: 'online', hasLocalStores: false, shipsToCountry: true },
  { name: 'Zara', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'H&M', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Uniqlo', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Nike', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Adidas', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Lululemon', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Net-a-Porter', category: 'luxury', hasLocalStores: false, shipsToCountry: true },
  { name: 'Zimmermann', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Camilla', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Mango', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Cotton On', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Sportsgirl', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
];

const DE_RETAILERS: Retailer[] = [
  { name: 'Zalando', category: 'online', hasLocalStores: false, shipsToCountry: true },
  { name: 'About You', category: 'online', hasLocalStores: false, shipsToCountry: true },
  { name: 'Peek & Cloppenburg', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Karstadt', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Galeria', category: 'department-store', hasLocalStores: true, shipsToCountry: true },
  { name: 'Zara', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'H&M', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Mango', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'C&A', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: 'Primark', category: 'fast-fashion', hasLocalStores: true, shipsToCountry: true },
  { name: '& Other Stories', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'COS', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Arket', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Uniqlo', category: 'basics', hasLocalStores: true, shipsToCountry: true },
  { name: 'Boden', category: 'basics', hasLocalStores: false, shipsToCountry: true },
  { name: 'Adidas', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Nike', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Puma', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Gymshark', category: 'sportswear', hasLocalStores: false, shipsToCountry: true },
  { name: 'Lululemon', category: 'sportswear', hasLocalStores: false, shipsToCountry: true },
  { name: 'JD Sports', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Foot Locker', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Intersport', category: 'sportswear', hasLocalStores: true, shipsToCountry: true },
  { name: 'Net-a-Porter', category: 'luxury', hasLocalStores: false, shipsToCountry: true },
  { name: 'Farfetch', category: 'luxury', hasLocalStores: false, shipsToCountry: true },
  { name: 'Breuninger', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Hugo Boss', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Balsamik', category: 'contemporary', hasLocalStores: false, shipsToCountry: true },
  { name: 'Esprit', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Tom Tailor', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Bogner', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Escada', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Jil Sander', category: 'luxury', hasLocalStores: true, shipsToCountry: true },
  { name: 'Marc Cain', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
  { name: 'Closed', category: 'contemporary', hasLocalStores: true, shipsToCountry: true },
];

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
      const apiUrl = API_URL;
      const response = await fetch(
        `${apiUrl}/api/retailers/suggestions?country=${encodeURIComponent(country)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error(`Failed to fetch retailers: ${response.status}`);

      const data = await response.json();
      const retailers: Retailer[] = data.retailers || [];

      const cacheData: RetailerSuggestionsResponse = { country, retailers, cachedAt: Date.now() };
      this.cache.set(cacheKey, cacheData);
      try {
        await AsyncStorage.setItem(`${CACHE_KEY}_${cacheKey}`, JSON.stringify(cacheData));
      } catch {}

      return retailers;
    } catch (error) {
      console.log('Error fetching retailer suggestions, using local list:', error);
      return this.getFallbackRetailers(country);
    }
  }

  private getFallbackRetailers(country: string): Retailer[] {
    const c = country.toLowerCase();
    if (c.includes('united kingdom') || c.includes('uk') || c.includes('england') || c.includes('scotland') || c.includes('wales')) {
      return UK_RETAILERS;
    }
    if (c.includes('australia')) return AU_RETAILERS;
    if (c.includes('united states') || c.includes('usa') || c.includes('us')) return US_RETAILERS;
    if (c.includes('germany') || c.includes('deutschland') || c === 'de') return DE_RETAILERS;
    return UK_RETAILERS;
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
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  }
}

export const RetailerService = new RetailerServiceImpl();
