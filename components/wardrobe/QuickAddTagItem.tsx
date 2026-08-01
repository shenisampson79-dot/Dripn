/**
 * Quick Add post-capture tagging UI (TagItemScreen).
 * Tap chips → bottom-sheet pickers. Save is never blocked.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/theme';
import {
  CATEGORY_LABELS,
  COLOR_LABELS,
  type ClothingCategory,
  type ClothingColor,
  type ClothingOccasion,
} from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';

export type QuickAddTagDraft = {
  imageUri: string;
  name: string;
  category: ClothingCategory;
  color: ClothingColor;
  brand?: string;
  size?: string;
  notes?: string;
  style?: ClothingOccasion | string;
  confidence: 'high' | 'medium' | 'low';
};

type PickerKind = 'category' | 'color' | 'style' | null;

type Props = {
  draft: QuickAddTagDraft;
  saving?: boolean;
  onChange: (next: QuickAddTagDraft) => void;
  onClose: () => void;
  onMenu?: () => void;
  onSave: () => void;
  onImprove: () => void;
};

const STYLE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'casual', label: 'Casual' },
  { id: 'everyday', label: 'Everyday' },
  { id: 'work', label: 'Work' },
  { id: 'formal', label: 'Formal' },
  { id: 'date-night', label: 'Date night' },
  { id: 'workout', label: 'Workout' },
  { id: 'party', label: 'Party' },
  { id: 'vacation', label: 'Vacation' },
];

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as ClothingCategory[]).map((id) => ({
  id,
  label: CATEGORY_LABELS[id],
}));

const COLOR_OPTIONS = (Object.keys(COLOR_LABELS) as ClothingColor[]).map((id) => ({
  id,
  label: COLOR_LABELS[id],
}));

function titleForConfidence(band: QuickAddTagDraft['confidence'], name?: string): string {
  if (band === 'low') return 'Not sure about this one';
  if (name?.trim()) return `Got it — ${name.trim()}`;
  return 'Looks good';
}

function subtextForConfidence(band: QuickAddTagDraft['confidence']): string {
  if (band === 'low') return 'You can fix it in a second';
  if (band === 'medium') return 'Check details';
  return 'You can edit anything';
}

function rebuildName(draft: QuickAddTagDraft): string {
  const color = COLOR_LABELS[draft.color] || draft.color;
  const cat = CATEGORY_LABELS[draft.category] || draft.category;
  if (draft.brand?.trim()) return `${draft.brand.trim()} ${color} ${cat}`.replace(/\s+/g, ' ').trim();
  return `${color} ${cat}`.replace(/\s+/g, ' ').trim();
}

export function QuickAddTagItem({
  draft,
  saving,
  onChange,
  onClose,
  onMenu,
  onSave,
  onImprove,
}: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [picker, setPicker] = useState<PickerKind>(null);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(draft.brand || draft.size || draft.notes),
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  const styleLabel = useMemo(() => {
    const id = String(draft.style || '');
    return STYLE_OPTIONS.find((s) => s.id === id)?.label || (id ? id.replace(/_/g, ' ') : undefined);
  }, [draft.style]);

  const patch = (partial: Partial<QuickAddTagDraft>) => {
    const next = { ...draft, ...partial };
    if (partial.category || partial.color || partial.brand !== undefined) {
      next.name = rebuildName(next);
    }
    onChange(next);
  };

  const openPicker = (kind: PickerKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicker(kind);
  };

  const pickerTitle =
    picker === 'category' ? 'Select category'
      : picker === 'color' ? 'Select colour'
        : picker === 'style' ? 'Select style'
          : '';

  const pickerOptions =
    picker === 'category' ? CATEGORY_OPTIONS
      : picker === 'color' ? COLOR_OPTIONS
        : picker === 'style' ? STYLE_OPTIONS
          : [];

  const sheetMax = Math.round(windowHeight * 0.6);

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.backgroundDefault : '#FFFFFF', paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
          <Feather name="x" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="body" style={styles.topTitle}>Item Details</ThemedText>
        <Pressable onPress={onMenu} hitSlop={10} style={styles.iconBtn}>
          <Feather name="more-horizontal" size={22} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          <Pressable onPress={() => setPreviewOpen(true)}>
            <Image
              source={{ uri: draft.imageUri }}
              style={[styles.heroImage, { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5' }]}
              contentFit="contain"
            />
          </Pressable>
        </Animated.View>

        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <ThemedText type="h2" style={styles.looksTitle}>
            {titleForConfidence(draft.confidence, draft.name)}
          </ThemedText>
          <ThemedText type="caption" style={styles.looksSub}>
            {subtextForConfidence(draft.confidence)}
          </ThemedText>

          <View style={styles.chipRow}>
            <Pressable onPress={() => openPicker('category')} style={[styles.chip, styles.chipSelected]}>
              <ThemedText type="caption" style={styles.chipSelectedText}>
                {CATEGORY_LABELS[draft.category] || draft.category}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => openPicker('color')} style={[styles.chip, styles.chipSelected]}>
              <ThemedText type="caption" style={styles.chipSelectedText}>
                {COLOR_LABELS[draft.color] || draft.color}
              </ThemedText>
            </Pressable>
            {styleLabel ? (
              <Pressable onPress={() => openPicker('style')} style={[styles.chip, styles.chipSelected]}>
                <ThemedText type="caption" style={styles.chipSelectedText}>{styleLabel}</ThemedText>
              </Pressable>
            ) : (
              <Pressable onPress={() => openPicker('style')} style={styles.chip}>
                <ThemedText type="caption" style={styles.chipText}>+ Style</ThemedText>
              </Pressable>
            )}
            {draft.brand ? (
              <Pressable onPress={() => setDetailsOpen(true)} style={[styles.chip, styles.chipSelected]}>
                <ThemedText type="caption" style={styles.chipSelectedText}>{draft.brand}</ThemedText>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => setDetailsOpen((v) => !v)}
            style={styles.addDetailsBtn}
            hitSlop={6}
          >
            <ThemedText type="caption" style={{ color: '#666' }}>
              {detailsOpen ? 'Hide details' : '+ Add details'}
            </ThemedText>
            <Feather name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
          </Pressable>

          {detailsOpen ? (
            <View style={styles.detailsBlock}>
              <TextInput
                value={draft.brand || ''}
                onChangeText={(brand) => patch({ brand })}
                placeholder="Brand"
                placeholderTextColor="#999"
                style={[styles.field, { color: theme.text, borderColor: theme.border }]}
              />
              <TextInput
                value={draft.size || ''}
                onChangeText={(size) => patch({ size })}
                placeholder="Size"
                placeholderTextColor="#999"
                style={[styles.field, { color: theme.text, borderColor: theme.border }]}
              />
              <TextInput
                value={draft.notes || ''}
                onChangeText={(notes) => patch({ notes })}
                placeholder="Notes"
                placeholderTextColor="#999"
                multiline
                style={[styles.field, styles.notesField, { color: theme.text, borderColor: theme.border }]}
              />
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomCta, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <ThemedText type="body" style={styles.saveBtnText}>Save</ThemedText>
          )}
        </Pressable>
        <Pressable
          onPress={onImprove}
          disabled={saving}
          style={[styles.improveBtn, { opacity: saving ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Improve recognition"
        >
          <ThemedText type="body" style={styles.improveBtnText}>
            Improve recognition (10s)
          </ThemedText>
        </Pressable>
      </View>

      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicker(null)}>
          <Pressable
            style={[styles.sheet, { maxHeight: sheetMax, backgroundColor: isDark ? theme.surface : '#FFF' }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />
            <ThemedText type="h3" style={styles.sheetTitle}>{pickerTitle}</ThemedText>
            <ScrollView style={{ maxHeight: sheetMax - 80 }} keyboardShouldPersistTaps="handled">
              {pickerOptions.map((opt) => {
                const selected =
                  (picker === 'category' && draft.category === opt.id)
                  || (picker === 'color' && draft.color === opt.id)
                  || (picker === 'style' && String(draft.style) === opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (picker === 'category') patch({ category: opt.id as ClothingCategory });
                      if (picker === 'color') patch({ color: opt.id as ClothingColor });
                      if (picker === 'style') patch({ style: opt.id });
                      setPicker(null);
                    }}
                    style={[styles.sheetRow, selected && styles.sheetRowSelected]}
                  >
                    <ThemedText type="body" style={{ fontWeight: selected ? '700' : '500' }}>
                      {opt.label}
                    </ThemedText>
                    {selected ? <Feather name="check" size={18} color="#000" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewOpen(false)}>
          <Image source={{ uri: draft.imageUri }} style={styles.previewImage} contentFit="contain" />
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    height: 56,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { fontWeight: '600', fontSize: 17 },
  scroll: { paddingBottom: Spacing.xl },
  heroImage: {
    height: 280,
    marginHorizontal: Spacing.md,
    borderRadius: 20,
  },
  looksTitle: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: 20,
    fontWeight: '600',
  },
  looksSub: {
    marginTop: 4,
    paddingHorizontal: Spacing.md,
    color: '#666',
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  chip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#000000',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
  },
  chipSelectedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  addDetailsBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailsBlock: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  field: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  notesField: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  bottomCta: {
    paddingTop: 12,
    paddingHorizontal: Spacing.md,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  saveBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#6B5344',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 17,
  },
  improveBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#5B6B7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  improveBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 17,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    marginTop: 10,
    marginBottom: 12,
  },
  sheetTitle: {
    marginBottom: Spacing.sm,
    fontWeight: '700',
  },
  sheetRow: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  sheetRowSelected: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
});
