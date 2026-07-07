import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Modal,
  Dimensions,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { DFYOutfitVisual } from "@/components/outfit/DFYOutfitVisual";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { 
  dfyService, 
  DFYOutfit, 
  DFYLiteDelivery,
  DFYAccessStatus,
  StylistId,
} from "@/services/DFYService";
import { apiService } from "@/services/ApiService";
import {
  enrichDeliveryWithWardrobeImages,
  fillEmptyLookbookSlots,
  countFilledLookbookDays,
  ensureLookbookOutfitsHaveFootwear,
} from "@/utils/dfyOutfitImages";
import {
  navigateToCoreFeatureUpgrade,
  outfitIndexForDay,
  type DfyStylePlanParams,
} from "@/utils/dfyNavigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

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

type DFYStylePlanScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DFYStylePlanScreen({ navigation }: DFYStylePlanScreenProps) {
  const route = useRoute();
  const routeParams = route.params as DfyStylePlanParams | undefined;
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { items: wardrobeItems } = useWardrobe();
  const insets = useSafeAreaInsets();
  
  const [delivery, setDelivery] = useState<DFYLiteDelivery | null>(null);
  const [accessStatus, setAccessStatus] = useState<DFYAccessStatus | null>(null);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustmentText, setAdjustmentText] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");

  const mapApiOutfitsToDelivery = (rawOutfits: any[], stylistId: StylistId): DFYOutfit[] =>
    rawOutfits.map((o, idx) => ({
      id: o.id || `outfit_${idx + 1}`,
      dayNumber: o.day || o.dayNumber || idx + 1,
      title: o.title || (idx === 0 ? "Today's Look" : `Day ${idx + 1} Look`),
      description: o.description || o.stylistNote || '',
      items: (o.items || []).map((it: any) => ({
        id: String(it.id),
        name: it.name || '',
        category: it.category || '',
        color: it.color || '',
        imageUrl: it.imageUrl,
        processedImageUrl: it.processedImageUrl,
        imageUri: it.imageUri || it.processedImageUrl || it.imageUrl || undefined,
      })),
      occasion: o.occasion || 'casual',
      stylistNote: o.stylistNote || o.notes,
      weatherNote: o.weatherNote,
      stylistId: (o.stylistId || stylistId) as StylistId,
      userReaction: null,
      saved: false,
    }));

  const mergeApiOutfitsIntoDelivery = (
    existing: DFYLiteDelivery,
    mappedOutfits: DFYOutfit[],
  ): DFYOutfit[] =>
    existing.outfits.map((slot, idx) => {
      const source = mappedOutfits[idx] ?? mappedOutfits.find((o) => o.dayNumber === slot.dayNumber);
      if (!source?.items?.length) return slot;
      return {
        ...source,
        id: slot.id,
        dayNumber: slot.dayNumber,
        title: slot.title,
        userReaction: slot.userReaction ?? source.userReaction ?? null,
        saved: slot.saved ?? source.saved ?? false,
      };
    });

  const hydrateDelivery = useCallback(
    (base: DFYLiteDelivery): DFYLiteDelivery =>
      enrichDeliveryWithWardrobeImages(
        ensureLookbookOutfitsHaveFootwear(base, wardrobeItems),
        wardrobeItems,
      ),
    [wardrobeItems],
  );

  const loadDelivery = async () => {
    if (!user?.id) return;

    const stylistId = user.stylistPreferences?.selectedStylistId || 'ruby';
    let existingDelivery = await dfyService.getDFYDelivery(user.id);

    if (!existingDelivery) {
      existingDelivery = await dfyService.createMockLiteDelivery(user.id, stylistId);
    }

    if (existingDelivery?.tier !== 'lite') {
      const status = await dfyService.checkDFYAccess(user.id, user.subscriptionTier);
      setAccessStatus(status);
      return;
    }

    let liteDelivery = existingDelivery as DFYLiteDelivery;
    const beforeJson = JSON.stringify(liteDelivery.outfits);

    if (countFilledLookbookDays(liteDelivery) < (liteDelivery.totalDays || 14)) {
      try {
        const remote = await apiService.getDFYLookbook();
        if (remote.success && remote.outfits && remote.outfits.length > 0) {
          const mapped = mapApiOutfitsToDelivery(remote.outfits, stylistId);
          liteDelivery = {
            ...liteDelivery,
            outfits: mergeApiOutfitsIntoDelivery(liteDelivery, mapped),
          };
        }
      } catch (err) {
        console.log('[DFYStylePlan] Remote lookbook fetch failed:', err);
      }
    }

    if (wardrobeItems.length >= 2) {
      liteDelivery = fillEmptyLookbookSlots(liteDelivery, wardrobeItems, stylistId, null);
    }

    const hydrated = hydrateDelivery(liteDelivery);
    const resumeDay = routeParams?.initialDay ?? hydrated.currentDay ?? 1;
    const resumeIndex = outfitIndexForDay(hydrated.outfits.length, resumeDay);
    const withCurrentDay =
      resumeDay !== hydrated.currentDay ? { ...hydrated, currentDay: resumeDay } : hydrated;
    setCurrentOutfitIndex(resumeIndex);
    setDelivery(withCurrentDay);

    if (JSON.stringify(withCurrentDay.outfits) !== beforeJson || resumeDay !== hydrated.currentDay) {
      await dfyService.saveDFYDelivery(withCurrentDay);
    } else if (JSON.stringify(hydrated.outfits) !== beforeJson) {
      await dfyService.saveDFYDelivery(hydrated);
    }

    const status = await dfyService.checkDFYAccess(user.id, user.subscriptionTier);
    setAccessStatus(status);
  };

  useEffect(() => {
    void loadDelivery();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadDelivery();
    }, [user?.id, wardrobeItems.length]),
  );

  useEffect(() => {
    if (!delivery || wardrobeItems.length === 0) return;
    const hydrated = hydrateDelivery(delivery);
    const gainedImages = hydrated.outfits.some((outfit, idx) =>
      outfit.items.some((item, itemIdx) => {
        const prev = delivery.outfits[idx]?.items[itemIdx];
        return item.imageUri && !prev?.imageUri;
      }),
    );
    if (gainedImages) {
      setDelivery(hydrated);
      void dfyService.saveDFYDelivery(hydrated);
    }
  }, [wardrobeItems, delivery, hydrateDelivery]);

  const currentOutfit = delivery?.outfits[currentOutfitIndex];

  const handleReaction = async (reaction: 'love' | 'not-me' | null) => {
    if (!user?.id || !currentOutfit) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await dfyService.updateOutfitReaction(user.id, currentOutfit.id, reaction);
    
    setDelivery(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.outfits = [...prev.outfits];
      updated.outfits[currentOutfitIndex] = {
        ...updated.outfits[currentOutfitIndex],
        userReaction: reaction,
      };
      return updated;
    });
  };

  const handleAdjust = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAdjustModal(true);
  };

  const submitAdjustment = async () => {
    if (!user?.id || !currentOutfit || !adjustmentText.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await dfyService.updateOutfitReaction(user.id, currentOutfit.id, null, adjustmentText);
    
    setDelivery(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.outfits = [...prev.outfits];
      updated.outfits[currentOutfitIndex] = {
        ...updated.outfits[currentOutfitIndex],
        adjustmentRequest: adjustmentText,
      };
      return updated;
    });
    
    setShowAdjustModal(false);
    setAdjustmentText("");
  };

  const handleSave = async () => {
    if (!user?.id || !currentOutfit) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await dfyService.toggleOutfitSaved(user.id, currentOutfit.id);
    
    setDelivery(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.outfits = [...prev.outfits];
      updated.outfits[currentOutfitIndex] = {
        ...updated.outfits[currentOutfitIndex],
        saved: !updated.outfits[currentOutfitIndex].saved,
      };
      return updated;
    });
  };

  const handleCoreFeatureRequest = (feature: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpgradeFeature(feature);
    setShowUpgradeModal(true);
  };

  const persistCurrentDay = (index: number) => {
    if (!delivery || !user?.id) return;
    const dayNumber = delivery.outfits[index]?.dayNumber ?? index + 1;
    if (delivery.currentDay === dayNumber) return;
    const updated = { ...delivery, currentDay: dayNumber };
    setDelivery(updated);
    void dfyService.saveDFYDelivery(updated);
  };

  const navigateOutfit = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (direction === 'prev' && currentOutfitIndex > 0) {
      const nextIndex = currentOutfitIndex - 1;
      setCurrentOutfitIndex(nextIndex);
      persistCurrentDay(nextIndex);
    } else if (direction === 'next' && delivery && currentOutfitIndex < delivery.outfits.length - 1) {
      const nextIndex = currentOutfitIndex + 1;
      setCurrentOutfitIndex(nextIndex);
      persistCurrentDay(nextIndex);
    }
  };

  const needsCoreUpgrade = accessStatus?.hasAccess && accessStatus.tier === 'lite';

  const renderOutfitVisual = (outfit: DFYOutfit) => (
    <DFYOutfitVisual
      outfit={outfit}
      wardrobeItems={wardrobeItems}
      canvasWidth={CARD_WIDTH}
      minHeight={300}
    />
  );

  if (!delivery || !currentOutfit) {
    return (
      <View style={{ flex: 1, backgroundColor: LUXURY_COLORS.obsidian }}>
        <LinearGradient
          colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald, LUXURY_COLORS.obsidian]}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ThemedText style={{ color: '#FFFFFF' }}>Loading your style plan...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald, LUXURY_COLORS.obsidian]}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />

      {accessStatus?.showNudge && accessStatus.nudgeType === 'day12' ? (
        <Pressable
          onPress={() => navigation.navigate('DFYExpiry')}
          style={styles.nudgeBanner}
        >
          <LinearGradient
            colors={[LUXURY_COLORS.coral, '#C46A4F']}
            style={styles.nudgeBannerGradient}
          >
            <Feather name="alert-circle" size={16} color="#FFFFFF" />
            <ThemedText type="small" style={styles.nudgeBannerText}>
              {accessStatus.daysRemaining} days left! See what stays after expiry
            </ThemedText>
            <Feather name="chevron-right" size={16} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      ) : null}

      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.dayIndicator}>
            <ThemedText type="h3" style={styles.dayText}>
              Day {currentOutfit.dayNumber}
            </ThemedText>
            <ThemedText type="small" style={styles.daySubtext}>
              of {delivery.totalDays}
            </ThemedText>
          </View>
          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Feather 
              name={currentOutfit.saved ? "bookmark" : "bookmark"} 
              size={20} 
              color={currentOutfit.saved ? LUXURY_COLORS.gold : "#FFFFFF"} 
            />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.outfitCard}>
            {renderOutfitVisual(currentOutfit)}
          </View>

          <View style={styles.outfitInfo}>
            <ThemedText type="h2" style={styles.outfitTitle}>
              {currentOutfit.title}
            </ThemedText>
            <View style={styles.occasionBadge}>
              <Feather 
                name={
                  currentOutfit.occasion === 'work' ? 'briefcase' :
                  currentOutfit.occasion === 'holiday' ? 'sun' :
                  currentOutfit.occasion === 'event' ? 'star' :
                  currentOutfit.occasion === 'casual' ? 'coffee' : 'eye'
                } 
                size={14} 
                color="#FFFFFF" 
              />
              <ThemedText type="small" style={styles.occasionText}>
                {currentOutfit.occasion.charAt(0).toUpperCase() + currentOutfit.occasion.slice(1)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.stylistNoteCard}>
            <ThemedText type="small" style={styles.stylistNoteLabel}>
              Stylist Note
            </ThemedText>
            <ThemedText style={styles.stylistNoteText}>
              {currentOutfit.stylistNote}
            </ThemedText>
          </View>

          <View style={styles.actionsContainer}>
            <ThemedText type="small" style={styles.actionsLabel}>
              How do you feel about this look?
            </ThemedText>
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => handleReaction('love')}
                style={[
                  styles.actionButton,
                  currentOutfit.userReaction === 'love' && styles.actionButtonActive,
                ]}
              >
                <LinearGradient
                  colors={currentOutfit.userReaction === 'love' 
                    ? [LUXURY_COLORS.rose, '#D4949A']
                    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                  }
                  style={styles.actionButtonGradient}
                >
                  <Feather name="heart" size={20} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.actionButtonText}>Love it</ThemedText>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => handleReaction('not-me')}
                style={[
                  styles.actionButton,
                  currentOutfit.userReaction === 'not-me' && styles.actionButtonActive,
                ]}
              >
                <LinearGradient
                  colors={currentOutfit.userReaction === 'not-me'
                    ? [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]
                    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                  }
                  style={styles.actionButtonGradient}
                >
                  <Feather name="x" size={20} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.actionButtonText}>Not me</ThemedText>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={handleAdjust} style={styles.actionButton}>
                <LinearGradient
                  colors={currentOutfit.adjustmentRequest
                    ? [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
                    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                  }
                  style={styles.actionButtonGradient}
                >
                  <Feather name="sliders" size={20} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.actionButtonText}>Adjust</ThemedText>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <View style={styles.coreOnlyActions}>
            <ThemedText type="small" style={styles.coreOnlyLabel}>
              Want more control?
            </ThemedText>
            <View style={styles.coreActionsRow}>
              <Pressable
                onPress={() => handleCoreFeatureRequest('swap_item')}
                style={styles.coreActionButton}
              >
                <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.5)" />
                <ThemedText type="small" style={styles.coreActionText}>Swap item</ThemedText>
                <View style={styles.coreBadge}>
                  <ThemedText type="small" style={styles.coreBadgeText}>Core</ThemedText>
                </View>
              </Pressable>
              <Pressable
                onPress={() => handleCoreFeatureRequest('remix')}
                style={styles.coreActionButton}
              >
                <Feather name="shuffle" size={16} color="rgba(255,255,255,0.5)" />
                <ThemedText type="small" style={styles.coreActionText}>Remix</ThemedText>
                <View style={styles.coreBadge}>
                  <ThemedText type="small" style={styles.coreBadgeText}>Core</ThemedText>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.navigationRow}>
            <Pressable
              onPress={() => navigateOutfit('prev')}
              disabled={currentOutfitIndex === 0}
              style={[
                styles.navButton,
                currentOutfitIndex === 0 && styles.navButtonDisabled,
              ]}
            >
              <Feather name="chevron-left" size={24} color={currentOutfitIndex === 0 ? 'rgba(255,255,255,0.3)' : '#FFFFFF'} />
              <ThemedText type="small" style={[
                styles.navButtonText,
                currentOutfitIndex === 0 && styles.navButtonTextDisabled,
              ]}>Previous</ThemedText>
            </Pressable>

            <View style={styles.outfitDots}>
              {delivery.outfits.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.outfitDot,
                    idx === currentOutfitIndex && styles.outfitDotActive,
                  ]}
                />
              ))}
            </View>

            <Pressable
              onPress={() => navigateOutfit('next')}
              disabled={currentOutfitIndex === delivery.outfits.length - 1}
              style={[
                styles.navButton,
                currentOutfitIndex === delivery.outfits.length - 1 && styles.navButtonDisabled,
              ]}
            >
              <ThemedText type="small" style={[
                styles.navButtonText,
                currentOutfitIndex === delivery.outfits.length - 1 && styles.navButtonTextDisabled,
              ]}>Next</ThemedText>
              <Feather 
                name="chevron-right" 
                size={24} 
                color={currentOutfitIndex === delivery.outfits.length - 1 ? 'rgba(255,255,255,0.3)' : '#FFFFFF'} 
              />
            </Pressable>
          </View>
        </View>
      </ScreenScrollView>

      <Modal
        visible={showAdjustModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdjustModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdjustModal(false)}>
          <Pressable style={styles.adjustModal} onPress={e => e.stopPropagation()}>
            <LinearGradient
              colors={[LUXURY_COLORS.midnight, LUXURY_COLORS.obsidian]}
              style={styles.adjustModalGradient}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="h3" style={styles.modalTitle}>
                  Adjust this look
                </ThemedText>
                <Pressable onPress={() => setShowAdjustModal(false)}>
                  <Feather name="x" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
              <ThemedText style={styles.modalSubtitle}>
                Tell your stylist what you'd like changed
              </ThemedText>
              <TextInput
                style={styles.adjustInput}
                placeholder="e.g., Can I wear this with flats instead?"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={adjustmentText}
                onChangeText={setAdjustmentText}
                multiline
                numberOfLines={4}
                maxLength={300}
              />
              <Pressable onPress={submitAdjustment} style={styles.submitButton}>
                <LinearGradient
                  colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                  style={styles.submitButtonGradient}
                >
                  <ThemedText type="body" style={styles.submitButtonText}>
                    Send adjustment
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowUpgradeModal(false)}>
          <Pressable style={styles.upgradeModal} onPress={e => e.stopPropagation()}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.upgradeModalGradient}
            >
              <View style={styles.upgradeIconContainer}>
                <Feather name="unlock" size={32} color={LUXURY_COLORS.midnight} />
              </View>
              <ThemedText type="h2" style={styles.upgradeTitle}>
                Unlock Full Setup
              </ThemedText>
              <ThemedText style={styles.upgradeDescription}>
                {upgradeFeature === 'swap_item' 
                  ? "Swapping individual items requires your full wardrobe mapped. With Full Setup, I can break down every piece and rebuild outfits your way."
                  : "Creating remixes needs your full wardrobe in the system. Full Setup gives you unlimited combinations from all your pieces."
                }
              </ThemedText>
              <Pressable 
                onPress={() => {
                  setShowUpgradeModal(false);
                  navigateToCoreFeatureUpgrade(navigation, accessStatus);
                }}
                style={styles.upgradeButton}
              >
                <ThemedText type="body" style={styles.upgradeButtonText}>
                  {needsCoreUpgrade ? 'Upgrade to Full Setup' : 'Start Full Setup'}
                </ThemedText>
              </Pressable>
              <Pressable 
                onPress={() => setShowUpgradeModal(false)}
                style={styles.maybeLaterButton}
              >
                <ThemedText style={styles.maybeLaterText}>Maybe later</ThemedText>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  nudgeBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  nudgeBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingTop: 60,
  },
  nudgeBannerText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
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
  dayIndicator: {
    alignItems: 'center',
  },
  dayText: {
    color: '#FFFFFF',
  },
  daySubtext: {
    color: 'rgba(255,255,255,0.6)',
  },
  saveButton: {
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
  outfitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  outfitInfo: {
    marginBottom: Spacing.lg,
  },
  outfitTitle: {
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  occasionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  occasionText: {
    color: '#FFFFFF',
  },
  stylistNoteCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  stylistNoteLabel: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.xs,
  },
  stylistNoteText: {
    color: '#FFFFFF',
    lineHeight: 22,
  },
  actionsContainer: {
    marginBottom: Spacing.xl,
  },
  actionsLabel: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  actionButtonActive: {},
  actionButtonGradient: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  coreOnlyActions: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  coreOnlyLabel: {
    color: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.md,
  },
  coreActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  coreActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  coreActionText: {
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  coreBadge: {
    backgroundColor: LUXURY_COLORS.gold,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  coreBadgeText: {
    color: LUXURY_COLORS.midnight,
    fontSize: 10,
    fontWeight: '700',
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  outfitDots: {
    flexDirection: 'row',
    gap: 6,
  },
  outfitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  outfitDotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  adjustModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  adjustModalGradient: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    color: '#FFFFFF',
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.lg,
  },
  adjustInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  submitButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  submitButtonGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: '700',
  },
  upgradeModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  upgradeModalGradient: {
    padding: Spacing.xl,
    paddingBottom: 40,
    alignItems: 'center',
  },
  upgradeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  upgradeTitle: {
    color: LUXURY_COLORS.midnight,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  upgradeDescription: {
    color: 'rgba(0,0,0,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: LUXURY_COLORS.midnight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  maybeLaterButton: {
    paddingVertical: Spacing.sm,
  },
  maybeLaterText: {
    color: 'rgba(0,0,0,0.5)',
  },
});
