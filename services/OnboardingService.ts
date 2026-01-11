import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiService } from "@/services/ApiService";

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export interface BodyScanResult {
  bodyType: string;
  kibbeBodyType: string;
  kibbeAnalysis: {
    boneStructure: string;
    bodyFlesh: string;
    facialFeatures: string;
    overallImpression: string;
  };
  proportions: {
    shoulderLine: string;
    waistDefinition: string;
    hipLine: string;
    verticalLine: string;
  };
  confidentAreas: string[];
  heightCategory: string;
  fitPreference: string;
  kibbeStyleRecommendations: string[];
  celebStyleTwins: string[];
  affirmation: string;
  autoFillFields: {
    bodyType: string;
    kibbeBodyType: string;
    confidentAreas: string[];
    fitPreference: string;
    height: string;
  };
  analyzedAt: string;
  aiPowered: boolean;
  message: string;
}

export interface ColorScanResult {
  skinTone: string;
  skinUndertone: string;
  colorSeasonType: string;
  seasonSubtype: string;
  seasonAnalysis: {
    skinCharacteristics: string;
    bestMetals: string;
    contrastLevel: string;
    overallColorProfile: string;
  };
  colorPalette: {
    powerColors: string[];
    neutrals: string[];
    accentColors: string[];
    avoidColors: string[];
  };
  stylingByColor: {
    everyday: string[];
    professional: string[];
    evening: string[];
  };
  makeupHints: {
    lipColors: string[];
    blushTones: string[];
  };
  celebColorTwins: string[];
  personalizedTips: string[];
  autoFillFields: {
    skinTone: string;
    skinUndertone: string;
    colorSeasonType: string;
  };
  analyzedAt: string;
  aiPowered: boolean;
  message: string;
}

export interface StyleQuizQuestion {
  id: number;
  question: string;
  options: {
    value: string;
    text: string;
  }[];
}

export interface StyleQuizConfig {
  questions: StyleQuizQuestion[];
  totalQuestions: number;
  estimatedTime: string;
  description: string;
}

export interface StyleArchetype {
  id: string;
  name: string;
  tagline: string;
  description: string;
  keyPieces: string[];
  colors: string[];
  icons: string[];
  tip: string;
  matchScore: number;
}

export interface StyleQuizCelebration {
  title: string;
  subtitle: string;
  emoji: string;
  matchMessage: string;
  reaction: string;
  showConfetti: boolean;
}

export interface StyleBlend {
  headline: string;
  subheadline: string;
  description: string;
  superpower: string;
  vibes: string[];
  perfectFor: string[];
  funFact: string;
}

export interface QuickStats {
  keyPieces: string[];
  colors: string[];
  icons: string[];
  stylistTip: string;
}

export interface StyleQuizResult {
  primaryArchetype: StyleArchetype;
  secondaryArchetype: StyleArchetype;
  allScores: Record<string, number>;
  autoFillFields: {
    preferredStyles: string[];
  };
  personalizedMessage: string;
  message: string;
  celebration?: StyleQuizCelebration;
  styleBlend?: StyleBlend;
  quickStats?: QuickStats;
}

export interface CameraGuidanceTimer {
  enabled: boolean;
  durationSeconds: number;
  countdownText: string[];
}

export interface CameraGuidanceOverlay {
  type: 'body-silhouette' | 'face-oval';
  aspectRatio: string;
  guideText: {
    top: string;
    middle: string;
    bottom: string;
  };
}

export interface CameraGuidancePositioning {
  distance: string;
  lighting?: string;
  angle?: string;
}

export interface CameraGuidance {
  timer: CameraGuidanceTimer;
  overlay: CameraGuidanceOverlay;
  tips: string[];
  positioning: CameraGuidancePositioning;
}

class OnboardingServiceClass {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await apiService.getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async bodyScan(imageBase64: string): Promise<BodyScanResult> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_URL}/api/onboarding/body-scan`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64,
        autoSave: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Body scan failed: ${error}`);
    }

    return response.json();
  }

  async colorScan(imageBase64: string): Promise<ColorScanResult> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_URL}/api/onboarding/color-scan`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64,
        autoSave: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Color scan failed: ${error}`);
    }

    return response.json();
  }

  async getStyleQuiz(gender?: string): Promise<StyleQuizConfig> {
    const headers = await this.getAuthHeaders();
    const url = gender 
      ? `${API_URL}/api/onboarding/style-quiz?gender=${encodeURIComponent(gender)}`
      : `${API_URL}/api/onboarding/style-quiz`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get style quiz: ${error}`);
    }

    return response.json();
  }

  async submitStyleQuiz(answers: { questionId: number; answer: string }[]): Promise<StyleQuizResult> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_URL}/api/onboarding/style-quiz/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        answers,
        autoSave: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Style quiz submission failed: ${error}`);
    }

    return response.json();
  }

  async getBodyScanGuidance(): Promise<CameraGuidance> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_URL}/api/onboarding/body-scan/guidance`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get body scan guidance: ${error}`);
    }

    return response.json();
  }

  async getColorScanGuidance(): Promise<CameraGuidance> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_URL}/api/onboarding/color-scan/guidance`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get color scan guidance: ${error}`);
    }

    return response.json();
  }
}

export const OnboardingService = new OnboardingServiceClass();
