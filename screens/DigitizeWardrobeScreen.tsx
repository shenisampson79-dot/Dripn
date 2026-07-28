/**
 * Digitize Wardrobe — Wardrobe Creation layer only.
 * Photo (v1) + Live camera track (v2b) + auto-save unique items (v3).
 * Does NOT generate outfits.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
import {
  detectGarmentsOnDevice,
  getOnDeviceYoloStatus,
} from '@/services/onDeviceGarmentDetector';
import type { ScanSessionItem } from '@/types/scanWardrobe';
import {
  correctWardrobeImageOrientation,
  promptWardrobeOrientationReview,
} from '@/utils/wardrobeImageOrientation';
import {
  normalizeDuplicateDecision,
  type NormalizedDuplicateDecision,
} from '@/utils/wardrobeDuplicateMatch';
import { partitionDigitizeCandidates } from '@/utils/digitizeDedup';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { TrackedDetection } from '@/utils/digitizeDetectionTracker';
import { DigitizeDetectionTracker } from '@/utils/digitizeDetectionTracker';
import { getManualAddCategoryTabs, resolveUserPresentationGender } from '@/utils/wardrobeCategories';
import { useAuth } from '@/contexts/AuthContext';
import { onboardingProfileService } from '@/services/OnboardingProfileService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LIVE_SAMPLE_MS = 1100;
const LIVE_FRAME_WIDTH = 640;
const STABLE_COLOR = '#2F9E6E';
const UNSTABLE_COLOR = '#C45C4A';

type DigitizeStep = 'capture' | 'scanning' | 'review' | 'saving';
type CaptureMode = 'photo' | 'live';

type LiveOverlayBox = TrackedDetection & { ready: boolean };

function LiveStabilizeOverlay({
  width,
  height,
  tracks,
  promoteHits,
}: {
  width: number;
  height: number;
  tracks: LiveOverlayBox[];
  promoteHits: number;
}) {
  if (width <= 0 || height <= 0) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {tracks.map((track) => {
          const [nx, ny, nw, nh] = track.bbox;
          const x = nx * width;
          const y = ny * height;
          const w = nw * width;
          const h = nh * height;
          const ready = track.ready;
          const stroke = ready ? STABLE_COLOR : UNSTABLE_COLOR;
          const label = ready
            ? 'Ready'
            : `Hold ${Math.min(track.hits, promoteHits)}/${promoteHits}`;
          return (
            <React.Fragment key={track.trackId}>
              <Rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={6}
                ry={6}
                stroke={stroke}
                strokeWidth={ready ? 3 : 2}
                fill={ready ? 'rgba(47,158,110,0.14)' : 'rgba(196,92,74,0.12)'}
              />
              <Rect
                x={x}
                y={Math.max(0, y - 18)}
                width={Math.min(w, 88)}
                height={16}
                rx={3}
                fill={stroke}
              />
              <SvgText
                x={x + 5}
                y={Math.max(12, y - 5)}
                fill="#FFFFFF"
                fontSize="10"
                fontWeight="700"
              >
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

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

function toCandidate(item: ScanSessionItem) {
  return {
    id: item.tempId,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    brand: item.brand,
    imageUri: item.sceneCrop ? `data:image/jpeg;base64,${item.sceneCrop}` : undefined,
  };
}

async function cropNormalizedBBox(
  imageUri: string,
  bbox: [number, number, number, number],
): Promise<{ uri: string; base64?: string } | null> {
  try {
    const meta = await ImageManipulator.manipulateAsync(imageUri, [], { format: ImageManipulator.SaveFormat.JPEG });
    const w = meta.width || LIVE_FRAME_WIDTH;
    const h = meta.height || LIVE_FRAME_WIDTH;
    const originX = Math.max(0, Math.floor(bbox[0] * w));
    const originY = Math.max(0, Math.floor(bbox[1] * h));
    const width = Math.max(8, Math.min(w - originX, Math.floor(bbox[2] * w)));
    const height = Math.max(8, Math.min(h - originY, Math.floor(bbox[3] * h)));
    const cropped = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ crop: { originX, originY, width, height } }, { resize: { width: 512 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    return { uri: cropped.uri, base64: cropped.base64 || undefined };
  } catch {
    return null;
  }
}

type SkippedScanItem = {
  item: ScanSessionItem;
  reason: 'batch_duplicate' | 'wardrobe_duplicate';
  matchName: string;
};

export default function DigitizeWardrobeScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items: savedWardrobe, addItemsBatch, addItem } = useWardrobe();
  const [permission, requestPermission] = useCameraPermissions();
  const yoloStatus = getOnDeviceYoloStatus();

  const [mode, setMode] = useState<CaptureMode>('photo');
  const [step, setStep] = useState<DigitizeStep>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sceneType, setSceneType] = useState<string>('other');
  const [scanItems, setScanItems] = useState<ScanSessionItem[]>([]);
  const [skippedItems, setSkippedItems] = useState<SkippedScanItem[]>([]);
  const [detectedCount, setDetectedCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dupeNote, setDupeNote] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveNote, setLiveNote] = useState('Point at one clear hanging or flat-laid piece, then Start');
  const [liveAddedCount, setLiveAddedCount] = useState(0);
  const [autoSaveLive, setAutoSaveLive] = useState(true);
  const [liveTracks, setLiveTracks] = useState<LiveOverlayBox[]>([]);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [dupeSheet, setDupeSheet] = useState<{
    visible: boolean;
    decision: NormalizedDuplicateDecision;
    pendingItems: ScanSessionItem[];
  }>({ visible: false, decision: { type: 'ok', matches: [], isDuplicate: false }, pendingItems: [] });

  const cameraRef = useRef<CameraView>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const trackerRef = useRef(new DigitizeDetectionTracker());
  const sessionSeenRef = useRef<Set<string>>(new Set());
  const savedWardrobeRef = useRef(savedWardrobe);
  savedWardrobeRef.current = savedWardrobe;

  const [onboardingProfile, setOnboardingProfile] = useState<Awaited<
    ReturnType<typeof onboardingProfileService.getProfile>
  > | null>(null);
  useEffect(() => {
    onboardingProfileService.getProfile().then(setOnboardingProfile).catch(() => {});
    return () => {
      mountedRef.current = false;
    };
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

  const applyDedupToItems = useCallback(
    (incoming: ScanSessionItem[], opts?: { selectAllUnique?: boolean }) => {
      const partitioned = partitionDigitizeCandidates(
        incoming.map(toCandidate),
        savedWardrobeRef.current.map((it) => ({
          id: String(it.id),
          name: it.name,
          category: it.category,
          subcategory: it.subcategory,
          color: it.color,
          brand: it.brand,
          imageUri: it.enhancedImageUri || it.imageUri,
          origin: it.origin,
        })),
      );
      const uniqueIds = new Set(partitioned.unique.map((u) => u.id));
      const uniqueItems = incoming.filter((item) => uniqueIds.has(item.tempId));
      const byId = new Map(incoming.map((item) => [item.tempId, item]));
      const skipped: SkippedScanItem[] = partitioned.dropped
        .map((drop) => {
          const item = byId.get(drop.item.id);
          if (!item) return null;
          return {
            item,
            reason: drop.reason,
            matchName: drop.matchName,
          };
        })
        .filter((row): row is SkippedScanItem => Boolean(row));
      const droppedCount = skipped.length;
      setDetectedCount(incoming.length);
      setScanItems(uniqueItems);
      setSkippedItems(skipped);
      if (opts?.selectAllUnique !== false) {
        setSelectedIds(new Set(uniqueItems.map((i) => i.tempId)));
      }
      if (droppedCount > 0) {
        const names = skipped
          .slice(0, 3)
          .map((s) => s.item.name || 'item')
          .join(', ');
        const more = droppedCount > 3 ? ` +${droppedCount - 3} more` : '';
        setDupeNote(
          droppedCount === 1
            ? `1 duplicate skipped${names ? `: ${names}` : ''}`
            : `${droppedCount} duplicates skipped (${names}${more})`,
        );
      } else {
        setDupeNote(null);
      }
      return { uniqueItems, droppedCount, skipped };
    },
    [],
  );

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(t('wardrobe.error') || 'Error', 'Could not open settings.');
    }
  };

  const runScan = async (uri: string) => {
    setStep('scanning');
    setDupeNote(null);
    setSkippedItems([]);
    setDetectedCount(0);
    try {
      const base64 = await convertImageToBase64(uri);
      const result = await apiService.scanWardrobe(base64, { includeCrops: true });
      if (!result.success || !result.items?.length) {
        Alert.alert(
          t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe',
          result.message
            || 'We couldn’t detect items clearly. Try a flat lay or hanging piece with good light — avoid crowded rails or folded drawers.',
        );
        setStep('capture');
        return;
      }
      setSceneType(result.sceneType || 'other');
      const { uniqueItems, droppedCount, skipped } = applyDedupToItems(result.items);
      setStep('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (droppedCount > 0) {
        const first = skipped[0];
        const found = result.items.length;
        const title = droppedCount === 1 ? '1 duplicate skipped' : `${droppedCount} duplicates skipped`;
        let body: string;
        if (uniqueItems.length === 0) {
          body = found === 1 && first
            ? `No new items detected.\n\nWe found 1 item, but it’s already in your wardrobe (“${first.item.name}” → “${first.matchName}”).`
            : `No new items detected.\n\nWe found ${found} piece${found === 1 ? '' : 's'}, but ${droppedCount === 1 ? 'it already looks like something' : 'they already look like items'} in your wardrobe${first ? ` (e.g. “${first.item.name}” → “${first.matchName}”)` : ''}.`;
        } else {
          body = `Detected: ${found}\nNew items: ${uniqueItems.length}\nDuplicates skipped: ${droppedCount}`;
          if (first) body += `\n\n• ${first.item.name} → already in wardrobe (“${first.matchName}”)`;
        }
        Alert.alert(title, body);
      }
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
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== 'web') {
        Alert.alert('Permission Required', 'Enable photo library in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: openSettings },
        ]);
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) await beginImageImport(result.assets[0]);
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== 'web') {
        Alert.alert('Permission Required', 'Enable camera in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: openSettings },
        ]);
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) await beginImageImport(result.assets[0]);
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
      Alert.alert(
        t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe',
        'Nothing new to save — duplicates were skipped.',
      );
      setStep('review');
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
      Alert.alert(t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe', 'Select at least one item to save.');
      return;
    }

    // Always re-partition immediately before save (wardrobe may have changed / batch dups).
    const partitioned = partitionDigitizeCandidates(
      selectedItems.map(toCandidate),
      savedWardrobe.map((it) => ({
        id: String(it.id),
        name: it.name,
        category: it.category,
        subcategory: it.subcategory,
        color: it.color,
        brand: it.brand,
        imageUri: it.enhancedImageUri || it.imageUri,
        origin: it.origin,
      })),
    );
    const uniqueSelected = selectedItems.filter((item) =>
      partitioned.unique.some((u) => u.id === item.tempId),
    );

    if (partitioned.dropped.length > 0 && uniqueSelected.length === 0) {
      Alert.alert(
        'Duplicates only',
        'Every selected item already looks like something in your wardrobe (or duplicates another selected item). Nothing was saved.',
      );
      return;
    }

    if (partitioned.dropped.length > 0) {
      setDupeNote(
        `Saving ${uniqueSelected.length} new item${uniqueSelected.length === 1 ? '' : 's'}; skipped ${partitioned.dropped.length} duplicate${partitioned.dropped.length === 1 ? '' : 's'}.`,
      );
    }

    try {
      const dupePayload = uniqueSelected.map((item) => ({
        name: item.name,
        category: item.category,
        subcategory: item.subcategory || undefined,
        color: item.color,
        brand: item.brand || undefined,
        imageBase64: item.sceneCrop || undefined,
      }));
      const serverDupe = await apiService.checkWardrobeDuplicates(dupePayload);
      const blockedIndexes = new Set<number>();
      (serverDupe.results || []).forEach((r, idx) => {
        const decision = normalizeDuplicateDecision({
          ...r,
          type: r.type || r.decision?.type,
          decision: r.decision,
          similarMatches: r.similarMatches,
        });
        if (decision.type === 'duplicate' || decision.type === 'already_owned') {
          blockedIndexes.add(typeof r.index === 'number' ? r.index : idx);
        }
      });
      const afterServer = uniqueSelected.filter((_, i) => !blockedIndexes.has(i));
      const blocked = uniqueSelected.filter((_, i) => blockedIndexes.has(i));

      if (blocked.length > 0 && afterServer.length === 0) {
        setDupeSheet({
          visible: true,
          decision: normalizeDuplicateDecision({
            type: 'duplicate',
            isDuplicate: true,
            message: 'These items already look like pieces in your wardrobe.',
            matches: blocked.map((b) => ({
              id: b.tempId,
              name: b.name,
              category: b.category,
              color: b.color,
              imageUri: b.sceneCrop ? `data:image/jpeg;base64,${b.sceneCrop}` : undefined,
            })),
          }),
          pendingItems: blocked,
        });
        return;
      }

      if (blocked.length > 0) {
        setDupeNote(
          `Skipped ${blocked.length} server-matched duplicate${blocked.length === 1 ? '' : 's'}; saving ${afterServer.length}.`,
        );
      }
      await persistItems(afterServer);
    } catch (error) {
      // Offline / API failure: still respect local partition — never force-add on error.
      console.warn('[DigitizeWardrobe] server dupe check failed, using local gate:', error);
      await persistItems(uniqueSelected);
    }
  };

  const ingestLivePromotion = useCallback(
    async (
      frameUri: string,
      track: {
        trackId: string;
        category: string;
        name?: string;
        color?: string;
        confidence: number;
        bbox: [number, number, number, number];
      },
    ) => {
      if (sessionSeenRef.current.has(track.trackId)) return;
      const crop = await cropNormalizedBBox(frameUri, track.bbox);
      if (!crop?.base64) return;

      const tempId = track.trackId;
      const item: ScanSessionItem = {
        tempId,
        name: track.name || `${track.color || 'Item'} ${track.category}`.trim(),
        category: track.category,
        color: track.color || 'multicolor',
        confidence: track.confidence,
        bbox: track.bbox,
        sceneCrop: crop.base64,
        needsConfirm: track.confidence < 0.6,
        confirmPrompt: track.confidence < 0.6 ? 'Low confidence — confirm category' : null,
      };

      const partitioned = partitionDigitizeCandidates(
        [toCandidate(item)],
        [
          ...savedWardrobeRef.current.map((it) => ({
            id: String(it.id),
            name: it.name,
            category: it.category,
            subcategory: it.subcategory,
            color: it.color,
            brand: it.brand,
            imageUri: it.enhancedImageUri || it.imageUri,
            origin: it.origin,
          })),
          ...scanItems.map(toCandidate),
        ],
      );

      if (partitioned.unique.length === 0) {
        sessionSeenRef.current.add(track.trackId);
        setLiveNote('Duplicate skipped');
        return;
      }

      sessionSeenRef.current.add(track.trackId);
      setScanItems((prev) => {
        if (prev.some((p) => p.tempId === tempId)) return prev;
        return [...prev, item];
      });
      setSelectedIds((prev) => new Set(prev).add(tempId));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (autoSaveLive) {
        try {
          await addItem({
            name: item.name,
            category: item.category as ClothingCategory,
            color: item.color as WardrobeItem['color'],
            imageUri: `data:image/jpeg;base64,${item.sceneCrop}`,
            imageBase64: item.sceneCrop || undefined,
            seasons: ['all-season'],
            occasions: ['everyday'],
            isFavorite: false,
          });
          setLiveAddedCount((n) => n + 1);
          setLiveNote(`+1 saved · ${item.name}`);
        } catch (err) {
          console.warn('[DigitizeWardrobe] live auto-save failed:', err);
          setLiveNote('Detected — confirm in review to save');
          setStep('review');
        }
      } else {
        setLiveNote(`Detected ${item.name} — in review list`);
        setStep('review');
      }
    },
    [addItem, autoSaveLive, scanItems],
  );

  const processLiveFrame = useCallback(async () => {
    if (!cameraRef.current || inFlightRef.current || !mountedRef.current) return;
    inFlightRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) return;

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: LIVE_FRAME_WIDTH } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
      );

      const onDevice = await detectGarmentsOnDevice(manipulated.uri);
      if (!onDevice?.length) {
        setLiveTracks([]);
        // Fallback: one-shot cloud scan of the frame (costly — only when YOLO unavailable).
        if (!yoloStatus.available) {
          setLiveNote('On-device YOLO unavailable — use Photo mode for best results');
          return;
        }
        setLiveNote('No garments yet — hold steadier');
        return;
      }

      const promoted = trackerRef.current.update(
        onDevice.map((d) => ({
          category: d.category,
          name: d.name,
          color: d.color,
          confidence: d.confidence,
          bbox: d.bbox,
        })),
      );
      const promoteHits = trackerRef.current.promoteFrameTarget;
      const snapshot = trackerRef.current.snapshot().map((track) => ({
        ...track,
        ready: track.promoted || track.hits >= promoteHits,
      }));
      setLiveTracks(snapshot);

      const stabilizing = snapshot.filter((t) => !t.ready).length;
      const readyCount = snapshot.filter((t) => t.ready).length;
      if (promoted.length) {
        setLiveNote(`Captured ${promoted.length} · green box = ready`);
      } else if (readyCount > 0 && stabilizing === 0) {
        setLiveNote('Green: ready — hold still while we save');
      } else if (stabilizing > 0) {
        setLiveNote(`Red: hold still · ${stabilizing} stabilizing${readyCount ? ` · ${readyCount} ready` : ''}`);
      } else {
        setLiveNote(`${onDevice.length} detected · stabilizing…`);
      }
      for (const track of promoted) {
        await ingestLivePromotion(manipulated.uri, track);
      }
    } catch (error) {
      console.warn('[DigitizeWardrobe] live frame failed:', error);
      setLiveNote('Frame failed — retrying');
    } finally {
      inFlightRef.current = false;
    }
  }, [ingestLivePromotion, yoloStatus.available]);

  useEffect(() => {
    if (!isLive) return undefined;
    const id = setInterval(() => {
      void processLiveFrame();
    }, LIVE_SAMPLE_MS);
    return () => clearInterval(id);
  }, [isLive, processLiveFrame]);

  const startLive = async () => {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        Alert.alert('Camera permission', 'Live scan needs camera access.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: openSettings },
        ]);
        return;
      }
    }
    trackerRef.current.reset();
    sessionSeenRef.current.clear();
    setLiveAddedCount(0);
    setLiveTracks([]);
    setIsLive(true);
    setLiveNote('Scanning… red = hold still · green = ready');
  };

  const stopLive = () => {
    setIsLive(false);
    setLiveTracks([]);
    setLiveNote(liveAddedCount > 0 ? `Stopped · +${liveAddedCount} saved` : 'Stopped');
  };

  const renderModeToggle = () => (
    <View style={styles.modeRow}>
      <Pressable
        onPress={() => {
          stopLive();
          setMode('photo');
          setStep('capture');
        }}
        style={[
          styles.modeChip,
          mode === 'photo' && styles.modeChipActive,
          { borderColor: mode === 'photo' ? LuxuryColors.gold : theme.border },
        ]}
      >
        <ThemedText type="caption" style={{ color: mode === 'photo' ? LuxuryColors.gold : theme.textSecondary }}>
          Photo
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => {
          setMode('live');
          setStep('capture');
        }}
        style={[
          styles.modeChip,
          mode === 'live' && styles.modeChipActive,
          { borderColor: mode === 'live' ? LuxuryColors.gold : theme.border },
        ]}
      >
        <ThemedText type="caption" style={{ color: mode === 'live' ? LuxuryColors.gold : theme.textSecondary }}>
          Live
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderCapture = () => (
    <View style={styles.stepBody}>
      <ThemedText type="h2" style={styles.title}>
        {t('wardrobe.scanMyWardrobe') || 'Scan my wardrobe'}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
        {mode === 'photo'
          ? 'Scan individual items or clearly separated pieces. We’ll detect what we can, skip duplicates, then let you confirm.'
          : 'Live camera: red = hold still, green = ready. One clear hanging or flat-laid piece — not a crowded rail.'}
      </ThemedText>
      <View style={styles.guidanceBox}>
        <ThemedText type="caption" style={{ color: theme.text, fontWeight: '700', marginBottom: 6 }}>
          Best results
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, lineHeight: 18 }}>
          {'✔ Lay items flat or hang them spaced apart\n✔ Avoid overlapping clothes\n✔ One item per photo works best\n✖ Crowded rails or folded drawers'}
        </ThemedText>
      </View>
      {renderModeToggle()}

      {mode === 'photo' ? (
        <>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={[styles.previewPlaceholder, { borderColor: theme.border }]}>
              <Feather name="camera" size={48} color={LuxuryColors.gold} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }}>
                Flat lay or spaced hangings{'\n'}Good light · no overlaps
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
        </>
      ) : (
        <View style={styles.liveWrap}>
          <View
            style={[styles.liveCameraBox, { borderColor: theme.border }]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setCameraLayout({ width, height });
            }}
          >
            {permission?.granted ? (
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.centered]}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Camera permission needed
                </ThemedText>
              </View>
            )}
            {isLive ? (
              <LiveStabilizeOverlay
                width={cameraLayout.width}
                height={cameraLayout.height}
                tracks={liveTracks}
                promoteHits={trackerRef.current.promoteFrameTarget}
              />
            ) : null}
            {isLive ? (
              <View style={styles.liveLegend}>
                <View style={styles.liveLegendRow}>
                  <View style={[styles.liveLegendSwatch, { backgroundColor: UNSTABLE_COLOR }]} />
                  <ThemedText type="caption" style={styles.liveLegendText}>
                    Hold still
                  </ThemedText>
                </View>
                <View style={styles.liveLegendRow}>
                  <View style={[styles.liveLegendSwatch, { backgroundColor: STABLE_COLOR }]} />
                  <ThemedText type="caption" style={styles.liveLegendText}>
                    Ready
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginVertical: Spacing.sm }}>
            {liveNote}
            {liveAddedCount > 0 ? ` · +${liveAddedCount} this session` : ''}
          </ThemedText>
          {!yoloStatus.available ? (
            <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginBottom: Spacing.sm }}>
              On-device YOLO not linked in this binary — Live detect is limited; Photo mode is more reliable.
            </ThemedText>
          ) : null}
          <Pressable
            onPress={() => setAutoSaveLive((v) => !v)}
            style={[styles.secondaryBtn, { borderColor: theme.border, marginBottom: Spacing.sm }]}
          >
            <ThemedText type="body" style={{ color: theme.text }}>
              Auto-save unique items: {autoSaveLive ? 'On' : 'Off'}
            </ThemedText>
          </Pressable>
          <View style={styles.captureActions}>
            {!isLive ? (
              <Pressable onPress={startLive} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}>
                <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
                  Start live
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable onPress={stopLive} style={[styles.primaryBtn, { backgroundColor: '#B33' }]}>
                <ThemedText type="body" style={{ color: '#FFF', fontWeight: '600' }}>
                  Stop
                </ThemedText>
              </Pressable>
            )}
            {scanItems.length > 0 ? (
              <Pressable
                onPress={() => {
                  stopLive();
                  applyDedupToItems(scanItems);
                  setStep('review');
                }}
                style={[styles.secondaryBtn, { borderColor: LuxuryColors.gold }]}
              >
                <ThemedText type="body" style={{ color: LuxuryColors.gold, fontWeight: '600' }}>
                  Review {scanItems.length} detected
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
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
            <View style={[styles.itemThumb, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
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

  const renderReview = () => {
    const skippedCount = skippedItems.length;
    const reviewTitle = items.length > 0
      ? `${items.length} item${items.length === 1 ? '' : 's'} ready`
      : skippedCount > 0
        ? 'No new items detected'
        : 'No new items detected';

    const summaryLine = detectedCount > 0
      ? `Detected: ${detectedCount}  ·  New items: ${items.length}  ·  Duplicates skipped: ${skippedCount}`
      : `Confirm what to keep. Scene: ${String(sceneType).replace(/_/g, ' ')}.`;

    const whyLine = items.length === 0 && skippedCount > 0
      ? (skippedCount === 1 && skippedItems[0]
        ? `We found 1 item, but it’s already in your wardrobe (“${skippedItems[0].item.name}” → “${skippedItems[0].matchName}”).`
        : `We found ${detectedCount || skippedCount} piece${(detectedCount || skippedCount) === 1 ? '' : 's'}, but ${skippedCount} already look like items in your wardrobe.`)
      : null;

    return (
    <View style={styles.stepBody}>
      <ThemedText type="h2" style={styles.title}>
        {reviewTitle}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
        {summaryLine}
        {detectedCount > 0 ? `  ·  Scene: ${String(sceneType).replace(/_/g, ' ')}` : ''}
      </ThemedText>
      {whyLine ? (
        <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginBottom: Spacing.sm }}>
          {whyLine}
        </ThemedText>
      ) : null}
      {dupeNote && items.length > 0 ? (
        <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginBottom: Spacing.md }}>
          {dupeNote}
        </ThemedText>
      ) : null}
      <View style={styles.bulkRow}>
        <Pressable
          onPress={() => setSelectedIds(new Set(items.map((i) => i.tempId)))}
          style={[styles.bulkChip, { borderColor: theme.border }]}
        >
          <ThemedText type="caption">Select all</ThemedText>
        </Pressable>
        <Pressable onPress={() => setSelectedIds(new Set())} style={[styles.bulkChip, { borderColor: theme.border }]}>
          <ThemedText type="caption">Clear</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            setImageUri(null);
            setScanItems([]);
            setSkippedItems([]);
            setDetectedCount(0);
            setSelectedIds(new Set());
            setDupeNote(null);
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
        ListEmptyComponent={
          skippedCount === 0 ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginVertical: Spacing.md }}>
              No new pieces to add from this photo. Try a flat lay or a clearly separated hanging item.
            </ThemedText>
          ) : null
        }
      />
      {skippedCount > 0 ? (
        <View style={styles.skippedBlock}>
          <ThemedText type="body" style={{ fontWeight: '700', marginBottom: Spacing.sm }}>
            Skipped as duplicates
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            These matched items already in your wardrobe (or repeated in this scan). Rescan won’t help unless the photo is of a different piece.
          </ThemedText>
          {skippedItems.map(({ item, matchName, reason }) => (
            <View
              key={`skip_${item.tempId}`}
              style={[
                styles.itemCard,
                styles.skippedCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.itemRow}>
                {item.sceneCrop ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${item.sceneCrop}` }}
                    style={styles.itemThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.itemThumb, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                    <Feather name="copy" size={20} color={theme.textTertiary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: '600' }}>
                    {item.name || 'Detected item'}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginTop: 2 }}>
                    {reason === 'batch_duplicate'
                      ? `Repeated in this scan → “${matchName}”`
                      : `→ already in wardrobe (“${matchName}”)`}
                  </ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
            {isSaving ? 'Saving…' : `Add ${selectedItems.length} to wardrobe`}
          </ThemedText>
        </Pressable>
      </View>
    </View>
    );
  };

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
        <Pressable
          onPress={() => {
            stopLive();
            navigation.goBack();
          }}
          style={styles.closeBtn}
          hitSlop={8}
        >
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
        onContinue={() => setDupeSheet((s) => ({ ...s, visible: false }))}
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
  stepBody: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  title: { marginBottom: Spacing.sm },
  guidanceBox: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(201, 168, 124, 0.12)',
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  modeChipActive: {
    backgroundColor: 'rgba(201, 168, 124, 0.15)',
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
  liveWrap: { marginBottom: Spacing.md },
  liveCameraBox: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    height: (SCREEN_WIDTH - Spacing.lg * 2) * 1.15,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#111',
  },
  liveLegend: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    zIndex: 3,
  },
  liveLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  liveLegendText: {
    color: '#FFF',
    fontWeight: '600',
  },
  captureActions: { gap: Spacing.sm },
  itemCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  skippedBlock: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  skippedCard: {
    opacity: 0.92,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkWrap: { paddingTop: 18 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: LuxuryColors.gold },
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
