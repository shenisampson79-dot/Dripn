import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

export type EcoRating = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | 'unknown';

export interface BrandSustainabilityInfo {
  name: string;
  ecoRating: EcoRating;
  certifications: string[];
  sustainablePractices: string[];
  carbonFootprintScore: number;
  ethicalLabor: boolean;
  veganFriendly: boolean;
  recycledMaterials: boolean;
  description: string;
}

export interface SustainablePurchase {
  id: string;
  itemName: string;
  brand: string;
  category: string;
  ecoRating: EcoRating;
  carbonSaved: number;
  purchaseDate: string;
  imageUrl?: string;
  price: number;
  currencySymbol: string;
}

export interface EcoAlternative {
  id: string;
  originalItem: string;
  alternativeItem: string;
  brand: string;
  ecoRating: EcoRating;
  price: number;
  currencySymbol: string;
  carbonSaved: number;
  imageUrl?: string;
  productUrl?: string;
}

export interface CarbonFootprintData {
  totalCarbon: number;
  monthlyCarbon: number[];
  carbonSaved: number;
  treesEquivalent: number;
  sustainablePurchases: number;
  totalPurchases: number;
  ecoScore: number;
}

export interface SustainabilityGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline?: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface SustainabilityTip {
  id: string;
  title: string;
  description: string;
  category: 'shopping' | 'care' | 'disposal' | 'general';
  impactLevel: 'low' | 'medium' | 'high';
}

interface SustainabilityContextType {
  sustainablePurchases: SustainablePurchase[];
  carbonFootprint: CarbonFootprintData;
  goals: SustainabilityGoal[];
  isLoading: boolean;
  getBrandEcoRating: (brandName: string) => BrandSustainabilityInfo;
  getEcoAlternatives: (itemCategory: string) => EcoAlternative[];
  getSustainabilityTips: () => SustainabilityTip[];
  addSustainablePurchase: (purchase: Omit<SustainablePurchase, 'id'>) => Promise<void>;
  removeSustainablePurchase: (purchaseId: string) => Promise<void>;
  addGoal: (goal: Omit<SustainabilityGoal, 'id' | 'createdAt' | 'isCompleted' | 'currentValue'>) => Promise<void>;
  updateGoalProgress: (goalId: string, value: number) => Promise<void>;
  removeGoal: (goalId: string) => Promise<void>;
  getCarbonFootprintByMonth: (monthIndex: number) => number;
  getEcoScoreBreakdown: () => { label: string; value: number; color: string }[];
  getTopSustainableBrands: () => BrandSustainabilityInfo[];
  refreshData: () => Promise<void>;
}

const SustainabilityContext = createContext<SustainabilityContextType | null>(null);

const PURCHASES_STORAGE_KEY = '@dripn_sustainable_purchases';
const GOALS_STORAGE_KEY = '@dripn_sustainability_goals';
const CARBON_STORAGE_KEY = '@dripn_carbon_footprint';

const SUSTAINABLE_BRANDS: BrandSustainabilityInfo[] = [
  {
    name: 'Patagonia',
    ecoRating: 'A+',
    certifications: ['B Corp', 'Fair Trade', 'Bluesign'],
    sustainablePractices: ['Recycled materials', 'Repair program', 'Fair wages'],
    carbonFootprintScore: 95,
    ethicalLabor: true,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Industry leader in sustainable outdoor apparel with lifetime repair guarantee.',
  },
  {
    name: 'Stella McCartney',
    ecoRating: 'A+',
    certifications: ['Fur-Free', 'Leather-Free', 'PVC-Free'],
    sustainablePractices: ['Vegan luxury', 'Organic cotton', 'Recycled polyester'],
    carbonFootprintScore: 92,
    ethicalLabor: true,
    veganFriendly: true,
    recycledMaterials: true,
    description: 'Luxury fashion house pioneering sustainable and cruelty-free design.',
  },
  {
    name: 'Eileen Fisher',
    ecoRating: 'A',
    certifications: ['B Corp', 'Fair Trade'],
    sustainablePractices: ['Take-back program', 'Organic fibres', 'Zero waste'],
    carbonFootprintScore: 88,
    ethicalLabor: true,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Timeless designs with industry-leading recycling and circularity programs.',
  },
  {
    name: 'Reformation',
    ecoRating: 'A',
    certifications: ['Climate Neutral', 'OEKO-TEX'],
    sustainablePractices: ['Deadstock fabrics', 'Carbon neutral shipping', 'RefScale transparency'],
    carbonFootprintScore: 85,
    ethicalLabor: true,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Trendy sustainable fashion with full carbon footprint transparency.',
  },
  {
    name: 'Veja',
    ecoRating: 'A',
    certifications: ['B Corp', 'Fair Trade'],
    sustainablePractices: ['Wild rubber', 'Organic cotton', 'Transparent supply chain'],
    carbonFootprintScore: 87,
    ethicalLabor: true,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Sustainable sneakers made with eco-friendly materials and fair trade practices.',
  },
  {
    name: 'People Tree',
    ecoRating: 'A',
    certifications: ['GOTS', 'Fair Trade', 'Soil Association'],
    sustainablePractices: ['Handcrafted', 'Organic cotton', 'Artisan partnerships'],
    carbonFootprintScore: 86,
    ethicalLabor: true,
    veganFriendly: false,
    recycledMaterials: false,
    description: 'Pioneer in fair trade and environmentally sustainable fashion.',
  },
  {
    name: 'Everlane',
    ecoRating: 'B',
    certifications: ['Bluesign'],
    sustainablePractices: ['Radical transparency', 'Recycled materials', 'Ethical factories'],
    carbonFootprintScore: 75,
    ethicalLabor: true,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Modern basics with transparent pricing and ethical manufacturing.',
  },
  {
    name: 'Allbirds',
    ecoRating: 'B',
    certifications: ['B Corp', 'Carbon Neutral'],
    sustainablePractices: ['Merino wool', 'Tree fibre', 'Carbon labelling'],
    carbonFootprintScore: 78,
    ethicalLabor: true,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Comfortable footwear made from natural, renewable materials.',
  },
  {
    name: 'H&M Conscious',
    ecoRating: 'C',
    certifications: ['Better Cotton Initiative'],
    sustainablePractices: ['Garment collecting', 'Organic cotton', 'Recycled materials'],
    carbonFootprintScore: 55,
    ethicalLabor: false,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Fast fashion giant with sustainability initiatives, but concerns remain.',
  },
  {
    name: 'Zara Join Life',
    ecoRating: 'C',
    certifications: ['OEKO-TEX'],
    sustainablePractices: ['Recycled materials', 'Eco-efficient stores'],
    carbonFootprintScore: 50,
    ethicalLabor: false,
    veganFriendly: false,
    recycledMaterials: true,
    description: 'Sustainability collection from fast fashion leader with room for improvement.',
  },
];

const SUSTAINABILITY_TIPS: SustainabilityTip[] = [
  {
    id: 'tip_1',
    title: 'Wash clothes in cold water',
    description: 'Washing in cold water saves up to 90% of the energy used per load and helps clothes last longer.',
    category: 'care',
    impactLevel: 'high',
  },
  {
    id: 'tip_2',
    title: 'Buy secondhand first',
    description: 'Check charity shops, vintage stores, and resale apps before buying new. Extend the life of existing garments.',
    category: 'shopping',
    impactLevel: 'high',
  },
  {
    id: 'tip_3',
    title: 'Invest in quality over quantity',
    description: 'Well-made pieces last years, not months. Cost per wear matters more than the initial price tag.',
    category: 'shopping',
    impactLevel: 'high',
  },
  {
    id: 'tip_4',
    title: 'Air dry when possible',
    description: 'Skip the tumble dryer to reduce energy use and prevent fabric damage from heat.',
    category: 'care',
    impactLevel: 'medium',
  },
  {
    id: 'tip_5',
    title: 'Repair before replacing',
    description: 'Learn basic mending or find a local tailor. A small repair can extend a garments life by years.',
    category: 'care',
    impactLevel: 'medium',
  },
  {
    id: 'tip_6',
    title: 'Donate or recycle old clothes',
    description: 'Never throw clothes in the bin. Donate wearable items or use textile recycling for damaged pieces.',
    category: 'disposal',
    impactLevel: 'high',
  },
  {
    id: 'tip_7',
    title: 'Check the fabric composition',
    description: 'Choose natural fibres like organic cotton, linen, or Tencel. Avoid synthetic blends that shed microplastics.',
    category: 'shopping',
    impactLevel: 'medium',
  },
  {
    id: 'tip_8',
    title: 'Build a capsule wardrobe',
    description: 'A curated collection of versatile pieces reduces impulse buying and ensures everything works together.',
    category: 'general',
    impactLevel: 'high',
  },
  {
    id: 'tip_9',
    title: 'Use a Guppyfriend bag',
    description: 'This mesh bag catches microplastics released from synthetic fabrics during washing.',
    category: 'care',
    impactLevel: 'low',
  },
  {
    id: 'tip_10',
    title: 'Host a clothes swap',
    description: 'Exchange unwanted items with friends for a refreshed wardrobe without environmental impact.',
    category: 'shopping',
    impactLevel: 'medium',
  },
];

const ECO_ALTERNATIVES: EcoAlternative[] = [
  {
    id: 'alt_1',
    originalItem: 'Cotton T-Shirt',
    alternativeItem: 'Organic Cotton Tee',
    brand: 'Patagonia',
    ecoRating: 'A+',
    price: 45,
    currencySymbol: '£',
    carbonSaved: 2.5,
    productUrl: 'https://patagonia.com',
  },
  {
    id: 'alt_2',
    originalItem: 'Leather Handbag',
    alternativeItem: 'Vegan Leather Tote',
    brand: 'Stella McCartney',
    ecoRating: 'A+',
    price: 695,
    currencySymbol: '£',
    carbonSaved: 15.0,
    productUrl: 'https://stellamccartney.com',
  },
  {
    id: 'alt_3',
    originalItem: 'Denim Jeans',
    alternativeItem: 'Recycled Denim Jeans',
    brand: 'Reformation',
    ecoRating: 'A',
    price: 128,
    currencySymbol: '£',
    carbonSaved: 8.0,
    productUrl: 'https://reformation.com',
  },
  {
    id: 'alt_4',
    originalItem: 'Running Trainers',
    alternativeItem: 'Sustainable Trainers',
    brand: 'Veja',
    ecoRating: 'A',
    price: 115,
    currencySymbol: '£',
    carbonSaved: 5.5,
    productUrl: 'https://veja-store.com',
  },
  {
    id: 'alt_5',
    originalItem: 'Wool Jumper',
    alternativeItem: 'Organic Merino Jumper',
    brand: 'Allbirds',
    ecoRating: 'B',
    price: 98,
    currencySymbol: '£',
    carbonSaved: 3.8,
    productUrl: 'https://allbirds.co.uk',
  },
  {
    id: 'alt_6',
    originalItem: 'Silk Blouse',
    alternativeItem: 'Peace Silk Blouse',
    brand: 'Eileen Fisher',
    ecoRating: 'A',
    price: 178,
    currencySymbol: '£',
    carbonSaved: 4.2,
    productUrl: 'https://eileenfisher.com',
  },
];

const DEFAULT_CARBON_DATA: CarbonFootprintData = {
  totalCarbon: 0,
  monthlyCarbon: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  carbonSaved: 0,
  treesEquivalent: 0,
  sustainablePurchases: 0,
  totalPurchases: 0,
  ecoScore: 50,
};

export function SustainabilityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [sustainablePurchases, setSustainablePurchases] = useState<SustainablePurchase[]>([]);
  const [carbonFootprint, setCarbonFootprint] = useState<CarbonFootprintData>(DEFAULT_CARBON_DATA);
  const [goals, setGoals] = useState<SustainabilityGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadData();
    } else {
      setSustainablePurchases([]);
      setCarbonFootprint(DEFAULT_CARBON_DATA);
      setGoals([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purchasesData, carbonData, goalsData] = await Promise.all([
        AsyncStorage.getItem(`${PURCHASES_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${CARBON_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${GOALS_STORAGE_KEY}_${user?.id}`),
      ]);

      if (purchasesData) {
        setSustainablePurchases(JSON.parse(purchasesData));
      }
      if (carbonData) {
        setCarbonFootprint(JSON.parse(carbonData));
      } else {
        setCarbonFootprint(DEFAULT_CARBON_DATA);
      }
      if (goalsData) {
        setGoals(JSON.parse(goalsData));
      }
    } catch (err) {
      console.error('Failed to load sustainability data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePurchases = async (purchases: SustainablePurchase[]) => {
    try {
      await AsyncStorage.setItem(
        `${PURCHASES_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(purchases)
      );
    } catch (err) {
      console.error('Failed to save purchases:', err);
    }
  };

  const saveCarbonFootprint = async (data: CarbonFootprintData) => {
    try {
      await AsyncStorage.setItem(
        `${CARBON_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(data)
      );
    } catch (err) {
      console.error('Failed to save carbon footprint:', err);
    }
  };

  const saveGoals = async (goalsList: SustainabilityGoal[]) => {
    try {
      await AsyncStorage.setItem(
        `${GOALS_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(goalsList)
      );
    } catch (err) {
      console.error('Failed to save goals:', err);
    }
  };

  const getBrandEcoRating = useCallback((brandName: string): BrandSustainabilityInfo => {
    const normalizedName = brandName.toLowerCase().trim();
    const found = SUSTAINABLE_BRANDS.find(
      b => b.name.toLowerCase() === normalizedName ||
           b.name.toLowerCase().includes(normalizedName) ||
           normalizedName.includes(b.name.toLowerCase())
    );
    
    if (found) return found;
    
    return {
      name: brandName,
      ecoRating: 'unknown',
      certifications: [],
      sustainablePractices: [],
      carbonFootprintScore: 0,
      ethicalLabor: false,
      veganFriendly: false,
      recycledMaterials: false,
      description: 'No sustainability data available for this brand. Consider researching their practices.',
    };
  }, []);

  const getEcoAlternatives = useCallback((itemCategory: string): EcoAlternative[] => {
    const normalizedCategory = itemCategory.toLowerCase();
    return ECO_ALTERNATIVES.filter(alt => 
      alt.originalItem.toLowerCase().includes(normalizedCategory) ||
      normalizedCategory.includes(alt.originalItem.toLowerCase().split(' ')[0])
    );
  }, []);

  const getSustainabilityTips = useCallback((): SustainabilityTip[] => {
    return [...SUSTAINABILITY_TIPS].sort(() => Math.random() - 0.5).slice(0, 5);
  }, []);

  const addSustainablePurchase = useCallback(async (purchase: Omit<SustainablePurchase, 'id'>) => {
    const newPurchase: SustainablePurchase = {
      ...purchase,
      id: `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    const updatedPurchases = [newPurchase, ...sustainablePurchases];
    setSustainablePurchases(updatedPurchases);
    await savePurchases(updatedPurchases);

    const currentMonth = new Date().getMonth();
    const newMonthlyCarbon = [...carbonFootprint.monthlyCarbon];
    newMonthlyCarbon[currentMonth] += purchase.carbonSaved;

    const newCarbonData: CarbonFootprintData = {
      ...carbonFootprint,
      carbonSaved: carbonFootprint.carbonSaved + purchase.carbonSaved,
      monthlyCarbon: newMonthlyCarbon,
      sustainablePurchases: carbonFootprint.sustainablePurchases + 1,
      totalPurchases: carbonFootprint.totalPurchases + 1,
      treesEquivalent: Math.round((carbonFootprint.carbonSaved + purchase.carbonSaved) / 21),
      ecoScore: Math.min(100, carbonFootprint.ecoScore + 2),
    };

    setCarbonFootprint(newCarbonData);
    await saveCarbonFootprint(newCarbonData);
  }, [sustainablePurchases, carbonFootprint, user?.id]);

  const removeSustainablePurchase = useCallback(async (purchaseId: string) => {
    const purchase = sustainablePurchases.find(p => p.id === purchaseId);
    if (!purchase) return;

    const updatedPurchases = sustainablePurchases.filter(p => p.id !== purchaseId);
    setSustainablePurchases(updatedPurchases);
    await savePurchases(updatedPurchases);

    const purchaseDate = new Date(purchase.purchaseDate);
    const monthIndex = purchaseDate.getMonth();
    const newMonthlyCarbon = [...carbonFootprint.monthlyCarbon];
    newMonthlyCarbon[monthIndex] = Math.max(0, newMonthlyCarbon[monthIndex] - purchase.carbonSaved);

    const newCarbonData: CarbonFootprintData = {
      ...carbonFootprint,
      carbonSaved: Math.max(0, carbonFootprint.carbonSaved - purchase.carbonSaved),
      monthlyCarbon: newMonthlyCarbon,
      sustainablePurchases: Math.max(0, carbonFootprint.sustainablePurchases - 1),
      treesEquivalent: Math.round(Math.max(0, carbonFootprint.carbonSaved - purchase.carbonSaved) / 21),
      ecoScore: Math.max(0, carbonFootprint.ecoScore - 2),
    };

    setCarbonFootprint(newCarbonData);
    await saveCarbonFootprint(newCarbonData);
  }, [sustainablePurchases, carbonFootprint, user?.id]);

  const addGoal = useCallback(async (goal: Omit<SustainabilityGoal, 'id' | 'createdAt' | 'isCompleted' | 'currentValue'>) => {
    const newGoal: SustainabilityGoal = {
      ...goal,
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      currentValue: 0,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    const updatedGoals = [newGoal, ...goals];
    setGoals(updatedGoals);
    await saveGoals(updatedGoals);
  }, [goals, user?.id]);

  const updateGoalProgress = useCallback(async (goalId: string, value: number) => {
    const updatedGoals = goals.map(goal => {
      if (goal.id === goalId) {
        const newValue = Math.min(goal.targetValue, goal.currentValue + value);
        return {
          ...goal,
          currentValue: newValue,
          isCompleted: newValue >= goal.targetValue,
        };
      }
      return goal;
    });

    setGoals(updatedGoals);
    await saveGoals(updatedGoals);
  }, [goals, user?.id]);

  const removeGoal = useCallback(async (goalId: string) => {
    const updatedGoals = goals.filter(g => g.id !== goalId);
    setGoals(updatedGoals);
    await saveGoals(updatedGoals);
  }, [goals, user?.id]);

  const getCarbonFootprintByMonth = useCallback((monthIndex: number): number => {
    return carbonFootprint.monthlyCarbon[monthIndex] || 0;
  }, [carbonFootprint]);

  const getEcoScoreBreakdown = useCallback((): { label: string; value: number; color: string }[] => {
    const sustainableRatio = carbonFootprint.totalPurchases > 0 
      ? (carbonFootprint.sustainablePurchases / carbonFootprint.totalPurchases) * 100 
      : 0;
    
    return [
      { label: 'Sustainable Purchases', value: Math.round(sustainableRatio), color: '#00B894' },
      { label: 'Carbon Saved', value: Math.min(100, Math.round(carbonFootprint.carbonSaved / 10)), color: '#0077B6' },
      { label: 'Goals Progress', value: goals.length > 0 ? Math.round((goals.filter(g => g.isCompleted).length / goals.length) * 100) : 0, color: '#9B7EBD' },
      { label: 'Brand Awareness', value: Math.min(100, sustainablePurchases.length * 10), color: '#C87941' },
    ];
  }, [carbonFootprint, goals, sustainablePurchases]);

  const getTopSustainableBrands = useCallback((): BrandSustainabilityInfo[] => {
    return SUSTAINABLE_BRANDS
      .filter(b => b.ecoRating === 'A+' || b.ecoRating === 'A')
      .sort((a, b) => b.carbonFootprintScore - a.carbonFootprintScore);
  }, []);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [user?.id]);

  return (
    <SustainabilityContext.Provider
      value={{
        sustainablePurchases,
        carbonFootprint,
        goals,
        isLoading,
        getBrandEcoRating,
        getEcoAlternatives,
        getSustainabilityTips,
        addSustainablePurchase,
        removeSustainablePurchase,
        addGoal,
        updateGoalProgress,
        removeGoal,
        getCarbonFootprintByMonth,
        getEcoScoreBreakdown,
        getTopSustainableBrands,
        refreshData,
      }}
    >
      {children}
    </SustainabilityContext.Provider>
  );
}

export function useSustainability() {
  const context = useContext(SustainabilityContext);
  if (!context) {
    throw new Error('useSustainability must be used within a SustainabilityProvider');
  }
  return context;
}

export function getEcoRatingColor(rating: EcoRating): string {
  switch (rating) {
    case 'A+':
      return '#00B894';
    case 'A':
      return '#00D9A5';
    case 'B':
      return '#0077B6';
    case 'C':
      return '#C87941';
    case 'D':
      return '#E09860';
    case 'F':
      return '#C94C5A';
    default:
      return '#9BA1A6';
  }
}

export function getEcoRatingLabel(rating: EcoRating): string {
  switch (rating) {
    case 'A+':
      return 'Excellent';
    case 'A':
      return 'Very Good';
    case 'B':
      return 'Good';
    case 'C':
      return 'Average';
    case 'D':
      return 'Below Average';
    case 'F':
      return 'Poor';
    default:
      return 'Unknown';
  }
}

export { SUSTAINABLE_BRANDS, SUSTAINABILITY_TIPS, ECO_ALTERNATIVES };
