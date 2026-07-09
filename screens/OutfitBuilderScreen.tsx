import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { WardrobeItemImage } from '@/components/WardrobeItemImage';
import { wardrobeImageBackground } from '@/utils/wardrobeImage';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useWardrobe, WardrobeItem, ClothingCategory, PlannedEventType } from '@/contexts/WardrobeContext';
import { useAuth } from '@/contexts/AuthContext';
import { onboardingProfileService, type OnboardingProfile } from '@/services/OnboardingProfileService';
import { apiService } from '@/services/ApiService';
import { computeLocalOutfitScore, mergeOutfitScores } from '@/utils/outfitCompatibilityScore';
import { resolveRegionalStyleContext } from '@/utils/outfitRegionalContext';
import * as Location from 'expo-location';
import {
  getOutfitReelImageScale,
  OUTFIT_REEL_CENTER_RATIO,
} from '@/utils/outfitReelImage';
import type { WardrobeStackParamList } from '@/navigation/WardrobeStackNavigator';
import { useTranslations } from "@/contexts/TranslationContext";

const { width: SW, height: SH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 56;

type OutfitBuilderScreenProps = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, 'OutfitBuilder'>;
};

// Clueless-style reels — width/height computed per device in main screen
const COMPACT_CENTER_RATIO = OUTFIT_REEL_CENTER_RATIO;

// Category display order (body top → bottom → feet)
const REEL_ORDER: Array<{ key: ClothingCategory }> = [
  { key: 'outerwear' },
  { key: 'tops' },
  { key: 'dresses' },
  { key: 'formal' },
  { key: 'bottoms' },
  { key: 'shoes' },
];

const EVENT_TYPES: { value: PlannedEventType; label: string }[] = [
  { value: 'casual',     label: 'Casual' },
  { value: 'work',       label: 'Work' },
  { value: 'date-night', label: 'Date Night' },
  { value: 'party',      label: 'Party' },
  { value: 'formal',     label: 'Formal' },
  { value: 'everyday',   label: 'Everyday' },
  { value: 'workout',    label: 'Workout' },
  { value: 'travel',     label: 'Travel' },
  { value: 'wedding',    label: 'Wedding' },
];

const OCCASION_SCORE_MAP: Record<PlannedEventType, string> = {
  casual: 'casual-hangout',
  work: 'casual-friday',
  'date-night': 'first-date',
  party: 'casual-hangout',
  formal: 'wedding',
  everyday: 'casual-hangout',
  workout: 'gym-active',
  travel: 'casual-hangout',
  wedding: 'wedding',
};

const DIMENSION_LABELS: Record<string, string> = {
  fit: 'Fit',
  colorHarmony: 'Colour',
  trendAlignment: 'Trend',
  bodyTypeMatch: 'Body',
  occasionRelevance: 'Occasion',
  uniqueness: 'Edge',
};

// ─── Single category reel ────────────────────────────────────────────────────

type CategoryReelProps = {
  category: ClothingCategory;
  items: WardrobeItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isDark: boolean;
  rowHeight: number;
  centerWidth: number;
  sideGap: number;
  sideInset: number;
  snapInterval: number;
};

function CategoryReel({
  category,
  items,
  selectedId,
  onSelect,
  isDark,
  rowHeight,
  centerWidth,
  sideGap,
  sideInset,
  snapInterval,
}: CategoryReelProps) {
  const data = items;
  const listRef = useRef<FlatList>(null);

  const initialIndex = useMemo(() => {
    if (!selectedId) return 0;
    const idx = items.findIndex(i => i.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [items, selectedId]);

  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const idx = data.findIndex((item) => item.id === selectedId);
    if (idx < 0) return;
    try {
      listRef.current.scrollToIndex({ index: idx, animated: false });
    } catch {
      // FlatList may not be measured yet on first paint.
    }
  }, [data, selectedId]);

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / snapInterval);
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    const item = data[clamped];
    if (!item || item.id === selectedId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(item.id);
  }, [data, onSelect, selectedId, snapInterval]);

  const imageScale = getOutfitReelImageScale(category);

  const renderItem = useCallback(({ item }: { item: WardrobeItem; index: number }) => {
    const isSelected = item.id === selectedId;

    return (
      <View style={[styles.reelItemContainer, { width: centerWidth, height: rowHeight }]}>
        <View
          style={[
            styles.reelCard,
            { height: rowHeight, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
            !isSelected && { opacity: 0.42 },
          ]}
        >
          <View style={[
            styles.reelImageWrap,
            { backgroundColor: wardrobeImageBackground(isDark, item) || (isDark ? '#2C2C2E' : '#EBEBEF') },
          ]}>
            <WardrobeItemImage
              item={item}
              style={styles.reelImage}
              processed={!!(item.imageProcessed || item.aiAnalyzed)}
              contentFit="contain"
              displayScale={imageScale}
              tileBackgroundColor={wardrobeImageBackground(isDark, item) || (isDark ? '#2C2C2E' : '#EBEBEF')}
            />
          </View>
        </View>
      </View>
    );
  }, [selectedId, isDark, rowHeight, centerWidth, imageScale]);

  return (
    <View style={[styles.reelRow, { height: rowHeight }]}>
      <View style={{ position: 'relative', height: rowHeight }}>
        <FlatList
          ref={listRef}
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          contentInset={{ left: sideInset - sideGap / 2, right: sideInset - sideGap / 2 }}
          contentOffset={{ x: -(sideInset - sideGap / 2), y: 0 }}
          contentContainerStyle={[styles.reelListContent, { gap: sideGap, paddingHorizontal: sideInset - sideGap / 2 }]}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          initialScrollIndex={Math.min(initialIndex, Math.max(0, data.length - 1))}
          getItemLayout={(_, index) => ({ length: snapInterval, offset: snapInterval * index, index })}
        />
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OutfitBuilderScreen({ navigation }: OutfitBuilderScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const bottomNavClearance = Math.max(
    tabBarHeight,
    TAB_BAR_HEIGHT + insets.bottom,
  ) + Spacing.lg;
  const { items, reloadWardrobe } = useWardrobe();
  const { user, actualCountry } = useAuth();
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(null);
  const scoringLocationRef = useRef<{ lat?: number; lon?: number }>({});

  const regionalContext = useMemo(
    () => resolveRegionalStyleContext(user, onboardingProfile),
    [user, onboardingProfile, actualCountry],
  );

  useEffect(() => {
    onboardingProfileService.getProfile().then(setOnboardingProfile).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        scoringLocationRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      } catch {
        // Location is optional for scoring.
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadWardrobe();
    }, [reloadWardrobe]),
  );

  // Pre-select the first item per category so the carousel opens on a real garment
  const [selection, setSelection] = useState<Partial<Record<ClothingCategory, string | null>>>(() => {
    const initial: Partial<Record<ClothingCategory, string | null>> = {};
    for (const { key } of REEL_ORDER) {
      const cats = key === 'tops'
        ? (['tops', 'activewear_tops'] as const)
        : key === 'bottoms'
          ? (['bottoms', 'activewear_bottoms'] as const)
          : [key] as const;
      const first = items.find(i => (cats as readonly string[]).includes(i.category));
      if (first) initial[key] = first.id;
    }
    return initial;
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [outfitDescription, setOutfitDescription] = useState('');
  const [eventType, setEventType] = useState<PlannedEventType>('casual');
  const [pinToCalendar, setPinToCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [styleScore, setStyleScore] = useState<number>(0);
  const [styleHint, setStyleHint] = useState<string>('Swipe rows to build a look');
  const [scoreDimensions, setScoreDimensions] = useState<Record<string, number> | null>(null);
  const [scoreExplanations, setScoreExplanations] = useState<string[]>([]);
  const [scoreHeadline, setScoreHeadline] = useState<string | null>(null);
  const [isAiScoring, setIsAiScoring] = useState(false);
  const [aiScoreApplied, setAiScoreApplied] = useState(false);
  const scoreRequestRef = useRef(0);

  const layoutMetrics = useMemo(() => {
    const centerWidth = SW * COMPACT_CENTER_RATIO;
    const sideGap = 6;
    const snapInterval = centerWidth + sideGap;
    const sideInset = (SW - centerWidth) / 2;
    return { centerWidth, sideGap, snapInterval, sideInset };
  }, []);

  const itemsByCategory = useMemo(() => {
    const map: Partial<Record<ClothingCategory, WardrobeItem[]>> = {};
    for (const { key } of REEL_ORDER) {
      if (key === 'tops') {
        // Merge activewear_tops into the Tops row
        map[key] = items.filter(i => i.category === 'tops' || i.category === 'activewear_tops');
      } else if (key === 'bottoms') {
        // Merge activewear_bottoms into the Bottoms row
        map[key] = items.filter(i => i.category === 'bottoms' || i.category === 'activewear_bottoms');
      } else {
        map[key] = items.filter(i => i.category === key);
      }
    }
    return map;
  }, [items]);

  const activeReels = useMemo(
    () => REEL_ORDER.filter(r => (itemsByCategory[r.key]?.length ?? 0) > 0),
    [itemsByCategory]
  );

  const selectedItemIds = useMemo(
    () => Object.values(selection).filter((id): id is string => !!id),
    [selection]
  );

  const showSaveButton = selectedItemIds.length > 0;

  const compactRowHeight = useMemo(() => {
    const headerBlock = 52;
    const scoreBlock = 58;
    const bottomChrome = showSaveButton
      ? bottomNavClearance + Spacing.buttonHeight + Spacing.sm + Spacing.md
      : bottomNavClearance;
    const rowGap = 8;
    const available = SH - insets.top - headerBlock - scoreBlock - bottomChrome;
    const gaps = Math.max(activeReels.length - 1, 0) * rowGap;
    const perRow = Math.floor((available - gaps) / Math.max(activeReels.length, 1));
    return Math.max(78, Math.min(134, perRow));
  }, [activeReels.length, insets.top, bottomNavClearance, showSaveButton]);

  const handleSelect = useCallback((cat: ClothingCategory, id: string) => {
    setSelection(prev => ({ ...prev, [cat]: id }));
  }, []);

  const selectedWardrobeItems = useMemo(
    () => selectedItemIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is WardrobeItem => !!item),
    [selectedItemIds, items]
  );

  const selectionKey = useMemo(
    () => selectedItemIds.slice().sort().join('|'),
    [selectedItemIds],
  );

  useEffect(() => {
    const local = computeLocalOutfitScore(selectedWardrobeItems, regionalContext);
    setStyleScore(local.score);
    setStyleHint(local.hint);
    setAiScoreApplied(false);
    setScoreDimensions(null);
    setScoreExplanations([]);
    setScoreHeadline(null);

    if (selectedWardrobeItems.length < 2) {
      setIsAiScoring(false);
      return;
    }

    const requestId = ++scoreRequestRef.current;
    setIsAiScoring(true);
    const itemIdsForRequest = selectedWardrobeItems.map((item) => item.id);
    const { lat, lon } = scoringLocationRef.current;

    const timer = setTimeout(async () => {
      try {
        const result = await apiService.checkOutfitCompatibility({
          items: itemIdsForRequest,
          stylistId: 'ruby',
          occasion: OCCASION_SCORE_MAP[eventType] || 'casual-hangout',
          countryCode: regionalContext.countryCode || undefined,
          preferredStyles: regionalContext.styleTags,
          lat,
          lon,
          location: user?.country || actualCountry || undefined,
        });

        if (scoreRequestRef.current !== requestId) return;

        if (result.success && typeof result.score === 'number') {
          const merged = mergeOutfitScores(local, {
            score: result.score,
            hardRuleViolations: result.hardRuleViolations,
            hardCapApplied: result.hardCapApplied,
            verdict: result.verdict,
            analysis: result.analysis,
            headline: result.headline,
            explanations: result.explanations,
            improvements: result.improvements,
            dimensions: result.dimensions,
          }, {
            allowsSmartCasualTrainers: regionalContext.allowsSmartCasualTrainers,
          });
          setStyleScore(merged.score);
          setStyleHint(merged.hint);
          setScoreDimensions(merged.dimensions);
          setScoreExplanations(merged.explanations);
          setScoreHeadline(merged.headline);
          setAiScoreApplied(merged.aiApplied);
        }
      } catch {
        // Keep instant local score when AI is unavailable.
      } finally {
        if (scoreRequestRef.current === requestId) {
          setIsAiScoring(false);
        }
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [selectionKey, eventType, items, regionalContext, user?.country, actualCountry]);

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Reset to first item per category (not fully empty)
    const reset: Partial<Record<ClothingCategory, string | null>> = {};
    for (const { key } of REEL_ORDER) {
      const cats = key === 'tops'
        ? (['tops', 'activewear_tops'] as const)
        : key === 'bottoms'
          ? (['bottoms', 'activewear_bottoms'] as const)
          : [key] as const;
      const first = items.find(i => (cats as readonly string[]).includes(i.category));
      if (first) reset[key] = first.id;
    }
    setSelection(reset);
  };

  const handleSave = () => {
    if (selectedItemIds.length === 0) {
      Alert.alert('Nothing selected', 'Swipe through the rows to pick items first.');
      return;
    }
    setOutfitName('');
    setOutfitDescription('');
    setEventType('casual');
    setPinToCalendar(false);
    setCalendarDate(new Date());
    setShowSaveModal(true);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });

  const confirmSave = async () => {
    setIsSaving(true);
    try {
      const name = outfitName.trim() || 'My Outfit';
      const payload: Parameters<typeof apiService.saveMixAndMatchOutfit>[0] = {
        name,
        occasion: eventType,
        wardrobeItemIds: selectedItemIds,
      };
      const description = outfitDescription.trim();
      if (description) {
        payload.notes = description;
      }
      if (pinToCalendar) {
        payload.calendarDate = calendarDate.toISOString().split('T')[0];
      }
      const result = await apiService.saveMixAndMatchOutfit(payload);
      apiService.recordOutfitEngagement({
        items: selectedItemIds,
        signal: 'saved',
        outfitScore: styleScore,
        scoreBreakdown: scoreDimensions || undefined,
        occasion: OCCASION_SCORE_MAP[eventType],
      }).catch(() => {});
      setShowSaveModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const calMsg = result.calendarEntry
        ? `\n\nAlso pinned to ${formatDate(calendarDate)}.`
        : '';
      Alert.alert('Outfit saved', `"${name}" is ready in your wardrobe.${calMsg}`, [
        { text: 'Keep building', style: 'cancel' },
        { text: t('common.done'), onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save outfit. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const secondaryText = isDark ? '#777' : '#aaa';
  const scoreColor =
    styleScore >= 80 ? LuxuryColors.emerald :
    styleScore >= 60 ? LuxuryColors.gold :
    styleScore >= 35 ? LuxuryColors.coral :
    '#EF4444';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="h3" style={{ fontWeight: '700' }}>Outfit Mix</ThemedText>
          <ThemedText type="caption" style={{ color: secondaryText }}>
            Clueless-style wardrobe builder
          </ThemedText>
        </View>
        <Pressable onPress={handleClear} style={styles.clearBtn}>
          <ThemedText type="caption" style={{ color: theme.link, fontWeight: '600' }}>Reset</ThemedText>
        </Pressable>
      </View>

      {/* Live style score */}
      <View style={[styles.scoreBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
        <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
          {isAiScoring ? (
            <ActivityIndicator size="small" color={scoreColor} />
          ) : (
            <ThemedText type="h3" style={{ color: scoreColor, fontWeight: '800' }}>
              {styleScore}%
            </ThemedText>
          )}
        </View>
        <View style={styles.scoreTextBlock}>
          <ThemedText type="body" style={{ fontWeight: '700' }}>
            Style match
          </ThemedText>
          <ThemedText type="caption" style={{ color: secondaryText }} numberOfLines={2}>
            {scoreHeadline || styleHint}
            {aiScoreApplied ? ' · AI refined' : isAiScoring ? ' · AI refining…' : ''}
          </ThemedText>
          {scoreDimensions ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {Object.entries(scoreDimensions).map(([key, val]) => (
                <View key={key} style={[styles.dimPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                  <ThemedText type="caption" style={{ fontSize: 10, color: secondaryText }}>
                    {DIMENSION_LABELS[key] || key}
                  </ThemedText>
                  <ThemedText type="caption" style={{ fontWeight: '700' }}>{val}/10</ThemedText>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {scoreExplanations[0] ? (
            <ThemedText type="caption" style={{ color: secondaryText, marginTop: 2, fontStyle: 'italic' }} numberOfLines={2}>
              {scoreExplanations[0]}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="caption" style={{ color: secondaryText }}>
          {selectedItemIds.length} pcs
        </ThemedText>
      </View>

      {activeReels.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={48} color={secondaryText} />
          <ThemedText type="body" style={{ color: secondaryText, marginTop: Spacing.lg, textAlign: 'center' }}>
            Add items to your wardrobe{'\n'}to start building outfits
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate('AddWardrobeItem')}
            style={[styles.addItemsBtn, { backgroundColor: theme.link }]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <ThemedText type="body" style={{ color: '#fff', marginLeft: 6, fontWeight: '600' }}>
              Add Items
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.reelsArea}>
            {activeReels.map(({ key }) => (
              <CategoryReel
                key={key}
                category={key}
                items={itemsByCategory[key] ?? []}
                selectedId={selection[key] ?? null}
                onSelect={id => handleSelect(key, id)}
                isDark={isDark}
                rowHeight={compactRowHeight}
                centerWidth={layoutMetrics.centerWidth}
                sideGap={layoutMetrics.sideGap}
                sideInset={layoutMetrics.sideInset}
                snapInterval={layoutMetrics.snapInterval}
              />
            ))}
          </View>

          {showSaveButton ? (
            <View style={[styles.saveFooter, { paddingBottom: bottomNavClearance + Spacing.md }]}>
              <Pressable onPress={handleSave} style={styles.saveButton}>
                <LinearGradient
                  colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  <View style={styles.saveButtonIcon} pointerEvents="none">
                    <Feather name="save" size={17} color="#fff" />
                  </View>
                  <ThemedText type="body" style={styles.saveButtonText}>
                    Save Outfit
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      {/* Save modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowSaveModal(false)}>
              <ThemedText type="body" style={{ color: theme.link }}>Cancel</ThemedText>
            </Pressable>
            <ThemedText type="h3">Save Outfit</ThemedText>
            <Pressable onPress={confirmSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.link} />
              ) : (
                <ThemedText type="body" style={{ color: theme.link, fontWeight: '700' }}>Save</ThemedText>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <ThemedText type="caption" style={[styles.modalLabel, { color: secondaryText }]}>
              Outfit Name
            </ThemedText>
            <TextInput
              value={outfitName}
              onChangeText={setOutfitName}
              placeholder={t('wardrobe.egFridayCasualWorkLook') || "e.g. Friday Casual, Work Look..."}
              placeholderTextColor={secondaryText}
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            <ThemedText type="caption" style={[styles.modalLabel, { color: secondaryText }]}>
              Description
            </ThemedText>
            <TextInput
              value={outfitDescription}
              onChangeText={setOutfitDescription}
              placeholder={t('wardrobe.egSmartCasualForClientDinnerRainyDayLaye') || "e.g. Smart casual for client dinner, rainy day layers..."}
              placeholderTextColor={secondaryText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[
                styles.modalInput,
                styles.modalTextArea,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            <ThemedText type="caption" style={[styles.modalLabel, { color: secondaryText }]}>
              Occasion
            </ThemedText>
            <View style={styles.eventTypeGrid}>
              {EVENT_TYPES.map(et => (
                <Pressable
                  key={et.value}
                  onPress={() => setEventType(et.value)}
                  style={[
                    styles.eventTypeChip,
                    {
                      backgroundColor:
                        eventType === et.value ? theme.link : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{
                      color: eventType === et.value ? '#fff' : theme.text,
                      fontWeight: eventType === et.value ? '700' : '400',
                    }}
                  >
                    {et.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Calendar pin toggle */}
            <View style={[styles.calendarToggleRow, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: '600', fontSize: 14 }}>
                  Pin to calendar
                </ThemedText>
                <ThemedText type="caption" style={{ color: secondaryText, marginTop: 2 }}>
                  Also schedule this outfit for a date
                </ThemedText>
              </View>
              <Switch
                value={pinToCalendar}
                onValueChange={v => {
                  setPinToCalendar(v);
                  if (v) setShowDatePicker(true);
                }}
                trackColor={{ false: isDark ? '#333' : '#ddd', true: theme.link }}
                thumbColor="#fff"
              />
            </View>

            {pinToCalendar ? (
              <Pressable
                onPress={() => setShowDatePicker(prev => !prev)}
                style={[styles.datePickerButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                <Feather name="calendar" size={16} color={theme.link} />
                <ThemedText type="body" style={{ color: theme.link, fontWeight: '600', marginLeft: 8 }}>
                  {formatDate(calendarDate)}
                </ThemedText>
                <Feather name="chevron-down" size={14} color={secondaryText} style={{ marginLeft: 'auto' }} />
              </Pressable>
            ) : null}

            {pinToCalendar && showDatePicker ? (
              <DateTimePicker
                value={calendarDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={(_, date) => {
                  if (date) {
                    setCalendarDate(date);
                    if (Platform.OS === 'android') setShowDatePicker(false);
                  }
                }}
                style={{ alignSelf: 'stretch' }}
              />
            ) : null}

            <ThemedText type="caption" style={[styles.modalLabel, { color: secondaryText }]}>
              {selectedItemIds.length} items selected
            </ThemedText>
            <View style={styles.selectedItemsPreview}>
              {selectedItemIds.map(id => {
                const it = items.find(i => i.id === id);
                if (!it) return null;
                return (
                  <View
                    key={id}
                    style={[
                      styles.selectedItemThumb,
                      {
                        backgroundColor:
                          wardrobeImageBackground(isDark, it) ||
                          theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <WardrobeItemImage
                      item={it}
                      style={styles.selectedThumbImage}
                      processed={!!(it.imageProcessed || it.aiAnalyzed)}
                      contentFit="cover"
                      preferCover
                    />
                  </View>
                );
              })}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
    gap: Spacing.sm,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  scoreRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  scoreTextBlock: {
    flex: 1,
    gap: 2,
  },
  dimPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginRight: 6,
  },
  reelsArea: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingTop: 4,
    gap: 8,
  },
  saveFooter: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    flexShrink: 0,
  },
  backBtn: {
    padding: Spacing.sm,
  },
  clearBtn: {
    padding: Spacing.sm,
  },

  // Reel
  reelRow: {
    overflow: 'hidden',
  },
  reelListContent: {},
  reelItemContainer: {
    position: 'relative',
  },
  reelCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  reelImageWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelImage: {
    width: '100%',
    height: '100%',
    flex: 1,
  },

  // Save button (below last reel)
  saveButton: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 340,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  saveButtonGradient: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.buttonHeight,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.md,
  },
  saveButtonIcon: {
    position: 'absolute',
    left: Spacing.xl,
    top: 0,
    bottom: 0,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    width: '100%',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  addItemsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },

  // Save modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  modalLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    fontSize: 11,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalInput: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  modalTextArea: {
    minHeight: 88,
    paddingTop: Spacing.md,
  },
  eventTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  eventTypeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  calendarToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  selectedItemsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  selectedItemThumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectedThumbImage: {
    width: '100%',
    height: '100%',
  },
});
