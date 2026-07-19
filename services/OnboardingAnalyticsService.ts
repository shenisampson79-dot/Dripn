import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL } from '@/config/api';
import { hasAnalyticsConsent } from '@/utils/analyticsConsent';
const SESSION_ID_KEY = '@dripn_onboarding_session_id';

type VariationType = 'positioning' | 'trust' | 'control';
type EventType = 'view' | 'click' | 'complete' | 'skip' | 'signup';
type InitialContext = 'what-to-wear-today' | 'event-outfit' | 'build-confidence' | 'shop-smarter';

interface AnalyticsPayload {
  variationId: string;
  variationType: VariationType;
  eventType: EventType;
  sessionId?: string;
  initialContext?: InitialContext;
  deviceInfo?: { platform: string };
}

interface ContextPayload {
  initialContext: InitialContext;
  onboardingVariationId?: string;
}

class OnboardingAnalyticsService {
  private sessionId: string | null = null;

  private async getSessionId(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    
    let sessionId = await AsyncStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    this.sessionId = sessionId;
    return sessionId;
  }

  async clearSession(): Promise<void> {
    this.sessionId = null;
    await AsyncStorage.removeItem(SESSION_ID_KEY);
  }

  async trackVariation(
    variationId: string,
    variationType: VariationType,
    eventType: EventType,
    initialContext?: InitialContext
  ): Promise<void> {
    try {
      // Optional first-party analytics — do not send without consent
      if (!(await hasAnalyticsConsent())) return;

      const sessionId = await this.getSessionId();
      
      const payload: AnalyticsPayload = {
        variationId,
        variationType,
        eventType,
        sessionId,
        deviceInfo: { platform: Platform.OS },
      };
      
      if (initialContext) {
        payload.initialContext = initialContext;
      }

      await fetch(`${API_URL}/api/onboarding/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
    }
  }

  async storeInitialContext(
    initialContext: InitialContext,
    onboardingVariationId?: string,
    token?: string
  ): Promise<void> {
    try {
      const payload: ContextPayload = {
        initialContext,
      };
      
      if (onboardingVariationId) {
        payload.onboardingVariationId = onboardingVariationId;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch(`${API_URL}/api/onboarding/context`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error) {
    }
  }

  async getServerVariation(variationType: VariationType): Promise<{ variationId: string; content: any } | null> {
    try {
      const response = await fetch(
        `${API_URL}/api/onboarding/variation?variationType=${variationType}`
      );
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

export const onboardingAnalyticsService = new OnboardingAnalyticsService();
export type { VariationType, EventType, InitialContext };
