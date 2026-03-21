import AsyncStorage from '@react-native-async-storage/async-storage';
import { StylistId } from '@/contexts/AuthContext';

export type { StylistId };

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
  stylistNote?: string;
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
    id: 'repeat-1',
    objection: "Why do outfits repeat items?",
    stylistId: 'ruby',
    response: "Because I styled a capsule for one moment - not your whole wardrobe. That's the magic of a tight capsule, darling!",
    category: 'value',
  },
  {
    id: 'repeat-2',
    objection: "Why do outfits repeat items?",
    stylistId: 'max',
    response: "Because I styled a capsule for one moment - not your whole wardrobe. Smart repetition is intentional, not lazy.",
    category: 'value',
  },
  {
    id: 'edit-1',
    objection: "Why can't I edit outfits myself?",
    stylistId: 'ruby',
    response: "Because I took responsibility for the decisions, love. If you want control, we should build your wardrobe properly with Core.",
    category: 'value',
  },
  {
    id: 'edit-2',
    objection: "Why can't I edit outfits myself?",
    stylistId: 'max',
    response: "Because I took responsibility for the decisions. If you want control, we should build your wardrobe properly.",
    category: 'value',
  },
  {
    id: 'expiry-1',
    objection: "Why does styling stop after 14 days?",
    stylistId: 'ruby',
    response: "Because this setup solved one situation, hun. Ongoing styling is an active service - your wardrobe is saved whenever you're ready!",
    category: 'time',
  },
  {
    id: 'expiry-2',
    objection: "Why does styling stop after 14 days?",
    stylistId: 'max',
    response: "Because this setup solved one situation. Ongoing styling is an active service.",
    category: 'time',
  },
  {
    id: 'subscribe-1',
    objection: "Why should I subscribe if my wardrobe is saved?",
    stylistId: 'ruby',
    response: "Saving is passive, darling. Styling is active. Your wardrobe is ready - keep me thinking!",
    category: 'comparison',
  },
  {
    id: 'subscribe-2',
    objection: "Why should I subscribe if my wardrobe is saved?",
    stylistId: 'max',
    response: "Saving is passive. Styling is active. Your wardrobe is ready. Keep me thinking.",
    category: 'comparison',
  },
  {
    id: 'lite-again-1',
    objection: "Can I just keep doing Lite?",
    stylistId: 'ruby',
    response: "You can - but I'll keep guessing instead of learning, love. Lite solves now. Core solves every time after.",
    category: 'comparison',
  },
  {
    id: 'lite-again-2',
    objection: "Can I just keep doing Lite?",
    stylistId: 'max',
    response: "You can - but you'll keep paying to solve the same problem again. Lite solves now. Core solves every time after.",
    category: 'comparison',
  },
];

const COMPARISON_TIERS: DFYComparisonTier[] = [
  {
    id: 'lite',
    name: 'Outfit-Based Setup',
    tagline: 'Ready-to-wear looks for a trip or event (14 days).',
    price: '£19.99',
    mentalModel: 'tactical',
    description: 'Perfect for a holiday, weekend trip, or special event. I\'ll create 5-7 complete, ready-to-wear looks you can wear immediately. You have 14 days to use them—after that, the styling ends. No wardrobe building, no long-term commitment.',
    features: [
      { text: '5-7 complete, ready-to-wear outfits', included: true },
      { text: 'Styled for one occasion (work, holiday, event)', included: true },
      { text: '14-day access window only', included: true },
      { text: 'Stylist adjustments during window', included: true },
      { text: 'Save outfits as reference cards', included: true },
      { text: 'Build your wardrobe system', included: false },
      { text: 'Edit or customize individual items', included: false },
      { text: 'Generate unlimited outfit combinations', included: false },
    ],
    deliveryDays: 14,
    itemLimit: null,
    outfitCount: 5,
    photoType: 'outfit',
    editAccess: false,
  },
  {
    id: 'core',
    name: 'Core Wardrobe Setup',
    tagline: 'Build a system that generates unlimited outfits (keep forever).',
    price: '£39.99',
    mentalModel: 'structural',
    description: 'Build a dynamic wardrobe system that works for you forever. I\'ll organize your 30 items properly, then generate unlimited outfit combinations from them. You get 30 days of active styling, but your wardrobe stays saved forever. Edit, swap, and remix pieces endlessly—no more repeating the same looks.',
    features: [
      { text: 'Organize up to 30 individual items', included: true },
      { text: 'Proper categorization & tagging', included: true },
      { text: 'Your wardrobe saved forever', included: true },
      { text: '30 days of active styling & learning', included: true },
      { text: 'Generate unlimited outfit combinations', included: true },
      { text: 'Swap & remix any piece freely', included: true },
      { text: 'Endless variety from fewer items', included: true },
      { text: 'Plan for seasons & occasions', included: true },
    ],
    deliveryDays: 30,
    itemLimit: 30,
    outfitCount: 15,
    photoType: 'individual',
    editAccess: true,
  },
];

const LITE_WHAT_STAYS = [
  'Saved outfits (view-only)',
  'Style learnings from this plan',
  'Ability to upgrade to Core anytime',
];

const LITE_WHAT_STOPS = [
  'New outfits',
  'Adjustments',
  'Rotations',
];

const CORE_WHAT_STAYS = [
  'Your digitised wardrobe (forever)',
  'All saved outfits',
  'Item categorisation',
];

const CORE_WHAT_STOPS = [
  'New outfit recommendations',
  'Dynamic remixing',
  'Proactive suggestions',
];

const UPGRADE_TRIGGERS: Record<string, UpgradePathTrigger> = {
  swap_item: {
    featureRequested: 'Swap this item',
    requiredTier: 'core',
    stylistId: 'ruby',
    message: "I can do that properly if I learn your wardrobe once. Want to build it?",
  },
  edit_outfit: {
    featureRequested: 'Edit this outfit',
    requiredTier: 'core',
    stylistId: 'max',
    message: "I can get much better if I learn everything you own - once.",
  },
  add_item: {
    featureRequested: 'Add new item',
    requiredTier: 'core',
    stylistId: 'ruby',
    message: "That would change the job I'm doing. Core is where I learn everything you own.",
  },
  remix: {
    featureRequested: 'Create remix',
    requiredTier: 'core',
    stylistId: 'max',
    message: "I've been reusing the same pieces because I only styled a capsule. Want me to learn your full wardrobe?",
  },
  more_variety: {
    featureRequested: 'More variety',
    requiredTier: 'core',
    stylistId: 'ruby',
    message: "I've been reusing the same pieces because I only styled a capsule. Build your wardrobe once and I'll stop guessing.",
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

  async getDFYAccessStatus(userId: string): Promise<DFYAccessStatus> {
    return this.checkDFYAccess(userId);
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

  async clearDFYAccess(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${DFY_ACCESS_KEY}_${userId}`);
    } catch (error) {
      console.error('Error clearing DFY access:', error);
    }
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

    // Note: Stylist analysis is generated server-side and will be populated via API
    // Do not use hardcoded dummy comments to avoid misleading users about AI analysis
    const mockOutfits: DFYOutfit[] = Array.from({ length: 14 }, (_, i) => ({
      id: `outfit-${i + 1}`,
      dayNumber: i + 1,
      title: i === 0 ? "Today's Look" : `Day ${i + 1} Look`,
      description: `A curated outfit rotated for your 14-day plan`,
      items: [],
      occasion: 'work' as DFYOccasion,
      stylistNote: undefined, // Real AI analysis will be generated server-side
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

  getDayNudgeCopy(nudgeType: 'day12' | 'day25' | 'expired', tier: DFYTier): { headline: string; subtext: string; cta: string } {
    if (nudgeType === 'day12') {
      return {
        headline: "I've been reusing the same pieces because I only styled a capsule.",
        subtext: "Build your wardrobe once and I'll stop guessing.",
        cta: "Build my wardrobe",
      };
    }
    if (nudgeType === 'day25') {
      return {
        headline: "I'll pause soon unless you keep me active.",
        subtext: "Your wardrobe is saved. Subscription keeps your stylist thinking.",
        cta: "Keep my stylist active",
      };
    }
    return {
      headline: tier === 'lite' ? "Your style plan is complete" : "Your styling window has ended",
      subtext: tier === 'lite' 
        ? "I solved this moment. If you want me long-term, I need context."
        : "Your wardrobe is saved. Keep your stylist thinking.",
      cta: tier === 'lite' ? "Build my wardrobe" : "Subscribe",
    };
  }
}

export const dfyService = new DFYService();
export default dfyService;
