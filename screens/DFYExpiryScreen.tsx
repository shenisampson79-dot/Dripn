import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { dfyService, DFYExpiryFlow, DFYAccessStatus } from "@/services/DFYService";
import { useTranslations } from "@/contexts/TranslationContext";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  obsidian: '#0D0B09',
};

type DFYExpiryScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DFYExpiryScreen({ navigation }: DFYExpiryScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [accessStatus, setAccessStatus] = useState<DFYAccessStatus | null>(null);
  const [expiryFlow, setExpiryFlow] = useState<DFYExpiryFlow | null>(null);

  useEffect(() => {
    loadExpiryData();
  }, []);

  const loadExpiryData = async () => {
    if (!user?.id) return;
    
    const status = await dfyService.checkDFYAccess(user.id, user.subscriptionTier);
    setAccessStatus(status);
    
    if (status.tier) {
      const flow = dfyService.getExpiryFlow(status.tier, status.daysRemaining, status.windowDays);
      setExpiryFlow(flow);
    }
  };

  const handleUpgradeToCore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('DFYStart');
  };

  const handleRenew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const isExpired = accessStatus?.daysRemaining === 0;
  const isLite = accessStatus?.tier === 'lite';

  const getHeaderGradient = (): readonly [string, string, ...string[]] => {
    if (isExpired) {
      return [LUXURY_COLORS.coral, '#C46A4F', LUXURY_COLORS.obsidian] as const;
    }
    if (isLite) {
      return [LUXURY_COLORS.teal, LUXURY_COLORS.emerald, LUXURY_COLORS.obsidian] as const;
    }
    return [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold, LUXURY_COLORS.obsidian] as const;
  };

  if (!accessStatus || !expiryFlow) {
    return (
      <View style={{ flex: 1, backgroundColor: LUXURY_COLORS.obsidian }}>
        <LinearGradient
          colors={[LUXURY_COLORS.coral, '#C46A4F', LUXURY_COLORS.obsidian]}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ThemedText style={{ color: '#FFFFFF' }}>{t('common.loading')}</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={getHeaderGradient()}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Feather 
              name={isExpired ? "clock" : "alert-circle"} 
              size={48} 
              color="#FFFFFF" 
            />
          </View>

          <ThemedText type="h1" style={styles.title}>
            {isExpired 
              ? (isLite ? t('dfy.expiry.planCompleteLite') : t('dfy.expiry.windowEnded'))
              : t('dfy.expiry.daysRemaining').replace('{count}', String(accessStatus.daysRemaining))
            }
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            {isExpired
              ? (isLite 
                  ? t('dfy.expiry.expiredSubtitleLite')
                  : t('dfy.expiry.expiredSubtitleCore'))
              : (isLite && accessStatus.daysRemaining <= 3
                  ? t('dfy.expiry.warningCapsule')
                  : t('dfy.expiry.accessEndsNote'))
            }
          </ThemedText>

          <View style={styles.sectionsContainer}>
            <View style={styles.staysSection}>
              <View style={styles.sectionHeader}>
                <Feather name="check-circle" size={20} color={LUXURY_COLORS.emerald} />
                <ThemedText type="h3" style={styles.sectionTitle}>
                  {isExpired ? t('dfy.expiry.whatStayed') : t('dfy.expiry.whatStays')}
                </ThemedText>
              </View>
              {expiryFlow.whatStays.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.bulletGreen} />
                  <ThemedText style={styles.listItemText}>{item}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.stopsSection}>
              <View style={styles.sectionHeader}>
                <Feather name="x-circle" size={20} color={LUXURY_COLORS.coral} />
                <ThemedText type="h3" style={styles.sectionTitle}>
                  {isExpired ? t('dfy.expiry.whatStopped') : t('dfy.expiry.whatStops')}
                </ThemedText>
              </View>
              {expiryFlow.whatStops.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.bulletRed} />
                  <ThemedText style={styles.listItemText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {isLite ? (
            <View style={styles.upgradeCard}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.upgradeCardGradient}
              >
                <Feather name="arrow-up-circle" size={24} color={LUXURY_COLORS.midnight} />
                <View style={styles.upgradeCardContent}>
                  <ThemedText type="h3" style={styles.upgradeCardTitle}>
                    {t('dfy.expiry.buildWardrobeTitle')}
                  </ThemedText>
                  <ThemedText style={styles.upgradeCardDescription}>
                    {t('dfy.expiry.buildWardrobeDesc')}
                  </ThemedText>
                </View>
                <Pressable onPress={handleUpgradeToCore} style={styles.upgradeCardButton}>
                  <ThemedText type="body" style={styles.upgradeCardButtonText}>
                    {t('dfy.expiry.buildIt')}
                  </ThemedText>
                </Pressable>
              </LinearGradient>
            </View>
          ) : null}

          {!isLite && (
            <View style={styles.renewCard}>
              <View style={styles.renewCardContent}>
                <ThemedText type="h3" style={styles.renewCardTitle}>
                  {t('dfy.expiry.keepStylistActive')}
                </ThemedText>
                <ThemedText style={styles.renewCardDescription}>
                  {t('dfy.expiry.keepStylistDesc')}
                </ThemedText>
              </View>
              <Pressable onPress={handleRenew} style={styles.renewButton}>
                <LinearGradient
                  colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                  style={styles.renewButtonGradient}
                >
                  <ThemedText type="body" style={styles.renewButtonText}>
                    {t('dfy.expiry.subscribe')}
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          <Pressable onPress={() => navigation.goBack()} style={styles.continueButton}>
            <ThemedText style={styles.continueButtonText}>
              {isExpired ? 'Continue to app' : 'Back to style plan'}
            </ThemedText>
          </Pressable>
        </View>
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: Spacing["2xl"],
  },
  sectionsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  staysSection: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: LUXURY_COLORS.emerald,
  },
  stopsSection: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: LUXURY_COLORS.coral,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: '#FFFFFF',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bulletGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LUXURY_COLORS.emerald,
  },
  bulletRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LUXURY_COLORS.coral,
  },
  listItemText: {
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  upgradeCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  upgradeCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  upgradeCardContent: {
    flex: 1,
  },
  upgradeCardTitle: {
    color: LUXURY_COLORS.midnight,
    marginBottom: 2,
  },
  upgradeCardDescription: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 13,
  },
  upgradeCardButton: {
    backgroundColor: LUXURY_COLORS.midnight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  upgradeCardButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  renewCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  renewCardContent: {
    marginBottom: Spacing.md,
  },
  renewCardTitle: {
    color: '#FFFFFF',
    marginBottom: 4,
  },
  renewCardDescription: {
    color: 'rgba(255,255,255,0.6)',
  },
  renewButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  renewButtonGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  renewButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  continueButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  continueButtonText: {
    color: 'rgba(255,255,255,0.6)',
  },
});
