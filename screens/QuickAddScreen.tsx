/**
 * Quick Add — camera-first capture with optional YOLO auto-snap.
 * Manual capture always works; auto-capture when on-device YOLO is linked.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { QuickAddTagItem, type QuickAddTagDraft } from '@/components/wardrobe/QuickAddTagItem';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import {
  CATEGORY_LABELS,
  COLOR_LABELS,
  ClothingCategory,
  ClothingColor,
  ClothingOccasion,
  ClothingSeason,
  useWardrobe,
} from '@/contexts/WardrobeContext';
import { useTranslations } from '@/contexts/TranslationContext';
import type { WardrobeStackParamList } from '@/navigation/WardrobeStackNavigator';
import {
  detectGarmentsOnDevice,
  getOnDeviceYoloStatus,
  warmUpOnDeviceYolo,
} from '@/services/onDeviceGarmentDetector';
import { sanitizeWardrobeItemName } from '@/utils/wardrobeItemName';
import { normalizeWardrobeCategory } from '@/utils/wardrobeCategories';
import {
  resolveOccasionChips,
  resolveSeasonChips,
} from '@/utils/wardrobeSeasonOccasion';
import {
  findLocalWardrobeDuplicates,
  formatDuplicateNames,
} from '@/utils/wardrobeDuplicateMatch';
import {
  QuickAddCaptureController,
  bboxFromTuple,
  type QuickAddCaptureUi,
  type QuickAddYoloDetection,
} from '@/utils/quickAddAutoCapture';
import { processQuickAddCapture } from '@/utils/quickAddCapturePipeline';

const FRAME_SIZE = 280;
const SUCCESS_GREEN = '#4CAF50';
const SAMPLE_MS = 1100;
const SAMPLE_WIDTH = 640;

type Step = 'camera' | 'processing' | 'result';
type ConfidenceBand = 'high' | 'medium' | 'low';

type Props = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, 'QuickAdd'>;
};

type Draft = QuickAddTagDraft & {
  imageBase64?: string;
  material?: string;
  seasons: ClothingSeason[];
  occasions: ClothingOccasion[];
  detectionConfidence?: number;
};

const COLOR_KEYS = Object.keys(COLOR_LABELS) as ClothingColor[];

function asCategory(raw?: string | null): ClothingCategory {
  const n = normalizeWardrobeCategory(String(raw || 'tops'));
  return (n || 'tops') as ClothingCategory;
}

function asColor(raw?: string | null): ClothingColor {
  const c = String(raw || 'multicolor').toLowerCase().trim();
  return (COLOR_KEYS.includes(c as ClothingColor) ? c : 'multicolor') as ClothingColor;
}

function bandFromScores(detConf?: number, analysisConf?: number): ConfidenceBand {
  const score = Math.max(detConf ?? 0, analysisConf ?? 0);
  if (score >= 0.9) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export default function QuickAddScreen({ navigation }: Props) {
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const { addItem, items: wardrobeItems } = useWardrobe();
  const [permission, requestPermission] = useCameraPermissions();
  const yoloStatus = useMemo(() => getOnDeviceYoloStatus(), []);

  const cameraRef = useRef<CameraView>(null);
  const controllerRef = useRef(new QuickAddCaptureController());
  const inFlightRef = useRef(false);
  const capturingRef = useRef(false);
  const lastUiHintAt = useRef(0);
  const stepRef = useRef<Step>('camera');

  const [step, setStep] = useState<Step>('camera');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [hint, setHint] = useState('Center the item');
  const [frameUi, setFrameUi] = useState<QuickAddCaptureUi>('idle');
  const [flash, setFlash] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  stepRef.current = step;

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (yoloStatus.available) void warmUpOnDeviceYolo();
  }, [yoloStatus.available]);

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const buildDraftFromAnalysis = (
    imageUri: string,
    imageBase64: string | undefined,
    analysis: any,
    detectionConfidence?: number,
  ): Draft => {
    const main = analysis?.analysis?.mainItem || analysis?.clothingAnalysis || analysis || {};
    const category = asCategory(
      analysis?.suggestedCategory
        || analysis?.categoryHint
        || main?.type
        || main?.category
        || 'tops',
    );
    // Never empty — always guess a colour + category so Save stays one tap.
    const color = asColor(main?.color || 'multicolor');
    const brand = main?.brand ? String(main.brand) : undefined;
    const material = main?.material ? String(main.material) : undefined;
    const seasons = resolveSeasonChips(main?.seasons || []) as ClothingSeason[];
    const occasions = resolveOccasionChips(main?.occasions || []) as ClothingOccasion[];
    const style = occasions[0] || 'everyday';
    const colorLabel = COLOR_LABELS[color] || color;
    const catLabel = CATEGORY_LABELS[category] || category;
    const name = sanitizeWardrobeItemName(
      analysis?.suggestedName
        || analysis?.analysis?.suggestedName
        || main?.description
        || `${brand ? `${brand} ` : ''}${colorLabel} ${catLabel}`,
    ) || `${colorLabel} ${catLabel}`;

    const analysisConf = Number(
      analysis?.confidence
        || analysis?.analysis?.confidence
        || main?.confidence
        || 0,
    );

    return {
      imageUri,
      imageBase64,
      name,
      category,
      color,
      brand,
      material,
      style,
      seasons,
      occasions: occasions.length ? occasions : (['everyday'] as ClothingOccasion[]),
      confidence: bandFromScores(detectionConfidence, analysisConf),
      detectionConfidence,
    };
  };

  const processCapturedUri = useCallback(async (
    uri: string,
    detection?: QuickAddYoloDetection | null,
  ) => {
    if (capturingRef.current && stepRef.current === 'processing') return;
    capturingRef.current = true;
    controllerRef.current.reset();
    setStep('processing');
    setHint('Identifying your item…');
    setFrameUi('idle');
    setFlash(false);
    try {
      const result = await processQuickAddCapture(uri, detection);
      if (!result.analysis && !result.imageUri) {
        throw new Error('No analysis');
      }
      const next = buildDraftFromAnalysis(
        result.imageUri,
        result.imageBase64,
        result.analysis || {},
        result.detectionConfidence ?? detection?.confidence,
      );
      setDraft(next);
      setStep('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('[QuickAdd] process failed:', error);
      Alert.alert(
        t('wardrobe.analysisIssue') || 'Couldn’t identify',
        'We couldn’t find an item. Try again.',
        [
          {
            text: 'Try again',
            onPress: () => {
              setStep('camera');
              setHint('Center the item');
              controllerRef.current.reset();
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
        ],
      );
      setStep('camera');
      setHint('Center the item');
    } finally {
      capturingRef.current = false;
    }
  }, [navigation, t]);

  const fireCaptureFlash = async () => {
    setFlash(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 150));
    setFlash(false);
  };

  const handleCapture = async (detection?: QuickAddYoloDetection | null) => {
    if (!cameraRef.current || stepRef.current !== 'camera' || capturingRef.current) return;
    try {
      await fireCaptureFlash();
      setHint('Captured');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) return;
      await processCapturedUri(photo.uri, detection);
    } catch (error) {
      console.warn('[QuickAdd] capture failed:', error);
      setHint('Center the item');
      Alert.alert('Camera', 'Could not take photo. Try again.');
    }
  };

  const sampleForAutoCapture = useCallback(async () => {
    if (
      !yoloStatus.available
      || !cameraRef.current
      || stepRef.current !== 'camera'
      || inFlightRef.current
      || capturingRef.current
    ) {
      return;
    }
    inFlightRef.current = true;
    try {
      const snap = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!snap?.uri || stepRef.current !== 'camera') return;

      const small = await ImageManipulator.manipulateAsync(
        snap.uri,
        [{ resize: { width: SAMPLE_WIDTH } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
      );
      const onDevice = await detectGarmentsOnDevice(small.uri);
      if (stepRef.current !== 'camera') return;

      const detections: QuickAddYoloDetection[] = (onDevice || []).map((d) => ({
        class: d.category || d.name || 'clothing',
        confidence: d.confidence,
        bbox: bboxFromTuple(d.bbox),
      }));

      const { best, eval: evaluation, trigger } = controllerRef.current.onFrame(detections);
      const now = Date.now();
      if (now - lastUiHintAt.current > 100) {
        lastUiHintAt.current = now;
        setHint(evaluation.hint);
        setFrameUi(evaluation.ui);
      }

      if (trigger && best) {
        // Prefer crop of the already-captured sample (faster) over a second shutter.
        await fireCaptureFlash();
        await processCapturedUri(small.uri, best);
      }
    } catch (err) {
      console.warn('[QuickAdd] auto sample failed:', err);
    } finally {
      inFlightRef.current = false;
    }
  }, [processCapturedUri, yoloStatus.available]);

  useEffect(() => {
    if (step !== 'camera' || !permission?.granted || !yoloStatus.available) return undefined;
    const id = setInterval(() => {
      void sampleForAutoCapture();
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [step, permission?.granted, yoloStatus.available, sampleForAutoCapture]);

  const handleGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Enable photo library in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settings', onPress: openSettings },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await processCapturedUri(result.assets[0].uri);
    }
  };

  const persistDraft = async (): Promise<{ ok: boolean; item?: { id: string; name?: string } }> => {
    if (!draft) return { ok: false };
    const localDupes = findLocalWardrobeDuplicates(
      {
        name: draft.name,
        category: draft.category,
        color: draft.color,
        brand: draft.brand,
      },
      wardrobeItems.map((it) => ({
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
    if (localDupes.length > 0) {
      const names = formatDuplicateNames(localDupes);
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Similar item found',
          `Looks like ${names}. Add anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Add anyway', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return { ok: false };
    }

    const saved = await addItem({
      name: draft.name,
      category: draft.category,
      color: draft.color,
      brand: draft.brand,
      material: draft.material,
      size: draft.size,
      notes: draft.notes,
      seasons: draft.seasons.length ? draft.seasons : (['all-season'] as ClothingSeason[]),
      occasions: draft.style
        ? ([draft.style, ...draft.occasions.filter((o) => o !== draft.style)].slice(0, 3) as ClothingOccasion[])
        : (draft.occasions.length ? draft.occasions : (['everyday'] as ClothingOccasion[])),
      imageUri: draft.imageUri,
      originalImageUri: draft.imageUri,
      imageBase64: draft.imageBase64,
      imageProcessed: draft.imageUri.startsWith('http'),
      aiAnalyzed: true,
      aiTags: [
        CATEGORY_LABELS[draft.category],
        COLOR_LABELS[draft.color],
        draft.style,
        draft.brand,
      ].filter(Boolean) as string[],
      isFavorite: false,
      allowDuplicate: true,
    } as any);
    return { ok: true, item: { id: String(saved.id), name: saved.name } };
  };

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const { ok } = await persistDraft();
      if (!ok) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        t('wardrobe.error') || 'Error',
        error instanceof Error ? error.message : 'Could not save item.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleImprove = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const { ok, item } = await persistDraft();
      if (!ok || !item?.id) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('ImproveRecognition', {
        itemId: item.id,
        itemName: item.name || draft.name,
      });
    } catch (error) {
      Alert.alert(
        t('wardrobe.error') || 'Error',
        error instanceof Error ? error.message : 'Could not save item.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (step === 'processing') {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: '#0B0B0B', paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={LuxuryColors.gold} />
        <ThemedText type="body" style={styles.processingText}>
          Identifying your item…
        </ThemedText>
      </View>
    );
  }

  if (step === 'result' && draft) {
    return (
      <QuickAddTagItem
        draft={draft}
        saving={saving}
        onChange={(next) => setDraft({ ...draft, ...next })}
        onClose={() => {
          setDraft(null);
          setHint('Center the item');
          setFrameUi('idle');
          controllerRef.current.reset();
          setStep('camera');
        }}
        onMenu={() => {
          Alert.alert('Item', undefined, [
            {
              text: 'Retake',
              onPress: () => {
                setDraft(null);
                setHint('Center the item');
                setStep('camera');
                controllerRef.current.reset();
              },
            },
            { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        onSave={handleSave}
        onImprove={handleImprove}
      />
    );
  }

  const frameReady = frameUi === 'ready' || frameUi === 'hold';

  return (
    <View style={styles.root}>
      {permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={torch}
          mode="picture"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centered, { backgroundColor: '#111' }]}>
          <ThemedText type="body" style={{ color: '#FFF', marginBottom: Spacing.md }}>
            Camera permission needed
          </ThemedText>
          <Pressable onPress={() => void requestPermission()} style={styles.primaryBtn}>
            <ThemedText type="body" style={styles.primaryBtnText}>Allow camera</ThemedText>
          </Pressable>
        </View>
      )}

      {flash ? <View style={styles.flashOverlay} pointerEvents="none" /> : null}

      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={[styles.topFade, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="x" size={22} color="#FFF" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <ThemedText type="body" style={styles.title}>Quick Add</ThemedText>
            <ThemedText type="caption" style={styles.subtitle}>
              {yoloStatus.available ? 'Auto-capture on · snap anytime' : 'Snap it now. Improve later.'}
            </ThemedText>
          </View>
          <Pressable onPress={() => setTorch((v) => !v)} hitSlop={10} style={styles.iconBtn}>
            <Feather name={torch ? 'zap' : 'zap-off'} size={20} color="#FFF" />
          </Pressable>
        </View>
      </LinearGradient>

      <View
        style={[
          styles.overlayCenter,
          {
            // Optical middle of the viewfinder (between top chrome and shutter row)
            top: insets.top + 64,
            bottom: Math.max(insets.bottom, 16) + 120,
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.frame, frameUi === 'ready' && styles.frameReady, frameUi === 'hold' && styles.frameHold]} />
        <ThemedText type="body" style={styles.hint}>{hint}</ThemedText>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable onPress={handleGallery} style={styles.sideBtn} hitSlop={8}>
          <Feather name="image" size={22} color="#FFF" />
        </Pressable>
        <Pressable
          onPress={() => void handleCapture()}
          style={[styles.captureOuter, frameReady && styles.captureReady]}
          accessibilityRole="button"
          accessibilityLabel="Capture"
        >
          <View style={styles.captureInner} />
        </Pressable>
        <Pressable
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          style={styles.sideBtn}
          hitSlop={8}
        >
          <Feather name="refresh-cw" size={22} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF',
    opacity: 0.85,
    zIndex: 20,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
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
  title: { color: '#FFF', fontWeight: '700', fontSize: 17 },
  subtitle: { color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  overlayCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
  },
  frameHold: {
    borderColor: 'rgba(255,193,7,0.9)',
    borderWidth: 2.5,
  },
  frameReady: {
    borderColor: SUCCESS_GREEN,
    borderWidth: 3,
  },
  hint: {
    marginTop: Spacing.md,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontSize: 15,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureReady: {
    borderColor: SUCCESS_GREEN,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
  },
  processingText: {
    marginTop: Spacing.lg,
    color: '#FFF',
  },
  primaryBtn: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: LuxuryColors.midnight,
    fontWeight: '700',
  },
});
