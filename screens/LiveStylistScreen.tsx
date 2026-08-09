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
import { isStaffUser } from '@/utils/staffAccess';
import {
  detectGarmentsOnDevice,
  getLastOnDeviceFootZone,
  getOnDeviceYoloStatus,
  warmUpOnDeviceYolo,
} from '@/services/onDeviceGarmentDetector';
import type { LiveFeedback, LiveFrameResponse, LiveTrackedItem } from '@/types/liveStylist';
import {
  framesLikelySame,
  hasMeaningfulLiveSceneChange,
  hashBase64Frame,
  stripBase64Prefix,
} from '@/utils/liveFrameHash';
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
import { polishUkCoaching } from '@/utils/liveLocaleLabels';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import { leaveLiveAndNavigate } from '@/utils/leaveLiveAndNavigate';
import { isTopTier, normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { roleOfCategory } from '@/utils/liveDetectionMemory';
import { beliefBboxIou } from '@/utils/liveGarmentBelief';
import { detectSuspectLiveRead } from '@/utils/liveSuspectRead';
import {
  createLiveScoreGate,
  gateLiveJudgment,
  gateLiveScore,
  liveCoreIdentityKey,
  liveIdentityIsConsistent,
  liveIdentityKey,
  liveJudgmentCertainty,
  liveOutfitReadyToScore,
  livePieceSetKey,
  liveScoreSignature,
  presentLiveScore,
  pushLiveIdentitySample,
  smoothLiveCertainty,
  createCertaintySmoothState,
  LIVE_CERTAINTY_UPGRADE_STREAK,
  type LiveIdentitySample,
} from '@/utils/liveScoreStability';
import {
  alignCoachingToTruth,
  buildOutfitTruth,
  canWarmStartTruth,
  stashWarmTruth,
  truthMateriallyChanged,
  type LiveOutfitTruth,
  type WarmTruthStash,
} from '@/utils/liveOutfitTruth';
import { enforceLiveOutcomeContract } from '@/utils/liveOutcomeContract';

const SAMPLE_INTERVAL_MS = 1100;
const FRAME_WIDTH = 640;
/**
 * On-device YOLO has no outerwear class, so pulling a jacket on adds no box and
 * a filled belief looks complete indefinitely. Re-ask cloud Vision on this slow
 * cadence so a new layer is caught without paying per frame.
 */
const CLOUD_LAYER_VERIFY_MS = 12000;
/** Event-triggered cloud checks are throttled even when the scene keeps moving. */
/** ~3s keeps jacket put-on responsive without cloud-per-frame spend. */
const CLOUD_SCENE_EVENT_COOLDOWN_MS = 3000;
const CLOUD_SCENE_EVENT_FRAMES = 2;
/**
 * Self-contradicting reads escalate on the next frame. This is bounded by asking
 * once per suspect belief, so it costs one call per mistake, not one per second.
 */
const CLOUD_SUSPECT_COOLDOWN_MS = 1200;
/**
 * Feet searchable but no shoe belief — unlock barefoot scoring so the badge
 * does not sit on "—" while DBG shows Searching…
 */
const SEARCHING_BAREFOOT_MS = 2500;

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
    // Belief needs to know a read came from a Vision correction: the geometry
    // that would normally gate the change is the same geometry that was wrong.
    source: item.source ? String(item.source) : undefined,
  }));
}

function detectionsToLiveItems(
  detections: OnDeviceDetection[],
  seed?: LiveTrackedItem[],
): LiveTrackedItem[] {
  const merged = mergeOverlappingSameClassDetections(detections);
  return merged.map((d, i) => {
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

/** Collapse duplicate paint boxes (two Black Hoodie bboxes) before HUD. */
function mergeOverlappingSameClassDetections(
  detections: OnDeviceDetection[],
): OnDeviceDetection[] {
  if (detections.length < 2) return detections;
  const out: OnDeviceDetection[] = [];
  for (const det of detections) {
    const blob = `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
    const idx = out.findIndex((kept) => {
      const keptBlob = `${kept.category || ''} ${kept.subcategory || ''} ${kept.name || ''}`.toLowerCase();
      const sameName = Boolean(
        det.name && kept.name
        && det.name.toLowerCase().replace(/\s+/g, ' ') === kept.name.toLowerCase().replace(/\s+/g, ' '),
      );
      const sameFamily = (
        (/hoodie|sweater|knit/.test(blob) && /hoodie|sweater|knit/.test(keptBlob))
        || (/chino|short|trouser|pant|skirt|dress/.test(blob)
          && /chino|short|trouser|pant|skirt|dress/.test(keptBlob)
          && roleOfCategory(det.category, det.subcategory)
            === roleOfCategory(kept.category, kept.subcategory))
      );
      if (!sameName && !sameFamily) return false;
      if (!det.bbox || !kept.bbox) return sameName;
      return beliefBboxIou(
        det.bbox as [number, number, number, number],
        kept.bbox as [number, number, number, number],
      ) >= 0.28;
    });
    if (idx < 0) {
      out.push(det);
      continue;
    }
    // Keep the higher-confidence / more specific label.
    const kept = out[idx];
    out[idx] = (det.confidence || 0) > (kept.confidence || 0) ? det : kept;
  }
  return out;
}

type LiveParams = {
  occasionType?: string;
};

type NavParamList = {
  LiveStylist: LiveParams | undefined;
  ScanWardrobe: undefined;
  Subscription: {
    highlightPlan?: string;
    scrollToAiTopUp?: boolean;
  } | undefined;
  SanityCheck: undefined;
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
  const cameraReadyRef = useRef(false);

  const occasionType = route.params?.occasionType || 'casual_day';
  const yoloStatus = getOnDeviceYoloStatus();
  const tier = normalizeSubscriptionTier(user?.subscriptionTier);

  const [isLive, setIsLive] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [layout, setLayout] = useState({ width: Dimensions.get('window').width, height: 480 });
  const [items, setItems] = useState<LiveTrackedItem[]>([]);
  const [feedback, setFeedback] = useState<LiveFeedback | null>(null);
  /** Hide garment name labels until identity locks — boxes may still paint. */
  const [labelsReady, setLabelsReady] = useState(false);
  const labelsReadyRef = useRef(false);
  const [sourceLabel, setSourceLabel] = useState('Cloud vision');
  const [selected, setSelected] = useState<LiveTrackedItem | null>(null);
  const [shopHints, setShopHints] = useState<FallbackMissingItem[]>([]);
  const [statusNote, setStatusNote] = useState('Tap Start for live styling');
  // Belief debug is staff/__DEV__ only — App Store subscribers never see the overlay or DBG chip.
  const beliefDebugAllowed = __DEV__ || isStaffUser(user);
  const [showBeliefDebug, setShowBeliefDebug] = useState(() => __DEV__);
  const [debugCollapsed, setDebugCollapsed] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<LiveBeliefDebugSnapshot>(() => emptyDebugSnapshot());
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  /** Prefer server tier from the 429 usage snapshot over cached Auth. */
  const [budgetPlanTier, setBudgetPlanTier] = useState<string | null>(null);

  // Staff status resolves after the first render, so the overlay cannot be
  // seeded from initial state — open it once, then leave the toggle to the user.
  const staffDebugPrimed = useRef(false);
  useEffect(() => {
    if (!beliefDebugAllowed) {
      if (showBeliefDebug) setShowBeliefDebug(false);
      return;
    }
    if (staffDebugPrimed.current) return;
    staffDebugPrimed.current = true;
    setShowBeliefDebug(true);
  }, [beliefDebugAllowed, showBeliefDebug]);

  const lastHashRef = useRef<string | null>(null);
  const previousItemsRef = useRef<LiveTrackedItem[]>([]);
  const previousFeedbackRef = useRef<LiveFeedback | null>(null);
  /** Newest-first seasonal layer tip ids — soft anti-repeat across the session. */
  const recentLayerTipIdsRef = useRef<string[]>([]);
  const detectionMemoryRef = useRef<DetectionMemory>(createLiveBeliefMemory());
  const decisionLogRef = useRef<BeliefDecision[]>([]);
  const inspectRef = useRef<ReturnType<typeof inspectDetection> | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  /** Prevents double-tap / overlapping Start Live init. */
  const startingLiveRef = useRef(false);
  /** Imperative sample loop — never restart from useEffect([isLive, processFrame]). */
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleBootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processFrameRef = useRef<() => Promise<void>>(async () => {});
  const lastCoachShownAtRef = useRef(0);
  const lastCloudFillAtRef = useRef(0);
  const cloudSceneBaselineRef = useRef<{
    detections: OnDeviceDetection[];
    frameHash: string | null;
  }>({ detections: [], frameHash: null });
  const sceneChangeStreakRef = useRef(0);
  const lastBeliefSignatureRef = useRef('');
  const scoreGateRef = useRef(createLiveScoreGate());
  const identityBufRef = useRef<LiveIdentitySample[]>([]);
  /** Last *core* identity (bottom|shoe) that locked — piece-set flicker must not reset this. */
  const identityLockedKeyRef = useRef<string | null>(null);
  /** Wall clock when footwear belief went empty while feet look searchable. */
  const noFootwearSinceRef = useRef<number>(0);
  const certaintySmoothRef = useRef(createCertaintySmoothState());
  const outfitTruthRef = useRef<LiveOutfitTruth | null>(null);
  const warmTruthRef = useRef<WarmTruthStash | null>(null);
  const filledOnceRef = useRef<{ top?: boolean; layer?: boolean; bottom?: boolean }>({});
  /** Suspect signatures already escalated — ask Vision once, not every frame. */
  const suspectAskedRef = useRef(new Set<string>());

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
    if (mem.belief?.top) filledOnceRef.current.top = true;
    if (mem.belief?.layer) filledOnceRef.current.layer = true;
    if (mem.belief?.bottom) filledOnceRef.current.bottom = true;
    setDebugSnapshot(
      buildDebugSnapshot({
        belief: mem.belief,
        filledOnce: { ...filledOnceRef.current },
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

  const stopSamplingLoop = useCallback(() => {
    if (sampleBootTimerRef.current) {
      clearTimeout(sampleBootTimerRef.current);
      sampleBootTimerRef.current = null;
    }
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void warmUpOnDeviceYolo().catch(() => {});
    return () => {
      mountedRef.current = false;
      startingLiveRef.current = false;
      stopSamplingLoop();
    };
  }, [stopSamplingLoop]);

  const handleAiBudgetHit = useCallback((err?: unknown) => {
    if (!mountedRef.current) return;
    const serverTier = planTierFromBudgetError(err);
    const effective = serverTier || tier;
    setBudgetPlanTier(effective);
    stopSamplingLoop();
    startingLiveRef.current = false;
    setIsLive(false);
    setShowBudgetModal(true);
    setStatusNote(
      isTopTier(effective)
        ? (t('live.budgetModal.statusNoteTop') || 'Monthly AI allowance used — resets next month')
        : (t('live.budgetModal.statusNote') || 'Monthly AI allowance used — upgrade or wait until next month'),
    );
  }, [t, tier, stopSamplingLoop]);

  const openSubscription = useCallback(() => {
    setShowBudgetModal(false);
    stopSamplingLoop();
    startingLiveRef.current = false;
    setIsLive(false);
    const plan = normalizeSubscriptionTier(budgetPlanTier || tier);
    const highlightPlan = plan === 'free'
      ? 'personal_stylist'
      : plan === 'personal_stylist'
        ? 'stylist_unlimited'
        : undefined;
    leaveLiveAndNavigate(navigation, { kind: 'subscription', highlightPlan });
  }, [navigation, budgetPlanTier, tier, stopSamplingLoop]);

  const openAiTopUp = useCallback(() => {
    setShowBudgetModal(false);
    stopSamplingLoop();
    startingLiveRef.current = false;
    setIsLive(false);
    leaveLiveAndNavigate(navigation, {
      kind: 'subscription',
      scrollToAiTopUp: true,
    });
  }, [navigation, stopSamplingLoop]);

  const openSanityCheck = useCallback(() => {
    setShowBudgetModal(false);
    stopSamplingLoop();
    startingLiveRef.current = false;
    setIsLive(false);
    leaveLiveAndNavigate(navigation, { kind: 'sanity' });
  }, [navigation, stopSamplingLoop]);

  const applyResponse = useCallback((res: LiveFrameResponse) => {
    if (!mountedRef.current) return null;

    const footZone = getLastOnDeviceFootZone();

    // Always run server/cloud labels through belief — never paint raw frame truth.
    // Cloud path intentionally skips client hybrid; updateLiveBelief is the single mutation entry.
    if (res.items?.length) {
      const raw = liveItemsToDetections(res.items);
      const hasShoe = raw.some((d) => roleOfCategory(d.category, d.subcategory) === 'footwear');
      const hasTop = raw.some((d) => roleOfCategory(d.category, d.subcategory) === 'top');
      const hasBottom = raw.some((d) => roleOfCategory(d.category, d.subcategory) === 'bottom');
      // Vision frame with outfit but no shoes + feet in frame → clear ghost footwear now
      const visionExplicitBarefoot = Boolean(
        (String(res.source || '').includes('cloud') || String(res.source || '').includes('vision'))
        && hasTop
        && hasBottom
        && !hasShoe
        && footZone
        && !footZone.cropped,
      );
      const stabilized = updateLiveBelief(raw, detectionMemoryRef.current, {
        decisions: decisionLogRef.current,
        bottomBandBrightness: footZone?.brightness,
        occasionType,
        forceClearFootwear: visionExplicitBarefoot,
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
    if (!baseFeedback) return null;

    // Soft shoe-style nudge only when real shoes already in belief (never invent)
    const next = { ...baseFeedback };
    const shoeScore = detectionMemoryRef.current.lastShoeScore;
    if (shoeScore && detectionMemoryRef.current.belief?.footwear) {
      const delta = shoeStyleScoreDelta(shoeScore);
      if (delta !== 0) {
        next.score = Math.max(0, Math.min(100, Math.round((next.score || 0) + delta)));
      }
    }
    // Hold the score until identity is stable. Force-adopting warmup scores
    // (dark shorts → 40 Mixed weights) is worse than a longer dash.
    const beliefSlots = detectionMemoryRef.current.belief;
    const memNow = Date.now();
    const footZoneMem = detectionMemoryRef.current.lastFootZone;
    if (beliefSlots?.footwear) {
      noFootwearSinceRef.current = 0;
    } else if (beliefSlots?.bottom) {
      // Bottom present, still no shoes — keep searching timer even if foot-zone
      // diagnostics flicker (resetting here caused eternal "—" while Searching…).
      if (!noFootwearSinceRef.current) noFootwearSinceRef.current = memNow;
    } else {
      noFootwearSinceRef.current = 0;
    }
    const searchingBarefootTimeout = Boolean(
      !beliefSlots?.footwear
      && beliefSlots?.bottom
      && noFootwearSinceRef.current
      && (memNow - noFootwearSinceRef.current) >= SEARCHING_BAREFOOT_MS,
    );
    // No footwear belief + feet not cropped → barefoot identity (unlocks score/labels).
    // Without this, barefoot outfits stay on "—" forever even when top+bottom lock.
    const barefootIdentity = Boolean(
      !beliefSlots?.footwear
      && (
        memNow < (detectionMemoryRef.current.footwearBlockedUntil || 0)
        || searchingBarefootTimeout
        || (footZoneMem && !footZoneMem.cropped)
        || detectionMemoryRef.current.lastFootwearCandidates?.some(
          (c) => c.rejectReason === 'barefoot',
        )
      ),
    );
    const shoeSubtype = beliefSlots?.footwear?.subcategory
      || (barefootIdentity ? 'barefoot' : null);
    const pieceSet = livePieceSetKey({
      topSub: beliefSlots?.top?.subcategory,
      topKind: beliefSlots?.top?.kind,
      layerSub: beliefSlots?.layer?.subcategory,
      layerKind: beliefSlots?.layer?.kind,
    });
    identityBufRef.current = pushLiveIdentitySample(identityBufRef.current, {
      // Prefer subtype so athletic_shorts ↔ chino_shorts invalidates score.
      // Kind alone is just "shorts" and hid the QA 9 Aug score freeze.
      bottomKind: beliefSlots?.bottom?.subcategory
        || beliefSlots?.bottom?.kind
        || null,
      shoeSubtype,
      topKind: beliefSlots?.top?.kind || beliefSlots?.layer?.kind || null,
      pieceSet,
      bottomConfidence: beliefSlots?.bottom?.confidence ?? beliefSlots?.bottom?.stability ?? null,
      shoeConfidence: beliefSlots?.footwear?.confidence
        ?? beliefSlots?.footwear?.stability
        ?? (barefootIdentity ? 0.95 : null),
      topConfidence: (beliefSlots?.top || beliefSlots?.layer)?.confidence
        ?? (beliefSlots?.top || beliefSlots?.layer)?.stability
        ?? null,
    });
    const tipSample = identityBufRef.current[identityBufRef.current.length - 1];
    const coreKey = liveCoreIdentityKey(tipSample);
    const fullKey = liveIdentityKey(tipSample);
    const prevLockedKey = identityLockedKeyRef.current;
    const identityLocked = liveIdentityIsConsistent(identityBufRef.current, {
      prevLockedKey,
    });
    // Core slots settle for scoring; piece-set versions the score after publish.
    // Barefoot: do not require a footwear belief slot to settle.
    const settled = liveOutfitReadyToScore({
      slots: barefootIdentity
        ? [beliefSlots?.bottom]
        : [beliefSlots?.bottom, beliefSlots?.footwear],
      identityBuf: identityBufRef.current,
      prevLockedKey,
    });
    // Labels must never wait on score lock — blank BBoxes while DBG sees pieces
    // is the 60s trust-breaker. Paint as soon as belief has garments.
    const hasPaintableBelief = Boolean(
      beliefSlots?.bottom
      || beliefSlots?.top
      || beliefSlots?.layer
      || beliefSlots?.footwear
      || previousItemsRef.current.length,
    );
    if (hasPaintableBelief) {
      if (!labelsReadyRef.current) {
        labelsReadyRef.current = true;
        if (mountedRef.current) setLabelsReady(true);
      }
    }
    if (identityLocked && coreKey) {
      identityLockedKeyRef.current = coreKey;
    }
    const nowMs = Date.now();
    const certaintyRaw = liveJudgmentCertainty({
      identityBuf: identityBufRef.current,
      prevLockedKey,
      coreReady: settled,
    });
    const smoothed = smoothLiveCertainty(
      certaintySmoothRef.current,
      certaintyRaw,
      nowMs,
    );
    certaintySmoothRef.current = smoothed.state;
    const certainty = smoothed.certainty;
    // Core = bottom + shoe/barefoot only. Top/layer flicker must not block publish.
    const coreFilled = Boolean(
      beliefSlots?.bottom
      && (beliefSlots?.footwear || barefootIdentity),
    );
    const gated = gateLiveScore(
      scoreGateRef.current,
      next.score,
      {
        signature: liveScoreSignature(previousItemsRef.current.map((it) => ({
          category: String(it.category || ''),
          subcategory: it.subcategory,
          color: it.color,
        }))),
        now: nowMs,
        settled,
        identityLocked,
        coreFilled,
        // Always pass key so athletic↔chino / loafers on/off can invalidate.
        identityKey: fullKey || coreKey || null,
        certainty,
      },
    );
    scoreGateRef.current = gated.gate;
    next.score = gated.score;
    next.confidenceLevel = certainty === 'high' ? 'high' : 'medium';

    // Freeze the arbitrated outfit into one truth object. Score is already
    // gated; coaching only injects names — neither recomputes meaning here.
    const prevTruth = outfitTruthRef.current;
    const truth = buildOutfitTruth({
      belief: detectionMemoryRef.current.belief,
      feedback: next,
      prev: prevTruth,
      confidenceLevel: next.confidenceLevel,
    });
    outfitTruthRef.current = truth;

    // SSOT: material outfit change (e.g. athletic↔chino) invalidates stale judgment.
    if (truthMateriallyChanged(prevTruth, truth) && !settled && next.score != null) {
      next.score = null;
      scoreGateRef.current = {
        ...scoreGateRef.current,
        shown: null,
        pending: null,
        scoredIdentityKey: null,
        heldSince: null,
        signature: truth.signature,
      };
    }

    // Belief-synced summary when Vision returned items; else keep Vision verdict (UK-polished).
    if (next.coaching && res.items?.length && previousItemsRef.current.length) {
      next.coaching = syncCoachingToBelief(
        next.coaching,
        previousItemsRef.current.map((it) => ({
          name: it.name,
          category: String(it.category || ''),
          subcategory: it.subcategory,
          color: it.color,
        })),
        { score: next.score },
      ) || next.coaching;
    } else if (next.coaching) {
      next.coaching = polishUkCoaching(next.coaching) || next.coaching;
    }
    if (next.coaching) {
      next.coaching = alignCoachingToTruth(next.coaching, truth) || next.coaching;
      next.coaching = enforceLiveOutcomeContract(next.coaching, next.score, {
        certainty: certainty === 'none' ? 'medium' : certainty,
      }) || next.coaching;
    }
    // Hard publish rule: no score → no judgment copy (summary / bullets / tips).
    if (next.score == null) {
      next.coaching = gateLiveJudgment(next.coaching, null) || next.coaching;
      next.hints = [];
      next.suggestions = [];
      next.confidenceLevel = undefined;
    }

    const holdMs = next.ui?.holdMs ?? 1000;
    const withinHold = Date.now() - lastCoachShownAtRef.current < holdMs;
    const serverStable = Boolean(next.ui?.stable);
    const hadFeedback = Boolean(previousFeedbackRef.current);
    const scoreJump = Math.abs(
      Number(previousFeedbackRef.current?.score || 0) - Number(next.score || 0),
    ) >= 8;
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
    // A settled outfit changes nothing else, so the frame that finally releases
    // the held score must repaint on its own or the badge keeps showing a dash.
    const scoreRevealed = previousFeedbackRef.current?.score == null && next.score != null;

    if (
      res.feedbackChanged || !hadFeedback || coachChanged || piecesChanged
      || beliefChanged || scoreRevealed
    ) {
      previousFeedbackRef.current = next;
      // Flush coaching when belief labels change — boxes and copy must stay in sync
      const shouldPaint = !hadFeedback || !serverStable || scoreJump || !withinHold
        || coachChanged || piecesChanged || beliefChanged || scoreRevealed
        || Boolean(res.feedbackChanged);
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
    // Footer must show the same gated number as the score badge — never the
    // raw server score that is still being corroborated.
    return {
      score: next.score,
      itemCount: res.itemCount,
      confidenceLevel: next.confidenceLevel,
    };
  }, [beliefSignature, occasionType, publishDebug]);

  const processFrame = useCallback(async () => {
    if (!cameraRef.current || !cameraReadyRef.current || inFlightRef.current || !mountedRef.current) return;
    inFlightRef.current = true;
    setIsBusy(true);
    try {
      let photo: { uri?: string } | undefined;
      try {
        photo = await cameraRef.current.takePictureAsync({
          quality: 0.45,
          shutterSound: false,
          skipProcessing: Platform.OS === 'android',
        });
      } catch (camErr) {
        console.warn('[LiveStylist] takePictureAsync failed:', camErr);
        setStatusNote('Camera busy — hold steady');
        return;
      }
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

      let onDevice: Awaited<ReturnType<typeof detectGarmentsOnDevice>> = null;
      try {
        onDevice = await detectGarmentsOnDevice(manipulated.uri);
      } catch (yoloErr) {
        console.warn('[LiveStylist] on-device detect failed:', yoloErr);
        onDevice = null;
      }
      const payload: Record<string, unknown> = {
        occasionType,
        hybridMatch: true,
        frameHash,
        previousItems: previousItemsRef.current,
        previousFeedback: previousFeedbackRef.current,
        recentLayerTipIds: recentLayerTipIdsRef.current.slice(0, 8),
        month: new Date().getMonth() + 1,
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
        const baseline = cloudSceneBaselineRef.current;
        if (!baseline.detections.length) {
          cloudSceneBaselineRef.current = {
            detections: corrected,
            frameHash,
          };
        }
        const sceneChanged = hasMeaningfulLiveSceneChange(
          baseline.detections,
          corrected,
          baseline.frameHash,
          frameHash,
        );
        sceneChangeStreakRef.current = sceneChanged
          ? sceneChangeStreakRef.current + 1
          : 0;
        // Missing top/shoes → fill after 2s; otherwise sparse frames after 4s
        const fillMs = (missingTop || missingShoes) ? 2000 : 4000;
        const cloudFillReady = Date.now() - lastCloudFillAtRef.current >= fillMs;
        const sceneEventReady =
          Date.now() - lastCloudFillAtRef.current >= CLOUD_SCENE_EVENT_COOLDOWN_MS;
        const sceneEventDue =
          sceneChangeStreakRef.current >= CLOUD_SCENE_EVENT_FRAMES && sceneEventReady;
        const layerVerifyDue = Date.now() - lastCloudFillAtRef.current >= CLOUD_LAYER_VERIFY_MS;
        // A read that contradicts itself (shorts label on a full-leg box, no
        // defensible colour) escalates now instead of waiting for a verify pass.
        const suspect = detectSuspectLiveRead(stabilized.detections);
        const suspectDue = Boolean(
          suspect
          && !suspectAskedRef.current.has(suspect.signature)
          && Date.now() - lastCloudFillAtRef.current >= CLOUD_SUSPECT_COOLDOWN_MS,
        );
        if ((incomplete && cloudFillReady) || suspectDue || sceneEventDue || layerVerifyDue) {
          payload.imageBase64 = stripBase64Prefix(base64);
          payload.cloudFill = true;
          payload.cloudFillReason = incomplete
            ? 'missing_slots'
            : suspectDue
              ? 'suspect_read'
              : sceneEventDue
                ? 'scene_change'
                : 'layer_verify';
          if (suspectDue && suspect) {
            payload.suspectReason = suspect.reason;
            suspectAskedRef.current.add(suspect.signature);
          }
          lastCloudFillAtRef.current = Date.now();
          sceneChangeStreakRef.current = 0;
          cloudSceneBaselineRef.current = {
            detections: corrected,
            frameHash,
          };
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
      const painted = applyResponse(res);
      const tipId = res.feedback?.coaching?.layerTipId;
      if (tipId && recentLayerTipIdsRef.current[0] !== tipId) {
        recentLayerTipIdsRef.current = [tipId, ...recentLayerTipIdsRef.current].slice(0, 8);
      }
      // Footer must match the score badge — never leak the ungated Vision number.
      const shownScore = painted?.score ?? scoreGateRef.current.shown ?? null;
      const scoreLabel = presentLiveScore(
        shownScore,
        painted?.confidenceLevel
          || previousFeedbackRef.current?.confidenceLevel
          || 'high',
      ).display;
      setStatusNote(
        res.itemCount
          ? `${res.itemCount} piece${res.itemCount === 1 ? '' : 's'} · ${scoreLabel}`
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

  // Keep latest processFrame for the imperative sample loop (stable identity).
  processFrameRef.current = processFrame;

  const startSamplingLoop = useCallback(() => {
    stopSamplingLoop();
    // Camera must be ready before takePictureAsync — native crash otherwise.
    const tick = () => {
      if (!mountedRef.current) return;
      void processFrameRef.current();
    };
    const arm = () => {
      if (!mountedRef.current) return;
      if (!cameraReadyRef.current || !cameraRef.current) {
        sampleBootTimerRef.current = setTimeout(arm, 250);
        return;
      }
      sampleBootTimerRef.current = null;
      tick();
      sampleIntervalRef.current = setInterval(tick, SAMPLE_INTERVAL_MS);
    };
    // Brief settle after UI flips to Live — avoids camera+render race on tap.
    sampleBootTimerRef.current = setTimeout(arm, 500);
  }, [stopSamplingLoop]);

  const waitForCameraReady = useCallback(async (timeoutMs = 4000): Promise<boolean> => {
    if (cameraReadyRef.current && cameraRef.current) return true;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (!mountedRef.current) return false;
      if (cameraReadyRef.current && cameraRef.current) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    // Some devices never re-fire onCameraReady if preview was already warm.
    if (cameraRef.current) {
      cameraReadyRef.current = true;
      return true;
    }
    return false;
  }, []);

  /** Reset session refs + minimal UI. Call only after camera/model are ready. */
  const resetLiveSessionState = useCallback(() => {
    const warm = warmTruthRef.current;
    const now = Date.now();
    if (canWarmStartTruth(warm, now) && warm) {
      detectionMemoryRef.current = createLiveBeliefMemory();
      const seeded = updateLiveBelief(warm.truth.seedDetections, detectionMemoryRef.current, {
        now,
        decisions: [],
      });
      detectionMemoryRef.current = seeded.memory;
      decisionLogRef.current = [];
      inspectRef.current = null;
      lastHashRef.current = null;
      lastCloudFillAtRef.current = 0;
      cloudSceneBaselineRef.current = { detections: [], frameHash: null };
      sceneChangeStreakRef.current = 0;
      scoreGateRef.current = createLiveScoreGate();
      const b = detectionMemoryRef.current.belief;
      const sample = warm.truth.isStable
        && b?.bottom?.kind
        && b?.footwear?.subcategory
        ? {
          bottomKind: String(b.bottom.kind),
          shoeSubtype: String(b.footwear.subcategory),
          topKind: String(b.top?.kind || b.layer?.kind || ''),
          bottomConfidence: Number(b.bottom.confidence || b.bottom.stability || 0.9),
          shoeConfidence: Number(b.footwear.confidence || b.footwear.stability || 0.9),
          topConfidence: Number(
            (b.top || b.layer)?.confidence
            || (b.top || b.layer)?.stability
            || 0.9,
          ),
        }
        : null;
      identityBufRef.current = sample ? [sample, sample, sample] : [];
      identityLockedKeyRef.current = sample ? liveCoreIdentityKey(sample) : null;
      labelsReadyRef.current = Boolean(sample);
      const warmConf = warm.truth.confidenceLevel || 'high';
      certaintySmoothRef.current = warmConf === 'high'
        ? { lastRaw: 'high', streak: LIVE_CERTAINTY_UPGRADE_STREAK, displayed: 'high' }
        : { lastRaw: 'medium', streak: 1, displayed: 'medium' };
      if (warm.truth.score != null) {
        const warmIdentity = identityLockedKeyRef.current;
        scoreGateRef.current = {
          shown: warm.truth.score,
          pending: null,
          signature: liveScoreSignature(warm.truth.seedDetections.map((d) => ({
            category: d.category,
            subcategory: d.subcategory,
            color: d.color,
          }))),
          heldSince: null,
          scoredIdentityKey: warmIdentity,
        };
      }
      suspectAskedRef.current = new Set<string>();
      filledOnceRef.current = {
        top: Boolean(warm.truth.top),
        layer: Boolean(warm.truth.layer),
        bottom: Boolean(warm.truth.bottom),
      };
      previousItemsRef.current = [];
      outfitTruthRef.current = warm.truth;
      previousFeedbackRef.current = warm.truth.score != null
        ? {
          score: warm.truth.score,
          confidenceLevel: warm.truth.confidenceLevel || 'high',
          issues: [],
          hints: [],
          suggestions: [],
          coaching: {
            headline: '',
            summary: '',
            bullets: [],
            styleLane: warm.truth.lane,
            hasConflict: false,
            sameLane: true,
          },
        }
        : null;
      warmTruthRef.current = null;
      setLabelsReady(Boolean(sample));
      setFeedback(previousFeedbackRef.current);
      paintBeliefItems(warm.truth.seedDetections || []);
      setDebugSnapshot(emptyDebugSnapshot('live_warm'));
    } else {
      detectionMemoryRef.current = createLiveBeliefMemory();
      decisionLogRef.current = [];
      inspectRef.current = null;
      lastHashRef.current = null;
      lastCloudFillAtRef.current = 0;
      cloudSceneBaselineRef.current = { detections: [], frameHash: null };
      sceneChangeStreakRef.current = 0;
      scoreGateRef.current = createLiveScoreGate();
      identityBufRef.current = [];
      identityLockedKeyRef.current = null;
      noFootwearSinceRef.current = 0;
      labelsReadyRef.current = false;
      certaintySmoothRef.current = createCertaintySmoothState();
      suspectAskedRef.current = new Set<string>();
      filledOnceRef.current = {};
      outfitTruthRef.current = null;
      previousItemsRef.current = [];
      previousFeedbackRef.current = null;
      recentLayerTipIdsRef.current = [];
      warmTruthRef.current = null;
      setLabelsReady(false);
      setItems([]);
      setFeedback(null);
      setDebugSnapshot(emptyDebugSnapshot('live'));
    }
  }, [paintBeliefItems]);

  const pauseLiveSession = useCallback(() => {
    stopSamplingLoop();
    startingLiveRef.current = false;
    try {
      warmTruthRef.current = stashWarmTruth(outfitTruthRef.current);
    } catch {
      warmTruthRef.current = null;
    }
    setIsLive(false);
    setStatusNote('Paused');
  }, [stopSamplingLoop]);

  const toggleLive = async () => {
    console.log('[LiveStylist] START LIVE PRESSED', { isLive, starting: startingLiveRef.current });
    try {
      if (isLive) {
        pauseLiveSession();
        return;
      }
      if (startingLiveRef.current) {
        console.log('[LiveStylist] start ignored — already starting');
        return;
      }
      startingLiveRef.current = true;
      setStatusNote('Starting…');

      // 1) Permissions
      console.log('[LiveStylist] 1. permissions');
      if (!permission?.granted) {
        const next = await requestPermission();
        if (!next.granted) {
          startingLiveRef.current = false;
          Alert.alert(
            t('wardrobe.permissionRequired') || 'Permission Required',
            t('wardrobe.cameraAccessWasDeniedPleaseEnableItInSet') || 'Enable camera in Settings.',
            [
              { text: t('common.cancel') || 'Cancel', style: 'cancel' },
              { text: t('common.openSettings') || 'Settings', onPress: () => Linking.openSettings() },
            ],
          );
          setStatusNote('Camera permission needed');
          return;
        }
      }

      // 2) Camera must be ready before any capture / live UI flip
      console.log('[LiveStylist] 2. wait camera ready');
      const camOk = await waitForCameraReady(4000);
      if (!camOk || !mountedRef.current) {
        startingLiveRef.current = false;
        setStatusNote('Camera not ready — try again');
        return;
      }

      // 3) Warm YOLO (safe no-op if missing) BEFORE flipping isLive
      console.log('[LiveStylist] 3. warm vision model');
      try {
        await warmUpOnDeviceYolo();
      } catch (warmErr) {
        console.warn('[LiveStylist] YOLO warm failed (continuing cloud-only):', warmErr);
      }

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        /* optional */
      }

      if (!mountedRef.current) {
        startingLiveRef.current = false;
        return;
      }

      // 4) Reset session, then flip live, then arm sample loop (sequential)
      console.log('[LiveStylist] 4. reset + setIsLive');
      resetLiveSessionState();
      setStatusNote('Live — sampling…');
      setIsLive(true);
      startSamplingLoop();
      console.log('[LiveStylist] 5. start armed');
      startingLiveRef.current = false;
    } catch (err) {
      console.warn('[LiveStylist] toggleLive failed:', err);
      startingLiveRef.current = false;
      stopSamplingLoop();
      setIsLive(false);
      setStatusNote('Could not start live — try again');
    }
  };

  const openStillScan = useCallback(async () => {
    if (!cameraRef.current || !cameraReadyRef.current || inFlightRef.current || !mountedRef.current) return;
    stopSamplingLoop();
    startingLiveRef.current = false;
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
        recentLayerTipIds: recentLayerTipIdsRef.current.slice(0, 8),
        month: new Date().getMonth() + 1,
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
      const tipId = res.feedback?.coaching?.layerTipId;
      if (tipId && recentLayerTipIdsRef.current[0] !== tipId) {
        recentLayerTipIdsRef.current = [tipId, ...recentLayerTipIdsRef.current].slice(0, 8);
      }
      const stillScore = scoreGateRef.current.shown
        ?? previousFeedbackRef.current?.score
        ?? null;
      setStatusNote(
        res.itemCount
          ? `Still · ${res.itemCount} piece${res.itemCount === 1 ? '' : 's'} · ${presentLiveScore(stillScore).display}`
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
  }, [applyResponse, handleAiBudgetHit, occasionType, publishDebug, stopSamplingLoop]);

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
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={() => {
            cameraReadyRef.current = true;
          }}
        />
        <LiveArOverlay
          width={layout.width}
          height={layout.height}
          items={items}
          feedback={feedback}
          selectedTrackId={selected?.trackId}
          showRegionGuides={beliefDebugAllowed && showBeliefDebug}
          showLabels={labelsReady}
          onSelectItem={(item) => {
            Haptics.selectionAsync();
            setSelected(item);
            if (beliefDebugAllowed && item.bbox) {
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
        {beliefDebugAllowed && showBeliefDebug ? (
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
            onLongPress={beliefDebugAllowed ? () => {
              Haptics.selectionAsync();
              setShowBeliefDebug((v) => !v);
            } : undefined}
            delayLongPress={450}
            style={{ flex: 1 }}
          >
            <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {sourceLabel} · {statusNote}
            </ThemedText>
          </Pressable>
          {beliefDebugAllowed ? (
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
          ) : null}
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
