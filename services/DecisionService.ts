import AsyncStorage from '@react-native-async-storage/async-storage';
import { StylistId, SubscriptionTier } from '@/contexts/AuthContext';
import { getTierFeatures, tierHasUnlimitedDecisions, canSaveDecisionHistory } from '@/utils/tierMatrix';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { apiService } from '@/services/ApiService';

export type DecisionType = 'shopping' | 'what-to-wear' | 'event-outfit' | 'sanity-check';
export type DecisionContext =
  | 'work-appropriate'
  | 'casual'
  | 'formal'
  | 'date-night'
  | 'comfort'
  | 'versatility'
  | 'budget'
  | 'trendy'
  | 'weather';

export interface DecisionTypeOption {
  id: DecisionType;
  label: string;
  icon: string;
  description: string;
}

export interface DecisionRequest {
  id: string;
  userId: string;
  type: DecisionType;
  images: string[];
  contextNotes?: string;
  contextChips: DecisionContext[];
  timestamp: string;
  stylistId: StylistId;
}

export interface DecisionResponse {
  id: string;
  requestId: string;
  recommendation: string;
  reasoning: string;
  confidenceNote?: string;
  /** Trust framing for deterministic vs AI-enhanced decisions — no numeric scores. */
  decisionConfidence?: {
    band?: 'photo_ai' | 'wardrobe_rules' | 'brief_guided' | string;
    label?: string;
    note?: string;
    source?: 'ai' | 'rules' | string;
  };
  deterministic?: boolean;
  aiEnhanced?: boolean;
  partial?: boolean;
  verdict?: 'works' | 'doesnt_work' | string;
  stylistId: StylistId;
  timestamp: string;
  outfitImageUrl?: string;
  success?: boolean;
  decision?: string;
  response?: string;
  /** Refuse / gap / graceful fallback — never show a fake score card on gap */
  status?: 'ok' | 'wardrobe_gap' | 'no_outfit_possible' | 'refused' | 'fallback_outfit' | 'SHOP_REQUIRED' | 'system_error' | string;
  type?: 'fallback_outfit' | 'shop_required' | string;
  isFallback?: boolean;
  /** Explicit UI contract: APPROVED | REJECTED_WARDROBE_FIX | SHOP_REQUIRED */
  displayState?: 'APPROVED' | 'REJECTED_WARDROBE_FIX' | 'SHOP_REQUIRED' | string;
  /** Inspiration labels when wardrobe cannot satisfy dress code */
  recommendedOutfit?: {
    top?: string;
    bottom?: string;
    shoes?: string;
    outerwear?: string;
    [role: string]: string | undefined;
  } | null;
  retailers?: Array<{
    name?: string;
    url?: string;
    items?: string[];
  }>;
  /** Curated UK formal storefronts or Google Places (real place_id only) */
  nearbyStores?: Array<{
    name?: string;
    url?: string;
    website?: string;
    place_id?: string | null;
    source?: string;
    address?: string | null;
  }> | null;
  nearbyStoresSource?: string | null;
  /** Ranked product cards for SHOP_REQUIRED */
  retailOutfit?: {
    outfit?: Record<string, {
      id?: string;
      title?: string;
      brand?: string;
      price?: number;
      currency?: string;
      priceFormatted?: string;
      image?: string;
      url?: string | null;
      searchUrl?: string | null;
      retailer?: string;
      retailerId?: string;
      category?: string;
    }>;
    products?: Array<{
      id?: string;
      title?: string;
      brand?: string;
      price?: number;
      currency?: string;
      priceFormatted?: string;
      image?: string;
      url?: string | null;
      searchUrl?: string | null;
      retailer?: string;
      retailerId?: string;
      category?: string;
    }>;
    previewImageUrl?: string | null;
    dressCodeKey?: string;
    dressCodeLabel?: string;
    country?: string;
  } | null;
  stylistNote?: string;
  suggestions?: string[];
  missingPieces?: string[];
  missing?: Array<{
    role?: string;
    label?: string;
    name?: string;
    reason?: string;
    color?: string;
    formality?: string;
    products?: Array<{
      retailerId?: string;
      retailer?: string;
      url?: string;
      searchUrl?: string;
    }>;
    retail?: {
      query?: string;
      nearby?: { appleMaps?: string; googleMaps?: string; query?: string };
      nearbyByBrand?: Array<{ brand?: string; appleMaps?: string; googleMaps?: string }>;
      online?: Array<{ retailerId?: string; retailer?: string; url?: string }>;
    };
  }>;
  styleRating?: number | null;
  ratingLabel?: string | null;
  recommendedIndex?: number;
  uploadedImages?: string[];
  outfitPieces?: Array<{
    role?: string;
    name?: string;
    wardrobeItemId?: number | string;
    imageUrl?: string | null;
    category?: string | null;
    type?: 'owned' | 'recommended' | string;
    stylingNote?: string;
    reason?: string;
    color?: string | null;
    formality?: string;
  }>;
  outfitSummary?: string;
  unifiedScore?: {
    final_score?: number;
    label?: string;
    feedback?: string[];
    context?: {
      season?: string;
      occasion?: string;
      brand_coherence?: number;
      season_fit?: number;
      brand_tiers?: string[];
    };
    style_score?: number;
    color_score?: number;
    fit_score?: number;
  } | null;
  /** Shopping / sanity: uploaded photos that match owned wardrobe items */
  alreadyOwned?: Array<{
    optionIndex: number;
    type?: 'already_owned' | 'redundant';
    verdict?: string;
    message?: string;
    confidence?: number;
    confidencePercent?: number;
    confidenceBand?: 'already_owned' | 'very_similar' | 'similar_style' | null;
    confidenceLabel?: string | null;
    coverage?: {
      redundancy?: number;
      gapScore?: number;
      versatility?: number;
      explanation?: string;
      similarCount?: number;
      overIndexed?: string | null;
    };
    comparison?: {
      wardrobeItem: {
        id?: number | string;
        name?: string;
        imageUrl?: string | null;
        color?: string | null;
        brand?: string | null;
      };
      shoppingOptionIndex: number;
      similarityPercent?: number;
    } | null;
    matches: Array<{
      id?: number | string;
      name?: string;
      category?: string | null;
      color?: string | null;
      brand?: string | null;
      imageUrl?: string | null;
      confidence?: string;
      similarityPercent?: number;
      reason?: string;
      message?: string;
    }>;
  }>;
  alreadyOwnedMatches?: DecisionResponse['alreadyOwned'];
  ownershipDecision?: {
    type: 'already_owned' | 'ok' | 'similar_item' | 'duplicate' | string;
    decision?: 'DO_NOT_BUY' | 'STRONG_BUY' | 'SMART_BUY' | 'OK' | string;
    verdict?: string;
    matches: Array<Record<string, unknown>>;
    message?: string;
    confidence?: number;
    confidencePercent?: number;
    matchedItemId?: number | string | null;
    coverage?: Record<string, unknown>;
  };
  purchaseDecision?: {
    decision?: string;
    verdict?: string;
    reason?: string | null;
    matchedItemId?: number | string | null;
    matchedItem?: Record<string, unknown> | null;
    confidence?: number;
    confidencePercent?: number;
    coverage?: Record<string, unknown> | null;
  };
  wardrobeCoverage?: Record<string, unknown> | null;
  alreadyOwnedOverride?: boolean;
}

/** Client floor — never display scores at/below occasion-fail cap. */
export const STYLE_RATING_DISPLAY_FLOOR = 5.4;
export const STYLE_RATING_RECOMMEND_FLOOR = 7.0;

export function shouldDisplayStyleRating(rating: number | null | undefined): boolean {
  if (rating == null || !Number.isFinite(Number(rating))) return false;
  return Number(rating) > STYLE_RATING_DISPLAY_FLOOR;
}

export interface SecondOpinionResponse {
  agrees: boolean;
  response: string;
  stylistId: StylistId;
}

export interface DecisionAccessStatus {
  canMakeDecision: boolean;
  decisionsToday: number;
  maxDecisionsToday: number;
  maxImages: number;
  hasSecondOpinion: boolean;
  hasHistory: boolean;
  reason?: string;
}

export interface DecisionLimits {
  tier: SubscriptionTier;
  decisionsPerDay: number | 'unlimited';
  maxImages: number;
  hasSecondOpinion: boolean;
  hasHistory: boolean;
  hasCommunityVoting: boolean;
}

export interface DecisionFailureState {
  type: 'bad-photo' | 'too-many-options' | 'no-context' | 'contradictory';
  message: string;
  suggestion: string;
}

export interface CommunityVotingEligibility {
  eligible: boolean;
  reason: string;
  decisionsCompleted: number;
  requiredDecisions: number;
}

const DECISION_TYPES: DecisionTypeOption[] = [
  {
    id: 'shopping',
    label: 'Choosing what to buy',
    icon: 'shopping-bag',
    description: 'Help me decide between options',
  },
  {
    id: 'what-to-wear',
    label: 'What should I wear?',
    icon: 'sun',
    description: 'Pick my outfit for today',
  },
  {
    id: 'event-outfit',
    label: 'Outfit for an event',
    icon: 'calendar',
    description: 'Something specific coming up',
  },
  {
    id: 'sanity-check',
    label: 'Quick sanity check',
    icon: 'check-circle',
    description: 'Just need a second pair of eyes',
  },
];

const CONTEXT_CHIPS: { id: DecisionContext; label: string }[] = [
  { id: 'work-appropriate', label: 'Work-appropriate' },
  { id: 'casual', label: 'Casual' },
  { id: 'formal', label: 'Formal' },
  { id: 'date-night', label: 'Date night' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'versatility', label: 'Versatility' },
  { id: 'budget', label: 'Budget' },
  { id: 'trendy', label: 'Trendy vs timeless' },
  { id: 'weather', label: 'Weather-related' },
];

const TIER_LIMITS: Record<SubscriptionTier, DecisionLimits> = {
  free: {
    tier: 'free',
    decisionsPerDay: 1,
    maxImages: 2,
    hasSecondOpinion: false,
    hasHistory: false,
    hasCommunityVoting: false,
  },
  personal_stylist: {
    tier: 'personal_stylist',
    decisionsPerDay: 'unlimited',
    maxImages: 3,
    hasSecondOpinion: false,
    hasHistory: true,
    hasCommunityVoting: false,
  },
  stylist_unlimited: {
    tier: 'stylist_unlimited',
    decisionsPerDay: 'unlimited',
    maxImages: 5,
    hasSecondOpinion: false,
    hasHistory: true,
    hasCommunityVoting: false,
  },
};

const FAILURE_STATES: DecisionFailureState[] = [
  {
    type: 'bad-photo',
    message: "I can't see this clearly enough to make a confident call.",
    suggestion: 'Try one clean photo - natural light works best.',
  },
  {
    type: 'too-many-options',
    message: 'Give me your top two or three.',
    suggestion: 'Too many options makes decisions worse.',
  },
  {
    type: 'no-context',
    message: 'Based on what I can see, I can help.',
    suggestion: 'Add where you\'re wearing this for a sharper call.',
  },
  {
    type: 'contradictory',
    message: "These don't quite match the setting.",
    suggestion: 'If comfort matters more than formality, say the word.',
  },
];

const FORBIDDEN_LANGUAGE = [
  'it depends',
  'you could go either way',
  'both are great',
  'either would work',
  'hard to say',
];

const RESPONSE_TEMPLATES = {
  shopping: {
    template: 'Choose {option}. It\'s more versatile and you\'ll wear it more often. The other option looks good, but it\'s harder to justify long-term.',
    secondOpinionAgree: 'I stand by my first choice. The alternative is trendier, but less you.',
    secondOpinionRevise: 'On second thought, {option} is the safer buy. It\'ll integrate better with what you already wear.',
  },
  'what-to-wear': {
    template: 'Wear {option}. It balances effort and comfort better for today. You\'ll feel put together without feeling overdone.',
    secondOpinionAgree: 'I stand by my first choice. This is the right balance.',
    secondOpinionRevise: 'Actually, let\'s go with {option}. It reads better for your day.',
  },
  'event-outfit': {
    template: 'Go with {option}. It\'ll work in more situations and won\'t feel dated. The other option is fine, but this one has more staying power.',
    secondOpinionAgree: 'I stand by my first choice. This is the event-appropriate option.',
    secondOpinionRevise: 'On reflection, {option} matches the occasion better.',
  },
  'sanity-check': {
    template: 'Your instinct is right. This works for the setting and doesn\'t try too hard.',
    secondOpinionAgree: 'Your gut was right the first time.',
    secondOpinionRevise: 'Actually, trust your backup option on this one.',
  },
};

const DECISIONS_TODAY_KEY = '@dripn_decisions_today';
const DECISION_HISTORY_KEY = '@dripn_decision_history';
const TOTAL_DECISIONS_KEY = '@dripn_total_decisions';

class DecisionService {
  getDecisionTypes(): DecisionTypeOption[] {
    return DECISION_TYPES;
  }

  getContextChips(decisionType?: DecisionType): { id: DecisionContext; label: string }[] {
    // Event step 1 already captures occasion/dress code; free-text notes cover the rest.
    if (decisionType === 'event-outfit') {
      return [];
    }
    return CONTEXT_CHIPS;
  }

  getTierLimits(tier: SubscriptionTier): DecisionLimits {
    return TIER_LIMITS[tier];
  }

  getFailureStates(): DecisionFailureState[] {
    return FAILURE_STATES;
  }

  async checkDecisionAccess(userId: string, tier: SubscriptionTier): Promise<DecisionAccessStatus> {
    const normalized = normalizeSubscriptionTier(tier);
    const limits = this.getTierLimits(normalized);
    const features = getTierFeatures(normalized);
    const decisionsToday = await this.getDecisionsToday(userId);

    const unlimited = tierHasUnlimitedDecisions(normalized);
    const maxDecisions = unlimited ? 999 : (limits.decisionsPerDay as number);
    const canMakeDecision = unlimited || decisionsToday < (limits.decisionsPerDay as number);

    let reason: string | undefined;
    if (!canMakeDecision) {
      reason = "That's your decision for today. Upgrade to Personal Stylist for unlimited decisions.";
    }

    return {
      canMakeDecision,
      decisionsToday,
      maxDecisionsToday: maxDecisions,
      maxImages: features.maxComparisonImages,
      hasSecondOpinion: limits.hasSecondOpinion,
      hasHistory: limits.hasHistory,
      reason,
    };
  }

  async getDecisionsToday(userId: string): Promise<number> {
    try {
      const today = new Date().toDateString();
      const data = await AsyncStorage.getItem(`${DECISIONS_TODAY_KEY}_${userId}`);
      if (!data) return 0;

      const parsed = JSON.parse(data);
      if (parsed.date !== today) return 0;

      return parsed.count;
    } catch {
      return 0;
    }
  }

  async incrementDecisionsToday(userId: string): Promise<void> {
    const today = new Date().toDateString();
    const current = await this.getDecisionsToday(userId);

    await AsyncStorage.setItem(
      `${DECISIONS_TODAY_KEY}_${userId}`,
      JSON.stringify({ date: today, count: current + 1 })
    );
  }

  async getTotalDecisions(userId: string): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(`${TOTAL_DECISIONS_KEY}_${userId}`);
      return data ? parseInt(data, 10) : 0;
    } catch {
      return 0;
    }
  }

  async incrementTotalDecisions(userId: string): Promise<void> {
    const current = await this.getTotalDecisions(userId);
    await AsyncStorage.setItem(`${TOTAL_DECISIONS_KEY}_${userId}`, (current + 1).toString());
  }

  async checkCommunityVotingEligibility(
    userId: string,
    tier: SubscriptionTier,
    hasDFYCompleted: boolean
  ): Promise<CommunityVotingEligibility> {
    const totalDecisions = await this.getTotalDecisions(userId);
    const isPaid = tier !== 'free';

    const eligible = totalDecisions >= 5 || isPaid || hasDFYCompleted;

    let reason = '';
    if (!eligible) {
      reason = "Community votes are available once your stylist knows you better.";
    }

    return {
      eligible,
      reason,
      decisionsCompleted: totalDecisions,
      requiredDecisions: 5,
    };
  }

  async submitDecision(
    request: DecisionRequest,
    tier: SubscriptionTier
  ): Promise<DecisionResponse> {
    const access = await this.checkDecisionAccess(request.userId, tier);
    if (!access.canMakeDecision) {
      const error: any = new Error(access.reason || 'Cannot make decision');
      error.limitCopy = {
        message: access.reason || "That's your decision for today. Your stylist is here whenever you're ready.",
        subtext: "Upgrade for unlimited stylist consultations",
        cta: "Unlock unlimited decisions",
        redirectUrl: "/subscription",
        shouldRedirect: true,
      };
      throw error;
    }

    await this.incrementDecisionsToday(request.userId);
    await this.incrementTotalDecisions(request.userId);

    const template = RESPONSE_TEMPLATES[request.type];
    const recommendation = template.template.replace('{option}', 'Option A');

    const response: DecisionResponse = {
      id: `response-${Date.now()}`,
      requestId: request.id,
      recommendation,
      reasoning: this.generateReasoning(request.type, request.contextChips),
      stylistId: request.stylistId,
      timestamp: new Date().toISOString(),
    };

    if (TIER_LIMITS[tier].hasHistory) {
      await this.saveToHistory(request.userId, request, response, tier);
    }

    return response;
  }

  generateReasoning(type: DecisionType, contexts: DecisionContext[]): string {
    const reasonings: string[] = [];

    if (contexts.includes('versatility')) {
      reasonings.push("It'll work in more situations.");
    }
    if (contexts.includes('comfort')) {
      reasonings.push("You'll feel comfortable all day.");
    }
    if (contexts.includes('budget')) {
      reasonings.push("Better value for what you're getting.");
    }
    if (contexts.includes('trendy')) {
      reasonings.push("Timeless choice that won't date quickly.");
    }
    if (contexts.includes('work-appropriate')) {
      reasonings.push("Professional without being boring.");
    }
    if (contexts.includes('casual')) {
      reasonings.push("Relaxed and effortless.");
    }
    if (contexts.includes('formal')) {
      reasonings.push("Appropriately polished for the occasion.");
    }
    if (contexts.includes('date-night')) {
      reasonings.push("Perfect for making a great impression.");
    }
    if (contexts.includes('weather')) {
      reasonings.push("Chosen with the conditions in mind.");
    }

    if (reasonings.length === 0) {
      reasonings.push("This is the cleaner choice.");
    }

    return reasonings.join(' ');
  }

  formatContextForApi(contexts: DecisionContext[], contextNotes?: string): string {
    const labels = contexts.map(c => {
      const chip = CONTEXT_CHIPS.find(ch => ch.id === c);
      return chip?.label || c;
    });
    if (contextNotes) {
      labels.push(contextNotes);
    }
    return labels.join(', ');
  }

  async requestSecondOpinion(
    requestId: string,
    originalResponse: DecisionResponse,
    tier: SubscriptionTier
  ): Promise<SecondOpinionResponse> {
    if (!TIER_LIMITS[tier].hasSecondOpinion) {
      throw new Error('Second opinions are part of your personal stylist plan.');
    }

    const agrees = Math.random() > 0.2;

    if (agrees) {
      return {
        agrees: true,
        response: "I stand by my first choice. The alternative is trendier, but less you.",
        stylistId: originalResponse.stylistId,
      };
    }

    return {
      agrees: false,
      response: "On second thought, the other option is the safer choice. It'll integrate better with what you already wear.",
      stylistId: originalResponse.stylistId,
    };
  }

  async saveToHistory(
    userId: string,
    request: DecisionRequest,
    response: DecisionResponse,
    tier?: SubscriptionTier | string
  ): Promise<void> {
    const entry = { request, response };

    try {
      const historyData = await AsyncStorage.getItem(`${DECISION_HISTORY_KEY}_${userId}`);
      const history = historyData ? JSON.parse(historyData) : [];
      history.unshift(entry);
      if (history.length > 50) {
        history.pop();
      }
      await AsyncStorage.setItem(`${DECISION_HISTORY_KEY}_${userId}`, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving decision history locally:', error);
    }

    if (!tier || !canSaveDecisionHistory(tier)) {
      return;
    }

    try {
      await apiService.saveDecisionHistory({
        requestId: response.requestId || request.id,
        decisionType: request.type,
        recommendation: response.recommendation,
        reasoning: response.reasoning,
        stylistId: response.stylistId ?? undefined,
        contextNotes: request.contextNotes,
        contextChips: request.contextChips,
        images: request.images,
        responsePayload: response as unknown as Record<string, unknown>,
      });
    } catch (error) {
      console.warn('Decision history server sync failed (local copy kept):', error);
    }
  }

  async getHistory(userId: string, tier?: SubscriptionTier | string): Promise<{ request: DecisionRequest; response: DecisionResponse }[]> {
    const normalizedTier = normalizeSubscriptionTier(tier);

    if (canSaveDecisionHistory(normalizedTier)) {
      try {
        const remote = await apiService.getDecisionHistory();
        if (remote.success && Array.isArray(remote.history) && remote.history.length > 0) {
          const parsed = remote.history as unknown as { request: DecisionRequest; response: DecisionResponse }[];
          await AsyncStorage.setItem(`${DECISION_HISTORY_KEY}_${userId}`, JSON.stringify(parsed));
          return parsed;
        }
      } catch (error) {
        console.warn('Decision history server fetch failed, using local cache:', error);
      }
    }

    try {
      const data = await AsyncStorage.getItem(`${DECISION_HISTORY_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  validateResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    return !FORBIDDEN_LANGUAGE.some(phrase => lowerResponse.includes(phrase));
  }

  /** Free-tier upsell on the decision type picker — upgrade language only, never "included". */
  getDecisionPickerFooterCopy(): string {
    return 'Upgrade to Personal Stylist for unlimited decisions and 3-way shopping compare.';
  }

  /** Tier status copy for limit/paywall surfaces — not for the decision picker footer. */
  getLimitCopy(tier: SubscriptionTier): { title: string; subtitle: string } {
    const normalized = normalizeSubscriptionTier(tier);
    if (normalized === 'free') {
      return {
        title: '1 decision per day',
        subtitle: this.getDecisionPickerFooterCopy(),
      };
    }
    if (normalized === 'personal_stylist') {
      return {
        title: 'Personal Stylist',
        subtitle: 'Unlimited decisions with wardrobe-aware advice.',
      };
    }
    return {
      title: 'Stylist Unlimited',
      subtitle: 'Unlimited decisions with full wardrobe and planning tools.',
    };
  }

  getUpgradeCopy(): { headline: string; cta: string } {
    return {
      headline: "Stop overthinking outfits.",
      cta: 'Upgrade to Personal Stylist',
    };
  }

  getSecondOpinionLockedCopy(): string {
    return 'Second opinions are part of your personal stylist plan.';
  }
}

export const decisionService = new DecisionService();
export default decisionService;
