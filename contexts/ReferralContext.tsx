import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { shareReferralCode } from '@/services/SharingService';

interface ReferralReward {
  id: string;
  type: 'ai_requests' | 'premium_trial' | 'badge';
  value: number;
  description: string;
  earnedAt: string;
}

interface Referral {
  id: string;
  referredUserId: string;
  referredUserName: string;
  referredAt: string;
  rewardClaimed: boolean;
}

interface ReferralData {
  referralCode: string;
  referrals: Referral[];
  rewards: ReferralReward[];
  totalReferrals: number;
  bonusAIRequests: number;
  hasClaimedWelcomeBonus: boolean;
  referredByCode: string | null;
}

interface ReferralContextType {
  referralCode: string;
  referrals: Referral[];
  rewards: ReferralReward[];
  totalReferrals: number;
  bonusAIRequests: number;
  isLoading: boolean;
  shareReferral: () => Promise<boolean>;
  applyReferralCode: (code: string) => Promise<boolean>;
  claimReward: (rewardId: string) => Promise<boolean>;
  getReferralBonusInfo: () => string;
}

const ReferralContext = createContext<ReferralContextType | null>(null);

const REFERRAL_STORAGE_KEY = '@dripn_referral';

function generateReferralCode(userId: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'DR';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const REFERRAL_REWARDS = {
  perReferral: {
    aiRequests: 5,
    description: '+5 AI advice requests',
  },
  milestones: [
    { referrals: 3, reward: 'style_starter', description: 'Style Starter badge' },
    { referrals: 5, reward: 'premium_trial_3', description: '3-day Premium trial' },
    { referrals: 10, reward: 'fashion_influencer', description: 'Fashion Influencer badge' },
    { referrals: 25, reward: 'premium_trial_7', description: '7-day Premium trial' },
  ],
};

export function ReferralProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReferralData();
    } else {
      setReferralData(null);
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadReferralData = async () => {
    try {
      const stored = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.userId === user?.id) {
          setReferralData(data);
        } else {
          await initializeReferralData();
        }
      } else {
        await initializeReferralData();
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
      await initializeReferralData();
    } finally {
      setIsLoading(false);
    }
  };

  const initializeReferralData = async () => {
    if (!user) return;

    const newData: ReferralData & { userId: string } = {
      userId: user.id,
      referralCode: generateReferralCode(user.id),
      referrals: [],
      rewards: [],
      totalReferrals: 0,
      bonusAIRequests: 0,
      hasClaimedWelcomeBonus: false,
      referredByCode: null,
    };

    await saveReferralData(newData);
    setReferralData(newData);
  };

  const saveReferralData = async (data: ReferralData & { userId?: string }) => {
    try {
      await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({
        ...data,
        userId: user?.id,
      }));
    } catch (error) {
      console.error('Error saving referral data:', error);
    }
  };

  const shareReferral = async (): Promise<boolean> => {
    if (!referralData) return false;

    const bonusInfo = getReferralBonusInfo();
    const success = await shareReferralCode(referralData.referralCode, bonusInfo);
    return success;
  };

  const applyReferralCode = async (code: string): Promise<boolean> => {
    if (!referralData || !user) return false;

    if (referralData.referredByCode) {
      console.log('User has already applied a referral code');
      return false;
    }

    if (code.toUpperCase() === referralData.referralCode) {
      console.log('Cannot use own referral code');
      return false;
    }

    const updatedData = {
      ...referralData,
      referredByCode: code.toUpperCase(),
      hasClaimedWelcomeBonus: true,
      bonusAIRequests: referralData.bonusAIRequests + 3,
      rewards: [
        ...referralData.rewards,
        {
          id: Date.now().toString(),
          type: 'ai_requests' as const,
          value: 3,
          description: 'Welcome bonus: +3 AI requests',
          earnedAt: new Date().toISOString(),
        },
      ],
    };

    await saveReferralData(updatedData);
    setReferralData(updatedData);
    return true;
  };

  const claimReward = async (rewardId: string): Promise<boolean> => {
    if (!referralData) return false;

    const reward = referralData.rewards.find(r => r.id === rewardId);
    if (!reward) return false;

    return true;
  };

  const getReferralBonusInfo = (): string => {
    return `Get ${REFERRAL_REWARDS.perReferral.aiRequests} free AI advice requests when you sign up!`;
  };

  const value: ReferralContextType = {
    referralCode: referralData?.referralCode || '',
    referrals: referralData?.referrals || [],
    rewards: referralData?.rewards || [],
    totalReferrals: referralData?.totalReferrals || 0,
    bonusAIRequests: referralData?.bonusAIRequests || 0,
    isLoading,
    shareReferral,
    applyReferralCode,
    claimReward,
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
