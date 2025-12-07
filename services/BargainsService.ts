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
  currencySymbol: string;
  currencyCode: string;
}

export function getCurrencyForCountry(country: string): { symbol: string; code: string; rate: number } {
  if (country === "United Kingdom" || country === "Isle of Man" || country === "Jersey" || country === "Guernsey" || country === "Gibraltar") {
    return { symbol: "£", code: "GBP", rate: 0.79 };
  }
  if (country === "Ireland") return { symbol: "€", code: "EUR", rate: 0.92 };
  if (["Germany", "France", "Italy", "Spain", "Netherlands", "Belgium", "Austria", "Portugal", "Greece", "Finland"].includes(country)) {
    return { symbol: "€", code: "EUR", rate: 0.92 };
  }
  if (country === "Australia") return { symbol: "A$", code: "AUD", rate: 1.53 };
  if (country === "Canada") return { symbol: "C$", code: "CAD", rate: 1.36 };
  if (country === "Japan") return { symbol: "¥", code: "JPY", rate: 149.5 };
  if (country === "India") return { symbol: "₹", code: "INR", rate: 83.2 };
  if (country === "Brazil") return { symbol: "R$", code: "BRL", rate: 4.97 };
  if (country === "Mexico") return { symbol: "MX$", code: "MXN", rate: 17.15 };
  if (country === "South Africa") return { symbol: "R", code: "ZAR", rate: 18.5 };
  if (country === "China") return { symbol: "¥", code: "CNY", rate: 7.24 };
  if (country === "South Korea") return { symbol: "₩", code: "KRW", rate: 1320 };
  if (country === "Singapore") return { symbol: "S$", code: "SGD", rate: 1.34 };
  if (country === "United Arab Emirates") return { symbol: "AED", code: "AED", rate: 3.67 };
  if (country === "New Zealand") return { symbol: "NZ$", code: "NZD", rate: 1.63 };
  if (country === "Switzerland") return { symbol: "CHF", code: "CHF", rate: 0.88 };
  if (country === "Sweden") return { symbol: "kr", code: "SEK", rate: 10.42 };
  if (country === "Norway") return { symbol: "kr", code: "NOK", rate: 10.65 };
  if (country === "Denmark") return { symbol: "kr", code: "DKK", rate: 6.87 };
  if (country === "Poland") return { symbol: "zł", code: "PLN", rate: 3.98 };
  return { symbol: "$", code: "USD", rate: 1 };
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
  { brand: "Stone Island", title: "Badge Compass Jumper", originalPrice: 295, salePrice: 206, discount: "30% OFF", source: "Flannels", category: "Football Casual", hoursToExpire: 6, gender: "male" },
  { brand: "Stone Island", title: "Soft Shell Jacket", originalPrice: 475, salePrice: 285, discount: "40% OFF", source: "End Clothing", category: "Football Casual", hoursToExpire: 8, gender: "male" },
  { brand: "Stone Island", title: "Shadow Project Hoodie", originalPrice: 425, salePrice: 255, discount: "40% OFF", source: "Flannels", category: "Football Casual", hoursToExpire: 4, isVipOnly: true, gender: "male" },
  { brand: "C.P. Company", title: "Goggle Jacket", originalPrice: 545, salePrice: 382, discount: "30% OFF", source: "End Clothing", category: "Football Casual", hoursToExpire: 5, gender: "male" },
  { brand: "C.P. Company", title: "Soft Shell R Jacket", originalPrice: 395, salePrice: 237, discount: "40% OFF", source: "Tessuti", category: "Football Casual", hoursToExpire: 7, gender: "male" },
  { brand: "C.P. Company", title: "Lens Beanie", originalPrice: 95, salePrice: 57, discount: "40% OFF", source: "End Clothing", category: "Football Casual", hoursToExpire: 3, gender: "male" },
  { brand: "Lyle & Scott", title: "Quarter Zip Jumper", originalPrice: 85, salePrice: 51, discount: "40% OFF", source: "Lyle & Scott", category: "Football Casual", hoursToExpire: 6, gender: "male" },
  { brand: "Lyle & Scott", title: "Classic Polo Shirt", originalPrice: 55, salePrice: 33, discount: "40% OFF", source: "JD Sports", category: "Football Casual", hoursToExpire: 4, gender: "male" },
  { brand: "Lyle & Scott", title: "Lightweight Jacket", originalPrice: 120, salePrice: 72, discount: "40% OFF", source: "Lyle & Scott", category: "Football Casual", hoursToExpire: 5, gender: "male" },
  { brand: "Ugg", title: "Classic Mini II Boots", originalPrice: 155, salePrice: 109, discount: "30% OFF", source: "Schuh", category: "Cosy Comfort", hoursToExpire: 8, gender: "female" },
  { brand: "Ugg", title: "Classic Short II Boots", originalPrice: 185, salePrice: 130, discount: "30% OFF", source: "Office", category: "Cosy Comfort", hoursToExpire: 6, gender: "female" },
  { brand: "Ugg", title: "Tasman Slippers", originalPrice: 110, salePrice: 77, discount: "30% OFF", source: "Ugg.com", category: "Cosy Comfort", hoursToExpire: 5, gender: "female" },
  { brand: "Ugg", title: "Ultra Mini Platform", originalPrice: 175, salePrice: 123, discount: "30% OFF", source: "Selfridges", category: "Cosy Comfort", hoursToExpire: 4, gender: "female" },
  { brand: "Ugg", title: "Scuffette II Slippers", originalPrice: 95, salePrice: 67, discount: "30% OFF", source: "John Lewis", category: "Cosy Comfort", hoursToExpire: 7, gender: "female" },
  { brand: "Ugg", title: "Disquette Platform Slippers", originalPrice: 130, salePrice: 91, discount: "30% OFF", source: "Schuh", category: "Cosy Comfort", hoursToExpire: 3, isVipOnly: true, gender: "female" },
  { brand: "Weekday", title: "Oversized Joggers", originalPrice: 45, salePrice: 27, discount: "40% OFF", source: "ASOS", category: "Cosy Comfort", hoursToExpire: 6, gender: "female" },
  { brand: "Topshop", title: "Baggy Boyfriend Jeans", originalPrice: 52, salePrice: 31, discount: "40% OFF", source: "ASOS", category: "Cosy Comfort", hoursToExpire: 5, gender: "female" },
  { brand: "The North Face", title: "Nuptse Puffer Jacket", originalPrice: 270, salePrice: 189, discount: "30% OFF", source: "JD Sports", category: "Outerwear", hoursToExpire: 8, gender: "unisex" },
  { brand: "The North Face", title: "Resolve Rain Jacket", originalPrice: 110, salePrice: 77, discount: "30% OFF", source: "Blacks", category: "Outerwear", hoursToExpire: 6, gender: "unisex" },
  { brand: "The North Face", title: "McMurdo Parka", originalPrice: 380, salePrice: 266, discount: "30% OFF", source: "The North Face", category: "Outerwear", hoursToExpire: 5, gender: "male" },
  { brand: "The North Face", title: "1996 Retro Nuptse", originalPrice: 300, salePrice: 210, discount: "30% OFF", source: "Size?", category: "Outerwear", hoursToExpire: 4, gender: "female" },
  { brand: "Rab", title: "Microlight Alpine Jacket", originalPrice: 220, salePrice: 154, discount: "30% OFF", source: "Cotswold Outdoor", category: "Outerwear", hoursToExpire: 7, gender: "unisex" },
  { brand: "Rab", title: "Downpour Eco Jacket", originalPrice: 130, salePrice: 91, discount: "30% OFF", source: "Go Outdoors", category: "Outerwear", hoursToExpire: 5, gender: "unisex" },
  { brand: "Arc'teryx", title: "Beta AR Jacket", originalPrice: 550, salePrice: 385, discount: "30% OFF", source: "Ellis Brigham", category: "Outerwear", hoursToExpire: 6, isVipOnly: true, gender: "unisex" },
  { brand: "Arc'teryx", title: "Atom Hoody", originalPrice: 240, salePrice: 168, discount: "30% OFF", source: "Snow+Rock", category: "Outerwear", hoursToExpire: 4, gender: "unisex" },
  { brand: "Jack Wolfskin", title: "Jasper 3-in-1 Jacket", originalPrice: 200, salePrice: 120, discount: "40% OFF", source: "Jack Wolfskin", category: "Outerwear", hoursToExpire: 8, gender: "male" },
  { brand: "Jack Wolfskin", title: "Stormy Point Jacket", originalPrice: 150, salePrice: 90, discount: "40% OFF", source: "Millets", category: "Outerwear", hoursToExpire: 6, gender: "female" },
  { brand: "Mackage", title: "Adali Down Coat", originalPrice: 890, salePrice: 623, discount: "30% OFF", source: "Selfridges", category: "Outerwear", hoursToExpire: 5, isVipOnly: true, gender: "female" },
  { brand: "Mackage", title: "Edward Down Jacket", originalPrice: 850, salePrice: 595, discount: "30% OFF", source: "Harrods", category: "Outerwear", hoursToExpire: 4, isVipOnly: true, gender: "male" },
  { brand: "Tom Ford", title: "Slim-Fit Cotton Shirt", originalPrice: 590, salePrice: 354, discount: "40% OFF", source: "MrPorter.com", category: "Luxury", hoursToExpire: 8, gender: "male" },
  { brand: "Loro Piana", title: "Cashmere Half-Zip Sweater", originalPrice: 1450, salePrice: 1015, discount: "30% OFF", source: "MrPorter.com", category: "Luxury", hoursToExpire: 6, isVipOnly: true, gender: "male" },
  { brand: "Brunello Cucinelli", title: "Suede Bomber Jacket", originalPrice: 4250, salePrice: 2975, discount: "30% OFF", source: "MrPorter.com", category: "Luxury", hoursToExpire: 12, isVipOnly: true, gender: "male" },
  { brand: "Common Projects", title: "Original Achilles Sneakers", originalPrice: 425, salePrice: 298, discount: "30% OFF", source: "MrPorter.com", category: "Footwear", hoursToExpire: 5, gender: "male" },
  { brand: "AMI Paris", title: "De Coeur Logo Cardigan", originalPrice: 390, salePrice: 273, discount: "30% OFF", source: "MrPorter.com", category: "Casual", hoursToExpire: 7, gender: "male" },
];

class BargainsServiceImpl {
  private deals: BargainDeal[] = [];
  private lastFetchTime: number = 0;
  private lastCountry: string = "";
  private readonly CACHE_DURATION = 60 * 1000;

  async fetchDeals(userCountry?: string, userGender?: string): Promise<BargainDeal[]> {
    const now = Date.now();
    const country = userCountry || "United States";
    
    if (this.deals.length > 0 && now - this.lastFetchTime < this.CACHE_DURATION && this.lastCountry === country) {
      return this.deals.filter(deal => deal.expiresAt > now);
    }

    await this.simulateNetworkDelay();

    const shuffled = [...DEAL_TEMPLATES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6 + Math.floor(Math.random() * 4));
    const currencyInfo = getCurrencyForCountry(country);

    this.deals = selected.map((template, index) => {
      const convertedOriginal = template.originalPrice * currencyInfo.rate;
      const convertedSale = template.salePrice * currencyInfo.rate;
      const roundedOriginal = currencyInfo.code === "JPY" || currencyInfo.code === "KRW" 
        ? Math.round(convertedOriginal) 
        : Math.round(convertedOriginal * 100) / 100;
      const roundedSale = currencyInfo.code === "JPY" || currencyInfo.code === "KRW" 
        ? Math.round(convertedSale) 
        : Math.round(convertedSale * 100) / 100;
      
      return {
        id: `deal-${now}-${index}`,
        brand: template.brand,
        title: template.title,
        originalPrice: roundedOriginal,
        salePrice: roundedSale,
        discount: template.discount,
        source: template.source,
        category: template.category,
        expiresAt: now + template.hoursToExpire * 60 * 60 * 1000 + Math.random() * 30 * 60 * 1000,
        isVipOnly: template.isVipOnly,
        gender: template.gender,
        currencySymbol: currencyInfo.symbol,
        currencyCode: currencyInfo.code,
      };
    });

    this.lastFetchTime = now;
    this.lastCountry = country;
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
    const genderLower = userGender?.toLowerCase() || '';
    const normalizedGender = (genderLower === 'male' || genderLower === 'man') ? 'male' : 'female';
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
