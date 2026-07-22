import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  useWindowDimensions,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { OutfitPiecesVisual } from '@/components/OutfitPiecesVisual';
import { SaveOutfitPromptModal } from '@/components/outfit/SaveOutfitPromptModal';
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
  stableTodaysOutfitId,
  TODAYS_OUTFIT_GENERATION_BUDGET_MS,
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

import {
  countWardrobeOutfitBasics,
  describeOutfitPlanningGap,
  wardrobeReadyForTodaysOutfitAutoPopup,
} from '@/utils/wardrobeOutfitReadiness';

type TodaysOutfitCardState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  onOpenStylist?: (prompt: string) => void;
  onRefresh?: () => void;
};

const DISMISS_KEY_PREFIX = '@dripn_todays_outfit_dismissed_';
const PAID_PLAN_REQUIRED_MESSAGE =
  'A paid stylist plan is required for this feature.';

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function todayPlannedDateIso() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return now.toISOString();
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
            <OutfitPiecesVisual
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

export function TodaysOutfitCard({ onRefresh }: Props) {
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
  const [dismissed, setDismissed] = useState(false);
  /** Separate from outfit dismiss — empty-wardrobe guidance must reopen from the chip. */
  const [gapVisible, setGapVisible] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [wearBusy, setWearBusy] = useState(false);
  const autoPopupCheckedRef = useRef(false);
  /** Buttons only act on this stable outfit id once cardState is ready. */
  const actionOutfitIdRef = useRef<string | null>(null);

  const generating = cardState === 'loading';
  const actionsEnabled =
    cardState === 'ready'
    && Boolean(outfit?.id)
    && outfit?.id === actionOutfitIdRef.current
    && !wearBusy;

  const applyReadyOutfit = useCallback((nextOutfit: WardrobeTodaysOutfit, nextPieces: WardrobeItem[]) => {
    actionOutfitIdRef.current = nextOutfit.id;
    setOutfit(nextOutfit);
    setPieces(nextPieces);
    setErrorMessage(null);
    setCardState('ready');
    void traceTodaysOutfit('render', { id: nextOutfit.id, pieceCount: nextPieces.length });
  }, []);

  const load = useCallback(
    async (forceRefresh = false) => {
      const isManual = forceRefresh;
      setCardState('loading');
      if (forceRefresh) {
        setGapVisible(false);
      }
      setErrorMessage(null);

      const paid = hasPaidTodaysOutfitAccess(user?.subscriptionTier);
      const readyForAuto = wardrobeReadyForTodaysOutfitAutoPopup(wardrobeItems);

      if (!isManual) {
        if (!paid || !readyForAuto) {
          setOutfit(null);
          setPieces([]);
          actionOutfitIdRef.current = null;
          setVisible(false);
          setGapVisible(false);
          setCardState('idle');
          return;
        }
      }

      if (isManual && !paid) {
        setOutfit(null);
        setPieces([]);
        actionOutfitIdRef.current = null;
        setErrorMessage(PAID_PLAN_REQUIRED_MESSAGE);
        setVisible(false);
        setGapVisible(true);
        setCardState('error');
        return;
      }

      await onboardingProfileService.syncQuizGenderFromUserGender(user?.gender);
      const profile = await onboardingProfileService.getProfile();

      if (!forceRefresh) {
        const cached = await resolveCachedTodaysOutfit({ wardrobeItems, profile, user });
        if (cached) {
          applyReadyOutfit(cached.outfit, cached.items);
          try {
            const dismissedToday = await AsyncStorage.getItem(DISMISS_KEY_PREFIX + todayKey());
            const wasDismissed = dismissedToday === '1';
            const prefs = await getTodaysOutfitPopupPrefs();
            const inWindow = isWithinTodaysOutfitPopupWindow(prefs);
            setDismissed(wasDismissed);
            setVisible(Boolean(prefs.enabled && inWindow && !wasDismissed));
          } catch {
            setDismissed(false);
            setVisible(true);
          }
          onRefresh?.();
          return;
        }
      }

      const result = await generateTodaysWardrobeOutfit({
        wardrobeItems,
        profile,
        user,
        forceRefresh,
      });

      if (!result.ok) {
        setOutfit(null);
        setPieces([]);
        actionOutfitIdRef.current = null;
        const message =
          result.reason === 'not_ready'
            ? describeOutfitPlanningGap(countWardrobeOutfitBasics(wardrobeItems), t)
            : result.message;
        setErrorMessage(message);
        setVisible(false);
        setGapVisible(isManual);
        setCardState('error');
        return;
      }

      setGapVisible(false);
      applyReadyOutfit(result.outfit, result.items);

      try {
        const dismissedToday = await AsyncStorage.getItem(DISMISS_KEY_PREFIX + todayKey());
        const wasDismissed = dismissedToday === '1';
        const prefs = await getTodaysOutfitPopupPrefs();
        const inWindow = isWithinTodaysOutfitPopupWindow(prefs);
        setDismissed(wasDismissed);
        if (isManual) {
          setVisible(true);
        } else {
          setVisible(Boolean(prefs.enabled && inWindow && !wasDismissed));
        }
      } catch {
        setDismissed(false);
        setVisible(true);
      }

      onRefresh?.();
    },
    [wardrobeItems, user, onRefresh, t, applyReadyOutfit],
  );

  useEffect(() => {
    if (!user) {
      setCardState('idle');
      return;
    }
    void traceTodaysOutfit('trigger', { source: 'mount', userId: user.id });
    void load(false);
  }, [user?.id, wardrobeItems.length]);

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
        setDismissed(false);
        setVisible(true);
      }
    } catch {
      // ignore
    }
  }, [user, outfit, visible, gapVisible, generating, wardrobeItems]);

  useEffect(() => {
    if (!outfit || autoPopupCheckedRef.current) return;
    autoPopupCheckedRef.current = true;
    void maybeAutoOpenPopup();
  }, [outfit, maybeAutoOpenPopup]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void maybeAutoOpenPopup();
    }, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void maybeAutoOpenPopup();
    });
    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, [maybeAutoOpenPopup]);

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

    setVisible(false);
    setDismissed(true);
    try {
      await AsyncStorage.setItem(DISMISS_KEY_PREFIX + todayKey(), '1');
    } catch {
      // session dismiss still works
    }
  };

  const handleWearThis = async () => {
    if (!actionsEnabled || !outfit?.id) return;
    const outfitId = outfit.id;
    void traceTodaysOutfit('button_click', { action: 'wear', outfitId });
    setWearBusy(true);
    try {
      if (pieces.length > 0) {
        const todayKeyStr = todayKey();
        const eventType = mapOccasionToPlannedEvent(outfit?.dressFor, outfit?.occasionType);
        const existing = plannedOutfits.find((plan) => plan.date.slice(0, 10) === todayKeyStr);
        let planId = existing?.id;

        if (existing) {
          await updatePlannedOutfit(existing.id, {
            itemIds: pieces.map((item) => String(item.id)),
            eventName: "Today's outfit",
            eventType,
            notes: outfit?.stylistMessage || outfit?.vibeLabel,
          });
        } else {
          const created = await planOutfit({
            date: todayPlannedDateIso(),
            itemIds: pieces.map((item) => String(item.id)),
            eventName: "Today's outfit",
            eventType,
            notes: outfit?.stylistMessage || outfit?.vibeLabel,
          });
          planId = created.id;
        }

        if (planId) {
          await markPlannedOutfitWorn(planId);
        }

        apiService
          .recordOutfitEngagement({
            items: pieces.map((item) => ({
              id: String(item.id),
              name: item.name,
              category: item.category,
              color: item.color,
            })),
            signal: 'wore',
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
    } catch (error) {
      console.warn('[TodaysOutfitCard] Wear this failed:', error);
    } finally {
      setWearBusy(false);
      await handleClose(null);
    }
  };
  const handleDismiss = () => {
    void handleClose('skipped');
  };
  const handleDismissGap = () => {
    setGapVisible(false);
  };

  const openTodaysOutfit = () => {
    void traceTodaysOutfit('trigger', { source: 'chip_tap' });
    if (outfit && cardState === 'ready' && outfit.id === actionOutfitIdRef.current) {
      setDismissed(false);
      setVisible(true);
      return;
    }
    if (!hasPaidTodaysOutfitAccess(user?.subscriptionTier)) {
      setErrorMessage(PAID_PLAN_REQUIRED_MESSAGE);
      setGapVisible(true);
      setCardState('error');
      return;
    }
    setErrorMessage(null);
    setGapVisible(false);
    setDismissed(false);
    setVisible(true);
    setCardState('loading');

    void (async () => {
      const profile = await onboardingProfileService.getProfile();
      const cached = await resolveCachedTodaysOutfit({ wardrobeItems, profile, user });
      if (cached) {
        applyReadyOutfit(cached.outfit, cached.items);
        return;
      }
      void load(true);
    })();
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
  // Keep the chip available for discovery; never auto-open a nag sheet on first launch.
  const showReopenChip =
    Boolean(user) && !visible && !gapVisible && cardState !== 'loading';

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
        visible={visible && (generating || Boolean(outfit)) && !showSaveModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        <GestureHandlerRootView style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} accessibilityLabel="Dismiss" />
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
                  Curated from your wardrobe
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

                {generating || !outfit ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color={theme.link} />
                    <ThemedText
                      type="small"
                      style={{ color: theme.tabIconDefault, marginTop: Spacing.sm }}
                    >
                      Picking from your wardrobe…
                    </ThemedText>
                  </View>
                ) : (
                  <ZoomableOutfitVisual
                    pieces={visualPieces}
                    wardrobeItems={pieces}
                    canvasWidth={canvasWidth}
                  />
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
                      { backgroundColor: theme.link, opacity: actionsEnabled ? 1 : 0.6 },
                    ]}
                    onPress={() => void handleWearThis()}
                    disabled={!actionsEnabled}
                  >
                    <ThemedText
                      type="body"
                      style={{ color: theme.buttonText, fontWeight: '600' }}
                    >
                      {t('home.wearThis') || 'Wear this'}
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
                        setShowSaveModal(true);
                      }}
                      disabled={!actionsEnabled}
                    >
                      <Feather name="bookmark" size={16} color={theme.link} />
                      <ThemedText type="small" style={{ color: theme.text, fontWeight: '600' }}>
                        {t('savedOutfits.saveOutfit') || 'Save outfit'}
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
          if (outfit) setVisible(true);
        }}
        onSaved={() => {
          apiService
            .recordOutfitEngagement({
              items: itemIds,
              signal: 'saved',
              occasion: outfit?.dressFor || outfit?.occasionType || 'todays_look',
              contextSnapshot: { source: 'todays_outfit_card' },
            })
            .catch(() => {});
          setShowSaveModal(false);
          if (outfit) setVisible(true);
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
