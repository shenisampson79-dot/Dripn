/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { shareReferralCode } from '@/services/SharingService';
import { apiService } from '@/services/ApiService';

interface ReferralContextType {
  referralCode: string;
  totalReferrals: number;
  bonusAIRequests: number;
  referredByCode: string | null;
  referralDiscountPending: boolean;
  referralDiscountApplied: boolean;
  isLoading: boolean;
  shareReferral: () => Promise<boolean>;
  applyReferralCode: (code: string) => Promise<{ success: boolean; message: string }>;
  refreshReferral: () => Promise<void>;
  consumeBonusAiRequest: () => Promise<boolean>;
  getReferralBonusInfo: () => string;
}

const ReferralContext = createContext<ReferralContextType | null>(null);

const REFERRAL_STORAGE_KEY = '@dripn_referral';
export const PENDING_REFERRAL_KEY = '@dripn_pending_referral';

const BONUS_AI = 20;
const DISCOUNT_PERCENT = 10;

export function ReferralProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState('');
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [bonusAIRequests, setBonusAIRequests] = useState(0);
  const [referredByCode, setReferredByCode] = useState<string | null>(null);
  const [referralDiscountPending, setReferralDiscountPending] = useState(false);
  const [referralDiscountApplied, setReferralDiscountApplied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const applyLocalSnapshot = useCallback((data: {
    referralCode?: string | null;
    totalReferrals?: number;
    bonusAIRequests?: number;
    referredByCode?: string | null;
    referralDiscountPending?: boolean;
    referralDiscountApplied?: boolean;
  }) => {
    if (data.referralCode) setReferralCode(data.referralCode);
    if (typeof data.totalReferrals === 'number') setTotalReferrals(data.totalReferrals);
    if (typeof data.bonusAIRequests === 'number') setBonusAIRequests(data.bonusAIRequests);
    if (data.referredByCode !== undefined) setReferredByCode(data.referredByCode);
    if (typeof data.referralDiscountPending === 'boolean') {
      setReferralDiscountPending(data.referralDiscountPending);
    }
    if (typeof data.referralDiscountApplied === 'boolean') {
      setReferralDiscountApplied(data.referralDiscountApplied);
    }
  }, []);

  const persistLocal = useCallback(async (data: Record<string, unknown>) => {
    if (!user?.id) return;
    try {
      await AsyncStorage.setItem(
        REFERRAL_STORAGE_KEY,
        JSON.stringify({ userId: user.id, ...data }),
      );
    } catch (e) {
      console.warn('Failed to cache referral data', e);
    }
  }, [user?.id]);

  const refreshReferral = useCallback(async () => {
    if (!user?.id) {
      setReferralCode('');
      setTotalReferrals(0);
      setBonusAIRequests(0);
      setReferredByCode(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      if (apiService.isConfigured()) {
        const stats = await apiService.getMyReferralStats();
        const snapshot = {
          referralCode: stats.referralCode || '',
          totalReferrals: stats.totalReferrals || 0,
          bonusAIRequests: stats.bonusAIRequests || 0,
          referredByCode: stats.referredByCode || null,
          referralDiscountPending: Boolean(stats.referralDiscountPending),
          referralDiscountApplied: Boolean(stats.referralDiscountApplied),
        };
        applyLocalSnapshot(snapshot);
        await persistLocal(snapshot);

        // Auto-apply pending invite code once signed in
        const pending = await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
        if (pending && !snapshot.referredByCode) {
          try {
            const applied = await apiService.applyReferralCode(pending);
            if (applied.success) {
              await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
              const again = await apiService.getMyReferralStats();
              const next = {
                referralCode: again.referralCode || snapshot.referralCode,
                totalReferrals: again.totalReferrals || 0,
                bonusAIRequests: again.bonusAIRequests || 0,
                referredByCode: again.referredByCode || null,
                referralDiscountPending: Boolean(again.referralDiscountPending),
                referralDiscountApplied: Boolean(again.referralDiscountApplied),
              };
              applyLocalSnapshot(next);
              await persistLocal(next);
            }
          } catch {
            // keep pending for retry
          }
        }
      } else {
        const stored = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.userId === user.id) applyLocalSnapshot(data);
        }
      }
    } catch (error) {
      // Production may not have /api/referral/* deployed yet — fall back quietly.
      // Use warn (not error) so React Native LogBox doesn't flash a red screen on reload.
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Referral stats unavailable, using cache:', message);
      try {
        const stored = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.userId === user.id) {
            applyLocalSnapshot(data);
            return;
          }
        }
        // Local placeholder so Invite Friends still shows a code until server is deployed
        const localCode = `DRIPN${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
        applyLocalSnapshot({ referralCode: localCode, totalReferrals: 0, bonusAIRequests: 0 });
        await persistLocal({
          referralCode: localCode,
          totalReferrals: 0,
          bonusAIRequests: 0,
          referredByCode: null,
          referralDiscountPending: false,
          referralDiscountApplied: false,
        });
      } catch {
        /* ignore */
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, applyLocalSnapshot, persistLocal]);

  useEffect(() => {
    void refreshReferral();
  }, [refreshReferral]);

  const shareReferral = async (): Promise<boolean> => {
    if (!referralCode) return false;
    return shareReferralCode(referralCode, getReferralBonusInfo());
  };

  const applyReferralCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      return { success: false, message: 'Enter a referral code.' };
    }

    if (!user?.id) {
      await AsyncStorage.setItem(PENDING_REFERRAL_KEY, normalized);
      return {
        success: true,
        message: 'Code saved. It will apply when you create your account.',
      };
    }

    try {
      const result = await apiService.applyReferralCode(normalized);
      if (result.success) {
        await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
        await refreshReferral();
        return {
          success: true,
          message: result.message || `Rewards unlocked: +${BONUS_AI} AI messages and ${DISCOUNT_PERCENT}% off Stripe billing.`,
        };
      }
      return {
        success: false,
        message: result.message || 'Could not apply that code.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not apply that code.';
      return { success: false, message };
    }
  };

  const consumeBonusAiRequest = async (): Promise<boolean> => {
    if (bonusAIRequests <= 0) return false;
    // Optimistic local decrement
    setBonusAIRequests((n) => Math.max(0, n - 1));
    try {
      if (apiService.isConfigured()) {
        const result = await apiService.consumeReferralAiBonus();
        if (typeof result.bonusAIRequests === 'number') {
          setBonusAIRequests(result.bonusAIRequests);
        }
        return Boolean(result.consumed);
      }
      await persistLocal({
        referralCode,
        totalReferrals,
        bonusAIRequests: Math.max(0, bonusAIRequests - 1),
        referredByCode,
        referralDiscountPending,
        referralDiscountApplied,
      });
      return true;
    } catch {
      // keep optimistic decrement
      return true;
    }
  };

  const getReferralBonusInfo = (): string => {
    return `You both get +${BONUS_AI} AI stylist messages and ${DISCOUNT_PERCENT}% off your next Stripe subscription charge when they join with your code.`;
  };

  const value: ReferralContextType = {
    referralCode,
    totalReferrals,
    bonusAIRequests,
    referredByCode,
    referralDiscountPending,
    referralDiscountApplied,
    isLoading,
    shareReferral,
    applyReferralCode,
    refreshReferral,
    consumeBonusAiRequest,
    getReferralBonusInfo,
  };

  return (
    <ReferralContext.Provider value={value}>
      {children}
    </ReferralContext.Provider>
  );
}

export function useReferral() {
  const context = useContext(ReferralContext);
  if (!context) {
    throw new Error('useReferral must be used within a ReferralProvider');
  }
  return context;
}

/** Persist invite code from deep link / landing page for later signup apply */
export async function stashPendingReferralCode(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length >= 4) {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, normalized);
  }
}
