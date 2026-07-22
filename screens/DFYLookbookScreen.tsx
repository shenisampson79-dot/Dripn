import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Dimensions,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { DFYOutfitVisual } from "@/components/outfit/DFYOutfitVisual";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { dfyService, DFYOutfit, DFYLiteDelivery, StylistId, type DFYAccessStatus, normalizeLiteDelivery, LITE_LOOKBOOK_DAYS } from "@/services/DFYService";
import { SaveOutfitPromptModal, type SaveOutfitIntent } from "@/components/outfit/SaveOutfitPromptModal";
import { DFYPackageNameModal } from "@/components/outfit/DFYPackageNameModal";
import { apiService } from "@/services/ApiService";
import { weatherService } from "@/services/WeatherService";
import {
  enrichDeliveryWithWardrobeImages,
  resolveDFYItemImageUri,
  findWardrobeItemForDFYOutfitItem,
  RawDFYOutfitItem,
  countFilledLookbookDays,
  ensureLookbookOutfitsHaveFootwear,
  filterOutfitItemsForWeather,
  stripInvalidLookbookOutfits,
  generateLiteLookbook,
} from "@/utils/dfyOutfitImages";
import { sortOutfitItemsByVisualOrder } from "@/utils/outfitItemOrder";
import type { WardrobeStackParamList } from "@/navigation/WardrobeStackNavigator";
import {
  hasCoreLookbookRedirectSignal,
  pickLiteLookbookPackage,
} from "@/utils/dfyPackages";
import { CATEGORY_LABELS, type ClothingCategory } from "@/contexts/WardrobeContext";
import {
  computeLookbookDayNumber,
  computeLookbookDaysRemaining,
  lookbookDateForDay,
  resolveTripAnchorIso,
} from "@/utils/lookbookTripDay";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

type LookbookEmptyMode = 'loading' | 'core' | 'unlock' | null;

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

const STYLIST_COLORS: Record<NonNullable<StylistId>, { gradient: readonly [string, string]; accent: string }> = {
  ruby: { gradient: [LUXURY_COLORS.rose, LUXURY_COLORS.berry] as const, accent: LUXURY_COLORS.rose },
  max: { gradient: ['#64748B', '#475569'] as const, accent: '#64748B' },
  ace: { gradient: [LUXURY_COLORS.teal, LUXURY_COLORS.emerald] as const, accent: LUXURY_COLORS.teal },
  ivy: { gradient: [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const, accent: LUXURY_COLORS.violet },
};

type DFYLookbookScreenProps = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, 'DFYLookbook'>;
};

export default function DFYLookbookScreen({ navigation }: DFYLookbookScreenProps) {
  const route = useRoute<RouteProp<WardrobeStackParamList, 'DFYLookbook'>>();
  const packageId = route.params?.packageId;
  const isHistorical = Boolean(packageId);
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const { items: wardrobeItems } = useWardrobe();
  const insets = useSafeAreaInsets();

  const [delivery, setDelivery] = useState<DFYLiteDelivery | null>(null);
  const [accessStatus, setAccessStatus] = useState<DFYAccessStatus | null>(null);
  const [emptyMode, setEmptyMode] = useState<LookbookEmptyMode>('loading');
  const [packageName, setPackageName] = useState<string | null>(null);
  const [selectedOutfit, setSelectedOutfit] = useState<DFYOutfit | null>(null);
  const [showOutfitModal, setShowOutfitModal] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [savePromptIntent, setSavePromptIntent] = useState<SaveOutfitIntent>('love');
  const [currentDay, setCurrentDay] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showPackageNamePrompt, setShowPackageNamePrompt] = useState(false);
  const [packageNameDefault, setPackageNameDefault] = useState('');
  const [renamePackageId, setRenamePackageId] = useState<string | null>(null);
  const backfillStartedRef = useRef(false);

  const resolveTripStartIso = (d: DFYLiteDelivery): string | null | undefined =>
    resolveTripAnchorIso(d) || d.travelPlan?.startDate || d.startDate;

  const liveCurrentDayFor = (d: DFYLiteDelivery): number =>
    computeLookbookDayNumber(
      resolveTripStartIso(d),
      new Date(),
      d.totalDays || LITE_LOOKBOOK_DAYS,
    );

  const maybePromptPackageName = async () => {
    if (isHistorical) return;
    try {
      const prompt = await dfyService.preparePackageNamePrompt('lite');
      if (!prompt) return;
      setRenamePackageId(prompt.packageId);
      setPackageNameDefault(prompt.defaultName);
      setShowPackageNamePrompt(true);
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    backfillStartedRef.current = false;
    void loadDelivery();
  }, [user?.id, packageId]);

  useFocusEffect(
    useCallback(() => {
      if (!delivery || !user?.id) return;

      // Live trip day from startDate + today — never freeze delivery.currentDay
      const liveDay = liveCurrentDayFor(delivery);
      setCurrentDay(liveDay);
      // Persist day index only — never regenerates outfits
      if (!isHistorical && liveDay !== delivery.currentDay) {
        setDelivery((prev) =>
          prev && prev.currentDay !== liveDay ? { ...prev, currentDay: liveDay } : prev,
        );
        void dfyService.saveDFYDelivery({ ...delivery, currentDay: liveDay });
      }

      if (isHistorical) return;
      const totalDays = delivery.totalDays || 14;
      if (countFilledLookbookDays(delivery) >= totalDays) return;
      if (backfillStartedRef.current) return;
      backfillStartedRef.current = true;
      void populateLookbookOutfits(delivery, { fillGapsOnly: true });
    }, [delivery, user?.id, isHistorical]),
  );

  const maybeBackfillLookbook = (hydrated: DFYLiteDelivery) => {
    if (isHistorical) return;
    const totalDays = hydrated.totalDays || LITE_LOOKBOOK_DAYS;
    const filledCount = countFilledLookbookDays(hydrated);
    // Never force full regen on open / staleEngine — only fill empty days
    if (filledCount >= totalDays || backfillStartedRef.current) return;
    backfillStartedRef.current = true;
    void populateLookbookOutfits(hydrated, { fillGapsOnly: true });
  };

  const outfitTitle = (idx: number) => {
    const template = t('dfy.lookbook.dayLook') || 'Day {day} Look';
    return template.includes('{day}')
      ? template.replace('{day}', String(idx + 1))
      : `Day ${idx + 1} Look`;
  };

  const applyLiteDelivery = async (
    liteDelivery: DFYLiteDelivery,
    options?: { persistCorrections?: boolean; backfill?: boolean },
  ) => {
    let normalised = normalizeLiteDelivery(liteDelivery);
    const totalDays = normalised.totalDays;
    const hasCorruptedDayNumbers = normalised.outfits.some((o) => o.dayNumber > totalDays);
    if (hasCorruptedDayNumbers) {
      normalised = {
        ...normalised,
        outfits: normalised.outfits.map((o, idx) => ({
          ...o,
          dayNumber: idx + 1,
          title: outfitTitle(idx),
        })),
      };
    }

    const beforeInvalidStrip = countFilledLookbookDays(normalised);
    normalised = stripInvalidLookbookOutfits(normalised, wardrobeItems);
    const clearedInvalidOutfits = beforeInvalidStrip > countFilledLookbookDays(normalised);

    if ((hasCorruptedDayNumbers || clearedInvalidOutfits) && options?.persistCorrections !== false) {
      await dfyService.saveDFYDelivery(normalised);
    }

    const hydrated = enrichDeliveryWithWardrobeImages(
      ensureLookbookOutfitsHaveFootwear(normalised, wardrobeItems),
      wardrobeItems,
    );
    const forecast = await weatherService.get14DayForecast();
    const withWeather = forecast?.days?.length
      ? {
          ...hydrated,
          outfits: hydrated.outfits.map((outfit, idx) => {
            const dayForecast = weatherService.getForecastDay(
              forecast,
              outfit.dayNumber || idx + 1,
            );
            const filteredItems = filterOutfitItemsForWeather(
              outfit.items || [],
              dayForecast,
              wardrobeItems,
            );
            return {
              ...outfit,
              items: filteredItems,
              weatherNote:
                outfit.weatherNote ||
                weatherService.buildWeatherNoteForDay(dayForecast),
            };
          }),
        }
      : hydrated;

    const liveDay = liveCurrentDayFor(withWeather);
    const withLiveDay = { ...withWeather, currentDay: liveDay };

    setDelivery(withLiveDay);
    setCurrentDay(liveDay);
    setEmptyMode(null);

    if (options?.persistCorrections !== false) {
      const gainedImages = withLiveDay.outfits.some((outfit, idx) =>
        outfit.items.some((item, itemIdx) => {
          const prev = normalised.outfits[idx]?.items[itemIdx];
          return item.imageUri && !prev?.imageUri;
        }),
      );
      const gainedShoes = withLiveDay.outfits.some((outfit, idx) => {
        const prev = normalised.outfits[idx];
        return (outfit.items?.length || 0) > (prev?.items?.length || 0);
      });
      const droppedWarmLayers = withLiveDay.outfits.some((outfit, idx) => {
        const prev = normalised.outfits[idx];
        return (outfit.items?.length || 0) < (prev?.items?.length || 0);
      });
      const gainedWeather = withLiveDay.outfits.some(
        (outfit, idx) => outfit.weatherNote && !normalised.outfits[idx]?.weatherNote,
      );
      const dayChanged = liveDay !== (withWeather.currentDay || liteDelivery.currentDay || 1);
      if (gainedImages || gainedShoes || gainedWeather || droppedWarmLayers || dayChanged) {
        await dfyService.saveDFYDelivery(withLiveDay);
      }
    }

    if (options?.backfill !== false) {
      // Only fill gaps after invalid strips — never force full regen for engine bumps
      maybeBackfillLookbook(withLiveDay);
    }
  };

  const resolveEmptyMode = (options: {
    access: DFYAccessStatus | null;
    packages: Awaited<ReturnType<typeof dfyService.listDfyPackages>>;
    localTier: 'lite' | 'core' | null;
  }): LookbookEmptyMode => {
    if (
      hasCoreLookbookRedirectSignal({
        access: options.access,
        packages: options.packages,
        localDeliveryTier: options.localTier,
        subscriptionTier: user?.subscriptionTier,
      })
    ) {
      return 'core';
    }
    return 'unlock';
  };

  const openCoreCalendar = (corePackageId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace('DFYCalendar', {
      tier: 'core',
      ...(corePackageId ? { packageId: corePackageId } : {}),
    });
  };

  const loadDelivery = async () => {
    if (!user?.id) return;
    setEmptyMode('loading');
    setDelivery(null);

    let access: DFYAccessStatus | null = null;
    try {
      access = await dfyService.checkDFYAccess(user.id, user.subscriptionTier);
      setAccessStatus(access);
    } catch {
      setAccessStatus(null);
    }

    const stylistId = (user.stylistPreferences?.selectedStylistId || 'ruby') as StylistId;

    if (packageId) {
      const pkg = await dfyService.getDfyPackage(packageId);
      if (!pkg) {
        setPackageName(null);
        setEmptyMode('unlock');
        return;
      }
      // Core packages belong on Calendar / Modular Wardrobe — not the Lite day grid.
      if (pkg.tier === 'core') {
        openCoreCalendar(pkg.id);
        return;
      }
      setPackageName(pkg.name);
      const mapped = dfyService.mapPackagePayloadToLiteDelivery(user.id, pkg, stylistId);
      if (!mapped) {
        setEmptyMode('unlock');
        return;
      }
      const hydrated = enrichDeliveryWithWardrobeImages(
        ensureLookbookOutfitsHaveFootwear(
          stripInvalidLookbookOutfits(normalizeLiteDelivery(mapped), wardrobeItems),
          wardrobeItems,
        ),
        wardrobeItems,
      );
      setDelivery(hydrated);
      setCurrentDay(liveCurrentDayFor(hydrated));
      setEmptyMode(null);
      return;
    }

    setPackageName(null);
    const saved = await dfyService.getDFYDelivery(user.id);
    if (saved && saved.tier === 'lite') {
      await applyLiteDelivery(saved as DFYLiteDelivery);
      return;
    }

    const packages = await dfyService.listDfyPackages();
    const litePkg = pickLiteLookbookPackage(packages);
    if (litePkg?.id) {
      const pkg = await dfyService.getDfyPackage(litePkg.id);
      if (pkg) {
        const mapped = dfyService.mapPackagePayloadToLiteDelivery(user.id, pkg, stylistId);
        if (mapped) {
          setPackageName(pkg.isActive ? null : pkg.name);
          await applyLiteDelivery(mapped, {
            persistCorrections: pkg.isActive,
            backfill: pkg.isActive,
          });
          return;
        }
      }
    }

    try {
      const remote = await apiService.getDFYLookbook();
      if (remote.success && remote.outfits && remote.outfits.length > 0) {
        const mappedOutfits = mapApiOutfitsToDelivery(remote.outfits, stylistId);
        const startDate = new Date().toISOString();
        const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const remoteDelivery: DFYLiteDelivery = {
          userId: user.id,
          tier: 'lite',
          startDate,
          expiryDate,
          totalDays: 14,
          currentDay: 1,
          completed: false,
          nudgesShown: [],
          outfits: mappedOutfits,
        };
        await applyLiteDelivery(remoteDelivery);
        return;
      }
    } catch (err) {
      console.log('[DFYLookbook] Remote lookbook fetch failed:', err);
    }

    setEmptyMode(
      resolveEmptyMode({
        access,
        packages,
        localTier: saved?.tier === 'core' ? 'core' : null,
      }),
    );
  };

  // Re-hydrate item photos when wardrobe finishes loading on device
  useEffect(() => {
    if (isHistorical || !delivery || wardrobeItems.length === 0) return;
    const hydrated = enrichDeliveryWithWardrobeImages(delivery, wardrobeItems);
    const gainedImages = hydrated.outfits.some((outfit, idx) =>
      outfit.items.some((item, itemIdx) => {
        const prev = delivery.outfits[idx]?.items[itemIdx];
        return item.imageUri && !prev?.imageUri;
      }),
    );
    const totalDays = hydrated.totalDays || 14;
    const needsMoreDays = countFilledLookbookDays(hydrated) < totalDays;

    if (gainedImages || needsMoreDays) {
      if (needsMoreDays && wardrobeItems.length >= 2) {
        backfillStartedRef.current = false;
        void populateLookbookOutfits(hydrated, {
          fillGapsOnly: true,
        });
      } else if (gainedImages) {
        setDelivery(hydrated);
        void dfyService.saveDFYDelivery(hydrated);
      }
    }
  }, [wardrobeItems, isHistorical]);

  const mapApiOutfitsToDelivery = (rawOutfits: any[], stylistId: StylistId): DFYOutfit[] =>
    rawOutfits.map((o, idx) => ({
      id: o.id || `outfit_${idx + 1}`,
      dayNumber: o.day || o.dayNumber || idx + 1,
      title: o.title || outfitTitle(idx),
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
      stylistNote: o.stylistNote,
      weatherNote: o.weatherNote,
      stylistId: (o.stylistId || stylistId) as StylistId,
      userReaction: null,
      saved: false,
    }));

  const populateLookbookOutfits = async (
    existingDelivery: DFYLiteDelivery,
    options: { fillGapsOnly?: boolean; force?: boolean } = {},
  ) => {
    if (isHistorical || !user?.id || isGenerating) return;

    const fillGapsOnly = Boolean(options.fillGapsOnly) && !options.force;
    const totalDays = existingDelivery.totalDays || LITE_LOOKBOOK_DAYS;
    const filledCount = countFilledLookbookDays(existingDelivery);

    if (fillGapsOnly && filledCount >= totalDays) {
      return;
    }

    if (
      !options.force
      && backfillStartedRef.current
      && filledCount >= LITE_LOOKBOOK_DAYS
    ) {
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    const stylistId = (user.stylistPreferences?.selectedStylistId || 'ruby') as StylistId;

    try {
      const scaffold = normalizeLiteDelivery(existingDelivery);
      const trip = scaffold.travelPlan;
      const forecast = trip?.destination
        ? await weatherService.getForecastForDestination(trip.destination, trip.lat, trip.lon)
        : await weatherService.get14DayForecast();

      // Travel Capsule engine — packs subset, then allocates 14 looks. Never keep server inventory.
      const generated = generateLiteLookbook({
        userId: user.id,
        wardrobeItems,
        stylistId,
        existing: scaffold,
        forecast,
        travelPlan: trip,
        options: { fillGapsOnly: options.fillGapsOnly, force: options.force },
      });

      if (!generated) {
        setGenerateError(
          t('dfy.lookbook.buildFailed')
          || 'Add a few more wardrobe pieces (top, bottom, shoes) so we can build your 14-day lookbook.',
        );
        return;
      }

      // Optional: AI day titles only — never adopt server inventory or notes (they named wrong pieces)
      try {
        const coords = forecast
          ? { lat: forecast.lat, lon: forecast.lon, locationName: forecast.location }
          : await weatherService.getLocationCoords();
        const result = await apiService.generateDFYLookbook({
          stylistId,
          lat: coords?.lat,
          lon: coords?.lon,
          location: coords?.locationName || forecast?.location,
        });
        const rawOutfits = result.outfits || [];
        if (rawOutfits.length > 0) {
          const mappedOutfits = mapApiOutfitsToDelivery(rawOutfits, stylistId);
          generated.outfits = generated.outfits.map((slot, idx) => {
            const source = mappedOutfits[idx];
            if (!source?.title || slot.saved || slot.userReaction === 'love') return slot;
            // When fillGapsOnly, don't overwrite titles on already-filled days
            if (fillGapsOnly && scaffold.outfits[idx]?.items?.length) return slot;
            return { ...slot, title: source.title };
          });
        }
      } catch (apiErr: any) {
        console.log('[DFYLookbook] Server titles unavailable (local inventory kept):', apiErr?.message || apiErr);
      }

      let working = ensureLookbookOutfitsHaveFootwear(
        stripInvalidLookbookOutfits(generated, wardrobeItems),
        wardrobeItems,
      );
      // If strip cleared any days, rebuild gaps only (never force full wipe)
      if (countFilledLookbookDays(working) < LITE_LOOKBOOK_DAYS) {
        const rebuilt = generateLiteLookbook({
          userId: user.id,
          wardrobeItems,
          stylistId,
          existing: working,
          forecast,
          options: { fillGapsOnly: true },
        });
        if (rebuilt) working = rebuilt;
      }

      working = normalizeLiteDelivery(working);
      const liveDay = liveCurrentDayFor(working);
      working = { ...working, currentDay: liveDay };
      await dfyService.saveDFYDelivery(working);
      setDelivery(working);
      setCurrentDay(liveDay);

      if (countFilledLookbookDays(working) < LITE_LOOKBOOK_DAYS) {
        setGenerateError(t('dfy.lookbook.someDaysUnfilled'));
      }

      if (options.force) {
        void maybePromptPackageName();
      }
    } catch (err: any) {
      console.log('[DFYLookbook] Lookbook generation failed:', err);
      setGenerateError(err?.message || t('dfy.lookbook.buildFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOutfitPress = (outfit: DFYOutfit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOutfit(outfit);
    setShowOutfitModal(true);
  };

  const applyLookbookOutfitMeta = async (
    name: string,
    description?: string,
    options?: { loved?: boolean; bookmark?: boolean },
  ) => {
    if (isHistorical || !selectedOutfit || !delivery) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const updatedOutfits = delivery.outfits.map((o) =>
      o.id === selectedOutfit.id
        ? {
            ...o,
            title: name,
            description: description || o.description,
            userReaction: options?.loved ? 'love' as const : o.userReaction,
            saved: options?.bookmark ? true : (options?.loved ? true : o.saved),
          }
        : o,
    );

    const updatedDelivery = { ...delivery, outfits: updatedOutfits };
    await dfyService.saveDFYDelivery(updatedDelivery);
    setDelivery(updatedDelivery);
    const updated = updatedOutfits.find((o) => o.id === selectedOutfit.id) || null;
    setSelectedOutfit(updated);
  };

  const openSavePrompt = (intent: SaveOutfitIntent) => {
    if (!selectedOutfit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavePromptIntent(intent);
    setShowSavePrompt(true);
  };

  const handleReaction = async (reaction: 'love' | 'not-me') => {
    if (!selectedOutfit || !delivery) return;
    if (reaction === 'love') {
      openSavePrompt('love');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedOutfits = delivery.outfits.map(o =>
      o.id === selectedOutfit.id ? { ...o, userReaction: reaction } : o
    );

    const updatedDelivery = { ...delivery, outfits: updatedOutfits };
    await dfyService.saveDFYDelivery(updatedDelivery);
    setDelivery(updatedDelivery);
    setSelectedOutfit({ ...selectedOutfit, userReaction: reaction });
  };

  const handleSaveOutfit = async () => {
    openSavePrompt('save');
  };

  const getTotalDays = (): number => {
    if (delivery?.tier === 'lite') return LITE_LOOKBOOK_DAYS;
    return delivery?.totalDays || LITE_LOOKBOOK_DAYS;
  };

  /**
   * Days left in the trip lookbook window (Day 3 of 14 → 12).
   * Prefer live startDate+today so progress matches the calendar, not a frozen access window.
   */
  const getDaysRemaining = (): number => {
    const cap = getTotalDays();
    const tripStart = delivery ? resolveTripStartIso(delivery) : null;
    if (tripStart) {
      return computeLookbookDaysRemaining(tripStart, new Date(), cap);
    }

    let remaining = cap;
    if (typeof accessStatus?.daysRemaining === 'number') {
      remaining = Math.max(0, accessStatus.daysRemaining);
    } else {
      const expiryRaw = delivery?.expiryDate || accessStatus?.expiryDate;
      if (expiryRaw) {
        const expiry = new Date(expiryRaw);
        if (!Number.isNaN(expiry.getTime())) {
          remaining = Math.max(
            0,
            Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          );
        }
      }
    }

    return Math.min(remaining, cap);
  };

  const formatDayOf = (day: number): string => {
    const total = getTotalDays();
    const template = t('dfy.lookbook.dayOf') || 'Day {day} of {total}';
    if (template.includes('{day}')) {
      return template.replace('{day}', String(day)).replace('{total}', String(total));
    }
    return `Day ${day} of ${total}`;
  };

  const formatLookbookCardDate = (dayNumber: number): string | null => {
    if (!delivery) return null;
    const date = lookbookDateForDay(resolveTripStartIso(delivery), dayNumber);
    if (!date) return null;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const renderLookbookDayHeader = (outfit: DFYOutfit, vibeLabel?: string, accent?: string) => {
    const cardDate = formatLookbookCardDate(outfit.dayNumber);
    return (
      <View style={styles.outfitCardHeader}>
        {cardDate ? (
          <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 4 }}>
            {cardDate}
          </ThemedText>
        ) : null}
        <ThemedText type="caption" style={{ opacity: 0.5, marginBottom: 2 }}>
          {formatDayOf(outfit.dayNumber)}
        </ThemedText>
        <ThemedText type="h3" numberOfLines={2}>
          {outfit.title}
        </ThemedText>
        {vibeLabel ? (
          <View style={[styles.vibeBadge, { backgroundColor: (accent || LUXURY_COLORS.coral) + '20' }]}>
            <ThemedText type="caption" style={{ color: accent || LUXURY_COLORS.coral, fontWeight: '600' }}>
              {vibeLabel}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  };

  const formatDaysLeft = (count: number): string => {
    if (count <= 0) {
      return t('dfy.lookbook.ended') || 'Ended';
    }
    const template =
      t('dfy.lookbook.daysLeft') ||
      (count === 1 ? '{count} day left' : '{count} days left');
    if (template.includes('{count}')) {
      const filled = template.replace('{count}', String(count));
      if (count === 1) return filled.replace(/\bdays\b/i, 'day');
      return filled;
    }
    return count === 1 ? `${count} day left` : `${count} days left`;
  };

  const stylistColors = delivery?.outfits[0]?.stylistId
    ? STYLIST_COLORS[delivery.outfits[0].stylistId]
    : STYLIST_COLORS.ruby;

  const renderOutfitVisual = (outfit: DFYOutfit, height: number = 220) => (
    <DFYOutfitVisual
      outfit={outfit}
      wardrobeItems={wardrobeItems}
      canvasWidth={CARD_WIDTH}
      minHeight={height}
      emptyMessage={outfit.items?.length ? t('dfy.lookbook.photosLoading') : t('dfy.lookbook.piecesComingSoon')}
    />
  );

  const renderOutfitCard = useCallback(({ item, index }: { item: DFYOutfit; index: number }) => {
    const isCurrentDay = item.dayNumber === currentDay;
    const colors = item.stylistId ? STYLIST_COLORS[item.stylistId] : STYLIST_COLORS.ruby;
    const hasItems = item.items && item.items.length > 0;
    const vibeLabel = (item as any).vibeLabel as string | undefined;

    return (
      <Pressable
        onPress={() => handleOutfitPress(item)}
        style={({ pressed }) => [
          styles.outfitCard,
          { opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        <View style={[styles.outfitCardGradient, { backgroundColor: isDark ? '#1E1E2E' : '#FFFFFF' }]}>
          {renderLookbookDayHeader(item, vibeLabel, colors.accent)}

          <View style={styles.outfitImageContainer}>
            {renderOutfitVisual(item, 220)}

            {/* Overlaid badges */}
            {isCurrentDay && (
              <LinearGradient
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.currentDayBadge}
              >
                <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {t('dfy.lookbook.today')}
                </ThemedText>
              </LinearGradient>
            )}
            {item.saved && (
              <View style={[styles.savedBadgeOverlay, { backgroundColor: LUXURY_COLORS.emerald }]}>
                <Feather name="bookmark" size={12} color="#FFFFFF" />
              </View>
            )}
            {item.userReaction && (
              <View style={[styles.reactionOverlay, { backgroundColor: item.userReaction === 'love' ? LUXURY_COLORS.rose + 'EE' : LUXURY_COLORS.coral + 'EE' }]}>
                <Feather name={item.userReaction === 'love' ? 'heart' : 'x'} size={12} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Details below the visual */}
          <View style={styles.outfitInfo}>
            {item.weatherNote ? (
              <View style={styles.weatherNotePreview}>
                <Feather name="cloud" size={12} color={colors.accent} />
                <ThemedText type="caption" style={{ marginLeft: 6, opacity: 0.7, flex: 1 }}>
                  {item.weatherNote}
                </ThemedText>
              </View>
            ) : null}

            {item.stylistNote ? (
              <View style={[styles.stylistNotePreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <View style={[styles.stylistAvatar, { backgroundColor: colors.accent }]}>
                  <Feather name="user" size={10} color="#FFFFFF" />
                </View>
                <ThemedText type="small" numberOfLines={2} style={{ flex: 1, opacity: 0.8, fontStyle: 'italic' }}>
                  "{item.stylistNote}"
                </ThemedText>
              </View>
            ) : null}

            {hasItems ? (
              <View style={styles.itemPillsRow}>
                {sortOutfitItemsByVisualOrder(item.items).slice(0, 3).map((it, k) => (
                  <View key={k} style={[styles.itemPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption" numberOfLines={1} style={{ opacity: 0.75 }}>
                      {it.name}
                    </ThemedText>
                  </View>
                ))}
                {item.items.length > 3 ? (
                  <View style={[styles.itemPill, { backgroundColor: colors.accent + '25' }]}>
                    <ThemedText type="caption" style={{ color: colors.accent }}>
                      +{item.items.length - 3}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }, [currentDay, isDark, delivery, t]);

  const renderOutfitModal = () => {
    if (!selectedOutfit) return null;
    const colors = selectedOutfit.stylistId ? STYLIST_COLORS[selectedOutfit.stylistId] : STYLIST_COLORS.ruby;

    return (
      <Modal
        visible={showOutfitModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOutfitModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <LinearGradient
            colors={[colors.gradient[0] + '30', 'transparent']}
            style={styles.modalHeaderGradient}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                onPress={() => setShowOutfitModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">{selectedOutfit.title}</ThemedText>
              <Pressable
                onPress={handleSaveOutfit}
                style={[styles.modalCloseButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              >
                <Feather
                  name="bookmark"
                  size={20}
                  color={selectedOutfit.saved ? LUXURY_COLORS.gold : theme.tabIconDefault}
                />
              </Pressable>
            </View>
          </LinearGradient>

          <FlatList
            data={[selectedOutfit]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <>
                {renderLookbookDayHeader(selectedOutfit, (selectedOutfit as any).vibeLabel, colors.accent)}

                {/* Main outfit visual */}
                <View style={[styles.outfitDetailImage, { overflow: 'hidden', borderRadius: BorderRadius.lg, backgroundColor: '#FFFFFF' }]}>
                  {renderOutfitVisual(selectedOutfit, 300)}
                </View>

                {/* Item breakdown — horizontal scroll of item photos/pills */}
                {selectedOutfit.items && selectedOutfit.items.length > 0 ? (
                  <View style={styles.modalItemsSection}>
                    <ThemedText type="small" style={{ opacity: 0.5, marginBottom: Spacing.sm, marginLeft: Spacing.xs }}>
                      {t('dfy.lookbook.thePieces').replace('{count}', String(selectedOutfit.items.length))}
                    </ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
                      {sortOutfitItemsByVisualOrder(selectedOutfit.items).map((outfitItem) => {
                        const wardrobeMatch = findWardrobeItemForDFYOutfitItem(outfitItem, wardrobeItems);
                        const itemUri =
                          resolveDFYItemImageUri(outfitItem as RawDFYOutfitItem, wardrobeMatch)
                          || (wardrobeMatch ? resolveDFYItemImageUri({ ...outfitItem, id: wardrobeMatch.id } as RawDFYOutfitItem, wardrobeMatch) : undefined);
                        const categoryKey = String(outfitItem.category || wardrobeMatch?.category || '') as ClothingCategory;
                        const categoryLabel =
                          CATEGORY_LABELS[categoryKey]
                          || String(outfitItem.category || '').replace(/_/g, ' ');
                        return (
                        <View key={outfitItem.id} style={styles.modalItemCard}>
                          {itemUri ? (
                            <View style={[styles.modalItemImage, { backgroundColor: isDark ? '#1A1A2E' : '#F7F5F2' }]}>
                              <Image source={{ uri: itemUri }} style={styles.modalItemImage} contentFit="contain" />
                            </View>
                          ) : (
                            <View style={[styles.modalItemImage, { backgroundColor: outfitItem.color || (isDark ? '#2A2A3E' : '#F0EDE8'), alignItems: 'center', justifyContent: 'center' }]}>
                              {!outfitItem.color && (
                                <Feather name="package" size={20} color={colors.accent} />
                              )}
                            </View>
                          )}
                          <ThemedText type="caption" numberOfLines={1} style={{ marginTop: 4, textAlign: 'center', maxWidth: 80 }}>
                            {outfitItem.name}
                          </ThemedText>
                          <ThemedText type="caption" style={{ opacity: 0.45, textAlign: 'center', textTransform: 'capitalize' }}>
                            {categoryLabel}
                          </ThemedText>
                        </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {selectedOutfit.weatherNote ? (
                  <View style={[styles.weatherNoteCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <Feather name="cloud" size={16} color={colors.accent} />
                    <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                      {selectedOutfit.weatherNote}
                    </ThemedText>
                  </View>
                ) : null}

                {selectedOutfit.stylistNote && (
                  <View style={[styles.stylistNoteCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <LinearGradient
                      colors={colors.gradient}
                      style={styles.stylistNoteAvatar}
                    >
                      <Feather name="user" size={16} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.stylistNoteContent}>
                      <ThemedText type="small" style={{ color: colors.accent, fontWeight: '600' }}>
                        {t('dfy.lookbook.stylistNote')}
                      </ThemedText>
                      <ThemedText style={{ marginTop: 4, lineHeight: 22 }}>
                        "{selectedOutfit.stylistNote}"
                      </ThemedText>
                    </View>
                  </View>
                )}

                <View style={styles.reactionSection}>
                  <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
                    {t('dfy.lookbook.whatDoYouThink')}
                  </ThemedText>
                  <View style={styles.reactionButtons}>
                    <Pressable
                      onPress={() => handleReaction('love')}
                      style={[
                        styles.reactionButton,
                        selectedOutfit.userReaction === 'love' && { borderColor: LUXURY_COLORS.rose, borderWidth: 2 }
                      ]}
                    >
                      <LinearGradient
                        colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
                        style={styles.reactionButtonGradient}
                      >
                        <Feather name="heart" size={24} color="#FFFFFF" />
                      </LinearGradient>
                      <ThemedText type="small" style={{ marginTop: 6 }}>{t('dfy.lookbook.love')}</ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => handleReaction('not-me')}
                      style={[
                        styles.reactionButton,
                        selectedOutfit.userReaction === 'not-me' && { borderColor: LUXURY_COLORS.coral, borderWidth: 2 }
                      ]}
                    >
                      <LinearGradient
                        colors={[LUXURY_COLORS.coral, '#C46A4F']}
                        style={styles.reactionButtonGradient}
                      >
                        <Feather name="x" size={24} color="#FFFFFF" />
                      </LinearGradient>
                      <ThemedText type="small" style={{ marginTop: 6 }}>{t('dfy.lookbook.notMe')}</ThemedText>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.infoNote, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <Feather name="info" size={16} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, opacity: 0.7 }}>
                    {t('dfy.lookbook.stylistLedNote')}
                  </ThemedText>
                </View>
              </>
            )}
          />
        </View>
      </Modal>
    );
  };

  if (!delivery) {
    const isCoreEmpty = emptyMode === 'core';
    const isLoadingEmpty = emptyMode === 'loading' || emptyMode === null;
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={
            isCoreEmpty
              ? [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold, LUXURY_COLORS.obsidian]
              : [LUXURY_COLORS.coral, '#C46A4F', LUXURY_COLORS.obsidian]
          }
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('dfy.lookbook.title')}</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          {isLoadingEmpty ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <Feather
                name={isCoreEmpty ? 'calendar' : 'book-open'}
                size={64}
                color="rgba(255,255,255,0.3)"
              />
              <ThemedText type="h3" style={{ color: '#FFFFFF', marginTop: Spacing.lg }}>
                {isCoreEmpty
                  ? (t('dfy.lookbook.coreRedirectTitle') || 'Your Full Setup lives in the Calendar')
                  : (t('dfy.lookbook.noLookbookTitle') || 'No lookbook yet')}
              </ThemedText>
              <ThemedText style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: Spacing.sm }}>
                {isCoreEmpty
                  ? (t('dfy.lookbook.coreRedirectMessage') ||
                    'Travel Capsule lookbooks are day grids. Your Full Wardrobe Setup is on the 30-day Calendar (and Modular Wardrobe).')
                  : (t('dfy.lookbook.noLookbookMessage') ||
                    'Complete Decide For You to unlock your lookbook.')}
              </ThemedText>
              {isCoreEmpty ? (
                <Pressable
                  onPress={() => openCoreCalendar()}
                  style={({ pressed }) => [
                    styles.coreRedirectButton,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Feather name="calendar" size={18} color={LUXURY_COLORS.midnight} />
                  <ThemedText type="small" style={styles.coreRedirectButtonText}>
                    {t('dfy.lookbook.openCalendarCta') || 'Open 30-day Calendar'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={[stylistColors.gradient[0], stylistColors.gradient[1], LUXURY_COLORS.obsidian]}
        locations={[0, 0.25, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }} numberOfLines={1}>
            {isHistorical && packageName
              ? packageName
              : (t('dfy.lookbook.title') || 'Lookbook')}
          </ThemedText>
          {!isHistorical ? (
            <View style={[styles.daysRemainingBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <ThemedText type="caption" style={{ color: '#FFFFFF' }}>
                {formatDaysLeft(getDaysRemaining())}
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.daysRemainingBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <ThemedText type="caption" style={{ color: '#FFFFFF' }}>
                {t('dfy.package.savedPlan') || 'Saved plan'}
              </ThemedText>
            </View>
          )}
        </View>
        {!isHistorical ? (
          <Pressable
            onPress={() => navigation.navigate('DFYCalendar', { tier: 'lite' })}
            style={styles.calendarButton}
          >
            <Feather name="calendar" size={20} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={[stylistColors.accent, stylistColors.gradient[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${(currentDay / getTotalDays()) * 100}%` }]}
          />
        </View>
        <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
          {formatDayOf(currentDay)}
        </ThemedText>
      </View>

      {isGenerating && (
        <View style={[styles.generatingBanner, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: Spacing.sm }}>
            {t('dfy.lookbook.fillingDays')}
          </ThemedText>
        </View>
      )}

      {generateError && !isGenerating ? (
        <View style={[styles.generatingBanner, { backgroundColor: 'rgba(224, 122, 95, 0.35)' }]}>
          <Feather name="alert-circle" size={14} color="#FFFFFF" />
          <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: Spacing.sm, flex: 1 }}>
            {generateError}
          </ThemedText>
        </View>
      ) : null}

      <FlatList
        data={delivery.outfits}
        renderItem={renderOutfitCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          !isGenerating && !isHistorical ? (
            <Pressable
              onPress={() => {
                if (!delivery) return;
                backfillStartedRef.current = false;
                void populateLookbookOutfits(delivery, { force: true });
              }}
              style={[styles.regenerateButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
            >
              <Feather name="refresh-cw" size={14} color="rgba(255,255,255,0.7)" />
              <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.7)', marginLeft: Spacing.xs }}>
                {t('dfy.lookbook.refreshOutfits')}
              </ThemedText>
            </Pressable>
          ) : null
        }
      />

      {renderOutfitModal()}

      <SaveOutfitPromptModal
        visible={showSavePrompt && !isHistorical}
        intent={savePromptIntent}
        wardrobeItemIds={selectedOutfit?.items?.map((item) => String(item.id)) || ['lookbook']}
        defaultTitle={
          selectedOutfit?.title ||
          (t('dfy.lookbook.dayLookFallback') || 'Day {day} Look').replace(
            '{day}',
            String(selectedOutfit?.dayNumber || ''),
          )
        }
        defaultDescription={selectedOutfit?.description || selectedOutfit?.stylistNote}
        onClose={() => setShowSavePrompt(false)}
        onCustomSave={async ({ name, description }) => {
          await applyLookbookOutfitMeta(name, description, {
            loved: savePromptIntent === 'love',
            bookmark: savePromptIntent === 'save',
          });
        }}
      />

      <DFYPackageNameModal
        visible={showPackageNamePrompt}
        defaultName={packageNameDefault}
        onClose={() => setShowPackageNamePrompt(false)}
        onSave={async (name) => {
          if (!renamePackageId) return;
          try {
            await dfyService.renameDfyPackage(renamePackageId, name);
            setPackageName(name);
          } catch {
            Alert.alert(
              t('common.error') || 'Error',
              t('dfy.package.renameFailed') || 'Could not save the plan name. Please try again.',
            );
            throw new Error('rename failed');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  daysRemainingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  outfitCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  outfitCardGradient: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  outfitCardHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  outfitImageContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  currentDayBadge: {
    position: 'absolute',
    top: 0,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    zIndex: 10,
  },
  savedBadgeOverlay: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  reactionOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  outfitInfo: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  outfitTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  vibeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  weatherNotePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  weatherNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  stylistNotePreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingRight: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  stylistAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  itemPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    maxWidth: 140,
  },
  savedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  modalItemsSection: {
    marginBottom: Spacing.lg,
  },
  generatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  coreRedirectButton: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  coreRedirectButtonText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeaderGradient: {
    paddingBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: Spacing.xl,
  },
  outfitDetailImage: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  modalItemCard: {
    width: 120,
    alignItems: 'center',
  },
  modalItemImage: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  stylistNoteCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  stylistNoteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylistNoteContent: {
    flex: 1,
    paddingRight: Spacing.sm,
    minWidth: 0,
  },
  reactionSection: {
    marginBottom: Spacing.lg,
  },
  reactionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  reactionButton: {
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  reactionButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
