import { apiService } from "./ApiService";
import { onboardingSessionService } from "./OnboardingSessionService";

export type StyleDirection = "masculine" | "feminine" | "androgynous" | "not_sure";

export interface FirstPromptOption {
  id: string;
  label: string;
  icon: string;
}

export interface GenderSafeDefaults {
  firstPrompt: {
    question: string;
    options: FirstPromptOption[];
  };
  safeGarments?: string[];
  avoidGarments?: string[];
  systemConstraint?: string;
}

export interface StyleDirectionResponse {
  useGenderSafe: boolean;
  styleDirection?: StyleDirection;
}

class StyleDirectionService {
  async getGenderSafeDefaults(): Promise<GenderSafeDefaults> {
    try {
      const data = await apiService.get<GenderSafeDefaults>("/api/onboarding/gender-safe-defaults");
      return data || this.getDefaultConfig();
    } catch (error) {
      console.log("Failed to fetch gender-safe defaults");
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): GenderSafeDefaults {
    return {
      firstPrompt: {
        question: "What do you want help with right now?",
        options: [
          { id: "today", label: "What to wear today", icon: "sun" },
          { id: "event", label: "What to wear to an event", icon: "calendar" },
          { id: "confidence", label: "Building confidence in my style", icon: "heart" },
          { id: "smarter", label: "Buying less / shopping smarter", icon: "check-square" },
        ],
      },
      safeGarments: [
        "trousers", "jeans", "t-shirt", "shirt", "sweater", "hoodie", 
        "jacket", "coat", "sneakers", "boots", "loafers", "blazer"
      ],
      avoidGarments: [
        "dress", "skirt", "heels", "high heels", "stilettos", "gown",
        "miniskirt", "crop top", "tube top", "bodycon"
      ],
      systemConstraint: "Until the user specifies their style direction, only recommend gender-neutral garments like trousers, jeans, shirts, t-shirts, sweaters, jackets, coats, sneakers, boots, and blazers. Avoid suggesting dresses, skirts, heels, or other gendered items until the user clarifies their preference.",
    };
  }

  async getGenderSafeConstraint(): Promise<string | null> {
    const response = await this.getStyleDirection();
    if (response.useGenderSafe) {
      const defaults = await this.getGenderSafeDefaults();
      return defaults.systemConstraint || this.getDefaultConfig().systemConstraint || null;
    }
    return null;
  }

  async setStyleDirection(
    styleDirection: StyleDirection,
    source: "chips" | "chat" | "onboarding" = "chips"
  ): Promise<boolean> {
    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      await apiService.post("/api/onboarding/set-style-direction", {
        deviceId,
        styleDirection,
        source,
      });
      return true;
    } catch (error) {
      console.log("Failed to set style direction");
      return false;
    }
  }

  async getStyleDirection(): Promise<StyleDirectionResponse> {
    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      const data = await apiService.get<StyleDirectionResponse>(
        `/api/onboarding/get-style-direction?deviceId=${deviceId}`
      );
      return data || { useGenderSafe: true };
    } catch (error) {
      console.log("Failed to get style direction");
      return { useGenderSafe: true };
    }
  }

  getStyleChips(): { id: StyleDirection; label: string }[] {
    return [
      { id: "masculine", label: "Masculine" },
      { id: "feminine", label: "Feminine" },
      { id: "androgynous", label: "Androgynous" },
      { id: "not_sure", label: "Not sure yet" },
    ];
  }

  getSoftClarificationMessage(): string {
    return "If you want, I can tailor this more closely — tell me a bit about what you usually wear.";
  }

  async getFirstMessages(profile?: {
    dressFor?: string;
    identity?: string;
    quizGender?: string;
    likedStyles?: string[];
    quizComplete?: boolean;
  }): Promise<{
    message: string;
    options: { id: string; label: string }[];
    skipOccasion?: boolean;
    occasion?: string;
  }> {
    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      const params = new URLSearchParams({ deviceId });
      if (profile?.dressFor) params.set('dressFor', profile.dressFor);
      if (profile?.identity) params.set('identity', profile.identity);
      if (profile?.quizGender) params.set('quizGender', profile.quizGender);
      if (profile?.likedStyles?.length) params.set('likedStyles', profile.likedStyles.join(','));
      if (profile?.quizComplete) params.set('quizComplete', 'true');

      const data = await apiService.get<{
        message?: string;
        options?: { id: string; label: string }[];
        skipOccasion?: boolean;
        occasion?: string;
        messages?: { entry?: { message: string; buttons: { id: string; label: string }[] } };
      }>(`/api/onboarding/first-messages?${params.toString()}`);

      if (data?.message) {
        return {
          message: data.message,
          options: data.options || [],
          skipOccasion: data.skipOccasion,
          occasion: data.occasion,
        };
      }

      if (data?.messages?.entry) {
        return {
          message: data.messages.entry.message,
          options: data.messages.entry.buttons,
          skipOccasion: false,
        };
      }

      return this.getDefaultFirstMessages(profile);
    } catch (error) {
      console.log("Failed to fetch first messages");
      return this.getDefaultFirstMessages(profile);
    }
  }

  private getDefaultFirstMessages(profile?: { dressFor?: string }) {
    if (profile?.dressFor) {
      const labels: Record<string, string> = {
        work: 'work / meetings',
        date: 'a date or romance',
        friends: 'going out with friends',
        event: 'an event or special occasion',
        myself: 'yourself today',
      };
      const label = labels[profile.dressFor] || profile.dressFor;
      return {
        message: `Got it — you're dressing for ${label}. I'm deciding your outfit now.`,
        options: [] as { id: string; label: string }[],
        skipOccasion: true,
        occasion: profile.dressFor,
      };
    }
    return {
      message: "Tell me what you're dressing for — I'll decide the outfit.",
      options: [
        { id: "work", label: "Work" },
        { id: "date", label: "Date" },
        { id: "casual", label: "Casual" },
        { id: "event", label: "Event" },
        { id: "browsing", label: "Just browsing" },
      ],
      skipOccasion: false,
    };
  }

  async recordStyleExpression(expression: string): Promise<boolean> {
    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      await apiService.post("/api/onboarding/record-style-expression", {
        deviceId,
        expression,
      });
      return true;
    } catch (error) {
      console.log("Failed to record style expression");
      return false;
    }
  }

  async getStyleExpression(): Promise<{
    hasExpression: boolean;
    hints?: string[];
  }> {
    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      const data = await apiService.get<{
        hasExpression: boolean;
        hints?: string[];
      }>(`/api/onboarding/get-style-expression?deviceId=${deviceId}`);
      return data || { hasExpression: false };
    } catch (error) {
      console.log("Failed to get style expression");
      return { hasExpression: false };
    }
  }

  getCalibrationMessage(): string {
    return "If you want me to dial this in, tell me anything you want me to know...";
  }

  getExpressionPlaceholder(): string {
    return "I live in jeans and trainers";
  }
}

export const styleDirectionService = new StyleDirectionService();
