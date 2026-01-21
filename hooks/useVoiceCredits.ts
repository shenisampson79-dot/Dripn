import { useState, useEffect, useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { apiService } from '@/services/ApiService';

interface VoiceCredits {
  remaining: number;
  monthlyAllowance: number;
  usedThisMonth: number;
  monthlyRemaining: number;
  purchasedCredits: number;
  isUnlimited: boolean;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency?: string;
  popular?: boolean;
}

export function useVoiceCredits() {
  const [credits, setCredits] = useState<VoiceCredits | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [tierName, setTierName] = useState<string>('Free');
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getVoiceCreditsBalance();
      if (response.success) {
        setCredits(response.credits);
        setTier(response.tier);
        setTierName(response.tierName);
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

  const fetchPackages = useCallback(async () => {
    try {
      setPackagesLoading(true);
      const response = await apiService.getVoiceCreditPackages();
      if (response.packages) {
        setPackages(response.packages);
      }
    } catch (error) {
      console.log('[useVoiceCredits] Packages fetch error:', error);
      setPackages([
        { id: 'credits_10', name: '10 Voice Credits', credits: 10, price: 1.49 },
        { id: 'credits_50', name: '50 Voice Credits', credits: 50, price: 5.99, popular: true },
        { id: 'credits_100', name: '100 Voice Credits', credits: 100, price: 9.99 },
      ]);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const updateBalance = useCallback((voiceCredits: Partial<VoiceCredits>) => {
    setCredits(prev => prev ? { ...prev, ...voiceCredits } : null);
  }, []);

  const refreshBalance = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  const purchaseCredits = useCallback(async (packageId: string) => {
    try {
      setIsPurchasing(true);
      const response = await apiService.purchaseVoiceCredits(packageId);
      if (response.checkoutUrl) {
        if (Platform.OS === 'web') {
          window.location.href = response.checkoutUrl;
        } else {
          await WebBrowser.openBrowserAsync(response.checkoutUrl);
          refreshBalance();
        }
      }
    } catch (error) {
      console.error('[useVoiceCredits] Purchase error:', error);
      throw error;
    } finally {
      setIsPurchasing(false);
    }
  }, [refreshBalance]);

  return {
    credits,
    tier,
    tierName,
    isLoading,
    hasCredits: credits?.isUnlimited || (credits?.remaining ?? 0) > 0,
    isUnlimited: credits?.isUnlimited ?? false,
    isLowCredits: !credits?.isUnlimited && (credits?.remaining ?? 0) < 5 && (credits?.remaining ?? 0) > 0,
    isFreeUser: tier === 'free',
    packages,
    packagesLoading,
    fetchPackages,
    purchaseCredits,
    isPurchasing,
    updateBalance,
    refreshBalance,
  };
}
