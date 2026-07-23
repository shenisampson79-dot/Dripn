/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, ADMIN_API_URL } from '@/config/api';
import {
  USER_TOKEN_KEY,
  ADMIN_TOKEN_KEY,
  getSecureToken,
  setSecureToken,
  clearSecureToken,
} from '@/utils/secureTokenStore';

const DEVICE_ID_KEY = 'dripn_device_id';
const SESSION_BACKUP_KEY = '@dripn_session_backup';
const PENDING_APPLE_SUB_SYNC_KEY = '@dripn_pending_apple_sub_sync';

const DEFAULT_TIMEOUT = 30000;

class ApiService {
  private token: string | null = null;
  private sessionBackup: string | null = null;
  private guestToken: string | null = null;

  async init() {
    this.token = await getSecureToken(USER_TOKEN_KEY);
    try {
      this.sessionBackup = await AsyncStorage.getItem(SESSION_BACKUP_KEY);
    } catch {
      this.sessionBackup = null;
    }
  }

  private async persistSessionBackup(sessionId: string | null) {
    this.sessionBackup = sessionId;
    try {
      if (sessionId) {
        await AsyncStorage.setItem(SESSION_BACKUP_KEY, sessionId);
      } else {
        await AsyncStorage.removeItem(SESSION_BACKUP_KEY);
      }
    } catch {
      // Non-fatal
    }
  }

  private captureSessionBackupFromResponse(response: Response) {
    const header =
      response.headers.get('X-Session-Backup') ||
      response.headers.get('x-session-backup');
    if (header) {
      void this.persistSessionBackup(header);
    }
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
      await setSecureToken(USER_TOKEN_KEY, token);
    } else {
      await clearSecureToken(USER_TOKEN_KEY);
      await this.persistSessionBackup(null);
    }
  }

  async getToken() {
    // Always check SecureStore to handle cases where token was set elsewhere
    // or after initial load (e.g., user logged in after app start)
    const storedToken = await getSecureToken(USER_TOKEN_KEY);
    if (storedToken !== this.token) {
      this.token = storedToken;
    }
    return this.token;
  }
  
  // Force refresh token from storage (call after login)
  async refreshToken() {
    this.token = await getSecureToken(USER_TOKEN_KEY);
    return this.token;
  }

  /** Re-issue JWT via session backup or existing Bearer when possible. */
  async refreshAuthSession(): Promise<string | null> {
    await this.refreshToken();
    if (!API_URL) return this.token;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }
      if (!this.sessionBackup) {
        try {
          this.sessionBackup = await AsyncStorage.getItem(SESSION_BACKUP_KEY);
        } catch {
          // ignore
        }
      }
      if (this.sessionBackup) {
        headers['X-Session-Backup'] = this.sessionBackup;
      }

      const response = await this.fetchWithTimeout(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers,
        timeout: 15000,
      });
      this.captureSessionBackupFromResponse(response);
      if (!response.ok) return this.token;

      const result = await response.json().catch(() => null);
      if (result?.token) {
        await this.setToken(result.token);
        if (result.sessionBackup) {
          await this.persistSessionBackup(String(result.sessionBackup));
        }
      }
      return this.token;
    } catch (error) {
      console.warn('[ApiService] refreshAuthSession failed:', error);
      return this.token;
    }
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
    if (!this.sessionBackup) {
      try {
        this.sessionBackup = await AsyncStorage.getItem(SESSION_BACKUP_KEY);
      } catch {
        // ignore
      }
    }
    if (this.sessionBackup) {
      (headers as Record<string, string>)['X-Session-Backup'] = this.sessionBackup;
    }

    try {
      const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (deviceId) {
        (headers as Record<string, string>)['X-Device-Id'] = deviceId;
      }
    } catch {
      // Non-blocking — onboarding memory still works via explicit deviceId in body
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
          throw new Error('Server took too long to respond. Please try again.');
        }
        if (reason !== 'EXTERNAL_ABORT' && reason.length > 0) {
          throw new Error(reason);
        }
        throw new Error('Request was cancelled.');
      }
      const networkMessage = error?.message || '';
      if (
        networkMessage.includes('Network request failed') ||
        networkMessage.includes('Failed to fetch') ||
        networkMessage.includes('NetworkError')
      ) {
        throw new Error('Network error. Check your connection and try again.');
      }
      throw error;
    }

    this.captureSessionBackupFromResponse(response);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      const rawCode = String(error.error || error.errorCode || '').trim();
      const humanMessage = typeof error.message === 'string' ? error.message.trim() : '';
      const looksLikeCode = (value: string) => /^[A-Z][A-Z0-9_]{2,}$/.test(value);

      // Prefer a human message; never surface SCREAMING_SNAKE API codes to users
      let errorMessage =
        humanMessage && !looksLikeCode(humanMessage)
          ? humanMessage
          : rawCode && !looksLikeCode(rawCode)
            ? rawCode
            : '';

      const referralErrorMessages: Record<string, string> = {
        CODE_NOT_FOUND: 'We couldn’t find that referral code. Check for typos and try again.',
        INVALID_CODE: 'That referral code doesn’t look valid. Please check it and try again.',
        ALREADY_REFERRED: 'You’ve already used a referral code on this account.',
        ALREADY_APPLIED: 'You’ve already used a referral code on this account.',
        SELF_REFERRAL: 'You can’t use your own referral code.',
        OWN_CODE: 'You can’t use your own referral code.',
        REFERRAL_ALREADY_APPLIED: 'You’ve already used a referral code on this account.',
        CANNOT_REFER_SELF: 'You can’t use your own referral code.',
        NOT_AUTHENTICATED: 'Sign in to apply a referral code.',
        USER_NOT_FOUND: 'Account not found. Please try signing in again.',
      };

      if ((!errorMessage || looksLikeCode(errorMessage)) && referralErrorMessages[rawCode]) {
        errorMessage = referralErrorMessages[rawCode];
      } else if (looksLikeCode(errorMessage)) {
        errorMessage = errorMessage
          .split('_')
          .join(' ')
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase());
      }

      if (error.error === 'too_many_images') {
        // Keep code-friendly fallback — callers distinguish wardrobe vs gallery photos
        errorMessage = error.stylistResponse
          || (error.maxAllowed
            ? `You can add up to ${error.maxAllowed} items for this question. Remove a few and try again.`
            : 'Too many items for this question. Remove a few and try again.');
      } else if (error.stylistResponse && typeof error.stylistResponse === 'string') {
        errorMessage = error.stylistResponse;
      } else if (error.hint === 'stripe_portal_not_configured') {
        errorMessage =
          humanMessage ||
          error.error ||
          'Billing portal is not configured in Stripe. Enable Customer Portal under Stripe Dashboard → Settings → Billing → Customer portal.';
      } else if (error.hint && errorMessage && !errorMessage.includes(String(error.hint)) && !looksLikeCode(String(error.hint))) {
        errorMessage = `${errorMessage} (${error.hint})`;
      } else if (!errorMessage && error.hint) {
        errorMessage = String(error.hint);
      }
      
      // Log API errors for debugging
      console.log('=== API ERROR ===');
      console.log('Status:', response.status);
      console.log('Endpoint:', endpoint);
      console.log('Full error response:', JSON.stringify(error, null, 2));
      
      if (endpoint.includes('subscription')) {
        console.log('[Subscription DEBUG] Full error details:', { status: response.status, endpoint, error });
      }
      
      if (!errorMessage && error.errorCode) {
        errorMessage = humanMessage || String(error.errorCode);
      }

      if (!errorMessage || errorMessage === 'Request failed' || errorMessage.startsWith('HTTP') || looksLikeCode(errorMessage)) {
        switch (response.status) {
          case 401:
            errorMessage = 'Authentication required. Please log in to use this feature.';
            break;
          case 403:
            errorMessage = 'Access denied. Please check your credentials.';
            break;
          case 404:
            errorMessage = endpoint.includes('/referral')
              ? (referralErrorMessages[rawCode] ||
                'We couldn’t find that referral code. Check for typos and try again.')
              : 'Account not found. Please check your email or sign up.';
            break;
          case 429:
            errorMessage =
              (error.limitCopy && typeof error.limitCopy.message === 'string' && error.limitCopy.message) ||
              humanMessage ||
              'Too many attempts. Please try again later.';
            break;
          case 500:
            errorMessage = humanMessage || 'Server error. Please try again later.';
            break;
          default:
            errorMessage = humanMessage || 'Something went wrong. Please try again.';
        }
      }
      
      const apiError = new Error(errorMessage) as Error & {
        status?: number;
        statusCode?: number;
        errorCode?: string;
        code?: string;
        error?: string;
        maxAllowed?: number;
        voiceCreditsExhausted?: boolean;
        limitCopy?: unknown;
      };
      apiError.status = response.status;
      apiError.statusCode = response.status;
      apiError.errorCode = rawCode || undefined;
      apiError.code = (typeof error.code === 'string' && error.code) || rawCode || undefined;
      apiError.error = rawCode || undefined;
      if (typeof error.maxAllowed === 'number') {
        apiError.maxAllowed = error.maxAllowed;
      }
      if (error.errorCode) {
        apiError.errorCode = String(error.errorCode);
      }
      if (error.voiceCreditsExhausted) {
        apiError.voiceCreditsExhausted = true;
      }
      if (error.limitCopy) {
        apiError.limitCopy = error.limitCopy;
      }
      throw apiError;
    }

    return response.json();
  }

  private async adminRequest<T>(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Prefer dedicated admin portal JWT; fall back to app user JWT (is_admin).
    // Never ship server admin secrets in the client binary — use JWT only.
    const adminToken = await getSecureToken(ADMIN_TOKEN_KEY).catch(() => null);
    const userToken = adminToken ? null : await this.getToken().catch(() => null);
    const bearer = adminToken || userToken;
    if (bearer) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${bearer}`;
    }

    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${ADMIN_API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request was cancelled.');
      }
      throw error;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Admin request failed' }));
      if (response.status === 401) {
        const authError = new Error(error.error || 'Admin authentication required');
        (authError as Error & { code?: string }).code = 'ADMIN_AUTH_REQUIRED';
        throw authError;
      }
      const base = error.error || error.message || 'Admin request failed';
      const detail = typeof error.detail === 'string' && error.detail.trim() ? error.detail.trim() : '';
      throw new Error(detail && detail !== base ? `${base}: ${detail}` : base);
    }

    return response.json();
  }

  async register(email: string, password: string, displayName?: string, referralCode?: string) {
    const result = await this.request<{ token: string; user: any; referralReward?: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        displayName,
        ...(referralCode ? { referralCode } : {}),
      }),
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

  async deleteAccount() {
    return this.request<{
      success: boolean;
      message: string;
      appleSubscriptionNotice?: string;
    }>('/api/auth/delete-account', {
      method: 'POST',
    });
  }

  /** GDPR Art. 15 / 20 — personal data export (JSON). */
  async exportMyData() {
    return this.request<Record<string, unknown>>('/api/privacy/export', {
      method: 'GET',
      timeout: 90000,
    });
  }

  async socialLogin(
    provider: 'google' | 'facebook' | 'apple',
    accessToken: string,
    idToken?: string,
    extras?: {
      email?: string;
      displayName?: string;
      providerUserId?: string;
    },
  ) {
    const token = idToken || accessToken;
    const result = await this.request<{ token: string; user: any }>('/api/auth/social', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        token,
        ...(extras?.email ? { email: extras.email } : {}),
        ...(extras?.displayName ? { displayName: extras.displayName } : {}),
        ...(extras?.providerUserId ? { providerUserId: extras.providerUserId } : {}),
      }),
    });
    await this.setToken(result.token);
    return result;
  }

  async getCurrentUser() {
    return this.request<any>('/api/auth/me');
  }

  /** Alias used across auth flows */
  async getMe() {
    return this.getCurrentUser();
  }

  async fetchStyleProfile(): Promise<Record<string, any> | null> {
    try {
      return await this.request<Record<string, any>>('/api/style-profile');
    } catch {
      return null;
    }
  }

  async fetchOnboardingProgress(): Promise<Record<string, any> | null> {
    try {
      return await this.request<Record<string, any>>('/api/onboarding/progress');
    } catch {
      return null;
    }
  }

  async updateProfile(data: { displayName?: string; bio?: string; avatarUrl?: string | null }) {
    return this.request<any>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async syncProfile(profileData: Record<string, any>): Promise<void> {
    try {
      console.log('[ApiService] Syncing profile to backend:', { hasSeenTour: profileData.hasSeenTour, hasCompletedOnboarding: profileData.hasCompletedOnboarding });
      const result = await this.request<{ success: boolean }>('/api/auth/profile/sync', {
        method: 'PUT',
        body: JSON.stringify({ profileData }),
      });
      console.log('[ApiService] Profile sync successful');
    } catch (error) {
      // Log but don't throw — device still has AsyncStorage as source of truth
      console.error('[ApiService] Profile sync failed:', error);
    }
  }

  async fetchProfileFromBackend(): Promise<Record<string, any> | null> {
    try {
      const result = await this.request<{ profileData: Record<string, any> | null }>('/api/auth/me');
      return result?.profileData ?? null;
    } catch {
      return null;
    }
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

  async getCancelVariant() {
    return this.request<{
      success: boolean;
      variant: 'A' | 'B' | 'C';
      offers: Record<string, {
        title: string;
        body: string;
        primaryAction: string;
        actionLabel: string;
        acceptedOffer: string;
        discountPercent?: number;
        pauseMonths?: number;
        highlightPlan?: string;
        secondaryAction?: string;
        secondaryLabel?: string;
        secondaryAcceptedOffer?: string;
      }>;
    }>('/api/subscription/cancel/variant');
  }

  async getCancelOffer(subscriptionTier?: string) {
    return this.request<{
      success: boolean;
      variant: 'A' | 'B' | 'C';
      offer: {
        type: 'discount' | 'pause' | 'downgrade' | 'resume_full';
        offerKey: 'retention_50' | 'retention_30' | null;
        cta: string;
        segment: string;
        personaSegment?: string;
        usageSegment: string;
        churnScore?: number;
        socialProof?: { savesCount: number; avgSavedGbp: number };
        message: string;
        title: string;
        body: string;
        actionLabel: string;
        acceptedOffer: string;
        primaryAction: string;
        discountPercent?: number;
        pauseMonths?: number;
        highlightPlan?: string;
        variant?: string;
      };
      offers?: Record<string, unknown>;
      offerEventId?: number;
    }>('/api/subscription/cancel/offer', {
      method: 'POST',
      body: JSON.stringify({
        ...(subscriptionTier ? { subscriptionTier } : {}),
      }),
    });
  }

  async logAnalyticsEvent(data: {
    event: string;
    cta?: string;
    source?: string;
    campaign?: string;
    variant?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  }) {
    return this.request<{ success: boolean }>('/api/analytics/event', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
    const raw = await this.request<Record<string, unknown>>(`/api/color-trends/current${query ? `?${query}` : ''}`);
    const year = params?.year ?? new Date().getFullYear();

    const colorRaw = raw.colorOfTheYear ?? raw.colorOfYear;
    const colorOfTheYear = colorRaw && typeof colorRaw === 'object'
      ? {
          name: String((colorRaw as Record<string, unknown>).name ?? ''),
          hexCode: String((colorRaw as Record<string, unknown>).hexCode ?? (colorRaw as Record<string, unknown>).hex ?? ''),
          pantoneCode: (colorRaw as Record<string, unknown>).pantoneCode as string | undefined,
          description: String((colorRaw as Record<string, unknown>).description ?? ''),
          pairingColors: ((colorRaw as Record<string, unknown>).pairingColors as string[]) ?? [],
          bestFor: (
            ((colorRaw as Record<string, unknown>).bestFor as string[])
            ?? ((colorRaw as Record<string, unknown>).suitableFor as string[] | undefined)?.map(
              (v) => v.charAt(0).toUpperCase() + v.slice(1),
            )
            ?? ['Neutral']
          ),
          year: Number((colorRaw as Record<string, unknown>).year ?? year),
        }
      : null;

    const seasonalPalette = Array.isArray(raw.seasonalPalette)
      ? raw.seasonalPalette as Array<{
          id: string;
          name: string;
          hexCode: string;
          pantoneCode?: string;
          season: string;
          year: number;
          description: string;
          pairingColors: string[];
          bestFor: string[];
        }>
      : [];

    return {
      colorOfTheYear: colorOfTheYear!,
      seasonalPalette,
    };
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

  async analyzeGarmentByUri(imageUri: string): Promise<any> {
    if (!API_URL) {
      throw new Error('Backend API URL not configured. Set EXPO_PUBLIC_API_URL environment variable.');
    }

    const token = await this.getToken();
    if (!token) {
      throw new Error('401 Unauthorized — not authenticated');
    }

    // RN fetch + FormData file URIs is broken in current Expo ("Unsupported FormDataPart").
    // Base64 via /api/wardrobe/analyze/resilient is the reliable path.
    const { convertImageToBase64 } = await import('./VisionAnalysisService');
    const imageBase64 = await convertImageToBase64(imageUri);
    return this.analyzeGarmentPhoto(imageBase64);
  }

  async analyzeGarmentPhoto(imageBase64: string, options?: { detailed?: boolean }) {
    // Build headers with session backup for resilient auth
    const headers: Record<string, string> = {};
    if (this.sessionBackup) {
      headers['X-Session-Backup'] = this.sessionBackup;
    }
    if (this.guestToken) {
      headers['X-Guest-Token'] = this.guestToken;
    }
    
    const requestBody = JSON.stringify({ 
      imageBase64, 
      detailed: options?.detailed ?? true,
      analysisType: 'garment'
    });

    type AnalysisResult = {
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
      guestToken?: string;
      sessionBackup?: string;
      scansRemaining?: number;
      authMode?: string;
      errorCode?: string;
      message?: string;
    };

    const ANALYZE_TIMEOUT_MS = 120000;

    let result: AnalysisResult;
    try {
      console.log('[Wardrobe] Trying /api/wardrobe/analyze/resilient');
      result = await this.request<AnalysisResult>('/api/wardrobe/analyze/resilient', {
        method: 'POST',
        headers,
        body: requestBody,
        timeout: ANALYZE_TIMEOUT_MS,
      });
    } catch (resilientError: any) {
      const msg = resilientError?.message || '';
      if (/404|not found/i.test(msg)) {
        console.log('[Wardrobe] Resilient endpoint missing, falling back to /api/wardrobe/analyze');
        result = await this.request<AnalysisResult>('/api/wardrobe/analyze', {
          method: 'POST',
          body: requestBody,
          timeout: ANALYZE_TIMEOUT_MS,
        });
      } else {
        throw resilientError;
      }
    }

    if (result?.success === false) {
      throw new Error(result.message || 'Failed to analyze item');
    }

    console.log('[Wardrobe] Analysis response received');
    
    // Store tokens for future requests
    if (result.guestToken) this.guestToken = result.guestToken;
    if (result.sessionBackup) this.sessionBackup = result.sessionBackup;
    
    return result;
  }

  async analyzeGarmentBatchResilient(
    images: Array<{ imageBase64: string; id?: string }>,
  ) {
    try {
      await this.wakeBackend();
    } catch {
      // Non-fatal — batch request may still succeed if backend is already warm
    }

    const headers: Record<string, string> = {};
    if (this.sessionBackup) {
      headers['X-Session-Backup'] = this.sessionBackup;
    }
    if (this.guestToken) {
      headers['X-Guest-Token'] = this.guestToken;
    }

    const BATCH_TIMEOUT_MS = 180000;

    return this.request<any>('/api/wardrobe/batch-analyze/resilient', {
      method: 'POST',
      headers,
      body: JSON.stringify({ images }),
      timeout: BATCH_TIMEOUT_MS,
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
      backgroundRemoved?: boolean;
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
      timeout: 90000,
    });
  }

  async extractClothing(imageData: { imageBase64?: string; imageUrl?: string }) {
    // Always use real backend - no mock mode.
    // Note: resilient extract returns analysis only (processedImageUrl is null by design).
    type ExtractAnalysis = {
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

    const raw = await this.request<{
      success: boolean;
      processedImageUrl?: string | null;
      clothingAnalysis?: ExtractAnalysis | null;
      analysis?: {
        mainItem?: {
          type?: string;
          color?: string;
          style?: string;
          material?: string;
          brand?: string | null;
          features?: string[];
        };
        suggestedCategory?: string;
        suggestedName?: string;
      } | null;
      backgroundRemoved?: boolean;
      error?: string;
      analysisError?: string | null;
    }>('/api/wardrobe/extract-clothing/resilient', {
      method: 'POST',
      body: JSON.stringify(imageData),
      timeout: 60000,
    });

    const fromNested = raw.analysis?.mainItem
      ? {
          type: raw.analysis.mainItem.type || raw.analysis.suggestedCategory || '',
          color: raw.analysis.mainItem.color || '',
          style: raw.analysis.mainItem.style || '',
          material: raw.analysis.mainItem.material,
          brand: raw.analysis.mainItem.brand || undefined,
          features: raw.analysis.mainItem.features,
          description: raw.analysis.suggestedName || undefined,
        }
      : undefined;

    return {
      ...raw,
      processedImageUrl: raw.processedImageUrl ?? undefined,
      clothingAnalysis: raw.clothingAnalysis || fromNested,
      backgroundRemoved: Boolean(raw.backgroundRemoved),
    };
  }

  isConfigured() {
    return Boolean(API_URL);
  }

  async wakeBackend(): Promise<{ success: boolean; wasAsleep: boolean }> {
    if (!API_URL) {
      return { success: false, wasAsleep: false };
    }

    // Render free tier can take 30–60s to wake; retry with longer timeouts.
    const attempts = [
      { timeout: 20000, delayMs: 0 },
      { timeout: 35000, delayMs: 5000 },
      { timeout: 50000, delayMs: 8000 },
    ];

    let wasAsleep = false;
    for (let i = 0; i < attempts.length; i++) {
      const { timeout, delayMs } = attempts[i];
      if (delayMs > 0) {
        wasAsleep = true;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      try {
        const response = await this.fetchWithTimeout(`${API_URL}/api/health`, { timeout });
        if (response.ok) {
          return { success: true, wasAsleep };
        }
      } catch {
        if (i === 0) {
          console.log('Backend may be waking up (Render cold start), retrying...');
        }
      }
    }

    console.log('Backend wake-up failed after retries');
    return { success: false, wasAsleep: true };
  }

  async checkHealth(): Promise<boolean> {
    if (!API_URL) return false;
    try {
      const response = await this.fetchWithTimeout(`${API_URL}/api/health`, { timeout: 10000 });
      return response.ok;
    } catch {
      return false;
    }
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
    const result = await this.request<{
      success?: boolean;
      message: string;
      alreadySubscribed?: boolean;
      resubscribed?: boolean;
    }>('/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email, name, preferences }),
    });

    return {
      ...result,
      success: Boolean(
        result.success
        || result.alreadySubscribed
        || result.resubscribed
        || /subscribed|resubscribed/i.test(result.message ?? ''),
      ),
    };
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

  async applyReferralCode(code: string) {
    return this.request<{
      success: boolean;
      message?: string;
      bonusAIRequests?: number;
      referredByCode?: string;
      error?: string;
    }>('/api/referral/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getMyReferralStats() {
    return this.request<{
      success: boolean;
      referralCode: string | null;
      totalReferrals: number;
      bonusAIRequests: number;
      referredByCode: string | null;
      referralDiscountPending: boolean;
      referralDiscountApplied: boolean;
      referralCreditPercent?: number;
      referralNextInvoicePercent?: number;
      referralMaxPercentPerInvoice?: number;
    }>('/api/referral/me');
  }

  async consumeReferralAiBonus() {
    return this.request<{ success: boolean; consumed: boolean; bonusAIRequests: number }>(
      '/api/referral/consume-bonus',
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  async getReferralStats(code: string) {
    return this.request<{ referralCode: string; totalReferrals: number }>(`/api/referral/stats/${code}`);
  }

  async getPublishedNewsletters(params?: { limit?: number; offset?: number; category?: string; gender?: string; season?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.category) queryParams.set('category', params.category);
    if (params?.gender) queryParams.set('gender', params.gender);
    if (params?.season) queryParams.set('season', params.season);
    const queryString = queryParams.toString();
    const raw = await this.request<Record<string, unknown> | Array<Record<string, unknown>>>(
      `/api/newsletter/published${queryString ? `?${queryString}` : ''}`,
    );

    const newsletters = Array.isArray(raw)
      ? raw
      : ((raw.newsletters as Array<Record<string, unknown>> | undefined) ?? []);

    const categories = Array.isArray(raw)
      ? []
      : ((raw.categories as string[] | undefined) ?? []);

    return {
      success: true,
      newsletters,
      categories,
    };
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

  async reportContent(data: {
    contentType: 'post' | 'comment' | 'user';
    contentId: string;
    reason: string;
    details?: string;
  }) {
    return this.request<{ success: boolean; reportId?: string; message: string }>('/api/content/report', {
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
    // Render cold starts often exceed the default 30s timeout; wake first, then allow
    // enough time for OpenAI (same pattern as wardrobe / stylist resilient calls).
    try {
      await this.wakeBackend();
    } catch {
      // Non-fatal — request may still succeed if the backend is already warm
    }

    return this.request<{ response: string; fallback?: boolean }>('/api/support/chat', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 90000,
    });
  }

  async sendStylistMessage(data: {
    stylistId: string;
    messages: Array<{ role: string; content: string }>;
    userMessage: string;
    wardrobeItems?: Array<{
      id: string;
      name: string;
      color: string;
      category: string;
      brand?: string | null;
      subcategory?: string | null;
      wearCount?: number;
      timesWorn?: number;
      isFavorite?: boolean;
      favorite?: boolean;
      origin?: string | null;
      aiTags?: string[] | null;
      notes?: string | null;
    }>;
    userGender?: string;
    subscriptionTier?: string;
    language?: string;
    userProfile?: any;
    lat?: number;
    lon?: number;
    location?: string;
    countryCode?: string;
    decisionContinuity?: Record<string, unknown>;
    fromDecisionSessionId?: string;
    useRecentDecisionContinuity?: boolean;
  }): Promise<{
    content: string;
    wardrobeVisual?: {
      layout: 'highlight' | 'stacked' | 'multi';
      source?: 'wardrobe';
      matchScore?: number;
      pieces?: Array<{
        wardrobeItemId: number | string;
        name: string;
        role?: string;
        imageUrl?: string | null;
        category?: string | null;
        color?: string | null;
        brand?: string | null;
      }>;
      outfits?: Array<{
        title?: string | null;
        sectionIndex: number;
        pieces: Array<{
          wardrobeItemId: number | string;
          name: string;
          role?: string;
          imageUrl?: string | null;
          category?: string | null;
          color?: string | null;
          brand?: string | null;
        }>;
      }>;
    } | null;
    outfitVisualSuggestion?: {
      source: 'generated';
      outfitDescription: string;
      occasion: string;
      pieces?: Array<{ role: string; garment: string; descriptor: string }>;
    } | null;
    mood?: {
      mood: string;
      confidence: number;
      needsSupport: boolean;
      topicType: string;
    };
    stylistId?: string;
    error?: string;
    guestMessagesRemaining?: number;
    hasOutfitRecommendation?: boolean;
    visualAuthority?: 'server' | null;
  }> {
    const { stylistId, ...rest } = data;
    
    // Log request details
    const token = await this.getToken();
    console.log('=== SENDING STYLIST MESSAGE ===');
    console.log('API URL:', API_URL);
    console.log('Has auth token:', !!token);
    console.log('Has guest token:', !!this.guestToken);
    console.log('Has session backup:', !!this.sessionBackup);
    console.log('Stylist:', stylistId);
    console.log('Message:', data.userMessage);
    
    // Build headers with session backup for resilient auth
    const headers: Record<string, string> = {};
    if (this.sessionBackup) {
      headers['X-Session-Backup'] = this.sessionBackup;
    }
    if (this.guestToken) {
      headers['X-Guest-Token'] = this.guestToken;
    }
    
    // Use resilient endpoint that works with or without authentication
    // This endpoint provides automatic guest fallback with real AI
    const result = await this.request<{
      response?: string;
      content?: string;
      stylist?: string;
      wardrobeVisual?: {
        layout: 'highlight' | 'stacked' | 'multi';
        source?: 'wardrobe';
        matchScore?: number;
        pieces?: Array<{
          wardrobeItemId: number | string;
          name: string;
          role?: string;
          imageUrl?: string | null;
          category?: string | null;
          color?: string | null;
          brand?: string | null;
        }>;
        outfits?: Array<{
          title?: string | null;
          sectionIndex: number;
          pieces: Array<{
            wardrobeItemId: number | string;
            name: string;
            role?: string;
            imageUrl?: string | null;
            category?: string | null;
            color?: string | null;
            brand?: string | null;
          }>;
        }>;
      } | null;
      outfitVisualSuggestion?: {
        source: 'generated';
        outfitDescription: string;
        occasion: string;
        pieces?: Array<{ role: string; garment: string; descriptor: string }>;
      } | null;
      mood?: {
        mood: string;
        confidence: number;
        needsSupport: boolean;
        topicType: string;
      };
      error?: string;
      guestToken?: string;
      guestMessagesRemaining?: number;
      sessionBackup?: string;
      hasOutfitRecommendation?: boolean;
      visualAuthority?: 'server' | null;
    }>('/api/chat/resilient', {
      method: 'POST',
      headers,
      timeout: 90000,
      body: JSON.stringify({ ...rest, stylist: stylistId, message: data.userMessage, language: data.language }),
    });
    
    // Store session backup and guest token for future requests
    if (result.sessionBackup) {
      this.sessionBackup = result.sessionBackup;
      console.log('Session backup stored');
    }
    if (result.guestToken) {
      this.guestToken = result.guestToken;
      console.log('Guest token stored');
    }
    
    // Log the raw response for debugging
    console.log('=== BACKEND RESPONSE ===');
    console.log('RAW BACKEND RESPONSE:', JSON.stringify(result));
    console.log('Response field:', result.response);
    console.log('Content field:', result.content);
    if (result.guestMessagesRemaining !== undefined) {
      console.log('Guest messages remaining:', result.guestMessagesRemaining);
    }
    
    // Map backend 'response' field to frontend 'content' field
    const mappedContent = result.response || result.content || '';
    console.log('Final mapped content:', mappedContent);
    
    return {
      content: mappedContent,
      wardrobeVisual: result.wardrobeVisual ?? null,
      outfitVisualSuggestion: result.outfitVisualSuggestion ?? null,
      mood: result.mood,
      stylistId: result.stylist || stylistId,
      error: result.error,
      guestMessagesRemaining: result.guestMessagesRemaining,
      hasOutfitRecommendation: result.hasOutfitRecommendation,
      visualAuthority: result.visualAuthority ?? null,
    };
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

  async submitDecisionCheck(data: {
    decisionType: 'sanity_check' | 'shopping' | 'what_to_wear' | 'event_outfit';
    images: string[];
    context: string;
    stylist: string;
    userProfile?: any;
    surpriseMe?: boolean;
    clientImageCount?: number;
    decisionSessionId?: string;
    selectedContexts?: string[];
    eventDetails?: Record<string, string>;
    selectedWardrobeIds?: Array<string | number>;
    wardrobeItems?: Array<{
      id?: string | number;
      name?: string;
      category?: string;
      color?: string;
      brand?: string;
      occasions?: string[] | string;
      subcategory?: string;
    }>;
  }) {
    const images = (data.images || []).filter(
      (img) => typeof img === 'string' && img.length > 100,
    );
    const approxKb = Math.round(images.reduce((sum, img) => sum + img.length, 0) / 1024);
    console.log('[Ask Stylist] Submitting to /api/decision/check/resilient with decisionType:', data.decisionType);
    console.log('[Ask Stylist] Number of images:', images.length, 'approxKb:', approxKb, 'surpriseMe:', data.surpriseMe);
    if ((data.clientImageCount || 0) > 0 && images.length === 0) {
      throw new Error('Photos were selected but could not be attached. Please re-add them and try again.');
    }

    return this.request<{
      success: boolean;
      decision: string;
      response?: string;
      recommendation?: string;
      reasoning?: string;
      styleRating?: number | null;
      ratingLabel?: string | null;
      outfitPieces?: Array<{
        role: string;
        name: string;
        wardrobeItemId?: number;
        stylingNote?: string;
        imageUrl?: string | null;
        category?: string | null;
        color?: string | null;
        brand?: string | null;
      }> | null;
      outfitSummary?: string | null;
      why?: string[] | null;
      scores?: Record<string, unknown> | null;
      surpriseMe?: boolean;
      stylistId?: string;
      decisionType?: string;
      error?: string;
      stylistResponse?: string;
      message?: string;
      outfitImageUrl?: string;
      recommendedIndex?: number | null;
      selectedOptionIndex?: number | null;
      unifiedScore?: number | null;
    }>('/api/decision/check/resilient', {
      method: 'POST',
      timeout: 90000,
      body: JSON.stringify({ ...data, images }),
    });
  }

  /**
   * Shared stylist engine — Today / Surprise / event wardrobe outfits.
   * Server authority: buildStylistContext → generateOutfit → validateOutfit.
   */
  async generateStylistOutfit(data: {
    intent: 'today' | 'event' | 'surprise' | 'chat' | 'shopping' | 'sanity';
    occasionType?: string;
    weather?: {
      temperature?: number;
      condition?: string;
      location?: string;
      unit?: string;
    } | null;
    dressFor?: string | null;
    stylistId?: string;
    /** Client local calendar day (YYYY-MM-DD). */
    dateKey?: string;
    localItems?: Array<{
      id?: string | number;
      name?: string;
      category?: string;
      color?: string;
      brand?: string;
      occasions?: string[] | string;
      subcategory?: string;
      imageUri?: string;
      imageUrl?: string;
    }>;
    excludeItemIds?: Array<string | number>;
    /** Soft anti-repeat — recently recommended/worn item ids. */
    penalizeItemIds?: Array<string | number>;
    /** Hard diversity — recent full outfits as item-id lists (most recent first). */
    priorOutfits?: Array<Array<string | number>>;
    recentOutfits?: Array<Array<string | number>>;
    environment?: {
      weather?: unknown;
      occasion?: string;
      dateKey?: string;
      dressCode?: string;
      location?: unknown;
      intent?: string;
    };
  }) {
    return this.request<{
      success: boolean;
      engineVersion?: string;
      intent?: string;
      stylistId?: string;
      dateKey?: string;
      occasionType?: string;
      dressFor?: string | null;
      outfit?: {
        id: string;
        dateKey: string;
        itemIds: string[];
        occasionType: string;
        stylistMessage?: string;
        vibeLabel?: string;
        pieces?: Array<{
          role?: string;
          name?: string;
          wardrobeItemId?: string | number;
          stylingNote?: string | null;
          category?: string | null;
          color?: string | null;
          brand?: string | null;
          imageUrl?: string | null;
        }>;
        items?: Array<{
          role?: string;
          name?: string;
          wardrobeItemId?: string | number;
          category?: string | null;
          color?: string | null;
          brand?: string | null;
          imageUrl?: string | null;
        }>;
      };
      why?: string[];
      scores?: Record<string, unknown> | null;
      diversity?: {
        historyCount?: number;
        rejectedSimilar?: number;
        wardrobeLocked?: boolean;
        hardExcludeApplied?: boolean;
        pickedItemIds?: string[];
      } | null;
      error?: string;
      message?: string;
    }>('/api/stylist/generate', {
      method: 'POST',
      timeout: 45000,
      body: JSON.stringify(data),
    });
  }

  async submitQuickFeedback(data: {
    helpful: boolean;
    stylistUsed: string;
    context: string;
  }) {
    return this.request<{
      success: boolean;
      message?: string;
    }>('/api/feedback/quick', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitDetailedFeedback(data: {
    recommendationType: 'outfit_check' | 'shopping' | 'what_to_wear' | 'event_outfit' | 'chat';
    stylistUsed: string;
    aiResponse: string;
    userRating: number;
    feedbackType: 'helpful' | 'not_helpful' | 'too_western' | 'not_my_style' | 'loved_it' | 'body_type_mismatch' | 'cultural_miss';
    contextGiven: string;
    wasUseful: boolean;
  }) {
    return this.request<{
      success: boolean;
      message?: string;
    }>('/api/feedback/style', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendVoiceChatMessage(data: {
    stylistId: string;
    message: string;
    generateVoice?: boolean;
    voiceSettings?: { accent?: string; voiceRange?: string };
    accent?: string;
    voiceRange?: string;
    language?: string;
    wardrobeItems?: Array<{
      id: string;
      name: string;
      color: string;
      category: string;
      brand?: string | null;
      wearCount?: number;
      timesWorn?: number;
      isFavorite?: boolean;
      origin?: string | null;
    }>;
  }) {
    const { stylistId, voiceSettings, ...rest } = data;
    const raw = await this.request<{
      success?: boolean;
      response: string;
      audioBase64?: string;
      voice?: { audio: string; audioDataUri: string };
      voiceAudio?: string;
      voiceCredits?: {
        remaining: number;
        monthlyAllowance: number;
        monthlyHardCap?: number;
        usedThisMonth?: number;
        monthlyRemaining: number;
        purchasedCredits: number;
        isUnlimited: boolean;
        softCapWarning?: 'usage_high' | 'approaching_limit' | null;
      };
      voiceCreditsExhausted?: boolean;
      voiceError?: { code: string; message: string };
      error?: string;
    }>('/api/chat/message/resilient', {
      method: 'POST',
      timeout: 90000,
      body: JSON.stringify({
        ...rest,
        stylist: stylistId,
        generateVoice: rest.generateVoice ?? true,
        accent: rest.accent || voiceSettings?.accent,
        voiceRange: rest.voiceRange || voiceSettings?.voiceRange,
      }),
    });

    const audioData = raw.voice?.audio || raw.voiceAudio || raw.audioBase64;
    return {
      ...raw,
      response: raw.response,
      voiceAudio: audioData,
      voice: audioData
        ? {
            audio: audioData,
            audioDataUri: raw.voice?.audioDataUri || `data:audio/mpeg;base64,${audioData}`,
          }
        : raw.voice,
    };
  }

  async getVoiceCreditsBalance() {
    // Same cold-start pattern as Julia support chat — Render can sleep past the default 30s.
    try {
      await this.wakeBackend();
    } catch {
      // Non-fatal — balance request may still succeed if the backend is already warm
    }

    // Mirror Apple subscription sync — SecureStore can lag; session backup can still auth.
    await this.refreshToken();
    if (!(await this.getToken())) {
      await this.refreshAuthSession();
    }

    const attempt = () =>
      this.request<{
        success: boolean;
        canUse?: boolean;
        reason?: string;
        credits: {
          remaining: number;
          monthlyAllowance: number;
          monthlyHardCap?: number;
          usedThisMonth: number;
          monthlyRemaining: number;
          purchasedCredits: number;
          isUnlimited: boolean;
          weekendUnlimitedActive?: boolean;
          weekendUnlimitedExpiresAt?: string | null;
          softCapWarning?: 'usage_high' | 'approaching_limit' | null;
        };
        tier: string;
        tierName: string;
      }>('/api/voice-credits/balance', { timeout: 90000 });

    try {
      return await attempt();
    } catch (error: unknown) {
      const status =
        (error as { status?: number; statusCode?: number })?.status ??
        (error as { statusCode?: number })?.statusCode;
      if (status === 401) {
        await this.refreshAuthSession();
        return await attempt();
      }
      throw error;
    }
  }

  async getVoiceCreditPackages() {
    return this.request<{
      success?: boolean;
      packages: Array<{
        id: string;
        credits: number;
        priceGBP?: number;
        priceLabel?: string;
        description?: string;
        discountedPrice?: number;
        chargePence?: number;
        name?: string;
        price?: number;
        currency?: string;
        popular?: boolean;
        weekendUnlimited?: boolean;
      }>;
      userTier?: string;
      creditPrice?: number;
    }>('/api/voice-credits/packages');
  }

  async purchaseVoiceCredits(packageId: string, language?: string) {
    return this.request<{
      success?: boolean;
      checkoutUrl: string;
      sessionId: string;
      credits?: number;
      amount?: number;
    }>('/api/voice-credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ packageId, ...(language ? { language } : {}) }),
    });
  }

  async confirmVoiceCreditsPurchase(sessionId: string) {
    return this.request<{
      success: boolean;
      creditsAdded: number;
      weekendUnlimited?: boolean;
      weekendUnlimitedExpiresAt?: string | null;
      newBalance: {
        remaining: number | string;
        purchasedCredits: number;
        weekendUnlimitedActive?: boolean;
        weekendUnlimitedExpiresAt?: string | null;
      };
    }>('/api/voice-credits/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async syncAppleVoicePurchase(payload: {
    productId?: string | null;
    credits?: number | null;
    packId?: string | null;
    originalTransactionId?: string | null;
    customerInfo?: Record<string, unknown>;
  }) {
    return this.request<{
      success: boolean;
      creditsAdded: number;
      alreadySynced?: boolean;
      billingPlatform?: string;
      productId?: string;
      weekendUnlimited?: boolean;
      weekendUnlimitedExpiresAt?: string | null;
      newBalance: {
        remaining: number | string;
        purchasedCredits: number;
        weekendUnlimitedActive?: boolean;
        weekendUnlimitedExpiresAt?: string | null;
      };
    }>('/api/voice/apple/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createCheckoutSession(plan: string, language?: string) {
    return this.request<{ checkoutUrl: string; sessionId: string }>('/api/checkout/create-session', {
      method: 'POST',
      body: JSON.stringify({ plan, ...(language ? { language } : {}) }),
    });
  }

  async getCheckoutSession(sessionId: string) {
    return this.request<{ 
      status: string; 
      productId: string;
      amountTotal: number;
      currency: string;
    }>(`/api/checkout/session/${sessionId}`);
  }

  async getStripeConfig() {
    try {
      return await this.request<{ publishableKey: string; configured?: boolean }>('/api/checkout/config');
    } catch {
      return this.request<{ publishableKey: string; configured?: boolean }>('/api/stripe/config');
    }
  }

  async createDFYCheckoutSession(
    email: string,
    packageType: 'lite' | 'core',
    language?: string,
    redirects?: { successUrl?: string; cancelUrl?: string },
  ) {
    const plan = packageType === 'core' ? 'core_wardrobe' : 'outfit_setup';
    const headers: Record<string, string> = {};
    if (this.guestToken) {
      headers['X-Guest-Token'] = this.guestToken;
    }
    return this.request<{ checkoutUrl: string; sessionId: string }>('/api/checkout/dfy/create-session', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        productId: plan,
        ...(language ? { language } : {}),
        ...(redirects?.successUrl ? { successUrl: redirects.successUrl } : {}),
        ...(redirects?.cancelUrl ? { cancelUrl: redirects.cancelUrl } : {}),
      }),
    });
  }

  async getDFYProducts() {
    return this.request<{
      products: Array<{
        id: string;
        name: string;
        price: string;
        priceAmount?: number;
        amount?: number;
        currency: string;
        features?: string[];
        type?: 'lite' | 'core' | 'one_time';
      }>;
    }>('/api/checkout/dfy/products');
  }

  async verifyDFYPayment(sessionId: string, email?: string) {
    const headers: Record<string, string> = {};
    if (this.guestToken) {
      headers['X-Guest-Token'] = this.guestToken;
    }
    return this.request<{
      success: boolean;
      paid: boolean;
      productId?: string;
      productName?: string;
      isPreSignup?: boolean;
      sessionId?: string;
    }>('/api/checkout/dfy/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId, email }),
    });
  }

  async linkDFYPayment(email: string) {
    return this.request<{
      success: boolean;
      linked: boolean;
      packageType: string;
    }>('/api/checkout/dfy/link-payment', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getSubscriptionPlans() {
    return this.request<{
      plans: Array<{
        id: string;
        name: string;
        tier?: string;
        legacy?: boolean;
        monthlyPrice: string;
        monthlyPriceAmount: number;
        yearlyPrice: string;
        yearlyPriceAmount: number;
        yearlySavings?: string;
        yearlySaving?: string;
        currency: string;
        features: string[];
        popular?: boolean;
        recommended?: boolean;
      }>;
    }>('/api/subscription/plans');
  }

  async getDfyComparison() {
    return this.request<{
      liteCard?: { price?: string };
      coreCard?: { price?: string };
    }>('/api/dfy/comparison');
  }

  async getSubscriptionStatus() {
    const raw = await this.request<any>('/api/subscription/status');
    const sub = raw.subscription ?? raw;
    const plan = sub.tier ?? sub.plan ?? 'free';
    const isActive = sub.active ?? sub.isActive ?? (plan !== 'free' && plan !== null);
    const hasStripeBilling =
      sub.hasStripeBilling ??
      raw.hasStripeBilling ??
      Boolean(sub.stripeCustomerId ?? raw.stripeCustomerId ?? sub.stripeSubscriptionId ?? raw.stripeSubscriptionId);
    return {
      active: isActive,
      plan,
      status: isActive ? 'active' : 'inactive',
      currentPeriodEnd: sub.currentPeriodEnd ?? sub.cancelAt ?? null,
      cancelAt: sub.cancelAt ?? sub.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
      stripeCustomerId: sub.stripeCustomerId ?? raw.stripeCustomerId ?? null,
      stripeSubscriptionId: sub.stripeSubscriptionId ?? raw.stripeSubscriptionId ?? null,
      hasStripeBilling,
      isTrial: sub.isTrial ?? raw.isTrial ?? false,
      billingPlatform: sub.billingPlatform ?? raw.billingPlatform ?? null,
    };
  }

  async verifySubscription(sessionId?: string) {
    const raw = await this.request<any>('/api/subscription/verify', {
      method: 'POST',
      body: sessionId ? JSON.stringify({ sessionId }) : undefined,
    });
    const plan = raw.tier ?? raw.plan ?? raw.subscription?.tier ?? null;
    const isActive = Boolean(plan && plan !== 'free');
    return {
      active: isActive,
      plan,
      status: isActive ? 'active' : 'inactive',
      stripeSubscriptionId: raw.stripeSubscriptionId ?? null,
      stripeCustomerId: raw.stripeCustomerId ?? null,
      verified: raw.verified ?? raw.success ?? false,
    };
  }

  async removeBackground(imageBase64: string) {
    return this.request<{
      imageUrl: string | null;
      imageBase64?: string | null;
      method?: string;
      removed?: boolean;
    }>('/api/wardrobe/remove-background', {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
      // Replicate rembg can take 30–60s; default 30s timeout made preview look like a no-op
      timeout: 90000,
    });
  }

  async createSubscriptionCheckout(plan: string, billingCycle: 'monthly' | 'yearly' = 'monthly', language?: string) {
    return this.request<{ checkoutUrl: string; sessionId: string; plan?: string }>('/api/subscription/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, billingCycle, ...(language ? { language } : {}) }),
    });
  }

  async syncAppleSubscription(payload: {
    tier?: string;
    productId?: string;
    originalTransactionId?: string;
    customerInfo?: Record<string, unknown>;
  }) {
    await this.refreshToken();
    if (!(await this.getToken()) && !this.sessionBackup) {
      await this.refreshAuthSession();
    }

    const attempt = () =>
      this.request<{
        success: boolean;
        tier: string;
        tierName?: string;
        billingPlatform?: string;
      }>('/api/subscription/apple/sync', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

    try {
      const result = await attempt();
      await AsyncStorage.removeItem(PENDING_APPLE_SUB_SYNC_KEY).catch(() => {});
      return result;
    } catch (error: unknown) {
      const status = (error as { status?: number; statusCode?: number })?.status
        ?? (error as { statusCode?: number })?.statusCode;
      const shouldQueue = !status || status === 401 || status >= 500;
      if (status === 401) {
        await this.refreshAuthSession();
        try {
          const retried = await attempt();
          await AsyncStorage.removeItem(PENDING_APPLE_SUB_SYNC_KEY).catch(() => {});
          return retried;
        } catch (retryError) {
          if (shouldQueue) {
            await this.queuePendingAppleSubscriptionSync(payload);
          }
          throw retryError;
        }
      }
      if (shouldQueue) {
        await this.queuePendingAppleSubscriptionSync(payload);
      }
      throw error;
    }
  }

  async queuePendingAppleSubscriptionSync(payload: {
    tier?: string;
    productId?: string;
    originalTransactionId?: string;
    customerInfo?: Record<string, unknown>;
  }) {
    try {
      await AsyncStorage.setItem(
        PENDING_APPLE_SUB_SYNC_KEY,
        JSON.stringify({ ...payload, queuedAt: new Date().toISOString() }),
      );
    } catch (error) {
      console.warn('[ApiService] Failed to queue Apple subscription sync:', error);
    }
  }

  /** Retry a queued post-purchase Apple sync (e.g. after auth recovers). */
  async flushPendingAppleSubscriptionSync(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_APPLE_SUB_SYNC_KEY);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (!payload || typeof payload !== 'object') {
        await AsyncStorage.removeItem(PENDING_APPLE_SUB_SYNC_KEY);
        return false;
      }
      const { queuedAt: _queuedAt, ...syncPayload } = payload;
      await this.refreshAuthSession();
      await this.request('/api/subscription/apple/sync', {
        method: 'POST',
        body: JSON.stringify(syncPayload),
      });
      await AsyncStorage.removeItem(PENDING_APPLE_SUB_SYNC_KEY);
      console.log('[ApiService] Flushed pending Apple subscription sync');
      return true;
    } catch (error) {
      console.warn('[ApiService] Pending Apple subscription sync still failing:', error);
      return false;
    }
  }

  async syncAppleDFYPurchase(payload: {
    tier?: 'lite' | 'core';
    productId?: string;
    originalTransactionId?: string;
    customerInfo?: Record<string, unknown>;
  }) {
    return this.request<{
      success: boolean;
      tier: 'lite' | 'core' | null;
      plan?: string;
      tierName?: string;
      billingPlatform?: string;
      alreadySynced?: boolean;
    }>('/api/dfy/apple/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createBillingCheckout(plan: string, language?: string) {
    return this.request<{ checkoutUrl: string; sessionId: string; plan: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, ...(language ? { language } : {}) }),
    });
  }

  async openBillingPortal(returnUrl = 'https://dripnapp.com/subscription') {
    const raw = await this.request<{
      url?: string;
      portalUrl?: string;
      success?: boolean;
      mode?: 'portal' | 'in_app';
      action?: string;
      message?: string;
    }>(
      '/api/subscription/manage',
      {
        method: 'POST',
        body: JSON.stringify({ returnUrl }),
      },
    );
    const url = raw.portalUrl ?? raw.url ?? '';
    const mode = raw.mode ?? (url ? 'portal' : 'in_app');
    return {
      success: raw.success ?? true,
      mode,
      action: raw.action,
      message: raw.message,
      url,
    };
  }

  async cancelSubscription(options?: {
    reason?: string;
    immediately?: boolean;
    variant?: string;
    acceptedOffer?: string;
  }) {
    return this.request<{
      success: boolean;
      message?: string;
      cancelAtPeriodEnd?: boolean;
      cancelAt?: string;
      currentPeriodEnd?: string;
    }>('/api/subscription/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reason: options?.reason,
        immediately: options?.immediately ?? false,
        variant: options?.variant,
        acceptedOffer: options?.acceptedOffer,
      }),
    });
  }

  async pauseSubscription(options?: {
    months?: number;
    reason?: string;
    variant?: string;
    acceptedOffer?: string;
    offerType?: string;
  }) {
    return this.request<{
      success: boolean;
      message?: string;
      pausedUntil?: string;
    }>('/api/subscription/pause', {
      method: 'POST',
      body: JSON.stringify({
        months: options?.months,
        reason: options?.reason,
        variant: options?.variant,
        acceptedOffer: options?.acceptedOffer,
        offerType: options?.offerType,
      }),
    });
  }

  async applySubscriptionDiscount(options?: {
    reason?: string;
    variant?: string;
    acceptedOffer?: string;
    offerType?: string;
    /** Server-side retention offer key — never send raw Stripe coupon IDs */
    offer?: 'retention_30' | 'retention_50' | string;
    /** @deprecated Prefer `offer` (retention_30 / retention_50) */
    discountPercent?: number;
  }) {
    return this.request<{
      success: boolean;
      message?: string;
      discountApplied?: boolean;
      discountPercent?: number;
      offer?: string;
    }>('/api/subscription/apply-discount', {
      method: 'POST',
      body: JSON.stringify({
        reason: options?.reason,
        variant: options?.variant,
        acceptedOffer: options?.acceptedOffer,
        offer: options?.offer,
        discountPercent: options?.discountPercent,
        offerType: options?.offerType,
      }),
    });
  }

  async downgradeSubscription(options: {
    plan: 'style_chat' | 'personal_stylist' | 'stylist_unlimited';
    reason?: string;
    variant?: string;
    acceptedOffer?: string;
    offerType?: string;
  }) {
    return this.request<{
      success: boolean;
      message?: string;
      plan?: string;
      tierName?: string;
    }>('/api/subscription/downgrade', {
      method: 'POST',
      body: JSON.stringify({
        plan: options.plan,
        reason: options.reason,
        variant: options.variant,
        acceptedOffer: options.acceptedOffer,
      }),
    });
  }

  async reactivateSubscription() {
    return this.request<{
      success: boolean;
      reactivated: boolean;
    }>('/api/subscription/reactivate', {
      method: 'POST',
    });
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

  async transcribeAudio(
    audio: string,
    mimeType: 'audio/webm' | 'audio/wav' | 'audio/mp3' | 'audio/m4a' | 'audio/mp4' = 'audio/m4a',
    language: string = 'en'
  ) {
    return this.request<{
      success: boolean;
      text: string;
      language: string;
    }>('/api/ai/transcribe', {
      method: 'POST',
      timeout: 60000,
      body: JSON.stringify({ audio, mimeType, language }),
    });
  }

  // Combined voice chat endpoint - handles transcription, AI response, and voice generation in one call
  async voiceChat(data: {
    audio: string;
    mimeType: 'audio/webm' | 'audio/wav' | 'audio/mp3' | 'audio/m4a' | 'audio/mp4';
    stylist: string;
    accent?: string;
    voiceRange?: string;
    language?: string;
  }) {
    return this.request<{
      success: boolean;
      userMessage: string;
      aiResponse: string;
      audioBase64: string | null;
      stylist: string;
      message?: string;
      emptyTranscript?: boolean;
      voiceCreditsExhausted?: boolean;
      voiceCredits?: {
        remaining: number | string;
        monthlyAllowance: number;
        monthlyRemaining?: number;
        purchasedCredits?: number;
        isUnlimited?: boolean;
      };
    }>('/api/ai/voice-chat', {
      method: 'POST',
      timeout: 90000,
      body: JSON.stringify(data),
    });
  }

  async synthesizeSpeech(text: string, options?: { voice?: string; stylistId?: string; speed?: number }) {
    const { stylistId, ...otherOptions } = options || {};
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
      body: JSON.stringify({ text, ...otherOptions, stylist: stylistId }),
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
    const { stylistId, ...rest } = data;
    return this.request<{
      success: boolean;
      transcribedText?: string;
      language?: string;
      duration?: number;
      stylistId?: string;
    }>('/api/ai/voice-message', {
      method: 'POST',
      body: JSON.stringify({ ...rest, stylist: stylistId }),
    });
  }

  async createVoiceResponse(data: { 
    textResponse: string; 
    stylistId?: string; 
    speed?: number;
    voice?: string;
    language?: string;
  }) {
    const { stylistId, ...rest } = data;
    return this.request<{
      success: boolean;
      audio: {
        audioBuffer?: string;
        voice?: string;
        format?: string;
      };
    }>('/api/ai/voice-response', {
      method: 'POST',
      body: JSON.stringify({ ...rest, stylist: stylistId }),
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

  // ===== WARDROBE BATCH UPLOAD =====
  async uploadWardrobeBatch(items: Array<{
    name: string;
    category: string;
    subcategory?: string;
    imageBase64?: string;
    imageUrl?: string;
    color: string;
    season?: string | string[];
    occasions?: string[];
    brand?: string | null;
    itemType?: string;
  }>) {
    return this.request<{
      success: boolean;
      saved: number;
      failed: number;
      items: Array<{
        id: string;
        name: string;
        category: string;
        color: string;
        imageUrl?: string;
      }>;
      errors: Array<{
        index: number;
        name: string;
        error: string;
      }>;
    }>('/api/wardrobe/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
      timeout: 120000, // 2 minute timeout for batch uploads
    });
  }

  async startTrial() {
    return this.request<{ success: boolean; tier: string; trialDays: number; expiresAt: string }>(
      '/api/subscription/start-trial',
      { method: 'POST' }
    );
  }

  async fetchWardrobeItems(): Promise<{ success: boolean; items: any[] }> {
    const data = await this.request<any>('/api/wardrobe');
    if (Array.isArray(data)) {
      return { success: true, items: data };
    }
    return data;
  }

  async addWardrobeItem(item: {
    name: string;
    category: string;
    subcategory?: string;
    color?: string;
    brand?: string;
    seasons?: string[];
    occasions?: string[];
    origin?: string;
    isFavorite?: boolean;
    metadata?: Record<string, any>;
    imageBase64?: string;
    imageUrl?: string;
  }): Promise<{ success: boolean; item: any }> {
    return this.request<{ success: boolean; item: any }>('/api/wardrobe', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateWardrobeItem(id: string, updates: {
    name?: string;
    category?: string;
    color?: string;
    brand?: string;
    seasons?: string[];
    occasions?: string[];
    isFavorite?: boolean;
    timesWorn?: number;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; item: any }> {
    return this.request<{ success: boolean; item: any }>(`/api/wardrobe/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteWardrobeItem(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/wardrobe/${id}`, {
      method: 'DELETE',
    });
  }

  async batchAddWardrobeItems(
    items: any[],
    options?: { processImagesAfterSave?: boolean },
  ): Promise<{ success: boolean; items: any[]; saved: number; failed: number; errors: any[] }> {
    return this.request<{ success: boolean; items: any[]; saved: number; failed: number; errors: any[] }>('/api/wardrobe/batch', {
      method: 'POST',
      body: JSON.stringify({
        items,
        processImagesAfterSave: options?.processImagesAfterSave !== false,
      }),
      timeout: 120000,
    });
  }

  async uploadWardrobeItemImage(id: string, imageBase64: string, options?: { sync?: boolean }): Promise<{ success: boolean; processing?: boolean; imageUrl?: string; imageProcessed?: boolean }> {
    const sync = options?.sync ? '?sync=true' : '';
    return this.request<{ success: boolean; processing?: boolean; imageUrl?: string; imageProcessed?: boolean }>(`/api/wardrobe/${id}/upload-image${sync}`, {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
      timeout: options?.sync ? 120000 : 30000,
    });
  }

  async bulkDeleteWardrobeItems(ids: string[]): Promise<{ success: boolean; deleted: number; ids: number[] }> {
    return this.request<{ success: boolean; deleted: number; ids: number[] }>('/api/wardrobe/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  async reprocessItemBackground(id: string): Promise<{ success: boolean; imageUrl?: string; alreadyProcessed?: boolean }> {
    return this.request<{ success: boolean; imageUrl?: string; alreadyProcessed?: boolean }>(`/api/wardrobe/${id}/reprocess-background`, {
      method: 'POST',
      timeout: 60000,
    });
  }

  async reprocessAllBackgrounds(): Promise<{
    success: boolean;
    started?: boolean;
    inProgress?: boolean;
    processed: number;
    failed: number;
    total: number;
    concurrency?: number;
    message?: string;
  }> {
    return this.request<{
      success: boolean;
      started?: boolean;
      inProgress?: boolean;
      processed: number;
      failed: number;
      total: number;
      concurrency?: number;
      message?: string;
    }>('/api/wardrobe/reprocess-all-backgrounds', {
      method: 'POST',
      timeout: 30000,
    });
  }

  async getBackgroundReprocessStatus(): Promise<{
    success: boolean;
    inProgress: boolean;
    total: number;
    processed: number;
    failed: number;
    error?: string | null;
  }> {
    return this.request<{
      success: boolean;
      inProgress: boolean;
      total: number;
      processed: number;
      failed: number;
      error?: string | null;
    }>('/api/wardrobe/reprocess-all-backgrounds/status', {
      method: 'GET',
      timeout: 15000,
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

  // Clueless-style Wardrobe View
  async getCluelessWardrobeView() {
    return this.request<{
      success: boolean;
      categories: Array<{
        type: string;
        label: string;
        items: Array<{
          id: string;
          name: string;
          imageUri: string;
          color: string;
          brand?: string;
        }>;
        totalCount: number;
      }>;
    }>('/api/wardrobe/clueless-view');
  }

  async getWardrobeByType(itemType: 'owned' | 'inspiration' | 'wishlist') {
    return this.request<{
      success: boolean;
      items: Array<{
        id: string;
        name: string;
        imageUri: string;
        category: string;
        color: string;
        brand?: string;
        source?: string;
        sourceUrl?: string;
      }>;
    }>(`/api/wardrobe/by-type/${itemType}`);
  }

  async getDFYAccessStatus() {
    return this.request<{
      success: boolean;
      hasAccess: boolean;
      tier: 'lite' | 'core' | null;
      daysRemaining: number;
      canGenerateOutfits: boolean;
      upsellMessage?: string;
    }>('/api/dfy/access-status');
  }

  async getDFYCalendar() {
    return this.request<{
      success: boolean;
      hasCalendar?: boolean;
      ready?: boolean;
      tier?: 'lite' | 'core';
      duration?: number;
      startDate?: string;
      endDate?: string;
      generatedAt?: string;
      calendarHash?: string;
      engineVersion?: string;
      stylistId?: string;
      calendar?: Array<{
        day?: number;
        date?: string;
        occasion?: string;
        stylistNote?: string;
        outfit?: {
          items?: Array<{
            id: string | number;
            name?: string;
            category?: string;
            color?: string;
            imageUri?: string | null;
            imageUrl?: string | null;
            processedImageUrl?: string | null;
          }>;
        };
      }>;
      outfits?: Array<{
        id: string;
        day?: number;
        dayNumber?: number;
        title?: string;
        occasion?: string;
        stylistNote?: string;
        items: Array<{
          id: string | number;
          name?: string;
          category?: string;
          color?: string;
          imageUri?: string | null;
          imageUrl?: string | null;
          processedImageUrl?: string | null;
        }>;
      }>;
      emptyState?: { title?: string; message?: string };
    }>('/api/dfy/calendar');
  }

  async generateDFYCalendar(data: { stylistId?: string; startDate?: string }) {
    return this.request<{
      success: boolean;
      message?: string;
      calendar?: Array<{
        day?: number;
        date?: string;
        occasion?: string;
        stylistNote?: string;
        outfit?: {
          items?: Array<{
            id: string | number;
            name?: string;
            category?: string;
            color?: string;
            imageUri?: string | null;
            imageUrl?: string | null;
            processedImageUrl?: string | null;
          }>;
        };
      }>;
      outfits?: Array<{
        id: string;
        day?: number;
        dayNumber?: number;
        title?: string;
        occasion?: string;
        stylistNote?: string;
        items: Array<{
          id: string | number;
          name?: string;
          category?: string;
          color?: string;
          imageUri?: string | null;
          imageUrl?: string | null;
          processedImageUrl?: string | null;
        }>;
      }>;
      duration?: number;
      startDate?: string;
      endDate?: string;
      error?: string;
    }>('/api/dfy/calendar/generate', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 180000,
    });
  }

  /** Persist locally-generated Core calendar — server stores exact client plan */
  async saveClientCoreCalendar(data: {
    calendar: {
      days: Array<{
        date: string;
        occasion?: string;
        stylistNote?: string;
        outfit: {
          itemIds: string[];
          metadata?: { tier?: string; dayNumber?: number; score?: number };
        };
      }>;
    };
    startDate: string;
    endDate: string;
    duration: number;
    generatedAt: string;
    engineVersion: string;
    wardrobeSnapshotHash: string;
    calendarHash: string;
    stylistId?: string;
    force?: boolean;
  }) {
    return this.request<{
      success: boolean;
      skipped?: boolean;
      conflict?: boolean;
      error?: string;
      version?: string;
      calendarHash?: string;
      generatedAt?: string;
      savedAt?: string;
      serverGeneratedAt?: string;
      clientGeneratedAt?: string;
      message?: string;
    }>('/api/dfy/calendar/save-client-calendar', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 15000,
    });
  }

  async generateDFYDelivery(data: { tier: 'lite' | 'core'; stylistId: string; lat?: number; lon?: number; location?: string }) {
    return this.request<{
      success: boolean;
      delivery?: {
        userId: string;
        tier: 'lite' | 'core';
        startDate: string;
        expiryDate: string;
        totalDays: number;
        outfits: Array<{
          id: string;
          dayNumber: number;
          title: string;
          description: string;
          items: Array<{ id: string; name: string; imageUri: string | null; category: string; color: string }>;
          occasion: string;
          stylistNote: string;
          stylistId: string;
          userReaction: null;
          saved: boolean;
        }>;
        currentDay: number;
        completed: boolean;
        nudgesShown: number[];
      };
      outfits?: Array<{
        id: string;
        day?: number;
        dayNumber?: number;
        title?: string;
        occasion?: string;
        stylistNote?: string;
        stylistId?: string;
        items: Array<{
          id: string | number;
          name: string;
          category: string;
          color: string;
          imageUri?: string | null;
          imageUrl?: string | null;
          processedImageUrl?: string | null;
        }>;
      }>;
    }>('/api/dfy/generate-delivery', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        count: data.tier === 'core' ? 30 : 14,
      }),
      timeout: 120000,
    });
  }

  async getDFYLookbook() {
    return this.request<{
      success: boolean;
      hasLookbook?: boolean;
      startDate?: string | null;
      endDate?: string | null;
      travelPlan?: {
        startDate?: string;
        endDate?: string;
        destination?: string;
        tripDays?: number;
      } | null;
      generatedAt?: string | null;
      outfits?: Array<{
        id: string;
        day?: number;
        dayNumber?: number;
        title?: string;
        stylistNote?: string;
        weatherNote?: string;
        userReaction?: 'love' | 'not-me' | null;
        adjustmentRequest?: string;
        saved?: boolean;
        items: Array<{
          id: string | number;
          name: string;
          category: string;
          color: string;
          imageUri?: string | null;
          imageUrl?: string | null;
          processedImageUrl?: string | null;
        }>;
      }>;
    }>('/api/dfy/lite/lookbook');
  }

  async submitDFYOutfitReaction(data: {
    outfitId: string;
    reaction: 'love' | 'not-me' | null;
    source?: string;
    dayNumber?: number;
    stylistId?: string;
    outfitData?: {
      title?: string;
      occasion?: string;
      items?: Array<{ id?: string | number; name?: string; category?: string; color?: string }>;
    };
  }) {
    return this.request<{ success: boolean }>('/api/dfy/outfit-reaction', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitDFYAdjustmentRequest(data: {
    outfitId: string;
    notes: string;
    source?: string;
    dayNumber?: number;
    stylistId?: string;
    outfitData?: {
      title?: string;
      occasion?: string;
      items?: Array<{ id?: string | number; name?: string; category?: string; color?: string }>;
    };
  }) {
    return this.request<{ success: boolean }>('/api/dfy/adjustment-request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateDFYLookbook(data: {
    stylistId: string;
    lat?: number;
    lon?: number;
    location?: string;
  }) {
    return this.request<{
      success: boolean;
      outfits?: Array<{
        id: string;
        day?: number;
        dayNumber?: number;
        title?: string;
        occasion?: string;
        stylistNote?: string;
        notes?: string;
        stylistId?: string;
        items: Array<{
          id: string | number;
          name: string;
          category: string;
          color: string;
          imageUri?: string | null;
          imageUrl?: string | null;
          processedImageUrl?: string | null;
        }>;
      }>;
      stylistId?: string;
      generatedAt?: string;
      expiresAt?: string;
    }>('/api/dfy/lite/lookbook/generate', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 120000,
    });
  }

  async generateDFYOutfitVisual(data: {
    outfitDay?: number;
    outfitName?: string;
    items: Array<{ name: string; category: string; color: string }>;
    stylistNote?: string;
    occasion?: string;
    vibeLabel?: string;
    stylist?: string;
  }) {
    return this.request<{
      success: boolean;
      imageUrl: string | null;
      imageUri: string | null;
      outfitDay?: number;
      engine?: string | null;
      cached?: boolean;
    }>(
      '/api/dfy/lite/outfit-visual/generate',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getDFYOutfitVisual(outfitDay: number) {
    return this.request<{
      success: boolean;
      imageUrl: string | null;
      imageUri: string | null;
      engine?: string;
      cachedAt?: string;
    }>(`/api/dfy/lite/outfit-visual/${outfitDay}`);
  }

  async generateOutfit(data: {
    occasionType: 'todays_look' | 'work_outfit' | 'date_night' | 'casual_day' | 'weekend' | 'smart_casual' | 'gym' | 'evening_out' | 'travel' | 'custom';
    stylistId?: string;
    weather?: {
      temperature: number;
      condition: string;
    };
    saveToCalendar?: boolean;
    calendarDate?: string;
    localItems?: Array<{ id: string; name: string; category: string; color?: string; imageUri?: string }>;
    countryCode?: string;
    preferredStyles?: string[];
  }) {
    return this.request<{
      success: boolean;
      vibeLabel?: string;
      outfit: {
        id?: string;
        vibe?: string;
        items: Array<{
          id: string;
          name: string;
          imageUri?: string;
          imageUrl?: string;
          category: string;
          color: string;
        }>;
        hydratedItems?: Array<{ id: string; name: string; imageUri: string; category: string; color: string }>;
        stylingTips: string[];
        colourHarmony: string;
        colorHarmony: string;
        vibeLabel: string;
        stylistMessage: string;
        stylistId: string;
        savedToCalendar: boolean;
        calendarDate?: string;
      };
      hydratedItems?: Array<{ id: string; name: string; imageUri?: string; imageUrl?: string; category: string; color: string }>;
    }>('/api/wardrobe/generate-outfit/resilient', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 90000,
    });
  }

  async getOutfitOptions() {
    return this.request<{
      success: boolean;
      options: Array<{
        id: string;
        label: string;
        description: string;
        icon: string;
      }>;
      styleDNA: {
        gender: string;
        bodyType: string;
        colorSeason: string;
        stylePreferences: string[];
      };
    }>('/api/wardrobe/outfit-options');
  }

  // Lookbooks API
  async getLookbooks() {
    return this.request<{
      success: boolean;
      lookbooks: Array<{
        id: string;
        name: string;
        description?: string;
        coverImageUri?: string;
        outfitCount: number;
        createdAt: string;
        updatedAt: string;
        isDefault?: boolean;
      }>;
    }>('/api/lookbooks');
  }

  async getLookbook(lookbookId: string) {
    return this.request<{
      success: boolean;
      lookbook: {
        id: string;
        name: string;
        description?: string;
        coverImageUri?: string;
        outfits: Array<{
          id: string;
          name: string;
          imageUri?: string;
          items: Array<{
            id: string;
            name: string;
            imageUri: string;
            category: string;
          }>;
          occasion?: string;
          notes?: string;
          createdAt: string;
        }>;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/api/lookbooks/${lookbookId}`);
  }

  async createLookbook(data: { name: string; description?: string }) {
    return this.request<{
      success: boolean;
      lookbook: {
        id: string;
        name: string;
        description?: string;
        createdAt: string;
      };
    }>('/api/lookbooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLookbook(lookbookId: string, data: { name?: string; description?: string }) {
    return this.request<{
      success: boolean;
      lookbook: {
        id: string;
        name: string;
        description?: string;
        updatedAt: string;
      };
    }>(`/api/lookbooks/${lookbookId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLookbook(lookbookId: string) {
    return this.request<{ success: boolean }>(`/api/lookbooks/${lookbookId}`, {
      method: 'DELETE',
    });
  }

  async addOutfitToLookbook(lookbookId: string, outfitData: {
    name: string;
    itemIds: string[];
    occasion?: string;
    notes?: string;
  }) {
    return this.request<{
      success: boolean;
      outfit: {
        id: string;
        name: string;
        createdAt: string;
      };
    }>(`/api/lookbooks/${lookbookId}/outfits`, {
      method: 'POST',
      body: JSON.stringify(outfitData),
    });
  }

  // Tour System
  async getTourStatus() {
    return this.request<{
      success: boolean;
      tourCompleted: boolean;
      tourSkipped: boolean;
      currentStep?: number;
    }>('/api/tour/status');
  }

  async completeTour() {
    return this.request<{ success: boolean }>('/api/tour/complete', {
      method: 'POST',
    });
  }

  async skipTour() {
    return this.request<{ success: boolean }>('/api/tour/skip', {
      method: 'POST',
    });
  }

  // URL Extraction for Wardrobe
  async extractFromUrl(url: string) {
    return this.request<{
      success: boolean;
      item: {
        name: string;
        imageUri: string;
        brand?: string;
        price?: number;
        color?: string;
        category?: string;
        sourceUrl: string;
        retailer?: string;
      };
    }>('/api/wardrobe/extract-from-url/resilient', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  // Screenshot Extraction for Wardrobe
  async extractFromScreenshot(base64Image: string) {
    return this.request<{
      success: boolean;
      item: {
        name: string;
        imageUri: string;
        brand?: string;
        price?: number;
        color?: string;
        category?: string;
        retailer?: string;
      };
    }>('/api/wardrobe/extract-from-screenshot/resilient', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    });
  }

  // Tester Mode
  async getTesterStatus() {
    return this.request<{
      success: boolean;
      isTester: boolean;
      testerSince?: string;
      features?: string[];
    }>('/api/tester/status');
  }

  async grantTesterAccess(code: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>('/api/tester/grant', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // AI Outfit Image Generation (via backend) — same labeled pieces path as guest visuals
  async generateOutfitImage(
    outfitDescription: string,
    occasion: string,
    extras?: {
      pieces?: Array<{ role: string; garment?: string; descriptor: string }>;
      gender?: string | null;
      style?: string;
    },
  ) {
    return this.request<{
      success?: boolean;
      imageUrl: string | null;
    }>('/api/ai/generate-outfit-image', {
      method: 'POST',
      body: JSON.stringify({
        outfitDescription,
        occasion,
        ...(extras?.pieces?.length ? { pieces: extras.pieces } : {}),
        ...(extras?.gender ? { gender: extras.gender } : {}),
        ...(extras?.style ? { style: extras.style } : {}),
      }),
    });
  }

  // Check outfit compatibility with 20-rule system + multi-axis intelligence
  async checkOutfitCompatibility(data: {
    items: string[];
    stylistId: string;
    occasion: string;
    lat?: number;
    lon?: number;
    location?: string;
    countryCode?: string;
    preferredStyles?: string[];
  }) {
    return this.request<{
      success: boolean;
      score: number;
      verdict: string;
      analysis: string;
      hardRuleViolations: string[];
      improvements: string[];
      occasionRulesApplied: string | null;
      hardCapApplied?: string | null;
      dimensions?: Record<string, number>;
      dimensionWeights?: Record<string, number>;
      explanations?: string[];
      trendMatches?: Array<{ name: string; layer: string; weight: number }>;
      contextUsed?: Record<string, unknown>;
      headline?: string;
      error?: string;
    }>('/api/dfy/core/wardrobe/compatibility', {
      method: 'POST',
      timeout: 90000,
      body: JSON.stringify(data),
    });
  }

  /** Paid Outfit Mix — meticulous per-item notes (cached server-side by outfit signature). */
  async analyzeOutfitMix(data: {
    items: string[];
    score: number;
    hint?: string;
    clashId?: string;
    signals?: Record<string, unknown>;
    scoreBreakdown?: Record<string, unknown>;
    occasion?: string;
    dressFor?: string;
    outfitIntent?: string;
    userProfile?: {
      stylePreference?: string | null;
      lifestyle?: string | null;
      preferredStyles?: string[];
    } | null;
  }) {
    return this.request<{
      success: boolean;
      score: number;
      overallVerdict: string;
      itemNotes: Array<{ id: string; role: string; name: string; note: string; verdict?: string; suggestion?: string }>;
      stylistAnalysis?: {
        summary: string;
        overallTone: 'excellent' | 'good' | 'mixed' | 'off';
        items: Array<{ itemId: string; role: string; verdict: string; comment: string; suggestion?: string }>;
        adjustments?: string[];
      } | null;
      signals?: Record<string, unknown> | null;
      source: 'ai' | 'deterministic' | 'cache';
      model?: string | null;
      error?: string;
      message?: string;
    }>('/api/dfy/core/wardrobe/outfit-mix-analysis', {
      method: 'POST',
      timeout: 60000,
      body: JSON.stringify(data),
    });
  }

  async scoreOutfit(data: {
    items: string[];
    stylistId?: string;
    occasion?: string;
    lat?: number;
    lon?: number;
    location?: string;
  }) {
    return this.request<{
      success: boolean;
      totalScore: number;
      verdict: string;
      dimensions: Record<string, number>;
      dimensionWeights: Record<string, number>;
      explanations: string[];
      summary: string;
      headline?: string;
      trendMatches?: Array<{ name: string; layer: string; weight: number }>;
      contextUsed?: Record<string, unknown>;
    }>('/api/outfits/score', {
      method: 'POST',
      timeout: 90000,
      body: JSON.stringify(data),
    });
  }

  async recordOutfitEngagement(data: {
    items: Array<string | { id?: string; name: string; category?: string; color?: string }>;
    signal: 'liked' | 'skipped' | 'wore' | 'saved';
    outfitScore?: number;
    scoreBreakdown?: Record<string, unknown>;
    occasion?: string;
    contextSnapshot?: Record<string, unknown>;
  }) {
    return this.request<{ success: boolean; styleUpdate?: { vector: Record<string, number>; styleDnaLabel: string } }>(
      '/api/outfits/engage',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getStyleVector() {
    return this.request<{
      success: boolean;
      vector: Record<string, number>;
      styleDna: Array<{ style: string; percentage: number }>;
      headline: string;
      engagementCount?: number;
    }>('/api/users/me/style-vector');
  }

  async getTrendSignals(region?: string) {
    const q = region ? `?region=${encodeURIComponent(region)}` : '';
    return this.request<{ success: boolean; layers: Record<string, unknown[]>; signals: unknown[] }>(
      `/api/trends/signals${q}`
    );
  }

  // Outfit Calendar CRUD
  async getOutfitCalendarEntry(id: string) {
    return this.request<{
      success: boolean;
      outfit: {
        id: string;
        date: string;
        itemIds: string[];
        eventName?: string;
        eventType?: string;
        notes?: string;
        wasWorn: boolean;
      };
    }>(`/api/outfit-calendar/${id}`);
  }

  async updateOutfitCalendarEntry(id: string, updates: {
    itemIds?: string[];
    eventName?: string;
    eventType?: string;
    notes?: string;
  }) {
    return this.request<{ success: boolean; outfit: any }>(`/api/outfit-calendar/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteOutfitCalendarEntry(id: string) {
    return this.request<{ success: boolean }>(`/api/outfit-calendar/${id}`, {
      method: 'DELETE',
    });
  }

  async removeItemFromOutfitCalendarEntry(id: string, wardrobeItemId: string) {
    return this.request<{ success: boolean }>(`/api/outfit-calendar/${id}/items/${wardrobeItemId}`, {
      method: 'DELETE',
    });
  }

  async getCalendarOutfitsForRange(startDate: Date, endDate: Date) {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return this.request<{
      success: boolean;
      outfits: Array<{
        id: string;
        date: string;
        itemIds: string[];
        eventName: string;
        eventType: string;
        notes?: string;
        wasWorn: boolean;
      }>;
    }>(`/api/outfit-calendar/range?startDate=${fmt(startDate)}&endDate=${fmt(endDate)}`);
  }

  async getOutfitForDate(date: Date) {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return this.request<{
      success: boolean;
      outfits: Array<{
        id: string;
        date: string;
        itemIds: string[];
        eventName: string;
        eventType: string;
        notes?: string;
        wasWorn: boolean;
      }>;
    }>(`/api/outfit-calendar/by-date/${dateStr}`);
  }

  async getDFYCalendarAlternatives(date: string, stylistId: string = 'ruby') {
    return this.request<{
      success: boolean;
      alternatives: Array<{
        id: string;
        items: Array<{
          id: string;
          name?: string;
          category?: string;
          color?: string;
          imageUri?: string;
          imageUrl?: string;
          processedImageUrl?: string;
        }>;
        stylistNote?: string;
      }>;
      message?: string;
    }>(`/api/dfy/calendar/day/${date}/alternatives?stylistId=${stylistId}`);
  }

  // Mix & Match Outfit Builder — always goes through server Outfit Save Gateway
  async saveMixAndMatchOutfit(data: {
    name: string;
    occasion: string;
    wardrobeItemIds: Array<string | number>;
    notes?: string;
    loved?: boolean;
    calendarDate?: string; // ISO date string — pins to calendar in same call
  }) {
    const wardrobeItemIds = [...new Set(
      (data.wardrobeItemIds || [])
        .map((id) => String(id).trim())
        .filter((id) => /^\d+$/.test(id)),
    )];
    return this.request<{
      success: boolean;
      lookbookId: number;
      name: string;
      itemCount: number;
      wardrobeItemIds: string[];
      items: Array<{ id: number; name: string; category?: string; imageUrl?: string | null }>;
      calendarSaved?: boolean;
      styleWarnings?: Array<{ id: string; hint: string; severity: string }>;
    }>('/api/outfits/mix-and-match/save', {
      method: 'POST',
      body: JSON.stringify({ ...data, wardrobeItemIds }),
    });
  }

  async getMixAndMatchOutfits() {
    return this.request<{
      success: boolean;
      outfits: Array<{
        id: string;
        name: string;
        description?: string | null;
        occasion?: string;
        tags?: string[];
        wardrobeItemIds?: string[];
        wardrobe_item_ids?: string[];
        items: Array<{
          id: string;
          name: string;
          category: string;
          colour: string;
          imageUri?: string;
          imageUrl?: string | null;
        }>;
      }>;
    }>('/api/outfits/mix-and-match');
  }

  async deleteMixAndMatchOutfit(id: string) {
    return this.request<{ success: boolean }>(`/api/outfits/mix-and-match/${id}`, {
      method: 'DELETE',
    });
  }

  // Shopping - Product Search with Affiliate Links
  async searchProducts(query: string, limit: number = 5) {
    return this.request<{
      products: Array<{
        id: string;
        name: string;
        price: number;
        currency: string;
        imageUrl: string;
        affiliateUrl: string;
        retailer: string;
        matchScore: number;
        stylistNotes?: string;
      }>;
    }>('/api/shopping/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  // Shopping - Wishlist Management
  async getWishlist() {
    return this.request<{
      items: Array<{
        id: string;
        productName: string;
        retailerId: string;
        retailerName: string;
        price: number;
        currency: string;
        imageUrl?: string;
        affiliateUrl?: string;
        purchased: boolean;
        createdAt: string;
      }>;
    }>('/api/shopping/wishlist');
  }

  async addToWishlist(data: {
    productName: string;
    retailerId: string;
    price: number;
    currency?: string;
    imageUrl?: string;
    affiliateUrl?: string;
  }) {
    return this.request<{ 
      success: boolean; 
      item: {
        id: string;
        productName: string;
        retailerId: string;
        price: number;
      };
    }>('/api/shopping/wishlist/add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeFromWishlist(itemId: string) {
    return this.request<{ success: boolean }>(`/api/shopping/wishlist/${itemId}`, {
      method: 'DELETE',
    });
  }

  async markWishlistItemPurchased(itemId: string) {
    return this.request<{ success: boolean }>(`/api/shopping/wishlist/${itemId}/purchased`, {
      method: 'PUT',
    });
  }

  // Price Tracking
  async getPriceTrackedItems() {
    return this.request<{
      items: Array<{
        id: string;
        productName: string;
        productUrl: string;
        retailerName: string;
        currentPrice: number;
        originalPrice: number;
        targetPrice?: number;
        currency: string;
        imageUrl?: string;
        lastChecked: string;
        priceDropPercent: number;
        isOnSale: boolean;
      }>;
    }>('/api/price-tracking');
  }

  async setTargetPrice(itemId: string, targetPrice: number) {
    return this.request<{ success: boolean; targetPrice: number }>(`/api/price-tracking/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ targetPrice }),
    });
  }

  async updatePriceTrackingSettings(productId: string, settings: { targetPrice?: number; priceDropThreshold?: number }) {
    return this.request<{ success: boolean }>(`/api/price-tracking/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async stopPriceTracking(productId: string) {
    return this.request<{ success: boolean }>(`/api/price-tracking/${productId}`, {
      method: 'DELETE',
    });
  }

  async getExtensionStatus() {
    return this.request<{
      isConnected: boolean;
      lastSync: string | null;
      deviceName: string | null;
    }>('/api/extension/status');
  }

  async getPriceHistory(itemId: string) {
    return this.request<{
      history: Array<{
        price: number;
        recordedAt: string;
      }>;
    }>(`/api/price-tracking/${itemId}/history`);
  }

  async addPriceTracking(productUrl: string) {
    return this.request<{
      success: boolean;
      item: {
        id: string;
        productName: string;
        currentPrice: number;
        retailerName: string;
      };
    }>('/api/price-tracking/add', {
      method: 'POST',
      body: JSON.stringify({ productUrl }),
    });
  }

  // Price Alerts
  async getPriceAlerts() {
    return this.request<{
      alerts: Array<{
        id: string;
        itemId: string;
        itemName: string;
        brand: string;
        previousPrice: number;
        newPrice: number;
        dropPercent: number;
        currencySymbol: string;
        timestamp: string;
        isRead: boolean;
        type: 'price_drop' | 'target_reached' | 'back_in_stock' | 'limited_time';
      }>;
      unreadCount: number;
    }>('/api/price-alerts');
  }

  async markPriceAlertsRead(alertIds?: string[]) {
    return this.request<{ success: boolean; markedCount: number }>('/api/price-alerts/mark-read', {
      method: 'POST',
      body: JSON.stringify({ alertIds }),
    });
  }

  async getLanguages() {
    return this.request<{
      languages: Array<{
        code: string;
        name: string;
        nativeName: string;
        direction: 'ltr' | 'rtl';
      }>;
    }>('/api/languages');
  }

  async getCurrentLanguage() {
    return this.request<{
      languageCode: string;
      nativeName: string;
      direction: 'ltr' | 'rtl';
      translations: Record<string, any>;
    }>('/api/language/current');
  }

  async setLanguage(data: { languageCode?: string; accent?: string }) {
    return this.request<{
      success: boolean;
      languageCode: string;
      nativeName: string;
      direction: 'ltr' | 'rtl';
    }>('/api/language', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTranslations(code: string) {
    return this.request<{
      languageCode: string;
      nativeName: string;
      direction: 'ltr' | 'rtl';
      translations: Record<string, any>;
    }>(`/api/translations/${code}`);
  }

  async updateProfileStyle(data: { preferredAccent?: string }) {
    return this.request<{ success: boolean }>('/api/profile/style', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Guest browsing endpoints (no authentication required)
  async createGuestSession() {
    return this.request<{ sessionToken: string; expiresAt: string }>('/api/guest/session', {
      method: 'POST',
    });
  }

  async getGuestStylists(sessionToken: string) {
    return this.request<{
      stylists: Array<{
        id: string;
        name: string;
        personality: string;
        greeting: string;
        avatar: string;
      }>;
    }>('/api/guest/stylists', {
      headers: { 'x-guest-token': sessionToken },
    });
  }

  async guestChat(
    sessionToken: string,
    message: string,
    stylistId: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    options?: { language?: string; gender?: string | null },
  ) {
    return this.request<{
      response: string;
      messagesRemaining: number;
      remainingMessages?: number;
      limitReached: boolean;
      signupPrompt?: string;
      hasOutfitRecommendation?: boolean;
      outfitVisualSuggestion?: {
        source: 'generated';
        outfitDescription: string;
        occasion: string;
        pieces?: Array<{ role: string; garment: string; descriptor: string }>;
      } | null;
    }>('/api/guest/chat', {
      method: 'POST',
      headers: { 'x-guest-token': sessionToken },
      body: JSON.stringify({
        message,
        stylist: stylistId,
        history: conversationHistory,
        ...(options?.language ? { language: options.language } : {}),
        ...(options?.gender ? { gender: options.gender } : {}),
      }),
    });
  }

  async guestOutfitSuggestion(sessionToken: string, occasion: string) {
    return this.request<{
      suggestion: string;
      suggestionsRemaining: number;
      limitReached: boolean;
      signupPrompt?: string;
    }>('/api/guest/outfit-suggestion', {
      method: 'POST',
      headers: { 'x-guest-token': sessionToken },
      body: JSON.stringify({ occasion }),
    });
  }

  async guestGenerateOutfitImage(
    sessionToken: string,
    outfitDescription: string,
    style: string,
    stylistId: string,
    gender?: string | null,
    extras?: {
      pieces?: Array<{ role: string; garment?: string; descriptor: string }>;
      occasion?: string | null;
    },
  ) {
    return this.request<{
      success: boolean;
      imageUrl: string | null;
      isPlaceholder: boolean;
      limitReached?: boolean;
      retryable?: boolean;
      message?: string;
      visualsRemaining?: number;
    }>('/api/guest/generate-outfit-image', {
      method: 'POST',
      headers: { 'x-guest-token': sessionToken },
      body: JSON.stringify({
        outfitDescription,
        style,
        stylist: stylistId,
        ...(gender ? { gender } : {}),
        ...(extras?.pieces?.length ? { pieces: extras.pieces } : {}),
        ...(extras?.occasion ? { occasion: extras.occasion } : {}),
      }),
    });
  }

  async getGuestStatus(sessionToken: string) {
    return this.request<{
      messagesRemaining: number;
      suggestionsRemaining: number;
      sessionExpiresAt: string;
    }>('/api/guest/status', {
      headers: { 'x-guest-token': sessionToken },
    });
  }

  /** After signup/login: attach guest stylist chat histories to the authenticated user. */
  async claimGuestConversations(
    guestToken: string | null | undefined,
    conversations: Array<{
      stylist: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }>,
  ) {
    return this.request<{
      success: boolean;
      messagesClaimed: number;
      stylistsClaimed?: string[];
      message?: string;
    }>('/api/guest/claim-conversations', {
      method: 'POST',
      body: JSON.stringify({
        ...(guestToken ? { guestToken } : {}),
        conversations,
      }),
    });
  }

  async getChatHistory(stylist: string, limit = 50) {
    const qs = new URLSearchParams({
      stylist,
      limit: String(limit),
    });
    return this.request<Array<{
      id: number;
      userId: number;
      stylist: string;
      role: 'user' | 'assistant';
      content: string;
      createdAt?: string;
    }>>(`/api/chat/history?${qs.toString()}`);
  }

  async getAdminDashboard() {
    return this.adminRequest<{
      users: {
        total: number;
        today: number;
        thisWeek: number;
      };
      subscriptions: {
        active: number;
        conversionRate: number;
      };
      engagement: {
        totalChats: number;
        chatsToday: number;
      };
      aiCost?: {
        month: string;
        totalCents: number;
        rembgMonthCount: number;
        rembgLifetimeCount: number;
        activeMeteredUsers: number;
        nearBudgetUsers: number;
        heavyUsers: Array<{
          id: number;
          email: string;
          displayName?: string | null;
          subscriptionTier: string;
          usedCents: number;
          budgetCents: number;
          remainingCents: number;
          rembgMonthCount: number;
          rembgLifetimeCount: number;
          pctOfBudget: number;
        }>;
      } | null;
      recentUsers: Array<{
        id: string;
        email: string;
        name: string;
        createdAt: string;
        subscriptionTier?: string;
        verified?: boolean;
      }>;
    }>('/api/admin/dashboard');
  }

  async getAiUsage() {
    return this.request<{
      success: boolean;
      usage: {
        month: string;
        usedCents: number;
        budgetCents: number;
        rembgLifetimeCount: number;
        rembgMonthCount: number;
        remainingCents: number;
      } | null;
      freeRembgLifetimeLimit: number;
      message?: string;
    }>('/api/usage/ai');
  }

  async getAdminPayments() {
    return this.adminRequest<{
      summary: {
        totalRevenue: number;
        monthlyRecurringRevenue: number;
      };
      payments: Array<{
        id: string;
        userId: string;
        userEmail: string;
        amount: number;
        currency: string;
        status: string;
        productId: string;
        createdAt: string;
      }>;
    }>('/api/admin/payments');
  }

  async getAdminSubscriptions() {
    return this.adminRequest<{
      mrr: number;
      stats: {
        active: number;
        canceled: number;
        planDistribution: {
          free: number;
          personal_stylist: number;
          stylist_unlimited: number;
        };
      };
    }>('/api/admin/subscriptions');
  }

  async getDecisionHistory(limit = 50) {
    return this.request<{
      success: boolean;
      history: Array<{ request: Record<string, unknown>; response: Record<string, unknown> }>;
    }>(`/api/decisions/history?limit=${limit}`);
  }

  async saveDecisionHistory(entry: {
    requestId: string;
    decisionType: string;
    recommendation: string;
    reasoning?: string;
    stylistId?: string;
    contextNotes?: string;
    contextChips?: string[];
    images?: string[];
    responsePayload?: Record<string, unknown>;
  }) {
    return this.request<{ success: boolean }>('/api/decisions/history', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async getAnalyticsSummary() {
    return this.adminRequest<{
      success: boolean;
      offers: { shown: number; accepted: number; acceptanceRate: number; revenue: number };
      emailConversions: { total: number; amount: number };
      events: { total: number };
      revenue: { fromOffers: number; fromEmail: number; fromPayments?: number; total: number };
      payments?: { total: number; payingUsers: number };
      liveToday?: { revenueToday: number; savesToday: number; churnToday: number };
    }>('/api/analytics/summary');
  }

  async getAnalyticsRevenue() {
    return this.adminRequest<{
      success: boolean;
      totalRevenue: number;
      ltv: number;
      revenuePerUser: number;
      revenueToday: number;
      revenue7d: number;
      revenue30d: number;
      winbackRevenue: number;
      subscriptionRevenue: number;
      payingUsers: number;
      totalUsers: number;
      trend: Array<{ day: string; revenue: number }>;
    }>('/api/analytics/revenue');
  }

  async getAnalyticsEmailPerformance() {
    return this.adminRequest<{
      success: boolean;
      topEmail: { emailType: string; sent: number; clicks: number; revenue: number } | null;
      ctaPerformance: Array<{ cta: string; clicks: number; revenue: number }>;
      revenueByEmail: Array<{ email: string; clicks: number; revenue: number; sent: number }>;
      sendsByType: Record<string, number>;
    }>('/api/analytics/email-performance');
  }

  async getAnalyticsRetention() {
    return this.adminRequest<{
      success: boolean;
      recoveryRate: number;
      revenueSaved: number;
      retentionByOffer: Array<{
        offerType: string;
        shown: number;
        accepted: number;
        acceptanceRate: number;
        revenueSaved: number;
      }>;
      cancelFlow: { totalEvents: number; cancellations: number; recovered: number };
    }>('/api/analytics/retention');
  }

  async getAnalyticsExperiments() {
    return this.adminRequest<{
      success: boolean;
      variants: Array<{
        variant: string;
        shown: number;
        accepted: number;
        acceptanceRate: number;
        revenue: number;
      }>;
    }>('/api/analytics/experiments');
  }

  async getAnalyticsRevenueByCta() {
    return this.adminRequest<{
      success: boolean;
      rows: Array<{ cta: string; conversions: number; revenue: number }>;
    }>('/api/analytics/revenue-by-cta');
  }

  async getAnalyticsCampaigns() {
    return this.adminRequest<{
      success: boolean;
      campaigns: Array<{ campaign: string; variant: string; conversions: number; revenue: number }>;
    }>('/api/analytics/campaigns');
  }

  async getAnalyticsOffers() {
    return this.adminRequest<{
      success: boolean;
      offers: Array<{
        offerType: string;
        segment: string;
        usageSegment: string;
        shown: number;
        accepted: number;
        acceptanceRate: number;
        revenue: number;
      }>;
    }>('/api/analytics/offers');
  }

  async getAnalyticsFunnel() {
    return this.adminRequest<{
      success: boolean;
      stages: Array<{
        stage: string;
        count: number;
        conversionFromPrevious: number;
        conversionFromVisit: number;
      }>;
      visitTotal: number;
    }>('/api/analytics/funnel');
  }

  async getAnalyticsInsights() {
    return this.adminRequest<{
      success: boolean;
      insights: Array<{
        id: string;
        severity: string;
        title: string;
        message: string;
        action: string;
      }>;
      generatedAt: string;
      source: string;
    }>('/api/analytics/insights');
  }

  async getAnalyticsInsightsAdvanced() {
    return this.adminRequest<{
      success: boolean;
      insights: Array<{
        id?: string;
        severity?: string;
        title: string;
        message: string;
        action: string;
        priority?: string;
      }>;
      advanced?: Array<{
        title: string;
        message: string;
        action: string;
        priority?: string;
      }>;
      generatedAt?: string;
      source?: string;
      note?: string;
    }>('/api/analytics/insights/advanced');
  }

  async getAnalyticsCohorts() {
    return this.adminRequest<{
      success: boolean;
      cohorts: Array<{
        cohortWeek: string;
        cohortSize: number;
        retained30d: number;
        retentionRate: number;
      }>;
    }>('/api/analytics/cohorts');
  }

  async getAnalyticsChurnRisk() {
    return this.adminRequest<{
      success: boolean;
      bins: Array<{
        bin: string;
        users: number;
        avgScore: number;
      }>;
    }>('/api/analytics/churn-risk');
  }

  async getAdminModels() {
    return this.adminRequest<{
      current: {
        main_stylist: string;
        quick_decisions: string;
        second_opinions: string;
      };
      available: string[];
      newModelsDetected: number;
      lastChecked: string;
    }>('/api/admin/models');
  }

  async checkAdminModels() {
    return this.adminRequest<{
      message: string;
      newModelsFound: number;
      models?: string[];
    }>('/api/admin/models/check', {
      method: 'POST',
    });
  }

  // Color configuration from backend
  private colorConfigCache: ColorConfig | null = null;
  private colorConfigPromise: Promise<ColorConfig> | null = null;

  async getColorConfig(): Promise<ColorConfig> {
    // Return cached config if available
    if (this.colorConfigCache) {
      return this.colorConfigCache;
    }
    
    // If already fetching, wait for that promise
    if (this.colorConfigPromise) {
      return this.colorConfigPromise;
    }
    
    // Fetch from backend
    this.colorConfigPromise = this.request<ColorConfig>('/api/config/colors')
      .then(config => {
        this.colorConfigCache = config;
        return config;
      })
      .catch(error => {
        console.log('[ColorConfig] Failed to fetch from backend, using defaults:', error);
        // Return default config on error
        const defaultConfig = this.getDefaultColorConfig();
        this.colorConfigCache = defaultConfig;
        return defaultConfig;
      })
      .finally(() => {
        this.colorConfigPromise = null;
      });
    
    return this.colorConfigPromise;
  }

  private getDefaultColorConfig(): ColorConfig {
    return {
      baseColors: [
        'black', 'white', 'gray', 'red', 'blue', 'green', 'yellow', 'orange',
        'purple', 'pink', 'brown', 'beige', 'navy', 'cream', 'burgundy', 'olive',
        'teal', 'coral', 'gold', 'silver', 'tan', 'khaki', 'maroon', 'mint',
        'lavender', 'turquoise', 'charcoal', 'ivory', 'denim'
      ],
      modifiers: [
        'light', 'dark', 'pale', 'deep', 'bright', 'muted', 'soft', 'vivid',
        'washed', 'faded', 'heather', 'dusty', 'pastel', 'rich', 'warm', 'cool'
      ],
      descriptiveColors: {
        'heather': 'gray',
        'charcoal': 'charcoal',
        'denim': 'denim',
        'wine': 'burgundy',
        'crimson': 'red',
        'scarlet': 'red',
        'cherry': 'red',
        'ruby': 'red',
        'rose': 'pink',
        'blush': 'pink',
        'salmon': 'pink',
        'coral': 'coral',
        'peach': 'orange',
        'rust': 'orange',
        'amber': 'orange',
        'gold': 'gold',
        'mustard': 'yellow',
        'lemon': 'yellow',
        'lime': 'green',
        'sage': 'green',
        'forest': 'green',
        'emerald': 'green',
        'mint': 'mint',
        'teal': 'teal',
        'aqua': 'teal',
        'cyan': 'teal',
        'sky': 'blue',
        'royal': 'blue',
        'cobalt': 'blue',
        'indigo': 'navy',
        'sapphire': 'blue',
        'lavender': 'lavender',
        'violet': 'purple',
        'plum': 'purple',
        'mauve': 'purple',
        'magenta': 'pink',
        'fuchsia': 'pink',
        'tan': 'tan',
        'camel': 'beige',
        'taupe': 'beige',
        'khaki': 'khaki',
        'sand': 'beige',
        'chocolate': 'brown',
        'mocha': 'brown',
        'espresso': 'brown',
        'cream': 'cream',
        'ivory': 'ivory',
        'ecru': 'cream',
        'silver': 'silver',
        'pewter': 'gray',
        'slate': 'gray',
        'ash': 'gray',
        'graphite': 'charcoal',
        'onyx': 'black',
        'jet': 'black',
        'snow': 'white',
        'pearl': 'white',
      }
    };
  }

  async submitFeedback(payload: Record<string, unknown>): Promise<{ success: boolean; message: string; feedbackId?: number }> {
    return this.request<{ success: boolean; message: string; feedbackId?: number }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAdminFeedback(limit = 40) {
    return this.adminRequest<{
      success: boolean;
      feedback: Array<{
        id: number;
        feedbackType: string;
        category?: string | null;
        rating?: number | null;
        title?: string | null;
        description: string;
        deviceInfo?: string | null;
        appVersion?: string | null;
        status?: string | null;
        adminNotes?: string | null;
        createdAt: string;
        userEmail?: string | null;
        userName?: string | null;
      }>;
      counts: {
        total: number;
        bugs: number;
        features: number;
        general: number;
        ratings: number;
        support?: number;
        new: number;
      };
    }>(`/api/admin/feedback?limit=${limit}`);
  }

  async updateAdminFeedback(
    id: number,
    updates: { status?: string; adminNotes?: string },
  ) {
    return this.adminRequest<{ success: boolean; feedback: any }>(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }
}

// Color config type
export interface ColorConfig {
  baseColors: string[];
  modifiers: string[];
  descriptiveColors: Record<string, string>;
}

export const apiService = new ApiService();
export default apiService;
