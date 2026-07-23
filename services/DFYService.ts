import AsyncStorage from '@react-native-async-storage/async-storage';
import { StylistId } from '@/contexts/AuthContext';
import { apiService } from '@/services/ApiService';
import {
  getDfyBenefitForSubscription,
  getIncludedStylingWindowDays,
  isDfyTierAllowedForSubscription,
} from '@/utils/dfyEntitlements';
import type { TravelPlan, TravelVibe, TravelActivity } from '@/utils/travelCapsule';
import {
  formatTravelLookbookTitle,
  resolveTravelTripDays,
} from '@/utils/travelCapsule';
import { formatDisplayDate } from '@/utils/lookbookTripDay';

export type { StylistId };
export type { TravelPlan, TravelVibe, TravelActivity };

export type DFYTier = 'lite' | 'core';
export type DFYOccasion = 'work' | 'holiday' | 'event' | 'casual' | 'browsing';

/** Travel Capsule (DFY Lite) default lookbook length when trip dates are unknown. */
export const LITE_LOOKBOOK_DAYS = 14;

/** Prefer last-generated lookbook length; fall back to trip dates, then default. */
export function resolveLiteTotalDays(
  delivery?: Pick<DFYLiteDelivery, 'totalDays' | 'travelPlan'> | null,
): number {
  if (typeof delivery?.totalDays === 'number' && delivery.totalDays > 0) {
    return Math.max(1, Math.round(delivery.totalDays));
  }
  return Math.max(1, resolveTravelTripDays(delivery?.travelPlan) || LITE_LOOKBOOK_DAYS);
}

export function normalizeLiteDelivery(delivery: DFYLiteDelivery): DFYLiteDelivery {
  const totalDays = resolveLiteTotalDays(delivery);
  // Prefer immutable trip anchor — never invent "today" when travelPlan/startDate exist.
  const anchorIso =
    delivery.travelPlan?.startDate
    || delivery.startDate
    || null;
  const startDate = anchorIso || new Date().toISOString();
  const start = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).slice(0, 10))
      ? `${String(startDate).slice(0, 10)}T12:00:00`
      : startDate,
  );
  const correctExpiry = new Date(
    start.getTime() + totalDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const stylistId = delivery.outfits[0]?.stylistId || 'ruby';

  const outfits: DFYOutfit[] = delivery.outfits.slice(0, totalDays).map((o, idx) => ({
    ...o,
    dayNumber: idx + 1,
    title: o.title || `Day ${idx + 1} Look`,
  }));

  while (outfits.length < totalDays) {
    const dayNumber = outfits.length + 1;
    outfits.push({
      id: `outfit-${dayNumber}`,
      dayNumber,
      title: `Day ${dayNumber} Look`,
      description: 'Your stylist will fill this day once generation completes',
      items: [],
      occasion: 'casual',
      stylistId,
      userReaction: null,
      saved: false,
    });
  }

  return {
    ...delivery,
    tier: 'lite',
    totalDays,
    // Keep original startDate string when present so we never rewrite trip start to "now"
    startDate: delivery.startDate || startDate,
    expiryDate: correctExpiry,
    outfits,
  };
}

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
  /** Soft activity / vibe chip for Travel Capsule days */
  vibeLabel?: string;
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
  /** Lookbook length = trip days when dates are set (fallback 14). */
  totalDays: number;
  outfits: DFYOutfit[];
  currentDay: number;
  completed: boolean;
  nudgesShown: number[];
  /** Trip context for Travel Capsule packing + destination weather */
  travelPlan?: TravelPlan | null;
  /** Stable id linking this delivery to the local multi-trip list. */
  tripId?: string;
  /** e.g. "Barcelona trip July 2026" */
  lookbookTitle?: string;
  /** Item IDs in the packed capsule (subset of wardrobe) */
  capsuleItemIds?: string[];
  capsuleNotes?: string[];
  packingSummary?: import('@/utils/packingSummary').PackingSummary | null;
  engineVersion?: string;
}

/** Saved Travel Capsule trip (local multi-trip list). */
export interface TravelTripRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  delivery: DFYLiteDelivery;
}

export interface TravelTripSummary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripDays: number;
  vibe: TravelVibe;
  updatedAt: string;
  hasLooks: boolean;
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

export interface DfyPackageSummary {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  outfitCount: number;
  tier: DFYTier;
}

export interface DfyPackageDetail extends DfyPackageSummary {
  stylistId?: string;
  payload?: Record<string, unknown> | null;
}

export interface UpgradePathTrigger {
  featureRequested: string;
  requiredTier: DFYTier;
  stylistId: StylistId;
  message: string;
}

const DFY_ACCESS_KEY = '@dripn_dfy_access';
const DFY_DELIVERY_KEY = '@dripn_dfy_delivery';
const DFY_CORE_CALENDAR_KEY = '@dripn_dfy_core_calendar';
const DFY_ACTIVATIONS_KEY = '@dripn_dfy_activations';
const TRAVEL_TRIPS_KEY = '@dripn_travel_trips';
const ACTIVE_TRAVEL_TRIP_KEY = '@dripn_active_travel_trip';

function newTravelTripId(): string {
  return `trip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function travelTripSummaryFromRecord(record: TravelTripRecord): TravelTripSummary {
  const plan = record.delivery.travelPlan;
  return {
    id: record.id,
    title: record.title || formatTravelLookbookTitle(plan),
    destination: plan?.destination || '',
    startDate: plan?.startDate || record.delivery.startDate || '',
    endDate: plan?.endDate || '',
    tripDays:
      plan?.tripDays
      || resolveLiteTotalDays(record.delivery),
    vibe: plan?.vibe || 'mixed',
    updatedAt: record.updatedAt,
    hasLooks: (record.delivery.outfits || []).some((o) => (o.items?.length || 0) > 0),
  };
}
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
    name: 'Travel Capsule',
    tagline: 'Pack less. Look sorted for the whole trip.',
    price: '£19.99',
    mentalModel: 'tactical',
    description: 'A packed capsule wardrobe and 14 ready-to-wear looks for your destination — weather-aware, mix-and-match.',
    features: [
      { text: 'Smart packing: 9–12 versatile pieces', included: true },
      { text: '14 destination-ready outfit looks', included: true },
      { text: 'Weather-aware for your trip', included: true },
      { text: 'Save looks to revisit anytime', included: true },
      { text: 'Build your full wardrobe system', included: false },
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
      let windowDays =
        access.windowDays ?? this.inferWindowDaysFromDates(access.startDate, access.expiryDate, access.tier);
      if (access.tier === 'lite') windowDays = Math.min(windowDays, LITE_LOOKBOOK_DAYS);
      return { ...access, windowDays };
    }

    const expectedWindowDays = getIncludedStylingWindowDays(subscriptionTier, access.tier);
    const currentWindowDays =
      access.windowDays ?? this.inferWindowDaysFromDates(access.startDate, access.expiryDate, access.tier);

    const targetWindowDays =
      access.tier === 'lite'
        ? Math.min(expectedWindowDays, LITE_LOOKBOOK_DAYS)
        : Math.max(currentWindowDays, expectedWindowDays);

    if (currentWindowDays === targetWindowDays) {
      return { ...access, windowDays: currentWindowDays };
    }

    const start = new Date(access.startDate);
    const newExpiryDate = new Date(
      start.getTime() + targetWindowDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const migrated = {
      tier: access.tier,
      startDate: access.startDate,
      expiryDate: newExpiryDate,
      windowDays: targetWindowDays,
    };

    await AsyncStorage.setItem(`${DFY_ACCESS_KEY}_${userId}`, JSON.stringify(migrated));

    const delivery = await this.getDFYDelivery(userId);
    if (delivery && delivery.tier === access.tier) {
      if (delivery.tier === 'lite') {
        await this.saveDFYDelivery(
          normalizeLiteDelivery({
            ...(delivery as DFYLiteDelivery),
            expiryDate: newExpiryDate,
          }),
        );
      } else {
        await this.saveDFYDelivery({
          ...delivery,
          expiryDate: newExpiryDate,
          totalDays: targetWindowDays,
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
      let access = await this.maybeMigrateIncludedWindow(userId, storedAccess, subscriptionTier);

      if (access.tier === 'lite') {
        const liteWindow = Math.min(access.windowDays ?? LITE_LOOKBOOK_DAYS, LITE_LOOKBOOK_DAYS);
        if (liteWindow !== access.windowDays) {
          const start = new Date(access.startDate);
          access = {
            ...access,
            windowDays: LITE_LOOKBOOK_DAYS,
            expiryDate: new Date(
              start.getTime() + LITE_LOOKBOOK_DAYS * 24 * 60 * 60 * 1000,
            ).toISOString(),
          };
          await AsyncStorage.setItem(`${DFY_ACCESS_KEY}_${userId}`, JSON.stringify(access));

          const delivery = await this.getDFYDelivery(userId);
          if (delivery?.tier === 'lite') {
            await this.saveDFYDelivery(normalizeLiteDelivery(delivery as DFYLiteDelivery));
          }
        }
      }

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
        reason: `You've already used your included setup (${used.tier === 'lite' ? 'Travel Capsule' : 'Full Setup'}). Purchase another to continue.`,
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
      if (!data) return null;
      const parsed = JSON.parse(data) as DFYDelivery;
      if (parsed?.tier === 'lite') {
        return normalizeLiteDelivery(parsed as DFYLiteDelivery);
      }
      return parsed;
    } catch (error) {
      console.error('Error getting DFY delivery:', error);
      return null;
    }
  }

  async saveDFYDelivery(delivery: DFYDelivery): Promise<void> {
    try {
      const toSave =
        delivery.tier === 'lite'
          ? normalizeLiteDelivery(delivery as DFYLiteDelivery)
          : delivery;
      await AsyncStorage.setItem(`${DFY_DELIVERY_KEY}_${toSave.userId}`, JSON.stringify(toSave));
    } catch (error) {
      console.error('Error saving DFY delivery:', error);
    }
  }

  private async readTravelTrips(userId: string): Promise<TravelTripRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(`${TRAVEL_TRIPS_KEY}_${userId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TravelTripRecord[]) : [];
    } catch {
      return [];
    }
  }

  private async writeTravelTrips(userId: string, trips: TravelTripRecord[]): Promise<void> {
    await AsyncStorage.setItem(`${TRAVEL_TRIPS_KEY}_${userId}`, JSON.stringify(trips));
  }

  async getActiveTravelTripId(userId: string): Promise<string | null> {
    try {
      return (await AsyncStorage.getItem(`${ACTIVE_TRAVEL_TRIP_KEY}_${userId}`)) || null;
    } catch {
      return null;
    }
  }

  async setActiveTravelTripId(userId: string, tripId: string): Promise<void> {
    await AsyncStorage.setItem(`${ACTIVE_TRAVEL_TRIP_KEY}_${userId}`, tripId);
  }

  /**
   * List saved Travel Capsule trips (local). Seeds from active delivery if empty.
   */
  async listTravelTrips(userId: string): Promise<TravelTripSummary[]> {
    let trips = await this.readTravelTrips(userId);
    if (trips.length === 0) {
      const delivery = await this.getDFYDelivery(userId);
      if (delivery?.tier === 'lite' && delivery.travelPlan?.destination) {
        await this.upsertTravelTripFromDelivery(delivery, { activate: true, syncLooks: true });
        trips = await this.readTravelTrips(userId);
      }
    }
    return trips
      .map(travelTripSummaryFromRecord)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async getTravelTrip(userId: string, tripId: string): Promise<TravelTripRecord | null> {
    const trips = await this.readTravelTrips(userId);
    return trips.find((t) => t.id === tripId) || null;
  }

  /**
   * Upsert a trip from the active Lite delivery.
   * - Metadata-only saves update plan/title without wiping looks when syncLooks is false
   *   and an existing trip already has outfits (caller usually passes syncLooks true with
   *   the delivery they intend to persist).
   */
  async upsertTravelTripFromDelivery(
    delivery: DFYLiteDelivery,
    options?: {
      tripId?: string;
      activate?: boolean;
      syncLooks?: boolean;
      /** Always create a new list entry (Plan a new trip). */
      forceNew?: boolean;
    },
  ): Promise<TravelTripRecord | null> {
    if (!delivery?.userId || delivery.tier !== 'lite') return null;
    const userId = delivery.userId;
    const plan = delivery.travelPlan;
    if (!plan?.destination && !delivery.lookbookTitle) {
      // Nothing meaningful to list yet
      return null;
    }

    const trips = await this.readTravelTrips(userId);
    const activeId = options?.forceNew
      ? undefined
      : (options?.tripId
        || delivery.tripId
        || plan?.tripId
        || (await this.getActiveTravelTripId(userId)));

    let existing = activeId ? trips.find((t) => t.id === activeId) : undefined;
    // Match by destination + start when id missing (migration / first save)
    if (!existing && !options?.forceNew && plan?.destination && plan?.startDate) {
      existing = trips.find(
        (t) =>
          t.delivery.travelPlan?.destination === plan.destination
          && t.delivery.travelPlan?.startDate === plan.startDate,
      );
    }

    const tripId = existing?.id || activeId || newTravelTripId();
    const title =
      delivery.lookbookTitle
      || formatTravelLookbookTitle(plan)
      || existing?.title
      || 'Travel Capsule';
    const now = new Date().toISOString();
    const syncLooks = options?.syncLooks !== false;

    const nextDelivery: DFYLiteDelivery = normalizeLiteDelivery({
      ...delivery,
      tripId,
      lookbookTitle: title,
      travelPlan: plan
        ? { ...plan, tripId }
        : delivery.travelPlan,
      outfits: syncLooks || !existing
        ? delivery.outfits
        : (existing.delivery.outfits?.length ? existing.delivery.outfits : delivery.outfits),
      totalDays: syncLooks || !existing
        ? delivery.totalDays
        : (existing.delivery.totalDays || delivery.totalDays),
      capsuleItemIds: syncLooks || !existing
        ? delivery.capsuleItemIds
        : (existing.delivery.capsuleItemIds || delivery.capsuleItemIds),
      packingSummary: syncLooks || !existing
        ? delivery.packingSummary
        : (existing.delivery.packingSummary || delivery.packingSummary),
    });

    const record: TravelTripRecord = {
      id: tripId,
      title,
      createdAt: existing?.createdAt || plan?.createdAt || now,
      updatedAt: now,
      delivery: nextDelivery,
    };

    const nextTrips = [record, ...trips.filter((t) => t.id !== tripId)];
    await this.writeTravelTrips(userId, nextTrips);
    if (options?.activate !== false) {
      await this.setActiveTravelTripId(userId, tripId);
    }
    return record;
  }

  /**
   * Activate a saved trip as the current Lite lookbook delivery.
   */
  async activateTravelTrip(userId: string, tripId: string): Promise<DFYLiteDelivery | null> {
    const record = await this.getTravelTrip(userId, tripId);
    if (!record) return null;
    const delivery = normalizeLiteDelivery({
      ...record.delivery,
      userId,
      tripId: record.id,
      lookbookTitle: record.title,
      travelPlan: record.delivery.travelPlan
        ? { ...record.delivery.travelPlan, tripId: record.id }
        : record.delivery.travelPlan,
    });
    // Persist without recursive upsert churn: write delivery then mark active
    await AsyncStorage.setItem(`${DFY_DELIVERY_KEY}_${userId}`, JSON.stringify(delivery));
    await this.setActiveTravelTripId(userId, tripId);
    return delivery;
  }

  formatTravelTripSubtitle(summary: TravelTripSummary): string {
    const start = formatDisplayDate(summary.startDate);
    const end = formatDisplayDate(summary.endDate);
    const dates = start && end ? `${start} – ${end}` : start || end || '';
    const vibe = summary.vibe ? summary.vibe.charAt(0).toUpperCase() + summary.vibe.slice(1) : '';
    const parts = [
      dates,
      summary.tripDays ? `${summary.tripDays}-day` : '',
      vibe,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  async saveCoreCalendarCache(
    userId: string,
    payload: {
      outfits: Array<{
        id: string;
        date: string;
        title: string;
        stylistNote: string;
        stylistId: StylistId;
        itemIds: string[];
        dayNumber: number;
      }>;
      startDate: string;
      totalDays: number;
      generatedAt: string;
      calendarHash?: string;
      engineVersion?: string;
    },
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(`${DFY_CORE_CALENDAR_KEY}_${userId}`, JSON.stringify(payload));
    } catch (error) {
      console.error('Error saving Core calendar cache:', error);
    }
  }

  async getCoreCalendarCache(userId: string): Promise<{
    outfits: Array<{
      id: string;
      date: string;
      title: string;
      stylistNote: string;
      stylistId: StylistId;
      itemIds: string[];
      dayNumber: number;
    }>;
    startDate: string;
    totalDays: number;
    generatedAt: string;
    calendarHash?: string;
    engineVersion?: string;
  } | null> {
    try {
      const raw = await AsyncStorage.getItem(`${DFY_CORE_CALENDAR_KEY}_${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Error reading Core calendar cache:', error);
      return null;
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

  /** Resolve active package + default name for the post-generate rename prompt. */
  async preparePackageNamePrompt(
    tier: DFYTier,
  ): Promise<{ packageId: string; defaultName: string } | null> {
    const active = await this.getActiveDfyPackage(tier);
    if (!active) return null;
    const defaultName =
      active.name?.trim() ||
      (await this.getDefaultPackageName(tier));
    return { packageId: active.id, defaultName };
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

  private formatPackageDate(date: Date = new Date()): string {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private occasionLabel(occasion: DFYOccasion | string | undefined): string | null {
    if (!occasion || occasion === 'browsing' || occasion === 'casual') return null;
    const labels: Record<string, string> = {
      work: 'Work',
      holiday: 'Holiday',
      event: 'Event',
    };
    return labels[occasion] || occasion.charAt(0).toUpperCase() + occasion.slice(1);
  }

  /** Default package title after Lite/Core generate — occasion if known, else product · date. */
  async getDefaultPackageName(tier: DFYTier, occasion?: DFYOccasion | string | null): Promise<string> {
    const dateLabel = this.formatPackageDate();
    if (tier === 'core') {
      return `Full Wardrobe Setup · ${dateLabel}`;
    }
    const fromArg = this.occasionLabel(occasion || undefined);
    if (fromArg) return `${fromArg} · ${dateLabel}`;
    try {
      const coldOpen = await this.getColdOpenFlow();
      const fromCold = this.occasionLabel(coldOpen?.occasion);
      if (fromCold) return `${fromCold} · ${dateLabel}`;
    } catch {
      // ignore
    }
    return `Travel Capsule · ${dateLabel}`;
  }

  async listDfyPackages(): Promise<DfyPackageSummary[]> {
    if (!apiService.isConfigured()) return [];
    try {
      const result = await apiService.listDfyPackages();
      return (result.packages || []).map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        createdAt: pkg.createdAt,
        isActive: Boolean(pkg.isActive),
        outfitCount: typeof pkg.outfitCount === 'number' ? pkg.outfitCount : 0,
        tier: (pkg.tier === 'core' ? 'core' : 'lite') as DFYTier,
      }));
    } catch (error) {
      console.warn('[DFY] listDfyPackages failed:', error);
      return [];
    }
  }

  async getDfyPackage(packageId: string): Promise<DfyPackageDetail | null> {
    if (!apiService.isConfigured() || !packageId) return null;
    try {
      const pkg = await apiService.getDfyPackage(packageId);
      return {
        id: pkg.id,
        name: pkg.name,
        createdAt: pkg.createdAt,
        isActive: Boolean(pkg.isActive),
        outfitCount:
          typeof pkg.outfitCount === 'number'
            ? pkg.outfitCount
            : Array.isArray((pkg.payload as { outfits?: unknown[] } | null)?.outfits)
              ? ((pkg.payload as { outfits: unknown[] }).outfits.length)
              : 0,
        tier: (pkg.tier === 'core' ? 'core' : 'lite') as DFYTier,
        stylistId: pkg.stylistId,
        payload: (pkg.payload as Record<string, unknown> | null | undefined) ?? null,
      };
    } catch (error) {
      console.warn('[DFY] getDfyPackage failed:', error);
      return null;
    }
  }

  async renameDfyPackage(packageId: string, name: string): Promise<DfyPackageDetail | null> {
    const trimmed = name.trim();
    if (!apiService.isConfigured() || !packageId || !trimmed) return null;
    try {
      const pkg = await apiService.renameDfyPackage(packageId, trimmed);
      return {
        id: pkg.id,
        name: pkg.name,
        createdAt: pkg.createdAt,
        isActive: Boolean(pkg.isActive),
        outfitCount: typeof pkg.outfitCount === 'number' ? pkg.outfitCount : 0,
        tier: (pkg.tier === 'core' ? 'core' : 'lite') as DFYTier,
        stylistId: pkg.stylistId,
        payload: (pkg.payload as Record<string, unknown> | null | undefined) ?? null,
      };
    } catch (error) {
      console.warn('[DFY] renameDfyPackage failed:', error);
      throw error;
    }
  }

  /** Active package for a tier (newest active match), or null. */
  async getActiveDfyPackage(tier?: DFYTier): Promise<DfyPackageSummary | null> {
    const packages = await this.listDfyPackages();
    const active = packages.filter((pkg) => pkg.isActive && (!tier || pkg.tier === tier));
    if (active.length === 0) return null;
    return active.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }

  /** Map a stored package payload into a lite lookbook delivery for historical viewing. */
  mapPackagePayloadToLiteDelivery(
    userId: string,
    pkg: DfyPackageDetail,
    fallbackStylistId: StylistId = 'ruby',
  ): DFYLiteDelivery | null {
    const payload = pkg.payload || {};
    const rawOutfits = Array.isArray(payload.outfits)
      ? payload.outfits
      : Array.isArray((payload as { lookbook?: unknown[] }).lookbook)
        ? (payload as { lookbook: unknown[] }).lookbook
        : Array.isArray((payload as { calendar?: Array<{ outfit?: unknown }> }).calendar)
          ? (payload as { calendar: Array<{ outfit?: unknown; day?: number }> }).calendar
              .map((entry, i) => {
                const outfit = (entry?.outfit || entry) as Record<string, unknown> | null;
                if (!outfit || typeof outfit !== 'object') return null;
                return {
                  ...outfit,
                  day: entry?.day ?? (outfit as { day?: number }).day ?? i + 1,
                  dayNumber:
                    entry?.day ??
                    (outfit as { dayNumber?: number }).dayNumber ??
                    (outfit as { day?: number }).day ??
                    i + 1,
                };
              })
              .filter(Boolean)
          : Array.isArray((payload as { delivery?: { outfits?: unknown[] } }).delivery?.outfits)
            ? (payload as { delivery: { outfits: unknown[] } }).delivery.outfits
            : [];
    if (!Array.isArray(rawOutfits) || rawOutfits.length === 0) {
      // Some APIs nest the full delivery as payload itself
      if (Array.isArray((payload as DFYLiteDelivery).outfits)) {
        const nested = payload as unknown as DFYLiteDelivery;
        return {
          ...nested,
          userId,
          tier: 'lite',
          totalDays: (nested.totalDays as 14) || 14,
        };
      }
      return null;
    }

    const stylistId = (pkg.stylistId || fallbackStylistId) as StylistId;
    const startDate =
      (typeof payload.startDate === 'string' && payload.startDate) ||
      pkg.createdAt ||
      new Date().toISOString();
    const windowDays = pkg.tier === 'core' ? 30 : 14;
    const expiryDate =
      (typeof payload.expiryDate === 'string' && payload.expiryDate) ||
      (typeof payload.endDate === 'string' && payload.endDate) ||
      new Date(new Date(startDate).getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString();

    return normalizeLiteDelivery({
      userId,
      tier: 'lite',
      startDate,
      expiryDate,
      // Lite lookbook is always 14 days regardless of package metadata
      totalDays: LITE_LOOKBOOK_DAYS as 14,
      currentDay: typeof payload.currentDay === 'number' ? payload.currentDay : 1,
      completed: Boolean(payload.completed),
      nudgesShown: Array.isArray(payload.nudgesShown) ? (payload.nudgesShown as number[]) : [],
      outfits: rawOutfits.map((o: any, i: number) => ({
        id: String(o.id || `outfit-${i + 1}`),
        dayNumber: o.dayNumber ?? o.day ?? i + 1,
        title: o.title || o.occasion || (i === 0 ? "Today's Look" : `Day ${i + 1} Look`),
        description: o.description || o.stylistNote || '',
        items: (o.items || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || '',
          category: item.category || '',
          color: item.color || '',
          imageUri: item.imageUri || item.imageUrl || item.processedImageUrl || undefined,
          imageUrl: item.imageUrl,
          processedImageUrl: item.processedImageUrl,
        })),
        occasion: (o.occasion as DFYOccasion) || 'casual',
        stylistNote: o.stylistNote,
        weatherNote: o.weatherNote,
        stylistId: (o.stylistId as StylistId) || stylistId,
        userReaction: o.userReaction ?? null,
        saved: Boolean(o.saved),
      })),
    });
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
          const delivery: DFYLiteDelivery = normalizeLiteDelivery({
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
          });
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
