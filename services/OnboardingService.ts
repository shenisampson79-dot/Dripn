import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiService } from "@/services/ApiService";

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://0ff35e7b-c52b-436f-bc3a-caa12ac9e07a-00-ladpqjdev6jc.spock.replit.dev:3000';

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
    try {
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
        throw new Error(`Server returned ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.log("Backend unavailable, using local quiz result:", error);
      return this.generateLocalQuizResult(answers);
    }
  }

  private generateLocalQuizResult(answers: { questionId: number; answer: string }[]): StyleQuizResult {
    const archetypes: StyleArchetype[] = [
      { id: 'classic', name: 'Classic', tagline: 'Timeless elegance', description: 'Timeless elegance and refined taste', keyPieces: ['Blazer', 'White Shirt', 'Trench Coat'], colors: ['Navy', 'White', 'Camel'], icons: ['crown', 'star', 'award'], tip: 'Invest in quality basics', matchScore: 85 },
      { id: 'minimalist', name: 'Minimalist', tagline: 'Less is more', description: 'Clean lines and understated beauty', keyPieces: ['White Tee', 'Black Jeans', 'Sneakers'], colors: ['Black', 'White', 'Grey'], icons: ['minus', 'square', 'circle'], tip: 'Focus on silhouettes', matchScore: 82 },
      { id: 'bohemian', name: 'Bohemian', tagline: 'Free spirit', description: 'Free-spirited and artistic expression', keyPieces: ['Maxi Dress', 'Fringe Bag', 'Layered Necklaces'], colors: ['Terracotta', 'Sage', 'Cream'], icons: ['sun', 'feather', 'leaf'], tip: 'Embrace textures and layers', matchScore: 78 },
      { id: 'edgy', name: 'Edgy', tagline: 'Break the rules', description: 'Bold choices and contemporary edge', keyPieces: ['Leather Jacket', 'Combat Boots', 'Statement Ring'], colors: ['Black', 'Silver', 'Burgundy'], icons: ['zap', 'star', 'target'], tip: 'Mix unexpected elements', matchScore: 80 },
      { id: 'romantic', name: 'Romantic', tagline: 'Soft and dreamy', description: 'Soft, feminine and dreamy aesthetics', keyPieces: ['Floral Dress', 'Lace Top', 'Pearl Earrings'], colors: ['Blush', 'Lavender', 'Ivory'], icons: ['heart', 'flower', 'star'], tip: 'Play with soft fabrics', matchScore: 83 },
    ];

    const randomIndex = Math.floor(Math.random() * archetypes.length);
    const primary = archetypes[randomIndex];
    const secondary = archetypes[(randomIndex + 1) % archetypes.length];

    return {
      primaryArchetype: primary,
      secondaryArchetype: secondary,
      allScores: { [primary.id]: primary.matchScore, [secondary.id]: secondary.matchScore },
      autoFillFields: {
        preferredStyles: [primary.id, secondary.id],
      },
      personalizedMessage: `Your style profile shows you lean towards ${primary.name} with hints of ${secondary.name}. This means you appreciate ${primary.tagline.toLowerCase()} aesthetics with a touch of ${secondary.tagline.toLowerCase()} flair.`,
      message: `Welcome to your personalized style journey with ${primary.name} and ${secondary.name} influences!`,
      celebration: {
        title: 'Style Profile Complete!',
        subtitle: `You're a ${primary.name} at heart`,
        emoji: '✨',
        matchMessage: `${primary.matchScore}% match with ${primary.name}`,
        reaction: 'Your stylist is excited to work with you!',
        showConfetti: true,
      },
    };
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
          top: "Fit your whole body in frame (head to feet)",
          middle: "Stand straight, arms relaxed",
          bottom: ""
        },
        targetZoneLabel: "Stand straight, arms relaxed"
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
          description: "Stand facing natural light or a well-lit area"
        },
        {
          icon: "user",
          title: "Form-fitting clothes",
          description: "Wear fitted clothing so we can see your natural shape"
        },
        {
          icon: "smartphone",
          title: "Prop your phone",
          description: "Use a shelf, lean against something, or ask someone to help"
        },
        {
          icon: "eye",
          title: "Full body visible",
          description: "Step back so your entire body fits in the frame"
        }
      ],
      tipsSimple: [
        "Good lighting: Stand facing natural light or a well-lit area",
        "Form-fitting clothes: Wear fitted clothing so we can see your natural shape",
        "Prop your phone: Use a shelf, lean against something, or ask someone to help",
        "Full body visible: Step back so your entire body fits in the frame"
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
