/**
 * Optional first-party analytics consent (onboarding A/B only).
 * Core app must never be blocked by this preference.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ANALYTICS_CONSENT_KEY = '@dripn_analytics_consent';

export type AnalyticsConsent = 'accepted' | 'rejected' | null;

export async function getAnalyticsConsent(): Promise<AnalyticsConsent> {
  try {
    const v = await AsyncStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (v === 'accepted' || v === 'rejected') return v;
    return null;
  } catch {
    return null;
  }
}

export async function setAnalyticsConsent(value: 'accepted' | 'rejected'): Promise<void> {
  await AsyncStorage.setItem(ANALYTICS_CONSENT_KEY, value);
}

export async function hasAnalyticsConsent(): Promise<boolean> {
  return (await getAnalyticsConsent()) === 'accepted';
}
