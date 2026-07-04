/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, Alert, ScrollView, ActivityIndicator, Dimensions } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, SubscriptionColors, ContributorColors, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeSubscriptionTier } from "@/utils/subscriptionTier";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useBodyProfile } from "@/contexts/BodyProfileContext";
import { useStyleProfile } from "@/contexts/StyleProfileContext";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { OutfitPiecesVisual, OutfitPieceVisual } from "@/components/OutfitPiecesVisual";
import { dfyService, SavedLookbookOutfit } from "@/services/DFYService";
import { resolveDFYItemImageUri, RawDFYOutfitItem } from "@/utils/dfyOutfitImages";
import { sortOutfitItemsByVisualOrder } from "@/utils/outfitItemOrder";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { PortalMode } from "@/App";
import apiService from "@/services/ApiService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SAVED_LOOKBOOK_CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2;

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Profile">;
  onOpenPortal?: (mode: PortalMode) => void;
};

export default function ProfileScreen({ navigation, onOpenPortal }: ProfileScreenProps) {
  const { theme, isDark } = useTheme();
  const { palette, colorScheme } = useColorScheme();
  const { translations, t } = useTranslations();
  const { user } = useAuth();
  const { limits } = useSubscription();
  const { bodyProfile, hasBodyProfile, hasColorAnalysis, saveBodyProfile } = useBodyProfile();
  const { styleProfile, hasStyleProfile } = useStyleProfile();
  const { items: wardrobeItems } = useWardrobe();
  const [activeTab, setActiveTab] = useState<"outfits">("outfits");
  const [savedLookbookOutfits, setSavedLookbookOutfits] = useState<SavedLookbookOutfit[]>([]);
  const [loadingSavedLookbook, setLoadingSavedLookbook] = useState(false);
  const [savedMixAndMatchOutfits, setSavedMixAndMatchOutfits] = useState<any[]>([]);
  const [loadingSavedOutfits, setLoadingSavedOutfits] = useState(false);

  // Derive Style DNA from wardrobe items — same logic as StyleDNAScreen
  const ownedWardrobeItems = useMemo(() => wardrobeItems.filter(i => !i.origin || i.origin === 'owned'), [wardrobeItems]);

  const wardrobeDominantStyle = useMemo(() => {
    if (ownedWardrobeItems.length === 0) return null;
    const COLOR_STYLE_MAP: Record<string, string[]> = {
      black: ['edgy','business','luxury'], white: ['smart-casual','luxury','sporty'],
      gray: ['business','smart-casual','edgy'], navy: ['business','smart-casual','luxury'],
      brown: ['boho','luxury','smart-casual'], beige: ['boho','luxury','smart-casual'],
      red: ['streetwear','edgy','luxury'], pink: ['boho','luxury','smart-casual'],
      orange: ['boho','streetwear','sporty'], yellow: ['streetwear','sporty','boho'],
      green: ['boho','sporty','smart-casual'], blue: ['sporty','smart-casual','business'],
      purple: ['edgy','luxury','boho'], multicolor: ['boho','streetwear','sporty'],
    };
    const CATEGORY_STYLE_MAP: Record<string, string[]> = {
      tops: ['smart-casual','streetwear','boho'], bottoms: ['smart-casual','business','streetwear'],
      dresses: ['luxury','boho','business'], outerwear: ['luxury','edgy','smart-casual'],
      shoes: ['luxury','sporty','streetwear'], bags: ['luxury','business','boho'],
      accessories: ['luxury','edgy','boho'], activewear: ['sporty','streetwear','smart-casual'],
      swimwear: ['boho','sporty','luxury'], sleepwear: ['smart-casual','boho','luxury'],
      formal: ['luxury','business','smart-casual'],
    };
    const STYLE_LABELS: Record<string, string> = {
      luxury: 'Minimalist', streetwear: 'Casual', boho: 'Creative',
      sporty: 'Active', 'smart-casual': 'Smart Casual', business: 'Professional', edgy: 'Trendsetter',
    };
    const scores: Record<string, number> = { luxury:0, streetwear:0, boho:0, sporty:0, 'smart-casual':0, business:0, edgy:0 };
    for (const item of ownedWardrobeItems) {
      (COLOR_STYLE_MAP[item.color] || []).forEach((s, i) => { scores[s] += (3 - i) * 1.5; });
      (CATEGORY_STYLE_MAP[item.category] || []).forEach((s, i) => { scores[s] += (3 - i) * 2; });
    }
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return top ? STYLE_LABELS[top[0]] || top[0] : null;
  }, [ownedWardrobeItems]);

  // Sync onboarding body data into BodyProfileContext if not yet stored
  useEffect(() => {
    if (!bodyProfile && user?.bodyShape && String(user.bodyShape) !== 'unknown') {
      const shape = String(user.bodyShape).toLowerCase().replace(' ', '-') as any;
      saveBodyProfile({
        bodyShape: shape,
        measurements: user.bodyMeasurements ? { ...user.bodyMeasurements } as any : {},
        isManualEntry: true,
      }).catch(() => {});
    }
  }, [user?.id]);

  // Sync onboarding colour scan data into BodyProfileContext if no full selfie analysis yet
  useEffect(() => {
    if (!hasColorAnalysis && user?.colorScanData) {
      const d = user.colorScanData;
      const seasonRaw = (d.colorSeasonType || '').toLowerCase();
      const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
      const season = validSeasons.includes(seasonRaw) ? seasonRaw as any : null;
      if (!season) return;
      const subtypeRaw = (d.seasonSubtype || '').toLowerCase();
      const validSubtypes = ['light', 'true', 'deep', 'warm', 'cool', 'soft', 'clear', 'bright'];
      const subtype = validSubtypes.includes(subtypeRaw) ? subtypeRaw as any : undefined;
      const metals = (d.bestMetals || '').toLowerCase();
      const metallic: any = metals.includes('gold') && metals.includes('silver') ? 'mixed'
        : metals.includes('rose') ? 'rose-gold'
        : metals.includes('silver') ? 'silver'
        : 'gold';
      saveBodyProfile({
        colorSeason: {
          season,
          subtype,
          bestColors: d.powerColors || [],
          avoidColors: d.avoidColors || [],
          metallic,
          confidence: 80,
          analyzedAt: d.analyzedAt || new Date().toISOString(),
        },
      }).catch(() => {});
    }
  }, [user?.id, user?.colorScanData, hasColorAnalysis]);

  // Fetch saved mix-and-match outfits from backend
  useEffect(() => {
    const fetchSavedOutfits = async () => {
      if (!user?.id) {
        setSavedMixAndMatchOutfits([]);
        return;
      }

      try {
        setLoadingSavedOutfits(true);
        const response = await apiService.getMixAndMatchOutfits();
        setSavedMixAndMatchOutfits(response.outfits || []);
      } catch {
        // Non-critical — profile still works with liked outfits only
        setSavedMixAndMatchOutfits([]);
      } finally {
        setLoadingSavedOutfits(false);
      }
    };

    fetchSavedOutfits();
  }, [user?.id]);

  const loadSavedLookbookOutfits = useCallback(async () => {
    if (!user?.id) {
      setSavedLookbookOutfits([]);
      return;
    }

    try {
      setLoadingSavedLookbook(true);
      const outfits = await dfyService.getSavedLookbookOutfits(user.id);
      setSavedLookbookOutfits(outfits);
    } catch {
      setSavedLookbookOutfits([]);
    } finally {
      setLoadingSavedLookbook(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadSavedLookbookOutfits();
    }, [loadSavedLookbookOutfits]),
  );

  // Dynamic colors from palette
  const LUXURY_COLORS = {
    gold: palette.gold,
    deepGold: palette.deepGold,
    rose: palette.rose,
    berry: palette.berry,
    violet: palette.violet,
    deepViolet: palette.deepViolet,
    champagne: '#F5E6D3',
    midnight: '#1A1A2E',
    coral: palette.coral,
    teal: palette.teal,
    emerald: palette.emerald,
  };

  const likedOutfits: SavedLookbookOutfit[] = savedLookbookOutfits;

  const handleOpenLookbook = () => {
    navigation.getParent()?.navigate?.('WardrobeTab', { screen: 'DFYLookbook' });
  };

  const handleRemoveSavedLookbookOutfit = async (outfitId: string) => {
    if (!user?.id) return;
    try {
      await dfyService.removeFromSavedLookbook(user.id, outfitId);
      setSavedLookbookOutfits((prev) => prev.filter((outfit) => outfit.id !== outfitId));
    } catch {
      Alert.alert('Could not remove outfit', 'Please try again.');
    }
  };

  const renderSavedLookbookVisual = (outfit: SavedLookbookOutfit) => {
    const orderedItems = sortOutfitItemsByVisualOrder(outfit.items || []);
    const pieces: OutfitPieceVisual[] = orderedItems
      .map((item) => {
        const wardrobe = wardrobeItems.find((w) => String(w.id) === String(item.id));
        const imageUri = resolveDFYItemImageUri(item as RawDFYOutfitItem, wardrobe);
        return {
          wardrobeItemId: item.id,
          name: item.name,
          category: item.category || wardrobe?.category,
          imageUrl: imageUri,
        };
      })
      .filter((piece) => Boolean(piece.imageUrl || piece.wardrobeItemId));

    if (pieces.length === 0) {
      return (
        <View style={[styles.savedLookbookVisualEmpty, { backgroundColor: isDark ? '#1A1A2E' : '#F8F4F0' }]}>
          <Feather name="image" size={28} color={theme.tabIconDefault} />
        </View>
      );
    }

    return (
      <View style={styles.savedLookbookVisualBlock}>
        <OutfitPiecesVisual
          pieces={pieces}
          wardrobeItems={wardrobeItems}
          label=""
          large
          canvasWidth={SAVED_LOOKBOOK_CARD_WIDTH}
        />
      </View>
    );
  };

  const handleSettingsPress = () => {
    navigation.navigate("Settings");
  };

  const handleEditProfilePress = () => {
    navigation.navigate("EditProfile");
  };

  const handleSubscriptionPress = () => {
    navigation.navigate("Subscription");
  };

  const handleAdminDashboardPress = () => {
    navigation.navigate("AdminDashboard");
  };

  const isAdmin = user?.email?.endsWith('@dripn.io') || 
                  user?.email?.endsWith('@dripn.dev') ||
                  user?.email === 'sheni_sampson@yahoo.co.uk' ||
                  user?.role === 'admin';

  const getSubscriptionBadgeGradient = (): readonly [string, string] => {
    const tier = normalizeSubscriptionTier(user?.subscriptionTier);
    if (tier === 'stylist_unlimited') {
      return [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const;
    }
    if (tier === 'personal_stylist') {
      return [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const;
    }
    return [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const;
  };

  const getContributorBadge = () => {
    const tier = user?.contributorTier || "none";
    if (tier === "none") return null;
    const colors = ContributorColors[tier];
    return (
      <LinearGradient
        colors={[colors.background, colors.background]}
        style={styles.contributorBadge}
      >
        <Feather name="award" size={10} color={colors.text} />
        <ThemedText type="caption" style={{ color: colors.text, fontWeight: "600", fontSize: 11 }}>
          {colors.label}
        </ThemedText>
      </LinearGradient>
    );
  };

  const tabConfig = [
    { key: 'outfits', label: translations.profile.savedOutfits || 'Saved Outfits', icon: 'bookmark', color: LUXURY_COLORS.gold },
  ];

  const headerGradientColors: readonly [string, string, string] = colorScheme === 'minimalist' 
    ? ['#C9A87C', '#A88B5C', '#3D3426'] as const
    : [ScreenGradients.profile.primary[0], ScreenGradients.profile.primary[1], LuxuryColors.obsidian] as const;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={headerGradientColors}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('profile.profile')}</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.profileSection}>
          <Pressable onPress={handleEditProfilePress}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold + '40', LUXURY_COLORS.violet + '40']}
              style={styles.avatarRing}
            >
              <View style={[styles.avatarContainer, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                    style={styles.avatarPlaceholder}
                  >
                    <Feather name="user" size={36} color="#FFFFFF" />
                  </LinearGradient>
                )}
              </View>
            </LinearGradient>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.editAvatarBadge}
            >
              <Feather name="edit-2" size={10} color={LUXURY_COLORS.midnight} />
            </LinearGradient>
          </Pressable>

          <ThemedText type="h2" style={[styles.userName, { color: '#FFFFFF' }]}>
            {user?.name || translations.profile.guestUser}
          </ThemedText>

          <View style={styles.badgesContainer}>
            <LinearGradient
              colors={getSubscriptionBadgeGradient()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscriptionBadge}
            >
              <ThemedText type="caption" style={styles.subscriptionBadgeText}>
                {(user?.subscriptionTier || 'free').charAt(0).toUpperCase() + (user?.subscriptionTier || 'free').slice(1)}
              </ThemedText>
            </LinearGradient>
            {getContributorBadge()}
          </View>
        </View>


      <View style={styles.actionsSection}>
        <LinearGradient
          colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.upgradeButtonGradient}
        >
          <Pressable
            onPress={handleSubscriptionPress}
            style={styles.upgradeButtonInner}
          >
            <Feather name="zap" size={18} color={LUXURY_COLORS.midnight} />
            <ThemedText type="body" style={styles.upgradeButtonText}>
              {user?.subscriptionTier === "free" ? translations.profile.upgradeToPersonal : translations.profile.manageSubscription}
            </ThemedText>
          </Pressable>
        </LinearGradient>

        {isAdmin ? (
          <LinearGradient
            colors={[LUXURY_COLORS.midnight, '#1a1a2e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.upgradeButtonGradient, { borderWidth: 1, borderColor: LUXURY_COLORS.gold }]}
          >
            <Pressable
              onPress={handleAdminDashboardPress}
              style={styles.upgradeButtonInner}
            >
              <Feather name="bar-chart-2" size={18} color={LUXURY_COLORS.gold} />
              <ThemedText type="body" style={{ color: LUXURY_COLORS.gold, fontWeight: '600' }}>
                {translations.profile.adminDashboard || 'Admin Dashboard'}
              </ThemedText>
            </Pressable>
          </LinearGradient>
        ) : null}
      </View>

      <View style={[styles.styleProfileSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
        <View style={styles.styleProfileHeader}>
          <ThemedText type="h3" style={styles.styleProfileTitle}>{t('profile.yourStyleProfile')}</ThemedText>
          <ThemedText type="small" style={styles.styleProfileSubtitle}>
            {t('profile.styleProfileSubtitle')}
          </ThemedText>
        </View>

        <View style={styles.styleProfileCards}>
          <Pressable
            onPress={() => navigation.navigate("StyleDNA")}
            style={({ pressed }) => [
              styles.styleProfileCard,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', opacity: pressed ? 0.8 : 1 }
            ]}
          >
            <LinearGradient
              colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
              style={styles.styleProfileCardIcon}
            >
              <Feather name="git-branch" size={20} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.styleProfileCardContent}>
              <ThemedText type="body" style={styles.styleProfileCardTitle}>{translations.profile.styleDna}</ThemedText>
              {ownedWardrobeItems.length > 0 ? (
                <ThemedText type="small" style={[styles.styleProfileCardValue, { color: LUXURY_COLORS.teal }]}>
                  {wardrobeDominantStyle || 'AI Analysed'}
                </ThemedText>
              ) : (
                <ThemedText type="small" style={[styles.styleProfileCardValue, { color: theme.tabIconDefault }]}>
                  Add items to your wardrobe
                </ThemedText>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={theme.tabIconDefault} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("ColorAnalysis")}
            style={({ pressed }) => [
              styles.styleProfileCard,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', opacity: pressed ? 0.8 : 1 }
            ]}
          >
            <LinearGradient
              colors={[LUXURY_COLORS.coral, LUXURY_COLORS.rose]}
              style={styles.styleProfileCardIcon}
            >
              <Feather name="droplet" size={20} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.styleProfileCardContent}>
              <ThemedText type="body" style={styles.styleProfileCardTitle}>{translations.profile.colorAnalysis}</ThemedText>
              {hasColorAnalysis && bodyProfile?.colorSeason ? (
                <ThemedText type="small" style={[styles.styleProfileCardValue, { color: LUXURY_COLORS.teal }]}>
                  {bodyProfile.colorSeason.season.charAt(0).toUpperCase() + bodyProfile.colorSeason.season.slice(1)}{bodyProfile.colorSeason.subtype ? ` · ${bodyProfile.colorSeason.subtype}` : ''}
                </ThemedText>
              ) : user?.skinUndertone ? (
                <ThemedText type="small" style={[styles.styleProfileCardValue, { color: LUXURY_COLORS.teal }]}>
                  {user.skinUndertone.charAt(0).toUpperCase() + user.skinUndertone.slice(1)} undertone
                </ThemedText>
              ) : (
                <ThemedText type="small" style={[styles.styleProfileCardValue, { color: theme.tabIconDefault }]}>
                  Take a selfie to discover your season
                </ThemedText>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={theme.tabIconDefault} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("BodyScanner")}
            style={({ pressed }) => [
              styles.styleProfileCard,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', opacity: pressed ? 0.8 : 1 }
            ]}
          >
            <LinearGradient
              colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
              style={styles.styleProfileCardIcon}
            >
              <Feather name="maximize" size={20} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.styleProfileCardContent}>
              <ThemedText type="body" style={styles.styleProfileCardTitle}>{translations.profile.bodyProfile}</ThemedText>
              {(hasBodyProfile && bodyProfile?.bodyShape && bodyProfile.bodyShape !== 'unknown') || (user?.bodyShape && String(user.bodyShape) !== 'unknown') ? (
                <ThemedText type="small" style={[styles.styleProfileCardValue, { color: LUXURY_COLORS.teal }]}>
                  {((bodyProfile?.bodyShape && bodyProfile.bodyShape !== 'unknown' ? bodyProfile.bodyShape : user?.bodyShape) as string || '').split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} shape
                </ThemedText>
              ) : (
                <ThemedText type="small" style={[styles.styleProfileCardValue, { color: theme.tabIconDefault }]}>
                  Scan or enter your measurements
                </ThemedText>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={theme.tabIconDefault} />
          </Pressable>
        </View>

        {(ownedWardrobeItems.length === 0 || !hasColorAnalysis || (!hasBodyProfile && !user?.bodyShape)) ? (
          <View style={[styles.styleProfileTip, { backgroundColor: LUXURY_COLORS.gold + '15' }]}>
            <Feather name="info" size={16} color={LUXURY_COLORS.gold} />
            <ThemedText type="small" style={styles.styleProfileTipText}>
              {ownedWardrobeItems.length === 0
                ? 'Add clothes to your wardrobe — the AI will analyse your style automatically.'
                : !hasColorAnalysis && (!hasBodyProfile && !user?.bodyShape)
                  ? 'Complete a colour selfie and body scan to unlock your full style profile.'
                  : !hasColorAnalysis && user?.skinUndertone
                    ? `You have a ${user.skinUndertone} undertone — take a colour selfie to discover your full season.`
                    : !hasColorAnalysis
                      ? 'Take a selfie in the Colour Analysis screen to discover your colour season.'
                      : 'Add your body measurements in Body Profile to get perfectly tailored recommendations.'}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.tabsContainer}>
        {tabConfig.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key as any)}
            style={styles.tabWrapper}
          >
            {activeTab === tab.key ? (
              <LinearGradient
                colors={[tab.color, tab.color + '80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.tabActive}
              >
                <Feather name={tab.icon as any} size={18} color="#FFFFFF" />
                <ThemedText type="caption" style={styles.tabTextActive}>
                  {tab.label}
                </ThemedText>
              </LinearGradient>
            ) : (
              <View style={[styles.tabInactive, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <Feather name={tab.icon as any} size={18} color={theme.tabIconDefault} />
                <ThemedText type="caption" style={{ opacity: 0.7 }}>
                  {tab.label}
                </ThemedText>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.contentSection}>
        {activeTab === "outfits" ? (
          loadingSavedLookbook || loadingSavedOutfits ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.loadingContainer}
              >
                <ActivityIndicator size="large" color={LUXURY_COLORS.midnight} />
              </LinearGradient>
              <ThemedText type="body" style={styles.emptySubtitle}>
                {t('profile.loadingOutfits')}
              </ThemedText>
            </View>
          ) : likedOutfits.length > 0 || savedMixAndMatchOutfits.length > 0 ? (
            <View style={styles.outfitsContainer}>
              {likedOutfits.map((outfit) => (
                <Pressable
                  key={outfit.id}
                  onPress={handleOpenLookbook}
                  style={[styles.likedOutfitCard, styles.likedOutfitCardVisual, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}
                >
                  <View style={styles.likedOutfitHeader}>
                    <LinearGradient
                      colors={[LUXURY_COLORS.coral, '#C46A4F']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.likedOutfitBadge}
                    >
                      <Feather name="book-open" size={10} color="#FFFFFF" />
                      <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 10 }}>
                        My Lookbook · Day {outfit.dayNumber}
                      </ThemedText>
                    </LinearGradient>
                    <View style={styles.savedLookbookFlags}>
                      {(outfit.savedReason === 'bookmark' || outfit.savedReason === 'both') && (
                        <View style={[styles.savedLookbookFlag, { backgroundColor: LUXURY_COLORS.gold + '25' }]}>
                          <Feather name="bookmark" size={12} color={LUXURY_COLORS.gold} />
                        </View>
                      )}
                      {(outfit.savedReason === 'love' || outfit.savedReason === 'both') && (
                        <View style={[styles.savedLookbookFlag, { backgroundColor: LUXURY_COLORS.rose + '25' }]}>
                          <Feather name="heart" size={12} color={LUXURY_COLORS.rose} />
                        </View>
                      )}
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          handleRemoveSavedLookbookOutfit(outfit.id);
                        }}
                        style={({ pressed }) => [
                          styles.unlikeButton,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Feather name="trash-2" size={14} color={LUXURY_COLORS.coral} />
                      </Pressable>
                    </View>
                  </View>

                  {renderSavedLookbookVisual(outfit)}
                </Pressable>
              ))}
              {savedMixAndMatchOutfits.map((outfit) => (
                <View key={outfit.id} style={[styles.likedOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}>
                  <View style={styles.likedOutfitHeader}>
                    <LinearGradient
                      colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.likedOutfitBadge}
                    >
                      <Feather name="layers" size={10} color="#FFFFFF" />
                      <ThemedText type="caption" style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 10 }}>
                        My Outfit
                      </ThemedText>
                    </LinearGradient>
                    <Pressable
                      onPress={async () => {
                        try {
                          await apiService.deleteMixAndMatchOutfit(String(outfit.id));
                          setSavedMixAndMatchOutfits(prev => prev.filter(o => o.id !== outfit.id));
                        } catch {
                          // Keep UI unchanged if delete fails
                        }
                      }}
                      style={({ pressed }) => [
                        styles.unlikeButton,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Feather name="trash-2" size={14} color={LUXURY_COLORS.rose} />
                    </Pressable>
                  </View>
                  <ThemedText type="h3" style={styles.likedOutfitTitle}>
                    {outfit.name}
                  </ThemedText>
                  <ThemedText type="small" style={styles.likedOutfitDesc} numberOfLines={1}>
                    {outfit.occasion}
                  </ThemedText>
                  {outfit.wardrobe_item_ids && outfit.wardrobe_item_ids.length > 0 && (
                    <ThemedText type="small" style={styles.likedOutfitDesc} numberOfLines={1}>
                      {outfit.wardrobe_item_ids.length} items
                    </ThemedText>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold + '30', LUXURY_COLORS.champagne + '40']}
                style={styles.emptyIconOuter}
              >
                <LinearGradient
                  colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                  style={styles.emptyIconInner}
                >
                  <Feather name="bookmark" size={28} color={LUXURY_COLORS.midnight} />
                </LinearGradient>
              </LinearGradient>
              <ThemedText type="h3" style={styles.emptyTitle}>
                {t('profile.noLikedOutfits')}
              </ThemedText>
              <ThemedText type="body" style={styles.emptySubtitle}>
                {t('profile.noLikedOutfitsHint')}
              </ThemedText>
            </View>
          )
        ) : null}
        </View>
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroGradient: {
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    alignItems: "center",
  },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: Spacing.md,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    marginBottom: Spacing.sm,
  },
  badgesContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  subscriptionBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  subscriptionBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  contributorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  statsSection: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: -Spacing.md,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 22,
  },
  statLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
  },
  actionsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  styleProfileSection: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  styleProfileHeader: {
    marginBottom: Spacing.md,
  },
  styleProfileTitle: {
    marginBottom: Spacing.xs,
  },
  styleProfileSubtitle: {
    opacity: 0.7,
    lineHeight: 18,
  },
  styleProfileCards: {
    gap: Spacing.sm,
  },
  styleProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  styleProfileCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleProfileCardContent: {
    flex: 1,
  },
  styleProfileCardTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  styleProfileCardValue: {
    opacity: 0.7,
  },
  styleProfileTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  styleProfileTipText: {
    flex: 1,
    lineHeight: 18,
  },
  upgradeButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  upgradeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  upgradeButtonText: {
    color: LuxuryColors.midnight,
    fontWeight: "700",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tabWrapper: {
    flex: 1,
  },
  tabActive: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabInactive: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contentSection: {
    minHeight: 200,
    paddingHorizontal: Spacing.lg,
  },
  postsContainer: {
    gap: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  eventsContainer: {
    gap: Spacing.md,
  },
  likedEventCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  likedEventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  likedEventIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  likedEventText: {
    flex: 1,
  },
  unlikeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  likedEventDetails: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  likedEventDetail: {
    flexDirection: "row",
    alignItems: "center",
  },
  likedEventOutfit: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  outfitsContainer: {
    gap: Spacing.md,
  },
  likedOutfitCard: {
    padding: Spacing.md,
    overflow: "hidden",
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  likedOutfitCardVisual: {
    overflow: 'visible',
    paddingBottom: Spacing.sm,
  },
  likedOutfitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  likedOutfitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  likedOutfitUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  likedOutfitAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
  },
  likedOutfitAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  likedOutfitImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  savedLookbookVisualBlock: {
    width: '100%',
    overflow: 'visible',
    marginBottom: -Spacing.md,
  },
  savedLookbookVisualEmpty: {
    width: '100%',
    minHeight: 280,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLookbookFlags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  savedLookbookFlag: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedOutfitTitle: {
    marginBottom: 4,
  },
  likedOutfitDesc: {
    opacity: 0.7,
  },
  styleTag: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
});
