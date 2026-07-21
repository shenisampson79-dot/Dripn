import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { WardrobeItemImage } from "@/components/WardrobeItemImage";
import { onboardingProfileService, type OnboardingProfile } from '@/services/OnboardingProfileService';
import {
  countItemsForWardrobeCategory,
  getWardrobeCategoryTabs,
  itemMatchesWardrobeCategory,
  resolveUserPresentationGender,
} from '@/utils/wardrobeCategories';
import { isDurableWardrobeCdnUrl, isProxyWardrobeImageUri, wardrobeProcessedTileBackground, wardrobeTileBackground } from "@/utils/wardrobeImage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import {
  useWardrobe,
  WardrobeItem,
  ClothingCategory,
  ClothingSeason,
  CATEGORY_LABELS,
  SEASON_LABELS,
} from "@/contexts/WardrobeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { dfyService, DFYAccessStatus } from "@/services/DFYService";
import apiService from "@/services/ApiService";
import type { WardrobeStackParamList } from "@/navigation/WardrobeStackNavigator";
import { OccasionPickerList } from '@/components/outfit/OccasionPickerList';
import { GeneratedOutfitModal, type GeneratedOutfitModalData } from '@/components/outfit/GeneratedOutfitModal';
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import { getOccasionLabel } from '@/constants/outfitOccasions';
import { generateWardrobeOutfit } from '@/utils/generatedOutfit';
import { applyWearIncrement, laundryProfileFromUser } from '@/utils/wearRules';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** Prefer colder seasons when an item spans multiple (e.g. autumn+winter outerwear). */
function getSeasonDetailIcon(seasons: ClothingSeason[]): keyof typeof Feather.glyphMap {
  const set = new Set(seasons);
  if (set.has('winter')) return 'cloud-snow';
  if (set.has('autumn')) return 'cloud-drizzle';
  if (set.has('spring')) return 'sunrise';
  if (set.has('summer')) return 'sun';
  if (set.has('all-season')) return 'layers';
  return 'help-circle';
}

function formatSeasonDetailLabel(seasons: ClothingSeason[]): string {
  if (!seasons.length) return 'Not set';
  return seasons
    .map((s) => SEASON_LABELS[s] || s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
    .join(', ');
}

const GRID_GAP = Spacing.md;
const ITEM_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - GRID_GAP) / 2;
const ITEM_HEIGHT = Math.round(ITEM_WIDTH * 1.34);
const TAB_BAR_HEIGHT = 56;

const getMinimalistCategoryColors = (): Record<string, { gradient: readonly [string, string]; icon: string }> => ({
  'all': { gradient: ['#C9A87C', '#A88B5C'] as const, icon: 'grid' },
  'tops': { gradient: ['#C4A484', '#B49474'] as const, icon: 'sun' },
  'bottoms': { gradient: ['#A69279', '#968269'] as const, icon: 'minimize-2' },
  'dresses': { gradient: ['#D4C4B0', '#C4B4A0'] as const, icon: 'heart' },
  'outerwear': { gradient: ['#8B7D6B', '#7B6D5B'] as const, icon: 'cloud' },
  'shoes': { gradient: ['#C9A87C', '#A88B5C'] as const, icon: 'disc' },
  'bags': { gradient: ['#8B7355', '#7B6345'] as const, icon: 'shopping-bag' },
  'accessories': { gradient: ['#B8A898', '#A89888'] as const, icon: 'watch' },
  'activewear_tops': { gradient: ['#9C8B7A', '#8C7B6A'] as const, icon: 'activity' },
  'activewear_bottoms': { gradient: ['#9C8B7A', '#8C7B6A'] as const, icon: 'activity' },
  'formal': { gradient: ['#6B5B4F', '#5B4B3F'] as const, icon: 'star' },
});

const getColorfulCategoryColors = (): Record<string, { gradient: readonly [string, string]; icon: string }> => ({
  'all': { gradient: ['#9B7EBD', '#6B4E8D'] as const, icon: 'grid' },
  'tops': { gradient: ['#E07A5F', '#C46A4F'] as const, icon: 'sun' },
  'bottoms': { gradient: ['#2A9D8F', '#059669'] as const, icon: 'minimize-2' },
  'dresses': { gradient: ['#E8B4B8', '#D4949A'] as const, icon: 'heart' },
  'outerwear': { gradient: ['#64748B', '#475569'] as const, icon: 'cloud' },
  'shoes': { gradient: ['#C9A87C', '#A88B5C'] as const, icon: 'disc' },
  'bags': { gradient: ['#8B2F39', '#6B2430'] as const, icon: 'shopping-bag' },
  'accessories': { gradient: ['#8B5CF6', '#7C3AED'] as const, icon: 'watch' },
  'activewear_tops': { gradient: ['#06B6D4', '#0891B2'] as const, icon: 'activity' },
  'activewear_bottoms': { gradient: ['#0284C7', '#0369A1'] as const, icon: 'activity' },
  'formal': { gradient: ['#1E293B', '#0F172A'] as const, icon: 'star' },
});

type WardrobeScreenProps = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, "Wardrobe">;
};

export default function WardrobeScreen({ navigation }: WardrobeScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colorScheme, palette } = useColorScheme();
  const { translations, t } = useTranslations();
  const { items, isLoading, deleteItem, deleteItems, toggleItemFavorite, markItemWorn, markItemDirty, markItemClean, updateItem, reloadWardrobe, fixBackgroundsFromCache, wardrobePhotosUnavailable, backgroundRemovalProgress } = useWardrobe();
  
  const CATEGORY_COLORS = colorScheme === 'minimalist' 
    ? getMinimalistCategoryColors() 
    : getColorfulCategoryColors();

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
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [dfyAccess, setDfyAccess] = useState<DFYAccessStatus | null>(null);
  const [showAIOutfitModal, setShowAIOutfitModal] = useState(false);
  const [showGeneratedOutfitModal, setShowGeneratedOutfitModal] = useState(false);
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);
  const [generatingOccasion, setGeneratingOccasion] = useState<string | null>(null);
  const [generatedOutfit, setGeneratedOutfit] = useState<GeneratedOutfitModalData | null>(null);
  const [generatedOutfitMeta, setGeneratedOutfitMeta] = useState<{ occasion: string; title: string } | null>(null);
  const [isReprocessingBg, setIsReprocessingBg] = useState(false);
  const [isReprocessingAll, setIsReprocessingAll] = useState(false);
  const [batchBgProgress, setBatchBgProgress] = useState<{ processed: number; total: number; failed: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(null);
  const bgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const presentationGender = useMemo(
    () => resolveUserPresentationGender(user, onboardingProfile),
    [user, onboardingProfile],
  );

  const CATEGORY_OPTIONS = useMemo(
    () =>
      getWardrobeCategoryTabs(presentationGender).map(({ key, icon, iconSet, translationKey }) => ({
        key,
        icon,
        iconSet,
        label: t(translationKey),
      })),
    [presentationGender, t],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const option of CATEGORY_OPTIONS) {
      counts[option.key] = countItemsForWardrobeCategory(items, option.key, presentationGender);
    }
    return counts;
  }, [CATEGORY_OPTIONS, items, presentationGender]);

  const filteredItems = useMemo(
    () => items.filter((item) => itemMatchesWardrobeCategory(item, selectedCategory, presentationGender)),
    [items, selectedCategory, presentationGender],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await reloadWardrobe();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert(t('wardrobe.refreshFailed'), t('wardrobe.refreshFailedMessage'));
    } finally {
      setIsRefreshing(false);
    }
  }, [reloadWardrobe]);

  const stopBgPolling = useCallback(() => {
    if (bgPollRef.current) {
      clearInterval(bgPollRef.current);
      bgPollRef.current = null;
    }
  }, []);

  const pollBackgroundReprocessStatus = useCallback(async (showCompletionAlert = true) => {
    try {
      const status = await apiService.getBackgroundReprocessStatus();
      if (!status.inProgress) {
        stopBgPolling();
        setIsReprocessingAll(false);
        if (status.total > 0) {
          setBatchBgProgress({ processed: status.processed, total: status.total, failed: status.failed });
          await reloadWardrobe();
          if (showCompletionAlert) {
            const failedPart = status.failed > 0 ? `, ${status.failed} failed` : '';
            Alert.alert(
              t('wardrobe.bgFixComplete'),
              t('wardrobe.bgFixCompleteMessage')
                .replace('{processed}', String(status.processed))
                .replace('{failedPart}', failedPart)
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          setBatchBgProgress(null);
        }
        return;
      }

      setBatchBgProgress({
        processed: status.processed + status.failed,
        total: status.total,
        failed: status.failed,
      });
      await reloadWardrobe();
    } catch {
      // Keep polling — transient network errors are expected during long jobs.
    }
  }, [reloadWardrobe, stopBgPolling]);

  const startBgPolling = useCallback(() => {
    stopBgPolling();
    bgPollRef.current = setInterval(() => {
      pollBackgroundReprocessStatus(true);
    }, 5000);
    pollBackgroundReprocessStatus(false);
  }, [pollBackgroundReprocessStatus, stopBgPolling]);

  useEffect(() => () => stopBgPolling(), [stopBgPolling]);

  useFocusEffect(
    useCallback(() => {
      onboardingProfileService.getProfile().then(async (profile) => {
        if (!profile.quizGender && user?.gender === 'man') {
          const updated = await onboardingProfileService.saveProfile({ quizGender: 'male' });
          setOnboardingProfile(updated);
        } else if (!profile.quizGender && user?.gender === 'woman') {
          const updated = await onboardingProfileService.saveProfile({ quizGender: 'female' });
          setOnboardingProfile(updated);
        } else {
          setOnboardingProfile(profile);
        }
      }).catch(() => {});

      apiService.getStyleProfile().then(async (styleProfile) => {
        const raw = String((styleProfile as { gender?: string } | null)?.gender || '').toLowerCase();
        if (!raw) return;
        const profile = await onboardingProfileService.getProfile();
        if (profile.quizGender) return;
        if (['man', 'male', 'men', 'm'].includes(raw)) {
          setOnboardingProfile(await onboardingProfileService.saveProfile({ quizGender: 'male' }));
        } else if (['woman', 'female', 'women', 'f'].includes(raw)) {
          setOnboardingProfile(await onboardingProfileService.saveProfile({ quizGender: 'female' }));
        }
      }).catch(() => {});

      const loadDFYAccess = async () => {
        if (user?.id) {
          const access = await dfyService.getDFYAccessStatus(user.id, user.subscriptionTier);
          setDfyAccess(access);
        }
      };
      loadDFYAccess();
      reloadWardrobe();

      apiService.getBackgroundReprocessStatus()
        .then((status) => {
          if (status.inProgress) {
            setIsReprocessingAll(true);
            setBatchBgProgress({
              processed: status.processed + status.failed,
              total: status.total,
              failed: status.failed,
            });
            startBgPolling();
          }
        })
        .catch(() => {});

      return () => stopBgPolling();
    }, [user?.id, user?.gender, startBgPolling, stopBgPolling, reloadWardrobe])
  );

  useEffect(() => {
    if (selectedCategory === 'dresses' && presentationGender === 'male') {
      setSelectedCategory('all');
    }
  }, [presentationGender, selectedCategory]);

  const handleAddItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AddWardrobeItem");
  };

  const handleQuickAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BulkWardrobeUpload");
  };

  const handleAICreateOutfit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (items.length < 3) {
      Alert.alert(
        t('wardrobe.moreItemsNeeded') || 'More Items Needed',
        t('wardrobe.addItemsMessage') || 'Add at least 3 items to your wardrobe for AI to create outfit combinations.',
        [{ text: translations.common.done }]
      );
      return;
    }
    // Always refresh DFY access status right before opening the modal
    if (user?.id) {
      try {
        const access = await dfyService.getDFYAccessStatus(user.id, user.subscriptionTier);
        setDfyAccess(access);
      } catch (_) {}
    }
    setShowAIOutfitModal(true);
  };

  const handleOccasionOutfitGenerate = async (occasionId: OutfitOccasionId) => {
    try {
      setIsGeneratingOutfit(true);
      setGeneratingOccasion(occasionId);
      const generated = await generateWardrobeOutfit({
        occasionType: occasionId,
        wardrobeItems: items,
        stylistId: user?.stylistPreferences?.selectedStylistId || 'ruby',
        saveToCalendar: true,
        calendarDate: new Date().toISOString().split('T')[0],
        user,
        onboardingProfile,
      });
      setGeneratedOutfit({
        items: generated.items,
        stylistMessage: generated.stylistMessage,
      });
      setGeneratedOutfitMeta({
        occasion: occasionId,
        title: getOccasionLabel(occasionId),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAIOutfitModal(false);
      setShowGeneratedOutfitModal(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to generate outfit. Please try again.';
      Alert.alert(t('common.generationFailed'), message);
    } finally {
      setIsGeneratingOutfit(false);
      setGeneratingOccasion(null);
    }
  };

  const handleItemPress = (item: WardrobeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const handleDeleteItem = async (item: WardrobeItem) => {
    Alert.alert(
      t('wardrobe.deleteItem') || 'Delete Item',
      t('wardrobe.deleteConfirm') || 'Are you sure you want to delete this item?',
      [
        { text: translations.common.cancel, style: "cancel" },
        {
          text: translations.common.done,
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItem(item.id);
              setShowItemModal(false);
              setSelectedItem(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert(translations.common.error, translations.common.error);
            }
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (item: WardrobeItem) => {
    try {
      await toggleItemFavorite(item.id);
      setSelectedItem({ ...item, isFavorite: !item.isFavorite });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const handleMarkWorn = async (item: WardrobeItem) => {
    try {
      const wearUpdate = applyWearIncrement(item, laundryProfileFromUser(user));
      await markItemWorn(item.id);
      setSelectedItem({ ...item, ...wearUpdate });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(translations.common.done, translations.wardrobe.markedAsWorn);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const handleMarkDirty = async (item: WardrobeItem) => {
    try {
      await markItemDirty(item.id);
      setSelectedItem({ ...item, isDirty: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const handleMarkClean = async (item: WardrobeItem) => {
    try {
      await markItemClean(item.id);
      setSelectedItem({ ...item, isDirty: false, wearCountSinceWash: 0 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const handleAdjustWearCount = async (item: WardrobeItem, delta: number) => {
    const newCount = Math.max(0, item.timesWorn + delta);
    if (newCount === item.timesWorn) return;
    
    try {
      await updateItem(item.id, { timesWorn: newCount });
      setSelectedItem({ ...item, timesWorn: newCount });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const handleReprocessBackground = async (item: WardrobeItem) => {
    setIsReprocessingBg(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await apiService.reprocessItemBackground(item.id);
      if (result.success) {
        if (result.alreadyProcessed) {
          Alert.alert(t('wardrobe.alreadyClean'), t('wardrobe.alreadyCleanMessage'));
        } else if (result.imageUrl) {
          await reloadWardrobe();
          setSelectedItem((prev) =>
            prev?.id === item.id
              ? { ...prev, imageUri: result.imageUrl!, enhancedImageUri: result.imageUrl!, imageProcessed: true }
              : prev
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t('common.done'), t('wardrobe.bgRemovedSuccess'));
        }
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('wardrobe.failedToRemoveBg'));
    } finally {
      setIsReprocessingBg(false);
    }
  };

  const handleReprocessAllBackgrounds = () => {
    Alert.alert(t('wardrobe.fixAllBackgrounds') || "Fix All Backgrounds", t('wardrobe.thisUploadsPhotosFromYourDeviceRemovesBa') || "This uploads photos from your device, removes backgrounds, and applies a white backdrop. It may take a few minutes for many items.",
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('wardrobe.fixAllBackgrounds') || "Fix All",
          onPress: async () => {
            setIsReprocessingAll(true);
            setBatchBgProgress({ processed: 0, total: items.length, failed: 0 });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const result = await fixBackgroundsFromCache((progress) => {
                setBatchBgProgress(progress);
              });
              setBatchBgProgress({
                processed: result.fixed + result.failed,
                total: result.fixed + result.failed + result.skipped,
                failed: result.failed,
              });
              await reloadWardrobe();
              if (result.fixed > 0) {
                const failedPart = result.failed > 0
                  ? ` ${result.failed} could not be processed (photo unreadable or AI service error).`
                  : '';
                const noLocalPart = result.noLocal > 0
                  ? ` ${result.noLocal} skipped — no photo on this device.`
                  : '';
                Alert.alert(
                  t('wardrobe.backgroundsUpdated'),
                  t('wardrobe.backgroundsUpdatedMessage')
                    .replace('{fixed}', String(result.fixed))
                    .replace('{failedPart}', failedPart)
                    .replace('{noLocalPart}', noLocalPart)
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else if (result.failed > 0) {
                Alert.alert(t('wardrobe.backgroundRemovalUnavailable') || "Background removal unavailable", t('wardrobe.couldNotRemoveBackgroundsTheServerMayNee') || "Could not remove backgrounds. The server may need Replicate configured — try again later or contact support."
                );
              } else if (result.noLocal > 0 || (result.fixed === 0 && result.failed === 0)) {
                Alert.alert(
                  t('wardrobe.photosNeedReadd'),
                  t('wardrobe.photosNeedReaddMessage').replace('{count}', String(result.noLocal))
                );
              } else {
                Alert.alert(t('common.done'), t('wardrobe.allBgProcessed'));
              }
            } catch (error) {
              Alert.alert(t('common.error'), t('wardrobe.failedToProcessBg'));
            } finally {
              setIsReprocessingAll(false);
              setBatchBgProgress(null);
            }
          },
        },
      ]
    );
  };

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleItemSelection = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    const visibleIds = filteredItems.map((item) => String(item.id));
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [filteredItems]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    Alert.alert(
      t('wardrobe.deleteItems'),
      t('wardrobe.deleteItemsConfirm').replace('{count}', String(ids.length)),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsBulkDeleting(true);
            try {
              await deleteItems(ids);
              exitSelectionMode();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert(t('common.error'), t('wardrobe.failedToDeleteItems'));
            } finally {
              setIsBulkDeleting(false);
            }
          },
        },
      ]
    );
  }, [selectedIds, deleteItems, exitSelectionMode]);

  const renderCategoryTab = useCallback(({ item }: { item: typeof CATEGORY_OPTIONS[0] }) => {
    const isSelected = selectedCategory === item.key;
    const colors = CATEGORY_COLORS[item.key] || CATEGORY_COLORS['all'];
    
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedCategory(item.key);
        }}
        style={styles.categoryTabWrapper}
      >
        {isSelected ? (
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.categoryTab}
          >
            {item.iconSet === 'material' ? (
              <MaterialCommunityIcons name={item.icon as any} size={14} color="#FFFFFF" />
            ) : (
              <Feather name={item.icon as any} size={14} color="#FFFFFF" />
            )}
            <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              {item.label} ({categoryCounts[item.key] ?? 0})
            </ThemedText>
          </LinearGradient>
        ) : (
          <View style={[styles.categoryTab, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            {item.iconSet === 'material' ? (
              <MaterialCommunityIcons name={item.icon as any} size={14} color={theme.tabIconDefault} />
            ) : (
              <Feather name={item.icon as any} size={14} color={theme.tabIconDefault} />
            )}
            <ThemedText type="caption">
              {item.label} ({categoryCounts[item.key] ?? 0})
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  }, [selectedCategory, theme, isDark, categoryCounts]);

  const renderQuickActionsBar = useCallback(() => (
    <View style={styles.quickActionsBar}>
      <Pressable
        onPress={handleAICreateOutfit}
        style={({ pressed }) => [styles.quickActionChip, pressed && { opacity: 0.85 }]}
      >
        <Feather name="zap" size={15} color="#FFFFFF" />
        <ThemedText type="caption" style={styles.quickActionLabel} numberOfLines={1}>
          {t('wardrobe.aiOutfit') || 'AI Outfit'}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate('OutfitBuilder');
        }}
        style={({ pressed }) => [styles.quickActionChip, pressed && { opacity: 0.85 }]}
      >
        <Feather name="shuffle" size={15} color="#FFFFFF" />
        <ThemedText type="caption" style={styles.quickActionLabel} numberOfLines={1}>
          {t('wardrobe.outfitMix') || 'Outfit Mix'}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={handleQuickAdd}
        style={({ pressed }) => [styles.quickActionChip, pressed && { opacity: 0.85 }]}
      >
        <Feather name="layers" size={15} color="#FFFFFF" />
        <ThemedText type="caption" style={styles.quickActionLabel} numberOfLines={1}>
          {t('wardrobe.bulkAdd') || 'Bulk Add'}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={handleAddItem}
        style={({ pressed }) => [styles.quickActionChip, styles.quickActionChipPrimary, pressed && { opacity: 0.9 }]}
      >
        <Feather name="plus" size={15} color={LUXURY_COLORS.midnight} />
        <ThemedText type="caption" style={[styles.quickActionLabel, styles.quickActionLabelPrimary]} numberOfLines={1}>
          {t('wardrobe.addItem') || 'Add Item'}
        </ThemedText>
      </Pressable>
    </View>
  ), [handleAICreateOutfit, handleQuickAdd, handleAddItem, navigation, LUXURY_COLORS.midnight, t]);

  const renderWardrobeItem = useCallback(({ item }: { item: WardrobeItem }) => {
    const hasProcessedImage = item.imageProcessed === true;
    const categoryColors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['all'];
    const tileBackground = hasProcessedImage
      ? wardrobeProcessedTileBackground()
      : wardrobeTileBackground(isDark);
    const isSelected = selectedIds.has(String(item.id));
    
    return (
      <Pressable
        onPress={() => {
          if (selectionMode) {
            toggleItemSelection(String(item.id));
          } else {
            handleItemPress(item);
          }
        }}
        onLongPress={() => {
          if (!selectionMode) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSelectionMode(true);
            setSelectedIds(new Set([String(item.id)]));
          }
        }}
        style={({ pressed }) => [
          styles.itemCard,
          {
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            borderWidth: selectionMode && isSelected ? 3 : 0,
            borderColor: selectionMode && isSelected ? LUXURY_COLORS.gold : 'transparent',
          },
        ]}
      >
        <View style={[styles.itemImageWrapper, { backgroundColor: tileBackground }]}>
          <WardrobeItemImage
            item={item}
            style={styles.itemImage}
            processed={hasProcessedImage}
            preferCover={!hasProcessedImage}
            showLoading
            transition={280}
            tileBackgroundColor={tileBackground}
          />
          {selectionMode ? (
            <View style={[styles.selectionBadge, isSelected ? styles.selectionBadgeActive : null]}>
              {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
            </View>
          ) : null}
          {item.isFavorite ? (
            <LinearGradient
              colors={[LUXURY_COLORS.rose, LUXURY_COLORS.coral]}
              style={styles.favoriteIndicator}
            >
              <Feather name="heart" size={10} color="#FFFFFF" />
            </LinearGradient>
          ) : null}
          <View style={styles.categoryIndicator}>
            <LinearGradient
              colors={categoryColors.gradient}
              style={styles.categoryDot}
            />
          </View>
        </View>
        <View style={styles.itemMeta}>
          <ThemedText type="small" numberOfLines={2} style={styles.itemNameBelow}>
            {item.name}
          </ThemedText>
          <ThemedText type="caption" style={styles.itemWornBelow}>
            {(() => {
              const template = t('wardrobe.wornTimes') || 'Worn {n}x';
              if (template.includes('{n}')) {
                return template.replace('{n}', String(item.timesWorn));
              }
              // Stale/incomplete copy like bare "times" — restore clear "Worn N" label
              return `Worn ${item.timesWorn}`;
            })()}
          </ThemedText>
        </View>
      </Pressable>
    );
  }, [theme, isDark, selectionMode, selectedIds, toggleItemSelection, handleItemPress, CATEGORY_COLORS, LUXURY_COLORS.gold, t]);

  const renderEmptyCategoryState = () => {
    const categoryLabel = CATEGORY_OPTIONS.find(c => c.key === selectedCategory)?.label || selectedCategory;
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={[LUXURY_COLORS.violet + '30', LUXURY_COLORS.rose + '20']}
          style={styles.emptyIconContainer}
        >
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            style={styles.emptyIconGradient}
          >
            <Feather name="folder" size={32} color="#FFFFFF" />
          </LinearGradient>
        </LinearGradient>
        <ThemedText type="h2" style={styles.emptyTitle}>
          No {categoryLabel} yet
        </ThemedText>
        <ThemedText type="body" style={styles.emptyText}>
          Add some {categoryLabel.toLowerCase()} to your wardrobe to see them here
        </ThemedText>
        <LinearGradient
          colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyButtonGradient}
        >
          <Pressable onPress={handleAddItem} style={styles.emptyButtonInner}>
            <Feather name="plus" size={18} color={LUXURY_COLORS.midnight} />
            <ThemedText type="body" style={styles.emptyButtonText}>
              Add {categoryLabel}
            </ThemedText>
          </Pressable>
        </LinearGradient>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient
        colors={[LUXURY_COLORS.violet + '30', LUXURY_COLORS.rose + '20']}
        style={styles.emptyIconContainer}
      >
        <LinearGradient
          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          style={styles.emptyIconGradient}
        >
          <Feather name="inbox" size={32} color="#FFFFFF" />
        </LinearGradient>
      </LinearGradient>
      <ThemedText type="h2" style={styles.emptyTitle}>
        {t('wardrobe.wardrobeAwaits') || 'Your wardrobe awaits'}
      </ThemedText>
      <ThemedText type="body" style={styles.emptyText}>
        {t('wardrobe.wardrobeAwaitsDesc') || 'Start building your digital closet by adding photos of your favourite pieces'}
      </ThemedText>
      <LinearGradient
        colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.emptyButtonGradient}
      >
        <Pressable onPress={handleQuickAdd} style={styles.emptyButtonInner}>
          <Feather name="layers" size={18} color={LUXURY_COLORS.midnight} />
          <ThemedText type="body" style={styles.emptyButtonText}>
            {t('wardrobe.quickAddMultiple') || 'Bulk Add Items'}
          </ThemedText>
        </Pressable>
      </LinearGradient>
      <Pressable
        onPress={handleAddItem}
        style={[styles.emptyButtonSecondary, { borderColor: LUXURY_COLORS.gold }]}
      >
        <Feather name="plus" size={18} color={LUXURY_COLORS.gold} />
        <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: LUXURY_COLORS.gold }}>
          {t('wardrobe.addSingleItem') || 'Add Single Item'}
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderListEmptyComponent = () => {
    if (items.length > 0 && selectedCategory !== 'all') {
      return renderEmptyCategoryState();
    }
    return renderEmptyState();
  };

  const renderItemModal = () => {
    if (!selectedItem) return null;
    const categoryColors = CATEGORY_COLORS[selectedItem.category] || CATEGORY_COLORS['all'];
    
    return (
      <Modal
        visible={showItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <LinearGradient
            colors={isDark 
              ? [categoryColors.gradient[0] + '40', 'transparent'] 
              : [categoryColors.gradient[0] + '20', 'transparent']
            }
            style={styles.modalHeaderGradient}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                onPress={() => setShowItemModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">{t('wardrobe.itemDetails')}</ThemedText>
              <Pressable
                onPress={() => handleToggleFavorite(selectedItem)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather
                  name="heart"
                  size={24}
                  color={selectedItem.isFavorite ? LUXURY_COLORS.coral : theme.tabIconDefault}
                />
              </Pressable>
            </View>
          </LinearGradient>

          <FlatList
            data={[selectedItem]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <>
                <View style={[
                  styles.modalImageWrapper,
                  {
                    backgroundColor: selectedItem.imageProcessed || selectedItem.aiAnalyzed
                      ? wardrobeProcessedTileBackground()
                      : wardrobeTileBackground(isDark),
                  },
                ]}>
                  <WardrobeItemImage
                    item={selectedItem}
                    style={styles.modalImage}
                    processed={!!(selectedItem.imageProcessed || selectedItem.aiAnalyzed)}
                    preferCover={!(selectedItem.imageProcessed || selectedItem.aiAnalyzed)}
                    transition={300}
                    tileBackgroundColor={
                      selectedItem.imageProcessed || selectedItem.aiAnalyzed
                        ? wardrobeProcessedTileBackground()
                        : wardrobeTileBackground(isDark)
                    }
                  />
                </View>

                <View style={styles.modalInfo}>
                  <ThemedText type="h2" style={styles.modalItemName}>
                    {selectedItem.name}
                  </ThemedText>

                  <View style={styles.modalTags}>
                    <LinearGradient
                      colors={categoryColors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalTagGradient}
                    >
                      <Feather name="tag" size={12} color="#FFFFFF" />
                      <ThemedText type="caption" style={{ color: '#FFFFFF' }}>{CATEGORY_LABELS[selectedItem.category]}</ThemedText>
                    </LinearGradient>
                    <View style={[styles.modalTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                      <View style={[styles.colorDot, { backgroundColor: getColorHex(selectedItem.color) }]} />
                      <ThemedText type="caption">{selectedItem.color}</ThemedText>
                    </View>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                          style={styles.statIconContainer}
                        >
                          <Feather name="repeat" size={14} color="#FFFFFF" />
                        </LinearGradient>
                        <View style={styles.wearCountContainer}>
                          <Pressable
                            onPress={() => handleAdjustWearCount(selectedItem, -1)}
                            disabled={selectedItem.timesWorn === 0}
                            style={[
                              styles.wearCountButton,
                              { 
                                backgroundColor: selectedItem.timesWorn === 0 
                                  ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                                  : LUXURY_COLORS.coral + '20',
                                opacity: selectedItem.timesWorn === 0 ? 0.5 : 1,
                              }
                            ]}
                          >
                            <Feather 
                              name="minus" 
                              size={16} 
                              color={selectedItem.timesWorn === 0 ? (isDark ? '#666' : '#999') : LUXURY_COLORS.coral} 
                            />
                          </Pressable>
                          <ThemedText type="h3" style={{ minWidth: 30, textAlign: 'center' }}>
                            {selectedItem.timesWorn}
                          </ThemedText>
                          <Pressable
                            onPress={() => handleAdjustWearCount(selectedItem, 1)}
                            style={[
                              styles.wearCountButton,
                              { backgroundColor: LUXURY_COLORS.teal + '20' }
                            ]}
                          >
                            <Feather name="plus" size={16} color={LUXURY_COLORS.teal} />
                          </Pressable>
                        </View>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>{t('wardrobe.timesWorn')}</ThemedText>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                      <View style={styles.statItem}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.coral, '#C46A4F']}
                          style={styles.statIconContainer}
                        >
                          <Feather name="calendar" size={14} color="#FFFFFF" />
                        </LinearGradient>
                        <ThemedText type="h3">
                          {selectedItem.lastWorn 
                            ? new Date(selectedItem.lastWorn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : (t('wardrobe.never') || 'Never')
                        }
                      </ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>{t('wardrobe.lastWorn') || 'Last worn'}</ThemedText>
                      </View>
                    </View>
                  </View>

                  {selectedItem.isDirty ? (
                    <View style={[styles.detailRow, { marginBottom: Spacing.sm }]}>
                      <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.coral + '25' }]}>
                        <Feather name="alert-circle" size={16} color={LUXURY_COLORS.coral} />
                      </View>
                      <ThemedText type="body" style={{ color: LUXURY_COLORS.coral }}>
                        {t('wardrobe.needsLaundry') || 'Needs laundry'}
                      </ThemedText>
                    </View>
                  ) : null}

                  {selectedItem.brand ? (
                    <View style={styles.detailRow}>
                      <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.gold + '20' }]}>
                        <Feather name="award" size={16} color={LUXURY_COLORS.gold} />
                      </View>
                      <ThemedText type="body">{selectedItem.brand}</ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.coral + '20' }]}>
                      <Feather
                        name={getSeasonDetailIcon(selectedItem.seasons)}
                        size={16}
                        color={LUXURY_COLORS.coral}
                      />
                    </View>
                    <ThemedText type="body">
                      {formatSeasonDetailLabel(selectedItem.seasons)}
                    </ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.violet + '20' }]}>
                      <Feather name="calendar" size={16} color={LUXURY_COLORS.violet} />
                    </View>
                    <ThemedText type="body">
                      {selectedItem.occasions.map(o => o.charAt(0).toUpperCase() + o.slice(1).replace("-", " ")).join(", ")}
                    </ThemedText>
                  </View>

                  {selectedItem.notes ? (
                    <View style={[styles.notesSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                      <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 4 }}>Notes</ThemedText>
                      <ThemedText type="body">{selectedItem.notes}</ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.xl }]}>
                  <LinearGradient
                    colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButtonGradient}
                  >
                    <Pressable
                      onPress={() => handleMarkWorn(selectedItem)}
                      style={styles.actionButtonInner}
                    >
                      <Feather name="check-circle" size={18} color="#FFFFFF" />
                      <ThemedText type="body" style={styles.actionButtonText}>
                        {t('wardrobe.logWear') || 'Log Wear'}
                      </ThemedText>
                    </Pressable>
                  </LinearGradient>

                  {selectedItem.isDirty ? (
                    <Pressable
                      onPress={() => handleMarkClean(selectedItem)}
                      style={[styles.secondaryActionButton, { borderColor: LUXURY_COLORS.teal + '60' }]}
                    >
                      <Feather name="droplet" size={18} color={LUXURY_COLORS.teal} />
                      <ThemedText type="body" style={{ color: LUXURY_COLORS.teal }}>
                        {t('wardrobe.markClean') || 'Mark Clean'}
                      </ThemedText>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleMarkDirty(selectedItem)}
                      style={[styles.secondaryActionButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
                    >
                      <Feather name="cloud-off" size={18} color={theme.text} />
                      <ThemedText type="body">{t('wardrobe.markDirty') || 'Mark Dirty'}</ThemedText>
                    </Pressable>
                  )}

                  {selectedItem.imageUri && !isProxyWardrobeImageUri(selectedItem.imageUri) && !isDurableWardrobeCdnUrl(selectedItem.imageUri) ? (
                    <Pressable
                      onPress={() => handleReprocessBackground(selectedItem)}
                      disabled={isReprocessingBg}
                      style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs }]}
                    >
                      {isReprocessingBg ? (
                        <ActivityIndicator size="small" color={theme.textSecondary} />
                      ) : (
                        <Feather name="scissors" size={18} color={theme.textSecondary} />
                      )}
                      <ThemedText type="body" style={{ color: theme.textSecondary, fontWeight: '600' }}>
                        {isReprocessingBg
                          ? (t('wardrobe.fixing') || 'Fixing...')
                          : (t('wardrobe.fixBackground') || 'Fix Background')}
                      </ThemedText>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => handleDeleteItem(selectedItem)}
                    style={[styles.actionButton, styles.deleteButton]}
                  >
                    <Feather name="trash-2" size={18} color="#FF3B30" />
                    <ThemedText type="body" style={{ color: "#FF3B30", fontWeight: '600' }}>
                      {t('wardrobe.deleteItem') || 'Delete'}
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          />
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          style={styles.loadingIconContainer}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="body" style={{ marginTop: Spacing.lg }}>
          {t('wardrobe.loadingWardrobe')}
        </ThemedText>
      </View>
    );
  }

  const headerGradientColors: readonly [string, string, string] = colorScheme === 'minimalist' 
    ? ['#C9A87C', '#A88B5C', '#3D3426'] as const
    : [ScreenGradients.wardrobe.primary[0], ScreenGradients.wardrobe.primary[1], LuxuryColors.obsidian] as const;

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <LinearGradient
        colors={headerGradientColors}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          {selectionMode ? (
            <>
              <Pressable
                onPress={exitSelectionMode}
                style={styles.headerTextButton}
              >
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('wardrobe.cancel') || 'Cancel'}</ThemedText>
              </Pressable>
              <View style={styles.headerTitleContainer}>
                <ThemedText type="h3" style={{ color: '#FFFFFF' }}>
                  {(t('wardrobe.selectedCount') || '{count} Selected').replace('{count}', String(selectedIds.size))}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleBulkDelete}
                disabled={selectedIds.size === 0 || isBulkDeleting}
                style={[styles.headerTextButton, selectedIds.size === 0 ? { opacity: 0.45 } : null]}
              >
                {isBulkDeleting ? (
                  <ActivityIndicator size="small" color="#FF8A8A" />
                ) : (
                  <ThemedText type="body" style={{ color: '#FF8A8A', fontWeight: '700' }}>{t('wardrobe.delete') || 'Delete'}</ThemedText>
                )}
              </Pressable>
            </>
          ) : (
            <>
          <View style={styles.headerSideSlot} />
          <View style={styles.headerTitleContainer}>
            <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('wardrobe.myWardrobe')}</ThemedText>
            <View style={[styles.itemCountBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {items.length} {items.length === 1 ? (t('wardrobe.piece') || 'piece') : (t('wardrobe.pieces') || 'pieces')}
              </ThemedText>
            </View>
          </View>
          <View style={styles.headerActions}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectionMode(true);
                  }}
                  style={[styles.headerActionButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                >
                  <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('wardrobe.select') || 'Select'}</ThemedText>
                </Pressable>
          </View>
            </>
          )}
        </View>

        {selectionMode ? (
          <View style={styles.selectionHeaderActions}>
            <Pressable onPress={toggleSelectAllVisible} style={styles.selectAllChip}>
              <Feather name="check-square" size={16} color="#FFFFFF" />
              <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: Spacing.xs }}>
                {filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(String(item.id)))
                  ? (t('wardrobe.deselectAll') || 'Deselect All')
                  : (t('wardrobe.selectAll') || 'Select All')}
              </ThemedText>
            </Pressable>
            <View style={styles.selectionUtilityActions}>
              <Pressable
                onPress={handleRefresh}
                disabled={isRefreshing}
                style={[styles.utilityIconButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="refresh-cw" size={18} color="#FFFFFF" />
                )}
              </Pressable>
              <Pressable
                onPress={handleReprocessAllBackgrounds}
                disabled={isReprocessingAll}
                style={[styles.utilityIconButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              >
                {isReprocessingAll ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="scissors" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          renderQuickActionsBar()
        )}

        {(batchBgProgress && isReprocessingAll) || backgroundRemovalProgress?.active ? (
          <View style={[styles.batchProgressBanner, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: Spacing.sm }}>
              Removing backgrounds{' '}
              {backgroundRemovalProgress?.active
                ? `${backgroundRemovalProgress.processed}/${backgroundRemovalProgress.total}`
                : `${batchBgProgress?.processed ?? 0}/${batchBgProgress?.total ?? 0}`}
              {(backgroundRemovalProgress?.failed || batchBgProgress?.failed || 0) > 0
                ? ` (${backgroundRemovalProgress?.failed ?? batchBgProgress?.failed ?? 0} failed)`
                : ''}
            </ThemedText>
          </View>
        ) : null}

        <FlatList
          data={CATEGORY_OPTIONS}
          renderItem={renderCategoryTab}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
          contentContainerStyle={styles.categoryTabsContent}
        />

        {dfyAccess?.hasAccess && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dfyCardsScroll}
            contentContainerStyle={styles.dfyCardsContent}
          >
            {dfyAccess.tier === 'lite' ? (
              <>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYLookbook');
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.coral, '#C46A4F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="book-open" size={20} color="#FFFFFF" />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                        {t('wardrobe.myLookbook')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {(t('wardrobe.daysLeft') || '{n}d left').replace('{n}', String(dfyAccess.daysRemaining))}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYCalendar', { tier: 'lite' });
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="calendar" size={20} color="#FFFFFF" />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                        {t('wardrobe.calendar14Day')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {t('wardrobe.dailyOutfits') || 'Daily outfits'}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYModularWardrobe');
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="grid" size={20} color={LUXURY_COLORS.midnight} />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: LUXURY_COLORS.midnight, fontWeight: '700' }}>
                        {t('wardrobe.modularWardrobe')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(0,0,0,0.6)' }}>
                        {t('wardrobe.mixAndMatch') || 'Mix & match'}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(0,0,0,0.4)" />
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYCalendar', { tier: 'core' });
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="calendar" size={20} color="#FFFFFF" />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                        {t('wardrobe.calendar30Day')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {(t('wardrobe.daysLeft') || '{n}d left').replace('{n}', String(dfyAccess.daysRemaining))}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderWardrobeItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.gridContent,
          {
            paddingBottom:
              insets.bottom +
              TAB_BAR_HEIGHT +
              Spacing.xl +
              (selectionMode ? 88 : 0),
          },
        ]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={isDark ? '#FFFFFF' : LUXURY_COLORS.violet}
            colors={[LUXURY_COLORS.violet]}
            progressBackgroundColor={isDark ? LUXURY_COLORS.midnight : '#FFFFFF'}
          />
        }
        ListEmptyComponent={renderListEmptyComponent}
        ListHeaderComponent={
          wardrobePhotosUnavailable && filteredItems.length > 0 ? (
            <View style={[styles.photoRepairBanner, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              <Feather name="alert-circle" size={18} color={isDark ? '#F5C16C' : '#B45309'} />
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: '700', marginBottom: 4 }}>
                  Photos missing
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.75, lineHeight: 18 }}>
                  Photos in your iPhone gallery are separate from Dripn. If originals were cleared from app storage, tap an item and re-attach its photo — or use + to add again.
                </ThemedText>
              </View>
            </View>
          ) : null
        }
      />

      {selectionMode ? (
        <View
          style={[
            styles.selectionToolbar,
            {
              bottom: TAB_BAR_HEIGHT + insets.bottom,
              paddingBottom: Spacing.md,
              backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF',
            },
          ]}
        >
          <View>
            <ThemedText type="body" style={{ fontWeight: '700' }}>
              {(t('wardrobe.selectedCount') || '{count} Selected').replace('{count}', String(selectedIds.size))}
            </ThemedText>
          </View>
          <Pressable
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0 || isBulkDeleting}
            style={[styles.selectionDeleteButton, selectedIds.size === 0 ? { opacity: 0.4 } : null]}
          >
            {isBulkDeleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="trash-2" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: Spacing.sm }}>
                  {(t('wardrobe.deleteCount') || 'Delete ({n})').replace('{n}', String(selectedIds.size))}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {renderItemModal()}

      <Modal
        visible={showAIOutfitModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIOutfitModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <LinearGradient
            colors={isDark 
              ? [LUXURY_COLORS.coral + '40', 'transparent'] 
              : [LUXURY_COLORS.coral + '20', 'transparent']
            }
            style={styles.modalHeaderGradient}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                onPress={() => setShowAIOutfitModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">{t('wardrobe.aiOutfitCreator')}</ThemedText>
              <View style={{ width: 40 }} />
            </View>
          </LinearGradient>

          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ padding: Spacing.xl }}
          >
            <View style={styles.aiOutfitHeader}>
              <LinearGradient
                colors={[LUXURY_COLORS.coral, '#C46A4F']}
                style={styles.aiOutfitIconContainer}
              >
                <Feather name="zap" size={32} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="h2" style={{ textAlign: 'center', marginTop: Spacing.lg }}>
                Create Outfits from Your Wardrobe
              </ThemedText>
              <ThemedText type="body" style={{ textAlign: 'center', color: theme.tabIconDefault, marginTop: Spacing.sm }}>
                AI will combine your {items.length} items into stylish outfits based on your Style DNA
              </ThemedText>
            </View>

            {dfyAccess?.hasAccess ? (
              <View style={[styles.dfyStatusCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <View style={styles.dfyStatusHeader}>
                  <LinearGradient
                    colors={[LUXURY_COLORS.emerald, LUXURY_COLORS.teal]}
                    style={styles.dfyStatusBadge}
                  >
                    <Feather name="check" size={14} color="#FFFFFF" />
                  </LinearGradient>
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: '600' }}>
                    {dfyAccess.tier === 'core'
                      ? (t('wardrobe.fullWardrobeSetup') || 'Full Wardrobe Setup')
                      : (t('wardrobe.occasionReady') || 'Travel Capsule')}{' '}
                    {t('wardrobe.active') || 'Active'}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, marginTop: Spacing.xs }}>
                  {dfyAccess.tier === 'core' 
                    ? 'Dynamic outfit generation with remix capability' 
                    : '3-5 core outfits for your chosen occasion'}
                </ThemedText>
              </View>
            ) : (
              <Pressable 
                onPress={() => {
                  setShowAIOutfitModal(false);
                  navigateToSubscription(navigation, { scrollToDFY: true });
                }}
                style={[styles.dfyPromptCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              >
                <View style={styles.dfyPromptContent}>
                  <Feather name="gift" size={24} color={LUXURY_COLORS.coral} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>{t('wardrobe.unlockDFY')}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                      Get professionally curated outfits from £19.99
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
                </View>
              </Pressable>
            )}

            <OccasionPickerList
              generatingOccasionId={generatingOccasion}
              disabled={isGeneratingOutfit}
              onWeatherPress={() => {
                setShowAIOutfitModal(false);
                navigation.navigate('WeatherOutfit');
              }}
              onSelect={handleOccasionOutfitGenerate}
            />

            <View style={styles.styleDNASection}>
              <ThemedText type="small" style={{ color: theme.tabIconDefault, textAlign: 'center' }}>
                Outfits are personalized using your Style DNA
              </ThemedText>
              <View style={styles.styleDNATags}>
                {user?.gender && (
                  <View style={[styles.styleDNATag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption">{user.gender}</ThemedText>
                  </View>
                )}
                {user?.stylePreference && (
                  <View style={[styles.styleDNATag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption">{user.stylePreference}</ThemedText>
                  </View>
                )}
                {user?.bodyShape && (
                  <View style={[styles.styleDNATag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption">{user.bodyShape}</ThemedText>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <GeneratedOutfitModal
        visible={showGeneratedOutfitModal}
        outfit={generatedOutfit}
        occasion={generatedOutfitMeta?.occasion || 'custom'}
        defaultTitle={generatedOutfitMeta?.title || 'My Outfit'}
        onClose={() => setShowGeneratedOutfitModal(false)}
      />
    </View>
  );
}

function getColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    black: '#000000',
    white: '#FFFFFF',
    gray: '#808080',
    navy: '#001F3F',
    brown: '#8B4513',
    beige: '#F5F5DC',
    red: '#FF0000',
    pink: '#FFC0CB',
    orange: '#FFA500',
    yellow: '#FFFF00',
    green: '#008000',
    blue: '#0000FF',
    purple: '#800080',
    multicolor: '#FF69B4',
  };
  return colorMap[color] || '#808080';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGradient: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerSideSlot: {
    minWidth: 72,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 72,
    justifyContent: 'flex-end',
  },
  batchProgressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  headerTitleContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  itemCountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  headerActionButton: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTabs: {
    marginBottom: Spacing.sm,
  },
  categoryTabsContent: {
    gap: Spacing.sm,
  },
  categoryTabWrapper: {},
  dfyCardsScroll: {
    marginTop: Spacing.sm,
    marginHorizontal: -Spacing.xl,
  },
  dfyCardsContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  dfyCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  dfyCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  dfyCardText: {
    flex: 1,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  gridContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  photoRepairBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  itemCard: {
    width: ITEM_WIDTH,
    borderRadius: BorderRadius.lg,
  },
  selectionBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  selectionBadgeActive: {
    backgroundColor: '#C9A87C',
    borderColor: '#FFFFFF',
  },
  headerTextButton: {
    minWidth: 64,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  selectionUtilityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  utilityIconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  quickActionChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    minHeight: 52,
  },
  quickActionChipPrimary: {
    backgroundColor: '#F5E6D3',
  },
  quickActionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 10,
    textAlign: 'center',
  },
  quickActionLabelPrimary: {
    color: LuxuryColors.midnight,
  },
  selectAllChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  selectionToolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
    elevation: 12,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  selectionDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E05252',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  itemImageWrapper: {
    width: '100%',
    height: ITEM_HEIGHT,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemMeta: {
    paddingTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    minHeight: 42,
  },
  itemNameBelow: {
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 18,
  },
  itemWornBelow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  favoriteIndicator: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["5xl"],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  emptyButtonGradient: {
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  emptyButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
  },
  emptyButtonText: {
    color: '#1A1A2E',
    fontWeight: "700",
  },
  emptyButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  fabContainer: {
    position: "absolute",
    right: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#C9A87C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeaderGradient: {
    paddingBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: Spacing.xl,
  },
  modalImageWrapper: {
    width: "100%",
    height: SCREEN_WIDTH - Spacing.xl * 2,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalInfo: {
    marginTop: Spacing.xl,
  },
  modalItemName: {
    marginBottom: Spacing.md,
  },
  modalTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modalTagGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  modalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statDivider: {
    width: 1,
    height: 60,
    marginHorizontal: Spacing.lg,
  },
  wearCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wearCountButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSection: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  modalActions: {
    flexDirection: "column",
    gap: Spacing.sm,
    marginTop: Spacing["2xl"],
    paddingBottom: Spacing.md,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  actionButtonGradient: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    minHeight: 52,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
  aiOutfitHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  aiOutfitIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dfyStatusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  dfyStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dfyStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dfyPromptCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  dfyPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiOutfitOptions: {
    marginBottom: Spacing.xl,
  },
  aiOutfitOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  aiOutfitOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleDNASection: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  styleDNATags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  styleDNATag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  outfitModalContent: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingTop: Spacing.lg,
  },
  outfitModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  outfitItemsScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  outfitItemsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  generatedOutfitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  generatedOutfitItemImageWrap: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  generatedOutfitItemImage: {
    width: '100%',
    height: '100%',
  },
  generatedOutfitItemInfo: {
    flex: 1,
  },
  outfitStylistMessage: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  outfitModalFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  outfitModalButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: LuxuryColors.violet,
    alignItems: 'center',
  },
});
