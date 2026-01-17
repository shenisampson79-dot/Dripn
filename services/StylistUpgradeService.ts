import { apiService } from "./ApiService";

export type SignalType = "DEPTH" | "RELIANCE" | "FRUSTRATION" | "AMBITION";

export type UnlockType = "dfy_options" | "subscription" | "premium_tiers";

export interface UpgradeCopy {
  message: string;
  followUp?: string;
  cta: string[];
  unlocks: UnlockType;
}

export interface StylistUpgradeResponse {
  copy: UpgradeCopy;
}

export interface PostRecommendationUI {
  buttons: {
    save: { label: string; icon: string };
    another: { label: string; icon: string };
    secondOpinion: { label: string; icon: string };
  };
  tweakPlaceholder: string;
  saveBehaviour: {
    maxCached: number;
    promptAfter: number;
    cacheKey: string;
  };
}

export interface TierCapabilities {
  tiers: {
    id: string;
    name: string;
    capabilities: string[];
    limitations: string[];
  }[];
  founderDoctrine?: {
    principles: string[];
  };
}

export interface StylistLanguage {
  stylistId: string;
  tone: string;
  vocabulary: string[];
  avoidWords: string[];
  signaturePhrase?: string;
}

export interface SignalTypesResponse {
  signals: {
    type: SignalType;
    triggers: string[];
    description: string;
  }[];
}

export interface DfyJobInfo {
  jobId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  type: "outfit" | "core";
  itemsUploaded?: number;
  itemsProcessed?: number;
  estimatedCompletion?: string;
  turnaround: string;
}

const SIGNAL_TRIGGERS: Record<SignalType, string[]> = {
  DEPTH: [
    "plan my week",
    "what should i pack",
    "capsule wardrobe",
    "outfit calendar",
    "weekly plan",
    "travel wardrobe",
    "vacation outfits",
  ],
  RELIANCE: [
    "thanks, that",
    "perfect, i'll wear",
    "love it",
    "you're right",
    "good choice",
    "i trust you",
  ],
  FRUSTRATION: [
    "you're missing clothes",
    "you don't know what i own",
    "that's not in my wardrobe",
    "i don't have that",
    "wrong suggestion",
    "not helpful",
  ],
  AMBITION: [
    "can you do what a real stylist does",
    "magazine-level",
    "celebrity style",
    "designer looks",
    "high fashion",
    "runway",
  ],
};

class StylistUpgradeService {
  detectSignal(userMessage: string): SignalType | null {
    const lowerMessage = userMessage.toLowerCase();

    for (const [signalType, triggers] of Object.entries(SIGNAL_TRIGGERS)) {
      for (const trigger of triggers) {
        if (lowerMessage.includes(trigger)) {
          return signalType as SignalType;
        }
      }
    }

    return null;
  }

  async getUpgradeCopy(stylistId: string, signalType: SignalType): Promise<UpgradeCopy | null> {
    try {
      const data = await apiService.get<StylistUpgradeResponse>(
        `/api/onboarding/stylist-upgrade-copy?stylistId=${stylistId}&signalType=${signalType}`
      );
      return data?.copy || null;
    } catch (error) {
      console.log("Failed to fetch upgrade copy");
      return this.getDefaultUpgradeCopy(stylistId, signalType);
    }
  }

  private getDefaultUpgradeCopy(stylistId: string, signalType: SignalType): UpgradeCopy {
    const stylistMessages: Record<string, Record<SignalType, UpgradeCopy>> = {
      ruby: {
        DEPTH: {
          message: "Oh, I'd absolutely love to help you plan that properly, darling...",
          followUp: "I can take care of the setup for you...",
          cta: ["Show me options", "Maybe later"],
          unlocks: "dfy_options",
        },
        RELIANCE: {
          message: "I'm so glad you trust my taste!",
          followUp: "Imagine if I knew your entire wardrobe...",
          cta: ["Tell me more", "Not now"],
          unlocks: "dfy_options",
        },
        FRUSTRATION: {
          message: "You're absolutely right, I'm working with limited info here.",
          followUp: "Let me fix that for you...",
          cta: ["Yes please", "Not yet"],
          unlocks: "dfy_options",
        },
        AMBITION: {
          message: "Oh darling, I can definitely elevate your style!",
          followUp: "With your full wardrobe, we could create magic...",
          cta: ["Show me how", "Maybe later"],
          unlocks: "dfy_options",
        },
      },
      max: {
        DEPTH: {
          message: "I'd love to help you plan ahead!",
          followUp: "Let me set things up properly for you...",
          cta: ["Sounds good", "Not right now"],
          unlocks: "dfy_options",
        },
        RELIANCE: {
          message: "Happy to help! And this is just the start.",
          followUp: "With your wardrobe uploaded, I can do so much more...",
          cta: ["Tell me more", "I'm good for now"],
          unlocks: "dfy_options",
        },
        FRUSTRATION: {
          message: "I hear you. I'm missing some pieces of the puzzle.",
          followUp: "Let's fix that together...",
          cta: ["Let's do it", "Maybe later"],
          unlocks: "dfy_options",
        },
        AMBITION: {
          message: "Absolutely! I can help you level up your style.",
          followUp: "With your full wardrobe, we can work wonders...",
          cta: ["Show me", "Not now"],
          unlocks: "dfy_options",
        },
      },
      jade: {
        DEPTH: {
          message: "Planning ahead? Smart. Let's do this properly.",
          followUp: "I'll need your wardrobe to give you real advice.",
          cta: ["Set it up", "Skip for now"],
          unlocks: "dfy_options",
        },
        RELIANCE: {
          message: "Good. You're listening. That's step one.",
          followUp: "Step two: let me see what you actually own.",
          cta: ["Fine, show me", "Pass"],
          unlocks: "dfy_options",
        },
        FRUSTRATION: {
          message: "You're right. I don't have the full picture.",
          followUp: "Let me fix that. I'll take care of it.",
          cta: ["Go ahead", "Not yet"],
          unlocks: "dfy_options",
        },
        AMBITION: {
          message: "Magazine-level? That requires proper intel.",
          followUp: "Give me your wardrobe and I'll give you results.",
          cta: ["Let's go", "Later"],
          unlocks: "dfy_options",
        },
      },
      marcus: {
        DEPTH: {
          message: "Planning? Good. Let's get you sorted properly.",
          followUp: "I need to see what you're working with.",
          cta: ["Set me up", "Not now"],
          unlocks: "dfy_options",
        },
        RELIANCE: {
          message: "Glad that worked. Imagine what I could do with more info.",
          followUp: "Upload your wardrobe and watch the magic.",
          cta: ["Show me how", "I'm fine"],
          unlocks: "dfy_options",
        },
        FRUSTRATION: {
          message: "Fair point. I'm flying blind here.",
          followUp: "Fix that and we're in business.",
          cta: ["Fix it", "Later"],
          unlocks: "dfy_options",
        },
        AMBITION: {
          message: "High fashion? You'll need the full service for that.",
          followUp: "Let me set you up properly.",
          cta: ["Do it", "Maybe later"],
          unlocks: "dfy_options",
        },
      },
    };

    const stylistKey = stylistId.toLowerCase();
    return (
      stylistMessages[stylistKey]?.[signalType] ||
      stylistMessages.ruby[signalType]
    );
  }

  async getPostRecommendationUI(): Promise<PostRecommendationUI | null> {
    try {
      const data = await apiService.get<PostRecommendationUI>("/api/onboarding/post-recommendation-ui");
      return data;
    } catch (error) {
      console.log("Failed to fetch post-recommendation UI config");
      return {
        buttons: {
          save: { label: "Save outfit", icon: "bookmark" },
          another: { label: "Another option", icon: "refresh-cw" },
          secondOpinion: { label: "Second opinion", icon: "users" },
        },
        tweakPlaceholder: "Want to tweak this?",
        saveBehaviour: {
          maxCached: 3,
          promptAfter: 1,
          cacheKey: "dripn_cached_outfits",
        },
      };
    }
  }

  async getTierCapabilities(): Promise<TierCapabilities | null> {
    try {
      const data = await apiService.get<TierCapabilities>("/api/onboarding/tier-capabilities");
      return data;
    } catch (error) {
      console.log("Failed to fetch tier capabilities");
      return {
        tiers: [
          {
            id: "outfit",
            name: "Outfit-Based Setup",
            capabilities: ["AI learns your style", "Quick recommendations", "Occasion-based advice"],
            limitations: ["Limited wardrobe visibility", "No item-level suggestions"],
          },
          {
            id: "core",
            name: "Core Wardrobe Setup",
            capabilities: ["Full wardrobe visibility", "Item-level recommendations", "Outfit combinations", "Seasonal planning"],
            limitations: [],
          },
        ],
      };
    }
  }

  async getStylistLanguage(stylistId: string): Promise<StylistLanguage | null> {
    try {
      const data = await apiService.get<StylistLanguage>(`/api/onboarding/stylist-language?stylistId=${stylistId}`);
      return data;
    } catch (error) {
      console.log("Failed to fetch stylist language constraints");
      return this.getDefaultStylistLanguage(stylistId);
    }
  }

  private getDefaultStylistLanguage(stylistId: string): StylistLanguage {
    const defaults: Record<string, StylistLanguage> = {
      ruby: {
        stylistId: "ruby",
        tone: "warm, empathetic, encouraging",
        vocabulary: ["darling", "lovely", "absolutely", "gorgeous"],
        avoidWords: ["ugly", "terrible", "wrong"],
        signaturePhrase: "You're going to look wonderful!",
      },
      max: {
        stylistId: "max",
        tone: "supportive, approachable, confidence-building",
        vocabulary: ["great", "awesome", "solid choice", "looking good"],
        avoidWords: ["bad", "wrong", "terrible"],
        signaturePhrase: "You've got this!",
      },
      jade: {
        stylistId: "jade",
        tone: "direct, honest, no-nonsense",
        vocabulary: ["works", "doesn't work", "better", "try this instead"],
        avoidWords: ["maybe", "perhaps", "I think"],
        signaturePhrase: "Trust me on this.",
      },
      marcus: {
        stylistId: "marcus",
        tone: "blunt, decisive, straight-talking",
        vocabulary: ["done", "sorted", "next", "wear this"],
        avoidWords: ["um", "maybe", "possibly"],
        signaturePhrase: "That's the one. Go.",
      },
    };
    return defaults[stylistId.toLowerCase()] || defaults.ruby;
  }

  async getSignalTypes(): Promise<SignalTypesResponse | null> {
    try {
      const data = await apiService.get<SignalTypesResponse>("/api/onboarding/signal-types");
      return data;
    } catch (error) {
      console.log("Failed to fetch signal types");
      return {
        signals: [
          { type: "DEPTH", triggers: ["plan my week", "what should I pack", "capsule wardrobe"], description: "User wants deeper planning" },
          { type: "RELIANCE", triggers: ["thanks, that", "love it", "you're right"], description: "User trusts recommendations" },
          { type: "FRUSTRATION", triggers: ["you're missing clothes", "you don't know what I own"], description: "User frustrated by limited info" },
          { type: "AMBITION", triggers: ["magazine-level", "celebrity style"], description: "User wants elevated styling" },
        ],
      };
    }
  }

  async recordSignal(signalType: SignalType, stylistId: string, context?: string): Promise<boolean> {
    try {
      await apiService.post("/api/onboarding/record-signal", {
        signalType,
        stylistId,
        context,
        timestamp: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.log("Failed to record signal");
      return false;
    }
  }

  async getDfyJobInfo(jobId?: string): Promise<DfyJobInfo | null> {
    try {
      const endpoint = jobId 
        ? `/api/onboarding/dfy-job-info?jobId=${jobId}`
        : "/api/onboarding/dfy-job-info";
      const data = await apiService.get<DfyJobInfo>(endpoint);
      return data;
    } catch (error) {
      console.log("Failed to fetch DFY job info");
      return {
        status: "pending",
        type: "outfit",
        turnaround: "24h",
      };
    }
  }
}

export const stylistUpgradeService = new StylistUpgradeService();
