import React, { useState, useMemo, useContext, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderHeightContext } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';

import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { ZoomableWardrobeImage } from '@/components/ZoomableWardrobeImage';
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { LimitHitUpgradePrompt } from '@/components/LimitHitUpgradePrompt';
import { useWardrobe, WardrobeItem, PlannedOutfit, PlannedEventType, CATEGORY_LABELS } from '@/contexts/WardrobeContext';
import { onboardingProfileService, type OnboardingProfile } from '@/services/OnboardingProfileService';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';
import { navigateToSubscription } from '@/utils/navigateToSubscription';
import { apiService } from '@/services/ApiService';
import {
  completeOutfitItemIds,
  isCompleteOutfit,
  MIN_OUTFIT_ITEMS,
  wardrobeCanBuildCompleteOutfit,
} from '@/utils/completeOutfit';
import { WeeklyOutfitPlannerPanel } from '@/components/outfit/WeeklyOutfitPlannerPanel';
import {
  buildWeekOccasionRotation,
  OCCASION_TO_PLANNED_EVENT,
  type OutfitOccasionId,
} from '@/constants/outfitOccasions';
import {
  allocateMultiDayPlan,
} from '@/utils/wardrobeAllocationEngine';
import { resolveRegionalStyleContext } from '@/utils/outfitRegionalContext';
import {
  orderItemIdsByVisualOrder,
  sortOutfitItemsByVisualOrder,
  sortWardrobeItemsByCategoryOrder,
} from '@/utils/outfitItemOrder';
import { computeLocalOutfitScore, mergeOutfitScores } from '@/utils/outfitCompatibilityScore';

type OutfitCalendarScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'OutfitCalendar'>;
};

const getSecondaryTextColor = (isDark: boolean) => isDark ? '#B0B0B0' : '#666666';
const getTertiaryTextColor = (isDark: boolean) => isDark ? '#707070' : '#999999';

const EVENT_TYPES: { value: PlannedEventType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'work', label: 'Work', icon: 'briefcase' },
  { value: 'casual', label: 'Casual', icon: 'coffee' },
  { value: 'date-night', label: 'Date Night', icon: 'heart' },
  { value: 'party', label: 'Party', icon: 'music' },
  { value: 'wedding', label: 'Wedding', icon: 'gift' },
  { value: 'formal', label: 'Formal Event', icon: 'star' },
  { value: 'workout', label: 'Workout', icon: 'activity' },
  { value: 'travel', label: 'Travel', icon: 'map-pin' },
  { value: 'everyday', label: 'Everyday', icon: 'sun' },
];

const OCCASION_SCORE_MAP: Record<PlannedEventType, string> = {
  casual: 'casual-hangout',
  work: 'job-interview',
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

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Store planned dates on the user's local calendar day (avoids UTC timezone drift). */
function toPlannedOutfitDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T12:00:00.000Z`;
}


function dedupeWardrobeItems(items: WardrobeItem[]): WardrobeItem[] {
  const seen = new Set<string>();
  const unique: WardrobeItem[] = [];
  for (const item of items) {
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function normalizeItemIds(ids: Array<string | number> | null | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id == null) continue;
    const key = String(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function isSameItemId(a: string | number, b: string | number): boolean {
  return String(a) === String(b);
}

// ── Flat-lay outfit preview (equal-size tiles, category order) ─────────────
type StackedOutfitPreviewProps = {
  outfitItems: WardrobeItem[];
  onItemPress?: (item: WardrobeItem) => void;
  onOpenFullPreview?: () => void;
};

function StackedOutfitPreview({
  outfitItems,
  onItemPress,
  onOpenFullPreview,
}: StackedOutfitPreviewProps) {
  const { isDark } = useTheme();
  const uniqueItems = sortOutfitItemsByVisualOrder(dedupeWardrobeItems(outfitItems));

  const slotBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const canvasBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';

  if (uniqueItems.length === 0) return null;

  return (
    <View style={[styles.flatLayCanvas, { backgroundColor: canvasBg }]}>
      <View style={styles.flatLayGrid}>
        {uniqueItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              if (onItemPress) onItemPress(item);
              else onOpenFullPreview?.();
            }}
            style={[styles.flatLaySlot, styles.flatLayEqualSlot, { backgroundColor: slotBg }]}
          >
            {item.imageUri ? (
              <Image
                source={{ uri: item.imageUri }}
                style={styles.flatLayImage}
                contentFit="contain"
              />
            ) : (
              <Feather name="image" size={28} color={isDark ? '#555' : '#ccc'} />
            )}
          </Pressable>
        ))}
      </View>

      {onOpenFullPreview ? (
        <Pressable onPress={onOpenFullPreview} style={styles.flatLayItemCount}>
          <ThemedText type="caption" style={{ color: isDark ? '#888' : '#999', fontSize: 11 }}>
            {uniqueItems.length} {uniqueItems.length === 1 ? 'item' : 'items'} · tap to enlarge
          </ThemedText>
        </Pressable>
      ) : (
        <View style={styles.flatLayItemCount}>
          <ThemedText type="caption" style={{ color: isDark ? '#888' : '#999', fontSize: 11 }}>
            {uniqueItems.length} {uniqueItems.length === 1 ? 'item' : 'items'}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function OutfitCalendarScreen({ navigation }: OutfitCalendarScreenProps) {
  const { theme, isDark } = useTheme();
  const headerHeightCtx = useContext(HeaderHeightContext);
  const hasStackHeader = typeof headerHeightCtx === 'number' && headerHeightCtx > 0;
  const { t, translations } = useTranslations();
  const { user, actualCountry } = useAuth();
  const { limits } = useSubscription();
  const secondaryTextColor = getSecondaryTextColor(isDark);
  const tertiaryTextColor = getTertiaryTextColor(isDark);
  const { 
    items, 
    plannedOutfits, 
    savedOutfits,
    planOutfit,
    updatePlannedOutfit,
    deletePlannedOutfit,
    markPlannedOutfitWorn,
    getItemsByCategory 
  } = useWardrobe();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [isFetchingOutfit, setIsFetchingOutfit] = useState(false);
  
  const [newEventName, setNewEventName] = useState('');
  const [newEventType, setNewEventType] = useState<PlannedEventType>('casual');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  
  const [editingOutfitId, setEditingOutfitId] = useState<string | null>(null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [showOutfitLookPreview, setShowOutfitLookPreview] = useState(false);

  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(null);
  const scoringLocationRef = useRef<{ lat?: number; lon?: number }>({});
  const scoreRequestRef = useRef(0);
  const [styleScore, setStyleScore] = useState(0);
  const [styleHint, setStyleHint] = useState('Select items to rate this outfit');
  const [scoreDimensions, setScoreDimensions] = useState<Record<string, number> | null>(null);
  const [scoreExplanations, setScoreExplanations] = useState<string[]>([]);
  const [scoreHeadline, setScoreHeadline] = useState<string | null>(null);
  const [isAiScoring, setIsAiScoring] = useState(false);
  const [aiScoreApplied, setAiScoreApplied] = useState(false);

  const [showAIModal, setShowAIModal] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatingDays, setGeneratingDays] = useState<number>(7);
  const [focusOccasionId, setFocusOccasionId] = useState<OutfitOccasionId | null>(null);
  const [aiGenerateProgress, setAiGenerateProgress] = useState({ current: 0, total: 0 });

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const plannedOutfitsByDate = useMemo(() => {
    const map: Record<string, PlannedOutfit[]> = {};
    plannedOutfits.forEach(outfit => {
      const dateKey = outfit.date.split('T')[0];
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(outfit);
    });
    return map;
  }, [plannedOutfits]);

  const sortedWardrobeItems = useMemo(
    () => sortWardrobeItemsByCategoryOrder(items),
    [items],
  );

  const regionalContext = useMemo(
    () => resolveRegionalStyleContext(user, onboardingProfile),
    [user, onboardingProfile, actualCountry],
  );

  const selectedWardrobeItems = useMemo(
    () => selectedItems
      .map((id) => items.find((item) => isSameItemId(item.id, id)))
      .filter((item): item is WardrobeItem => Boolean(item)),
    [selectedItems, items],
  );

  const selectionKey = useMemo(
    () => selectedItems.slice().sort().join('|'),
    [selectedItems],
  );

  const previewItem = useMemo(
    () => (previewItemId
      ? items.find((item) => String(item.id) === String(previewItemId)) || null
      : null),
    [previewItemId, items],
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

  useEffect(() => {
    if (!showAddModal) {
      setStyleScore(0);
      setStyleHint('Select items to rate this outfit');
      setScoreDimensions(null);
      setScoreExplanations([]);
      setScoreHeadline(null);
      setAiScoreApplied(false);
      setIsAiScoring(false);
      return;
    }

    const local = computeLocalOutfitScore(
      selectedWardrobeItems,
      regionalContext,
      user?.colorScanData?.colorSeasonType ?? null,
    );
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
          occasion: OCCASION_SCORE_MAP[newEventType] || 'casual-hangout',
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
            unifiedScoreApplied: (result as any).unifiedScoreApplied,
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
  }, [
    showAddModal,
    selectionKey,
    newEventType,
    selectedWardrobeItems,
    regionalContext,
    user?.country,
    actualCountry,
  ]);

  const closeItemPreview = useCallback(() => {
    setPreviewItemId(null);
  }, []);

  const closeOutfitLookPreview = useCallback(() => {
    setShowOutfitLookPreview(false);
  }, []);

  const closePlanModal = useCallback(() => {
    setPreviewItemId(null);
    setShowOutfitLookPreview(false);
    setShowAddModal(false);
    setEditingOutfitId(null);
  }, []);

  const handlePlanModalRequestClose = useCallback(() => {
    if (previewItemId) {
      closeItemPreview();
      return;
    }
    if (showOutfitLookPreview) {
      closeOutfitLookPreview();
      return;
    }
    closePlanModal();
  }, [previewItemId, showOutfitLookPreview, closeItemPreview, closeOutfitLookPreview, closePlanModal]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days: (number | null)[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayPress = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
  };

  const getPlannedOutfitsForDay = (day: number): PlannedOutfit[] => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(date);
    return plannedOutfitsByDate[dateKey] || [];
  };

  const selectedDateOutfits = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = formatDateKey(selectedDate);
    return plannedOutfitsByDate[dateKey] || [];
  }, [selectedDate, plannedOutfitsByDate]);

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isPastDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleAddOutfit = () => {
    setEditingOutfitId(null);
    setNewEventName('');
    setNewEventType('casual');
    setSelectedItems([]);
    setNotes('');
    setShowAddModal(true);
  };

  const handleEditOutfit = async (outfit: PlannedOutfit) => {
    // Pre-populate from local state immediately so modal opens with the saved look
    const localIds = normalizeItemIds(outfit.itemIds);
    setEditingOutfitId(outfit.id);
    setNewEventName(outfit.eventName || '');
    setNewEventType(outfit.eventType || 'casual');
    setSelectedItems(localIds);
    setNotes(outfit.notes || '');
    setPreviewItemId(null);
    setShowOutfitLookPreview(false);
    setShowAddModal(true);
    // Then fetch fresh data from backend — only replace if it returns real item IDs
    setIsFetchingOutfit(true);
    try {
      const result = await apiService.getOutfitCalendarEntry(outfit.id);
      const remoteIds = normalizeItemIds(result?.outfit?.itemIds);
      if (remoteIds.length > 0) {
        setNewEventName(result.outfit.eventName || '');
        setNewEventType((result.outfit.eventType as PlannedEventType) || 'casual');
        setSelectedItems(remoteIds);
        setNotes(result.outfit.notes || '');
      }
    } catch (err) {
      // Backend unavailable or local-only plan id — keep local selection
      console.log('[OutfitCalendar] GET outfit-calendar/:id failed, using local data:', err);
    } finally {
      setIsFetchingOutfit(false);
    }
  };

  const handleSaveOutfit = async () => {
    if (selectedItems.length === 0) {
      Alert.alert(t('wardrobe.noItemsSelected'), t('wardrobe.noItemsSelectedOutfit'));
      return;
    }

    const completedIds = orderItemIdsByVisualOrder(
      completeOutfitItemIds(normalizeItemIds(selectedItems), items),
      items,
    );
    if (!isCompleteOutfit(completedIds, items)) {
      Alert.alert(
        t('wardrobe.incompleteOutfit'),
        t('wardrobe.incompleteOutfitMessage').replace('{n}', String(MIN_OUTFIT_ITEMS)),
      );
      return;
    }

    try {
      if (editingOutfitId) {
        await updatePlannedOutfit(editingOutfitId, {
          itemIds: completedIds,
          eventName: newEventName || undefined,
          eventType: newEventType,
          notes: notes || undefined,
        });
      } else {
        if (!selectedDate) return;
        await planOutfit({
          date: toPlannedOutfitDateIso(selectedDate),
          itemIds: completedIds,
          eventName: newEventName || undefined,
          eventType: newEventType,
          notes: notes || undefined,
        });
      }
      setShowAddModal(false);
      setEditingOutfitId(null);
      setPreviewItemId(null);
      setShowOutfitLookPreview(false);
    } catch (error) {
      Alert.alert(t('common.error'), t('wardrobe.failedToSaveOutfitPlan'));
    }
  };

  const handleDeleteOutfit = (id: string) => {
    Alert.alert(t('wardrobe.deleteOutfitPlan') || "Delete Outfit Plan", t('wardrobe.areYouSureYouWantToRemoveThisPlannedOutf') || "Are you sure you want to remove this planned outfit?",
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.delete'), 
          style: 'destructive',
          onPress: () => deletePlannedOutfit(id)
        },
      ]
    );
  };

  const handleMarkWorn = async (id: string) => {
    try {
      await markPlannedOutfitWorn(id);
      // Success is visible via the Worn badge — no Alert OK bar.
    } catch (error) {
      Alert.alert(t('common.error'), t('wardrobe.failedToMarkWorn'));
    }
  };

  const handleAICreateOutfits = () => {
    if (!wardrobeCanBuildCompleteOutfit(items)) {
      Alert.alert(
        t('wardrobe.needMoreItems'),
        t('wardrobe.needMoreItemsAi').replace('{n}', String(MIN_OUTFIT_ITEMS)),
        [{ text: t('common.ok') }]
      );
      return;
    }
    setShowAIModal(true);
  };

  const generateAIOutfitsForWeek = async () => {
    setIsGeneratingAI(true);
    setAiGenerateProgress({ current: 0, total: generatingDays });
    try {
      if (!wardrobeCanBuildCompleteOutfit(items)) {
        Alert.alert(
          t('wardrobe.needMoreItems') || 'Need more wardrobe pieces',
          t('wardrobe.needMoreItemsAi')?.replace('{n}', String(MIN_OUTFIT_ITEMS))
            || `Add at least ${MIN_OUTFIT_ITEMS} items including tops, bottoms, and shoes so we can build full outfits.`,
        );
        setShowAIModal(false);
        return;
      }

      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const occasionTypes = buildWeekOccasionRotation(generatingDays, focusOccasionId, today);
      const ownedItems = items.filter((item) => !item.origin || item.origin === 'owned');
      const wardrobeForGen = ownedItems.length >= MIN_OUTFIT_ITEMS ? ownedItems : items;

      // Constraint engine first with honest fallback modes (never fake variety)
      let plan = allocateMultiDayPlan({
        wardrobe: wardrobeForGen,
        occasionTypes,
        preferReduceDaysOverRotation: true,
        allowReduceDays: false,
      });

      if (!plan.ok) {
        const maxDays = plan.maxPossibleDays;
        const guidance = (plan.guidance || []).join('\n• ');
        const choice = await new Promise<'cancel' | 'reduce' | 'rotation'>((resolve) => {
          if (maxDays < 1) {
            Alert.alert(
              t('wardrobe.notEnoughUniqueOutfits') || 'Need more items for full variety',
              `${plan.message}${guidance ? `\n\n• ${guidance}` : ''}`,
              [{ text: t('common.ok') || 'OK', onPress: () => resolve('cancel') }],
            );
            return;
          }
          Alert.alert(
            t('wardrobe.limitedWardrobeTitle') || 'Limited wardrobe detected',
            `${plan.message}${guidance ? `\n\n• ${guidance}` : ''}`,
            [
              { text: t('common.cancel') || 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
              {
                text: (t('wardrobe.planNUniqueDays') || '{n} unique days').replace('{n}', String(maxDays)),
                onPress: () => resolve('reduce'),
              },
              {
                text: t('wardrobe.useRotationMode') || 'Rotation mode',
                onPress: () => resolve('rotation'),
              },
            ],
          );
        });

        if (choice === 'cancel') {
          setShowAIModal(false);
          return;
        }

        if (choice === 'reduce') {
          plan = allocateMultiDayPlan({
            wardrobe: wardrobeForGen,
            occasionTypes: occasionTypes.slice(0, maxDays),
            preferReduceDaysOverRotation: true,
            allowReduceDays: true,
          });
        } else {
          plan = allocateMultiDayPlan({
            wardrobe: wardrobeForGen,
            occasionTypes,
            forceMode: 'rotation',
          });
        }
      }

      if (!plan.ok) {
        Alert.alert(
          t('wardrobe.noOutfitsCreated') || 'No Outfits Created',
          plan.message,
        );
        setShowAIModal(false);
        return;
      }

      // Transparent mode notice (not a fake "success" — honesty about constraints)
      if (plan.mode !== 'strict') {
        Alert.alert(
          plan.modeLabel,
          plan.modeExplanation,
          [{ text: t('common.ok') || 'OK' }],
        );
      }

      setAiGenerateProgress({ current: 0, total: plan.days.length });
      let successCount = 0;
      let firstPlannedDate: Date | null = null;
      let lastFailureReason = '';

      for (let i = 0; i < plan.days.length; i++) {
        setAiGenerateProgress({ current: i + 1, total: plan.days.length });
        const dayPlan = plan.days[i];
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + dayPlan.dayIndex);
        const itemIds = dayPlan.itemIds;

        if (!isCompleteOutfit(itemIds, wardrobeForGen)) {
          lastFailureReason = 'Allocated outfit was incomplete.';
          continue;
        }

        try {
          const eventType = (OCCASION_TO_PLANNED_EVENT[dayPlan.occasionType] || 'casual') as PlannedEventType;
          const reuseBits = [
            dayPlan.reusedHardIds.length ? 'spaced laundry reuse' : null,
            dayPlan.reusedSoftIds.length ? 'soft shoe/accessory reuse' : null,
          ].filter(Boolean);
          const reuseNote = reuseBits.length ? ` (${reuseBits.join(', ')})` : '';
          await planOutfit({
            date: toPlannedOutfitDateIso(targetDate),
            itemIds,
            eventName: `AI ${dayPlan.occasionType.replace(/_/g, ' ')}`,
            eventType,
            notes: `${plan.modeLabel}.${reuseNote}`,
          });
          successCount++;
          if (!firstPlannedDate) firstPlannedDate = targetDate;
        } catch (planErr) {
          lastFailureReason = planErr instanceof Error ? planErr.message : 'Failed to save planned outfit';
          console.log(`Failed to save outfit for day ${i + 1}:`, planErr);
        }
      }

      setAiGenerateProgress({ current: plan.days.length, total: plan.days.length });
      setShowAIModal(false);

      if (successCount > 0) {
        if (firstPlannedDate) {
          setCurrentDate(new Date(firstPlannedDate.getFullYear(), firstPlannedDate.getMonth(), 1));
          setSelectedDate(firstPlannedDate);
        }
      } else {
        Alert.alert(
          t('wardrobe.noOutfitsCreated') || 'No Outfits Created',
          lastFailureReason
            || (t('wardrobe.aiCouldntMatchYourWardrobeItems')
              || "Couldn't save the wardrobe plan. Try again."),
        );
      }
    } catch (error) {
      console.error('Outfit allocation error:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('wardrobe.failedToGenerateAiOutfits'),
      );
    } finally {
      setIsGeneratingAI(false);
      setAiGenerateProgress({ current: 0, total: 0 });
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const key = String(itemId);
    setSelectedItems(prev =>
      prev.some((id) => isSameItemId(id, key))
        ? prev.filter((id) => !isSameItemId(id, key))
        : [...prev, key]
    );
  };

  const getItemById = (itemId: string): WardrobeItem | undefined => {
    const key = String(itemId);
    return items.find(item => String(item.id) === key);
  };

  const getEventIcon = (eventType?: PlannedEventType): keyof typeof Feather.glyphMap => {
    if (!eventType) return 'calendar';
    const event = EVENT_TYPES.find(e => e.value === eventType);
    return event?.icon || 'calendar';
  };

  const getEventLabel = (eventType?: PlannedEventType): string => {
    if (!eventType) return '';
    const event = EVENT_TYPES.find(e => e.value === eventType);
    return event?.label || '';
  };

  const renderCalendarDay = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const outfitsForDay = getPlannedOutfitsForDay(day);
    const hasOutfits = outfitsForDay.length > 0;
    const isSelected = selectedDate?.getDate() === day && 
                       selectedDate?.getMonth() === currentDate.getMonth() &&
                       selectedDate?.getFullYear() === currentDate.getFullYear();
    const past = isPastDate(day);
    const wornOnDay = outfitsForDay.some(o => o.wasWorn);

    return (
      <Pressable
        key={`day-${day}`}
        onPress={() => handleDayPress(day)}
        style={[
          styles.dayCell,
          isToday(day) ? [styles.todayCell, { borderColor: theme.link }] : null,
          isSelected ? [styles.selectedCell, { backgroundColor: theme.link }] : null,
        ]}
      >
        <ThemedText
          type="body"
          style={[
            styles.dayText,
            isSelected ? { color: '#FFFFFF' } : null,
            past && !isSelected ? { opacity: 0.5 } : null,
          ]}
        >
          {day}
        </ThemedText>
        <View style={styles.dotsContainer}>
          {hasOutfits
            ? outfitsForDay.slice(0, 3).map((outfit) => (
                <View
                  key={outfit.id}
                  style={[
                    styles.outfitDot,
                    { backgroundColor: outfit.wasWorn ? theme.success : theme.link },
                  ]}
                />
              ))
            : null}
        </View>
      </Pressable>
    );
  };

  const renderOutfitItem = ({ item }: { item: PlannedOutfit }) => {
    const outfitItems = dedupeWardrobeItems(
      item.itemIds.map(id => getItemById(id)).filter(Boolean) as WardrobeItem[],
    );
    const eventLabel = getEventLabel(item.eventType);

    return (
      <Card elevation={1} style={styles.outfitCard}>
        <View style={styles.outfitCardHeader}>
          <View style={styles.outfitCardInfo}>
            <Feather 
              name={getEventIcon(item.eventType)} 
              size={20} 
              color={theme.link} 
            />
            <View style={styles.outfitCardText}>
              <ThemedText type="body" style={{ fontWeight: '600' }}>
                {item.eventName || 'Planned Outfit'}
              </ThemedText>
              <ThemedText type="caption" style={{ color: secondaryTextColor }}>
                {eventLabel ? `${eventLabel} • ` : ''}{outfitItems.length} items
              </ThemedText>
            </View>
          </View>
          {item.wasWorn ? (
            <View style={[styles.wornBadge, { backgroundColor: theme.success }]}>
              <Feather name="check" size={12} color="#FFFFFF" />
              <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: 4 }}>
                Worn
              </ThemedText>
            </View>
          ) : null}
        </View>

        <StackedOutfitPreview outfitItems={outfitItems} />

        {item.notes ? (
          <ThemedText type="caption" style={[styles.notesText, { color: secondaryTextColor }]}>
            {item.notes}
          </ThemedText>
        ) : null}

        <View style={styles.outfitCardActions}>
          {!item.wasWorn ? (
            <Pressable
              onPress={() => handleMarkWorn(item.id)}
              style={[styles.actionButton, { backgroundColor: theme.success }]}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: 4 }}>
                Mark as Worn
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => handleEditOutfit(item)}
            style={[styles.actionButton, { backgroundColor: theme.link }]}
          >
            <Feather name="edit-2" size={16} color="#FFFFFF" />
            <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: 4 }}>
              Edit
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleDeleteOutfit(item.id)}
            style={[styles.actionButton, { backgroundColor: theme.error }]}
          >
            <Feather name="trash-2" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </Card>
    );
  };

  const renderWardrobeItem = ({ item }: { item: WardrobeItem }) => {
    const isSelected = selectedItems.some((id) => isSameItemId(id, item.id));

    return (
      <Pressable
        onPress={() => setPreviewItemId(String(item.id))}
        style={[
          styles.wardrobeItemCard,
          { backgroundColor: theme.backgroundSecondary },
          isSelected ? { borderColor: theme.link, borderWidth: 2 } : null,
        ]}
      >
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.wardrobeItemImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.wardrobeItemPlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather name="image" size={32} color={tertiaryTextColor} />
          </View>
        )}
        <View style={styles.wardrobeItemInfo}>
          <ThemedText type="caption" numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText type="caption" style={{ color: tertiaryTextColor }}>
            {CATEGORY_LABELS[item.category] || item.category}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => toggleItemSelection(String(item.id))}
          hitSlop={8}
          style={[
            styles.checkBadge,
            {
              backgroundColor: isSelected ? theme.link : theme.backgroundTertiary,
              borderWidth: isSelected ? 0 : 1,
              borderColor: theme.border,
            },
          ]}
        >
          {isSelected ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
        </Pressable>
      </Pressable>
    );
  };

  if (!limits.canAccessOutfitCalendar) {
    const personalStylist =
      t('subscription.plan.personalStylist.name') || 'Personal Stylist';
    const tierLine =
      t('wardrobe.outfitCalendarIsPartOfStylistUnlimited') ||
      'Outfit Calendar is part of Personal Stylist';
    return (
      <ScreenKeyboardAwareScrollView opaqueHeader={hasStackHeader}>
        <LimitHitUpgradePrompt
          variant="card"
          title={t('stylistHub.outfitCalendar') || t('navTitles.outfitCalendar') || 'Outfit Calendar'}
          message={`${tierLine}. Plan looks ahead, pack for trips, and map outfits to your week.`}
          ctaLabel={`${t('common.upgrade') || 'Upgrade'} — ${personalStylist}`}
          onUpgrade={() => navigateToSubscription(navigation, 'personal_stylist')}
        />
      </ScreenKeyboardAwareScrollView>
    );
  }

  return (
    <ScreenKeyboardAwareScrollView opaqueHeader={hasStackHeader}>
      <Card elevation={1} style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={goToPreviousMonth} style={styles.monthNavButton}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </ThemedText>
          <Pressable onPress={goToNextMonth} style={styles.monthNavButton}>
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekDaysRow}>
          {DAYS_OF_WEEK.map(day => (
            <View key={day} style={styles.weekDayCell}>
              <ThemedText type="caption" style={{ color: secondaryTextColor }}>
                {day}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => renderCalendarDay(day, index))}
        </View>
      </Card>

      <Pressable
        onPress={handleAICreateOutfits}
        style={styles.aiCreateButton}
      >
        <LinearGradient
          colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.aiCreateButtonGradient}
        >
          <Feather name="cpu" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.aiCreateButtonText}>
            Get Styled by Your AI Stylist
          </ThemedText>
          <Feather name="chevron-right" size={18} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {selectedDate ? (
        <View style={styles.selectedDateSection}>
          <View style={styles.selectedDateHeader}>
            <ThemedText type="h3">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </ThemedText>
            {selectedDateOutfits.length > 0 ? (
              <Pressable
                onPress={handleAddOutfit}
                style={[styles.addButton, { backgroundColor: theme.link }]}
              >
                <Feather name="plus" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>

          {selectedDateOutfits.length > 0 ? (
            <FlatList
              data={selectedDateOutfits}
              renderItem={renderOutfitItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.outfitsList}
            />
          ) : (
            <Card elevation={1} style={styles.emptyCard}>
              <Feather name="calendar" size={40} color={tertiaryTextColor} />
              <ThemedText type="body" style={[styles.emptyText, { color: secondaryTextColor }]}>
                No outfits scheduled for this day
              </ThemedText>
              <Pressable
                onPress={handleAddOutfit}
                style={[styles.planButton, { backgroundColor: theme.link }]}
              >
                <Feather name="plus" size={16} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: '#FFFFFF', marginLeft: 8 }}>
                  Add Outfit
                </ThemedText>
              </Pressable>
            </Card>
          )}
        </View>
      ) : (
        <Card elevation={1} style={styles.selectDateCard}>
          <Feather name="calendar" size={40} color={tertiaryTextColor} />
          <ThemedText type="body" style={[styles.emptyText, { color: secondaryTextColor }]}>
            Select a date to view your outfits
          </ThemedText>
        </Card>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePlanModalRequestClose}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                if (previewItemId) {
                  closeItemPreview();
                  return;
                }
                if (showOutfitLookPreview) {
                  closeOutfitLookPreview();
                  return;
                }
                closePlanModal();
              }}
            >
              <ThemedText type="body" style={{ color: theme.link }}>
                {previewItemId || showOutfitLookPreview ? 'Back' : 'Cancel'}
              </ThemedText>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText type="h3">{editingOutfitId ? 'Edit Outfit' : 'Plan Outfit'}</ThemedText>
              {isFetchingOutfit ? (
                <ActivityIndicator size="small" color={theme.link} />
              ) : null}
            </View>
            <Pressable onPress={handleSaveOutfit}>
              <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
                Save
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedItems.length > 0 ? (
              <View style={styles.modalPreviewContainer}>
                <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor, marginTop: 0 }]}>
                  Outfit Preview
                </ThemedText>
                <StackedOutfitPreview
                  outfitItems={selectedWardrobeItems}
                  onItemPress={(item) => setPreviewItemId(item.id)}
                  onOpenFullPreview={() => setShowOutfitLookPreview(true)}
                />
                {(() => {
                  const scoreColor =
                    styleScore >= 80 ? LuxuryColors.emerald :
                    styleScore >= 60 ? LuxuryColors.gold :
                    styleScore >= 35 ? LuxuryColors.coral :
                    '#EF4444';
                  return (
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
                          Outfit rating
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: secondaryTextColor }} numberOfLines={3}>
                          {scoreHeadline || styleHint}
                          {aiScoreApplied ? ' · AI refined' : isAiScoring ? ' · AI refining…' : ''}
                        </ThemedText>
                        {scoreDimensions ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                            {Object.entries(scoreDimensions).map(([key, val]) => (
                              <View
                                key={key}
                                style={[styles.dimPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                              >
                                <ThemedText type="caption" style={{ fontSize: 10, color: secondaryTextColor }}>
                                  {DIMENSION_LABELS[key] || key}
                                </ThemedText>
                                <ThemedText type="caption" style={{ fontWeight: '700' }}>{val}/10</ThemedText>
                              </View>
                            ))}
                          </ScrollView>
                        ) : null}
                        {scoreExplanations[0] ? (
                          <ThemedText
                            type="caption"
                            style={{ color: secondaryTextColor, marginTop: 2, fontStyle: 'italic' }}
                            numberOfLines={2}
                          >
                            {scoreExplanations[0]}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  );
                })()}
                {selectedWardrobeItems.length > 0 ? (
                  <View>
                    <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
                      {editingOutfitId
                        ? 'Items in this outfit — tap × to remove, then pick a replacement below'
                        : 'Tap × to remove an item'}
                    </ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {selectedWardrobeItems.map((it) => (
                        <Pressable
                          key={String(it.id)}
                          onPress={() => {
                            // Draft-only until Save — Cancel keeps the original outfit
                            setSelectedItems((prev) => prev.filter((sid) => !isSameItemId(sid, it.id)));
                          }}
                          style={[styles.removeItemChip, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                        >
                          {it.imageUri ? (
                            <Image source={{ uri: it.imageUri }} style={styles.removeItemThumb} contentFit="contain" />
                          ) : (
                            <Feather name="image" size={18} color={secondaryTextColor} />
                          )}
                          <View style={[styles.removeItemX, { backgroundColor: theme.error }]}>
                            <Feather name="x" size={9} color="#fff" />
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            ) : null}

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Event Name (Optional)
            </ThemedText>
            <TextInput
              value={newEventName}
              onChangeText={setNewEventName}
              placeholder={t('wardrobe.egBirthdayPartyWorkMeeting') || "e.g., Birthday Party, Work Meeting"}
              placeholderTextColor={tertiaryTextColor}
              style={[
                styles.input,
                { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Event Type
            </ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.eventTypesScroll}
            >
              {EVENT_TYPES.map(eventType => (
                <Pressable
                  key={eventType.value}
                  onPress={() => setNewEventType(eventType.value)}
                  style={[
                    styles.eventTypeChip,
                    { 
                      backgroundColor: newEventType === eventType.value 
                        ? theme.link 
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Feather 
                    name={eventType.icon} 
                    size={16} 
                    color={newEventType === eventType.value ? '#FFFFFF' : theme.text} 
                  />
                  <ThemedText 
                    type="caption" 
                    style={{ 
                      color: newEventType === eventType.value ? '#FFFFFF' : theme.text,
                      marginLeft: 6,
                    }}
                  >
                    {eventType.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Select Outfit Items ({selectedItems.length} selected)
            </ThemedText>
            
            {sortedWardrobeItems.length > 0 ? (
              <FlatList
                data={sortedWardrobeItems}
                renderItem={renderWardrobeItem}
                keyExtractor={item => item.id}
                numColumns={3}
                scrollEnabled={false}
                contentContainerStyle={styles.wardrobeGrid}
                columnWrapperStyle={styles.wardrobeRow}
              />
            ) : (
              <Card elevation={2} style={styles.noItemsCard}>
                <Feather name="inbox" size={32} color={tertiaryTextColor} />
                <ThemedText type="body" style={{ color: secondaryTextColor, marginTop: 8 }}>
                  No items in your wardrobe yet
                </ThemedText>
                <Pressable
                  onPress={() => {
                    closePlanModal();
                    navigation.navigate('AddWardrobeItem');
                  }}
                  style={[styles.addItemButton, { backgroundColor: theme.link }]}
                >
                  <ThemedText type="caption" style={{ color: '#FFFFFF' }}>
                    Add Items
                  </ThemedText>
                </Pressable>
              </Card>
            )}

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Notes (Optional)
            </ThemedText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('wardrobe.anySpecialNotesForThisOutfit') || "Any special notes for this outfit..."}
              placeholderTextColor={tertiaryTextColor}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.notesInput,
                { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            <View style={{ height: 100 }} />
          </ScrollView>

          {previewItem ? (
            <GestureHandlerRootView style={styles.previewOverlay}>
              <ThemedView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={closeItemPreview}>
                    <ThemedText type="body" style={{ color: theme.link }}>
                      Back
                    </ThemedText>
                  </Pressable>
                  <ThemedText type="h3" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: 8 }}>
                    {previewItem.name}
                  </ThemedText>
                  <Pressable onPress={() => toggleItemSelection(String(previewItem.id))}>
                <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
                  {previewItem && selectedItems.some((id) => isSameItemId(id, previewItem.id)) ? 'Remove' : 'Select'}
                </ThemedText>
                  </Pressable>
                </View>
                <View style={styles.itemPreviewBody}>
                  <ZoomableWardrobeImage
                    uri={previewItem.imageUri}
                    hintColor={secondaryTextColor}
                  />
                  <ThemedText type="caption" style={{ color: secondaryTextColor, textAlign: 'center', marginTop: Spacing.md }}>
                    {CATEGORY_LABELS[previewItem.category] || previewItem.category}
                    {previewItem.color ? ` · ${previewItem.color}` : ''}
                  </ThemedText>
                </View>
              </ThemedView>
            </GestureHandlerRootView>
          ) : null}

          {showOutfitLookPreview ? (
            <View style={styles.previewOverlay}>
              <ThemedView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={closeOutfitLookPreview}>
                    <ThemedText type="body" style={{ color: theme.link }}>
                      Back
                    </ThemedText>
                  </Pressable>
                  <ThemedText type="h3">Outfit Look</ThemedText>
                  <View style={{ width: 50 }} />
                </View>
                <ScrollView contentContainerStyle={styles.outfitLookBody}>
                  <StackedOutfitPreview
                    outfitItems={selectedWardrobeItems}
                    onItemPress={(item) => {
                      closeOutfitLookPreview();
                      setPreviewItemId(item.id);
                    }}
                  />
                  <ThemedText type="caption" style={{ color: secondaryTextColor, textAlign: 'center', marginTop: Spacing.md }}>
                    Tap a piece for a closer look · pinch to zoom on item preview
                  </ThemedText>
                </ScrollView>
              </ThemedView>
            </View>
          ) : null}
        </ThemedView>
      </Modal>

      <Modal
        visible={showAIModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAIModal(false)}>
              <ThemedText type="body" style={{ color: theme.link }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3">AI Outfit Planner</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <WeeklyOutfitPlannerPanel
              wardrobeCount={items.length}
              generatingDays={generatingDays}
              onDaysChange={setGeneratingDays}
              focusOccasionId={focusOccasionId}
              onFocusOccasionChange={setFocusOccasionId}
              isGenerating={isGeneratingAI}
              progress={aiGenerateProgress}
              onGenerate={generateAIOutfitsForWeek}
            />
            <View style={{ height: 100 }} />
          </ScrollView>
        </ThemedView>
      </Modal>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.sm,
  },
  calendarCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  monthNavButton: {
    padding: Spacing.sm,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    flexDirection: 'column',
  },
  todayCell: {
    borderWidth: 2,
    borderRadius: BorderRadius.full,
  },
  selectedCell: {
    borderRadius: BorderRadius.full,
  },
  dayText: {
    fontSize: 14,
    lineHeight: 18,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 6,
    minHeight: 5,
  },
  outfitDot: {
    width: 5,
    height: 5,
    borderRadius: BorderRadius.full,
  },
  selectedDateSection: {
    paddingHorizontal: Spacing.lg,
  },
  selectedDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitsList: {
    gap: Spacing.md,
  },
  outfitCard: {
    marginBottom: Spacing.md,
  },
  outfitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  outfitCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  outfitCardText: {
    gap: 2,
  },
  wornBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  notesText: {
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  outfitCardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  flatLayCanvas: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    padding: Spacing.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  flatLayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'flex-start',
  },
  flatLayRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  flatLayCenterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  flatLaySlot: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatLayEqualSlot: {
    width: '48.5%',
    aspectRatio: 1,
  },
  flatLayHalfSlot: {
    flex: 1,
    aspectRatio: 1,
  },
  flatLayCenterSlot: {
    width: '48.5%',
    aspectRatio: 1,
  },
  flatLayFootSlot: {
    flex: 1,
    aspectRatio: 1,
  },
  flatLayImage: {
    width: '100%',
    height: '100%',
  },
  flatLayItemCount: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  modalPreviewContainer: {
    marginBottom: Spacing.sm,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  scoreRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTextBlock: {
    flex: 1,
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
  itemPreviewBody: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  outfitLookBody: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  selectDateCard: {
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  input: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  eventTypesScroll: {
    marginVertical: Spacing.sm,
  },
  eventTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  wardrobeGrid: {
    paddingVertical: Spacing.md,
  },
  wardrobeRow: {
    justifyContent: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  wardrobeItemCard: {
    width: '31%',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  wardrobeItemImage: {
    width: '100%',
    aspectRatio: 1,
  },
  wardrobeItemPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeItemInfo: {
    padding: Spacing.sm,
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noItemsCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  addItemButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  removeItemChip: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  removeItemThumb: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
  },
  removeItemX: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCreateButton: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  aiCreateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  aiCreateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  aiModalHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  aiModalIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiModalDescription: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  daysSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dayOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  aiInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  aiInfoText: {
    flex: 1,
    lineHeight: 18,
  },
  generateButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
