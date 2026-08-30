import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { AiAllowanceBlockedBanner } from '@/components/AiAllowanceBlockedBanner';
import { GeneratedOutfitModal, type GeneratedOutfitModalData } from '@/components/outfit/GeneratedOutfitModal';
import { OccasionPickerList } from '@/components/outfit/OccasionPickerList';
import { DuplicateComparisonSheet } from '@/components/wardrobe/DuplicateComparisonSheet';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import {
  CATEGORY_LABELS,
  ClothingCategory,
  useWardrobe,
  type WardrobeItem,
} from '@/contexts/WardrobeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import type { WardrobeStackParamList } from '@/navigation/WardrobeStackNavigator';
import { apiService } from '@/services/ApiService';
import { navigateToSubscription } from '@/utils/navigateToSubscription';
import {
  aiAllowanceSubscriptionParams,
  getAiAllowancePaywallCopy,
  isAiBudgetError,
} from '@/utils/aiBudgetError';
import { planTierFromBudgetError } from '@/components/live/LiveAiBudgetModal';
import { getTodaysOutfitPopupPrefs } from '@/utils/todaysOutfitPrefs';
import { normalizeWorkDressCode, resolveStoredWorkDressCode } from '@/services/OnboardingProfileService';
import { resolveBrandInspiration } from '@/utils/yoloToPipelineCandidates';
import { onboardingProfileService } from '@/services/OnboardingProfileService';
import { convertImageToBase64 } from '@/services/VisionAnalysisService';
import { fetchWeatherSnapshot } from '@/services/TodaysOutfitGenerator';
import type { ScanSessionItem, ScanWardrobeStep, ScanOutfitOption } from '@/types/scanWardrobe';
import { hydrateGeneratedOutfitItems } from '@/utils/hydrateGeneratedOutfitItems';
import { materializeWardrobeItemImages } from '@/utils/scanCropCache';
import {
  clearGetOutfitsSession,
  loadGetOutfitsSession,
  saveGetOutfitsSession,
} from '@/utils/getOutfitsSessionStore';
import { humanizeStylistMessage } from '@/utils/humanizeStylistMessage';
import {
  buildLookContinuity,
  saveLastDecisionContinuity,
} from '@/utils/decisionContinuity';
import {
  decisionFromLocalMatches,
  findLocalWardrobeDuplicates,
  normalizeDuplicateDecision,
  overrideIdsFromMatches,
  scanItemDedupeBind,
  type NormalizedDuplicateDecision,
} from '@/utils/wardrobeDuplicateMatch';
import {
  correctWardrobeImageOrientation,
  promptWardrobeOrientationReview,
} from '@/utils/wardrobeImageOrientation';
import { getManualAddCategoryTabs, resolveUserPresentationGender } from '@/utils/wardrobeCategories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, 'ScanWardrobe'>;
};

function sessionItemToWardrobeItem(item: ScanSessionItem): WardrobeItem {
  const imageUri = item.sceneCrop ? `data:image/jpeg;base64,${item.sceneCrop}` : '';
  // Athletic quarter-zips / athletic pullovers / overshirts are mid-layers over a base top.
  const midLayer = /\b(quarter[\s_-]?zip|half[\s_-]?zip|athletic[\s_-]?pullover|overshirt|shacket)\b/i.test(
    `${item.name || ''} ${item.subcategory || ''}`,
  )
    || (/\b(hoodie|hooded)\b/i.test(`${item.name || ''} ${item.subcategory || ''}`)
      && /\b(zip|athletic|tech)\b/i.test(`${item.name || ''} ${item.subcategory || ''}`));
  return {
    id: item.tempId,
    userId: '',
    imageUri,
    enhancedImageUri: imageUri || undefined,
    imageProcessed: Boolean(imageUri),
    category: (midLayer ? 'outerwear' : item.category || 'tops') as ClothingCategory,
    subcategory: item.subcategory || undefined,
    color: (item.color as WardrobeItem['color']) || 'multicolor',
    brand: item.brand || undefined,
    name: item.name,
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
  };
}

function sessionItemToDupeCandidate(item: ScanSessionItem, scanSessionId?: string | null) {
  return {
    ...sessionItemToWardrobeItem(item),
    ...scanItemDedupeBind(item, scanSessionId),
  };
}

export default function ScanWardrobeScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const tabBarHeightContext = useContext(BottomTabBarHeightContext);
  const TAB_BAR_HEIGHT = 56;
  const tabBarHeight =
    typeof tabBarHeightContext === 'number' && tabBarHeightContext > 0
      ? tabBarHeightContext
      : TAB_BAR_HEIGHT + insets.bottom;
  const { user } = useAuth();
  const { items: savedWardrobe, addItemsBatch } = useWardrobe();

  const persistLookContinuity = useCallback(async (
    lookItems: WardrobeItem[],
    summary?: string,
  ) => {
    if (!user?.id || !lookItems?.length) return null;
    const continuity = buildLookContinuity({
      flow: 'get-outfits',
      stylistId: user.stylistPreferences?.selectedStylistId || 'ivy',
      items: lookItems,
      recommendation: summary,
    });
    if (continuity) await saveLastDecisionContinuity(user.id, continuity);
    return continuity;
  }, [user?.id, user?.stylistPreferences?.selectedStylistId]);

  const [step, setStep] = useState<ScanWardrobeStep>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sceneType, setSceneType] = useState<string>('other');
  const [scanItems, setScanItems] = useState<ScanSessionItem[]>([]);
  const [hybridMerge, setHybridMerge] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showOutfitModal, setShowOutfitModal] = useState(false);
  const [generatedOutfit, setGeneratedOutfit] = useState<GeneratedOutfitModalData | null>(null);
  const [outfitOptions, setOutfitOptions] = useState<ScanOutfitOption[]>([]);
  const [wowMessage, setWowMessage] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<OutfitOccasionId>('casual_day');
  const [dupeSheet, setDupeSheet] = useState<{
    visible: boolean;
    decision: NormalizedDuplicateDecision;
    pendingItems: ScanSessionItem[];
  }>({ visible: false, decision: { type: 'ok', matches: [], isDuplicate: false }, pendingItems: [] });

  const [onboardingProfile, setOnboardingProfile] = useState<Awaited<ReturnType<typeof onboardingProfileService.getProfile>> | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  /** When true, the next scan appends items instead of replacing the session. */
  const [appendNextScan, setAppendNextScan] = useState(false);
  /** Set after dismissing AI allowance paywall so Start over stays visible at the top. */
  const [allowanceBlocked, setAllowanceBlocked] = useState(false);
  const skipAutoOpenRef = useRef(false);
  const appendNextScanRef = useRef(false);
  /** Keep scan crops in memory after AsyncStorage slims them — outfit thumbs need them. */
  const scanCropByIdRef = useRef<Record<string, string>>({});
  const scrollRef = useRef<React.ElementRef<typeof KeyboardAwareScrollView>>(null);

  React.useEffect(() => {
    onboardingProfileService.getProfile().then(setOnboardingProfile).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadGetOutfitsSession();
      if (cancelled) return;
      if (saved) {
        skipAutoOpenRef.current = true;
        setImageUri(saved.imageUri);
        setSessionId(saved.sessionId);
        setSceneType(saved.sceneType || 'other');
        setScanItems(saved.scanItems || []);
        setHybridMerge(saved.hybridMerge !== false);
        setSelectedOccasion(saved.selectedOccasion || 'casual_day');
        setOutfitOptions(saved.outfitOptions || []);
        setWowMessage(saved.wowMessage);
        // Prefer looks if we have options; otherwise confirm if we have items.
        if (saved.outfitOptions?.length && (saved.step === 'looks' || saved.step === 'outfit')) {
          setStep('looks');
        } else if (saved.scanItems?.length) {
          const restoredStep =
            saved.step === 'capture' || saved.step === 'outfit' ? 'confirm' : saved.step;
          setStep(restoredStep);
        } else {
          setStep('capture');
        }
      }
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void saveGetOutfitsSession({
      step,
      imageUri,
      sessionId,
      sceneType,
      scanItems,
      hybridMerge,
      selectedOccasion,
      outfitOptions,
      wowMessage,
    });
  }, [
    sessionReady,
    step,
    imageUri,
    sessionId,
    sceneType,
    scanItems,
    hybridMerge,
    selectedOccasion,
    outfitOptions,
    wowMessage,
  ]);

  const presentationGender = resolveUserPresentationGender(user, onboardingProfile);
  const categoryOptions = useMemo(
    () => getManualAddCategoryTabs(presentationGender).map((tab) => tab.key),
    [presentationGender],
  );

  const confirmedItems = useMemo(() => scanItems.filter(Boolean), [scanItems]);

  /** Owned wardrobe only — used when "Include saved wardrobe pieces" is on. */
  const ownedWardrobeCount = useMemo(
    () => savedWardrobe.filter((it) => it.origin !== 'inspiration' && it.origin !== 'wishlist').length,
    [savedWardrobe],
  );

  /**
   * Hybrid merge: 1+ scanned pieces + enough wardrobe to reach 3 total.
   * Scan-only: need 3 confirmed pieces in this photo.
   */
  const canGenerateLooks = useMemo(() => {
    if (confirmedItems.length < 1) return false;
    if (hybridMerge) {
      return confirmedItems.length + ownedWardrobeCount >= 3;
    }
    return confirmedItems.length >= 3;
  }, [confirmedItems.length, hybridMerge, ownedWardrobeCount]);

  const generateBlockedHint = useMemo(() => {
    if (canGenerateLooks) return null;
    if (confirmedItems.length < 1) return 'Add at least one piece from your photo.';
    if (hybridMerge) {
      return `Need a few more pieces — scan another item, or add clothes to your wardrobe (${ownedWardrobeCount} saved).`;
    }
    return 'Scan at least 3 pieces in the photo, or turn on Include saved wardrobe pieces.';
  }, [canGenerateLooks, confirmedItems.length, hybridMerge, ownedWardrobeCount]);

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(t('wardrobe.error') || 'Error', t('wardrobe.couldNotOpenSettingsPleaseEnablePermissi') || 'Could not open settings.');
    }
  };

  const openAllowanceDestination = useCallback(() => {
    navigateToSubscription(
      navigation,
      aiAllowanceSubscriptionParams(user?.subscriptionTier, 'get_outfits'),
    );
  }, [navigation, user?.subscriptionTier]);

  const openAllowancePaywall = useCallback(
    (error?: unknown) => {
      const planTier = planTierFromBudgetError(error) || user?.subscriptionTier;
      const paywall = getAiAllowancePaywallCopy(planTier);
      setAllowanceBlocked(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({ y: 0, animated: true });
      });
      Alert.alert(paywall.title, paywall.message, [
        { text: paywall.secondaryLabel, style: 'cancel' },
        {
          text: paywall.primaryLabel,
          onPress: () =>
            navigateToSubscription(navigation, aiAllowanceSubscriptionParams(planTier, 'get_outfits')),
        },
      ]);
    },
    [navigation, user?.subscriptionTier],
  );

  const runScan = async (uri: string) => {
    const append = appendNextScanRef.current;
    setStep('scanning');
    try {
      const base64 = await convertImageToBase64(uri);
      const result = await apiService.scanWardrobe(base64, { includeCrops: true });
      if (!result.success || !result.items?.length) {
        Alert.alert(
          t('wardrobe.scanWardrobe') || 'Scan Wardrobe',
          result.message || 'No garments detected. Try a flat-lay photo with clear separation.',
        );
        // Keep the photo so they can retry or Start over — don't leave a dead preview.
        setStep(append && scanItems.length ? 'confirm' : 'capture');
        return;
      }
      const incoming = (result.items || []).map((item, index) => ({
        ...item,
        sourceImageId: result.sessionId || item.sourceImageId,
        // Keep tempIds unique across appended photos
        tempId: append
          ? `${result.sessionId || 'scan'}_${Date.now()}_${index}_${item.tempId || index}`
          : item.tempId,
      }));
      if (!append || !sessionId) {
        setSessionId(result.sessionId);
      }
      setSceneType(result.sceneType);
      setScanItems((prev) => (append ? [...prev, ...incoming] : incoming));
      rememberScanCrops(incoming);
      appendNextScanRef.current = false;
      setAppendNextScan(false);
      setAllowanceBlocked(false);
      setStep('confirm');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('[ScanWardrobe] scan failed:', error);
      // Stay on capture with this photo so Continue / Start over remain available.
      setStep(append && scanItems.length ? 'confirm' : 'capture');
      if (isAiBudgetError(error)) {
        openAllowancePaywall(error);
        return;
      }
      Alert.alert(
        t('wardrobe.error') || 'Error',
        error instanceof Error ? error.message : 'Could not scan photo. Please try again.',
      );
    }
  };

  const goAddAnotherItem = useCallback(() => {
    appendNextScanRef.current = true;
    setAppendNextScan(true);
    setImageUri(null);
    setStep('capture');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const beginImageImport = async (asset: ImagePicker.ImagePickerAsset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const corrected = await correctWardrobeImageOrientation(asset.uri, asset);
      setImageUri(corrected.uri);
      promptWardrobeOrientationReview(corrected, (uri) => {
        setImageUri(uri);
        runScan(uri);
      });
    } catch {
      setImageUri(asset.uri);
      runScan(asset.uri);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain && Platform.OS !== 'web') {
        Alert.alert(t('wardrobe.permissionRequired') || 'Permission Required', t('wardrobe.photoLibraryAccessWasDeniedPleaseEnableI') || 'Enable photo library in Settings.', [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          { text: t('common.openSettings') || 'Settings', onPress: openSettings },
        ]);
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      await beginImageImport(result.assets[0]);
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain && Platform.OS !== 'web') {
        Alert.alert(t('wardrobe.permissionRequired') || 'Permission Required', t('wardrobe.cameraAccessWasDeniedPleaseEnableItInSet') || 'Enable camera in Settings.', [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          { text: t('common.openSettings') || 'Settings', onPress: openSettings },
        ]);
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      await beginImageImport(result.assets[0]);
    }
  };

  const updateItem = (tempId: string, patch: Partial<ScanSessionItem>) => {
    setScanItems((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)));
  };

  const rememberScanCrops = useCallback((items: ScanSessionItem[]) => {
    for (const item of items || []) {
      if (item?.tempId && item.sceneCrop) {
        scanCropByIdRef.current[String(item.tempId)] = item.sceneCrop;
      }
    }
  }, []);

  const hydrateLookItems = useCallback(
    async (
      apiItems: Array<{ id?: string | number; name?: string; category?: string; color?: string; imageUrl?: string | null; imageUri?: string | null }>,
      pool: WardrobeItem[],
    ) => {
      const hydrated = hydrateGeneratedOutfitItems(apiItems, pool).map((item) => {
        if (item.imageUri || item.enhancedImageUri) return item;
        const crop = scanCropByIdRef.current[String(item.id)];
        if (!crop) return item;
        const uri = `data:image/jpeg;base64,${crop}`;
        return { ...item, imageUri: uri, enhancedImageUri: uri, imageProcessed: true };
      });
      // WardrobeItemImage rejects data: URIs — write crops to cache files first.
      return materializeWardrobeItemImages(hydrated, scanCropByIdRef.current);
    },
    [],
  );

  const removeItem = (tempId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const handleGenerateOutfit = async () => {
    if (allowanceBlocked) {
      openAllowanceDestination();
      return;
    }
    if (!canGenerateLooks) {
      Alert.alert(
        t('wardrobe.moreItemsNeeded') || 'More pieces needed',
        generateBlockedHint
          || (hybridMerge
            ? 'Turn on Include saved wardrobe pieces and make sure your wardrobe has a few items, or scan 3 pieces.'
            : 'Confirm at least 3 items before generating outfits.'),
      );
      return;
    }
    setIsGenerating(true);
    setStep('outfit');
    try {
      const weatherSnap = await fetchWeatherSnapshot();
      const prefs = await getTodaysOutfitPopupPrefs().catch(() => null);
      const workDressCode = selectedOccasion === 'work_outfit'
        ? (await resolveStoredWorkDressCode().catch(() => normalizeWorkDressCode(prefs?.workDressCode ?? null)))
        : null;
      const brandInspiration = resolveBrandInspiration(
        user?.extendedPreferences?.favoriteBrands || null,
      );
      const result = await apiService.generateOutfitFromScan({
        sessionWardrobe: confirmedItems,
        hybridMerge,
        occasionType: selectedOccasion,
        optionCount: 3,
        workDressCode: workDressCode || undefined,
        brandInspiration: brandInspiration || undefined,
        weather: weatherSnap
          ? {
              temperature: weatherSnap.temperature,
              condition: weatherSnap.condition,
              unit: 'C',
              location: weatherSnap.location,
            }
          : undefined,
      });
      if (!result.success) {
        throw new Error(result.message || 'Could not generate outfits');
      }
      const wardrobePool = [
        ...confirmedItems.map(sessionItemToWardrobeItem),
        ...(hybridMerge ? savedWardrobe : []),
      ];
      rememberScanCrops(confirmedItems);
      const options: ScanOutfitOption[] = (result.outfits?.length
        ? result.outfits
        : [{
            id: 'look_1',
            label: 'Look 1',
            vibeLabel: result.vibeLabel,
            stylistMessage: result.stylistMessage,
            outfit: result.outfit,
            hydratedItems: result.hydratedItems,
          }]) as ScanOutfitOption[];

      setOutfitOptions(options);
      const weatherNote = weatherSnap
        ? ` · ${weatherSnap.temperature}°C ${weatherSnap.condition || ''} in ${weatherSnap.location || 'your area'}`.trim()
        : '';
      const nextWow =
        (result.wowMessage
          || `You have ${result.usableItemCount || confirmedItems.length} usable items. Here are ${options.length} looks.`)
          + weatherNote;
      setWowMessage(nextWow);
      setStep('looks');
      setAllowanceBlocked(false);
      // Persist immediately so backing out before the debounce effect still keeps looks.
      void saveGetOutfitsSession({
        step: 'looks',
        imageUri,
        sessionId,
        sceneType,
        scanItems,
        hybridMerge,
        selectedOccasion,
        outfitOptions: options,
        wowMessage: nextWow,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auto-open first look for instant wow (skip when restoring a saved session)
      const first = options[0];
      if (first && !skipAutoOpenRef.current) {
        const apiItems = first.hydratedItems || first.outfit?.items || [];
        const hydrated = await hydrateLookItems(apiItems, wardrobePool);
        setGeneratedOutfit({
          items: hydrated,
          stylistMessage: humanizeStylistMessage(first.stylistMessage || result.stylistMessage) || undefined,
        });
        setShowOutfitModal(true);
        void persistLookContinuity(
          hydrated,
          humanizeStylistMessage(first.stylistMessage || result.stylistMessage) || undefined,
        );
      }
      skipAutoOpenRef.current = false;
    } catch (error) {
      setStep('confirm');
      if (isAiBudgetError(error)) {
        openAllowancePaywall(error);
      } else {
        Alert.alert(
          t('wardrobe.error') || 'Error',
          error instanceof Error ? error.message : 'Outfit generation failed.',
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const openLook = async (option: ScanOutfitOption) => {
    const wardrobePool = [
      ...confirmedItems.map(sessionItemToWardrobeItem),
      ...(hybridMerge ? savedWardrobe : []),
    ];
    const apiItems = option.hydratedItems || option.outfit?.items || [];
    const hydrated = await hydrateLookItems(apiItems, wardrobePool);
    setGeneratedOutfit({
      items: hydrated,
      stylistMessage: humanizeStylistMessage(option.stylistMessage) || undefined,
    });
    setShowOutfitModal(true);
    void persistLookContinuity(hydrated, humanizeStylistMessage(option.stylistMessage) || undefined);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resetToCapture = useCallback(async () => {
    await clearGetOutfitsSession();
    appendNextScanRef.current = false;
    setAppendNextScan(false);
    setAllowanceBlocked(false);
    setStep('capture');
    setImageUri(null);
    setSessionId(null);
    setSceneType('other');
    setScanItems([]);
    setOutfitOptions([]);
    setWowMessage(null);
    setGeneratedOutfit(null);
    setShowOutfitModal(false);
    skipAutoOpenRef.current = false;
  }, []);

  const confirmStartOver = useCallback(() => {
    Alert.alert(
      'Start over?',
      'This clears your current photo and scanned pieces so you can begin again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start over', style: 'destructive', onPress: () => void resetToCapture() },
      ],
    );
  }, [resetToCapture]);

  const finishSession = useCallback(async () => {
    await clearGetOutfitsSession();
    navigation.goBack();
  }, [navigation]);

  const persistItems = async (
    itemsToSave: ScanSessionItem[],
    allowDuplicates = false,
    overrideAgainst?: string[],
  ) => {
    setIsSaving(true);
    try {
      const payload = itemsToSave.map((item) => ({
        name: item.name,
        category: item.category as ClothingCategory,
        subcategory: item.subcategory || undefined,
        color: item.color as WardrobeItem['color'],
        brand: item.brand || undefined,
        imageUri: item.sceneCrop ? `data:image/jpeg;base64,${item.sceneCrop}` : '',
        seasons: ['all-season'] as const,
        occasions: ['everyday'] as const,
        isFavorite: false,
        ...scanItemDedupeBind(item, sessionId),
        dedupeOverrideAgainst: overrideAgainst,
      }));
      await addItemsBatch(payload, { allowDuplicates });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await clearGetOutfitsSession();
      Alert.alert(
        t('wardrobe.saved') || 'Saved',
        `Added ${itemsToSave.length} item${itemsToSave.length === 1 ? '' : 's'} to your wardrobe.`,
        [{ text: t('common.done') || 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(t('wardrobe.error') || 'Error', error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToWardrobe = async () => {
    if (confirmedItems.length === 0) {
      navigation.goBack();
      return;
    }
    setStep('save');
    try {
      const dupePayload = confirmedItems.map((item) => ({
        name: item.name,
        category: item.category,
        subcategory: item.subcategory || undefined,
        color: item.color,
        brand: item.brand || undefined,
        imageBase64: item.sceneCrop || undefined,
        sourceCropId: item.tempId,
        cropId: item.tempId,
        scanSessionId: sessionId || undefined,
        captureSessionId: sessionId || undefined,
        sourceImageId: item.sourceImageId || undefined,
      }));
      const serverDupe = await apiService.checkWardrobeDuplicates(dupePayload);
      const firstHit = serverDupe.results?.find((r) => {
        const t = r.type || r.decision?.type;
        return r.isDuplicate || t === 'duplicate' || t === 'already_owned' || t === 'similar_item' || t === 'classification_conflict';
      });
      if (firstHit) {
        setDupeSheet({
          visible: true,
          decision: normalizeDuplicateDecision({
            ...firstHit,
            type: firstHit.type || firstHit.decision?.type,
            decision: firstHit.decision,
            similarMatches: firstHit.similarMatches,
            conflictMatches: (firstHit as { conflictMatches?: unknown[] }).conflictMatches,
          }),
          pendingItems: confirmedItems,
        });
        return;
      }
      const localMatches = confirmedItems.flatMap((item) =>
        findLocalWardrobeDuplicates(sessionItemToDupeCandidate(item, sessionId), savedWardrobe).map((m) => ({
          ...m,
          matchedCandidateIndex: confirmedItems.indexOf(item),
        })),
      );
      if (localMatches.length > 0) {
        setDupeSheet({
          visible: true,
          decision: decisionFromLocalMatches(localMatches),
          pendingItems: confirmedItems,
        });
        return;
      }
      await persistItems(confirmedItems);
    } catch {
      // Offline: still block obvious local duplicates.
      const localMatches = confirmedItems.flatMap((item) =>
        findLocalWardrobeDuplicates(sessionItemToDupeCandidate(item, sessionId), savedWardrobe),
      );
      if (localMatches.length > 0) {
        setDupeSheet({
          visible: true,
          decision: decisionFromLocalMatches(localMatches),
          pendingItems: confirmedItems,
        });
        return;
      }
      await persistItems(confirmedItems);
    }
  };

  const renderCapture = () => (
    <View style={styles.stepBody}>
      <ThemedText type="h2" style={styles.title}>
        {appendNextScan
          ? 'Add another item'
          : (t('wardrobe.getOutfitsNow') || 'Get outfits now')}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        {appendNextScan
          ? `Keeping your ${scanItems.length} scanned piece${scanItems.length === 1 ? '' : 's'} — add another photo if you want.`
          : 'Start with one piece — we’ll style 3 outfits with it.'}
      </ThemedText>
      {allowanceBlocked ? (
        <AiAllowanceBlockedBanner
          tier={user?.subscriptionTier}
          message="Looks and scans need AI credit. Start over anytime, or buy more credit / see plans when you’re ready."
          onPrimary={() => openAllowanceDestination()}
          onSecondary={confirmStartOver}
          secondaryLabel="Start over"
        />
      ) : null}
      {appendNextScan && scanItems.length > 0 ? (
        <Pressable
          onPress={() => {
            appendNextScanRef.current = false;
            setAppendNextScan(false);
            setStep('confirm');
          }}
          style={{ marginBottom: Spacing.md }}
        >
          <ThemedText type="caption" style={{ color: LuxuryColors.gold }}>
            ← Back to {scanItems.length} scanned item{scanItems.length === 1 ? '' : 's'}
          </ThemedText>
        </Pressable>
      ) : null}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
      ) : (
        <View style={[styles.previewPlaceholder, { borderColor: theme.border }]}>
          <Feather name="camera" size={48} color={LuxuryColors.gold} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.md }}>
            Snap one item to start — you can add another photo after
          </ThemedText>
        </View>
      )}
      <View style={styles.captureActions}>
        {imageUri ? (
          <Pressable
            onPress={() => {
              if (allowanceBlocked) {
                openAllowanceDestination();
                return;
              }
              void runScan(imageUri);
            }}
            style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}
          >
            <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
              {allowanceBlocked
                ? getAiAllowancePaywallCopy(user?.subscriptionTier).primaryLabel
                : 'Continue with this photo'}
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleTakePhoto}
          style={
            imageUri
              ? [styles.secondaryBtn, { borderColor: theme.border }]
              : [styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]
          }
        >
          <ThemedText
            type="body"
            style={{
              color: imageUri ? theme.text : LuxuryColors.midnight,
              fontWeight: '600',
            }}
          >
            {appendNextScan
              ? 'Take another photo'
              : (t('wardrobe.takePhotoForOutfits') || 'Take a photo')}
          </ThemedText>
        </Pressable>
        <Pressable onPress={handlePickImage} style={[styles.secondaryBtn, { borderColor: theme.border }]}>
          <ThemedText type="body" style={{ color: theme.text }}>
            {t('wardrobe.chooseFromGallery') || 'Choose from Gallery'}
          </ThemedText>
        </Pressable>
        {imageUri || scanItems.length > 0 || allowanceBlocked ? (
          <Pressable onPress={confirmStartOver} style={[styles.secondaryBtn, { borderColor: theme.border }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Start over
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderScanning = () => (
    <View style={[styles.stepBody, styles.centered]}>
      <ActivityIndicator size="large" color={LuxuryColors.gold} />
      <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
        Styling your pieces…
      </ThemedText>
    </View>
  );

  const renderGeneratingOutfits = () => (
    <View style={[styles.stepBody, styles.centered]}>
      <ActivityIndicator size="large" color={LuxuryColors.gold} />
      <ThemedText type="h2" style={{ marginTop: Spacing.lg, textAlign: 'center' }}>
        {t('wardrobe.creatingYourOutfits') || 'Creating your outfits…'}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }}>
        This usually takes a few seconds.
      </ThemedText>
    </View>
  );

  const renderConfirmItem = ({ item }: { item: ScanSessionItem }) => (
    <View style={[styles.itemCard, { backgroundColor: isDark ? theme.surface : '#FFF', borderColor: theme.border }]}>
      <View style={styles.itemRow}>
        {item.sceneCrop ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.sceneCrop}` }}
            style={styles.itemThumb}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.itemThumb, { backgroundColor: theme.surfaceSecondary }]}>
            <Feather name="image" size={20} color={theme.textTertiary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <TextInput
            value={item.name}
            onChangeText={(text) => updateItem(item.tempId, { name: text })}
            style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="Item name"
            placeholderTextColor={theme.textTertiary}
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {CATEGORY_LABELS[item.category as ClothingCategory] || item.category}
            {item.confidence < 0.55 ? ` · ${Math.round(item.confidence * 100)}% sure` : ''}
          </ThemedText>
          {item.needsConfirm && item.confirmPrompt ? (
            <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginTop: 4 }}>
              {item.confirmPrompt}
            </ThemedText>
          ) : null}
        </View>
        <Pressable onPress={() => removeItem(item.tempId)} hitSlop={8}>
          <Feather name="x" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.categoryChips}>
        {categoryOptions.slice(0, 8).map((cat) => (
          <Pressable
            key={cat}
            onPress={() => updateItem(item.tempId, { category: cat })}
            style={[
              styles.categoryChip,
              item.category === cat && styles.categoryChipActive,
              { borderColor: item.category === cat ? LuxuryColors.gold : theme.border },
            ]}
          >
            <ThemedText type="caption" style={{ color: item.category === cat ? LuxuryColors.gold : theme.textSecondary }}>
              {CATEGORY_LABELS[cat]}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderConfirm = () => (
    <View style={styles.stepBody}>
      <View style={styles.confirmHeaderRow}>
        <ThemedText type="h2" style={[styles.title, { flex: 1, marginBottom: 0 }]}>
          You have {confirmedItems.length} usable item{confirmedItems.length === 1 ? '' : 's'}
        </ThemedText>
        <Pressable onPress={confirmStartOver} hitSlop={8}>
          <ThemedText type="caption" style={{ color: theme.textSecondary, fontWeight: '600' }}>
            Start over
          </ThemedText>
        </Pressable>
      </View>
      {allowanceBlocked ? (
        <AiAllowanceBlockedBanner
          tier={user?.subscriptionTier}
          message="Looks can’t run until you buy more credit or your allowance resets. You can still edit items or start over."
          onPrimary={() => openAllowanceDestination()}
          onSecondary={confirmStartOver}
          secondaryLabel="Start over"
        />
      ) : null}
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        {hybridMerge
          ? canGenerateLooks
            ? `You’re ready — we’ll style this with pieces from your wardrobe (${ownedWardrobeCount} saved).`
            : `Need a bit more — tap Add another item, or add clothes to your wardrobe (${ownedWardrobeCount} saved).`
          : 'Scan at least 3 pieces in one photo for looks, or turn on “Include saved wardrobe pieces” below.'}
        {' '}Scene: {sceneType.replace(/_/g, ' ')}
      </ThemedText>
      <FlatList
        data={confirmedItems}
        keyExtractor={(item) => item.tempId}
        renderItem={renderConfirmItem}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
      <View style={styles.mergeRow}>
        <View style={{ flex: 1, paddingRight: Spacing.sm }}>
          <ThemedText type="body">Include saved wardrobe pieces</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
            {hybridMerge
              ? `On · ${ownedWardrobeCount} saved piece${ownedWardrobeCount === 1 ? '' : 's'} can complete the look`
              : 'Off · need 3+ pieces in this photo'}
          </ThemedText>
        </View>
        <Switch
          value={hybridMerge}
          onValueChange={setHybridMerge}
          trackColor={{ false: theme.border, true: LuxuryColors.gold }}
        />
      </View>
      <OccasionPickerList
        selectedOccasionId={selectedOccasion}
        selectionMode="select"
        showWeatherLink={false}
        onSelect={setSelectedOccasion}
      />
      <View style={styles.footerActions}>
        {generateBlockedHint ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.sm }}>
            {generateBlockedHint}
          </ThemedText>
        ) : null}
        <Pressable
          onPress={handleGenerateOutfit}
          disabled={isGenerating || (!canGenerateLooks && !allowanceBlocked)}
          style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold, opacity: isGenerating || (!canGenerateLooks && !allowanceBlocked) ? 0.5 : 1 }]}
        >
          {isGenerating ? (
            <ActivityIndicator color={LuxuryColors.midnight} />
          ) : (
            <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
              {allowanceBlocked
                ? getAiAllowancePaywallCopy(user?.subscriptionTier).primaryLabel
                : 'Show me 3 outfits'}
            </ThemedText>
          )}
        </Pressable>
        <Pressable
          onPress={handleSaveToWardrobe}
          disabled={isSaving || isGenerating}
          style={[styles.secondaryBtn, { borderColor: theme.border, opacity: isSaving || isGenerating ? 0.5 : 1 }]}
        >
          <ThemedText type="body" style={{ color: theme.text }}>
            Save scanned pieces to wardrobe
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={goAddAnotherItem}
          disabled={isGenerating}
          style={[styles.secondaryBtn, { borderColor: LuxuryColors.gold, opacity: isGenerating ? 0.5 : 1 }]}
        >
          <ThemedText type="body" style={{ color: LuxuryColors.gold, fontWeight: '600' }}>
            + Add another item
          </ThemedText>
        </Pressable>
        <Pressable onPress={confirmStartOver} style={[styles.secondaryBtn, { borderColor: theme.border }]}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Start over
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderLooks = () => (
    <View style={styles.stepBody}>
      <ThemedText type="h2" style={styles.title}>
        {wowMessage || `Here are ${outfitOptions.length} looks`}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Tap a look to open details. Saving to wardrobe is optional.
      </ThemedText>
      {outfitOptions.map((option, index) => {
        const pieceCount = (option.hydratedItems || option.outfit?.items || []).length;
        return (
          <Pressable
            key={option.id || `look_${index}`}
            onPress={() => openLook(option)}
            style={[styles.lookCard, { backgroundColor: isDark ? theme.surface : '#FFF', borderColor: theme.border }]}
          >
            <View style={styles.lookCardHeader}>
              <ThemedText type="body" style={{ fontWeight: '700' }}>
                {option.label || `Look ${index + 1}`}
              </ThemedText>
              <Feather name="chevron-right" size={20} color={LuxuryColors.gold} />
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {option.vibeLabel || selectedOccasion.replace(/_/g, ' ')} · {pieceCount} piece{pieceCount === 1 ? '' : 's'}
            </ThemedText>
            {humanizeStylistMessage(option.stylistMessage) ? (
              <ThemedText type="caption" style={{ color: theme.text, marginTop: 6 }} numberOfLines={2}>
                {humanizeStylistMessage(option.stylistMessage)}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
      <View style={styles.footerActions}>
        <Pressable
          onPress={handleGenerateOutfit}
          disabled={isGenerating}
          style={[styles.secondaryBtn, { borderColor: LuxuryColors.gold, opacity: isGenerating ? 0.5 : 1 }]}
        >
          <ThemedText type="body" style={{ color: LuxuryColors.gold, fontWeight: '600' }}>
            {allowanceBlocked
              ? getAiAllowancePaywallCopy(user?.subscriptionTier).primaryLabel
              : 'Refresh looks'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={handleSaveToWardrobe}
          disabled={isSaving}
          style={[styles.secondaryBtn, { borderColor: theme.border, opacity: isSaving ? 0.5 : 1 }]}
        >
          <ThemedText type="body" style={{ color: theme.text }}>
            Save scanned pieces to wardrobe
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setStep('confirm')} style={[styles.secondaryBtn, { borderColor: theme.border }]}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Edit items
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={finishSession}
          style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}
        >
          <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
            Done
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={confirmStartOver}
          style={[styles.secondaryBtn, { borderColor: theme.border }]}
        >
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Start again
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderSave = () => (
    <View style={[styles.stepBody, styles.centered]}>
      <ActivityIndicator size="large" color={LuxuryColors.gold} />
      <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
        Saving to wardrobe…
      </ThemedText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault }}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + Spacing.xl * 2 }]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'capture' && renderCapture()}
        {step === 'scanning' && renderScanning()}
        {step === 'confirm' && renderConfirm()}
        {step === 'outfit' && renderGeneratingOutfits()}
        {step === 'looks' && renderLooks()}
        {step === 'save' && renderSave()}
      </KeyboardAwareScrollView>

      <GeneratedOutfitModal
        visible={showOutfitModal}
        outfit={generatedOutfit}
        occasion={selectedOccasion}
        onClose={() => setShowOutfitModal(false)}
        onSkipLook={() => {
          if (outfitOptions.length < 2) {
            setShowOutfitModal(false);
            return;
          }
          const currentIds = new Set((generatedOutfit?.items || []).map((i) => String(i.id)));
          const idx = Math.max(
            0,
            outfitOptions.findIndex((opt) => {
              const ids = (opt.hydratedItems || opt.outfit?.items || []).map((i: { id?: string | number }) =>
                String(i.id),
              );
              return ids.length > 0 && ids.every((id: string) => currentIds.has(id));
            }),
          );
          const next = outfitOptions[(idx + 1) % outfitOptions.length];
          if (!next) {
            setShowOutfitModal(false);
            return;
          }
          openLook(next);
        }}
      />

      <DuplicateComparisonSheet
        visible={dupeSheet.visible}
        type={dupeSheet.decision.type}
        message={dupeSheet.decision.message}
        matches={dupeSheet.decision.matches}
        onClose={() => setDupeSheet((s) => ({ ...s, visible: false }))}
        onAddAnyway={async () => {
          setDupeSheet((s) => ({ ...s, visible: false }));
          await persistItems(
            dupeSheet.pendingItems,
            true,
            overrideIdsFromMatches(dupeSheet.decision.matches),
          );
        }}
        onContinue={async () => {
          setDupeSheet((s) => ({ ...s, visible: false }));
          await persistItems(
            dupeSheet.pendingItems,
            true,
            overrideIdsFromMatches(dupeSheet.decision.matches),
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.lg,
  },
  stepBody: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  confirmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  previewImage: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    height: (SCREEN_WIDTH - Spacing.lg * 2) * 0.75,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  previewPlaceholder: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    height: (SCREEN_WIDTH - Spacing.lg * 2) * 0.75,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  captureActions: {
    gap: Spacing.sm,
  },
  itemCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  nameInput: {
    borderBottomWidth: 1,
    paddingVertical: 4,
    fontSize: 16,
    marginBottom: 4,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(201, 168, 124, 0.12)',
  },
  mergeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  footerActions: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  primaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  lookCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  lookCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});
