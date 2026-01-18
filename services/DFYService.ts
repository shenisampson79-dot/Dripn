import AsyncStorage from '@react-native-async-storage/async-storage';
import { StylistId } from '@/contexts/AuthContext';

export type DFYTier = 'lite' | 'core';
export type DFYOccasion = 'work' | 'holiday' | 'event' | 'casual' | 'browsing';

export interface ColdOpenFlow {
  occasion: DFYOccasion;
  struggleText?: string;
  timestamp: string;
}

export interface DFYOutfit {
  id: string;
  dayNumber: number;
  title: string;
  description: string;
  imageUri?: string;
  items: DFYOutfitItem[];
  occasion: DFYOccasion;
  stylistNote: string;
  stylistId: StylistId;
  userReaction?: 'love' | 'not-me' | null;
  adjustmentRequest?: string;
  saved: boolean;
}

export interface DFYOutfitItem {
  id: string;
  name: string;
  category: string;
  color: string;
  imageUri?: string;
}

export interface DFYLiteDelivery {
  userId: string;
  tier: 'lite';
  startDate: string;
  expiryDate: string;
  totalDays: 14;
  outfits: DFYOutfit[];
  currentDay: number;
  completed: boolean;
  nudgesShown: number[];
}

export interface DFYCoreDelivery {
  userId: string;
  tier: 'core';
  startDate: string;
  expiryDate: string;
  totalDays: 30;
  wardrobeItems: DFYOutfitItem[];
  outfits: DFYOutfit[];
  currentDay: number;
  completed: boolean;
  nudgesShown: number[];
}

export type DFYDelivery = DFYLiteDelivery | DFYCoreDelivery;

export interface DFYExpiryFlow {
  tier: DFYTier;
  daysRemaining: number;
  showNudgeBanner: boolean;
  nudgeType: 'day12' | 'day25' | 'expired' | null;
  whatStays: string[];
  whatStops: string[];
}

export interface DFYObjectionResponse {
  id: string;
  objection: string;
  stylistId: StylistId;
  response: string;
  category: 'price' | 'value' | 'time' | 'trust' | 'comparison';
}

export interface DFYComparisonTier {
  id: DFYTier;
  name: string;
  tagline: string;
  price: string;
  mentalModel: 'tactical' | 'structural';
  description: string;
  features: { text: string; included: boolean }[];
  deliveryDays: number;
  itemLimit: number | null;
  outfitCount: number;
  photoType: 'outfit' | 'individual';
  editAccess: boolean;
}

export interface DFYAccessStatus {
  hasAccess: boolean;
  tier: DFYTier | null;
  daysRemaining: number;
  startDate: string | null;
  expiryDate: string | null;
  showNudge: boolean;
  nudgeType: 'day12' | 'day25' | 'expired' | null;
}

export interface UpgradePathTrigger {
  featureRequested: string;
  requiredTier: DFYTier;
  stylistId: StylistId;
  message: string;
}

const DFY_ACCESS_KEY = '@dripn_dfy_access';
const DFY_DELIVERY_KEY = '@dripn_dfy_delivery';
const COLD_OPEN_KEY = '@dripn_cold_open';

const OBJECTION_RESPONSES: DFYObjectionResponse[] = [
  {
    id: 'price-1',
    objection: "It's too expensive",
    stylistId: 'ruby',
    response: "I totally get that, darling. But think about it - how much time do you spend every morning staring at your wardrobe? That's worth something. Lite gives you 14 days of 'just grab and go' for less than a fancy coffee a day.",
    category: 'price',
  },
  {
    id: 'price-2',
    objection: "It's too expensive",
    stylistId: 'max',
    response: "Fair point. Here's how I see it though - you're not just paying for outfit picks. You're buying back decision fatigue. Core is an investment in your daily confidence.",
    category: 'price',
  },
  {
    id: 'value-1',
    objection: "I can do this myself",
    stylistId: 'ruby',
    response: "Of course you can, love! But the question is - are you? If picking outfits was easy for you, you wouldn't be here. Let me take that mental load off you.",
    category: 'value',
  },
  {
    id: 'value-2',
    objection: "I can do this myself",
    stylistId: 'max',
    response: "No doubt. But there's a difference between 'can' and 'doing it efficiently'. I'm here to eliminate the friction, not replace your taste.",
    category: 'value',
  },
  {
    id: 'time-1',
    objection: "I don't have time to take photos",
    stylistId: 'ruby',
    response: "That's exactly why Lite exists, hun! Just snap your whole outfit in one go - literally 30 seconds. No need to photograph every piece individually.",
    category: 'time',
  },
  {
    id: 'time-2',
    objection: "I don't have time to take photos",
    stylistId: 'max',
    response: "Got it. Lite's designed for that - one outfit photo, done. Core is for when you've got a bit more time and want the full wardrobe breakdown.",
    category: 'time',
  },
  {
    id: 'trust-1',
    objection: "How do I know you'll get my style?",
    stylistId: 'ruby',
    response: "Great question, darling! That's what the cold open is for - tell me what you're getting dressed for, any struggles, and I'll prove myself with your first day's outfit. No commitment until you see the magic.",
    category: 'trust',
  },
  {
    id: 'trust-2',
    objection: "How do I know you'll get my style?",
    stylistId: 'max',
    response: "Valid concern. We start with understanding your occasions and challenges. Each outfit comes with my reasoning so you can see I actually get you. The feedback loop helps me dial in even more.",
    category: 'trust',
  },
  {
    id: 'comparison-1',
    objection: "What's the difference between Lite and Core?",
    stylistId: 'ruby',
    response: "Lite is your quick fix - 14 days of ready-to-wear outfits from photos you already have. Core is the full glow-up - I digitize your whole wardrobe and create a 30-day capsule with unlimited remix potential.",
    category: 'comparison',
  },
  {
    id: 'comparison-2',
    objection: "What's the difference between Lite and Core?",
    stylistId: 'max',
    response: "Lite = tactical. Quick wins for 2 weeks. Core = structural. Your entire wardrobe mapped and optimized for a month. Think of it as renting vs owning your style system.",
    category: 'comparison',
  },
];

const COMPARISON_TIERS: DFYComparisonTier[] = [
  {
    id: 'lite',
    name: 'Lite',
    tagline: 'Quick style wins',
    price: '£19',
    mentalModel: 'tactical',
    description: '14 days of ready-to-wear outfits from your existing wardrobe photos',
    features: [
      { text: '14-day style plan', included: true },
      { text: '5-7 curated outfits', included: true },
      { text: 'Outfit photo upload', included: true },
      { text: 'Love/Not me/Adjust actions', included: true },
      { text: 'Stylist personality matching', included: true },
      { text: 'Individual item editing', included: false },
      { text: 'Wardrobe digitization', included: false },
      { text: 'Unlimited remixes', included: false },
    ],
    deliveryDays: 14,
    itemLimit: null,
    outfitCount: 7,
    photoType: 'outfit',
    editAccess: false,
  },
  {
    id: 'core',
    name: 'Core',
    tagline: 'Full wardrobe transformation',
    price: '£39.99',
    mentalModel: 'structural',
    description: 'Complete wardrobe digitization with 30-day personalized style system',
    features: [
      { text: '30-day style plan', included: true },
      { text: 'Up to 30 wardrobe items', included: true },
      { text: 'Individual item photography', included: true },
      { text: 'AI-powered item analysis', included: true },
      { text: 'Color & style matching', included: true },
      { text: 'Swap & remix any piece', included: true },
      { text: 'Full wardrobe digitization', included: true },
      { text: 'Unlimited outfit variations', included: true },
    ],
    deliveryDays: 30,
    itemLimit: 30,
    outfitCount: 15,
    photoType: 'individual',
    editAccess: true,
  },
];

const LITE_WHAT_STAYS = [
  'Your 14-day outfit history',
  'Saved outfits you loved',
  'Style notes and learnings',
  'Ability to purchase Core anytime',
];

const LITE_WHAT_STOPS = [
  'Daily outfit recommendations',
  'Stylist adjustments',
  'New outfit suggestions',
];

const CORE_WHAT_STAYS = [
  'Your digitized wardrobe',
  'All outfit history',
  'Style DNA analysis',
  'Saved outfits and favorites',
];

const CORE_WHAT_STOPS = [
  'New outfit recommendations',
  'Stylist remix suggestions',
  'Priority support',
];

const UPGRADE_TRIGGERS: Record<string, UpgradePathTrigger> = {
  swap_item: {
    featureRequested: 'Swap this item',
    requiredTier: 'core',
    stylistId: 'ruby',
    message: "Love that you want to remix! Swapping individual items is a Core feature - it needs your whole wardrobe mapped. Want me to tell you more?",
  },
  edit_outfit: {
    featureRequested: 'Edit this outfit',
    requiredTier: 'core',
    stylistId: 'max',
    message: "Editing requires individual item data. With Core, I can break down every piece and rebuild outfits your way. Interested?",
  },
  add_item: {
    featureRequested: 'Add new item',
    requiredTier: 'core',
    stylistId: 'ruby',
    message: "Adding items to your digital wardrobe is part of the Core experience. It's where the real magic happens, darling!",
  },
  remix: {
    featureRequested: 'Create remix',
    requiredTier: 'core',
    stylistId: 'max',
    message: "Remixes need your full wardrobe in the system. Core gives you unlimited combinations from all your pieces.",
  },
};

class DFYService {
  async saveColdOpenFlow(flow: ColdOpenFlow): Promise<void> {
    try {
      await AsyncStorage.setItem(COLD_OPEN_KEY, JSON.stringify(flow));
    } catch (error) {
      console.error('Error saving cold open flow:', error);
    }
  }

  async getColdOpenFlow(): Promise<ColdOpenFlow | null> {
    try {
      const data = await AsyncStorage.getItem(COLD_OPEN_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cold open flow:', error);
      return null;
    }
  }

  async checkDFYAccess(userId: string): Promise<DFYAccessStatus> {
    try {
      const accessData = await AsyncStorage.getItem(`${DFY_ACCESS_KEY}_${userId}`);
      if (!accessData) {
        return {
          hasAccess: false,
          tier: null,
          daysRemaining: 0,
          startDate: null,
          expiryDate: null,
          showNudge: false,
          nudgeType: null,
        };
      }

      const access = JSON.parse(accessData);
      const now = new Date();
      const expiry = new Date(access.expiryDate);
      const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      let nudgeType: 'day12' | 'day25' | 'expired' | null = null;
      let showNudge = false;

      if (access.tier === 'lite') {
        if (daysRemaining === 0) {
          nudgeType = 'expired';
          showNudge = true;
        } else if (daysRemaining <= 2) {
          nudgeType = 'day12';
          showNudge = true;
        }
      } else if (access.tier === 'core') {
        if (daysRemaining === 0) {
          nudgeType = 'expired';
          showNudge = true;
        } else if (daysRemaining <= 5) {
          nudgeType = 'day25';
          showNudge = true;
        }
      }

      return {
        hasAccess: daysRemaining > 0,
        tier: access.tier,
        daysRemaining,
        startDate: access.startDate,
        expiryDate: access.expiryDate,
        showNudge,
        nudgeType,
      };
    } catch (error) {
      console.error('Error checking DFY access:', error);
      return {
        hasAccess: false,
        tier: null,
        daysRemaining: 0,
        startDate: null,
        expiryDate: null,
        showNudge: false,
        nudgeType: null,
      };
    }
  }

  async activateDFYAccess(userId: string, tier: DFYTier): Promise<void> {
    const startDate = new Date().toISOString();
    const days = tier === 'lite' ? 14 : 30;
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await AsyncStorage.setItem(`${DFY_ACCESS_KEY}_${userId}`, JSON.stringify({
      tier,
      startDate,
      expiryDate,
    }));
  }

  async getDFYDelivery(userId: string): Promise<DFYDelivery | null> {
    try {
      const data = await AsyncStorage.getItem(`${DFY_DELIVERY_KEY}_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting DFY delivery:', error);
      return null;
    }
  }

  async saveDFYDelivery(delivery: DFYDelivery): Promise<void> {
    try {
      await AsyncStorage.setItem(`${DFY_DELIVERY_KEY}_${delivery.userId}`, JSON.stringify(delivery));
    } catch (error) {
      console.error('Error saving DFY delivery:', error);
    }
  }

  async updateOutfitReaction(
    userId: string, 
    outfitId: string, 
    reaction: 'love' | 'not-me' | null,
    adjustmentRequest?: string
  ): Promise<void> {
    const delivery = await this.getDFYDelivery(userId);
    if (!delivery) return;

    const outfitIndex = delivery.outfits.findIndex(o => o.id === outfitId);
    if (outfitIndex === -1) return;

    delivery.outfits[outfitIndex].userReaction = reaction;
    if (adjustmentRequest) {
      delivery.outfits[outfitIndex].adjustmentRequest = adjustmentRequest;
    }

    await this.saveDFYDelivery(delivery);
  }

  async toggleOutfitSaved(userId: string, outfitId: string): Promise<void> {
    const delivery = await this.getDFYDelivery(userId);
    if (!delivery) return;

    const outfitIndex = delivery.outfits.findIndex(o => o.id === outfitId);
    if (outfitIndex === -1) return;

    delivery.outfits[outfitIndex].saved = !delivery.outfits[outfitIndex].saved;
    await this.saveDFYDelivery(delivery);
  }

  getComparisonTiers(): DFYComparisonTier[] {
    return COMPARISON_TIERS;
  }

  getObjectionResponses(stylistId: StylistId, category?: string): DFYObjectionResponse[] {
    let responses = OBJECTION_RESPONSES.filter(r => r.stylistId === stylistId);
    if (category) {
      responses = responses.filter(r => r.category === category);
    }
    return responses;
  }

  getAllObjectionResponses(): DFYObjectionResponse[] {
    return OBJECTION_RESPONSES;
  }

  getExpiryFlow(tier: DFYTier, daysRemaining: number): DFYExpiryFlow {
    let nudgeType: 'day12' | 'day25' | 'expired' | null = null;
    let showNudgeBanner = false;

    if (tier === 'lite') {
      if (daysRemaining === 0) {
        nudgeType = 'expired';
        showNudgeBanner = true;
      } else if (daysRemaining <= 2) {
        nudgeType = 'day12';
        showNudgeBanner = true;
      }
    } else {
      if (daysRemaining === 0) {
        nudgeType = 'expired';
        showNudgeBanner = true;
      } else if (daysRemaining <= 5) {
        nudgeType = 'day25';
        showNudgeBanner = true;
      }
    }

    return {
      tier,
      daysRemaining,
      showNudgeBanner,
      nudgeType,
      whatStays: tier === 'lite' ? LITE_WHAT_STAYS : CORE_WHAT_STAYS,
      whatStops: tier === 'lite' ? LITE_WHAT_STOPS : CORE_WHAT_STOPS,
    };
  }

  getUpgradeTrigger(featureKey: string, stylistId: StylistId): UpgradePathTrigger | null {
    const trigger = UPGRADE_TRIGGERS[featureKey];
    if (!trigger) return null;

    return {
      ...trigger,
      stylistId,
      message: UPGRADE_TRIGGERS[featureKey].message,
    };
  }

  canEditOutfit(tier: DFYTier | null): boolean {
    return tier === 'core';
  }

  canSwapItem(tier: DFYTier | null): boolean {
    return tier === 'core';
  }

  canRemixOutfit(tier: DFYTier | null): boolean {
    return tier === 'core';
  }

  getPhotoUploadGuidance(tier: DFYTier): { type: 'outfit' | 'individual'; description: string } {
    if (tier === 'lite') {
      return {
        type: 'outfit',
        description: 'Take photos of complete outfits. One photo per look is perfect!',
      };
    }
    return {
      type: 'individual',
      description: 'Photograph each item individually for best results. Flat lay or hanger shots work great.',
    };
  }

  async createMockLiteDelivery(userId: string, stylistId: StylistId): Promise<DFYLiteDelivery> {
    const startDate = new Date().toISOString();
    const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const mockOutfits: DFYOutfit[] = Array.from({ length: 7 }, (_, i) => ({
      id: `outfit-${i + 1}`,
      dayNumber: (i * 2) + 1,
      title: `Day ${(i * 2) + 1} Look`,
      description: `A curated outfit for your ${['work', 'casual', 'event', 'casual', 'work', 'holiday', 'event'][i]} occasion`,
      items: [],
      occasion: ['work', 'casual', 'event', 'casual', 'work', 'holiday', 'event'][i] as DFYOccasion,
      stylistNote: `This look brings out your best features while keeping you comfortable for the day ahead.`,
      stylistId,
      userReaction: null,
      saved: false,
    }));

    const delivery: DFYLiteDelivery = {
      userId,
      tier: 'lite',
      startDate,
      expiryDate,
      totalDays: 14,
      outfits: mockOutfits,
      currentDay: 1,
      completed: false,
      nudgesShown: [],
    };

    await this.saveDFYDelivery(delivery);
    await this.activateDFYAccess(userId, 'lite');

    return delivery;
  }
}

export const dfyService = new DFYService();
export default dfyService;
