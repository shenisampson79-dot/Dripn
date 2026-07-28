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
  Modal,
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
import {
  liveCaptureConfirmation,
  liveDuplicateConfirmation,
  liveNextItemPrompt,
  wardrobeSaveConfirmation,
} from '@/utils/wardrobeSaveCopy';
import {
  SCAN_CHALLENGE_SECONDS,
  SCAN_CHALLENGE_TARGET,
  challengeMicroFeedback,
  challengeMilestoneCopy,
  challengeTimerColor,
  estimateStylableOutfits,
} from '@/utils/scanChallenge';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { TrackedDetection } from '@/utils/digitizeDetectionTracker';
import { DigitizeDetectionTracker } from '@/utils/digitizeDetectionTracker';
import { getManualAddCategoryTabs, resolveUserPresentationGender } from '@/utils/wardrobeCategories';
import { useAuth } from '@/contexts/AuthContext';
import { onboardingProfileService } from '@/services/OnboardingProfileService';
import { CommonActions } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LIVE_SAMPLE_MS = 800;
const LIVE_FRAME_WIDTH = 640;
/** Spec colours: detecting/locked yellow → capturing green */
const LIVE_DETECT_COLOR = '#FFD60A';
const LIVE_CAPTURE_COLOR = '#00E676';
/** ~2–2.5s hold at LIVE_SAMPLE_MS before capture */
const LIVE_PROMOTE_HITS = 3;
/** Primary must be this much larger than next item to auto-capture amid multi-detect */
const LIVE_PRIMARY_AREA_RATIO = 1.55;

type DigitizeStep = 'capture' | 'scanning' | 'review' | 'saving';
type CaptureMode = 'photo' | 'live';
type LiveTrackPhase = 'detecting' | 'locked' | 'capturing' | 'confirmed';

type LiveOverlayBox = TrackedDetection & {
  phase: LiveTrackPhase;
  isPrimary: boolean;
};

function trackArea(bbox: [number, number, number, number]): number {
  return Math.max(0, bbox[2]) * Math.max(0, bbox[3]);
}

function pickPrimaryTrack<T extends { bbox: [number, number, number, number]; confidence: number }>(
  tracks: T[],
): T | null {
  if (!tracks.length) return null;
  return [...tracks].sort((a, b) => {
    const areaDiff = trackArea(b.bbox) - trackArea(a.bbox);
    if (Math.abs(areaDiff) > 0.01) return areaDiff;
    return b.confidence - a.confidence;
  })[0];
}

function LiveStabilizeOverlay({
  width,
  height,
  tracks,
}: {
  width: number;
  height: number;
  tracks: LiveOverlayBox[];
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
          const capturing = track.phase === 'capturing' || track.phase === 'confirmed';
          const locked = track.phase === 'locked';
          const stroke = capturing
            ? LIVE_CAPTURE_COLOR
            : locked || track.phase === 'detecting'
              ? LIVE_DETECT_COLOR
              : LIVE_DETECT_COLOR;
          const label = capturing
            ? (track.phase === 'confirmed' ? 'Captured' : 'Capturing…')
            : locked
              ? 'Hold steady…'
              : 'Detecting…';
          const strokeWidth = capturing ? (track.isPrimary ? 3.5 : 2.5) : track.isPrimary ? 2.5 : 1.75;
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
                strokeWidth={strokeWidth}
                fill={capturing ? 'rgba(0,230,118,0.16)' : 'rgba(255,214,10,0.12)'}
              />
              <Rect
                x={x}
                y={Math.max(0, y - 20)}
                width={Math.min(w, capturing ? 92 : 100)}
                height={18}
                rx={3}
                fill={stroke}
              />
              <SvgText
                x={x + 5}
                y={Math.max(13, y - 6)}
                fill={capturing ? '#053B1F' : '#1A1400'}
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
  const [liveNote, setLiveNote] = useState('Point at one piece, then Start');
  const [liveAddedCount, setLiveAddedCount] = useState(0);
  const [autoSaveLive, setAutoSaveLive] = useState(true);
  const [liveTracks, setLiveTracks] = useState<LiveOverlayBox[]>([]);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [captureToast, setCaptureToast] = useState<{
    uri: string;
    label: string;
    mode: 'captured' | 'duplicate';
  } | null>(null);
  const [capturePulse, setCapturePulse] = useState(false);
  const [challengeActive, setChallengeActive] = useState(false);
  const [challengeCount, setChallengeCount] = useState(0);
  const [challengeSecondsLeft, setChallengeSecondsLeft] = useState(SCAN_CHALLENGE_SECONDS);
  const [challengeInvite, setChallengeInvite] = useState(false);
  const [challengeMilestone, setChallengeMilestone] = useState<string | null>(null);
  const [challengeResult, setChallengeResult] = useState<'won' | 'timeout' | 'stopped' | null>(null);
  const [dupeSheet, setDupeSheet] = useState<{
    visible: boolean;
    decision: NormalizedDuplicateDecision;
    pendingItems: ScanSessionItem[];
  }>({ visible: false, decision: { type: 'ok', matches: [], isDuplicate: false }, pendingItems: [] });

  const cameraRef = useRef<CameraView>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const trackerRef = useRef(new DigitizeDetectionTracker({ promoteHits: LIVE_PROMOTE_HITS }));
  const sessionSeenRef = useRef<Set<string>>(new Set());
  const lockHapticRef = useRef<Set<string>>(new Set());
  const multiHapticAtRef = useRef(0);
  const challengeActiveRef = useRef(false);
  const challengeEndAtRef = useRef<number | null>(null);
  const challengeFinishedRef = useRef(false);
  const challengeMilestonesRef = useRef<Set<number>>(new Set());
  const lastTimerHapticSecRef = useRef<number | null>(null);
  const savedWardrobeRef = useRef(savedWardrobe);
  savedWardrobeRef.current = savedWardrobe;
  challengeActiveRef.current = challengeActive;

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
        const found = result.items.length;
        const title = droppedCount === 1 ? '1 duplicate skipped' : `${droppedCount} duplicates skipped`;
        let body: string;
        if (uniqueItems.length === 0) {
          body = found === 1
            ? 'No new items detected.\n\nWe found 1 item, but it’s already in your wardrobe.'
            : `No new items detected.\n\nWe found ${found} pieces, but they’re already in your wardrobe.`;
        } else {
          body = `Detected: ${found}\nNew items: ${uniqueItems.length}\nDuplicates skipped: ${droppedCount}`;
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
      const confirm = wardrobeSaveConfirmation(
        itemsToSave.length,
        itemsToSave.length === 1 ? itemsToSave[0]?.name : undefined,
      );
      Alert.alert(
        confirm.title,
        confirm.body,
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

  const fireCaptureFeedback = useCallback(async (
    thumbUri?: string | null,
    opts?: { label?: string; mode?: 'captured' | 'duplicate' },
  ) => {
    const mode = opts?.mode || 'captured';
    const label = opts?.label || (mode === 'duplicate' ? 'Already added' : 'Captured');
    // No full-screen white flash — unsafe for photosensitive users.
    // Confirmation = haptic + thumbnail toast + brief camera-frame pulse.
    setCapturePulse(true);
    if (mode === 'duplicate') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (thumbUri) {
      setCaptureToast({ uri: thumbUri, label, mode });
    }
    await new Promise((r) => setTimeout(r, 180));
    setCapturePulse(false);
    if (mode === 'captured') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (thumbUri) {
      setTimeout(() => {
        if (mountedRef.current) setCaptureToast(null);
      }, 1400);
    }
  }, []);

  const liveItemLabel = (track: {
    category: string;
    name?: string;
    color?: string;
  }) => {
    const color = String(track.color || '').toLowerCase();
    const colorLabel = color && color !== 'multicolor'
      ? color.charAt(0).toUpperCase() + color.slice(1)
      : '';
    const cat = String(track.category || 'tops');
    const base =
      cat === 'tops' || cat === 'activewear_tops' ? 'Top'
        : cat === 'bottoms' || cat === 'activewear_bottoms' ? 'Bottoms'
          : cat === 'dresses' ? 'Dress'
            : cat === 'outerwear' ? 'Outerwear'
              : cat === 'shoes' ? 'Shoes'
                : cat === 'bags' ? 'Bag'
                  : cat === 'accessories' ? 'Accessory'
                    : 'Piece';
    const raw = String(track.name || '').trim();
    const generic = /^(bag|bags|clothing|item|top|tops|shirt|shirts|tee|tees)$/i.test(raw);
    const noun = generic || !raw ? base : raw;
    return colorLabel ? `${colorLabel} ${noun}` : noun;
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
      const displayName = liveItemLabel(track);
      const item: ScanSessionItem = {
        tempId,
        name: displayName,
        category: track.category,
        color: track.color || 'multicolor',
        confidence: track.confidence,
        bbox: track.bbox,
        sceneCrop: crop.base64,
        needsConfirm: track.confidence < 0.6 || track.category === 'bags',
        confirmPrompt: track.confidence < 0.6 || track.category === 'bags'
          ? 'Not clear — check the category'
          : null,
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
        const match = partitioned.dropped[0]?.matchName;
        await fireCaptureFeedback(crop.uri, {
          mode: 'duplicate',
          label: match ? `Already added · ${match}` : 'Already added',
        });
        setLiveNote(
          challengeActiveRef.current
            ? 'Already got this one'
            : liveDuplicateConfirmation(match),
        );
        if (!challengeActiveRef.current) {
          setTimeout(() => {
            if (mountedRef.current) setLiveNote(liveNextItemPrompt());
          }, 1200);
        }
        return;
      }

      sessionSeenRef.current.add(track.trackId);
      setScanItems((prev) => {
        if (prev.some((p) => p.tempId === tempId)) return prev;
        return [...prev, item];
      });
      setSelectedIds((prev) => new Set(prev).add(tempId));
      await fireCaptureFeedback(crop.uri, { mode: 'captured', label: displayName });

      const saveLive = autoSaveLive || challengeActiveRef.current;
      if (saveLive) {
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
          setLiveAddedCount((n) => {
            const nextSession = n + 1;
            if (!challengeActiveRef.current && nextSession === 1) {
              setChallengeInvite(true);
            }
            return nextSession;
          });

          if (challengeActiveRef.current && !challengeFinishedRef.current) {
            setChallengeCount((prev) => {
              const next = prev + 1;
              const milestone = challengeMilestoneCopy(next);
              if (milestone && !challengeMilestonesRef.current.has(next)) {
                challengeMilestonesRef.current.add(next);
                setChallengeMilestone(milestone);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setTimeout(() => {
                  if (mountedRef.current) setChallengeMilestone(null);
                }, 900);
              } else {
                setLiveNote(challengeMicroFeedback(next));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              if (next >= SCAN_CHALLENGE_TARGET) {
                setTimeout(() => finishChallengeRef.current?.('won'), 40);
              }
              return next;
            });
          } else {
            setLiveNote(liveCaptureConfirmation(item.name));
            setTimeout(() => {
              if (mountedRef.current && !challengeActiveRef.current) {
                setLiveNote(liveNextItemPrompt());
              }
            }, 1100);
          }
        } catch (err) {
          console.warn('[DigitizeWardrobe] live auto-save failed:', err);
          setLiveNote(`${item.name} ready — confirm in Review`);
        }
      } else {
        setLiveNote(`${item.name} queued — open Review when ready`);
      }
    },
    [addItem, autoSaveLive, fireCaptureFeedback, scanItems],
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
        if (!yoloStatus.available) {
          setLiveNote('On-device YOLO unavailable — use Photo mode for best results');
          return;
        }
        setLiveNote(
          challengeActiveRef.current
            ? 'One item at a time'
            : 'Point at one item',
        );
        return;
      }

      const promotedRaw = trackerRef.current.update(
        onDevice.map((d) => ({
          category: d.category,
          name: d.name,
          color: d.color,
          confidence: d.confidence,
          bbox: d.bbox,
        })),
      );
      const promoteHits = trackerRef.current.promoteFrameTarget;
      const lockHits = trackerRef.current.lockFrameTarget;
      const snapshotBase = trackerRef.current.snapshot();
      const primary = pickPrimaryTrack(snapshotBase);
      const primaryId = primary?.trackId;

      // Multi-item: never silently choose — require a clearly dominant primary.
      let multiBlocked = false;
      if (snapshotBase.length >= 2 && primary) {
        const sortedAreas = snapshotBase
          .map((t) => trackArea(t.bbox))
          .sort((a, b) => b - a);
        const dominant = sortedAreas[0] >= (sortedAreas[1] || 0) * LIVE_PRIMARY_AREA_RATIO;
        if (!dominant) {
          multiBlocked = true;
          const now = Date.now();
          if (now - multiHapticAtRef.current > 1800) {
            multiHapticAtRef.current = now;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
      }

      const justPromotedIds = new Set(promotedRaw.map((p) => p.trackId));
      const snapshot: LiveOverlayBox[] = snapshotBase.map((track) => {
        let phase: LiveTrackPhase = 'detecting';
        if (justPromotedIds.has(track.trackId)) phase = 'capturing';
        else if (track.promoted) phase = 'confirmed';
        else if (track.hits >= promoteHits) phase = 'capturing';
        else if (track.hits >= lockHits) phase = 'locked';
        return {
          ...track,
          phase,
          isPrimary: track.trackId === primaryId,
        };
      });
      setLiveTracks(snapshot);

      // Lock haptic once per track
      for (const track of snapshot) {
        if (track.phase === 'locked' && !lockHapticRef.current.has(track.trackId)) {
          lockHapticRef.current.add(track.trackId);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }

      let toPromote = multiBlocked
        ? []
        : promotedRaw.filter((p) => !primaryId || p.trackId === primaryId);

      if (multiBlocked) {
        setLiveNote(
          challengeActiveRef.current
            ? 'One item at a time'
            : `${snapshotBase.length} items detected — move closer to one`,
        );
      } else if (toPromote.length) {
        setLiveNote(challengeActiveRef.current ? 'Capturing…' : 'Capturing…');
      } else if (snapshot.some((t) => t.phase === 'locked' && t.isPrimary)) {
        setLiveNote('Hold steady…');
      } else if (snapshot.some((t) => t.phase === 'confirmed') && !challengeActiveRef.current) {
        setLiveNote(liveNextItemPrompt());
      } else if (snapshotBase.length >= 2 && primary && !challengeActiveRef.current) {
        setLiveNote('Capturing nearest item — hold steady');
      } else if (onDevice.length > 0 && !challengeActiveRef.current) {
        setLiveNote('Point at one item');
      } else if (onDevice.length > 0 && challengeActiveRef.current) {
        setLiveNote('Scan as fast as you can');
      }

      for (const track of toPromote) {
        await ingestLivePromotion(manipulated.uri, track);
      }
    } catch (error) {
      console.warn('[DigitizeWardrobe] live frame failed:', error);
      setLiveNote(
        challengeActiveRef.current
          ? 'One item at a time'
          : 'Not clear — try one item at a time',
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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

  const finishChallenge = useCallback((result: 'won' | 'timeout' | 'stopped') => {
    if (challengeFinishedRef.current) return;
    challengeFinishedRef.current = true;
    challengeActiveRef.current = false;
    challengeEndAtRef.current = null;
    setChallengeActive(false);
    setIsLive(false);
    setLiveTracks([]);
    setCapturePulse(false);
    setChallengeMilestone(null);
    setChallengeResult(result);
    setChallengeInvite(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const finishChallengeRef = useRef(finishChallenge);
  finishChallengeRef.current = finishChallenge;

  useEffect(() => {
    if (!challengeActive) return undefined;
    lastTimerHapticSecRef.current = null;
    const id = setInterval(() => {
      const endAt = challengeEndAtRef.current;
      if (!endAt || challengeFinishedRef.current) return;
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setChallengeSecondsLeft(left);
      if (left > 0 && left <= 3 && lastTimerHapticSecRef.current !== left) {
        lastTimerHapticSecRef.current = left;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (left <= 0) {
        finishChallengeRef.current?.('timeout');
      }
    }, 250);
    return () => clearInterval(id);
  }, [challengeActive]);

  const beginLiveSession = useCallback(async (asChallenge: boolean) => {
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
    setMode('live');
    setStep('capture');
    trackerRef.current.reset();
    sessionSeenRef.current.clear();
    lockHapticRef.current.clear();
    multiHapticAtRef.current = 0;
    setLiveAddedCount(0);
    setLiveTracks([]);
    setCaptureToast(null);
    setCapturePulse(false);
    setChallengeResult(null);
    setChallengeInvite(false);
    setChallengeMilestone(null);

    if (asChallenge) {
      challengeFinishedRef.current = false;
      challengeMilestonesRef.current = new Set();
      challengeActiveRef.current = true;
      challengeEndAtRef.current = Date.now() + SCAN_CHALLENGE_SECONDS * 1000;
      setChallengeCount(0);
      setChallengeSecondsLeft(SCAN_CHALLENGE_SECONDS);
      setChallengeActive(true);
      setAutoSaveLive(true);
      setLiveNote('Scan as fast as you can');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      challengeActiveRef.current = false;
      challengeEndAtRef.current = null;
      setChallengeActive(false);
      setChallengeCount(0);
      setLiveNote('Point at one item');
    }
    setIsLive(true);
  }, [permission?.granted, requestPermission, openSettings]);

  const startLive = async () => {
    await beginLiveSession(false);
  };

  const startChallenge = async () => {
    await beginLiveSession(true);
  };

  const stopLive = () => {
    if (challengeActiveRef.current && !challengeFinishedRef.current) {
      finishChallenge('stopped');
      setLiveNote(
        challengeCount > 0
          ? `${challengeCount} item${challengeCount === 1 ? '' : 's'} added — good start`
          : 'Stopped',
      );
      return;
    }
    setIsLive(false);
    setLiveTracks([]);
    setCapturePulse(false);
    setCaptureToast(null);
    challengeActiveRef.current = false;
    setChallengeActive(false);
    setLiveNote(
      liveAddedCount > 0
        ? `Stopped · ${liveAddedCount} piece${liveAddedCount === 1 ? '' : 's'} saved this session`
        : 'Stopped',
    );
  };

  const dismissChallengeResult = () => {
    setChallengeResult(null);
  };

  const goSeeOutfits = () => {
    setChallengeResult(null);
    navigation.dispatch(
      CommonActions.navigate({
        name: 'StylistTab',
        params: { screen: 'StylistHub' },
      }),
    );
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
        Scan your wardrobe items
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Lay items flat or keep them clearly separated
      </ThemedText>
      {renderModeToggle()}

      {mode === 'photo' ? (
        <>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={[styles.previewPlaceholder, { borderColor: theme.border }]}>
              <Feather name="camera" size={48} color={LuxuryColors.gold} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }}>
                Flat lay or spaced hangings
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
            style={[
              styles.liveCameraBox,
              { borderColor: capturePulse ? LIVE_CAPTURE_COLOR : theme.border },
              capturePulse && styles.liveCameraBoxPulse,
            ]}
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
              />
            ) : null}
            {challengeActive ? (
              <View style={styles.challengeHud} pointerEvents="none">
                <View style={styles.challengeHudTop}>
                  <ThemedText type="caption" style={styles.challengeHudCount}>
                    {challengeCount} / {SCAN_CHALLENGE_TARGET} items
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={[
                      styles.challengeHudTimer,
                      { color: challengeTimerColor(challengeSecondsLeft) },
                    ]}
                  >
                    {challengeSecondsLeft}s
                  </ThemedText>
                </View>
                <View style={styles.challengeProgressTrack}>
                  <View
                    style={[
                      styles.challengeProgressFill,
                      {
                        width: `${Math.min(100, (challengeCount / SCAN_CHALLENGE_TARGET) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                {challengeMilestone ? (
                  <ThemedText type="body" style={styles.challengeMilestone}>
                    {challengeMilestone}
                  </ThemedText>
                ) : (
                  <ThemedText type="caption" style={styles.challengeHint}>
                    Scan as fast as you can
                  </ThemedText>
                )}
              </View>
            ) : null}
            {isLive ? (
              <View style={styles.liveLegend}>
                <View style={styles.liveLegendRow}>
                  <View style={[styles.liveLegendSwatch, { backgroundColor: LIVE_DETECT_COLOR }]} />
                  <ThemedText type="caption" style={styles.liveLegendText}>
                    Hold steady
                  </ThemedText>
                </View>
                <View style={styles.liveLegendRow}>
                  <View style={[styles.liveLegendSwatch, { backgroundColor: LIVE_CAPTURE_COLOR }]} />
                  <ThemedText type="caption" style={styles.liveLegendText}>
                    Capturing
                  </ThemedText>
                </View>
              </View>
            ) : null}
            {captureToast ? (
              <View
                style={[
                  styles.captureToast,
                  captureToast.mode === 'duplicate' && styles.captureToastDuplicate,
                ]}
                pointerEvents="none"
              >
                <Image source={{ uri: captureToast.uri }} style={styles.captureToastThumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <ThemedText type="caption" style={styles.captureToastText}>
                    {captureToast.mode === 'duplicate' ? 'Already added' : '✓ Captured'}
                  </ThemedText>
                  {captureToast.label ? (
                    <ThemedText type="caption" style={styles.captureToastSub} numberOfLines={1}>
                      {captureToast.label}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginVertical: Spacing.sm }}>
            {liveNote}
            {!challengeActive && liveAddedCount > 0 ? ` · ${liveAddedCount} saved` : ''}
          </ThemedText>
          {challengeInvite && !challengeActive ? (
            <View style={[styles.challengeInvite, { borderColor: LuxuryColors.gold }]}>
              <ThemedText type="body" style={{ fontWeight: '600', marginBottom: 4 }}>
                Nice — want to scan the rest quickly?
              </ThemedText>
              <Pressable onPress={startChallenge} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}>
                <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '700' }}>
                  ⚡ Scan {SCAN_CHALLENGE_TARGET} items fast
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => setChallengeInvite(false)} style={{ marginTop: Spacing.sm, alignItems: 'center' }}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Not now
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
          {!yoloStatus.available ? (
            <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginBottom: Spacing.sm }}>
              On-device YOLO not linked in this binary — Live detect is limited; Photo mode is more reliable.
            </ThemedText>
          ) : null}
          {!challengeActive ? (
            <Pressable
              onPress={() => setAutoSaveLive((v) => !v)}
              style={[styles.secondaryBtn, { borderColor: theme.border, marginBottom: Spacing.sm }]}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Auto-save unique items: {autoSaveLive ? 'On' : 'Off'}
              </ThemedText>
            </Pressable>
          ) : null}
          <View style={styles.captureActions}>
            {!isLive ? (
              <>
                <Pressable onPress={startLive} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}>
                  <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
                    Start live
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={startChallenge}
                  style={[styles.secondaryBtn, { borderColor: LuxuryColors.gold }]}
                >
                  <ThemedText type="body" style={{ color: LuxuryColors.gold, fontWeight: '700' }}>
                    ⚡ Scan {SCAN_CHALLENGE_TARGET} in {SCAN_CHALLENGE_SECONDS}s
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={stopLive} style={[styles.primaryBtn, { backgroundColor: '#B33' }]}>
                <ThemedText type="body" style={{ color: '#FFF', fontWeight: '600' }}>
                  {challengeActive ? 'End challenge' : 'Stop'}
                </ThemedText>
              </Pressable>
            )}
            {scanItems.length > 0 && !challengeActive ? (
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
      ? `Detected: ${detectedCount}  ·  Added: ${items.length}  ·  Skipped: ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'}`
      : `Confirm what to keep. Scene: ${String(sceneType).replace(/_/g, ' ')}.`;

    const whyLine = items.length === 0 && skippedCount > 0
      ? (skippedCount === 1
        ? 'We found 1 item, but it’s already in your wardrobe.'
        : `We found ${detectedCount || skippedCount} pieces, but they’re already in your wardrobe.`)
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
            Already in your wardrobe (or repeated in this scan).
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
            {isSaving
              ? 'Saving…'
              : selectedItems.length === 0
                ? 'Nothing to add'
                : `Add ${selectedItems.length} to wardrobe`}
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

      <Modal visible={challengeResult != null} transparent animationType="fade" onRequestClose={dismissChallengeResult}>
        <View style={styles.challengeModalBackdrop}>
          <View style={[styles.challengeModalCard, { backgroundColor: isDark ? theme.surface : '#FFF' }]}>
            {challengeResult === 'won' ? (
              <>
                <ThemedText type="h2" style={{ textAlign: 'center', marginBottom: Spacing.sm }}>
                  Nice — {SCAN_CHALLENGE_TARGET} items added
                </ThemedText>
                <ThemedText type="body" style={{ textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.lg }}>
                  Your wardrobe just got smarter
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="h2" style={{ textAlign: 'center', marginBottom: Spacing.sm }}>
                  {challengeCount} item{challengeCount === 1 ? '' : 's'} added — good start
                </ThemedText>
                <ThemedText type="body" style={{ textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.lg }}>
                  Keep going whenever you’re ready
                </ThemedText>
              </>
            )}
            <ThemedText type="body" style={{ textAlign: 'center', marginBottom: Spacing.md, fontWeight: '600' }}>
              We can now style about {estimateStylableOutfits(savedWardrobe.length)} outfits with your wardrobe
            </ThemedText>
            <Pressable onPress={goSeeOutfits} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold, marginBottom: Spacing.sm }]}>
              <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '700', textAlign: 'center' }}>
                See your outfits
              </ThemedText>
            </Pressable>
            {challengeResult !== 'won' ? (
              <Pressable
                onPress={() => {
                  dismissChallengeResult();
                  void startChallenge();
                }}
                style={[styles.secondaryBtn, { borderColor: LuxuryColors.gold, marginBottom: Spacing.sm }]}
              >
                <ThemedText type="body" style={{ color: LuxuryColors.gold, fontWeight: '600', textAlign: 'center' }}>
                  Continue scanning
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable onPress={dismissChallengeResult} style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Done
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  liveCameraBoxPulse: {
    borderWidth: 3,
  },
  challengeHud: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  challengeHudTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  challengeHudCount: {
    color: '#FFF',
    fontWeight: '700',
  },
  challengeHudTimer: {
    fontWeight: '800',
  },
  challengeProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  challengeProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: LIVE_CAPTURE_COLOR,
  },
  challengeHint: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  challengeMilestone: {
    color: LIVE_DETECT_COLOR,
    fontWeight: '800',
  },
  challengeInvite: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(201, 168, 124, 0.12)',
  },
  challengeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  challengeModalCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
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
  captureToast: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '72%',
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  captureToastDuplicate: {
    backgroundColor: 'rgba(40,40,40,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  captureToastThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  captureToastText: {
    color: '#FFF',
    fontWeight: '700',
    paddingRight: 4,
  },
  captureToastSub: {
    color: 'rgba(255,255,255,0.78)',
    paddingRight: 4,
    marginTop: 1,
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
