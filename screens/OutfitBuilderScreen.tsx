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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useWardrobe, WardrobeItem, ClothingCategory, PlannedEventType } from '@/contexts/WardrobeContext';
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
const REEL_ORDER: Array<{ key: ClothingCategory; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'outerwear',   label: 'Outerwear',   icon: 'cloud' },
  { key: 'tops',        label: 'Tops',         icon: 'sun' },
  { key: 'dresses',     label: 'Dresses',      icon: 'heart' },
  { key: 'formal',      label: 'Formal',       icon: 'star' },
  { key: 'activewear',  label: 'Activewear',   icon: 'activity' },
  { key: 'bottoms',     label: 'Bottoms',      icon: 'minus' },
  { key: 'shoes',       label: 'Shoes',        icon: 'disc' },
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
        {selectedId ? (
          <ThemedText type="caption" style={{ color: isDark ? '#555' : '#bbb', fontSize: 10 }}>
            {items.find(i => i.id === selectedId)?.name ?? ''}
          </ThemedText>
        ) : (
          <ThemedText type="caption" style={{ color: isDark ? '#555' : '#bbb', fontSize: 10 }}>skipped</ThemedText>
        )}
      </View>

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
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OutfitBuilderScreen({ navigation }: OutfitBuilderScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { items, saveOutfit } = useWardrobe();

  const [selection, setSelection] = useState<Partial<Record<ClothingCategory, string | null>>>({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [eventType, setEventType] = useState<PlannedEventType>('casual');

  const itemsByCategory = useMemo(() => {
    const map: Partial<Record<ClothingCategory, WardrobeItem[]>> = {};
    for (const { key } of REEL_ORDER) {
      map[key] = items.filter(i => i.category === key);
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
    setSelection({});
  };

  const handleSave = () => {
    if (selectedItemIds.length === 0) {
      Alert.alert('Nothing selected', 'Swipe through the rows to pick items first.');
      return;
    }
    setOutfitName('');
    setEventType('casual');
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    try {
      const name = outfitName.trim() || 'My Outfit';
      const occasionMap: Record<string, string> = {
        casual: 'casual', work: 'work', 'date-night': 'date-night',
        party: 'party', formal: 'formal', everyday: 'everyday',
        workout: 'workout', travel: 'casual', wedding: 'formal',
      };
      await saveOutfit({
        name,
        itemIds: selectedItemIds,
        occasion: (occasionMap[eventType] ?? 'casual') as any,
        isFavorite: false,
      } as any);
      setShowSaveModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Outfit saved', `"${name}" is now in your wardrobe.`, [
        { text: 'Keep building', style: 'cancel' },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save outfit. Please try again.');
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
            <Pressable onPress={confirmSave}>
              <ThemedText type="body" style={{ color: theme.link, fontWeight: '700' }}>Save</ThemedText>
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
