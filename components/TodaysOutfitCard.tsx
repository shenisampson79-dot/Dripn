import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  useWindowDimensions,
  ActivityIndicator,
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
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWardrobe } from '@/contexts/WardrobeContext';
import { onboardingProfileService } from '@/services/OnboardingProfileService';
import {
  generateTodaysWardrobeOutfit,
  type WardrobeTodaysOutfit,
} from '@/services/TodaysOutfitGenerator';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { apiService } from '@/services/ApiService';

type Props = {
  onOpenStylist?: (prompt: string) => void;
  onRefresh?: () => void;
};

const DISMISS_KEY_PREFIX = '@dripn_todays_outfit_dismissed_';
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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
  const { items: wardrobeItems } = useWardrobe();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const [outfit, setOutfit] = useState<WardrobeTodaysOutfit | null>(null);
  const [pieces, setPieces] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const load = useCallback(
    async (forceRefresh = false) => {
      setLoading(!forceRefresh);
      setGenerating(forceRefresh);
      setErrorMessage(null);

      await onboardingProfileService.syncQuizGenderFromUserGender(user?.gender);
      const profile = await onboardingProfileService.getProfile();

      const result = await generateTodaysWardrobeOutfit({
        wardrobeItems,
        profile,
        user,
        forceRefresh,
      });

      if (!result.ok) {
        setOutfit(null);
        setPieces([]);
        setErrorMessage(result.message);
        setVisible(false);
        setLoading(false);
        setGenerating(false);
        return;
      }

      setOutfit(result.outfit);
      setPieces(result.items);

      try {
        const dismissedToday = await AsyncStorage.getItem(DISMISS_KEY_PREFIX + todayKey());
        const wasDismissed = dismissedToday === '1';
        setDismissed(wasDismissed);
        setVisible(!wasDismissed);
      } catch {
        setDismissed(false);
        setVisible(true);
      }

      setLoading(false);
      setGenerating(false);
      onRefresh?.();
    },
    [wardrobeItems, user, onRefresh],
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void load(false);
  }, [user?.id, wardrobeItems.length]);

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

  const handleWearThis = () => handleClose('wore');
  const handleDismiss = () => handleClose('skipped');

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

  const itemIds = useMemo(() => pieces.map((p) => String(p.id)), [pieces]);
  const showReopenChip =
    Boolean(user) && !loading && ((dismissed && !visible && outfit) || (!outfit && errorMessage));

  if (!user) return null;
  if (loading && !outfit && !errorMessage) return null;

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
          onPress={() => {
            if (outfit) setVisible(true);
            else void load(true);
          }}
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
        visible={visible && Boolean(outfit)}
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
                    {outfit?.dayLabel || (t('home.todaysOutfit') || "Today's outfit")}
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

                {generating ? (
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
                    style={[styles.primaryBtn, { backgroundColor: theme.link }]}
                    onPress={handleWearThis}
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

                {itemIds.length > 0 ? (
                  <View style={styles.saveWrap}>
                    <Pressable
                      style={[styles.saveBtn, { borderColor: theme.border }]}
                      onPress={() => setShowSaveModal(true)}
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
        defaultTitle={`Today's outfit — ${outfit?.dayLabel || todayKey()}`}
        defaultDescription={outfit?.stylistMessage || outfit?.vibeLabel || ''}
        occasion={outfit?.dressFor || outfit?.occasionType || 'custom'}
        onClose={() => setShowSaveModal(false)}
        onSaved={() => {
          apiService
            .recordOutfitEngagement({
              items: itemIds,
              signal: 'saved',
              occasion: outfit?.dressFor || outfit?.occasionType || 'todays_look',
              contextSnapshot: { source: 'todays_outfit_card' },
            })
            .catch(() => {});
        }}
      />

      <Modal
        visible={Boolean(errorMessage) && !outfit && !dismissed && !loading}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
          <View
            style={[
              styles.sheet,
              {
                marginTop: insets.top + 24,
                marginBottom: insets.bottom + 24,
                backgroundColor: isDark ? '#1A1614' : '#FFF9F0',
                padding: Spacing.lg,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <ThemedText type="h3">
                {t('home.todaysOutfit') || "Today's outfit"}
              </ThemedText>
              <Pressable onPress={handleDismiss} hitSlop={12}>
                <Feather name="x" size={18} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ lineHeight: 22, marginVertical: Spacing.md }}>
              {errorMessage}
            </ThemedText>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: theme.link }]}
              onPress={handleDismiss}
            >
              <ThemedText
                type="body"
                style={{ color: theme.buttonText, fontWeight: '600' }}
              >
                OK
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
