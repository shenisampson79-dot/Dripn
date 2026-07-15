import AsyncStorage from '@react-native-async-storage/async-storage';
import { StylistId } from '@/contexts/AuthContext';
import { apiService } from '@/services/ApiService';
import {
  getDfyBenefitForSubscription,
  getIncludedStylingWindowDays,
  isDfyTierAllowedForSubscription,
} from '@/utils/dfyEntitlements';

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
  weatherNote?: string;
  stylistId: StylistId;
  userReaction?: 'love' | 'not-me' | null;
  adjustmentRequest?: string;
  saved: boolean;
}

export type SavedLookbookOutfitReason = 'bookmark' | 'love' | 'both';

export interface SavedLookbookOutfit extends DFYOutfit {
  savedReason: SavedLookbookOutfitReason;
}

export interface DFYOutfitItem {
  id: string;
  name: string;
  category: string;
  color: string;
  imageUri?: string;
  imageUrl?: string | null;
  processedImageUrl?: string | null;
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
  windowDays: number;
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
const DFY_ACTIVATIONS_KEY = '@dripn_dfy_activations';
const COLD_OPEN_KEY = '@dripn_cold_open';

export type DfyActivationBlockCode = 'no_benefit' | 'active_window' | 'included_used';

export interface DfyActivationRecord {
  periodKey: string;
  tier: DFYTier;
  activatedAt: string;
  source: 'subscription_included' | 'paid_purchase';
}

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
    id: 'core',
    name: 'Full Wardrobe Setup',
    tagline: 'Less stress — know what to wear every day.',
    price: '£39.99',
    mentalModel: 'structural',
    description: 'I organise your closet so you dress with confidence and save time every morning.',
    features: [
      { text: 'Look put-together — up to 30 pieces styled for you', included: true },
      { text: '30 days of outfit inspiration', included: true },
      { text: 'Your wardrobe, saved and ready anytime', included: true },
      { text: 'Swap, remix & plan ahead with ease', included: true },
    ],
    deliveryDays: 30,
    itemLimit: 30,
    outfitCount: 30,
    photoType: 'individual',
    editAccess: true,
  },
  {
    id: 'lite',
    name: 'Occasion Ready',
    tagline: 'Feel confident for your next occasion.',
    price: '£19.99',
    mentalModel: 'tactical',
    description: 'Ready-to-wear looks for a trip, event, or busy week — no closet overhaul needed.',
    features: [
      { text: "14 days of styled looks you'll actually wear", included: true },
      { text: 'One moment solved — work, holiday, or event', included: true },
      { text: 'Tweaks included while your window is open', included: true },
      { text: 'Save looks to revisit anytime', included: true },
      { text: 'Build your wardrobe system', included: false },
      { text: 'Edit or customize individual items', included: false },
    ],
    deliveryDays: 14,
    itemLimit: null,
    outfitCount: 14,
    photoType: 'outfit',
    editAccess: false,
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

  async getDFYAccessStatus(
    userId: string,
    subscriptionTier?: string | null,
  ): Promise<DFYAccessStatus> {
    return this.checkDFYAccess(userId, subscriptionTier);
  }

  private inferWindowDaysFromDates(
    startDate: string,
    expiryDate: string,
    tier: DFYTier,
  ): number {
    const start = new Date(startDate);
    const expiry = new Date(expiryDate);
    const days = Math.round((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : (tier === 'lite' ? 14 : 30);
  }

  private async maybeMigrateIncludedWindow(
    userId: string,
    access: { tier: DFYTier; startDate: string; expiryDate: string; windowDays?: number },
    subscriptionTier?: string | null,
  ): Promise<{ tier: DFYTier; startDate: string; expiryDate: string; windowDays: number }> {
    const included = await this.getIncludedActivation(userId);
    if (!included || included.source !== 'subscription_included' || !access.startDate) {
      const windowDays =
        access.windowDays ?? this.inferWindowDaysFromDates(access.startDate, access.expiryDate, access.tier);
      return { ...access, windowDays };
    }

    const expectedWindowDays = getIncludedStylingWindowDays(subscriptionTier, access.tier);
    const currentWindowDays =
      access.windowDays ?? this.inferWindowDaysFromDates(access.startDate, access.expiryDate, access.tier);

    if (currentWindowDays >= expectedWindowDays) {
      return { ...access, windowDays: currentWindowDays };
    }

    const start = new Date(access.startDate);
    const newExpiryDate = new Date(
      start.getTime() + expectedWindowDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const migrated = {
      tier: access.tier,
      startDate: access.startDate,
      expiryDate: newExpiryDate,
      windowDays: expectedWindowDays,
    };

    await AsyncStorage.setItem(`${DFY_ACCESS_KEY}_${userId}`, JSON.stringify(migrated));

    const delivery = await this.getDFYDelivery(userId);
    if (delivery && delivery.tier === access.tier) {
      if (delivery.tier === 'lite') {
        await this.saveDFYDelivery({
          ...delivery,
          expiryDate: newExpiryDate,
          totalDays: expectedWindowDays,
        } as DFYLiteDelivery);
      } else {
        await this.saveDFYDelivery({
          ...delivery,
          expiryDate: newExpiryDate,
          totalDays: expectedWindowDays,
        } as DFYCoreDelivery);
      }
    }

    return migrated;
  }

  async checkDFYAccess(
    userId: string,
    subscriptionTier?: string | null,
  ): Promise<DFYAccessStatus> {
    try {
      const accessData = await AsyncStorage.getItem(`${DFY_ACCESS_KEY}_${userId}`);
      if (!accessData) {
        return {
          hasAccess: false,
          tier: null,
          daysRemaining: 0,
          windowDays: 0,
          startDate: null,
          expiryDate: null,
          showNudge: false,
          nudgeType: null,
        };
      }

      const storedAccess = JSON.parse(accessData);
      const access = await this.maybeMigrateIncludedWindow(userId, storedAccess, subscriptionTier);
      const now = new Date();
      const expiry = new Date(access.expiryDate);
      const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const windowDays: number = access.windowDays;

      let nudgeType: 'day12' | 'day25' | 'expired' | null = null;
      let showNudge = false;

      if (daysRemaining === 0) {
        nudgeType = 'expired';
        showNudge = true;
      } else if (windowDays <= 14 && daysRemaining <= 2) {
        nudgeType = 'day12';
        showNudge = true;
      } else if (windowDays > 14 && daysRemaining <= 5) {
        nudgeType = 'day25';
        showNudge = true;
      }

      return {
        hasAccess: daysRemaining > 0,
        tier: access.tier,
        daysRemaining,
        windowDays,
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
        windowDays: 0,
        startDate: null,
        expiryDate: null,
        showNudge: false,
        nudgeType: null,
      };
    }
  }

  async activateDFYAccess(
    userId: string,
    tier: DFYTier,
    options?: { windowDays?: number },
  ): Promise<void> {
    const startDate = new Date().toISOString();
    const windowDays = options?.windowDays ?? (tier === 'lite' ? 14 : 30);
    const expiryDate = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString();

    await AsyncStorage.setItem(`${DFY_ACCESS_KEY}_${userId}`, JSON.stringify({
      tier,
      startDate,
      expiryDate,
      windowDays,
    }));
  }

  private activationsStorageKey(userId: string): string {
    return `${DFY_ACTIVATIONS_KEY}_${userId}`;
  }

  async getIncludedActivation(userId: string): Promise<DfyActivationRecord | null> {
    try {
      const raw = await AsyncStorage.getItem(this.activationsStorageKey(userId));
      if (!raw) return null;
      const records = JSON.parse(raw) as DfyActivationRecord[];
      return records.find((record) => record.source === 'subscription_included') ?? null;
    } catch {
      return null;
    }
  }

  async canUseIncludedActivation(
    userId: string,
    subscriptionTier: string | null | undefined,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    usedTier?: DFYTier;
    blockCode?: DfyActivationBlockCode;
  }> {
    const benefit = getDfyBenefitForSubscription(subscriptionTier);
    if (benefit === 'none') {
      return {
        allowed: false,
        blockCode: 'no_benefit',
        reason: 'Upgrade to Personal Stylist or Stylist Unlimited to unlock your included setup.',
      };
    }

    const active = await this.checkDFYAccess(userId, subscriptionTier);
    if (active.hasAccess) {
      return {
        allowed: false,
        blockCode: 'active_window',
        reason: 'You already have an active styling window. Open your plan to continue.',
      };
    }

    const used = await this.getIncludedActivation(userId);
    if (used) {
      return {
        allowed: false,
        blockCode: 'included_used',
        usedTier: used.tier,
        reason: `You've already used your included setup (${used.tier === 'lite' ? 'Quick Start' : 'Full Setup'}). Purchase another to continue.`,
      };
    }

    return { allowed: true };
  }

  async recordSubscriptionActivation(userId: string, tier: DFYTier): Promise<void> {
    const raw = await AsyncStorage.getItem(this.activationsStorageKey(userId));
    const records: DfyActivationRecord[] = raw ? JSON.parse(raw) : [];
    const paidOnly = records.filter((record) => record.source !== 'subscription_included');
    paidOnly.push({
      periodKey: 'included_trial',
      tier,
      activatedAt: new Date().toISOString(),
      source: 'subscription_included',
    });
    await AsyncStorage.setItem(this.activationsStorageKey(userId), JSON.stringify(paidOnly));
  }

  async activateIncludedSetup(
    userId: string,
    tier: DFYTier,
    subscriptionTier: string | null | undefined,
  ): Promise<{ success: boolean; error?: string }> {
    if (!isDfyTierAllowedForSubscription(subscriptionTier, tier)) {
      return {
        success: false,
        error:
          tier === 'core'
            ? 'Full Setup is included with Stylist Unlimited. Upgrade to unlock it.'
            : 'This setup path is not included on your current plan.',
      };
    }

    const eligibility = await this.canUseIncludedActivation(userId, subscriptionTier);
    if (!eligibility.allowed) {
      return { success: false, error: eligibility.reason };
    }

    await this.recordSubscriptionActivation(userId, tier);
    const windowDays = getIncludedStylingWindowDays(subscriptionTier, tier);
    await this.activateDFYAccess(userId, tier, { windowDays });
    return { success: true };
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
    adjustmentRequest?: string,
    outfit?: DFYOutfit,
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

    const outfitPayload = outfit || delivery.outfits[outfitIndex];
    if (reaction !== undefined && reaction !== null) {
      void this.syncOutfitReactionToServer(outfitPayload, reaction);
    } else if (reaction === null && !adjustmentRequest) {
      void this.syncOutfitReactionToServer(outfitPayload, null);
    }
    if (adjustmentRequest) {
      void this.syncAdjustmentToServer(outfitPayload, adjustmentRequest);
    }
  }

  async submitOutfitAdjustment(
    userId: string,
    outfitId: string,
    notes: string,
    outfit?: DFYOutfit,
  ): Promise<void> {
    const delivery = await this.getDFYDelivery(userId);
    if (!delivery) return;

    const outfitIndex = delivery.outfits.findIndex((o) => o.id === outfitId);
    if (outfitIndex === -1) return;

    delivery.outfits[outfitIndex].adjustmentRequest = notes;
    await this.saveDFYDelivery(delivery);

    const outfitPayload = outfit || delivery.outfits[outfitIndex];
    void this.syncAdjustmentToServer(outfitPayload, notes);
  }

  private buildOutfitPayload(outfit: DFYOutfit) {
    return {
      title: outfit.title,
      occasion: outfit.occasion,
      items: outfit.items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        color: item.color,
      })),
    };
  }

  async syncOutfitReactionToServer(
    outfit: DFYOutfit,
    reaction: 'love' | 'not-me' | null,
  ): Promise<void> {
    try {
      await apiService.submitDFYOutfitReaction({
        outfitId: outfit.id,
        reaction,
        source: 'style_plan',
        dayNumber: outfit.dayNumber,
        stylistId: outfit.stylistId,
        outfitData: this.buildOutfitPayload(outfit),
      });
    } catch (error) {
      console.warn('[DFYService] Reaction sync failed (saved locally):', error);
    }
  }

  async syncAdjustmentToServer(outfit: DFYOutfit, notes: string): Promise<void> {
    try {
      await apiService.submitDFYAdjustmentRequest({
        outfitId: outfit.id,
        notes,
        source: 'style_plan',
        dayNumber: outfit.dayNumber,
        stylistId: outfit.stylistId,
        outfitData: this.buildOutfitPayload(outfit),
      });
    } catch (error) {
      console.warn('[DFYService] Adjustment sync failed (saved locally):', error);
    }
  }

  async toggleOutfitSaved(userId: string, outfitId: string): Promise<void> {
    const delivery = await this.getDFYDelivery(userId);
    if (!delivery) return;

    const outfitIndex = delivery.outfits.findIndex(o => o.id === outfitId);
    if (outfitIndex === -1) return;

    delivery.outfits[outfitIndex].saved = !delivery.outfits[outfitIndex].saved;
    await this.saveDFYDelivery(delivery);
  }

  async getSavedLookbookOutfits(userId: string): Promise<SavedLookbookOutfit[]> {
    const delivery = await this.getDFYDelivery(userId);
    if (!delivery) return [];

    return delivery.outfits
      .filter((outfit) => outfit.saved || outfit.userReaction === 'love')
      .map((outfit) => ({
        ...outfit,
        savedReason: (
          outfit.saved && outfit.userReaction === 'love'
            ? 'both'
            : outfit.saved
              ? 'bookmark'
              : 'love'
        ) as SavedLookbookOutfitReason,
      }))
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }

  async removeFromSavedLookbook(userId: string, outfitId: string): Promise<void> {
    const delivery = await this.getDFYDelivery(userId);
    if (!delivery) return;

    const outfitIndex = delivery.outfits.findIndex((o) => o.id === outfitId);
    if (outfitIndex === -1) return;

    delivery.outfits[outfitIndex].saved = false;
    if (delivery.outfits[outfitIndex].userReaction === 'love') {
      delivery.outfits[outfitIndex].userReaction = null;
    }

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

  getExpiryFlow(tier: DFYTier, daysRemaining: number, windowDays?: number): DFYExpiryFlow {
    const effectiveWindowDays = windowDays ?? (tier === 'lite' ? 14 : 30);
    let nudgeType: 'day12' | 'day25' | 'expired' | null = null;
    let showNudgeBanner = false;

    if (daysRemaining === 0) {
      nudgeType = 'expired';
      showNudgeBanner = true;
    } else if (effectiveWindowDays <= 14 && daysRemaining <= 2) {
      nudgeType = 'day12';
      showNudgeBanner = true;
    } else if (effectiveWindowDays > 14 && daysRemaining <= 5) {
      nudgeType = 'day25';
      showNudgeBanner = true;
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

  /**
   * Ensure a lite lookbook exists — prefer server generation, fall back to empty scaffold.
   * Kept name createMockLiteDelivery for call-site compatibility.
   */
  async createMockLiteDelivery(userId: string, stylistId: StylistId): Promise<DFYLiteDelivery> {
    try {
      if (apiService.isConfigured()) {
        const result = await apiService.generateDFYDelivery({ tier: 'lite', stylistId });
        if (result.success && result.delivery?.outfits?.length) {
          const delivery: DFYLiteDelivery = {
            ...result.delivery,
            userId,
            tier: 'lite',
            outfits: result.delivery.outfits.map((o) => ({
              ...o,
              occasion: (o.occasion as DFYOccasion) || 'casual',
              stylistId: (o.stylistId as StylistId) || stylistId,
              items: (o.items || []).map((item) => ({
                id: String(item.id),
                name: item.name,
                imageUri: item.imageUri || undefined,
                category: item.category,
                color: item.color,
              })),
            })),
          };
          await this.saveDFYDelivery(delivery);
          await this.activateDFYAccess(userId, 'lite');
          return delivery;
        }

        if (result.success && result.outfits?.length) {
          const delivery: DFYLiteDelivery = {
            userId,
            tier: 'lite',
            startDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            totalDays: 14,
            currentDay: 1,
            completed: false,
            nudgesShown: [],
            outfits: result.outfits.map((o, i) => ({
              id: o.id || `outfit-${i + 1}`,
              dayNumber: o.dayNumber ?? o.day ?? i + 1,
              title: o.title || (i === 0 ? "Today's Look" : `Day ${i + 1} Look`),
              description: 'A curated outfit for your 14-day plan',
              items: (o.items || []).map((item) => ({
                id: String(item.id),
                name: item.name,
                imageUri: item.imageUri || item.imageUrl || item.processedImageUrl || undefined,
                category: item.category,
                color: item.color,
              })),
              occasion: (o.occasion as DFYOccasion) || 'casual',
              stylistNote: o.stylistNote,
              stylistId: (o.stylistId as StylistId) || stylistId,
              userReaction: null,
              saved: false,
            })),
          };
          await this.saveDFYDelivery(delivery);
          await this.activateDFYAccess(userId, 'lite');
          return delivery;
        }
      }
    } catch (error) {
      console.warn('[DFY] Server lookbook generation failed, using local scaffold:', error);
    }

    const startDate = new Date().toISOString();
    const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const scaffoldOutfits: DFYOutfit[] = Array.from({ length: 14 }, (_, i) => ({
      id: `outfit-${i + 1}`,
      dayNumber: i + 1,
      title: i === 0 ? "Today's Look" : `Day ${i + 1} Look`,
      description: 'Your stylist will fill this day once generation completes',
      items: [],
      occasion: 'casual' as DFYOccasion,
      stylistNote: undefined,
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
      outfits: scaffoldOutfits,
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
