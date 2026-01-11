import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiService } from "@/services/ApiService";

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export interface ScanReview {
  showCapturedImage: boolean;
  allowRetake: boolean;
  confirmButtonText: string;
  retakeButtonText: string;
  adjustButtonText?: string;
}

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
  review?: ScanReview;
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
  review?: ScanReview;
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
  guideText?: {
    top?: string;
    middle?: string;
    bottom?: string;
  };
  targetZoneLabel?: string;
}

export interface CameraGuidancePositioning {
  distance: string;
  lighting?: string;
  angle?: string;
}

export interface CameraGuidanceTip {
  icon: string;
  title: string;
  description: string;
}

export interface CameraGuidance {
  timer: CameraGuidanceTimer;
  overlay: CameraGuidanceOverlay;
  tips: CameraGuidanceTip[];
  tipsSimple: string[];
  positioning: CameraGuidancePositioning;
}

export interface OnboardingProgress {
  onboardingStep: number;
  stepProgress: {
    step: number;
    name: string;
    complete: boolean;
  }[];
  onboardingComplete: boolean;
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
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_URL}/api/onboarding/body-scan/guidance`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }

      return response.json();
    } catch (error) {
      console.log("Using fallback body scan guidance:", error);
      return this.getFallbackBodyScanGuidance();
    }
  }

  private getFallbackBodyScanGuidance(): CameraGuidance {
    return {
      timer: {
        enabled: true,
        durationSeconds: 3,
        countdownText: ["3", "2", "1", "Scanning..."]
      },
      overlay: {
        type: "body-silhouette",
        aspectRatio: "9:16",
        guideText: {
          top: "Stand back so your full body is visible",
          middle: "Align yourself with the silhouette",
          bottom: "Keep your arms slightly away from your body"
        },
        targetZoneLabel: "Full Body"
      },
      tips: [
        {
          icon: "maximize",
          title: "Full Body Visible",
          description: "Stand far enough back that your entire body from head to feet is in frame"
        },
        {
          icon: "sun",
          title: "Good Lighting",
          description: "Make sure you're well-lit so your body shape is clearly visible"
        },
        {
          icon: "user",
          title: "Form-Fitting Clothes",
          description: "Wear fitted clothing for the most accurate body type detection"
        }
      ],
      tipsSimple: [
        "Stand back so your full body is visible",
        "Wear form-fitting clothes for accuracy",
        "Good lighting helps detection",
        "Keep arms slightly away from body"
      ],
      positioning: {
        distance: "6-8 feet from camera",
        lighting: "well-lit area",
        angle: "straight on, facing camera"
      }
    };
  }

  async getColorScanGuidance(): Promise<CameraGuidance> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_URL}/api/onboarding/color-scan/guidance`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }

      return response.json();
    } catch (error) {
      console.log("Using fallback color scan guidance:", error);
      return this.getFallbackColorScanGuidance();
    }
  }

  private getFallbackColorScanGuidance(): CameraGuidance {
    return {
      timer: {
        enabled: true,
        durationSeconds: 3,
        countdownText: ["3", "2", "1", "Analyzing..."]
      },
      overlay: {
        type: "face-oval",
        aspectRatio: "3:4",
        guideText: {
          top: "Position your face in the oval",
          middle: "",
          bottom: "Good lighting helps accuracy"
        },
        targetZoneLabel: "Face"
      },
      tips: [
        {
          icon: "sun",
          title: "Natural Lighting",
          description: "Stand near a window with natural daylight for the most accurate color analysis"
        },
        {
          icon: "camera",
          title: "Remove Makeup",
          description: "For best results, remove any makeup so we can see your natural skin tone"
        },
        {
          icon: "user",
          title: "Show Your Face",
          description: "Position your face clearly in the frame, avoiding shadows"
        }
      ],
      tipsSimple: [
        "Use natural daylight for best results",
        "Remove makeup if possible",
        "Avoid harsh shadows on your face",
        "Keep a neutral expression"
      ],
      positioning: {
        distance: "arm's length",
        lighting: "natural daylight preferred",
        angle: "straight on, looking at camera"
      }
    };
  }

  async getOnboardingProgress(): Promise<OnboardingProgress> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_URL}/api/onboarding/progress`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get onboarding progress: ${error}`);
    }

    return response.json();
  }
}

export const OnboardingService = new OnboardingServiceClass();
