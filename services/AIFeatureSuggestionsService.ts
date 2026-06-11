import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import TrendInsightsService, { 
  TrendingItem, 
  FashionInfluencer, 
  ColorTrend, 
  StyleMovement 
} from './TrendInsightsService';
import { supportService, TICKET_CATEGORIES } from './SupportService';
import { API_URL } from '@/config/api';

const FEATURE_SUGGESTIONS_KEY = '@dripn_feature_suggestions';
const FEEDBACK_DATA_KEY = '@dripn_feedback_data';
const LAST_ANALYSIS_KEY = '@dripn_last_feature_analysis';

export interface FeatureSuggestion {
  id: string;
  title: string;
  description: string;
  category: FeatureCategory;
  priority: 'high' | 'medium' | 'low';
  source: SuggestionSource;
  rationale: string;
  userBenefit: string;
  implementationComplexity: 'simple' | 'moderate' | 'complex';
  estimatedImpact: 'high' | 'medium' | 'low';
  targetTier: 'all' | 'premium';
  createdAt: string;
  status: 'new' | 'reviewed' | 'approved' | 'rejected' | 'implemented';
  votes: number;
  relatedTrends?: string[];
  aiConfidence: number;
}

export type FeatureCategory = 
  | 'ai-styling'
  | 'social-features'
  | 'wardrobe-management'
  | 'shopping-integration'
  | 'events-discovery'
  | 'community'
  | 'personalization'
  | 'accessibility'
  | 'content-creation'
  | 'subscription-value'
  | 'user-experience';

export type SuggestionSource = 
  | 'trend-analysis'
  | 'user-feedback'
  | 'usage-patterns'
  | 'support-tickets'
  | 'industry-benchmark'
  | 'ai-prediction';

export interface FeedbackData {
  supportTicketPatterns: {
    category: string;
    count: number;
    keywords: string[];
  }[];
  featureRequests: string[];
  painPoints: string[];
  positiveAspects: string[];
  usagePatterns: {
    mostUsedFeatures: string[];
    leastUsedFeatures: string[];
    peakUsageTimes: string[];
  };
  collectedAt: string;
}

export interface AnalysisContext {
  currentTrends: string[];
  colorTrends: string[];
  styleMovements: string[];
  topInfluencers: string[];
  seasonalFocus: string;
  userFeedback: FeedbackData | null;
  appInsights: {
    totalUsers: number;
    activeFeatures: string[];
    underutilizedFeatures: string[];
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

class AIFeatureSuggestionsService {
  private suggestions: FeatureSuggestion[] = [];
  private feedbackData: FeedbackData | null = null;
  private lastAnalysisDate: string | null = null;

  async initialize(): Promise<void> {
    await this.loadSuggestions();
    await this.loadFeedbackData();
    await this.loadLastAnalysisDate();
  }

  private async loadSuggestions(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FEATURE_SUGGESTIONS_KEY);
      if (stored) {
        this.suggestions = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading feature suggestions:', error);
    }
  }

  private async saveSuggestions(): Promise<void> {
    try {
      await AsyncStorage.setItem(FEATURE_SUGGESTIONS_KEY, JSON.stringify(this.suggestions));
    } catch (error) {
      console.error('Error saving feature suggestions:', error);
    }
  }

  private async loadFeedbackData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FEEDBACK_DATA_KEY);
      if (stored) {
        this.feedbackData = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading feedback data:', error);
    }
  }

  private async saveFeedbackData(): Promise<void> {
    try {
      await AsyncStorage.setItem(FEEDBACK_DATA_KEY, JSON.stringify(this.feedbackData));
    } catch (error) {
      console.error('Error saving feedback data:', error);
    }
  }

  private async loadLastAnalysisDate(): Promise<void> {
    try {
      this.lastAnalysisDate = await AsyncStorage.getItem(LAST_ANALYSIS_KEY);
    } catch (error) {
      console.error('Error loading last analysis date:', error);
    }
  }

  private async saveLastAnalysisDate(): Promise<void> {
    try {
      this.lastAnalysisDate = new Date().toISOString();
      await AsyncStorage.setItem(LAST_ANALYSIS_KEY, this.lastAnalysisDate);
    } catch (error) {
      console.error('Error saving last analysis date:', error);
    }
  }

  getSuggestions(): FeatureSuggestion[] {
    return [...this.suggestions].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  getSuggestionsByCategory(category: FeatureCategory): FeatureSuggestion[] {
    return this.getSuggestions().filter(s => s.category === category);
  }

  getSuggestionsByStatus(status: FeatureSuggestion['status']): FeatureSuggestion[] {
    return this.getSuggestions().filter(s => s.status === status);
  }

  getLastAnalysisDate(): string | null {
    return this.lastAnalysisDate;
  }

  async collectFeedbackData(): Promise<FeedbackData> {
    const tickets = await supportService.getTickets();
    
    const categoryPatterns = TICKET_CATEGORIES.map(cat => {
      const categoryTickets = tickets.filter(t => t.category === cat.id);
      const keywords = this.extractKeywords(categoryTickets.map(t => t.description));
      return {
        category: cat.label,
        count: categoryTickets.length,
        keywords,
      };
    }).filter(p => p.count > 0);

    const featureRequestTickets = tickets.filter(t => t.category === 'feature-request');
    const featureRequests = featureRequestTickets.map(t => t.description);

    const appIssueTickets = tickets.filter(t => t.category === 'app-issue');
    const painPoints = appIssueTickets.map(t => t.description);

    this.feedbackData = {
      supportTicketPatterns: categoryPatterns,
      featureRequests,
      painPoints,
      positiveAspects: [],
      usagePatterns: {
        mostUsedFeatures: ['AI Styling Advice', 'Outfit Posts', 'Community Feed', 'Style Shuffle'],
        leastUsedFeatures: ['Voice Comments', 'Comparison Polls', 'Events Calendar'],
        peakUsageTimes: ['Morning 7-9am', 'Lunch 12-2pm', 'Evening 7-10pm'],
      },
      collectedAt: new Date().toISOString(),
    };

    await this.saveFeedbackData();
    return this.feedbackData;
  }

  private extractKeywords(texts: string[]): string[] {
    const allText = texts.join(' ').toLowerCase();
    const words = allText.split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'can', 'my', 'i', 'me', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that', 'these', 'those', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'about']);
    
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });

    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private async gatherAnalysisContext(): Promise<AnalysisContext> {
    const trendData = await TrendInsightsService.getTrendsForRegion('United Kingdom');
    
    if (!trendData) {
      return {
        currentTrends: [],
        colorTrends: [],
        styleMovements: [],
        topInfluencers: [],
        seasonalFocus: 'General fashion trends',
        userFeedback: this.feedbackData,
        appInsights: {
          totalUsers: 15000,
          activeFeatures: ['AI Styling', 'Outfit Posts', 'Style Shuffle', 'Wardrobe', 'Events'],
          underutilizedFeatures: ['Voice Comments', 'Comparison Polls', 'Sustainability Tracker'],
        },
      };
    }
    
    const currentTrends = [
      ...trendData.trendingItems.female.map((t: TrendingItem) => t.name),
      ...trendData.trendingItems.male.map((t: TrendingItem) => t.name),
    ].slice(0, 10);

    const colorTrends = trendData.colorPalette.map((c: ColorTrend) => c.name);
    const styleMovements = trendData.styleMovements.map((m: StyleMovement) => m.name);
    const topInfluencers = [
      ...trendData.femaleInfluencers.slice(0, 3).map((i: FashionInfluencer) => i.name),
      ...trendData.maleInfluencers.slice(0, 3).map((i: FashionInfluencer) => i.name),
    ];

    return {
      currentTrends,
      colorTrends,
      styleMovements,
      topInfluencers,
      seasonalFocus: trendData.seasonalFocus,
      userFeedback: this.feedbackData,
      appInsights: {
        totalUsers: 15000,
        activeFeatures: ['AI Styling', 'Outfit Posts', 'Style Shuffle', 'Wardrobe', 'Events'],
        underutilizedFeatures: ['Voice Comments', 'Comparison Polls', 'Sustainability Tracker'],
      },
    };
  }

  async generateFeatureSuggestions(forceRefresh: boolean = false): Promise<FeatureSuggestion[]> {
    if (!forceRefresh && this.lastAnalysisDate) {
      const lastAnalysis = new Date(this.lastAnalysisDate);
      const hoursSinceLastAnalysis = (Date.now() - lastAnalysis.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastAnalysis < 24 && this.suggestions.length > 0) {
        return this.suggestions;
      }
    }

    await this.collectFeedbackData();
    const context = await this.gatherAnalysisContext();

    try {
      if (apiService.isConfigured()) {
        const aiSuggestions = await this.getAISuggestions(context);
        this.suggestions = aiSuggestions;
      } else {
        this.suggestions = this.generateMockSuggestions(context);
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      this.suggestions = this.generateMockSuggestions(context);
    }

    await this.saveSuggestions();
    await this.saveLastAnalysisDate();
    
    return this.suggestions;
  }

  private async getAISuggestions(context: AnalysisContext): Promise<FeatureSuggestion[]> {
    const prompt = this.buildAnalysisPrompt(context);
    
    try {
      const response = await fetch(`${API_URL}/api/ai/feature-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await apiService.getToken()}`,
        },
        body: JSON.stringify({ 
          context,
          prompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI suggestions');
      }

      const data = await response.json();
      return data.suggestions || this.generateMockSuggestions(context);
    } catch (error) {
      console.error('AI suggestions API error:', error);
      return this.generateMockSuggestions(context);
    }
  }

  private buildAnalysisPrompt(context: AnalysisContext): string {
    return `
Analyze the following fashion app data and generate innovative feature suggestions:

CURRENT FASHION TRENDS:
${context.currentTrends.join(', ')}

COLOR TRENDS:
${context.colorTrends.join(', ')}

STYLE MOVEMENTS:
${context.styleMovements.join(', ')}

TOP INFLUENCERS:
${context.topInfluencers.join(', ')}

SEASONAL FOCUS:
${context.seasonalFocus}

USER FEEDBACK PATTERNS:
${context.userFeedback ? JSON.stringify(context.userFeedback.supportTicketPatterns, null, 2) : 'No feedback data available'}

FEATURE REQUESTS:
${context.userFeedback?.featureRequests.join('\n') || 'None recorded'}

PAIN POINTS:
${context.userFeedback?.painPoints.join('\n') || 'None recorded'}

USAGE PATTERNS:
Most Used: ${context.appInsights.activeFeatures.join(', ')}
Least Used: ${context.appInsights.underutilizedFeatures.join(', ')}

Based on this data, suggest 5-8 innovative features that would:
1. Address user pain points
2. Leverage current fashion trends
3. Improve engagement with underutilized features
4. Add value to subscription tiers
5. Enhance the AI styling experience

For each suggestion, provide:
- Title
- Description
- Category
- Priority (high/medium/low)
- Implementation complexity
- Expected user impact
- Target subscription tier
- Rationale based on the data
    `.trim();
  }

  private generateMockSuggestions(context: AnalysisContext): FeatureSuggestion[] {
    const now = new Date().toISOString();
    
    const suggestions: FeatureSuggestion[] = [
      {
        id: generateId(),
        title: 'AI Outfit Weather Sync',
        description: 'Automatically suggest outfits based on real-time weather conditions and forecasts. Integrates with local weather APIs to recommend appropriate layers, fabrics, and accessories.',
        category: 'ai-styling',
        priority: 'high',
        source: 'trend-analysis',
        rationale: `Weather-appropriate dressing is a common pain point. Current trends like "${context.currentTrends[0] || 'layering pieces'}" align perfectly with weather-based outfit planning.`,
        userBenefit: 'Never be caught unprepared for weather changes - always dressed appropriately for the conditions.',
        implementationComplexity: 'moderate',
        estimatedImpact: 'high',
        targetTier: 'premium',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: context.currentTrends.slice(0, 3),
        aiConfidence: 0.92,
      },
      {
        id: generateId(),
        title: 'Virtual Try-On with AR',
        description: 'Use augmented reality to virtually try on outfits from wardrobe or shopping recommendations. See how clothes would look before purchasing or leaving the house.',
        category: 'shopping-integration',
        priority: 'high',
        source: 'industry-benchmark',
        rationale: 'AR try-on technology is becoming standard in fashion apps. Users frequently request visual confirmation before styling decisions.',
        userBenefit: 'Confidently make outfit choices and shopping decisions with realistic virtual previews.',
        implementationComplexity: 'complex',
        estimatedImpact: 'high',
        targetTier: 'premium',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: ['Virtual Fashion', 'Digital Wardrobes'],
        aiConfidence: 0.88,
      },
      {
        id: generateId(),
        title: 'Colour Analysis AI',
        description: `Analyze user's skin tone, hair, and eye color to determine their seasonal color palette. Recommend colors that complement their natural coloring based on current trends like ${context.colorTrends.slice(0, 2).join(' and ')}.`,
        category: 'personalization',
        priority: 'high',
        source: 'user-feedback',
        rationale: 'Color matching is frequently requested in support tickets. Professional color analysis is expensive but AI can democratize this service.',
        userBenefit: 'Discover the colors that make you look your best and shop with confidence.',
        implementationComplexity: 'moderate',
        estimatedImpact: 'high',
        targetTier: 'premium',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: context.colorTrends,
        aiConfidence: 0.95,
      },
      {
        id: generateId(),
        title: 'Style Twin Matching',
        description: 'Match users with others who have similar body types, style preferences, and fashion goals. Enable following and inspiration from "style twins".',
        category: 'social-features',
        priority: 'medium',
        source: 'usage-patterns',
        rationale: 'Community features drive engagement. Users want relatable style inspiration from people similar to themselves.',
        userBenefit: 'Find inspiration from people who share your style journey and body type.',
        implementationComplexity: 'moderate',
        estimatedImpact: 'medium',
        targetTier: 'all',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: ['Inclusive Fashion', 'Body Positivity'],
        aiConfidence: 0.85,
      },
      {
        id: generateId(),
        title: 'Outfit Calendar with Occasion Planning',
        description: 'Plan outfits ahead for upcoming events, meetings, and social occasions. AI suggests based on event type, dress code, and personal calendar.',
        category: 'wardrobe-management',
        priority: 'medium',
        source: 'support-tickets',
        rationale: `"Events Calendar" is currently underutilized. Connecting wardrobe to calendar creates daily value and reduces ${context.userFeedback?.painPoints.length ? 'common pain points' : 'decision fatigue'}.`,
        userBenefit: 'Never stress about what to wear - plan your outfits ahead and avoid last-minute panics.',
        implementationComplexity: 'moderate',
        estimatedImpact: 'medium',
        targetTier: 'premium',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: ['Capsule Wardrobes', 'Intentional Dressing'],
        aiConfidence: 0.87,
      },
      {
        id: generateId(),
        title: 'Voice-Activated Styling Assistant',
        description: 'Hands-free outfit suggestions while getting ready. Ask questions like "What should I wear to dinner tonight?" and receive spoken recommendations.',
        category: 'ai-styling',
        priority: 'medium',
        source: 'ai-prediction',
        rationale: 'Voice interfaces are increasingly popular. This addresses the "getting ready" use case when hands may be occupied.',
        userBenefit: 'Get outfit advice hands-free while doing makeup, hair, or getting dressed.',
        implementationComplexity: 'complex',
        estimatedImpact: 'medium',
        targetTier: 'premium',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: ['Voice AI', 'Smart Assistants'],
        aiConfidence: 0.78,
      },
      {
        id: generateId(),
        title: 'Sustainable Fashion Score',
        description: 'Rate wardrobe items and purchases on sustainability metrics. Track environmental impact and suggest eco-friendly alternatives aligned with style preferences.',
        category: 'accessibility',
        priority: 'medium',
        source: 'trend-analysis',
        rationale: 'Sustainability is a major trend in fashion. Users increasingly want to make ethical choices without sacrificing style.',
        userBenefit: 'Make fashion choices that align with your environmental values while staying stylish.',
        implementationComplexity: 'moderate',
        estimatedImpact: 'medium',
        targetTier: 'all',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: ['Sustainable Fashion', 'Conscious Consumerism', 'Slow Fashion'],
        aiConfidence: 0.82,
      },
      {
        id: generateId(),
        title: 'Trend Prediction Timeline',
        description: 'AI-powered predictions showing when current trends will peak and fade. Help users invest in pieces with longevity vs. fast fashion trends.',
        category: 'content-creation',
        priority: 'low',
        source: 'ai-prediction',
        rationale: `Current style movements like "${context.styleMovements[0] || 'quiet luxury'}" show cyclical patterns. Predicting trend lifespans adds unique value.`,
        userBenefit: 'Make smarter fashion investments by knowing which trends are worth buying into.',
        implementationComplexity: 'complex',
        estimatedImpact: 'medium',
        targetTier: 'premium',
        createdAt: now,
        status: 'new',
        votes: 0,
        relatedTrends: context.styleMovements,
        aiConfidence: 0.75,
      },
    ];

    return suggestions;
  }

  async updateSuggestionStatus(id: string, status: FeatureSuggestion['status']): Promise<void> {
    const index = this.suggestions.findIndex(s => s.id === id);
    if (index !== -1) {
      this.suggestions[index].status = status;
      await this.saveSuggestions();
    }
  }

  async voteSuggestion(id: string, upvote: boolean): Promise<void> {
    const index = this.suggestions.findIndex(s => s.id === id);
    if (index !== -1) {
      this.suggestions[index].votes += upvote ? 1 : -1;
      await this.saveSuggestions();
    }
  }

  async clearSuggestions(): Promise<void> {
    this.suggestions = [];
    await AsyncStorage.removeItem(FEATURE_SUGGESTIONS_KEY);
    await AsyncStorage.removeItem(LAST_ANALYSIS_KEY);
    this.lastAnalysisDate = null;
  }

  getAnalysisSummary(): {
    totalSuggestions: number;
    byCategory: Record<FeatureCategory, number>;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    topSuggestions: FeatureSuggestion[];
  } {
    const byCategory = {} as Record<FeatureCategory, number>;
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
    const byStatus: Record<string, number> = { new: 0, reviewed: 0, approved: 0, rejected: 0, implemented: 0 };

    this.suggestions.forEach(s => {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      byPriority[s.priority]++;
      byStatus[s.status]++;
    });

    return {
      totalSuggestions: this.suggestions.length,
      byCategory,
      byPriority,
      byStatus,
      topSuggestions: this.getSuggestions().slice(0, 5),
    };
  }

  getCategoryInfo(): { id: FeatureCategory; label: string; icon: string }[] {
    return [
      { id: 'ai-styling', label: 'AI Styling', icon: 'cpu' },
      { id: 'social-features', label: 'Social Features', icon: 'users' },
      { id: 'wardrobe-management', label: 'Wardrobe', icon: 'grid' },
      { id: 'shopping-integration', label: 'Shopping', icon: 'shopping-bag' },
      { id: 'events-discovery', label: 'Events', icon: 'calendar' },
      { id: 'community', label: 'Community', icon: 'message-circle' },
      { id: 'personalization', label: 'Personalization', icon: 'user' },
      { id: 'accessibility', label: 'Accessibility', icon: 'eye' },
      { id: 'content-creation', label: 'Content', icon: 'edit-3' },
      { id: 'subscription-value', label: 'Subscriptions', icon: 'star' },
      { id: 'user-experience', label: 'UX', icon: 'layout' },
    ];
  }
}

export const aiFeatureSuggestionsService = new AIFeatureSuggestionsService();
export default aiFeatureSuggestionsService;
