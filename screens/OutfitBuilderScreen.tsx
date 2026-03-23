import React, { useState, useRef, useCallback, useMemo } from 'react';
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
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
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
import { apiService } from '@/services/ApiService';
import type { WardrobeStackParamList } from '@/navigation/WardrobeStackNavigator';

const { width: SW } = Dimensions.get('window');

type OutfitBuilderScreenProps = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, 'OutfitBuilder'>;
};

// How wide the focused center item is
const CENTER_W = SW * 0.66;
const SIDE_GAP = 8;
const SNAP_INTERVAL = CENTER_W + SIDE_GAP;
const SIDE_INSET = (SW - CENTER_W) / 2;

// Height of each category row in the stacked view
const ROW_HEIGHTS: Partial<Record<ClothingCategory, number>> = {
  outerwear: 210,
  tops: 200,
  bottoms: 240,
  dresses: 260,
  formal: 220,
  activewear: 200,
  shoes: 130,
  bags: 130,
  accessories: 110,
  swimwear: 150,
  sleepwear: 170,
};

// Category display order (body top → bottom → feet → sides)
// 'activewear' row is kept for legacy items; activewear_tops merge into tops, activewear_bottoms into bottoms
const REEL_ORDER: Array<{ key: ClothingCategory; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'outerwear',   label: 'Outerwear',   icon: 'cloud' },
  { key: 'tops',        label: 'Tops',         icon: 'sun' },
  { key: 'dresses',     label: 'Dresses',      icon: 'heart' },
  { key: 'formal',      label: 'Formal',       icon: 'star' },
  { key: 'bottoms',          label: 'Bottoms',         icon: 'minus' },
  { key: 'activewear_tops',  label: 'Active Tops',     icon: 'activity' },
  { key: 'activewear_bottoms', label: 'Active Bottoms', icon: 'activity' },
  { key: 'shoes',            label: 'Shoes',           icon: 'disc' },
  { key: 'bags',        label: 'Bags',         icon: 'shopping-bag' },
  { key: 'accessories', label: 'Accessories',  icon: 'watch' },
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

// ─── Single category reel ────────────────────────────────────────────────────

type CategoryReelProps = {
  category: ClothingCategory;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  items: WardrobeItem[];    // pre-filtered: real items only (no "none" sentinel here)
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isDark: boolean;
  theme: any;
};

function CategoryReel({ category, label, icon, items, selectedId, onSelect, isDark, theme }: CategoryReelProps) {
  // data = [null (none), ...items]
  const data = useMemo<(WardrobeItem | null)[]>(() => [null, ...items], [items]);
  const rowH = ROW_HEIGHTS[category] ?? 200;
  const listRef = useRef<FlatList>(null);

  // Scroll to the selected item on mount
  const initialIndex = useMemo(() => {
    if (!selectedId) return 0;
    const idx = items.findIndex(i => i.id === selectedId);
    return idx >= 0 ? idx + 1 : 0;
  }, []);

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SNAP_INTERVAL);
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    const item = data[clamped];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(item ? item.id : null);
  }, [data, onSelect]);

  const renderItem = useCallback(({ item, index }: { item: WardrobeItem | null; index: number }) => {
    const isSelected = item ? item.id === selectedId : selectedId === null;
    const isNone = item === null;

    return (
      <View style={[styles.reelItemContainer, { width: CENTER_W, height: rowH }]}>
        <View
          style={[
            styles.reelCard,
            { height: rowH, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
            !isSelected && { opacity: 0.45 },
          ]}
        >
          {isNone ? (
            <View style={styles.reelNone}>
              <Feather name="x-circle" size={28} color={isDark ? '#444' : '#ccc'} />
              <ThemedText type="caption" style={{ color: isDark ? '#555' : '#bbb', marginTop: 6, fontSize: 11 }}>
                Skip {label}
              </ThemedText>
            </View>
          ) : item?.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.reelImage}
              contentFit="contain"
            />
          ) : (
            <View style={styles.reelNone}>
              <Feather name="image" size={28} color={isDark ? '#444' : '#ccc'} />
            </View>
          )}
        </View>

        {/* Shuffle hint icon — only on selected non-none items */}
        {isSelected && !isNone ? (
          <View style={[styles.swapHint, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
            <Feather name="shuffle" size={11} color={isDark ? '#fff' : '#000'} style={{ opacity: 0.6 }} />
          </View>
        ) : null}
      </View>
    );
  }, [selectedId, isDark, rowH, label]);

  return (
    <View style={[styles.reelRow, { height: rowH + 28 }]}>
      {/* Category label */}
      <View style={styles.reelLabelRow}>
        <Feather name={icon} size={12} color={theme.link} />
        <ThemedText type="caption" style={[styles.reelLabel, { color: theme.link }]}>
          {label}
        </ThemedText>
        <ThemedText type="caption" style={{ color: isDark ? '#555' : '#bbb', fontSize: 10 }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </ThemedText>
        {selectedId ? null : (
          <ThemedText type="caption" style={{ color: isDark ? '#444' : '#ccc', fontSize: 10, marginLeft: 4 }}>
            · skipped
          </ThemedText>
        )}
      </View>

      <View style={{ position: 'relative' }}>
        <FlatList
          ref={listRef}
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, i) => item ? item.id : `none-${i}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          contentInset={{ left: SIDE_INSET - SIDE_GAP / 2, right: SIDE_INSET - SIDE_GAP / 2 }}
          contentOffset={{ x: -(SIDE_INSET - SIDE_GAP / 2), y: 0 }}
          contentContainerStyle={styles.reelListContent}
          onMomentumScrollEnd={handleScrollEnd}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SNAP_INTERVAL, offset: SNAP_INTERVAL * index, index })}
        />
        {/* Swipe hint arrows on edges */}
        <View pointerEvents="none" style={[styles.reelArrowLeft, { height: rowH }]}>
          <Feather name="chevron-left" size={16} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
        </View>
        <View pointerEvents="none" style={[styles.reelArrowRight, { height: rowH }]}>
          <Feather name="chevron-right" size={16} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OutfitBuilderScreen({ navigation }: OutfitBuilderScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();

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
  const [eventType, setEventType] = useState<PlannedEventType>('casual');
  const [pinToCalendar, setPinToCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const handleSelect = useCallback((cat: ClothingCategory, id: string | null) => {
    setSelection(prev => ({ ...prev, [cat]: id }));
  }, []);

  const selectedItemIds = useMemo(
    () => Object.values(selection).filter((id): id is string => !!id),
    [selection]
  );

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
      if (pinToCalendar) {
        payload.calendarDate = calendarDate.toISOString().split('T')[0];
      }
      const result = await apiService.saveMixAndMatchOutfit(payload);
      setShowSaveModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const calMsg = result.calendarEntry
        ? `\n\nAlso pinned to ${formatDate(calendarDate)}.`
        : '';
      Alert.alert('Outfit saved', `"${name}" is ready in your wardrobe.${calMsg}`, [
        { text: 'Keep building', style: 'cancel' },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save outfit. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const secondaryText = isDark ? '#777' : '#aaa';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="h3" style={{ fontWeight: '700' }}>Outfit Builder</ThemedText>
          <ThemedText type="caption" style={{ color: secondaryText }}>
            Swipe each row to change the item
          </ThemedText>
        </View>
        <Pressable onPress={handleClear} style={styles.clearBtn}>
          <ThemedText type="caption" style={{ color: theme.link, fontWeight: '600' }}>Clear</ThemedText>
        </Pressable>
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
        >
          {/* Category reels — stacked vertically */}
          {activeReels.map(({ key, label, icon }) => (
            <CategoryReel
              key={key}
              category={key}
              label={label}
              icon={icon}
              items={itemsByCategory[key] ?? []}
              selectedId={selection[key] ?? null}
              onSelect={id => handleSelect(key, id)}
              isDark={isDark}
              theme={theme}
            />
          ))}

          {/* Item count summary */}
          {selectedItemIds.length > 0 ? (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                <Feather name="check" size={13} color={theme.link} />
                <ThemedText type="caption" style={{ color: theme.link, fontWeight: '700', marginLeft: 5 }}>
                  {selectedItemIds.length} item{selectedItemIds.length > 1 ? 's' : ''} selected
                </ThemedText>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Save FAB */}
      {selectedItemIds.length > 0 ? (
        <Pressable
          onPress={handleSave}
          style={[styles.saveFab, { bottom: insets.bottom + 90 }]}
        >
          <LinearGradient
            colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveFabGradient}
          >
            <Feather name="save" size={17} color="#fff" />
            <ThemedText type="body" style={styles.saveFabText}>
              Save Outfit
            </ThemedText>
          </LinearGradient>
        </Pressable>
      ) : null}

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
              placeholder="e.g. Friday Casual, Work Look..."
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
                    style={[styles.selectedItemThumb, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    {it.imageUri ? (
                      <Image source={{ uri: it.imageUri }} style={styles.selectedThumbImage} contentFit="contain" />
                    ) : (
                      <Feather name="image" size={18} color={secondaryText} />
                    )}
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
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
    gap: Spacing.sm,
  },
  backBtn: {
    padding: Spacing.sm,
  },
  clearBtn: {
    padding: Spacing.sm,
  },
  scrollContent: {
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },

  // Reel
  reelRow: {
    overflow: 'hidden',
  },
  reelLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SIDE_INSET,
    paddingBottom: 6,
    paddingTop: 10,
  },
  reelLabel: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginRight: 4,
  },
  reelListContent: {
    gap: SIDE_GAP,
    paddingHorizontal: SIDE_INSET - SIDE_GAP / 2,
  },
  reelItemContainer: {
    position: 'relative',
  },
  reelCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelImage: {
    width: '100%',
    height: '100%',
  },
  reelNone: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapHint: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelArrowLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelArrowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary
  summaryRow: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },

  // Save FAB
  saveFab: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  saveFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  saveFabText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
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
