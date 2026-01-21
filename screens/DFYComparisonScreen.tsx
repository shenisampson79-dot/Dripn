import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { dfyService, DFYTier, DFYComparisonTier } from "@/services/DFYService";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/ApiService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

type DFYComparisonScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const DFY_PRODUCT_IDS: Record<DFYTier, string> = {
  lite: 'lite',
  core: 'core',
};

export default function DFYComparisonScreen({ navigation }: DFYComparisonScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedTier, setSelectedTier] = useState<DFYTier>('lite');
  const [isProcessing, setIsProcessing] = useState(false);
  const tiers = dfyService.getComparisonTiers();

  const handleTierSelect = (tierId: DFYTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTier(tierId);
  };

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    
    try {
      const productId = DFY_PRODUCT_IDS[selectedTier];
      const response = await apiService.createCheckoutSession(productId);
      
      if (response.checkoutUrl) {
        const result = await WebBrowser.openBrowserAsync(response.checkoutUrl);
        
        if (result.type === 'cancel') {
          Alert.alert(
            'Checkout Cancelled',
            'You can complete your purchase at any time.',
            [{ text: 'OK' }]
          );
        } else {
          if (selectedTier === 'lite') {
            navigation.navigate('DFYStylePlan');
          } else {
            navigation.navigate('DFYCoreUpload');
          }
        }
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('DFY checkout error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to start checkout. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const renderTierCard = (tier: DFYComparisonTier) => {
    const isSelected = selectedTier === tier.id;
    const isLite = tier.id === 'lite';

    return (
      <Pressable
        key={tier.id}
        onPress={() => handleTierSelect(tier.id)}
        style={({ pressed }) => [
          styles.tierCard,
          {
            opacity: pressed ? 0.95 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={isLite 
            ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
            : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
          }
          style={[
            styles.tierCardGradient,
            isSelected && styles.tierCardSelected,
          ]}
        >
          <View style={styles.tierHeader}>
            <View>
              <View style={styles.tierNameRow}>
                <ThemedText type="h2" style={styles.tierName}>
                  {tier.name}
                </ThemedText>
                <View style={[
                  styles.mentalModelBadge,
                  { backgroundColor: 'rgba(255,255,255,0.2)' }
                ]}>
                  <ThemedText type="small" style={styles.mentalModelText}>
                    {tier.mentalModel === 'tactical' ? 'Tactical' : 'Structural'}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.tierTagline}>{tier.tagline}</ThemedText>
            </View>
            <View style={styles.priceContainer}>
              <ThemedText type="h1" style={styles.tierPrice}>{tier.price}</ThemedText>
              <ThemedText type="small" style={styles.priceSubtext}>one-time</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.tierDescription}>{tier.description}</ThemedText>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="calendar" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={styles.statText}>
                {tier.deliveryDays} days
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <Feather name="layers" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={styles.statText}>
                {tier.outfitCount} outfits
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <Feather name="camera" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={styles.statText}>
                {tier.photoType === 'outfit' ? 'Outfit photos' : 'Item photos'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.featuresContainer}>
            {tier.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Feather
                  name={feature.included ? "check-circle" : "x-circle"}
                  size={16}
                  color={feature.included ? "#FFFFFF" : "rgba(255,255,255,0.4)"}
                />
                <ThemedText
                  type="small"
                  style={[
                    styles.featureText,
                    !feature.included && styles.featureTextDisabled,
                  ]}
                >
                  {feature.text}
                </ThemedText>
              </View>
            ))}
          </View>

          {isSelected ? (
            <View style={styles.selectedIndicator}>
              <Feather name="check" size={20} color={isLite ? LUXURY_COLORS.teal : LUXURY_COLORS.gold} />
            </View>
          ) : null}
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          LUXURY_COLORS.midnight,
          '#0F0F1A',
          LUXURY_COLORS.obsidian,
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <ThemedText type="h1" style={styles.title}>
            How would you like me to style you?
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            One solves now. The other solves every time after.
          </ThemedText>

          <View style={styles.tiersContainer}>
            {tiers.map(renderTierCard)}
          </View>

          <View style={styles.comparisonNote}>
            <Feather name="info" size={16} color="rgba(255,255,255,0.5)" />
            <ThemedText type="small" style={styles.comparisonNoteText}>
              <ThemedText type="small" style={{ fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>Outfit-Based</ThemedText>
              {" "}is tactical - solve this moment, once.{" "}
              <ThemedText type="small" style={{ fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>Core Wardrobe</ThemedText>
              {" "}is structural - I learn everything you own.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <LinearGradient
            colors={selectedTier === 'lite'
              ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
              : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
            }
            style={styles.continueButtonGradient}
          >
            <Pressable 
              onPress={handleContinue} 
              style={styles.continueButton}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator 
                  size="small" 
                  color={selectedTier === 'lite' ? '#FFFFFF' : LUXURY_COLORS.midnight} 
                />
              ) : (
                <>
                  <ThemedText type="body" style={styles.continueButtonText}>
                    {selectedTier === 'lite' ? 'Purchase & Style' : 'Purchase & Build'}
                  </ThemedText>
                  <Feather
                    name="arrow-right"
                    size={18}
                    color={selectedTier === 'lite' ? '#FFFFFF' : LUXURY_COLORS.midnight}
                  />
                </>
              )}
            </Pressable>
          </LinearGradient>
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  tiersContainer: {
    gap: Spacing.lg,
  },
  tierCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  tierCardGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierCardSelected: {
    borderColor: '#FFFFFF',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tierName: {
    color: '#FFFFFF',
  },
  mentalModelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  mentalModelText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tierTagline: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  tierPrice: {
    color: '#FFFFFF',
    fontSize: 28,
  },
  priceSubtext: {
    color: 'rgba(255,255,255,0.6)',
  },
  tierDescription: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    color: '#FFFFFF',
  },
  featuresContainer: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    color: '#FFFFFF',
    flex: 1,
  },
  featureTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  selectedIndicator: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.md,
  },
  comparisonNoteText: {
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  continueButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  continueButtonText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
