/**
 * Live Stylist — continuous camera sampling (~1 fps) + AR overlays.
 * Uses expo-camera. Prefers on-device YOLO TFLite when the native module is linked
 * (EAS binary); otherwise posts the JPEG to cloud Vision. OTA alone cannot add TFLite.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { LiveArOverlay } from '@/components/live/LiveArOverlay';
import { LiveBeliefDebugOverlay } from '@/components/live/LiveBeliefDebugOverlay';
import { LiveAiBudgetModal, isAiBudgetError, planTierFromBudgetError } from '@/components/live/LiveAiBudgetModal';
import { FallbackShopSection, type FallbackMissingItem } from '@/components/stylist/FallbackShopSection';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/ApiService';
import {
  detectGarmentsOnDevice,
  getLastOnDeviceFootZone,
  getOnDeviceYoloStatus,
  warmUpOnDeviceYolo,
} from '@/services/onDeviceGarmentDetector';
import type { LiveFeedback, LiveFrameResponse, LiveTrackedItem } from '@/types/liveStylist';
import { framesLikelySame, hashBase64Frame, stripBase64Prefix } from '@/utils/liveFrameHash';
import {
  createLiveBeliefMemory,
  syncCoachingToBelief,
  updateLiveBelief,
  type DetectionMemory,
} from '@/utils/beliefState';
import {
  buildDebugSnapshot,
  detectionsToDebugRows,
  emptyDebugSnapshot,
  inspectDetection,
  type BeliefDecision,
  type LiveBeliefDebugSnapshot,
} from '@/utils/liveBeliefDebug';
import { shoeStyleScoreDelta } from '@/utils/liveFootwearGate';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import { leaveLiveAndNavigate } from '@/utils/leaveLiveAndNavigate';
import type { LiveExitDestination } from '@/utils/leaveLiveAndNavigate';
import { isTopTier, normalizeSubscriptionTier } from '@/utils/subscriptionTier';

const SAMPLE_INTERVAL_MS = 1100;
const FRAME_WIDTH = 640;

function liveItemsToDetections(items: LiveTrackedItem[]): OnDeviceDetection[] {
  return items.map((item, i) => ({
    name: item.name,
    category: String(item.category || 'tops'),
    subcategory: item.subcategory || undefined,
    color: item.color || undefined,
    confidence: Number(item.confidence || 0.5),
    bbox: (item.bbox && item.bbox.length === 4
      ? item.bbox
      : [0.2, 0.1, 0.5, 0.35]) as [number, number, number, number],
    trackId: item.trackId || item.tempId || `live_${i}`,
  }));
}

function detectionsToLiveItems(
  detections: OnDeviceDetection[],
  seed?: LiveTrackedItem[],
): LiveTrackedItem[] {
  return detections.map((d, i) => {
    const prev = seed?.find((s) => s.trackId === d.trackId) || seed?.[i];
    return {
      tempId: d.trackId || prev?.tempId || `belief_${i}`,
      trackId: d.trackId || prev?.trackId || `belief_${i}`,
      name: d.name || d.category,
      category: d.category,
      subcategory: d.subcategory || null,
      // Belief owns colour — never keep a stale prev colour when belief cleared it.
      color: d.color || 'other',
      confidence: d.confidence,
      bbox: d.bbox,
      needsConfirm: false,
      source: prev?.source,
      suggestion: d.suggestion || prev?.suggestion || null,
      wardrobeMatch: prev?.wardrobeMatch ?? null,
    };
  });
}

type LiveParams = {
  occasionType?: string;
};

type NavParamList = {
  LiveStylist: LiveParams | undefined;
  ScanWardrobe: undefined;
  ExitLiveBridge: { destination: LiveExitDestination };
};

type Props = {
  navigation: NativeStackNavigationProp<NavParamList, 'LiveStylist'>;
  route: RouteProp<NavParamList, 'LiveStylist'>;
};

export default function LiveStylistScreen({ navigation, route }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const occasionType = route.params?.occasionType || 'casual_day';
  const yoloStatus = getOnDeviceYoloStatus();
  const tier = normalizeSubscriptionTier(user?.subscriptionTier);

  const [isLive, setIsLive] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [layout, setLayout] = useState({ width: Dimensions.get('window').width, height: 480 });
  const [items, setItems] = useState<LiveTrackedItem[]>([]);
  const [feedback, setFeedback] = useState<LiveFeedback | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Cloud vision');
  const [selected, setSelected] = useState<LiveTrackedItem | null>(null);
  const [shopHints, setShopHints] = useState<FallbackMissingItem[]>([]);
  const [statusNote, setStatusNote] = useState('Tap Start for live styling');
  const [showBeliefDebug, setShowBeliefDebug] = useState(true);
  const [debugCollapsed, setDebugCollapsed] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<LiveBeliefDebugSnapshot>(() => emptyDebugSnapshot());
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  /** Prefer server tier from the 429 usage snapshot over cached Auth. */
  const [budgetPlanTier, setBudgetPlanTier] = useState<string | null>(null);

  const lastHashRef = useRef<string | null>(null);
  const previousItemsRef = useRef<LiveTrackedItem[]>([]);
  const previousFeedbackRef = useRef<LiveFeedback | null>(null);
  const detectionMemoryRef = useRef<DetectionMemory>(createLiveBeliefMemory());
  const decisionLogRef = useRef<BeliefDecision[]>([]);
  const inspectRef = useRef<ReturnType<typeof inspectDetection> | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const lastCoachShownAtRef = useRef(0);
  const lastCloudFillAtRef = useRef(0);
  const lastBeliefSignatureRef = useRef('');

  const paintBeliefItems = useCallback((detections: OnDeviceDetection[]) => {
    if (!mountedRef.current || !detections.length) return;
    const painted = detectionsToLiveItems(detections, previousItemsRef.current);
    previousItemsRef.current = painted;
    setItems(painted);
  }, []);

  const beliefSignature = useCallback((detections: OnDeviceDetection[]) => (
    detections
      .map((d) => `${d.category}:${d.subcategory || ''}:${d.color || ''}:${d.name || ''}`)
      .sort()
      .join('|')
  ), []);

  const publishDebug = useCallback((args: {
    frameDetections: OnDeviceDetection[];
    source: string;
    cropped: boolean;
    mutations?: import('@/utils/visionTrust').VisionMutationDiff[];
  }) => {
    if (!mountedRef.current) return;
    const mem = detectionMemoryRef.current;
    setDebugSnapshot(
      buildDebugSnapshot({
        belief: mem.belief,
        frameDetections: detectionsToDebugRows(
          args.frameDetections,
          args.source.includes('cloud') || args.source.includes('vision') ? 'vision' : 'yolo',
        ),
        decisions: decisionLogRef.current,
        cropped: args.cropped,
        source: args.source,
        inspect: inspectRef.current,
        footwearCandidates: mem.lastFootwearCandidates,
        footZone: mem.lastFootZone,
        shoeScore: mem.lastShoeScore,
        mutations: args.mutations,
      }),
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void warmUpOnDeviceYolo();
    return () => {
      mountedRef.current = false;
      setIsLive(false);
    };
  }, []);

  const handleAiBudgetHit = useCallback((err?: unknown) => {
    if (!mountedRef.current) return;
    const serverTier = planTierFromBudgetError(err);
    const effective = serverTier || tier;
    setBudgetPlanTier(effective);
    setIsLive(false);
    setShowBudgetModal(true);
    setStatusNote(
      isTopTier(effective)
        ? (t('live.budgetModal.statusNoteTop') || 'Monthly AI allowance used — resets next month')
        : (t('live.budgetModal.statusNote') || 'Monthly AI allowance used — upgrade or wait until next month'),
    );
  }, [t, tier]);

  const openSubscription = useCallback(() => {
    setShowBudgetModal(false);
    setIsLive(false);
    const plan = normalizeSubscriptionTier(budgetPlanTier || tier);
    const highlightPlan = plan === 'free'
      ? 'personal_stylist'
      : plan === 'personal_stylist'
        ? 'stylist_unlimited'
        : undefined;
    leaveLiveAndNavigate(navigation, { kind: 'subscription', highlightPlan });
  }, [navigation, budgetPlanTier, tier]);

  const openAiTopUp = useCallback(() => {
    setShowBudgetModal(false);
    setIsLive(false);
    leaveLiveAndNavigate(navigation, {
      kind: 'subscription',
      scrollToAiTopUp: true,
    });
  }, [navigation]);

  const openSanityCheck = useCallback(() => {
    setShowBudgetModal(false);
    setIsLive(false);
    leaveLiveAndNavigate(navigation, { kind: 'sanity' });
  }, [navigation]);

  const applyResponse = useCallback((res: LiveFrameResponse) => {
    if (!mountedRef.current) return;

    const footZone = getLastOnDeviceFootZone();

    // Always run server/cloud labels through belief — never paint raw frame truth.
    // Cloud path intentionally skips client hybrid; updateLiveBelief is the single mutation entry.
    if (res.items?.length) {
      const raw = liveItemsToDetections(res.items);
      const stabilized = updateLiveBelief(raw, detectionMemoryRef.current, {
        decisions: decisionLogRef.current,
        bottomBandBrightness: footZone?.brightness,
        occasionType,
      });
      detectionMemoryRef.current = stabilized.memory;
      const painted = detectionsToLiveItems(stabilized.detections, res.items);
      previousItemsRef.current = painted;
      setItems(painted);
      publishDebug({
        frameDetections: raw,
        source: String(res.source || 'cloud_vision'),
        cropped: stabilized.cropped,
        mutations: stabilized.mutations,
      });
    } else if (
      detectionMemoryRef.current.belief?.top
      || detectionMemoryRef.current.belief?.bottom
      || detectionMemoryRef.current.belief?.footwear
    ) {
      const held = updateLiveBelief([], detectionMemoryRef.current, {
        decisions: decisionLogRef.current,
        bottomBandBrightness: footZone?.brightness,
        occasionType,
      });
      detectionMemoryRef.current = held.memory;
      if (held.detections.length) {
        const painted = detectionsToLiveItems(held.detections, previousItemsRef.current);
        previousItemsRef.current = painted;
        setItems(painted);
      }
      publishDebug({
        frameDetections: [],
        source: String(res.source || 'cloud_vision'),
        cropped: held.cropped,
      });
    }

    const baseFeedback = res.feedback;
    if (!baseFeedback) return;

    // Soft shoe-style nudge only when real shoes already in belief (never invent)
    const next = { ...baseFeedback };
    const shoeScore = detectionMemoryRef.current.lastShoeScore;
    if (shoeScore && detectionMemoryRef.current.belief?.footwear) {
      const delta = shoeStyleScoreDelta(shoeScore);
      if (delta !== 0) {
        next.score = Math.max(0, Math.min(100, Math.round((next.score || 0) + delta)));
      }
    }
    // Single UI truth: coaching piece names must match boxes / DBG belief labels
    if (next.coaching && previousItemsRef.current.length) {
      next.coaching = syncCoachingToBelief(
        next.coaching,
        previousItemsRef.current.map((it) => ({
          name: it.name,
          category: String(it.category || ''),
          subcategory: it.subcategory,
          color: it.color,
        })),
      ) || next.coaching;
    }

    const holdMs = next.ui?.holdMs ?? 1000;
    const withinHold = Date.now() - lastCoachShownAtRef.current < holdMs;
    const serverStable = Boolean(next.ui?.stable);
    const hadFeedback = Boolean(previousFeedbackRef.current);
    const scoreJump = Math.abs((previousFeedbackRef.current?.score || 0) - (next.score || 0)) >= 8;
    const prevCoach = previousFeedbackRef.current?.coaching;
    const nextCoach = next.coaching;
    const coachChanged = Boolean(
      nextCoach
      && (
        prevCoach?.summary !== nextCoach.summary
        || prevCoach?.headline !== nextCoach.headline
        || (prevCoach as { outfitSignature?: string } | undefined)?.outfitSignature
          !== (nextCoach as { outfitSignature?: string }).outfitSignature
      ),
    );
    const piecesChanged = (previousFeedbackRef.current?.itemCount || 0) !== (next.itemCount || 0);
    const paintedSig = beliefSignature(previousItemsRef.current.map((it, i) => ({
      name: it.name,
      category: String(it.category || ''),
      subcategory: it.subcategory || undefined,
      color: it.color || undefined,
      confidence: Number(it.confidence || 0),
      bbox: (it.bbox || [0, 0, 1, 1]) as [number, number, number, number],
      trackId: it.trackId || `p_${i}`,
    })));
    const beliefChanged = Boolean(paintedSig && paintedSig !== lastBeliefSignatureRef.current);
    if (paintedSig) lastBeliefSignatureRef.current = paintedSig;

    if (res.feedbackChanged || !hadFeedback || coachChanged || piecesChanged || beliefChanged) {
      previousFeedbackRef.current = next;
      // Flush coaching when belief labels change — boxes and copy must stay in sync
      const shouldPaint = !hadFeedback || !serverStable || scoreJump || !withinHold
        || coachChanged || piecesChanged || beliefChanged || Boolean(res.feedbackChanged);
      if (shouldPaint) {
        setFeedback(next);
        lastCoachShownAtRef.current = Date.now();
      }
    }

    if (res.shopHints?.length) setShopHints(res.shopHints as FallbackMissingItem[]);
    if (res.source === 'cloud_vision' || String(res.source || '').includes('hybrid')) {
      setSourceLabel(String(res.source || '').includes('hybrid') ? 'Cloud fill' : 'Cloud vision');
    } else if (String(res.source || '').includes('on_device')) setSourceLabel('On-device');
    else setSourceLabel(String(res.source || 'Live'));
  }, [beliefSignature, occasionType, publishDebug]);

  const processFrame = useCallback(async () => {
    if (!cameraRef.current || inFlightRef.current || !mountedRef.current) return;
    inFlightRef.current = true;
    setIsBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) return;

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: FRAME_WIDTH } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const base64 = manipulated.base64;
      if (!base64) return;

      const frameHash = hashBase64Frame(base64);
      if (framesLikelySame(lastHashRef.current, frameHash)) {
        setStatusNote('Holding — frame unchanged');
        return;
      }
      lastHashRef.current = frameHash;

      const onDevice = await detectGarmentsOnDevice(manipulated.uri);
      const payload: Record<string, unknown> = {
        occasionType,
        hybridMatch: true,
        frameHash,
        previousItems: previousItemsRef.current,
        previousFeedback: previousFeedbackRef.current,
      };

      if (onDevice?.length) {
        const { correctOnDeviceDetections } = await import('@/utils/yoloToPipelineCandidates');
        const footZoneEarly = getLastOnDeviceFootZone();
        const { detections: corrected, pipeline } = correctOnDeviceDetections(onDevice, {
          id: frameHash,
          context: occasionType,
          // Recover shoes when foot zone is visible — never invent on cropped thighs
          hybrid: {
            rematerializeBottom: false,
            inferMissingFootwear: Boolean(footZoneEarly?.visible),
          },
        });
        if (pipeline?.discarded) {
          setStatusNote(
            pipeline.discardReason === 'too_blurry'
              ? 'Hold steadier — frame too blurry'
              : pipeline.discardReason === 'too_many_items'
                ? 'Too many items in frame'
                : 'Frame skipped — low quality',
          );
          return;
        }
        // Temporal memory — hold top/bottom across flaky frames (no restart needed)
        const footZone = getLastOnDeviceFootZone();
        const stabilized = updateLiveBelief(corrected, detectionMemoryRef.current, {
          decisions: decisionLogRef.current,
          bottomBandBrightness: footZone?.brightness,
          occasionType,
        });
        detectionMemoryRef.current = stabilized.memory;
        payload.detections = stabilized.detections;
        payload.detectorSource = 'yolo';
        payload.sceneType = 'worn';
        payload.frameCropped = stabilized.cropped;
        if (stabilized.memory?.belief?.torsoState) {
          payload.torsoState = stabilized.memory.belief.torsoState;
        }
        const repairs = [
          ...(pipeline?.repairs || []),
          ...stabilized.repairs,
        ];
        if (repairs.length) {
          payload.pipelineRepairs = repairs;
          payload.pipelineConfidence = pipeline?.confidence;
        }
        // Paint boxes from belief immediately — don't wait on the network round-trip
        paintBeliefItems(stabilized.detections);
        publishDebug({
          frameDetections: onDevice,
          source: 'on_device_yolo',
          cropped: stabilized.cropped,
          mutations: stabilized.mutations,
        });

        const belief = stabilized.memory.belief;
        const missingTop = !belief?.top && !belief?.layer;
        const missingShoes = !belief?.footwear && Boolean(footZone?.visible);
        const sparse = stabilized.detections.length < 2;
        const incomplete = missingTop || missingShoes || sparse;
        // Missing top/shoes → fill after 2s; otherwise sparse frames after 4s
        const fillMs = (missingTop || missingShoes) ? 2000 : 4000;
        const cloudFillReady = Date.now() - lastCloudFillAtRef.current >= fillMs;
        if (incomplete && cloudFillReady) {
          payload.imageBase64 = stripBase64Prefix(base64);
          payload.cloudFill = true;
          lastCloudFillAtRef.current = Date.now();
        }
      } else {
        payload.imageBase64 = stripBase64Prefix(base64);
      }

      const res = await apiService.liveScanFrame(payload);
      if (!res.success) {
        if (isAiBudgetError({ message: res.message, error: (res as { error?: string }).error })) {
          handleAiBudgetHit(res);
          return;
        }
        setStatusNote(res.message || 'Scan failed');
        return;
      }
      applyResponse(res);
      setStatusNote(
        res.itemCount
          ? `${res.itemCount} piece${res.itemCount === 1 ? '' : 's'} · ${res.feedback?.score ?? '—'}`
          : 'No garments yet — hold steadier',
      );
    } catch (error) {
      console.warn('[LiveStylist] frame error:', error);
      const msg = error instanceof Error ? error.message : 'Frame failed';
      if (isAiBudgetError(error)) {
        handleAiBudgetHit(error);
      } else if (/rate limit|429/i.test(msg) && !/usage limit/i.test(msg)) {
        setStatusNote('Slowing down — rate limited');
      } else {
        setStatusNote('Could not analyse frame');
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsBusy(false);
    }
  }, [applyResponse, handleAiBudgetHit, occasionType, paintBeliefItems, publishDebug]);

  useEffect(() => {
    if (!isLive) return undefined;
    processFrame();
    const id = setInterval(() => {
      processFrame();
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isLive, processFrame]);

  const toggleLive = async () => {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        Alert.alert(
          t('wardrobe.permissionRequired') || 'Permission Required',
          t('wardrobe.cameraAccessWasDeniedPleaseEnableItInSet') || 'Enable camera in Settings.',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            { text: t('common.openSettings') || 'Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLive((v) => {
      const next = !v;
      if (next) {
        detectionMemoryRef.current = createLiveBeliefMemory();
        decisionLogRef.current = [];
        inspectRef.current = null;
        lastHashRef.current = null;
        previousItemsRef.current = [];
        previousFeedbackRef.current = null;
        setItems([]);
        setFeedback(null);
        setDebugSnapshot(emptyDebugSnapshot('live'));
      }
      setStatusNote(next ? 'Live — sampling…' : 'Paused');
      return next;
    });
  };

  const openStillScan = useCallback(async () => {
    if (!cameraRef.current || inFlightRef.current || !mountedRef.current) return;
    setIsLive(false);
    inFlightRef.current = true;
    setIsBusy(true);
    setStatusNote('Still scan — locking look…');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) {
        setStatusNote('Still scan failed — no photo');
        return;
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: Math.max(FRAME_WIDTH, 720) } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const base64 = manipulated.base64;
      if (!base64) {
        setStatusNote('Still scan failed — encode error');
        return;
      }

      const frameHash = hashBase64Frame(base64);
      lastHashRef.current = frameHash;

      const onDevice = await detectGarmentsOnDevice(manipulated.uri);
      const payload: Record<string, unknown> = {
        occasionType,
        hybridMatch: true,
        frameHash,
        previousItems: previousItemsRef.current,
        previousFeedback: previousFeedbackRef.current,
        richCritique: true,
        mode: 'still',
        sceneType: 'worn',
        imageBase64: stripBase64Prefix(base64),
      };

      if (onDevice?.length) {
        const { correctOnDeviceDetections } = await import('@/utils/yoloToPipelineCandidates');
        const { detections: corrected, pipeline } = correctOnDeviceDetections(onDevice, {
          id: frameHash,
          context: occasionType,
          hybrid: { rematerializeBottom: false, inferMissingFootwear: true },
        });
        if (!pipeline?.discarded) {
          const footZone = getLastOnDeviceFootZone();
          const stabilized = updateLiveBelief(corrected, detectionMemoryRef.current, {
            decisions: decisionLogRef.current,
            bottomBandBrightness: footZone?.brightness,
            occasionType,
          });
          detectionMemoryRef.current = stabilized.memory;
          payload.detections = stabilized.detections;
          payload.detectorSource = 'yolo';
          payload.frameCropped = stabilized.cropped;
          if (stabilized.memory?.belief?.torsoState) {
            payload.torsoState = stabilized.memory.belief.torsoState;
          }
          publishDebug({
            frameDetections: onDevice,
            source: 'still_scan',
            cropped: stabilized.cropped,
            mutations: stabilized.mutations,
          });
        }
      }

      const res = await apiService.liveScanFrame(payload);
      if (!res.success) {
        if (isAiBudgetError({ message: res.message, error: (res as { error?: string }).error })) {
          handleAiBudgetHit(res);
          return;
        }
        setStatusNote(res.message || 'Still scan failed');
        return;
      }
      applyResponse(res);
      setStatusNote(
        res.itemCount
          ? `Still · ${res.itemCount} piece${res.itemCount === 1 ? '' : 's'} · ${res.feedback?.score ?? '—'}`
          : 'Still scan done',
      );
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* optional */
      }
    } catch (err: unknown) {
      if (isAiBudgetError(err)) {
        handleAiBudgetHit(err);
      } else {
        const msg = err instanceof Error ? err.message : 'Still scan failed';
        setStatusNote(msg);
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsBusy(false);
    }
  }, [applyResponse, handleAiBudgetHit, occasionType, publishDebug]);

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={LuxuryColors.gold} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, padding: Spacing.lg }]}>
        <ThemedText type="h2" style={{ marginBottom: Spacing.md }}>
          Camera access
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' }}>
          Live stylist needs the camera to sample your outfit.
        </ThemedText>
        <Pressable onPress={requestPermission} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}>
          <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
            Allow camera
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#000', paddingTop: insets.top }]}>
      <View
        style={styles.cameraWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout({ width, height });
        }}
      >
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
        <LiveArOverlay
          width={layout.width}
          height={layout.height}
          items={items}
          feedback={feedback}
          selectedTrackId={selected?.trackId}
          showRegionGuides={showBeliefDebug}
          onSelectItem={(item) => {
            Haptics.selectionAsync();
            setSelected(item);
            if (item.bbox) {
              inspectRef.current = inspectDetection({
                name: item.name,
                category: item.category,
                subcategory: item.subcategory || undefined,
                color: item.color,
                confidence: item.confidence || 0.5,
                bbox: item.bbox as [number, number, number, number],
                trackId: item.trackId,
              });
              setDebugSnapshot((prev) => ({
                ...prev,
                inspect: inspectRef.current,
              }));
              if (!showBeliefDebug) setShowBeliefDebug(true);
            }
          }}
        />
        {showBeliefDebug ? (
          <LiveBeliefDebugOverlay
            snapshot={debugSnapshot}
            collapsed={debugCollapsed}
            onToggleCollapse={() => setDebugCollapsed((v) => !v)}
            onClose={() => setShowBeliefDebug(false)}
          />
        ) : null}
      </View>

      {!showBudgetModal ? (
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.metaRow}>
          <Pressable
            onLongPress={() => {
              Haptics.selectionAsync();
              setShowBeliefDebug((v) => !v);
            }}
            delayLongPress={450}
            style={{ flex: 1 }}
          >
            <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {sourceLabel} · {statusNote}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setShowBeliefDebug((v) => !v);
            }}
            style={[styles.debugChip, showBeliefDebug ? styles.debugChipOn : null]}
            hitSlop={8}
          >
            <ThemedText type="caption" style={{ color: showBeliefDebug ? '#0B0B0F' : 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
              DBG
            </ThemedText>
          </Pressable>
          {isBusy ? <ActivityIndicator size="small" color={LuxuryColors.gold} /> : null}
        </View>
        <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          {yoloStatus.available
            ? 'On-device YOLO ready — cloud Vision only if detection fails'
            : yoloStatus.requiresNativeRebuild
              ? 'On-device YOLO needs a new EAS binary — using cloud sampling (OTA insufficient)'
              : 'On-device YOLO unavailable — using cloud sampling'}
        </ThemedText>

        <View style={styles.actions}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
            <Feather name="x" size={22} color="#FFF" />
          </Pressable>
          <Pressable
            onPress={toggleLive}
            style={[styles.primaryBtn, { backgroundColor: isLive ? '#C45C4A' : LuxuryColors.gold, flex: 1 }]}
          >
            <ThemedText type="body" style={{ color: isLive ? '#FFF' : LuxuryColors.midnight, fontWeight: '700' }}>
              {isLive ? 'Stop' : 'Start live'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={openStillScan} style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.35)' }]}>
            <ThemedText type="caption" style={{ color: '#FFF' }}>
              Still scan
            </ThemedText>
          </Pressable>
        </View>
      </LinearGradient>
      ) : null}

      <LiveAiBudgetModal
        visible={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        onUpgrade={openSubscription}
        onBuyCredit={openAiTopUp}
        onContinueSanityCheck={openSanityCheck}
        planTier={budgetPlanTier || tier}
      />

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelected(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: isDark ? theme.surface : '#FFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="h3" style={{ marginBottom: 4 }}>
              {selected?.name || 'Garment'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              {selected?.category}
              {selected?.color ? ` · ${selected.color}` : ''}
              {selected?.confidence != null ? ` · ${Math.round(selected.confidence * 100)}%` : ''}
            </ThemedText>
            {selected?.suggestion ? (
              <ThemedText type="body" style={{ marginBottom: Spacing.md }}>
                {selected.suggestion}
              </ThemedText>
            ) : null}
            {selected?.wardrobeMatch ? (
              <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginBottom: Spacing.md }}>
                Matches wardrobe: {selected.wardrobeMatch.name}
              </ThemedText>
            ) : null}
            <FallbackShopSection
              missing={
                shopHints.length
                  ? shopHints
                  : selected
                    ? [{
                        label: selected.name,
                        name: selected.name,
                        role: selected.category,
                        reason: 'Shop similar pieces',
                        products: [],
                        retail: {
                          query: `${selected.color || ''} ${selected.name || selected.category}`.trim(),
                          online: [
                            {
                              retailer: 'Google',
                              searchUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${selected.color || ''} ${selected.name || selected.category}`)}`,
                            },
                          ],
                        },
                      }]
                    : []
              }
              headline="Alternatives & shops"
            />
            <Pressable onPress={() => setSelected(null)} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold, marginTop: Spacing.md }]}>
              <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
                Close
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  debugChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  debugChipOn: {
    backgroundColor: LuxuryColors.gold,
    borderColor: LuxuryColors.gold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '70%',
  },
});
