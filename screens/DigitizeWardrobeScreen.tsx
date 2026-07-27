/**
 * Digitize Wardrobe — Wardrobe Creation layer only.
 * Capture → detect → review → save items.
 * Does NOT generate outfits (that stays on Stylist "Get outfits now").
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { DuplicateComparisonSheet } from '@/components/wardrobe/DuplicateComparisonSheet';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import {
  CATEGORY_LABELS,
  ClothingCategory,
  useWardrobe,
  type WardrobeItem,
} from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import type { WardrobeStackParamList } from '@/navigation/WardrobeStackNavigator';
import { apiService } from '@/services/ApiService';
import { convertImageToBase64 } from '@/services/VisionAnalysisService';
import type { ScanSessionItem } from '@/types/scanWardrobe';
import {
  correctWardrobeImageOrientation,
  promptWardrobeOrientationReview,
} from '@/utils/wardrobeImageOrientation';
import {
  findLocalWardrobeDuplicates,
  normalizeDuplicateDecision,
  type NormalizedDuplicateDecision,
} from '@/utils/wardrobeDuplicateMatch';
import { getManualAddCategoryTabs, resolveUserPresentationGender } from '@/utils/wardrobeCategories';
import { useAuth } from '@/contexts/AuthContext';
import { onboardingProfileService } from '@/services/OnboardingProfileService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DigitizeStep = 'capture' | 'scanning' | 'review' | 'saving';

type Props = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, 'DigitizeWardrobe'>;
};

function sessionItemToWardrobeItem(item: ScanSessionItem): WardrobeItem {
  const imageUri = item.sceneCrop ? `data:image/jpeg;base64,${item.sceneCrop}` : '';
  return {
    id: item.tempId,
    userId: '',
    imageUri,
    enhancedImageUri: imageUri || undefined,
    imageProcessed: Boolean(item.sceneCrop),
    category: (item.category as ClothingCategory) || 'tops',
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

export default function DigitizeWardrobeScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items: savedWardrobe, addItemsBatch } = useWardrobe();

  const [step, setStep] = useState<DigitizeStep>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sceneType, setSceneType] = useState<string>('other');
  const [scanItems, setScanItems] = useState<ScanSessionItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [dupeSheet, setDupeSheet] = useState<{
    visible: boolean;
    decision: NormalizedDuplicateDecision;
    pendingItems: ScanSessionItem[];
  }>({ visible: false, decision: { type: 'ok', matches: [], isDuplicate: false }, pendingItems: [] });

  const [onboardingProfile, setOnboardingProfile] = useState<Awaited<
    ReturnType<typeof onboardingProfileService.getProfile>
  > | null>(null);
  React.useEffect(() => {
    onboardingProfileService.getProfile().then(setOnboardingProfile).catch(() => {});
  }, []);

  const presentationGender = resolveUserPresentationGender(user, onboardingProfile);
  const categoryOptions = useMemo(
    () => getManualAddCategoryTabs(presentationGender).map((tab) => tab.key),
    [presentationGender],
  );

  const items = useMemo(() => scanItems.filter(Boolean), [scanItems]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.tempId)),
    [items, selectedIds],
  );

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        t('wardrobe.error') || 'Error',
        t('wardrobe.couldNotOpenSettingsPleaseEnablePermissi') || 'Could not open settings.',
      );
    }
  };

  const runScan = async (uri: string) => {
    setStep('scanning');
    try {
      const base64 = await convertImageToBase64(uri);
      const result = await apiService.scanWardrobe(base64, { includeCrops: true });
      if (!result.success || !result.items?.length) {
        Alert.alert(
          t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe',
          result.message
            || 'We couldn’t detect items clearly. Try better lighting, a closer shot of the rail or drawer, and keep pieces separated.',
        );
        setStep('capture');
        return;
      }
      setSceneType(result.sceneType || 'other');
      setScanItems(result.items);
      setSelectedIds(new Set(result.items.map((item) => item.tempId)));
      setStep('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('[DigitizeWardrobe] scan failed:', error);
      Alert.alert(
        t('wardrobe.error') || 'Error',
        error instanceof Error ? error.message : 'Could not scan photo. Please try again.',
      );
      setStep('capture');
    }
  };

  const beginImageImport = async (asset: ImagePicker.ImagePickerAsset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const corrected = await correctWardrobeImageOrientation(asset.uri, asset);
      setImageUri(corrected.uri);
      promptWardrobeOrientationReview(corrected, (uri) => {
        setImageUri(uri);
        void runScan(uri);
      });
    } catch {
      setImageUri(asset.uri);
      void runScan(asset.uri);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain && Platform.OS !== 'web') {
        Alert.alert(
          t('wardrobe.permissionRequired') || 'Permission Required',
          t('wardrobe.photoLibraryAccessWasDeniedPleaseEnableI') || 'Enable photo library in Settings.',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            { text: t('common.openSettings') || 'Settings', onPress: openSettings },
          ],
        );
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
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
        Alert.alert(
          t('wardrobe.permissionRequired') || 'Permission Required',
          t('wardrobe.cameraAccessWasDeniedPleaseEnableItInSet') || 'Enable camera in Settings.',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            { text: t('common.openSettings') || 'Settings', onPress: openSettings },
          ],
        );
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      await beginImageImport(result.assets[0]);
    }
  };

  const updateItem = (tempId: string, patch: Partial<ScanSessionItem>) => {
    setScanItems((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)));
  };

  const removeItem = (tempId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanItems((prev) => prev.filter((item) => item.tempId !== tempId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
  };

  const toggleSelected = (tempId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const persistItems = async (itemsToSave: ScanSessionItem[], allowDuplicates = false) => {
    if (itemsToSave.length === 0) {
      navigation.goBack();
      return;
    }
    setIsSaving(true);
    setStep('saving');
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
      }));
      await addItemsBatch(payload, { allowDuplicates });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('wardrobe.saved') || 'Saved',
        `+${itemsToSave.length} item${itemsToSave.length === 1 ? '' : 's'} added to your wardrobe`,
        [{ text: t('common.done') || 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(
        t('wardrobe.error') || 'Error',
        error instanceof Error ? error.message : 'Save failed.',
      );
      setStep('review');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSelected = async () => {
    if (selectedItems.length === 0) {
      Alert.alert(
        t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe',
        'Select at least one item to save.',
      );
      return;
    }
    try {
      const dupePayload = selectedItems.map((item) => ({
        name: item.name,
        category: item.category,
        subcategory: item.subcategory || undefined,
        color: item.color,
        brand: item.brand || undefined,
        imageBase64: item.sceneCrop || undefined,
      }));
      const serverDupe = await apiService.checkWardrobeDuplicates(dupePayload);
      const firstHit = serverDupe.results?.find(
        (r) => r.isDuplicate || r.type === 'duplicate' || r.type === 'already_owned',
      );
      if (firstHit?.decision) {
        setDupeSheet({
          visible: true,
          decision: normalizeDuplicateDecision(firstHit.decision),
          pendingItems: selectedItems,
        });
        return;
      }
      const local = findLocalWardrobeDuplicates(
        selectedItems.map(sessionItemToWardrobeItem),
        savedWardrobe,
      );
      if (local.isDuplicate && local.matches.length > 0) {
        setDupeSheet({
          visible: true,
          decision: normalizeDuplicateDecision(local),
          pendingItems: selectedItems,
        });
        return;
      }
      await persistItems(selectedItems);
    } catch {
      await persistItems(selectedItems);
    }
  };

  const renderCapture = () => (
    <View style={styles.stepBody}>
      <ThemedText type="h2" style={styles.title}>
        {t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe'}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Photo a rail or drawer. We’ll detect pieces, let you confirm, then add them to your wardrobe.
      </ThemedText>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
      ) : (
        <View style={[styles.previewPlaceholder, { borderColor: theme.border }]}>
          <Feather name="camera" size={48} color={LuxuryColors.gold} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }}>
            Hangings · drawers · flat lays{'\n'}Good light · pan slowly · keep pieces visible
          </ThemedText>
        </View>
      )}
      <View style={styles.captureActions}>
        <Pressable onPress={handleTakePhoto} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}>
          <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
            Take photo
          </ThemedText>
        </Pressable>
        <Pressable onPress={handlePickImage} style={[styles.secondaryBtn, { borderColor: theme.border }]}>
          <ThemedText type="body" style={{ color: theme.text }}>
            {t('wardrobe.chooseFromGallery') || 'Choose from Gallery'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderScanning = () => (
    <View style={[styles.stepBody, styles.centered]}>
      <ActivityIndicator size="large" color={LuxuryColors.gold} />
      <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
        Identifying your clothes…
      </ThemedText>
    </View>
  );

  const renderReviewItem = ({ item }: { item: ScanSessionItem }) => {
    const selected = selectedIds.has(item.tempId);
    return (
      <View
        style={[
          styles.itemCard,
          {
            backgroundColor: isDark ? theme.surface : '#FFF',
            borderColor: selected ? LuxuryColors.gold : theme.border,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <View style={styles.itemRow}>
          <Pressable onPress={() => toggleSelected(item.tempId)} hitSlop={6} style={styles.checkWrap}>
            <View style={[styles.checkbox, selected && styles.checkboxActive]}>
              {selected ? <Feather name="check" size={14} color="#FFF" /> : null}
            </View>
          </Pressable>
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
              {item.confidence < 0.6 ? ` · review (${Math.round(item.confidence * 100)}%)` : ''}
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
              <ThemedText
                type="caption"
                style={{ color: item.category === cat ? LuxuryColors.gold : theme.textSecondary }}
              >
                {CATEGORY_LABELS[cat]}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  const renderReview = () => (
    <View style={styles.stepBody}>
      <ThemedText type="h2" style={styles.title}>
        {items.length} item{items.length === 1 ? '' : 's'} detected
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Confirm what to keep. Scene: {String(sceneType).replace(/_/g, ' ')}. Bulk confirm first — edit only if needed.
      </ThemedText>
      <View style={styles.bulkRow}>
        <Pressable
          onPress={() => setSelectedIds(new Set(items.map((i) => i.tempId)))}
          style={[styles.bulkChip, { borderColor: theme.border }]}
        >
          <ThemedText type="caption">Select all</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setSelectedIds(new Set())}
          style={[styles.bulkChip, { borderColor: theme.border }]}
        >
          <ThemedText type="caption">Clear</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            setImageUri(null);
            setScanItems([]);
            setSelectedIds(new Set());
            setStep('capture');
          }}
          style={[styles.bulkChip, { borderColor: theme.border }]}
        >
          <ThemedText type="caption">Rescan</ThemedText>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.tempId}
        renderItem={renderReviewItem}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
      <View style={styles.footerActions}>
        <Pressable
          onPress={handleSaveSelected}
          disabled={isSaving || selectedItems.length === 0}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: LuxuryColors.gold,
              opacity: isSaving || selectedItems.length === 0 ? 0.5 : 1,
            },
          ]}
        >
          <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
            {isSaving
              ? 'Saving…'
              : `Add ${selectedItems.length} to wardrobe`}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderSaving = () => (
    <View style={[styles.stepBody, styles.centered]}>
      <ActivityIndicator size="large" color={LuxuryColors.gold} />
      <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
        Saving to wardrobe…
      </ThemedText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault }}>
      <LinearGradient
        colors={['#C9A87C', '#A88B5C', LuxuryColors.obsidian] as const}
        locations={[0, 0.35, 1]}
        style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={8}>
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>
        <ThemedText type="h3" style={{ color: '#FFF' }}>
          {t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe'}
        </ThemedText>
        <View style={{ width: 32 }} />
      </LinearGradient>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'capture' && renderCapture()}
        {step === 'scanning' && renderScanning()}
        {step === 'review' && renderReview()}
        {step === 'saving' && renderSaving()}
      </KeyboardAwareScrollView>

      <DuplicateComparisonSheet
        visible={dupeSheet.visible}
        type={dupeSheet.decision.type}
        message={dupeSheet.decision.message}
        matches={dupeSheet.decision.matches}
        onClose={() => setDupeSheet((s) => ({ ...s, visible: false }))}
        onAddAnyway={async () => {
          setDupeSheet((s) => ({ ...s, visible: false }));
          await persistItems(dupeSheet.pendingItems, true);
        }}
        onContinue={async () => {
          setDupeSheet((s) => ({ ...s, visible: false }));
          await persistItems(dupeSheet.pendingItems, true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    paddingHorizontal: Spacing.lg,
  },
  captureActions: {
    gap: Spacing.sm,
  },
  itemCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkWrap: {
    paddingTop: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: LuxuryColors.gold,
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
    marginLeft: 30,
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
  bulkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bulkChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  footerActions: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
});
