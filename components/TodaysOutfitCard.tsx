import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  useWindowDimensions,
  AppState,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { SafeOutfitPieces } from '@/components/SafeOutfitPieces';
import { SaveOutfitPromptModal } from '@/components/outfit/SaveOutfitPromptModal';
import { WardrobeImageShimmer } from '@/components/WardrobeImageShimmer';
import { wardrobeIdsFromPieces } from '@/utils/saveGeneratedOutfit';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWardrobe, type PlannedEventType } from '@/contexts/WardrobeContext';
import { onboardingProfileService } from '@/services/OnboardingProfileService';
import {
  generateTodaysWardrobeOutfit,
  prewarmTodaysWardrobeOutfit,
  resolveCachedTodaysOutfit,
  type WardrobeTodaysOutfit,
} from '@/services/TodaysOutfitGenerator';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { apiService } from '@/services/ApiService';
import {
  getTodaysOutfitPopupPrefs,
  isWithinTodaysOutfitPopupWindow,
} from '@/utils/todaysOutfitPrefs';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { traceTodaysOutfit } from '@/utils/todaysOutfitTrace';
import { syncTodaysOutfitLocalNotification } from '@/services/todaysOutfitLocalNotify';
import { analyzeRotationVsYesterday } from '@/utils/styleMemory7d';
import { dateKeyInTimeZone, TODAYS_OUTFIT_TIMEZONE } from '@/utils/todaysOutfitTime';
import {
  TODAYS_OUTFIT_SUBTITLE_CONTRACT,
  hydrateDailyState,
  setSavedDaily,
  setWornDaily,
  type TodaysOutfitDailyState,
} from '@/utils/todaysOutfitDailyStore';
import {
  TODAYS_OUTFIT_GENERATE_TIMEOUT_MS,
  cancelOpenSession,
  withTimeout,
} from '@/utils/todaysOutfitControlFlow';
import {
  consumeTodaysOutfitIntent,
  subscribeTodaysOutfitIntent,
} from '@/utils/todaysOutfitIntentBus';
import {
  wardrobeReadyForTodaysOutfitAutoPopup,
} from '@/utils/wardrobeOutfitReadiness';

type TodaysOutfitCardState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  onOpenStylist?: (prompt: string) => void;
  onRefresh?: () => void;
  /** Legacy route param — treated exactly like a chip tap / intent. */
  openToday?: boolean;
};

const DISMISS_KEY_PREFIX = '@dripn_todays_outfit_dismissed_';
/** Legacy one-shot worn flag — migrated into daily store once. */
const LEGACY_WORN_KEY_PREFIX = '@dripn_todays_outfit_worn_';
const PAID_PLAN_REQUIRED_MESSAGE =
  'A paid stylist plan is required for this feature.';
/** Prefer no spinner: hold sheet closed briefly while generate finishes. */
const OPEN_SHEET_SOFT_HOLD_MS = 550;

function hasPaidTodaysOutfitAccess(subscriptionTier?: string | null): boolean {
  const tier = normalizeSubscriptionTier(subscriptionTier);
  return tier === 'personal_stylist' || tier === 'stylist_unlimited';
}
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;

function mapOccasionToPlannedEvent(
  dressFor?: string,
  occasionType?: string,
): PlannedEventType {
  if (dressFor === 'work' || occasionType === 'work_outfit' || occasionType === 'smart_casual') {
    return 'work';
  }
  if (dressFor === 'date' || occasionType === 'date_night') return 'date-night';
  if (dressFor === 'event' || occasionType === 'evening_out') return 'party';
  if (occasionType === 'gym') return 'workout';
  if (occasionType === 'travel') return 'travel';
  if (occasionType === 'formal') return 'formal';
  return 'everyday';
}

function todayKey(now: Date = new Date()) {
  // Align dismiss / rollover with UK calendar day (Appear-at is Europe/London).
  return dateKeyInTimeZone(now, TODAYS_OUTFIT_TIMEZONE);
}

function todayPlannedDateIso() {
  // Persist with the same UK calendar day key used for dismiss / wear checks.
  return `${todayKey()}T12:00:00.000Z`;
}

function formatTodayBadgeDate(locale?: string) {
  const now = new Date();
  const weekday = now.toLocaleDateString(locale || 'en-GB', { weekday: 'long' });
  const datePart = now.toLocaleDateString(locale || 'en-GB', { day: 'numeric', month: 'short' });
  return `${weekday} · ${datePart}`;
}

function ZoomableOutfitVisual({
  pieces,
  wardrobeItems,
  canvasWidth,
}: {
  pieces: Array<{ wardrobeItemId: string; name: string; category: string; imageUrl?: string }>;
  wardrobeItems: WardrobeItem[];
  canvasWidth: number;
}) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  // Fail when not zoomed so one-finger drags scroll the sheet instead of fighting the outfit pan.
  const pan = Gesture.Pan()
    .maxPointers(2)
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      'worklet';
      if (scale.value > 1.05) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(1.8);
        savedScale.value = 1.8;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const resetZoom = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  return (
    <View style={styles.visualBlock}>
      <View
        style={[
          styles.visualFrame,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' },
        ]}
      >
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.zoomCanvas, animatedStyle]}>
            <SafeOutfitPieces
              pieces={pieces}
              wardrobeItems={wardrobeItems}
              label=""
              tight
              canvasWidth={canvasWidth}
              visualScale={1.12}
            />
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.zoomControls}>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
          Pinch to zoom · double-tap
        </ThemedText>
        <Pressable onPress={resetZoom} hitSlop={8} style={styles.resetZoomBtn}>
          <Feather name="maximize-2" size={14} color="#C9A87C" />
          <ThemedText type="caption" style={{ color: '#C9A87C', fontWeight: '600' }}>
            Reset
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export function TodaysOutfitCard({ onRefresh, openToday }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const {
    items: wardrobeItems,
    plannedOutfits,
    planOutfit,
    markPlannedOutfitWorn,
    updatePlannedOutfit,
  } = useWardrobe();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const [outfit, setOutfit] = useState<WardrobeTodaysOutfit | null>(null);
  const [pieces, setPieces] = useState<WardrobeItem[]>([]);
  const [cardState, setCardState] = useState<TodaysOutfitCardState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  /** Separate from outfit dismiss — empty-wardrobe guidance must reopen from the chip. */
  const [gapVisible, setGapVisible] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  /** True while handing off to Save modal so the chip does not flash. */
  const [saveHandoff, setSaveHandoff] = useState(false);
  /** After Save closes, restore the outfit sheet (iOS can't stack two Modals reliably). */
  const restoreOutfitAfterSaveRef = useRef(false);
  const [wearBusy, setWearBusy] = useState(false);
  const [dailyState, setDailyState] = useState<TodaysOutfitDailyState | null>(null);
  const autoPopupCheckedRef = useRef(false);
  /** Buttons only act on this stable outfit id once cardState is ready. */
  const actionOutfitIdRef = useRef<string | null>(null);
  /** Last local calendar day we loaded / showed — detects midnight rollover. */
  const activeDateKeyRef = useRef<string>(todayKey());
  const loadGenRef = useRef(0);
  const visibleRef = useRef(false);
  const wardrobeItemsRef = useRef(wardrobeItems);
  const userRef = useRef(user);
  wardrobeItemsRef.current = wardrobeItems;
  userRef.current = user;
  visibleRef.current = visible;

  const generating = cardState === 'loading';
  const actionsEnabled =
    cardState === 'ready'
    && Boolean(outfit?.id)
    && outfit?.id === actionOutfitIdRef.current
    && !wearBusy;

  const contentOpacity = useSharedValue(1);
  const contentFadeStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  const revealOutfitSheet = useCallback((opts?: { haptic?: boolean }) => {
    setVisible(true);
    contentOpacity.value = 0;
    contentOpacity.value = withTiming(1, { duration: 260 });
    if (opts?.haptic !== false) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [contentOpacity]);

  const applyReadyOutfit = useCallback((nextOutfit: WardrobeTodaysOutfit, nextPieces: WardrobeItem[]) => {
    actionOutfitIdRef.current = nextOutfit.id;
    setOutfit(nextOutfit);
    setPieces(nextPieces);
    setErrorMessage(null);
    setCardState('ready');
    void traceTodaysOutfit('render', { id: nextOutfit.id, pieceCount: nextPieces.length });
    // Persistence AFTER UI success — mirror only, never blocks generation.
    void hydrateDailyState(nextOutfit.id).then(async (merged) => {
      try {
        const legacy = await AsyncStorage.getItem(LEGACY_WORN_KEY_PREFIX + todayKey());
        if (legacy === '1' && !merged.worn) {
          const worn = await setWornDaily(nextOutfit.id);
          setDailyState(worn);
          await AsyncStorage.removeItem(LEGACY_WORN_KEY_PREFIX + todayKey());
          return;
        }
      } catch {
        // ignore migrate errors
      }
      setDailyState(merged);
    });
    void analyzeRotationVsYesterday(nextPieces, wardrobeItems).then((r) => {
      void traceTodaysOutfit('generate', {
        diversityTag: 'vs_yesterday',
        differs: r.differsFromYesterday,
        similarYesterday: r.similarYesterday,
        trioChanges: r.trioChanges,
        hasPrior: r.hasPrior,
        sharedIds: r.sharedIds,
        repetitionDays: r.repetitionDays,
        badge: r.badge,
        outfitId: nextOutfit.id,
      });
    });
  }, [wardrobeItems]);

  /**
   * Sacred core: tap → loadOutfit → render → act.
   * Nothing outside may prevent this from running.
   * No wardrobe hydrate wait. No HQG. No readiness gate.
   */
  const loadOutfit = useCallback(
    async (opts: { open?: boolean; forceRefresh?: boolean } = {}) => {
      const open = opts.open === true;
      const forceRefresh = opts.forceRefresh === true;
      const gen = ++loadGenRef.current;
      const stillCurrent = () => gen === loadGenRef.current;
      const currentUser = userRef.current;
      let softHoldTimer: ReturnType<typeof setTimeout> | null = null;

      if (open) {
        // Don't open the sheet yet — wait for cache / fast generate so notification
        // taps skip the loading flash whenever possible.
        setGapVisible(false);
        setShowSaveModal(false);
      }

      setCardState('loading');
      setErrorMessage(null);

      try {
        if (!hasPaidTodaysOutfitAccess(currentUser?.subscriptionTier)) {
          if (!stillCurrent()) return;
          setOutfit(null);
          setPieces([]);
          actionOutfitIdRef.current = null;
          setErrorMessage(PAID_PLAN_REQUIRED_MESSAGE);
          setCardState('error');
          if (open) {
            setVisible(false);
            setGapVisible(true);
          }
          return;
        }

        const items = wardrobeItemsRef.current;
        await onboardingProfileService.syncQuizGenderFromUserGender(currentUser?.gender);
        const profile = await onboardingProfileService.getProfile();
        if (!stillCurrent()) return;

        if (!forceRefresh) {
          const cached = await resolveCachedTodaysOutfit({
            wardrobeItems: items,
            profile,
            user: currentUser,
          });
          if (!stillCurrent()) return;
          if (cached) {
            applyReadyOutfit(cached.outfit, cached.items);
            if (open) revealOutfitSheet();
            onRefresh?.();
            return;
          }
        }

        // Cache miss — soft-hold the sheet closed while generate races; only show
        // skeleton if it takes longer than OPEN_SHEET_SOFT_HOLD_MS.
        if (open && !visibleRef.current) {
          softHoldTimer = setTimeout(() => {
            if (stillCurrent()) setVisible(true);
          }, OPEN_SHEET_SOFT_HOLD_MS);
        }

        const result = await withTimeout(
          generateTodaysWardrobeOutfit({
            wardrobeItems: items,
            profile,
            user: currentUser,
            forceRefresh,
          }),
          TODAYS_OUTFIT_GENERATE_TIMEOUT_MS,
        );
        if (softHoldTimer) {
          clearTimeout(softHoldTimer);
          softHoldTimer = null;
        }
        if (!stillCurrent()) return;

        if (!result.ok) {
          setErrorMessage(result.message || "Couldn't pick an outfit. Tap retry.");
          setCardState('error');
          if (open || visibleRef.current) setVisible(true);
          return;
        }

        applyReadyOutfit(result.outfit, result.items);
        if (open) revealOutfitSheet();
        else if (visibleRef.current) {
          contentOpacity.value = 0;
          contentOpacity.value = withTiming(1, { duration: 260 });
        }
        onRefresh?.();
      } catch (error) {
        console.warn('[TodaysOutfitCard] loadOutfit failed:', error);
        if (softHoldTimer) clearTimeout(softHoldTimer);
        if (!stillCurrent()) return;
        setErrorMessage("Couldn't pick an outfit. Tap retry.");
        setCardState('error');
        if (open || visibleRef.current) setVisible(true);
      } finally {
        if (softHoldTimer) clearTimeout(softHoldTimer);
      }
    },
    [applyReadyOutfit, contentOpacity, onRefresh, revealOutfitSheet],
  );

  /** Chip / intent / openToday — same path. If already ready, just show. */
  const openTodaysOutfit = useCallback(() => {
    void traceTodaysOutfit('trigger', { source: 'chip_tap' });
    consumeTodaysOutfitIntent();
    if (outfit && cardState === 'ready' && outfit.id === actionOutfitIdRef.current) {
      setGapVisible(false);
      revealOutfitSheet();
      void hydrateDailyState(outfit.id).then(setDailyState).catch(() => {});
      return;
    }
    void loadOutfit({ open: true });
  }, [outfit, cardState, loadOutfit, revealOutfitSheet]);
  const openTodaysOutfitRef = useRef(openTodaysOutfit);
  openTodaysOutfitRef.current = openTodaysOutfit;

  // Background hydrate on mount — never blocks chip tap.
  useEffect(() => {
    if (!user) {
      setCardState('idle');
      return;
    }
    activeDateKeyRef.current = todayKey();
    void traceTodaysOutfit('trigger', { source: 'mount', userId: user.id, dateKey: todayKey() });
    void loadOutfit({ open: false });
    void syncTodaysOutfitLocalNotification();
  }, [user?.id]);

  // Intent bus: notifications / deep links are remote chip taps.
  useEffect(() => {
    if (!user) return;
    return subscribeTodaysOutfitIntent((intent) => {
      if (intent !== 'OPEN_TODAYS_OUTFIT') return;
      void (async () => {
        try {
          await AsyncStorage.removeItem(DISMISS_KEY_PREFIX + todayKey());
        } catch {
          // ignore
        }
        openTodaysOutfitRef.current();
      })();
    });
  }, [user?.id]);

  // Legacy route param — same as intent.
  useEffect(() => {
    if (!openToday || !user) return;
    void (async () => {
      try {
        await AsyncStorage.removeItem(DISMISS_KEY_PREFIX + todayKey());
      } catch {
        // ignore
      }
      openTodaysOutfitRef.current();
    })();
  }, [openToday, user?.id]);

  useEffect(() => {
    if (!user || wardrobeItems.length < 4) return;
    void onboardingProfileService.getProfile().then((profile) => {
      void prewarmTodaysWardrobeOutfit({ wardrobeItems, profile, user });
    });
  }, [user?.id, wardrobeItems.length]);

  const maybeAutoOpenPopup = useCallback(async () => {
    if (!user || !outfit || visible || gapVisible || generating) return;

    const paid = hasPaidTodaysOutfitAccess(user.subscriptionTier);
    const readyForAuto = wardrobeReadyForTodaysOutfitAutoPopup(wardrobeItems);
    if (!paid || !readyForAuto) return;

    try {
      const dismissedToday = await AsyncStorage.getItem(DISMISS_KEY_PREFIX + todayKey());
      if (dismissedToday === '1') return;
      const prefs = await getTodaysOutfitPopupPrefs();
      if (prefs.enabled && isWithinTodaysOutfitPopupWindow(prefs)) {
        revealOutfitSheet({ haptic: false });
        void traceTodaysOutfit('trigger', {
          source: 'auto_popup',
          dateKey: todayKey(),
          appearAtHour: prefs.appearAtHour,
        });
      }
    } catch {
      // ignore
    }
  }, [user, outfit, visible, gapVisible, generating, wardrobeItems, revealOutfitSheet]);

  /** New local calendar day → drop stale cache UI and regenerate once. */
  const ensureFreshForToday = useCallback(async () => {
    const today = todayKey();
    if (activeDateKeyRef.current === today) {
      void maybeAutoOpenPopup();
      return;
    }
    activeDateKeyRef.current = today;
    autoPopupCheckedRef.current = false;
    setVisible(false);
    setDailyState(null);
    void traceTodaysOutfit('trigger', { source: 'day_rollover', dateKey: today });
    await loadOutfit({ open: false });
  }, [loadOutfit, maybeAutoOpenPopup]);

  useEffect(() => {
    if (!outfit || autoPopupCheckedRef.current) return;
    autoPopupCheckedRef.current = true;
    void maybeAutoOpenPopup();
  }, [outfit, maybeAutoOpenPopup]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void ensureFreshForToday();
    }, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void ensureFreshForToday();
    });
    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, [ensureFreshForToday]);

  const handleClose = async (
    signal: 'wore' | 'skipped' | null = 'skipped',
  ) => {
    if (signal && pieces.length > 0) {
      apiService
        .recordOutfitEngagement({
          items: pieces.map((item) => ({
            id: String(item.id),
            name: item.name,
            category: item.category,
            color: item.color,
          })),
          signal,
          occasion: outfit?.dressFor || outfit?.occasionType || 'todays_look',
          contextSnapshot: {
            source: 'todays_outfit_card',
            dayLabel: outfit?.dayLabel,
            occasionLabel: outfit?.occasionLabel,
            weatherTemp: outfit?.weatherTemp,
            weatherCondition: outfit?.weatherCondition,
            vibeLabel: outfit?.vibeLabel,
          },
        })
        .catch(() => {});
    }

    setShowSaveModal(false);
    setVisible(false);
    setGapVisible(false);
    const cancelled = cancelOpenSession({
      requestId: loadGenRef.current,
      hasReadyOutfit: Boolean(outfit && actionOutfitIdRef.current),
    });
    loadGenRef.current = cancelled.nextRequestId;
    setCardState(cancelled.nextCardState);
    setErrorMessage(null);
    try {
      await AsyncStorage.setItem(DISMISS_KEY_PREFIX + todayKey(), '1');
    } catch {
      // session dismiss still works
    }
  };

  const handleWearThis = async () => {
    if (!actionsEnabled || !outfit?.id || wearBusy) return;
    if (dailyState?.worn) {
      // Idempotent — already wearing; card stays open.
      return;
    }
    const outfitSnap = outfit;
    const piecesSnap = pieces;
    void traceTodaysOutfit('button_click', { action: 'wear', outfitId: outfitSnap.id });

    // Instant UI — persist is secondary / non-blocking for the label.
    setDailyState((prev) =>
      prev
        ? { ...prev, worn: true, outfitId: outfitSnap.id }
        : { date: todayKey(), outfitId: outfitSnap.id, worn: true, saved: false },
    );
    setWearBusy(true);

    try {
      const next = await setWornDaily(outfitSnap.id);
      setDailyState(next);

      if (piecesSnap.length > 0) {
        const todayKeyStr = todayKey();
        const eventType = mapOccasionToPlannedEvent(
          outfitSnap?.dressFor,
          outfitSnap?.occasionType,
        );
        const existing = plannedOutfits.find((plan) => {
          const d = (plan.date || '').slice(0, 10);
          return d === todayKeyStr;
        });
        let planId = existing?.id;

        if (existing) {
          await updatePlannedOutfit(existing.id, {
            itemIds: piecesSnap.map((item) => String(item.id)),
            eventName: "Today's outfit",
            eventType,
            notes: outfitSnap?.stylistMessage || outfitSnap?.vibeLabel,
          });
        } else {
          const created = await planOutfit({
            date: todayPlannedDateIso(),
            itemIds: piecesSnap.map((item) => String(item.id)),
            eventName: "Today's outfit",
            eventType,
            notes: outfitSnap?.stylistMessage || outfitSnap?.vibeLabel,
          });
          planId = created.id;
        }

        if (planId) {
          await markPlannedOutfitWorn(planId);
        }

        apiService
          .recordOutfitEngagement({
            items: piecesSnap.map((item) => ({
              id: String(item.id),
              name: item.name,
              category: item.category,
              color: item.color,
            })),
            signal: 'wore',
            occasion: outfitSnap?.dressFor || outfitSnap?.occasionType || 'todays_look',
            contextSnapshot: {
              source: 'todays_outfit_card',
              dayLabel: outfitSnap?.dayLabel,
              occasionLabel: outfitSnap?.occasionLabel,
              weatherTemp: outfitSnap?.weatherTemp,
              weatherCondition: outfitSnap?.weatherCondition,
              vibeLabel: outfitSnap?.vibeLabel,
            },
          })
          .catch(() => {});
      }
    } catch (error) {
      console.warn('[TodaysOutfitCard] Wear this failed:', error);
    } finally {
      setWearBusy(false);
    }
  };
  const handleDismiss = () => {
    void handleClose('skipped');
  };
  const handleDismissGap = () => {
    setGapVisible(false);
    loadGenRef.current += 1;
    setCardState(outfit && actionOutfitIdRef.current ? 'ready' : 'idle');
  };

  const visualPieces = useMemo(
    () =>
      pieces.map((item) => ({
        wardrobeItemId: item.id,
        name: item.name,
        category: item.category,
        imageUrl: item.enhancedImageUri || item.imageUri,
      })),
    [pieces],
  );

  const itemIds = useMemo(() => wardrobeIdsFromPieces(pieces), [pieces]);
  // Daily store is authority — plannedOutfits is never used to clear worn.
  const wearingToday = dailyState?.worn === true;
  const savedToday = dailyState?.saved === true;
  // Chip visibility is ONLY "is sheet/gap open" — never gated on loading.
  const showReopenChip =
    Boolean(user) && !visible && !gapVisible && !showSaveModal && !saveHandoff;

  if (!user) return null;

  const weatherLine =
    outfit?.weatherTemp != null
      ? `${outfit.weatherTemp}° · ${outfit.weatherCondition || 'today'}${
          outfit.weatherLocation ? ` · ${outfit.weatherLocation}` : ''
        }`
      : null;

  const canvasWidth = Math.min(windowWidth - Spacing.lg * 2.5, 360);

  return (
    <>
      {showReopenChip ? (
        <Pressable
          style={[
            styles.reopenChip,
            {
              top: insets.top + 52,
              backgroundColor: isDark ? '#2A2420' : '#FFF9F0',
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(61,52,38,0.15)',
            },
          ]}
          onPress={openTodaysOutfit}
          accessibilityRole="button"
          accessibilityLabel={t('home.todaysOutfit') || "Today's outfit"}
        >
          <Feather name="sun" size={14} color="#C9A87C" />
          <ThemedText type="small" style={styles.reopenText}>
            {t('home.todaysOutfit') || "Today's outfit"}
          </ThemedText>
        </Pressable>
      ) : null}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (showSaveModal) return;
          handleDismiss();
        }}
      >
        <GestureHandlerRootView style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (showSaveModal) return;
              handleDismiss();
            }}
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.sheet,
              {
                maxHeight: Math.min(windowHeight * 0.9, 760),
                marginTop: insets.top + 12,
                marginBottom: Math.max(insets.bottom, 12) + 8,
                backgroundColor: isDark ? '#1A1614' : '#FFF9F0',
                shadowColor: '#000',
              },
            ]}
          >
            <LinearGradient
              colors={isDark ? ['#2A2420', '#1A1614'] : ['#F5E6D3', '#FFF9F0']}
              style={styles.gradient}
            >
              <View style={styles.sheetHeader}>
                <View style={styles.badge}>
                  <Feather name="sun" size={14} color="#C9A87C" />
                  <ThemedText type="caption" style={styles.badgeText}>
                    {formatTodayBadgeDate()}
                    {outfit?.occasionLabel ? ` · ${outfit.occasionLabel}` : ''}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={handleDismiss}
                  hitSlop={12}
                  style={[
                    styles.closeBtn,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={18} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                bounces
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                contentContainerStyle={styles.scrollContent}
              >
                <ThemedText type="h3" style={styles.title}>
                  {t('home.todaysOutfit') || "Today's outfit"}
                </ThemedText>
                <ThemedText type="small" style={[styles.sub, { color: theme.tabIconDefault }]}>
                  {TODAYS_OUTFIT_SUBTITLE_CONTRACT}
                </ThemedText>

                {weatherLine ? (
                  <View
                    style={[
                      styles.metaRow,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(201,168,124,0.15)',
                      },
                    ]}
                  >
                    <Feather name="cloud" size={14} color="#C9A87C" />
                    <ThemedText type="small" style={styles.metaText}>
                      {weatherLine}
                    </ThemedText>
                  </View>
                ) : null}

                {cardState === 'error' ? (
                  <View style={styles.loadingBox}>
                    <Feather name="alert-circle" size={28} color="#C9A87C" />
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.tabIconDefault,
                        marginTop: Spacing.sm,
                        textAlign: 'center',
                      }}
                    >
                      {errorMessage || "Couldn't pick an outfit. Tap retry."}
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        void loadOutfit({ open: true, forceRefresh: true });
                      }}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: theme.link, marginTop: Spacing.lg, alignSelf: 'stretch' },
                      ]}
                    >
                      <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: '600' }}>
                        {t('common.retry') || 'Retry'}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : generating || !outfit ? (
                  <View style={styles.skeletonBlock}>
                    <WardrobeImageShimmer
                      isDark={isDark}
                      backgroundColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                      style={[styles.skeletonHero, { width: canvasWidth, height: canvasWidth * 1.05 }]}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.tabIconDefault,
                        marginTop: Spacing.md,
                        textAlign: 'center',
                      }}
                    >
                      We're finishing your outfit — just a moment
                    </ThemedText>
                    <View style={styles.skeletonChipRow}>
                      {[0, 1, 2].map((i) => (
                        <WardrobeImageShimmer
                          key={i}
                          isDark={isDark}
                          backgroundColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                          style={styles.skeletonChip}
                        />
                      ))}
                    </View>
                  </View>
                ) : (
                  <Animated.View style={contentFadeStyle}>
                    <ZoomableOutfitVisual
                      pieces={visualPieces}
                      wardrobeItems={pieces}
                      canvasWidth={canvasWidth}
                    />
                  </Animated.View>
                )}

                {pieces.length > 0 ? (
                  <View style={styles.itemList}>
                    {pieces.map((item) => (
                      <View
                        key={item.id}
                        style={[
                          styles.itemChip,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.04)',
                          },
                        ]}
                      >
                        <ThemedText type="small" numberOfLines={1}>
                          {item.name}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}

                {outfit?.vibeLabel ? (
                  <ThemedText type="body" style={styles.vibe}>
                    {outfit.vibeLabel}
                  </ThemedText>
                ) : null}
                {outfit?.stylistMessage ? (
                  <ThemedText
                    type="small"
                    style={[styles.reason, { color: theme.tabIconDefault }]}
                  >
                    {outfit.stylistMessage}
                  </ThemedText>
                ) : null}
                {outfit?.diversity?.wardrobeLocked ? (
                  <ThemedText
                    type="small"
                    style={[styles.reason, { color: theme.tabIconDefault, marginTop: 6 }]}
                  >
                    Limited wardrobe variety — add another bottom or shoes for more daily change.
                  </ThemedText>
                ) : null}
              </ScrollView>

              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.06)',
                  },
                ]}
              >
                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: wearingToday ? (isDark ? '#3D3426' : '#E8DFD0') : theme.link,
                        opacity: actionsEnabled ? 1 : 0.45,
                      },
                    ]}
                    onPress={() => void handleWearThis()}
                    disabled={!actionsEnabled || wearBusy}
                  >
                    <ThemedText
                      type="body"
                      style={{
                        color: wearingToday ? theme.text : theme.buttonText,
                        fontWeight: '600',
                      }}
                    >
                      {wearBusy
                        ? (t('common.loading') || 'Saving…')
                        : wearingToday
                          ? (t('home.wearingToday') || 'Wearing today')
                          : (t('home.wearThis') || 'Wear this')}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryBtn, { borderColor: theme.border }]}
                    onPress={handleDismiss}
                  >
                    <ThemedText type="small" style={{ color: theme.text }}>
                      {t('common.dismiss') || t('common.cancel') || 'Dismiss'}
                    </ThemedText>
                  </Pressable>
                </View>

                {itemIds.length > 0 && actionsEnabled ? (
                  <View style={styles.saveWrap}>
                    <Pressable
                      style={[styles.saveBtn, { borderColor: theme.border }]}
                      onPress={() => {
                        void traceTodaysOutfit('button_click', {
                          action: 'save',
                          outfitId: outfit?.id,
                        });
                        // iOS: a second Modal under/behind Today's Outfit looks like a dead button.
                        // Close the outfit sheet first, then present Save; restore on close.
                        restoreOutfitAfterSaveRef.current = true;
                        setSaveHandoff(true);
                        setVisible(false);
                        setTimeout(() => setShowSaveModal(true), 50);
                      }}
                      disabled={!actionsEnabled || wearBusy}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('savedOutfits.saveOutfit') || 'Save outfit'}
                    >
                      <Feather name="bookmark" size={16} color={theme.link} />
                      <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }}>
                        {savedToday
                          ? (t('savedOutfits.saved') || 'Saved')
                          : (t('savedOutfits.saveOutfit') || 'Save outfit')}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </View>
        </GestureHandlerRootView>
      </Modal>

      <SaveOutfitPromptModal
        visible={showSaveModal}
        intent="save"
        wardrobeItemIds={itemIds}
        defaultTitle={`Today's outfit — ${formatTodayBadgeDate()}`}
        defaultDescription={outfit?.stylistMessage || outfit?.vibeLabel || ''}
        occasion={outfit?.dressFor || outfit?.occasionType || 'custom'}
        onClose={() => {
          setShowSaveModal(false);
          setSaveHandoff(false);
          if (restoreOutfitAfterSaveRef.current) {
            restoreOutfitAfterSaveRef.current = false;
            setTimeout(() => setVisible(true), 50);
          }
        }}
        onSaved={() => {
          if (outfit?.id) {
            void setSavedDaily(outfit.id).then(setDailyState);
          }
          apiService
            .recordOutfitEngagement({
              items: itemIds,
              signal: 'saved',
              occasion: outfit?.dressFor || outfit?.occasionType || 'todays_look',
              contextSnapshot: { source: 'todays_outfit_card' },
            })
            .catch(() => {});
          setShowSaveModal(false);
          setSaveHandoff(false);
          if (restoreOutfitAfterSaveRef.current) {
            restoreOutfitAfterSaveRef.current = false;
            setTimeout(() => setVisible(true), 50);
          }
        }}
      />

      <Modal
        visible={Boolean(errorMessage) && !outfit && gapVisible && cardState === 'error'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleDismissGap}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleDismissGap}
            accessibilityLabel={t('common.dismiss') || 'Dismiss'}
          />
          <View
            style={[
              styles.gapSheet,
              {
                marginTop: insets.top + 24,
                marginBottom: insets.bottom + 24,
                backgroundColor: isDark ? '#1A1614' : '#FFF9F0',
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHeader}>
              <ThemedText type="h3" style={{ flex: 1, paddingRight: Spacing.sm }}>
                {t('home.todaysOutfit') || "Today's outfit"}
              </ThemedText>
              <Pressable onPress={handleDismissGap} hitSlop={12} accessibilityRole="button">
                <Feather name="x" size={18} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ lineHeight: 22, marginBottom: Spacing.lg, color: theme.text }}>
              {errorMessage}
            </ThemedText>
            <Pressable
              style={[styles.ackBtn, { backgroundColor: theme.link }]}
              onPress={handleDismissGap}
              accessibilityRole="button"
              accessibilityLabel={t('common.ok') || 'OK'}
            >
              <ThemedText
                type="body"
                style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}
              >
                {t('common.ok') || 'OK'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  sheet: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    elevation: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    flexShrink: 1,
  },
  gapSheet: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    zIndex: 2,
  },
  gradient: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    maxHeight: '100%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  badgeText: {
    color: '#C9A87C',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  title: { marginBottom: 4 },
  sub: { marginBottom: Spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  metaText: { flex: 1, lineHeight: 18 },
  visualBlock: { marginBottom: Spacing.sm },
  visualFrame: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  zoomCanvas: {
    alignItems: 'center',
    width: '100%',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  resetZoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loadingBox: { alignItems: 'center', paddingVertical: Spacing.xl },
  skeletonBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skeletonHero: {
    borderRadius: BorderRadius.lg,
  },
  skeletonChipRow: {
    width: '100%',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  skeletonChip: {
    height: 36,
    borderRadius: BorderRadius.md,
    width: '100%',
  },
  vibe: { fontWeight: '600', marginTop: Spacing.sm, marginBottom: Spacing.xs },
  reason: { lineHeight: 20, marginBottom: Spacing.sm },
  itemList: {
    flexDirection: 'column',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  itemChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  footer: {
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  primaryBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  ackBtn: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.buttonHeight,
  },
  secondaryBtn: {
    minWidth: 120,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveWrap: { marginTop: Spacing.sm },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reopenChip: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  reopenText: {
    fontWeight: '600',
    color: '#C9A87C',
  },
});
