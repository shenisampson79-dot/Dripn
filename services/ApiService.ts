/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

const TOKEN_KEY = '@dripn_token';

const DEFAULT_TIMEOUT = 30000;

class ApiService {
  private token: string | null = null;

  async init() {
    this.token = await AsyncStorage.getItem(TOKEN_KEY);
  }

  private fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const { timeout = DEFAULT_TIMEOUT, signal: externalSignal, ...fetchOptions } = options;
    const controller = new AbortController();
    let wasTimeout = false;
    let externalReason: string | undefined;
    
    const timeoutId = setTimeout(() => {
      wasTimeout = true;
      controller.abort();
    }, timeout);

    const onExternalAbort = () => {
      externalReason = typeof externalSignal?.reason === 'string' ? externalSignal.reason : undefined;
      controller.abort();
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        externalReason = typeof externalSignal.reason === 'string' ? externalSignal.reason : undefined;
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort);
      }
    }

    return fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    }).catch((error) => {
      if (error.name === 'AbortError') {
        const abortError = new Error(
          wasTimeout ? 'INTERNAL_TIMEOUT' : (externalReason || 'EXTERNAL_ABORT')
        );
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw error;
    }).finally(() => {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    });
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
    options: RequestInit & { timeout?: number } = {}
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

    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const reason = error.message || '';
        if (reason === 'INTERNAL_TIMEOUT') {
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        if (reason !== 'EXTERNAL_ABORT' && reason.length > 0) {
          throw new Error(reason);
        }
        throw new Error('Request was cancelled.');
      }
      throw error;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      let errorMessage = error.error || error.message || '';
      
      if (!errorMessage || errorMessage.startsWith('HTTP')) {
        switch (response.status) {
          case 401:
            errorMessage = 'Invalid email or password. Please try again.';
            break;
          case 403:
            errorMessage = 'Access denied. Please check your credentials.';
            break;
          case 404:
            errorMessage = 'Account not found. Please check your email or sign up.';
            break;
          case 429:
            errorMessage = 'Too many attempts. Please try again later.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = 'Something went wrong. Please try again.';
        }
      }
      
      throw new Error(errorMessage);
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

  async socialLogin(provider: 'google' | 'facebook' | 'apple', accessToken: string, idToken?: string) {
    const token = idToken || accessToken;
    const result = await this.request<{ token: string; user: any }>('/api/auth/social', {
      method: 'POST',
      body: JSON.stringify({ 
        provider, 
        token,
      }),
    });
    await this.setToken(result.token);
    return result;
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

  async getStylists() {
    return this.request<{
      stylists: Array<{
        id: string;
        name: string;
        personality: string;
        specialty: string;
        tagline: string;
        icon: string;
        color: string;
        isCurrent: boolean;
      }>;
    }>('/api/stylists');
  }

  async switchStylist(stylistId: string) {
    return this.request<{
      stylist: {
        id: string;
        name: string;
        personality: string;
        specialty: string;
        tagline: string;
        icon: string;
        color: string;
      };
      message: string;
    }>('/api/stylists/switch', {
      method: 'POST',
      body: JSON.stringify({ stylistId }),
    });
  }

  async getCurrentStylist() {
    return this.request<{
      stylist: {
        id: string;
        name: string;
        personality: string;
        specialty: string;
        tagline: string;
        icon: string;
        color: string;
      };
      messageCount: number;
    }>('/api/stylists/current');
  }

  async startSubscriptionCancellation() {
    return this.request<{
      stylist: string;
      stylistName: string;
      message: string;
      feedbackPrompt: string;
      cancellationReasons: Array<{ value: string; label: string }>;
    }>('/api/subscription/cancel/start');
  }

  async submitCancellationFeedback(data: {
    reason: string;
    feedback?: string;
    wouldReturn?: boolean;
  }) {
    return this.request<{ success: boolean }>('/api/subscription/cancel/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeCancellation() {
    return this.request<{
      stylistName: string;
      farewellMessage: string;
      reactivationOffer: {
        options: Array<{ type: string; label: string; price: string }>;
      };
    }>('/api/subscription/cancel/complete', {
      method: 'POST',
    });
  }

  async getFashionRules(params?: {
    category?: string;
    difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
    gender?: 'all' | 'women' | 'men';
    tag?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.difficulty) queryParams.append('difficulty', params.difficulty);
    if (params?.gender) queryParams.append('gender', params.gender);
    if (params?.tag) queryParams.append('tag', params.tag);
    const query = queryParams.toString();
    return this.request<{
      rules: Array<{
        id: number;
        title: string;
        content: string;
        category: string;
        difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
        gender: 'all' | 'women' | 'men';
        tags: string[];
        colorSwatches?: Array<{ name: string; hex: string }>;
      }>;
      total: number;
    }>(`/api/fashion-rules${query ? `?${query}` : ''}`);
  }

  async getDailyFashionRule() {
    return this.request<{
      id: number;
      title: string;
      content: string;
      category: string;
      difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
      colorSwatches?: Array<{ name: string; hex: string }>;
    }>('/api/fashion-rules/daily');
  }

  async getCurrentColorTrends(params?: {
    season?: string;
    year?: number;
    undertone?: 'warm' | 'cool' | 'neutral';
    trendType?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.season) queryParams.append('season', params.season);
    if (params?.year) queryParams.append('year', params.year.toString());
    if (params?.undertone) queryParams.append('undertone', params.undertone);
    if (params?.trendType) queryParams.append('trendType', params.trendType);
    const query = queryParams.toString();
    return this.request<{
      colorOfTheYear: {
        name: string;
        hexCode: string;
        pantoneCode?: string;
        description: string;
        pairingColors: string[];
        bestFor: string[];
        year: number;
      };
      seasonalPalette: Array<{
        id: string;
        name: string;
        hexCode: string;
        pantoneCode?: string;
        season: string;
        year: number;
        trendType: string;
        description: string;
        pairingColors: string[];
        bestFor: string[];
        undertone?: 'warm' | 'cool' | 'neutral';
      }>;
    }>(`/api/color-trends/current${query ? `?${query}` : ''}`);
  }

  async getPersonalizedColorTrends() {
    return this.request<{
      undertone: 'warm' | 'cool' | 'neutral';
      recommendedColors: Array<{
        id: string;
        name: string;
        hexCode: string;
        pantoneCode?: string;
        description: string;
        pairingColors: string[];
        bestFor: string[];
        matchScore: number;
      }>;
      avoidColors: Array<{
        name: string;
        hexCode: string;
        reason: string;
      }>;
    }>('/api/color-trends/personalized');
  }

  async getFashionRuleCategories() {
    return this.request<{
      categories: Array<{
        name: string;
        count: number;
        topics: string[];
      }>;
    }>('/api/fashion-rules/categories');
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

  async analyzeGarmentPhoto(imageBase64: string, options?: { detailed?: boolean }) {
    return this.request<{
      success: boolean;
      analysis: {
        category: string;
        color: string;
        secondaryColor?: string;
        style: string;
        suggestedName: string;
        brand?: string;
        seasons: string[];
        occasions: string[];
        description: string;
        confidence: number;
      };
      modelUsed: string;
    }>('/api/ai/analyze-garment', {
      method: 'POST',
      body: JSON.stringify({ 
        imageBase64, 
        detailed: options?.detailed ?? true,
        analysisType: 'garment'
      }),
    });
  }

  async analyzeOutfitPhoto(imageBase64: string, options?: { detailed?: boolean; wardrobeItems?: any[] }) {
    return this.request<{
      success: boolean;
      analysis: any;
      modelUsed: string;
    }>('/api/ai/analyze-photo', {
      method: 'POST',
      body: JSON.stringify({ 
        imageBase64, 
        detailed: options?.detailed ?? true,
        includeWardrobe: Boolean(options?.wardrobeItems?.length),
        wardrobeItems: options?.wardrobeItems,
      }),
    });
  }

  async processWardrobeImage(imageBase64: string, options?: { 
    removeBackground?: boolean;
    straighten?: boolean;
    targetSize?: number;
  }) {
    return this.request<{
      success: boolean;
      processedImageUrl?: string;
      processedImageBase64?: string;
      maskQuality?: number;
      straightened?: boolean;
      error?: string;
    }>('/api/wardrobe/process-image', {
      method: 'POST',
      body: JSON.stringify({ 
        imageBase64, 
        removeBackground: options?.removeBackground ?? true,
        straighten: options?.straighten ?? true,
        targetSize: options?.targetSize ?? 1024,
      }),
    });
  }

  async extractClothing(imageData: { imageBase64?: string; imageUrl?: string }) {
    return this.request<{
      success: boolean;
      processedImageBase64?: string;
      clothingAnalysis?: {
        type: string;
        color: string;
        style: string;
        material?: string;
        brand?: string;
        features?: string[];
        occasions?: string[];
        seasons?: string[];
        description?: string;
      };
      backgroundRemoved: boolean;
      error?: string;
    }>('/api/wardrobe/extract-clothing', {
      method: 'POST',
      body: JSON.stringify(imageData),
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

  async createCheckoutSession(priceId: string, planTier: string) {
    return this.request<{ url: string; sessionId: string }>('/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify({ priceId, planTier }),
    });
  }

  async getStripeConfig() {
    return this.request<{ publishableKey: string }>('/api/stripe/config');
  }

  async getLifestyleAffirmation() {
    return this.request<{ affirmation: string }>('/api/ai/lifestyle/affirmation');
  }

  async getMoodOutfit(data: { mood: string; gender?: string; style?: string }) {
    return this.request<{
      success: boolean;
      data: {
        moodAnalysis?: {
          currentState?: string;
          styleNeed?: string;
          colorPrescription?: string;
        };
        outfit?: {
          pieces?: Array<{ item: string; reason: string }>;
          colorPalette?: string[];
          overallEffect?: string;
        };
        affirmation?: string;
        selfCareTip?: string;
        avoidToday?: string;
      };
      modelUsed?: string;
    }>('/api/ai/lifestyle/mood-outfit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBodyPositivity(data: { bodyType?: string; concerns?: string[]; gender?: string }) {
    return this.request<{
      success: boolean;
      data: {
        affirmations?: string[];
        celebrateFeatures?: Array<{ feature: string; howToStyle: string }>;
        mindsetShift?: {
          oldThinking?: string;
          newPerspective?: string;
        };
        signatureStyleElements?: string[];
        confidenceOutfit?: {
          description?: string;
          pieces?: string[];
          whyItWorks?: string;
        };
        dailyPractice?: string;
      };
      modelUsed?: string;
    }>('/api/ai/lifestyle/body-positivity', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getConfidenceRitual(data: { occasion?: string; style?: string; gender?: string }) {
    return this.request<{
      success: boolean;
      data: {
        occasionAnalysis?: {
          whatToExpect?: string;
          energyNeeded?: string;
        };
        powerOutfit?: {
          pieces?: Array<{ item: string; reason: string }>;
          colorMeaning?: string;
          silhouettePower?: string;
        };
        preEventRitual?: {
          morningOf?: string;
          gettingDressed?: string;
          finalCheck?: string;
        };
        powerPose?: string;
        mantra?: string;
        contingencyPlan?: string;
        celebrationPlan?: string;
      };
      modelUsed?: string;
    }>('/api/ai/lifestyle/confidence-ritual', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWellnessOutfit(data: { activity: string; gender?: string; style?: string }) {
    return this.request<{
      success: boolean;
      data: {
        wellnessAssessment?: {
          physicalNeeds?: string;
          mentalNeeds?: string;
          energyOptimization?: string;
        };
        outfit?: {
          pieces?: Array<{ item: string; wellnessBenefit: string }>;
          fabricConsiderations?: string;
          movementFriendly?: boolean;
        };
        layeringStrategy?: string;
        colorWellness?: string;
        selfCareReminders?: string[];
        eveningTransition?: string;
      };
      modelUsed?: string;
    }>('/api/ai/lifestyle/wellness-outfit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCapsuleWardrobe(data: { lifestyle?: string; climate?: string; gender?: string; style?: string }) {
    return this.request<{
      success: boolean;
      data: {
        currentAnalysis?: {
          totalItems?: number;
          categoryBreakdown?: Record<string, number>;
          colorPalette?: string[];
          versatilityScore?: number;
          gapsIdentified?: string[];
        };
        capsulePlan?: {
          targetSize?: string;
          coreColors?: string[];
          accentColors?: string[];
          essentials?: Array<{ category: string; quantity: number; purpose: string }>;
        };
        keepItems?: Array<{ item: string; reason: string }>;
        considerRemoving?: Array<{ item: string; reason: string }>;
        shoppingList?: Array<{ item: string; priority: string; reason: string }>;
        outfitFormulas?: string[];
        mindfulnessTask?: string;
      };
      modelUsed?: string;
    }>('/api/ai/lifestyle/capsule-wardrobe', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transcribeAudio(audioBase64: string, language?: string) {
    return this.request<{
      success: boolean;
      text: string;
      language?: string;
      duration?: number;
      modelUsed?: string;
    }>('/api/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, language }),
    });
  }

  async synthesizeSpeech(text: string, options?: { voice?: string; stylistId?: string; speed?: number }) {
    return this.request<{
      success: boolean;
      audio: {
        audioBuffer?: string;
        voice?: string;
        format?: string;
        modelUsed?: string;
      };
    }>('/api/ai/speak', {
      method: 'POST',
      body: JSON.stringify({ text, ...options }),
    });
  }

  async getAvailableVoices() {
    return this.request<{
      success: boolean;
      voices: Array<{
        id: string;
        description: string;
        isStylistVoice: boolean;
      }>;
    }>('/api/ai/voices');
  }

  async processVoiceMessage(data: {
    audioBase64: string;
    stylistId?: string;
    userGender?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }) {
    return this.request<{
      success: boolean;
      transcribedText?: string;
      language?: string;
      duration?: number;
      stylistId?: string;
    }>('/api/ai/voice-message', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createVoiceResponse(data: { 
    textResponse: string; 
    stylistId?: string; 
    speed?: number;
    voice?: string;
    language?: string;
  }) {
    return this.request<{
      success: boolean;
      audio: {
        audioBuffer?: string;
        voice?: string;
        format?: string;
      };
    }>('/api/ai/voice-response', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async get<T>(endpoint: string, options?: RequestInit & { timeout?: number }): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit & { timeout?: number }): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // ===== VISUAL SEARCH =====
  async visualSearchMarketplace(data: {
    imageUrl?: string;
    imageBase64?: string;
    includeOutOfStock?: boolean;
    priceRange?: { min?: number; max?: number };
    category?: string;
  }) {
    return this.request<{
      success: boolean;
      results: Array<{
        id: string;
        name: string;
        brand: string;
        price: number;
        originalPrice?: number;
        imageUrl: string;
        store: string;
        category: string;
        matchPercentage: number;
        color: string;
        inStock: boolean;
        affiliateUrl?: string;
      }>;
      analyzedCategory?: string;
      analyzedColor?: string;
    }>('/api/visual-search/marketplace', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async visualSearchIdentify(data: { imageUrl?: string; imageBase64?: string }) {
    return this.request<{
      success: boolean;
      identification: {
        brand: string;
        priceEstimate: { low: number; high: number };
        styleInfo: string;
        category: string;
        color: string;
        material?: string;
        confidence: number;
      };
    }>('/api/visual-search/identify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async visualSearchByPhoto(data: { imageUrl?: string; imageBase64?: string }) {
    return this.request<{
      success: boolean;
      items: Array<{
        id: string;
        name: string;
        brand: string;
        category: string;
        color: string;
        priceEstimate: { low: number; high: number };
        confidence: number;
        boundingBox?: { x: number; y: number; width: number; height: number };
      }>;
    }>('/api/visual-search/search-by-photo', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===== FASHION NEWS FEED =====
  async getNewsFeed(params?: { category?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request<{
      success: boolean;
      articles: Array<{
        id: string;
        headline: string;
        summary: string;
        imageUrl: string;
        source: string;
        category: string;
        publishedAt: string;
        likes: number;
        saved: boolean;
        liked: boolean;
      }>;
    }>(`/api/news/feed${query.toString() ? `?${query}` : ''}`);
  }

  async getTrendingStyles() {
    return this.request<{
      success: boolean;
      styles: Array<{
        id: string;
        name: string;
        description: string;
        imageUrl: string;
        popularity: number;
      }>;
    }>('/api/news/trending-styles');
  }

  async getUpcomingEvents() {
    return this.request<{
      success: boolean;
      events: Array<{
        id: string;
        title: string;
        date: string;
        location: string;
        imageUrl?: string;
        category: string;
      }>;
    }>('/api/news/events?upcoming=true');
  }

  async interactWithNews(newsId: string, action: 'like' | 'save' | 'share') {
    return this.request<{ success: boolean }>(`/api/news/${newsId}/interact`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async analyzeTrend(topic: string) {
    return this.request<{
      success: boolean;
      analysis: {
        topic: string;
        summary: string;
        keyInsights: string[];
        relatedStyles: string[];
        celebrities: string[];
        seasonality: string;
      };
    }>(`/api/news/analyze-trend?topic=${encodeURIComponent(topic)}`);
  }

  // ===== CONTEXTUAL HELP SYSTEM =====
  async getHelpArticles(category?: string) {
    return this.request<{
      success: boolean;
      articles: Array<{
        slug: string;
        title: string;
        summary: string;
        category: string;
        readTime: number;
      }>;
    }>(`/api/help/articles${category ? `?category=${category}` : ''}`);
  }

  async getHelpArticle(slug: string) {
    return this.request<{
      success: boolean;
      article: {
        slug: string;
        title: string;
        content: string;
        category: string;
        relatedArticles: string[];
      };
    }>(`/api/help/articles/${slug}`);
  }

  async submitArticleFeedback(slug: string, helpful: boolean) {
    return this.request<{ success: boolean }>(`/api/help/articles/${slug}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ helpful }),
    });
  }

  async getScreenTips(screen: string, role?: string) {
    const params = new URLSearchParams({ screen });
    if (role) params.append('role', role);
    return this.request<{
      success: boolean;
      tips: Array<{
        key: string;
        title: string;
        message: string;
        position: 'top' | 'bottom' | 'center';
        dismissed: boolean;
      }>;
    }>(`/api/help/tips?${params}`);
  }

  async dismissTip(tipKey: string) {
    return this.request<{ success: boolean }>(`/api/help/tips/${tipKey}/dismiss`, {
      method: 'POST',
    });
  }

  async getWalkthrough(id: string) {
    return this.request<{
      success: boolean;
      walkthrough: {
        id: string;
        title: string;
        steps: Array<{
          stepNumber: number;
          title: string;
          description: string;
          targetElement?: string;
          action?: string;
        }>;
        currentStep: number;
        completed: boolean;
      };
    }>(`/api/help/walkthroughs/${id}`);
  }

  async updateWalkthroughProgress(id: string, currentStep: number, completed: boolean) {
    return this.request<{ success: boolean }>(`/api/help/walkthroughs/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ currentStep, completed }),
    });
  }

  async getFAQs(category?: string) {
    return this.request<{
      success: boolean;
      faqs: Array<{
        id: string;
        question: string;
        answer: string;
        category: string;
      }>;
    }>(`/api/help/faqs${category ? `?category=${category}` : ''}`);
  }

  async askRubyHelp(question: string) {
    return this.request<{
      success: boolean;
      answer: string;
      relatedArticles?: string[];
      suggestedActions?: string[];
    }>('/api/help/ask-ruby', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  }

  // ===== CHALLENGE FORGE =====
  async createForgeChallenge(data: {
    title: string;
    description: string;
    category: string;
    duration: number;
    prizes?: string[];
  }) {
    return this.request<{
      success: boolean;
      challenge: {
        id: string;
        title: string;
        status: string;
      };
    }>('/api/challenges/forge/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getForgeTemplates() {
    return this.request<{
      success: boolean;
      templates: Array<{
        id: string;
        name: string;
        description: string;
        category: string;
        suggestedDuration: number;
      }>;
    }>('/api/challenges/forge/templates');
  }

  // ===== MARKETPLACE =====
  async getMarketplaceListings(params?: {
    category?: string;
    type?: 'sell' | 'swap' | 'rent';
    priceMin?: number;
    priceMax?: number;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    return this.request<{
      success: boolean;
      listings: Array<{
        id: string;
        title: string;
        description: string;
        price: number;
        type: 'sell' | 'swap' | 'rent';
        category: string;
        images: string[];
        videoUrl?: string;
        condition: string;
        size: string;
        sellerId: string;
        sellerName: string;
        sellerAvatar?: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
    }>(`/api/marketplace/listings${query.toString() ? `?${query}` : ''}`);
  }

  async createMarketplaceListing(data: {
    title: string;
    description: string;
    price: number;
    type: 'sell' | 'swap' | 'rent';
    category: string;
    images: string[];
    videoUrl?: string;
    condition: string;
    size: string;
    rentalPeriod?: number;
  }) {
    return this.request<{
      success: boolean;
      listing: { id: string };
    }>('/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async makeOffer(listingId: string, data: {
    amount: number;
    message?: string;
    swapItemId?: string;
  }) {
    return this.request<{
      success: boolean;
      offer: { id: string; status: string };
    }>(`/api/marketplace/listings/${listingId}/offers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async respondToOffer(listingId: string, offerId: string, action: 'accept' | 'reject' | 'counter', counterAmount?: number) {
    return this.request<{ success: boolean }>(`/api/marketplace/listings/${listingId}/offers/${offerId}`, {
      method: 'POST',
      body: JSON.stringify({ action, counterAmount }),
    });
  }

  async initiateEscrow(listingId: string, offerId: string) {
    return this.request<{
      success: boolean;
      escrow: {
        id: string;
        paymentUrl: string;
        amount: number;
        expiresAt: string;
      };
    }>(`/api/marketplace/escrow/initiate`, {
      method: 'POST',
      body: JSON.stringify({ listingId, offerId }),
    });
  }

  async getRentalCalendar(listingId: string) {
    return this.request<{
      success: boolean;
      availability: Array<{
        date: string;
        available: boolean;
        price?: number;
      }>;
    }>(`/api/marketplace/listings/${listingId}/calendar`);
  }

  // ===== STREET STYLE SCANNER =====
  async streetStyleScan(data: { imageUrl?: string; imageBase64?: string }) {
    return this.request<{
      success: boolean;
      analysis: {
        overallStyle: string;
        confidence: number;
        items: Array<{
          name: string;
          category: string;
          color: string;
          estimatedPrice: string;
          whereToBuy: string[];
        }>;
        colorPalette: string[];
        styleNotes: string;
        occasions: string[];
      };
    }>('/api/street-style-scan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===== DREAM OUTFIT GENERATOR =====
  async generateDreamOutfit(data: {
    prompt: string;
    style?: string;
    occasion?: string;
    gender?: string;
  }) {
    return this.request<{
      success: boolean;
      outfit: {
        imageUrl: string;
        description: string;
        pieces: string[];
        estimatedCost: string;
      };
    }>('/api/dream-outfit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===== USER PROFILES & SOCIAL =====
  async getUserProfile(userId: string) {
    return this.request<{
      success: boolean;
      user: {
        id: string;
        name: string;
        avatar: string | null;
        bio: string;
        tier: string;
        followersCount: number;
        followingCount: number;
        postsCount: number;
        helpfulVotes: number;
        thanksReceived: number;
        country?: string;
        stylePreferences?: string[];
      };
    }>(`/api/users/${userId}/profile`);
  }

  async getSuggestedFollows(params?: {
    sizeRange?: string;
    bodyShape?: string;
    budgetRange?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    return this.request<{
      success: boolean;
      suggestions: Array<{
        id: string;
        name: string;
        avatar?: string;
        tier: string;
        category: string;
        matchReason: string;
        followers: number;
        isPopular?: boolean;
      }>;
    }>(`/api/users/suggested-follows${query.toString() ? `?${query}` : ''}`);
  }

  async getStyleSoulmates() {
    return this.request<{
      success: boolean;
      soulmates: Array<{
        id: string;
        name: string;
        avatar?: string;
        tier: string;
        matchPercentage: number;
        styleMatchPercentage: number;
        bodyMatchPercentage: number;
        sharedStyles: string[];
        sharedColors: string[];
        compatibilityNote: string;
      }>;
    }>('/api/users/style-soulmates');
  }

  async followUser(userId: string) {
    return this.request<{ success: boolean }>(`/api/users/${userId}/follow`, {
      method: 'POST',
    });
  }

  async unfollowUser(userId: string) {
    return this.request<{ success: boolean }>(`/api/users/${userId}/unfollow`, {
      method: 'POST',
    });
  }

  async sendFriendRequest(userId: string) {
    return this.request<{ success: boolean; requestId: string }>(`/api/users/${userId}/friend-request`, {
      method: 'POST',
    });
  }

  async respondToFriendRequest(requestId: string, action: 'accept' | 'decline') {
    return this.request<{ success: boolean }>(`/api/friend-requests/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async getFriendRequests() {
    return this.request<{
      success: boolean;
      incoming: Array<{
        id: string;
        fromUserId: string;
        fromUserName: string;
        fromUserAvatar?: string;
        timestamp: string;
      }>;
      outgoing: Array<{
        id: string;
        toUserId: string;
        toUserName: string;
        timestamp: string;
      }>;
    }>('/api/friend-requests');
  }

  async getFriends() {
    return this.request<{
      success: boolean;
      friends: Array<{
        id: string;
        name: string;
        avatar?: string;
        tier: string;
        lastActive?: string;
      }>;
    }>('/api/friends');
  }

  // ===== SOCIAL STYLE SYNC =====
  async analyzeSocialStyle(data: {
    platform: 'instagram' | 'pinterest' | 'tiktok';
    accessToken: string;
  }) {
    return this.request<{
      success: boolean;
      analysis: {
        detectedStyles: Array<{ name: string; percentage: number; color: string }>;
        colorPalette: Array<{ hex: string; name: string; percentage: number }>;
        trendInsights: Array<{ trend: string; count: number; icon: string }>;
        wardrobeMatches: Array<{
          id: string;
          savedImage: string;
          matchedItems: string[];
          matchPercentage: number;
          missingPieces: string[];
        }>;
        aiInsights: Array<{
          title: string;
          description: string;
          icon: string;
          actionLabel?: string;
        }>;
      };
    }>('/api/social/analyze-style', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===== WISHLIST & PRICE TRACKING =====
  async getWishlistPrices(itemIds: string[]) {
    return this.request<{
      success: boolean;
      prices: Record<string, {
        currentPrice: number;
        originalPrice: number;
        priceHistory: Array<{ price: number; date: string; source: string }>;
        isOnSale: boolean;
        priceDropPercent: number;
      }>;
    }>('/api/wishlist/prices', {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    });
  }

  async trackWishlistItem(data: {
    productUrl: string;
    name: string;
    store: string;
    currentPrice: number;
    originalPrice: number;
  }) {
    return this.request<{
      success: boolean;
      itemId: string;
      priceHistory: Array<{ price: number; date: string; source: string }>;
    }>('/api/wishlist/track', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ===== GAMES API =====

  // Style Showdown
  async getActiveShowdowns() {
    return this.request<{
      success: boolean;
      showdowns: Array<{
        id: string;
        title: string;
        description: string;
        options: Array<{
          id: number;
          imageUrl: string;
          label: string;
          votes: number;
        }>;
        expiresAt: string;
        totalVotes: number;
        userVoted?: number;
      }>;
    }>('/api/games/showdown');
  }

  async getShowdown(id: string) {
    return this.request<{
      success: boolean;
      showdown: {
        id: string;
        title: string;
        description: string;
        options: Array<{
          id: number;
          imageUrl: string;
          label: string;
          votes: number;
        }>;
        expiresAt: string;
        totalVotes: number;
        userVoted?: number;
      };
    }>(`/api/games/showdown/${id}`);
  }

  async voteShowdown(showdownId: string, optionId: number) {
    return this.request<{
      success: boolean;
      message: string;
      updatedVotes: Record<number, number>;
    }>(`/api/games/showdown/${showdownId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    });
  }

  // Price Check
  async getActivePriceCheck() {
    return this.request<{
      available: boolean;
      round: {
        id: number;
        outfit: {
          name: string;
          hint: string;
          items: Array<{ name: string; brand: string; price: number; category: string }>;
          style: string;
          funFact: string;
          imageUrl: string | null;
        };
        difficulty: string;
        category: string;
      } | null;
    }>('/api/games/pricecheck');
  }

  async submitPriceGuess(roundId: string, guess: number) {
    return this.request<{
      success: boolean;
      message: string;
      difference?: number;
      points?: number;
      rank?: number;
    }>(`/api/games/pricecheck/${roundId}/guess`, {
      method: 'POST',
      body: JSON.stringify({ guess }),
    });
  }

  async getPriceCheckLeaderboard() {
    return this.request<{
      success: boolean;
      leaderboard: Array<{
        userId: string;
        name: string;
        avatar?: string;
        score: number;
        rank: number;
        accuracyRate: number;
      }>;
      userRank?: number;
    }>('/api/games/pricecheck/leaderboard');
  }

  // Style DNA Quiz
  async getStyleDNAQuestions() {
    return this.request<{
      questions: Array<{
        id: number;
        question: string;
        options: Array<{
          id: string;
          text: string;
          traits?: string[];
        }>;
      }>;
      totalQuestions: number;
    }>('/api/games/dna/questions');
  }

  async submitStyleDNAAnswers(answers: number[]) {
    return this.request<{
      success: boolean;
      result: {
        tribe: string;
        tribeDescription: string;
        tribeIcon: string;
        personalityBreakdown: Array<{
          trait: string;
          percentage: number;
          color: string;
        }>;
        recommendations: Array<{
          title: string;
          description: string;
          imageUrl?: string;
        }>;
        compatibleTribes: string[];
      };
    }>('/api/games/dna/submit', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  }

  // Mix & Match
  async getActiveMixMatch() {
    return this.request<{
      available: boolean;
      challenge: {
        id: number;
        items: Array<{ id: number; name: string; color: string; style: string; category: string }>;
        theme: string;
        stylingTip: string;
        suggestedCombinations: number;
        occasion: string;
        isActive: boolean;
        createdAt: string;
        expiresAt: string;
      } | null;
      entries: any[];
      totalEntries: number;
    }>('/api/games/mixmatch');
  }

  async getMixMatchChallenge(id: string) {
    return this.request<{
      success: boolean;
      challenge: {
        id: string;
        title: string;
        description: string;
        theme: string;
        requiredPieces: string[];
        expiresAt: string;
        entryCount: number;
        prizeDescription?: string;
        hasSubmitted: boolean;
      };
    }>(`/api/games/mixmatch/${id}`);
  }

  async submitMixMatchEntry(challengeId: string, data: { imageUrl: string; description: string }) {
    return this.request<{
      success: boolean;
      entryId: string;
      message: string;
    }>(`/api/games/mixmatch/${challengeId}/entry`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async voteMixMatchEntry(challengeId: string, entryId: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/api/games/mixmatch/entry/${entryId}/vote`, {
      method: 'POST',
    });
  }

  async getMixMatchEntries(challengeId: string) {
    return this.request<{
      success: boolean;
      entries: Array<{
        id: string;
        userId: string;
        userName: string;
        userAvatar?: string;
        imageUrl: string;
        description: string;
        votes: number;
        submittedAt: string;
      }>;
    }>(`/api/games/mixmatch/${challengeId}/entries`);
  }

  // Daily Challenge & Streak
  async getDailyChallenge() {
    return this.request<{
      success: boolean;
      challenge: {
        id: string;
        title: string;
        description: string;
        type: 'outfit' | 'vote' | 'share' | 'upload';
        xpReward: number;
        completed: boolean;
        expiresAt: string;
      } | null;
    }>('/api/games/daily-challenge');
  }

  async getStreak() {
    return this.request<{
      success: boolean;
      streak: {
        currentStreak: number;
        longestStreak: number;
        lastActiveDate: string;
        totalDaysActive: number;
        streakFreezes: number;
      };
    }>('/api/games/streak');
  }

  // Global Leaderboard
  async getGlobalLeaderboard() {
    return this.request<{
      success: boolean;
      leaderboard: Array<{
        userId: string;
        name: string;
        avatar?: string;
        totalPoints: number;
        rank: number;
        tier: string;
        gamesPlayed: number;
      }>;
      userStats?: {
        rank: number;
        totalPoints: number;
        gamesPlayed: number;
      };
    }>('/api/games/leaderboard');
  }
}

export const apiService = new ApiService();
export default apiService;
