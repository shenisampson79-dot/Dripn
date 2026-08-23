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
import * as Clipboard from 'expo-clipboard';
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
import { useAuth } from '@/contexts/AuthContext';
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
import { isBeliefDebugAllowed, isQuickAddAutocaptureAllowed } from '@/utils/staffAccess';
import { sanitizeWardrobeItemName } from '@/utils/wardrobeItemName';
import { normalizeWardrobeCategory } from '@/utils/wardrobeCategories';
import {
  resolveOccasionChips,
  resolveSeasonChips,
} from '@/utils/wardrobeSeasonOccasion';
import {
  CONSERVATIVE_LAUNCH_COPY,
  decisionFromLocalMatches,
  findConservativeLaunchDuplicates,
  findLocalWardrobeDuplicates,
  formatDuplicateNames,
  normalizeDuplicateDecision,
  overrideIdsFromMatches,
  type NormalizedDuplicateDecision,
} from '@/utils/wardrobeDuplicateMatch';
import {
  QuickAddCaptureController,
  bboxFromTuple,
  guideFromLayout,
  type QuickAddAuditSample,
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
/** Ready → 3-2-1 countdown; each digit gets a full second, then snap after "1". */
const COUNTDOWN_TICK_MS = 1000;
const COUNTDOWN_START = 3;
/** Lower than default parse threshold so boots/shoes still register in-frame. */
const QUICK_ADD_YOLO_CONF = 0.14;
/** Staff diagnostic ring — ~40 samples ≈ 34s @ 850ms. */
const QUICK_ADD_TRACE_MAX = 48;

function formatQuickAddTraceRow(audit: QuickAddAuditSample): Record<string, unknown> {
  return {
    timestamp: audit.ts,
    detectionCount: audit.detectionCount,
    detectedClass: audit.detectedClass,
    confidence: Number(audit.confidence.toFixed(3)),
    bbox: audit.bbox,
    iouVsPrevious: audit.iouVsPrevious == null ? null : Number(audit.iouVsPrevious.toFixed(3)),
    coverage: Number(audit.coverage.toFixed(3)),
    rawReady: audit.rawReady,
    ghostMiss: audit.ghostMiss,
    timeSinceLastRealDetectionMs: audit.timeSinceLastRealDetectionMs,
    readySamples: audit.greenStableSamples,
    greenHitRate: Number(audit.greenHitRate.toFixed(3)),
    advancedUi: audit.advancedUi,
    hint: audit.hint,
    startCountdown: audit.startCountdown,
    rawFlags: audit.rawFlags,
    visionInSampleLoop: audit.visionInSampleLoop,
    visionLabel: null,
    visionConfidence: null,
  };
}

type Step = 'camera' | 'processing' | 'result' | 'saveProgress';
type SavePhase = 'checking' | 'preparing';
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
  const { user } = useAuth();
  const beliefDebug = isBeliefDebugAllowed(__DEV__, user);
  /** Launch: customers get manual shutter only; staff/dev keep READY path + traces. */
  const autocaptureEnabled = isQuickAddAutocaptureAllowed(__DEV__, user);
  const insets = useSafeAreaInsets();
  const { addItem, items: wardrobeItems, reloadWardrobe } = useWardrobe();
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
  const traceBufferRef = useRef<QuickAddAuditSample[]>([]);

  const [step, setStep] = useState<Step>('camera');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [hint, setHint] = useState('Centre the garment in the box — tap Capture');
  const [frameUi, setFrameUi] = useState<QuickAddCaptureUi>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureThumb, setCaptureThumb] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<SavePhase>('checking');
  const [traceCount, setTraceCount] = useState(0);
  const [lastTraceSummary, setLastTraceSummary] = useState('');
  const [dupeSheet, setDupeSheet] = useState<{
    visible: boolean;
    decision: NormalizedDuplicateDecision;
  }>({ visible: false, decision: { type: 'ok', matches: [], isDuplicate: false } });

  stepRef.current = step;

  const copyQuickAddTrace = useCallback(async () => {
    const rows = traceBufferRef.current.map(formatQuickAddTraceRow);
    const payload = JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        sampleCount: rows.length,
        note: 'READY sample loop = YOLO + on-device hybrid only; visionInSampleLoop always false',
        samples: rows,
      },
      null,
      2,
    );
    try {
      await Clipboard.setStringAsync(payload);
      Alert.alert('Quick Add trace', `Copied ${rows.length} samples to clipboard.`);
    } catch {
      Alert.alert('Quick Add trace', 'Could not copy — try again.');
    }
  }, []);

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
    const subcategory = vision.subcategory;
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
      subcategory,
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
              setHint(
                isQuickAddAutocaptureAllowed(__DEV__, user)
                  ? 'Centre the garment in the box — it can fill the screen'
                  : 'Centre the garment in the box — tap Capture',
              );
              controllerRef.current.reset();
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
        ],
      );
      setStep('camera');
      setCaptureThumb(null);
      setHint(
        isQuickAddAutocaptureAllowed(__DEV__, user)
          ? 'Centre the garment in the box — it can fill the screen'
          : 'Centre the garment in the box — tap Capture',
      );
    } finally {
      capturingRef.current = false;
    }
  }, [navigation, t, user]);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    countdownArmedRef.current = false;
    setCountdown(null);
  }, []);

  const cameraHint = autocaptureEnabled
    ? 'Centre the garment in the box — it can fill the screen'
    : 'Centre the garment in the box — tap Capture';

  const handleCapture = useCallback(async (detection?: QuickAddYoloDetection | null) => {
    if (!cameraRef.current || stepRef.current !== 'camera' || capturingRef.current) return;
    // Lock before shutter so in-flight YOLO samples cannot paint amber.
    capturingRef.current = true;
    if (autocaptureEnabled) setFrameUi('ready');
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    controllerRef.current.markCaptured();
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setHint('Captured');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: true,
        skipProcessing: Platform.OS === 'android',
      });
      clearCountdown();
      if (!photo?.uri) {
        capturingRef.current = false;
        return;
      }
      setCaptureThumb(photo.uri);
      await processCapturedUri(photo.uri, detection ?? lastBestRef.current);
    } catch (error) {
      console.warn('[QuickAdd] capture failed:', error);
      capturingRef.current = false;
      clearCountdown();
      setCaptureThumb(null);
      setFrameUi('idle');
      setHint(cameraHint);
      Alert.alert('Camera', 'Could not take photo. Try again.');
    }
  }, [autocaptureEnabled, cameraHint, clearCountdown, processCapturedUri]);

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
        // Full second on "1" finished — stay green and snap (no amber re-lock).
        setCountdown(1);
        setHint('Locked — capturing…');
        setFrameUi('ready');
        void Haptics.selectionAsync();
        void handleCaptureRef.current(best);
        return;
      }
      setCountdown(n);
      setHint(`Locked — hold still ${n}`);
      setFrameUi('ready');
      void Haptics.selectionAsync();
    }, COUNTDOWN_TICK_MS);
  }, []);

  useEffect(() => {
    const shouldPulse =
      autocaptureEnabled
      && (frameUi === 'ready' || frameUi === 'hold' || countdown != null);
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
  }, [autocaptureEnabled, frameUi, countdown, pulseAnim]);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  useEffect(() => {
    if (!autocaptureEnabled) {
      clearCountdown();
      setFrameUi('idle');
      setHint('Centre the garment in the box — tap Capture');
      lastFrameUiRef.current = 'idle';
      lastBestRef.current = null;
    }
  }, [autocaptureEnabled, clearCountdown]);

  const sampleForAutoCapture = useCallback(async () => {
    if (
      !autocaptureEnabled
      || !yoloStatus.available
      || !cameraRef.current
      || stepRef.current !== 'camera'
      || inFlightRef.current
      || capturingRef.current
      || countdownArmedRef.current
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
      // Sample started before green lock — drop results, keep the box green.
      if (countdownArmedRef.current || capturingRef.current) {
        setFrameUi('ready');
        return;
      }

      const detections: QuickAddYoloDetection[] = (onDevice || []).map((d) => ({
        class: d.category || d.name || 'clothing',
        confidence: d.confidence,
        bbox: bboxFromTuple(d.bbox),
      }));

      const { best, eval: evaluation, armed, cancelCountdown, audit } =
        controllerRef.current.onFrame(detections);
      if (beliefDebug) {
        const row = formatQuickAddTraceRow(audit);
        console.log('[QuickAddTrace]', JSON.stringify(row));
        const buf = traceBufferRef.current;
        buf.push(audit);
        while (buf.length > QUICK_ADD_TRACE_MAX) buf.shift();
        setTraceCount(buf.length);
        setLastTraceSummary(
          `${audit.advancedUi} conf=${audit.confidence.toFixed(2)} raw=${audit.rawReady ? 'Y' : 'N'} ghost=${audit.ghostMiss ? 'Y' : 'N'} n=${audit.greenStableSamples}`,
        );
      }
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
  }, [beliefDebug, autocaptureEnabled, clearCountdown, startCountdown, yoloStatus.available]);

  useEffect(() => {
    if (
      !autocaptureEnabled
      || step !== 'camera'
      || !permission?.granted
      || !yoloStatus.available
    ) {
      return undefined;
    }
    const id = setInterval(() => {
      void sampleForAutoCapture();
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [
    autocaptureEnabled,
    step,
    permission?.granted,
    yoloStatus.available,
    sampleForAutoCapture,
  ]);

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
    onPhase?: (phase: SavePhase) => void;
  }): Promise<{ ok: boolean; item?: { id: string; name?: string }; blockedByDupe?: boolean }> => {
    if (!draft) return { ok: false };
    const allowDuplicate = opts?.allowDuplicate === true;
    const wardrobePool = wardrobeItems.map((it) => ({
      id: String(it.id),
      name: it.name,
      category: it.category,
      subcategory: it.subcategory,
      color: it.color,
      brand: it.brand,
      material: it.material,
      imageUri: it.enhancedImageUri || it.imageUri,
      origin: it.origin,
      imagePhash: it.imagePhash,
      sourceCropId: it.sourceCropId,
      scanSessionId: it.scanSessionId,
      sourceImageId: (it as { sourceImageId?: string }).sourceImageId,
      captureSessionId: it.scanSessionId,
    }));

    if (!allowDuplicate) {
      opts?.onPhase?.('checking');
      let decision: NormalizedDuplicateDecision = { type: 'ok', matches: [], isDuplicate: false };
      try {
        const check = await apiService.checkWardrobeDuplicates([{
          name: draft.name,
          category: draft.category,
          subcategory: draft.subcategory,
          color: draft.color,
          brand: draft.brand,
          material: draft.material,
          imageBase64: draft.imageBase64,
        }]);
        const first = check?.results?.[0];
        decision = normalizeDuplicateDecision({
          ...first,
          type: first?.type || first?.decision?.type,
          decision: first?.decision,
          similarMatches: first?.similarMatches,
          conflictMatches: (first as { conflictMatches?: unknown[] } | undefined)?.conflictMatches,
        });
      } catch {
        decision = decisionFromLocalMatches(
          findLocalWardrobeDuplicates(
            {
              name: draft.name,
              category: draft.category,
              subcategory: draft.subcategory,
              color: draft.color,
              brand: draft.brand,
              material: draft.material,
            },
            wardrobePool,
          ),
        );
      }

      if (decision.type === 'ok') {
        const conservative = findConservativeLaunchDuplicates(
          {
            name: draft.name,
            category: draft.category,
            subcategory: draft.subcategory,
            color: draft.color,
            brand: draft.brand,
            material: draft.material,
          },
          wardrobePool,
        );
        if (conservative.length) {
          decision = {
            type: 'similar_item',
            matches: conservative,
            isDuplicate: false,
            message: CONSERVATIVE_LAUNCH_COPY.message,
          };
        }
      }

      if (decision.type === 'duplicate' || decision.type === 'already_owned' || decision.type === 'similar_item' || decision.type === 'classification_conflict') {
        setDupeSheet({ visible: true, decision });
        return { ok: false, blockedByDupe: true };
      }
    }

    opts?.onPhase?.('preparing');
    try {
      const saved = await addItem({
        name: draft.name,
        category: draft.category,
        subcategory: draft.subcategory,
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
        dedupeOverrideAgainst: allowDuplicate
          ? overrideIdsFromMatches(dupeSheet.decision.matches)
          : undefined,
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
    setSavePhase('checking');
    setStep('saveProgress');
    try {
      const { ok, blockedByDupe } = await persistDraft({
        ...opts,
        onPhase: setSavePhase,
      });
      if (blockedByDupe) {
        setStep('result');
        return;
      }
      if (!ok) {
        setStep('result');
        return;
      }
      await reloadWardrobe();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      setStep('result');
      Alert.alert(
        t('wardrobe.error') || 'Error',
        error instanceof Error ? error.message : 'Could not save item.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (step === 'saveProgress') {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: '#0B0B0B', paddingTop: insets.top }]}>
        {draft?.imageUri ? (
          <Image source={{ uri: draft.imageUri }} style={styles.processingThumb} />
        ) : null}
        <ActivityIndicator size="large" color={LuxuryColors.gold} />
        <ThemedText type="body" style={styles.processingText}>
          {savePhase === 'checking' ? 'Checking your wardrobe…' : 'Preparing your item…'}
        </ThemedText>
      </View>
    );
  }

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
            setHint(cameraHint);
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
                  setHint(cameraHint);
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
          title={
            dupeSheet.decision.message === CONSERVATIVE_LAUNCH_COPY.message
              ? CONSERVATIVE_LAUNCH_COPY.title
              : undefined
          }
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

  const showHold = autocaptureEnabled && (frameUi === 'hold' || frameUi === 'struggling');
  const showReady = autocaptureEnabled && frameUi === 'ready';
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
              {autocaptureEnabled
                ? (yoloStatus.available
                  ? 'Centre in the box (overflow OK) · white → amber → green'
                  : 'Centre garment in the box · overflow OK · snap anytime')
                : 'Centre garment in the box · overflow OK · tap Capture'}
            </ThemedText>
          </View>
          <Pressable onPress={() => setTorch((v) => !v)} hitSlop={10} style={styles.iconBtn}>
            <Feather name={torch ? 'zap' : 'zap-off'} size={20} color="#FFF" />
          </Pressable>
        </View>
        {beliefDebug && autocaptureEnabled ? (
          <View style={styles.traceBar}>
            <ThemedText type="caption" style={styles.traceSummary} numberOfLines={1}>
              {traceCount > 0 ? lastTraceSummary : 'Trace armed — samples appear after YOLO ticks'}
            </ThemedText>
            <Pressable
              onPress={() => void copyQuickAddTrace()}
              style={styles.traceCopyBtn}
              hitSlop={8}
            >
              <ThemedText type="caption" style={styles.traceCopyText}>
                Copy {traceCount}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
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
          {autocaptureEnabled && countdown != null ? (
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
  traceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
  },
  traceSummary: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  traceCopyBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  traceCopyText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
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
