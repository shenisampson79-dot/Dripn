import AsyncStorage from '@react-native-async-storage/async-storage';
import { StylistId, SubscriptionTier } from '@/contexts/AuthContext';

export type DecisionType = 'shopping' | 'what-to-wear' | 'event-outfit' | 'sanity-check';
export type DecisionContext = 'comfort' | 'versatility' | 'budget' | 'trendy' | 'work-appropriate';

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
  stylistId: StylistId;
  timestamp: string;
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
  { id: 'comfort', label: 'Comfort' },
  { id: 'versatility', label: 'Versatility' },
  { id: 'budget', label: 'Budget' },
  { id: 'trendy', label: 'Trendy vs timeless' },
  { id: 'work-appropriate', label: 'Work-appropriate' },
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
  premium: {
    tier: 'premium',
    decisionsPerDay: 'unlimited',
    maxImages: 3,
    hasSecondOpinion: true,
    hasHistory: true,
    hasCommunityVoting: true,
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

  getContextChips(): { id: DecisionContext; label: string }[] {
    return CONTEXT_CHIPS;
  }

  getTierLimits(tier: SubscriptionTier): DecisionLimits {
    return TIER_LIMITS[tier];
  }

  getFailureStates(): DecisionFailureState[] {
    return FAILURE_STATES;
  }

  async checkDecisionAccess(userId: string, tier: SubscriptionTier): Promise<DecisionAccessStatus> {
    const limits = this.getTierLimits(tier);
    const decisionsToday = await this.getDecisionsToday(userId);

    const maxDecisions = limits.decisionsPerDay === 'unlimited' ? 999 : limits.decisionsPerDay;
    const canMakeDecision = limits.decisionsPerDay === 'unlimited' || decisionsToday < limits.decisionsPerDay;

    let reason: string | undefined;
    if (!canMakeDecision) {
      reason = "That's your decision for today. Your stylist is here whenever you're ready.";
    }

    return {
      canMakeDecision,
      decisionsToday,
      maxDecisionsToday: maxDecisions,
      maxImages: limits.maxImages,
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
    const isPaid = tier === 'premium';

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
      throw new Error(access.reason || 'Cannot make decision');
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
      await this.saveToHistory(request.userId, request, response);
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

    if (reasonings.length === 0) {
      reasonings.push("This is the cleaner choice.");
    }

    return reasonings.join(' ');
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
    response: DecisionResponse
  ): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem(`${DECISION_HISTORY_KEY}_${userId}`);
      const history = historyData ? JSON.parse(historyData) : [];

      history.unshift({ request, response });

      if (history.length > 50) {
        history.pop();
      }

      await AsyncStorage.setItem(`${DECISION_HISTORY_KEY}_${userId}`, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving decision history:', error);
    }
  }

  async getHistory(userId: string): Promise<{ request: DecisionRequest; response: DecisionResponse }[]> {
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

  getLimitCopy(tier: SubscriptionTier): { title: string; subtitle: string } {
    const limits = this.getTierLimits(tier);

    if (limits.decisionsPerDay === 'unlimited') {
      return {
        title: 'Your stylist, on call',
        subtitle: 'Unlimited decisions whenever you need them',
      };
    }

    return {
      title: `${limits.decisionsPerDay} decision${limits.decisionsPerDay > 1 ? 's' : ''} per day`,
      subtitle: "One decision a day, on me.",
    };
  }

  getUpgradeCopy(): { headline: string; cta: string } {
    return {
      headline: "Outfits shouldn't take this much thinking.",
      cta: 'Unlock unlimited decisions',
    };
  }

  getSecondOpinionLockedCopy(): string {
    return 'Second opinions are part of your personal stylist plan.';
  }
}

export const decisionService = new DecisionService();
export default decisionService;
