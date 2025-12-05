export interface BargainDeal {
  id: string;
  brand: string;
  title: string;
  originalPrice: number;
  salePrice: number;
  discount: string;
  source: string;
  sourceUrl?: string;
  category: string;
  expiresAt: number;
  imageUrl?: string;
  isVipOnly?: boolean;
  gender: 'male' | 'female' | 'unisex';
}

export interface BargainCategory {
  id: string;
  name: string;
  count: number;
}

type GenderType = 'male' | 'female' | 'unisex';

const DEAL_TEMPLATES: Array<{
  brand: string;
  title: string;
  originalPrice: number;
  salePrice: number;
  discount: string;
  source: string;
  category: string;
  hoursToExpire: number;
  isVipOnly?: boolean;
  gender: GenderType;
}> = [
  { brand: "Gymshark", title: "Vital Seamless Leggings", originalPrice: 50, salePrice: 25, discount: "50% OFF", source: "Gymshark.com", category: "Athleisure", hoursToExpire: 2, gender: "female" },
  { brand: "Gymshark", title: "Apex Shorts", originalPrice: 40, salePrice: 20, discount: "50% OFF", source: "Gymshark.com", category: "Athleisure", hoursToExpire: 3, gender: "male" },
  { brand: "Adidas", title: "Ultraboost Running Shoes", originalPrice: 180, salePrice: 54, discount: "70% OFF", source: "Sports Direct", category: "Footwear", hoursToExpire: 5, gender: "unisex" },
  { brand: "Burberry", title: "Classic Check Scarf", originalPrice: 470, salePrice: 47, discount: "90% OFF", source: "Huntd", category: "Luxury", hoursToExpire: 24, isVipOnly: true, gender: "unisex" },
  { brand: "Lululemon", title: "Align High-Rise Pants", originalPrice: 98, salePrice: 69, discount: "30% OFF", source: "Lululemon Outlet", category: "Athleisure", hoursToExpire: 3, gender: "female" },
  { brand: "Lululemon", title: "ABC Jogger", originalPrice: 128, salePrice: 89, discount: "30% OFF", source: "Lululemon Outlet", category: "Athleisure", hoursToExpire: 4, gender: "male" },
  { brand: "Gucci", title: "GG Marmont Belt", originalPrice: 450, salePrice: 225, discount: "50% OFF", source: "The Outnet", category: "Luxury", hoursToExpire: 12, isVipOnly: true, gender: "female" },
  { brand: "Gucci", title: "GG Canvas Belt", originalPrice: 420, salePrice: 210, discount: "50% OFF", source: "The Outnet", category: "Luxury", hoursToExpire: 12, isVipOnly: true, gender: "male" },
  { brand: "Nike", title: "Air Max 90 Essential", originalPrice: 130, salePrice: 78, discount: "40% OFF", source: "Nike.com", category: "Footwear", hoursToExpire: 6, gender: "unisex" },
  { brand: "Zara", title: "Oversized Blazer", originalPrice: 119, salePrice: 59, discount: "50% OFF", source: "Zara.com", category: "Outerwear", hoursToExpire: 8, gender: "female" },
  { brand: "Zara", title: "Tailored Suit Jacket", originalPrice: 149, salePrice: 75, discount: "50% OFF", source: "Zara.com", category: "Outerwear", hoursToExpire: 8, gender: "male" },
  { brand: "New Balance", title: "574 Classic Sneakers", originalPrice: 90, salePrice: 63, discount: "30% OFF", source: "Sports Direct", category: "Footwear", hoursToExpire: 4, gender: "unisex" },
  { brand: "Prada", title: "Re-Edition 2005 Bag", originalPrice: 1250, salePrice: 875, discount: "30% OFF", source: "The Outnet", category: "Luxury", hoursToExpire: 18, isVipOnly: true, gender: "female" },
  { brand: "Prada", title: "Saffiano Leather Wallet", originalPrice: 650, salePrice: 455, discount: "30% OFF", source: "The Outnet", category: "Luxury", hoursToExpire: 18, isVipOnly: true, gender: "male" },
  { brand: "ASOS", title: "High Waist Jeans", originalPrice: 45, salePrice: 27, discount: "40% OFF", source: "ASOS.com", category: "Casual", hoursToExpire: 7, gender: "female" },
  { brand: "ASOS", title: "Slim Fit Chinos", originalPrice: 40, salePrice: 24, discount: "40% OFF", source: "ASOS.com", category: "Casual", hoursToExpire: 7, gender: "male" },
];

class BargainsServiceImpl {
  private deals: BargainDeal[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 60 * 1000;

  async fetchDeals(userCountry?: string, userGender?: string): Promise<BargainDeal[]> {
    const now = Date.now();
    
    if (this.deals.length > 0 && now - this.lastFetchTime < this.CACHE_DURATION) {
      return this.deals.filter(deal => deal.expiresAt > now);
    }

    await this.simulateNetworkDelay();

    const shuffled = [...DEAL_TEMPLATES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6 + Math.floor(Math.random() * 4));

    this.deals = selected.map((template, index) => ({
      id: `deal-${now}-${index}`,
      brand: template.brand,
      title: template.title,
      originalPrice: template.originalPrice,
      salePrice: template.salePrice,
      discount: template.discount,
      source: template.source,
      category: template.category,
      expiresAt: now + template.hoursToExpire * 60 * 60 * 1000 + Math.random() * 30 * 60 * 1000,
      isVipOnly: template.isVipOnly,
      gender: template.gender,
    }));

    this.lastFetchTime = now;
    return this.deals;
  }

  async refreshDeals(userCountry?: string, userGender?: string): Promise<BargainDeal[]> {
    this.lastFetchTime = 0;
    this.deals = [];
    return this.fetchDeals(userCountry, userGender);
  }

  getCategories(deals: BargainDeal[]): BargainCategory[] {
    const categoryMap = new Map<string, number>();
    
    deals.forEach(deal => {
      const count = categoryMap.get(deal.category) || 0;
      categoryMap.set(deal.category, count + 1);
    });

    const categories: BargainCategory[] = [
      { id: "All", name: "All", count: deals.length },
    ];

    categoryMap.forEach((count, name) => {
      categories.push({ id: name, name, count });
    });

    return categories.sort((a, b) => {
      if (a.id === "All") return -1;
      if (b.id === "All") return 1;
      return b.count - a.count;
    });
  }

  filterDeals(deals: BargainDeal[], category: string, isVip: boolean, userGender?: string): BargainDeal[] {
    const now = Date.now();
    const normalizedGender = userGender?.toLowerCase() === 'male' ? 'male' : 'female';
    return deals.filter(deal => {
      if (deal.expiresAt <= now) return false;
      if (deal.isVipOnly && !isVip) return false;
      if (category !== "All" && deal.category !== category) return false;
      if (deal.gender !== 'unisex' && deal.gender !== normalizedGender) return false;
      return true;
    });
  }

  private async simulateNetworkDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
  }
}

export const BargainsService = new BargainsServiceImpl();

export function formatTimeRemaining(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;
  
  if (diff <= 0) return "Expired";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function isUrgent(expiresAt: number): boolean {
  const diff = expiresAt - Date.now();
  return diff > 0 && diff < 60 * 60 * 1000;
}
