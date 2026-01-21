import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { apiService } from '@/services/ApiService';

interface VoiceCreditsInternal {
  remaining: number;
  monthlyAllowance: number;
  usedThisMonth: number;
  monthlyRemaining: number;
  purchasedCredits: number;
  isUnlimited: boolean;
}

export type StylistId = 'ruby' | 'max' | 'ace' | 'ivy';

interface StylistNudge {
  stylistId: StylistId;
  stylistName: string;
  message: string;
  style: 'warm' | 'direct' | 'brief' | 'logical';
}

const STYLIST_NUDGES: Record<StylistId, StylistNudge> = {
  ruby: {
    stylistId: 'ruby',
    stylistName: 'Ruby',
    message: "I want to keep helping you... I think Personal Stylist would be perfect for you!",
    style: 'warm',
  },
  max: {
    stylistId: 'max',
    stylistName: 'Max',
    message: "You've maxed out voice. Personal Stylist gives you unlimited.",
    style: 'direct',
  },
  ace: {
    stylistId: 'ace',
    stylistName: 'Ace',
    message: "Hit the limit. Personal Stylist fixes that. Your call.",
    style: 'brief',
  },
  ivy: {
    stylistId: 'ivy',
    stylistName: 'Ivy',
    message: "You've reached the limit... it sounds like Personal Stylist would suit how you work.",
    style: 'logical',
  },
};

export function useVoiceCredits() {
  const [credits, setCredits] = useState<VoiceCreditsInternal | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [tierName, setTierName] = useState<string>('Style Chat');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getVoiceCreditsBalance();
      if (response.success) {
        setCredits(response.credits);
        setTier(response.tier);
        setTierName(response.tier === 'premium' ? 'Personal Stylist' : 'Style Chat');
      }
    } catch (error) {
      console.log('[useVoiceCredits] Balance fetch error:', error);
      setCredits({
        remaining: 0,
        monthlyAllowance: 0,
        usedThisMonth: 0,
        monthlyRemaining: 0,
        purchasedCredits: 0,
        isUnlimited: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const updateBalance = useCallback((voiceCredits: Partial<VoiceCreditsInternal>) => {
    setCredits(prev => prev ? { ...prev, ...voiceCredits } : null);
  }, []);

  const refreshBalance = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  const upgradeToPersonalStylist = useCallback(async () => {
    try {
      setIsPurchasing(true);
      const response = await apiService.createCheckoutSession('monthly');
      if (response.checkoutUrl) {
        if (Platform.OS === 'web') {
          window.location.href = response.checkoutUrl;
        } else {
          await WebBrowser.openBrowserAsync(response.checkoutUrl);
          refreshBalance();
        }
      }
    } catch (error) {
      console.error('[useVoiceCredits] Upgrade error:', error);
      throw error;
    } finally {
      setIsPurchasing(false);
    }
  }, [refreshBalance]);

  const getNudgeForStylist = useCallback((stylistId: StylistId): StylistNudge => {
    return STYLIST_NUDGES[stylistId] || STYLIST_NUDGES.ruby;
  }, []);

  return {
    tier,
    tierName,
    isLoading,
    hasCredits: credits?.isUnlimited || (credits?.remaining ?? 0) > 0,
    isUnlimited: credits?.isUnlimited ?? false,
    isPersonalStylist: tier === 'premium',
    isFreeUser: tier === 'free',
    isPurchasing,
    updateBalance,
    refreshBalance,
    upgradeToPersonalStylist,
    getNudgeForStylist,
  };
}

export { STYLIST_NUDGES };
