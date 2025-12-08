import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

const TOKEN_KEY = '@dripn_token';

class ApiService {
  private token: string | null = null;

  async init() {
    this.token = await AsyncStorage.getItem(TOKEN_KEY);
  }

  async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  }

  async getToken() {
    if (!this.token) {
      this.token = await AsyncStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!API_URL) {
      throw new Error('Backend API URL not configured. Set EXPO_PUBLIC_API_URL environment variable.');
    }

    const token = await this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async register(email: string, password: string, displayName?: string) {
    const result = await this.request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    await this.setToken(result.token);
    return result;
  }

  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.setToken(result.token);
    return result;
  }

  async logout() {
    await this.setToken(null);
  }

  async getCurrentUser() {
    return this.request<any>('/api/auth/me');
  }

  async updateProfile(data: { displayName?: string; bio?: string; avatarUrl?: string }) {
    return this.request<any>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getPosts() {
    return this.request<any[]>('/api/posts');
  }

  async getPost(id: string) {
    return this.request<any>(`/api/posts/${id}`);
  }

  async createPost(data: {
    type?: string;
    caption: string;
    tags?: string[];
    images?: string[];
    videoUrl?: string;
  }) {
    return this.request<any>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async likePost(id: string) {
    return this.request<{ liked: boolean }>(`/api/posts/${id}/like`, {
      method: 'POST',
    });
  }

  async addComment(postId: string, text: string, isVoice?: boolean, voiceUrl?: string) {
    return this.request<any>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text, isVoice, voiceUrl }),
    });
  }

  async getAIAdvice(data: {
    outfitDescription: string;
    colorPalette?: string;
    occasion?: string;
    bodyType?: string;
  }) {
    return this.request<{ advice: string; source: string }>('/api/ai/advice', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  isConfigured() {
    return Boolean(API_URL);
  }

  async getVIPMembers() {
    return this.request<any[]>('/api/video/vip-members');
  }

  async initiateCall(calleeId: string) {
    return this.request<{ callId: string; roomUrl: string; roomToken: string }>('/api/video/call', {
      method: 'POST',
      body: JSON.stringify({ calleeId }),
    });
  }

  async acceptCall(callId: string) {
    return this.request<{ roomUrl: string; roomToken: string }>(`/api/video/call/${callId}/accept`, {
      method: 'POST',
    });
  }

  async endCall(callId: string) {
    return this.request<{ success: boolean }>(`/api/video/call/${callId}/end`, {
      method: 'POST',
    });
  }

  async getIncomingCalls() {
    return this.request<any[]>('/api/video/incoming');
  }

  async getCallHistory() {
    return this.request<any[]>('/api/video/history');
  }

  async startStylistVideoSession(sessionId: string) {
    return this.request<{ roomUrl: string; roomToken: string }>(`/api/sessions/${sessionId}/start-video`, {
      method: 'POST',
    });
  }

  async subscribeToNewsletter(email: string, name?: string, preferences?: Record<string, boolean>) {
    return this.request<{ success: boolean; message: string; alreadySubscribed?: boolean }>('/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email, name, preferences }),
    });
  }

  async unsubscribeFromNewsletter(email: string) {
    return this.request<{ success: boolean; message: string }>('/api/newsletter/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async trackReferral(referralCode: string, newUserId: string, newUserEmail?: string) {
    return this.request<{ success: boolean; message: string }>('/api/referral/track', {
      method: 'POST',
      body: JSON.stringify({ referralCode, newUserId, newUserEmail }),
    });
  }

  async getReferralStats(code: string) {
    return this.request<{ referralCode: string; totalReferrals: number }>(`/api/referral/stats/${code}`);
  }

  async getPublishedNewsletters(params?: { limit?: number; offset?: number; category?: string; gender?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.category) queryParams.set('category', params.category);
    if (params?.gender) queryParams.set('gender', params.gender);
    const queryString = queryParams.toString();
    return this.request<{ 
      newsletters: Array<{
        id: string;
        subject: string;
        headline: string;
        introduction: string;
        tips: Array<{ title: string; content: string; proTip: string }>;
        closingMessage: string;
        category: string;
        tags: string[];
        gender: string;
        season: string;
        region: string;
        publishedAt: string;
        views: number;
      }>;
      categories: string[];
    }>(`/api/newsletter/published${queryString ? `?${queryString}` : ''}`);
  }

  async getNewsletter(id: string) {
    return this.request<{
      id: string;
      subject: string;
      headline: string;
      introduction: string;
      tips: Array<{ title: string; content: string; proTip: string }>;
      closingMessage: string;
      category: string;
      tags: string[];
      gender: string;
      season: string;
      region: string;
      htmlContent: string;
      plainTextContent: string;
      publishedAt: string;
      views: number;
    }>(`/api/newsletter/${id}`);
  }

  async reportNewsletterIssue(data: { newsletterId?: string; issueType: string; description: string; userEmail?: string }) {
    return this.request<{ success: boolean; reportId: string; message: string }>('/api/newsletter/report', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async trackInteraction(data: {
    interactionType: 'like' | 'dislike' | 'view' | 'save' | 'share' | 'comment';
    targetType: 'post' | 'outfit' | 'event' | 'offer';
    targetId: string;
    metadata?: Record<string, any>;
  }) {
    return this.request<{ success: boolean }>('/api/interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async dislikePost(id: string) {
    return this.request<{ disliked: boolean }>(`/api/posts/${id}/dislike`, {
      method: 'POST',
    });
  }

  async getStyleProfile() {
    return this.request<{
      id: string;
      userId: string;
      dominantStyles: string[];
      colorPreferences: string[];
      fashionInterests: string[];
      stylePersonality: string;
      strengthAreas: string[];
      growthAreas: string[];
      recommendedBrands: string[];
      styleInfluencerType: string;
      confidenceScore: number;
      seasonalStyle: {
        spring: string;
        summer: string;
        autumn: string;
        winter: string;
      };
      dataPoints: {
        postsCount: number;
        likesCount: number;
        dislikesCount: number;
        adviceCount: number;
      };
      analyzedAt: string;
    } | null>('/api/style-profile');
  }

  async analyzeStyleProfile() {
    return this.request<{
      success: boolean;
      profile: {
        dominantStyles: string[];
        colorPreferences: string[];
        fashionInterests: string[];
        stylePersonality: string;
        strengthAreas: string[];
        growthAreas: string[];
        recommendedBrands: string[];
        styleInfluencerType: string;
        confidenceScore: number;
        seasonalStyle: {
          spring: string;
          summer: string;
          autumn: string;
          winter: string;
        };
        dataPoints: {
          postsCount: number;
          likesCount: number;
          dislikesCount: number;
          adviceCount: number;
        };
        analyzedAt: string;
      };
    }>('/api/style-profile/analyze', {
      method: 'POST',
    });
  }

  async getPersonalizedStyleOfTheDay() {
    return this.request<{
      personalized: boolean;
      styleOfTheDay: {
        title: string;
        description: string;
        keyPieces: string[];
        colorPalette: string[];
        stylingTips: string;
        occasion: string;
        confidence: string;
        whyThisWorks: string;
        generatedAt: string;
      };
    }>('/api/personalized/style-of-the-day');
  }

  async getPersonalizedEventRankings(events: Array<{ id: string; title: string; category: string; date: string; time: string; description: string }>) {
    return this.request<{
      personalized: boolean;
      eventRecommendations: {
        rankedEvents: Array<{
          eventTitle: string;
          matchScore: number;
          whyItSuits: string;
          outfitSuggestion: string;
        }>;
        topPick: {
          eventTitle: string;
          reason: string;
        };
        generatedAt: string;
      };
    }>('/api/personalized/events', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  async getPersonalizedOffers() {
    return this.request<{
      personalized: boolean;
      personalizedOffers: {
        personalizedPicks: Array<{
          category: string;
          item: string;
          description: string;
          suggestedBrands: string[];
          priceRange: string;
          matchScore: number;
        }>;
        seasonalMustHave: {
          item: string;
          reason: string;
        };
        investmentPiece: {
          item: string;
          reason: string;
        };
        generatedAt: string;
      };
    }>('/api/personalized/offers');
  }

  async getEmergingTrends(params?: { region?: string; gender?: string; categories?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.region) queryParams.set('region', params.region);
    if (params?.gender) queryParams.set('gender', params.gender);
    if (params?.categories) queryParams.set('categories', params.categories);
    const queryString = queryParams.toString();
    return this.request<{
      cached: boolean;
      trends: {
        scanDate: string;
        emergingTrends: Array<{
          name: string;
          category: string;
          description: string;
          emergenceLevel: string;
          mainstreamPrediction: string;
          keyInfluencers: string[];
          howToWear: string;
          buyNowSuggestion: string;
          confidenceScore: number;
        }>;
        colorForecast: {
          emergingColors: string[];
          fadingColors: string[];
          colorOfTheMonth: string;
        };
        styleMovement: {
          name: string;
          description: string;
          keyElements: string[];
        };
        trendAlert: {
          hottest: string;
          sleeper: string;
          avoid: string;
        };
        sources: string[];
        region: string;
        gender: string;
        season: string;
        generatedAt: string;
      };
    }>(`/api/trends/emerging${queryString ? `?${queryString}` : ''}`);
  }

  async getViralFashionMoments() {
    return this.request<{
      cached: boolean;
      viralMoments: {
        viralMoments: Array<{
          title: string;
          description: string;
          celebrity: string;
          platform: string;
          fashionItem: string;
          shopTheLook: string;
          viralScore: number;
        }>;
        trendingHashtags: string[];
        mustFollow: {
          account: string;
          reason: string;
        };
        scannedAt: string;
      };
    }>('/api/trends/viral');
  }

  async getTrendPrediction(params?: { gender?: string; ageGroup?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.gender) queryParams.set('gender', params.gender);
    if (params?.ageGroup) queryParams.set('ageGroup', params.ageGroup);
    const queryString = queryParams.toString();
    return this.request<{
      cached: boolean;
      nextBigTrend: {
        prediction: {
          trendName: string;
          tagline: string;
          description: string;
          timeline: string;
          driverFactors: string[];
          earlySignals: string[];
          howToPrepare: string;
          keyPieces: string[];
          colorPalette: string[];
          influencerTypes: string;
        };
        confidence: number;
        disclaimer: string;
        predictedAt: string;
      };
    }>(`/api/trends/prediction${queryString ? `?${queryString}` : ''}`);
  }

  async getRegionalTrends(country: string) {
    return this.request<{
      regionalInsights: {
        country: string;
        currentMood: string;
        localTrends: Array<{
          trend: string;
          localTwist: string;
          popularIn: string;
        }>;
        localInfluencers: string[];
        upcomingEvents: string[];
        localColors: string[];
        shoppingAdvice: string;
        culturalTip: string;
        analyzedAt: string;
      };
    }>(`/api/trends/regional/${encodeURIComponent(country)}`);
  }

  async registerPushToken(token: string, platform: string) {
    return this.request<{ success: boolean; message: string }>('/api/notifications/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }

  async unregisterPushToken(token: string) {
    return this.request<{ success: boolean }>('/api/notifications/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async getNotificationPreferences() {
    return this.request<{
      eventReminders: boolean;
      styleOfTheDay: boolean;
      trendAlerts: boolean;
      personalizedOffers: boolean;
      weeklyDigest: boolean;
    }>('/api/notifications/preferences');
  }

  async updateNotificationPreferences(preferences: {
    eventReminders?: boolean;
    styleOfTheDay?: boolean;
    trendAlerts?: boolean;
    personalizedOffers?: boolean;
    weeklyDigest?: boolean;
  }) {
    return this.request<{ success: boolean }>('/api/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  async likeEvent(eventId: string, eventData: {
    title: string;
    date: string;
    time: string;
    location?: string;
    outfitSuggestion?: string;
  }) {
    return this.request<{ success: boolean; reminder: { id: string; eventId: string; liked: boolean } }>(`/api/events/${eventId}/like`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async getLikedEvents() {
    return this.request<{
      likedEvents: Array<{
        id: string;
        eventId: string;
        eventTitle: string;
        eventDate: string;
        eventTime: string;
        eventLocation: string;
        outfitSuggestion: string;
        reminderSent: boolean;
        likedAt: string;
      }>;
    }>('/api/events/liked');
  }

  async sendTestNotification() {
    return this.request<{ success: boolean; message: string }>('/api/notifications/test', {
      method: 'POST',
    });
  }

  async createSupportTicket(data: {
    category: string;
    description: string;
    userName?: string;
    userEmail?: string;
  }) {
    return this.request<{ success: boolean; ticketId: string }>('/api/support/ticket', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendSupportMessage(data: {
    message: string;
    chatHistory?: Array<{ role: string; content: string }>;
    stylistName?: string;
    stylistPersonality?: string;
  }) {
    return this.request<{ response: string }>('/api/support/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendStylistMessage(data: {
    stylistId: string;
    messages: Array<{ role: string; content: string }>;
    userMessage: string;
    wardrobeItems?: Array<{ id: string; name: string; color: string; category: string }>;
    userGender?: string;
    subscriptionTier?: string;
  }) {
    return this.request<{
      content: string;
      mood: {
        mood: string;
        confidence: number;
        needsSupport: boolean;
        topicType: string;
      };
      stylistId: string;
      error?: string;
    }>('/api/stylist/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async detectMood(message: string) {
    return this.request<{
      mood: string;
      confidence: number;
      needsSupport: boolean;
      topicType: string;
    }>('/api/stylist/detect-mood', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
