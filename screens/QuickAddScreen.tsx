/**
 * Quick Add — camera-first capture with optional YOLO auto-snap.
 * Manual capture always works; auto-capture when on-device YOLO is linked.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
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
import { DuplicateComparisonSheet } from '@/components/wardrobe/DuplicateComparisonSheet';
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
import { apiService } from '@/services/ApiService';
import {
  getOnDeviceYoloStatus,
  warmUpOnDeviceYolo,
} from '@/services/onDeviceGarmentDetector';
import {
  detectGarmentsOnDeviceHybrid,
  SINGLE_ITEM_HYBRID_OPTS,
} from '@/utils/onDeviceHybridDetect';
import { sanitizeWardrobeItemName } from '@/utils/wardrobeItemName';
import { normalizeWardrobeCategory } from '@/utils/wardrobeCategories';
import {
  resolveOccasionChips,
  resolveSeasonChips,
} from '@/utils/wardrobeSeasonOccasion';
import {
  findLocalWardrobeDuplicates,
  formatDuplicateNames,
  normalizeDuplicateDecision,
  type NormalizedDuplicateDecision,
} from '@/utils/wardrobeDuplicateMatch';
import {
  QuickAddCaptureController,
  bboxFromTuple,
  guideFromLayout,
  type QuickAddCaptureUi,
  type QuickAddYoloDetection,
} from '@/utils/quickAddAutoCapture';
import { processQuickAddCapture } from '@/utils/quickAddCapturePipeline';
import {
  normalizeQuickAddColor,
  pickVisionFields,
  QUICK_ADD_PROVISIONAL_GRACE_MS,
} from '@/utils/quickAddPerception';

const FRAME_SIZE = 280;
const SUCCESS_GREEN = '#4CAF50';
const HOLD_AMBER = '#FFC107';
/** takePicture sampling is heavy — keep interval roomy so YOLO can finish. */
const SAMPLE_MS = 850;
const SAMPLE_WIDTH = 640;
/** Ready → snap after a full 3-2-1 second countdown. */
const COUNTDOWN_TICK_MS = 1000;
const COUNTDOWN_START = 3;
/** Lower than default parse threshold so boots/shoes still register in-frame. */
const QUICK_ADD_YOLO_CONF = 0.14;

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
  return normalizeQuickAddColor(raw);
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
  const lastBestRef = useRef<QuickAddYoloDetection | null>(null);
  const lastUiHintAt = useRef(0);
  const lastFrameUiRef = useRef<QuickAddCaptureUi>('idle');
  const stepRef = useRef<Step>('camera');
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownArmedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [step, setStep] = useState<Step>('camera');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [hint, setHint] = useState('Centre the garment in the box — it can fill the screen');
  const [frameUi, setFrameUi] = useState<QuickAddCaptureUi>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureThumb, setCaptureThumb] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [dupeSheet, setDupeSheet] = useState<{
    visible: boolean;
    decision: NormalizedDuplicateDecision;
  }>({ visible: false, decision: { type: 'ok', matches: [], isDuplicate: false } });

  stepRef.current = step;

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (yoloStatus.available) void warmUpOnDeviceYolo();
  }, [yoloStatus.available]);

  // Keep auto-snap guide aligned with the on-screen square (not a hardcoded wide rect).
  useEffect(() => {
    const { width: sw, height: sh } = Dimensions.get('window');
    const overlayTop = insets.top + 64;
    const overlayBottom = Math.max(insets.bottom, 16) + 120;
    controllerRef.current.setGuide(
      guideFromLayout({
        screenWidth: sw,
        screenHeight: sh,
        overlayTop,
        overlayBottom,
        frameSize: FRAME_SIZE,
      }),
    );
  }, [insets.top, insets.bottom]);

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const buildDraftFromAnalysis = (
    imageUri: string,
    imageBase64: string | undefined,
    analysis: any,
    detectionConfidence?: number,
    opts?: { provisional?: boolean },
  ): Draft => {
    const vision = pickVisionFields(analysis || {});
    const category = asCategory(
      analysis?.suggestedCategory
      || vision.category
      || analysis?.categoryHint
      || 'tops',
    );
    const color = asColor(vision.color);
    const brand = vision.brand;
    const material = vision.material;
    const seasons = resolveSeasonChips(vision.seasons || []) as ClothingSeason[];
    const occasions = resolveOccasionChips(vision.occasions || []) as ClothingOccasion[];
    const style = occasions[0] || 'everyday';
    const colorLabel = COLOR_LABELS[color] || color;
    const catLabel = CATEGORY_LABELS[category] || category;
    const name = sanitizeWardrobeItemName(
      vision.suggestedName
        || analysis?.suggestedName
        || vision.description
        || `${brand ? `${brand} ` : ''}${colorLabel} ${catLabel}`,
    ) || `${colorLabel} ${catLabel}`;

    const analysisConf = vision.confidence;
    let band = bandFromScores(detectionConfidence, analysisConf);
    // Never flash “Not sure…” — provisional / unknown colour stay at medium (“Check details”).
    if (opts?.provisional || color === 'other') {
      band = band === 'high' ? 'medium' : 'medium';
    }

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
      confidence: band,
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
    setCaptureThumb(uri);
    setStep('processing');
    setHint('Identifying your item…');
    setFrameUi('idle');
    try {
      let settled = false;
      const applyResult = (result: Awaited<ReturnType<typeof processQuickAddCapture>>) => {
        if (settled) return;
        if (!result.analysis && !result.imageUri) return;
        settled = true;
        const next = buildDraftFromAnalysis(
          result.imageUri,
          result.imageBase64,
          result.analysis || {},
          result.detectionConfidence ?? detection?.confidence,
          { provisional: result.provisional },
        );
        setDraft(next);
        setStep('result');
        setCaptureThumb(null);
      };

      const result = await processQuickAddCapture(uri, detection, {
        onPartial: (partial) => {
          // Only reveal Item Details once Vision has settled — skip provisional “Not sure…” flash.
          if (partial.provisional) return;
          if (stepRef.current === 'result' || stepRef.current === 'processing') {
            applyResult(partial);
          }
        },
      });
      if (!result.analysis && !result.imageUri) {
        throw new Error('No analysis');
      }
      if (!result.provisional) {
        applyResult(result);
      } else {
        // Stay on “Identifying…” while late Vision finishes.
        await new Promise<void>((resolve) => {
          const t = setTimeout(() => {
            if (!settled) applyResult(result);
            resolve();
          }, QUICK_ADD_PROVISIONAL_GRACE_MS);
          const poll = setInterval(() => {
            if (settled) {
              clearTimeout(t);
              clearInterval(poll);
              resolve();
            }
          }, 100);
        });
      }
      if (settled) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.warn('[QuickAdd] process failed:', error);
      Alert.alert(
        t('wardrobe.analysisIssue') || 'Couldn’t identify',
        'We couldn’t find an item. Try again.',
        [
          {
            text: 'Try again',
            onPress: () => {
              setCaptureThumb(null);
              setStep('camera');
              setHint('Centre the garment in the box — it can fill the screen');
              controllerRef.current.reset();
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
        ],
      );
      setStep('camera');
      setCaptureThumb(null);
      setHint('Centre the garment in the box — it can fill the screen');
    } finally {
      capturingRef.current = false;
    }
  }, [navigation, t]);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    countdownArmedRef.current = false;
    setCountdown(null);
  }, []);

  const handleCapture = useCallback(async (detection?: QuickAddYoloDetection | null) => {
    if (!cameraRef.current || stepRef.current !== 'camera' || capturingRef.current) return;
    clearCountdown();
    controllerRef.current.markCaptured();
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setHint('Captured');
      setFrameUi('ready');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: true,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) return;
      setCaptureThumb(photo.uri);
      await processCapturedUri(photo.uri, detection ?? lastBestRef.current);
    } catch (error) {
      console.warn('[QuickAdd] capture failed:', error);
      setCaptureThumb(null);
      setHint('Centre the garment in the box — it can fill the screen');
      Alert.alert('Camera', 'Could not take photo. Try again.');
    }
  }, [clearCountdown, processCapturedUri]);

  const handleCaptureRef = useRef(handleCapture);
  handleCaptureRef.current = handleCapture;

  const startCountdown = useCallback((best: QuickAddYoloDetection) => {
    if (countdownArmedRef.current || capturingRef.current) return;
    countdownArmedRef.current = true;
    lastBestRef.current = best;
    setCountdown(COUNTDOWN_START);
    setHint(`Locked — hold still ${COUNTDOWN_START}`);
    setFrameUi('ready');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let n = COUNTDOWN_START;
    countdownTimerRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        countdownArmedRef.current = false;
        setCountdown(null);
        void handleCaptureRef.current(best);
        return;
      }
      setCountdown(n);
      setHint(`Locked — hold still ${n}`);
      void Haptics.selectionAsync();
    }, COUNTDOWN_TICK_MS);
  }, []);

  useEffect(() => {
    const shouldPulse = frameUi === 'ready' || frameUi === 'hold' || countdown != null;
    if (!shouldPulse) {
      pulseAnim.setValue(1);
      return undefined;
    }
    const to = frameUi === 'ready' || countdown != null ? 1.06 : 1.035;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: to, duration: 360, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulseAnim.setValue(1);
    };
  }, [frameUi, countdown, pulseAnim]);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

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
      const onDevice = await detectGarmentsOnDeviceHybrid(small.uri, {
        confThreshold: QUICK_ADD_YOLO_CONF,
        maxDetections: 6,
        ...SINGLE_ITEM_HYBRID_OPTS,
      });
      if (stepRef.current !== 'camera') return;

      const detections: QuickAddYoloDetection[] = (onDevice || []).map((d) => ({
        class: d.category || d.name || 'clothing',
        confidence: d.confidence,
        bbox: bboxFromTuple(d.bbox),
      }));

      const { best, eval: evaluation, armed, cancelCountdown } = controllerRef.current.onFrame(detections);
      if (best) lastBestRef.current = best;
      const now = Date.now();
      if (now - lastUiHintAt.current > 80) {
        lastUiHintAt.current = now;
        if (
          (evaluation.ui === 'hold' || evaluation.ui === 'ready')
          && lastFrameUiRef.current === 'idle'
        ) {
          void Haptics.selectionAsync();
        }
        lastFrameUiRef.current = evaluation.ui;
        setFrameUi(evaluation.ui);
        if (!countdownArmedRef.current) {
          setHint(evaluation.hint);
        }
      }

      if (armed && best) {
        controllerRef.current.markCountdownStarted();
        startCountdown(best);
      } else if (cancelCountdown) {
        // Sustained idle only — brief YOLO misses must not abort green.
        clearCountdown();
      }
    } catch (err) {
      console.warn('[QuickAdd] auto sample failed:', err);
    } finally {
      inFlightRef.current = false;
    }
  }, [clearCountdown, startCountdown, yoloStatus.available]);

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

  const persistDraft = async (opts?: {
    allowDuplicate?: boolean;
  }): Promise<{ ok: boolean; item?: { id: string; name?: string }; blockedByDupe?: boolean }> => {
    if (!draft) return { ok: false };
    const allowDuplicate = opts?.allowDuplicate === true;

    if (!allowDuplicate) {
      let decision: NormalizedDuplicateDecision = { type: 'ok', matches: [], isDuplicate: false };
      try {
        const check = await apiService.checkWardrobeDuplicates([{
          name: draft.name,
          category: draft.category,
          color: draft.color,
          brand: draft.brand,
          imageBase64: draft.imageBase64,
        }]);
        const first = check?.results?.[0];
        decision = normalizeDuplicateDecision({
          ...first,
          type: first?.type || first?.decision?.type,
          decision: first?.decision,
          similarMatches: first?.similarMatches,
        });
      } catch {
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
        decision = normalizeDuplicateDecision({
          isDuplicate: localDupes.length > 0,
          type: localDupes.length > 0 ? 'duplicate' : 'ok',
          matches: localDupes,
          message: localDupes.length > 0
            ? `Looks like you already have ${formatDuplicateNames(localDupes)}.`
            : undefined,
        });
      }

      if (decision.type === 'duplicate' || decision.type === 'already_owned' || decision.type === 'similar_item') {
        setDupeSheet({ visible: true, decision });
        return { ok: false, blockedByDupe: true };
      }
    }

    try {
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
        allowDuplicate,
      } as any);
      return { ok: true, item: { id: String(saved.id), name: saved.name } };
    } catch (error: any) {
      if (error?.duplicate || error?.error === 'DUPLICATE_WARDROBE_ITEM' || error?.status === 409) {
        const decision = normalizeDuplicateDecision({
          type: error?.type || 'duplicate',
          isDuplicate: true,
          message: error?.message,
          matches: error?.matches,
        });
        setDupeSheet({ visible: true, decision });
        return { ok: false, blockedByDupe: true };
      }
      throw error;
    }
  };

  const handleSave = async (opts?: { allowDuplicate?: boolean }) => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const { ok, blockedByDupe } = await persistDraft(opts);
      if (blockedByDupe) return;
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

  if (step === 'processing') {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: '#0B0B0B', paddingTop: insets.top }]}>
        {captureThumb ? (
          <Image source={{ uri: captureThumb }} style={styles.processingThumb} />
        ) : null}
        <ActivityIndicator size="large" color={LuxuryColors.gold} />
        <ThemedText type="body" style={styles.processingText}>
          Identifying your item…
        </ThemedText>
      </View>
    );
  }

  if (step === 'result' && draft) {
    return (
      <>
        <QuickAddTagItem
          draft={draft}
          saving={saving}
          onChange={(next) => setDraft({ ...draft, ...next })}
          onClose={() => {
            setDraft(null);
            setCaptureThumb(null);
            setHint('Centre the garment in the box — it can fill the screen');
            setFrameUi('idle');
            controllerRef.current.reset();
            lastBestRef.current = null;
            clearCountdown();
            setStep('camera');
          }}
          onMenu={() => {
            Alert.alert('Item', undefined, [
              {
                text: 'Retake',
                onPress: () => {
                  setDraft(null);
                  setCaptureThumb(null);
                  setHint('Centre the garment in the box — it can fill the screen');
                  setStep('camera');
                  controllerRef.current.reset();
                  lastBestRef.current = null;
                  clearCountdown();
                },
              },
              { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          onSave={() => { void handleSave(); }}
        />
        <DuplicateComparisonSheet
          visible={dupeSheet.visible}
          type={dupeSheet.decision.type}
          message={
            dupeSheet.decision.message
            || (dupeSheet.decision.type === 'similar_item'
              ? undefined
              : (t('wardrobe.alreadyHaveThisMessage')
                || 'Looks like you already have this (or something very similar) in your wardrobe.')
                .replace('{names}', formatDuplicateNames(dupeSheet.decision.matches) || 'an existing item'))
          }
          candidateImageUri={draft.imageUri}
          candidateLabel={draft.name || 'New item'}
          matches={dupeSheet.decision.matches}
          onClose={() => setDupeSheet((s) => ({ ...s, visible: false }))}
          onAddAnyway={() => {
            setDupeSheet((s) => ({ ...s, visible: false }));
            void handleSave({ allowDuplicate: true });
          }}
          onContinue={() => {
            setDupeSheet((s) => ({ ...s, visible: false }));
            void handleSave({ allowDuplicate: true });
          }}
          onViewExisting={(match) => {
            setDupeSheet((s) => ({ ...s, visible: false }));
            const existingId = match?.id;
            try {
              if (existingId != null) {
                (navigation as any).navigate('WardrobeItemDetail', { itemId: String(existingId) });
              } else {
                navigation.goBack();
              }
            } catch {
              navigation.goBack();
            }
          }}
        />
      </>
    );
  }

  const showHold = frameUi === 'hold' || frameUi === 'struggling';
  const showReady = frameUi === 'ready';
  const frameArmed = showHold || showReady;

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
              {yoloStatus.available
                ? 'Centre in the box (overflow OK) · white → amber → green'
                : 'Centre garment in the box · overflow OK · snap anytime'}
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
            top: insets.top + 64,
            bottom: Math.max(insets.bottom, 16) + 120,
          },
        ]}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            styles.frame,
            showHold && styles.frameHold,
            showReady && styles.frameReady,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          {countdown != null ? (
            <ThemedText type="h2" style={styles.countdownText}>{countdown}</ThemedText>
          ) : null}
        </Animated.View>
        <ThemedText type="body" style={[
          styles.hint,
          showHold && styles.hintHold,
          showReady && styles.hintReady,
        ]}>
          {hint}
        </ThemedText>
      </View>

      {captureThumb ? (
        <View style={[styles.thumbWrap, { bottom: Math.max(insets.bottom, 16) + 108 }]}>
          <Image source={{ uri: captureThumb }} style={styles.thumb} />
        </View>
      ) : null}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable onPress={handleGallery} style={styles.sideBtn} hitSlop={8}>
          <Feather name="image" size={22} color="#FFF" />
        </Pressable>
        <Pressable
          onPress={() => void handleCapture(lastBestRef.current)}
          style={[styles.captureOuter, frameArmed && styles.captureReady, showHold && styles.captureHold]}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameHold: {
    borderColor: HOLD_AMBER,
    borderWidth: 2.5,
  },
  frameReady: {
    borderColor: SUCCESS_GREEN,
    borderWidth: 3,
  },
  countdownText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 64,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  hint: {
    marginTop: Spacing.md,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  hintHold: {
    color: HOLD_AMBER,
    fontWeight: '600',
  },
  hintReady: {
    color: SUCCESS_GREEN,
    fontWeight: '700',
  },
  thumbWrap: {
    position: 'absolute',
    left: Spacing.md,
    zIndex: 6,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  thumb: {
    width: 56,
    height: 72,
    backgroundColor: '#222',
  },
  processingThumb: {
    width: 96,
    height: 120,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
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
  captureHold: {
    borderColor: HOLD_AMBER,
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
