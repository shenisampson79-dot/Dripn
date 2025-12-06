import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

const TOKEN_KEY = '@stylewise_token';

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
}

export const apiService = new ApiService();
export default apiService;
