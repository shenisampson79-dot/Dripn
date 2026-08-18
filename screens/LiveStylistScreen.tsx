/**
 * Live Stylist — VisionCamera frame-output only + AR overlays.
 * Expo CameraView removed from Live; requires an EAS binary with
 * vision-camera-worklets. On-device YOLO TFLite when linked; else cloud Vision.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  InteractionManager,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { LiveArOverlay } from '@/components/live/LiveArOverlay';
import { LiveVisionCameraGate } from '@/components/live/LiveVisionCameraGate';
import type { LiveVisionCameraHandle } from '@/components/live/LiveVisionCamera';
import { isVisionCameraLinked } from '@/utils/visionCameraAvailability';
import { LiveBeliefDebugOverlay } from '@/components/live/LiveBeliefDebugOverlay';
import { LiveAiBudgetModal, isAiBudgetError, planTierFromBudgetError } from '@/components/live/LiveAiBudgetModal';
import { FallbackShopSection, type FallbackMissingItem } from '@/components/stylist/FallbackShopSection';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/ApiService';
import { getAiAllowancePaywallCopy } from '@/utils/aiBudgetError';
import { isStaffUser } from '@/utils/staffAccess';
import {
  diagnoseYoloFromRgba,
  diagnoseYoloReferenceAsset,
  detectGarmentsFromRgba,
  formatGuardDecisionHud,
  getLastOnDeviceFootZone,
  type YoloDetectorDiag,
} from '@/services/onDeviceGarmentDetector';
import type { LiveFeedback, LiveFrameResponse, LiveTrackedItem } from '@/types/liveStylist';
import {
  framesLikelySame,
  hasMeaningfulLiveSceneChange,
} from '@/utils/liveFrameHash';
import {
  encodeRgbaToJpegBase64,
  hashRgbaFrame,
  imageToLiveRgba,
  sampleNonZeroPixels,
} from '@/utils/liveFrameBuffer';
import type { Image } from 'react-native-nitro-image';
import {
  createLiveBeliefMemory,
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
import { renderCopyFromPublishedTruth } from '@/utils/livePublishedCopy';
import {
  adoptCloudIdentityIntoBelief,
  blankProvisionalHeadlineAfterScore,
  customerBoxesFromPublishedTruth,
  detectionsForCustomerPaint,
  hasPublishedLiveCore,
  isProvisionalLiveHeadline,
  LIVE_YOLO_ENABLED,
  liveCloudPathBlockedByYoloProof,
  mapYoloBoxesOntoPublishedTruth,
  sanitizeLiveBoxLabel,
  sanitizeLiveUserHudText,
} from '@/utils/livePublishedIdentity';
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
  isHighConfidenceCompleteCloudRead,
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
  type LiveOutfitTruth,
  type WarmTruthStash,
} from '@/utils/liveOutfitTruth';
import { enforceLiveOutcomeContract } from '@/utils/liveOutcomeContract';

/** Hard ceiling for camera mount/ready — never leave "warming" forever. */
const CAMERA_READY_TIMEOUT_MS = 8000;

type LiveSessionState = 'idle' | 'starting' | 'camera-loading' | 'live' | 'error';

/** Survives process death — next Live open shows last Start step if we crashed. */
const LIVE_START_CRUMB_KEY = '@dripn_live_start_crumb';

async function liveStartCrumb(step: string) {
  console.log(`[LiveStylist] ${step}`);
  try {
    await AsyncStorage.setItem(LIVE_START_CRUMB_KEY, `${Date.now()}|${step}`);
  } catch {
    /* ignore */
  }
}

/** High-frequency frame stages — log to console always; persist at most ~1/s. */
let lastPipelinePersistAt = 0;
async function livePipelineCrumb(step: string) {
  console.log(`[LivePipeline] ${step}`);
  const now = Date.now();
  if (now - lastPipelinePersistAt < 1000) return;
  lastPipelinePersistAt = now;
  try {
    await AsyncStorage.setItem(LIVE_START_CRUMB_KEY, `${now}|${step}`);
  } catch {
    /* ignore */
  }
}

async function readLiveStartCrumb(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LIVE_START_CRUMB_KEY);
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const FRAME_WIDTH = 640;
/**
 * Launch path (frozen):
 *   camera frame proven → Cloud Vision → published identity → score → copy
 * YOLO is fully disabled. Belief may only hold/correct Cloud truth.
 */
const LIVE_REQUIRE_PIPELINE_PROOF = true;
const LIVE_PIPELINE_PROOF_ONLY = false;
const PIPELINE_PROOF_STREAK = 3;
/** Kept for the dormant YOLO diag block — launch never enters it. */
const LIVE_REQUIRE_YOLO_PROOF = false;
const LIVE_YOLO_PROOF_ONLY = false;
const YOLO_PROOF_STREAK = 3;
/** Keep REF JPEG result on the status line long enough to screenshot. */
const YOLO_REF_STICKY_MS = 4500;

function formatYoloDiagHud(diag: YoloDetectorDiag, tag: 'live' | 'ref'): string {
  const max = diag.rawOutput?.maxScore ?? 0;
  const nms = diag.counts.afterProdConfNms;
  const guards = diag.counts.afterBodyGuards;
  const rejects = diag.guardDecisions
    .filter((d) => d.outcome === 'REJECT')
    .map((d) => d.rejectReason?.split(' ')[0] || 'rej')
    .slice(0, 3)
    .join(',');
  return `${tag}:${diag.verdict} max=${max} nms=${nms} guard=${guards}${rejects ? ` rej=${rejects}` : ''}`;
}
/**
 * On-device YOLO has no outerwear class, so pulling a jacket on adds no box and
 * a filled belief looks complete indefinitely. Re-ask cloud Vision on this slow
 * cadence so a new layer is caught without paying per frame.
 */
const CLOUD_LAYER_VERIFY_MS = 12000;
/** Event-triggered cloud checks are throttled even when the scene keeps moving. */
/** ~3s keeps jacket put-on responsive without cloud-per-frame spend. */
const CLOUD_SCENE_EVENT_COOLDOWN_MS = 3000;
/** While first score is still unpublished, retry Cloud quickly — do not wait 3s. */
const CLOUD_FIRST_PUBLISH_RETRY_MS = 400;
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
      name: sanitizeLiveBoxLabel(d.name || ''),
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
  /** VisionCamera frame processors must be linked in the native binary (OTA insufficient). */
  const visionLinked = useRef(isVisionCameraLinked()).current;
  const visionCamRef = useRef<LiveVisionCameraHandle>(null);
  const cameraReadyRef = useRef(false);
  const liveStartedAtRef = useRef(0);

  const occasionType = route.params?.occasionType || 'casual_day';
  const tier = normalizeSubscriptionTier(user?.subscriptionTier);

  const [liveState, setLiveState] = useState<LiveSessionState>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const liveStateRef = useRef<LiveSessionState>('idle');
  liveStateRef.current = liveState;
  const isLive = liveState === 'live';
  const isBooting = liveState === 'starting' || liveState === 'camera-loading';
  const [isBusy, setIsBusy] = useState(false);
  const [layout, setLayout] = useState({ width: Dimensions.get('window').width, height: 480 });
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const sourceSizeRef = useRef({ width: 0, height: 0 });
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
  /** Stays true after dismissing the modal so Start live can't re-loop the same block. */
  const [budgetExhausted, setBudgetExhausted] = useState(false);
  /** Prefer server tier from the 429 usage snapshot over cached Auth. */
  const [budgetPlanTier, setBudgetPlanTier] = useState<string | null>(null);
  /** Defer VisionCamera until after navigation transition — mount-time camera init can native-kill. */
  const [cameraMounted, setCameraMounted] = useState(false);
  const [yoloStatusNote, setYoloStatusNote] = useState(
    'Camera starts when you tap Start live',
  );

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
  /** Bumped on stop/error so in-flight mount/ready waits abort cleanly. */
  const liveBootGenRef = useRef(0);
  const sampleBootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const samplingActiveRef = useRef(false);
  const processFrameRef = useRef<(image: Image) => Promise<void>>(async () => {});
  /** Last VisionCamera RGBA sample — Still scan + cloud fill reuse. */
  const lastFrameRgbaRef = useRef<{
    rgba: Uint8Array;
    width: number;
    height: number;
    hash: string;
  } | null>(null);
  /** One-shot waiter for Still scan when no last frame exists. */
  const stillFrameWaiterRef = useRef<((image: Image | null) => void) | null>(null);
  /** Delay on-device YOLO until after camera path is proven (native crash isolation). */
  const yoloEnabledAtRef = useRef(0);
  /** Wall clock when frame sampling is first allowed after Start. */
  const captureAllowedAtRef = useRef(0);
  const firstFrameLoggedRef = useRef(false);
  const firstDetectionLoggedRef = useRef(false);
  /** Only skip duplicate hashes after at least one successful liveScanFrame. */
  const analysisSucceededRef = useRef(false);
  /** Camera→RGBA proof gate — YOLO blocked until streak passes. */
  const pipelineProofStreakRef = useRef(0);
  const pipelineProvenRef = useRef(false);
  /** RGBA→YOLO proof gate — cloud/belief blocked until streak passes. */
  const yoloProofStreakRef = useRef(0);
  const yoloProvenRef = useRef(false);
  /** One-shot reference JPEG vs Live split test (Milestone 2b). */
  const yoloRefDiagDoneRef = useRef(false);
  const yoloRefVerdictRef = useRef<string | null>(null);
  const yoloLiveVerdictRef = useRef<string | null>(null);
  /** Hold REF status on HUD until this timestamp (ms). */
  const yoloRefStickyUntilRef = useRef(0);
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
  /** First Cloud JPEG must not wait on YOLO proof / detections. */
  const firstCloudSentRef = useRef(false);
  /** frame-proof → Cloud request → Cloud response → first score (ms). */
  const liveTimingRef = useRef<{
    provenAt: number;
    cloudReqAt: number;
    cloudResAt: number;
    publishedAt: number;
  }>({ provenAt: 0, cloudReqAt: 0, cloudResAt: 0, publishedAt: 0 });
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
    samplingActiveRef.current = false;
    if (sampleBootTimerRef.current) {
      clearTimeout(sampleBootTimerRef.current);
      sampleBootTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void liveStartCrumb('screen.mount');

    // Screen mount must stay cheap: NO VisionCamera, NO TFLite warm, NO YOLO status probe.
    // Camera mounts only after explicit Start Live / Still scan.
    void (async () => {
      const crumb = await readLiveStartCrumb();
      if (!mountedRef.current || !crumb) return;
      const step = crumb.includes('|') ? crumb.split('|').slice(1).join('|') : crumb;
      const ok = /^(idle|paused|frame\.ok|screen\.mount)$/i.test(step.trim());
      if (!ok) {
        setStatusNote(`Last Start step: ${step}`);
      }
      try {
        await AsyncStorage.removeItem(LIVE_START_CRUMB_KEY);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      mountedRef.current = false;
      startingLiveRef.current = false;
      liveBootGenRef.current += 1;
      stopSamplingLoop();
    };
  }, [stopSamplingLoop]);

  const unmountCamera = useCallback(() => {
    cameraReadyRef.current = false;
    setCameraMounted(false);
  }, []);

  const handleAiBudgetHit = useCallback((err?: unknown) => {
    if (!mountedRef.current) return;
    const serverTier = planTierFromBudgetError(err);
    const effective = serverTier || tier;
    setBudgetPlanTier(effective);
    stopSamplingLoop();
    startingLiveRef.current = false;
    liveBootGenRef.current += 1;
    setLiveState('idle');
    unmountCamera();
    setBudgetExhausted(true);
    setShowBudgetModal(true);
    setStatusNote(
      isTopTier(effective)
        ? (t('live.budgetModal.statusNoteTop') || 'Monthly AI allowance used — resets next month')
        : (t('live.budgetModal.statusNote') || 'Monthly AI allowance used — upgrade or wait until next month'),
    );
  }, [t, tier, stopSamplingLoop, unmountCamera]);

  const openSubscription = useCallback(() => {
    setShowBudgetModal(false);
    stopSamplingLoop();
    startingLiveRef.current = false;
    setLiveState('idle');
    unmountCamera();
    const plan = normalizeSubscriptionTier(budgetPlanTier || tier);
    const highlightPlan = plan === 'free'
      ? 'personal_stylist'
      : plan === 'personal_stylist'
        ? 'stylist_unlimited'
        : undefined;
    leaveLiveAndNavigate(navigation, { kind: 'subscription', highlightPlan });
  }, [navigation, budgetPlanTier, tier, stopSamplingLoop, unmountCamera]);

  const openAiTopUp = useCallback(() => {
    setShowBudgetModal(false);
    stopSamplingLoop();
    startingLiveRef.current = false;
    setLiveState('idle');
    unmountCamera();
    leaveLiveAndNavigate(navigation, {
      kind: 'subscription',
      scrollToAiTopUp: true,
    });
  }, [navigation, stopSamplingLoop, unmountCamera]);

  const openSanityCheck = useCallback(() => {
    setShowBudgetModal(false);
    stopSamplingLoop();
    startingLiveRef.current = false;
    setLiveState('idle');
    unmountCamera();
    leaveLiveAndNavigate(navigation, { kind: 'sanity' });
  }, [navigation, stopSamplingLoop, unmountCamera]);

  const applyResponse = useCallback((res: LiveFrameResponse) => {
    if (!mountedRef.current) return null;

    const footZone = getLastOnDeviceFootZone();

    // Always run server/cloud labels through belief — never paint raw frame truth.
    // Cloud path intentionally skips client hybrid; updateLiveBelief is the single mutation entry.
    if (res.items?.length) {
      const cloudish = /cloud_vision|hybrid/i.test(String(res.source || ''));
      const raw = liveItemsToDetections(res.items).map((d) => (
        cloudish ? { ...d, source: d.source || String(res.source || 'cloud_vision') } : d
      ));
      const hasShoe = raw.some((d) => roleOfCategory(d.category, d.subcategory) === 'footwear');
      const hasTop = raw.some((d) => roleOfCategory(d.category, d.subcategory) === 'top');
      const hasBottom = raw.some((d) => roleOfCategory(d.category, d.subcategory) === 'bottom');
      // Vision frame with outfit but no shoes + feet in frame → clear ghost footwear now
      const visionExplicitBarefoot = Boolean(
        (String(res.source || '').includes('cloud') || String(res.source || '').includes('vision'))
        && hasTop
        && hasBottom
        && !hasShoe
        && !(footZone?.cropped),
      );
      const stabilized = updateLiveBelief(raw, detectionMemoryRef.current, {
        decisions: decisionLogRef.current,
        bottomBandBrightness: footZone?.brightness,
        occasionType,
        forceClearFootwear: visionExplicitBarefoot,
      });
      detectionMemoryRef.current = stabilized.memory;
      if (cloudish && detectionMemoryRef.current.belief) {
        const adopted = adoptCloudIdentityIntoBelief(
          detectionMemoryRef.current.belief,
          res.items,
        );
        if (adopted) detectionMemoryRef.current = {
          ...detectionMemoryRef.current,
          belief: adopted,
        };
      }
      const adoptedBelief = detectionMemoryRef.current.belief;
      let painted = detectionsToLiveItems(stabilized.detections, res.items);
      if (cloudish && adoptedBelief) {
        painted = painted.map((it) => {
          const blob = `${it.category} ${it.subcategory || ''} ${it.name || ''}`.toLowerCase();
          const slot = /short|trouser|jean|skirt|pant/.test(blob)
            ? adoptedBelief.bottom
            : /shoe|boot|sneaker|loafer|footwear/.test(blob)
              ? adoptedBelief.footwear
              : /jacket|blazer|coat|hoodie|overshirt/.test(blob)
                ? (adoptedBelief.layer || adoptedBelief.top)
                : (adoptedBelief.top || adoptedBelief.layer);
          if (!slot?.name) return it;
          return {
            ...it,
            name: slot.name,
            subcategory: slot.subcategory || it.subcategory,
            color: slot.color || it.color,
          };
        });
      }
      previousItemsRef.current = painted;
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
    const cloudComplete = isHighConfidenceCompleteCloudRead({
      source: res.source,
      items: res.items,
      completeness: next.completeness,
    });
    const searchingBarefootTimeout = Boolean(
      !beliefSlots?.footwear
      && beliefSlots?.bottom
      && noFootwearSinceRef.current
      && (memNow - noFootwearSinceRef.current) >= SEARCHING_BAREFOOT_MS,
    );
    // Cloud already named top+bottom with no shoes — do not wait 2.5s (or YOLO
    // foot-zone) before first score. Cropped/searching footwear must not delay.
    const cloudBarefoot = Boolean(
      cloudComplete
      && !beliefSlots?.footwear
      && (beliefSlots?.bottom || beliefSlots?.top),
    );
    // No footwear belief + feet not cropped → barefoot identity (unlocks score/labels).
    const barefootIdentity = Boolean(
      !beliefSlots?.footwear
      && (
        cloudBarefoot
        || memNow < (detectionMemoryRef.current.footwearBlockedUntil || 0)
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
    // Boxes may paint immediately; names wait for published Cloud identity.
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
    // First Cloud complete read is already high-confidence — do not present
    // "~78 approx / Settling in" while identity frames catch up.
    const certainty = cloudComplete && scoreGateRef.current.shown == null
      ? 'high' as const
      : smoothed.certainty;
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
        cloudComplete,
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
    if (hasPublishedLiveCore(truth) && !labelsReadyRef.current) {
      labelsReadyRef.current = true;
      if (mountedRef.current) setLabelsReady(true);
    }

    const searchingFootwear = Boolean(
      !truth.footwear
      && !barefootIdentity
    );
    if (mountedRef.current) {
      setItems(customerBoxesFromPublishedTruth(truth, {
        cropped: Boolean(footZone?.cropped || footZoneMem?.cropped),
        searchingFootwear,
      }));
    }

    // After first publish, hold score/headline. Do not blank on athletic↔sweat
    // shorts or Searching shoes — gateLiveScore adopts only when corroborated.

    // Published truth is the only garment-name source for HUD copy.
    if (next.coaching) {
      next.coaching = alignCoachingToTruth(next.coaching, truth) || next.coaching;
      next.coaching = enforceLiveOutcomeContract(next.coaching, next.score, {
        certainty: certainty === 'none' ? 'medium' : certainty,
      }) || next.coaching;
      next.coaching = renderCopyFromPublishedTruth(next.coaching, {
        ...truth,
        score: next.score,
      }) || next.coaching;
      next.coaching = {
        ...next.coaching,
        headline: blankProvisionalHeadlineAfterScore(next.coaching.headline, next.score),
      };
      if (next.score != null) {
        const h = next.coaching.headline;
        const prevH = previousFeedbackRef.current?.coaching?.headline;
        if ((!h || isProvisionalLiveHeadline(h)) && prevH && !isProvisionalLiveHeadline(prevH)) {
          next.coaching = { ...next.coaching, headline: prevH };
        }
      }
    }
    // Hard publish rule: no score → no judgment copy (summary / bullets / tips).
    // Never blank a number already on screen (Searching shoes / subtype flicker).
    if (next.score == null && previousFeedbackRef.current?.score != null) {
      next.score = previousFeedbackRef.current.score;
      if (!next.coaching?.headline && previousFeedbackRef.current.coaching) {
        next.coaching = previousFeedbackRef.current.coaching;
      }
    } else if (next.score == null) {
      next.coaching = gateLiveJudgment(next.coaching, null) || next.coaching;
      next.hints = [];
      next.suggestions = [];
      next.confidenceLevel = undefined;
    }

    if (
      next.score != null
      && liveTimingRef.current.publishedAt === 0
      && liveTimingRef.current.provenAt > 0
    ) {
      liveTimingRef.current.publishedAt = Date.now();
      const t = liveTimingRef.current;
      void liveStartCrumb(
        `LIVE_TIMING proven→req=${t.cloudReqAt - t.provenAt}ms req→res=${t.cloudResAt - t.cloudReqAt}ms res→publish=${t.publishedAt - t.cloudResAt}ms proven→publish=${t.publishedAt - t.provenAt}ms`,
      );
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

  const processFrameSample = useCallback(async (image: Image) => {
    if (liveStateRef.current !== 'live') {
      try { image.dispose(); } catch { /* ignore */ }
      return;
    }
    if (
      inFlightRef.current
      || !mountedRef.current
      || !samplingActiveRef.current
    ) {
      try { image.dispose(); } catch { /* ignore */ }
      // Don't leave "camera warming…" forever when the preview never becomes ready.
      if (
        samplingActiveRef.current
        && liveStartedAtRef.current > 0
        && Date.now() - liveStartedAtRef.current > 12000
      ) {
        setStatusNote('Camera not ready — tap Stop, then Start live again');
      }
      return;
    }
    if (Date.now() < captureAllowedAtRef.current) {
      try { image.dispose(); } catch { /* ignore */ }
      void liveStartCrumb('capture.warmup_skip');
      setStatusNote('Live — camera warming…');
      return;
    }
    if (!pipelineProvenRef.current) {
      setStatusNote((prev) => (
        /warming|sampling soon|Starting/i.test(prev)
          ? 'Reading camera…'
          : prev
      ));
    }
    inFlightRef.current = true;
    try {
      // ── Milestone 1 (frozen): camera → Nitro Image → RN → RGBA ─────────
      const failPipeline = (boundary: string, detail?: string) => {
        pipelineProofStreakRef.current = 0;
        const line = detail ? `${boundary} ${detail}` : boundary;
        void liveStartCrumb(`PIPELINE_FAIL ${line}`);
        setYoloStatusNote(`DBG: FAIL @ ${line}`);
        setStatusNote(`Pipeline fail @ ${boundary}`);
      };

      let rgba: Uint8Array;
      let width: number;
      let height: number;
      try {
        const extracted = imageToLiveRgba(image, FRAME_WIDTH);
        rgba = extracted.rgba;
        width = extracted.width;
        height = extracted.height;
      } catch (extractErr) {
        const msg = extractErr instanceof Error ? extractErr.message : 'unknown';
        void liveStartCrumb(`PIXELS_EXTRACT_FAILED ${msg}`);
        failPipeline('PIXELS_EXTRACT_FAILED', msg.slice(0, 80));
        return;
      }

      if (
        sourceSizeRef.current.width !== width
        || sourceSizeRef.current.height !== height
      ) {
        sourceSizeRef.current = { width, height };
        if (mountedRef.current) setSourceSize({ width, height });
      }

      const nonzeroSample = sampleNonZeroPixels(rgba);
      const needBytes = width * height * 4;
      // Verbose crumbs stay in DBG / console — not the customer status line.
      void livePipelineCrumb(
        `PIXELS_EXTRACTED ${width}x${height} bytes=${rgba.byteLength} nz=${nonzeroSample}`,
      );
      if (!pipelineProvenRef.current) {
        setYoloStatusNote(`DBG: PIXELS ${width}x${height} nz=${nonzeroSample}`);
      }
      if (rgba.byteLength < needBytes || nonzeroSample === 0) {
        void liveStartCrumb(
          `PIXELS_EXTRACTED_INVALID bytes=${rgba.byteLength} need=${needBytes} nz=${nonzeroSample}`,
        );
        failPipeline('PIXELS_EXTRACTED_INVALID', `bytes=${rgba.byteLength} nz=${nonzeroSample}`);
        return;
      }

      if (LIVE_REQUIRE_PIPELINE_PROOF && !pipelineProvenRef.current) {
        pipelineProofStreakRef.current += 1;
        const n = pipelineProofStreakRef.current;
        void liveStartCrumb(`PIPELINE_PROOF ${n}/${PIPELINE_PROOF_STREAK}`);
        setYoloStatusNote(`DBG: PIPELINE_PROOF ${n}/${PIPELINE_PROOF_STREAK}`);
        if (n >= PIPELINE_PROOF_STREAK) {
          pipelineProvenRef.current = true;
          liveTimingRef.current.provenAt = Date.now();
          void liveStartCrumb('PIPELINE_PROVEN');
          setYoloStatusNote('DBG: PIPELINE_PROVEN');
          setStatusNote(
            LIVE_PIPELINE_PROOF_ONLY
              ? 'PIPELINE_PROVEN — camera OK (analysis frozen)'
              : 'Camera OK — reading outfit…',
          );
        } else {
          setStatusNote(`Reading camera… ${n}/${PIPELINE_PROOF_STREAK}`);
        }
        return;
      }

      if (LIVE_PIPELINE_PROOF_ONLY) {
        setStatusNote('PIPELINE_PROVEN — camera OK (analysis frozen)');
        setYoloStatusNote('DBG: PIPELINE_PROVEN (frozen)');
        return;
      }

      lastFrameRgbaRef.current = {
        rgba,
        width,
        height,
        hash: hashRgbaFrame(rgba, width, height),
      };

      // ── YOLO diag (dormant for launch) ─────────────────────────────────
      if (LIVE_YOLO_ENABLED && liveCloudPathBlockedByYoloProof({
        requireYoloProof: LIVE_REQUIRE_YOLO_PROOF,
        yoloProofOnly: LIVE_YOLO_PROOF_ONLY,
        yoloProven: yoloProvenRef.current,
        yoloEnabled: LIVE_YOLO_ENABLED,
      })) {
        if (Date.now() < yoloEnabledAtRef.current) {
          setStatusNote('Camera OK — proving YOLO…');
          setYoloStatusNote('DBG: YOLO warmup');
          return;
        }
        if (mountedRef.current) setIsBusy(true);

        // Offline reference JPEG once per session — sticky on HUD for screenshots.
        if (!yoloRefDiagDoneRef.current) {
          yoloRefDiagDoneRef.current = true;
          try {
            const refDiag = await diagnoseYoloReferenceAsset();
            yoloRefVerdictRef.current = formatYoloDiagHud(refDiag, 'ref');
            yoloRefStickyUntilRef.current = Date.now() + YOLO_REF_STICKY_MS;
            void liveStartCrumb(`YOLO_REF ${refDiag.verdict} ${refDiag.summary}`);
            void liveStartCrumb(
              `YOLO_REF_META nms=${refDiag.counts.afterProdConfNms} guard=${refDiag.counts.afterBodyGuards} max=${refDiag.rawOutput?.maxScore}`,
            );
            for (const d of refDiag.guardDecisions) {
              void liveStartCrumb(`YOLO_REF_GUARD ${formatGuardDecisionHud(d)}`);
            }
            // Show REF NMS overlay so coordinate mapping can be judged offline too.
            const refPaint = detectionsToLiveItems(refDiag.nmsOverlayDetections, []);
            if (mountedRef.current) {
              setItems(refPaint);
              setLabelsReady(true);
              setSourceLabel('On-device');
              setYoloStatusNote(`DBG: ${yoloRefVerdictRef.current}`);
              setStatusNote(
                `REF sticky ${Math.round(YOLO_REF_STICKY_MS / 1000)}s · ${refDiag.verdict} · nms=${refDiag.counts.afterProdConfNms} guard=${refDiag.counts.afterBodyGuards}`,
              );
            }
            publishDebug({
              frameDetections: refDiag.nmsOverlayDetections,
              source: 'on_device_yolo_ref',
              cropped: false,
            });
          } catch (refErr) {
            const msg = refErr instanceof Error ? refErr.message : 'ref_failed';
            yoloRefVerdictRef.current = `ref:run_failed ${msg}`;
            yoloRefStickyUntilRef.current = Date.now() + YOLO_REF_STICKY_MS;
            void liveStartCrumb(`YOLO_REF_FAIL ${msg}`);
            setYoloStatusNote(`DBG: ${yoloRefVerdictRef.current}`);
            setStatusNote(`REF sticky · fail ${msg.slice(0, 40)}`);
          }
          return;
        }

        // Keep REF status visible long enough to screenshot before Live diag overwrites.
        if (Date.now() < yoloRefStickyUntilRef.current) {
          setStatusNote((prev) => (
            /^REF /i.test(prev)
              ? prev
              : `REF sticky · ${yoloRefVerdictRef.current || '…'}`
          ));
          setYoloStatusNote(`DBG: ${yoloRefVerdictRef.current || 'ref…'}`);
          return;
        }

        let diag: YoloDetectorDiag;
        try {
          diag = await diagnoseYoloFromRgba(rgba, width, height, 'live_rgba');
        } catch (yoloErr) {
          console.warn('[LiveStylist] YOLO diag failed:', yoloErr);
          yoloProofStreakRef.current = 0;
          const msg = yoloErr instanceof Error ? yoloErr.message : 'diag_failed';
          void liveStartCrumb(`YOLO_FAIL ${msg}`);
          setYoloStatusNote(`DBG: YOLO_FAIL ${msg.slice(0, 60)}`);
          setStatusNote('YOLO fail — model/run unavailable');
          return;
        }

        if (diag.verdict === 'model_unavailable' || diag.verdict === 'run_failed') {
          yoloProofStreakRef.current = 0;
          void liveStartCrumb(`YOLO_FAIL ${diag.verdict} ${diag.summary}`);
          setYoloStatusNote(`DBG: YOLO_FAIL ${diag.summary.slice(0, 60)}`);
          setStatusNote(`YOLO fail — ${diag.verdict}`);
          return;
        }

        yoloLiveVerdictRef.current = formatYoloDiagHud(diag, 'live');
        void liveStartCrumb(`YOLO_LIVE ${diag.verdict} ${diag.summary}`);
        void liveStartCrumb(
          `YOLO_LIVE_META max=${diag.rawOutput?.maxScore} nms=${diag.counts.afterProdConfNms} guard=${diag.counts.afterBodyGuards}`,
        );
        for (const d of diag.guardDecisions) {
          void liveStartCrumb(`YOLO_LIVE_GUARD ${formatGuardDecisionHud(d)}`);
        }

        // Overlay pre-guard NMS boxes (PASS/REJECT in label) — production thresholds unchanged.
        const paintList = diag.nmsOverlayDetections;
        const painted = detectionsToLiveItems(paintList, []);
        if (mountedRef.current) {
          setItems(painted);
          setLabelsReady(true);
          setSourceLabel('On-device');
        }
        publishDebug({
          frameDetections: paintList,
          source: 'on_device_yolo_proof',
          cropped: false,
        });

        const nNms = diag.counts.afterProdConfNms;
        const nProd = diag.counts.afterBodyGuards;
        const firstReject = diag.guardDecisions.find((d) => d.outcome === 'REJECT');
        if (nNms && !firstDetectionLoggedRef.current) {
          firstDetectionLoggedRef.current = true;
          void liveStartCrumb(`detection.first nms=${nNms}`);
        }

        const dbgLine = [
          yoloLiveVerdictRef.current,
          yoloRefVerdictRef.current ? `| ${yoloRefVerdictRef.current}` : '',
          firstReject ? `| ${firstReject.rejectReason}` : '',
        ].filter(Boolean).join(' ');

        if (!yoloProvenRef.current) {
          yoloProofStreakRef.current += 1;
          const n = yoloProofStreakRef.current;
          void liveStartCrumb(`YOLO_PROOF ${n}/${YOLO_PROOF_STREAK} verdict=${diag.verdict}`);
          setYoloStatusNote(`DBG: ${dbgLine}`);
          if (n >= YOLO_PROOF_STREAK) {
            yoloProvenRef.current = true;
            void liveStartCrumb(`YOLO_PROVEN verdict=${diag.verdict} nms=${nNms} guard=${nProd}`);
            setStatusNote(
              `YOLO_PROVEN · NMS ${nNms} → guard ${nProd}${firstReject ? ` · ${firstReject.rejectReason}` : ''}`,
            );
          } else {
            setStatusNote(
              `YOLO guard-trace ${n}/${YOLO_PROOF_STREAK} · NMS ${nNms} → ${nProd}${firstReject ? ` · ${firstReject.rejectReason}` : ''}`,
            );
          }
          return;
        }

        if (LIVE_YOLO_PROOF_ONLY) {
          setYoloStatusNote(`DBG: ${dbgLine}`);
          setStatusNote(
            `YOLO_PROVEN · NMS ${nNms} → guard ${nProd}${firstReject ? ` · ${firstReject.rejectReason}` : ''}`,
          );
          return;
        }
      }

      // ── Milestone 3: cloud / belief / score ────────────────────────────
      void liveStartCrumb(`ANALYSIS_START ${width}x${height}`);
      setYoloStatusNote(`DBG: ANALYSIS_START ${width}x${height}`);

      const frameHash = lastFrameRgbaRef.current?.hash || hashRgbaFrame(rgba, width, height);
      // Don't "hold" until we've analysed at least once — otherwise a failed
      // first frame locks Live on an identical hash forever.
      if (analysisSucceededRef.current && framesLikelySame(lastHashRef.current, frameHash)) {
        setStatusNote('Holding — frame unchanged');
        return;
      }

      if (mountedRef.current) setIsBusy(true);

      const firstCloudDue = !firstCloudSentRef.current;

      let onDevice: Awaited<ReturnType<typeof detectGarmentsFromRgba>> = null;
      if (LIVE_YOLO_ENABLED && !firstCloudDue && Date.now() >= yoloEnabledAtRef.current) {
        try {
          onDevice = await detectGarmentsFromRgba(rgba, width, height);
        } catch (yoloErr) {
          console.warn('[LiveStylist] on-device detect failed:', yoloErr);
          onDevice = null;
        }
      }
      if (onDevice?.length && !firstDetectionLoggedRef.current) {
        firstDetectionLoggedRef.current = true;
        void liveStartCrumb(`detection.first n=${onDevice.length}`);
      }

      const payload: Record<string, unknown> = {
        occasionType,
        hybridMatch: LIVE_YOLO_ENABLED,
        frameHash,
        previousItems: previousItemsRef.current,
        previousFeedback: previousFeedbackRef.current,
        recentLayerTipIds: recentLayerTipIdsRef.current.slice(0, 8),
        month: new Date().getMonth() + 1,
      };

      let jpegBase64: string | null = null;
      const ensureJpeg = () => {
        if (!jpegBase64) {
          jpegBase64 = encodeRgbaToJpegBase64(rgba, width, height, 55);
        }
        return jpegBase64;
      };

      if (firstCloudDue) {
        payload.imageBase64 = ensureJpeg();
        payload.cloudFill = true;
        payload.cloudFillReason = 'first_publish';
        firstCloudSentRef.current = true;
        lastCloudFillAtRef.current = Date.now();
      } else if (LIVE_YOLO_ENABLED && onDevice?.length) {
        const { correctOnDeviceDetections } = await import('@/utils/yoloToPipelineCandidates');
        const footZoneEarly = getLastOnDeviceFootZone();
        const { detections: corrected, pipeline } = correctOnDeviceDetections(onDevice, {
          id: frameHash,
          context: occasionType,
          hybrid: {
            rematerializeBottom: false,
            inferMissingFootwear: Boolean(footZoneEarly?.visible),
          },
        });
        if (pipeline?.discarded) {
          void liveStartCrumb(`ANALYSIS_FAILURE discard:${pipeline.discardReason || 'quality'}`);
          setYoloStatusNote(`Pipeline: ANALYSIS_FAILURE discard:${pipeline.discardReason || 'quality'}`);
          setStatusNote(
            pipeline.discardReason === 'too_blurry'
              ? 'Hold steadier — frame too blurry'
              : pipeline.discardReason === 'too_many_items'
                ? 'Too many items in frame'
                : 'Frame skipped — low quality',
          );
          return;
        }
        const footZone = getLastOnDeviceFootZone();
        const lockedIdentity = hasPublishedLiveCore(outfitTruthRef.current);
        const mapped = lockedIdentity && outfitTruthRef.current
          ? mapYoloBoxesOntoPublishedTruth(corrected, outfitTruthRef.current)
          : corrected;
        if (lockedIdentity) {
          payload.detections = mapped;
          payload.detectorSource = 'yolo';
          payload.sceneType = 'worn';
          payload.frameCropped = Boolean(footZone?.cropped);
          paintBeliefItems(mapped);
          publishDebug({
            frameDetections: mapped,
            source: 'on_device_yolo',
            cropped: Boolean(footZone?.cropped),
          });
        } else {
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
          paintBeliefItems(detectionsForCustomerPaint(
            stabilized.detections,
            outfitTruthRef.current,
          ));
          publishDebug({
            frameDetections: onDevice,
            source: 'on_device_yolo',
            cropped: stabilized.cropped,
            mutations: stabilized.mutations,
          });
        }

        const belief = detectionMemoryRef.current.belief;
        const missingTop = !belief?.top && !belief?.layer;
        const missingShoes = !belief?.footwear && Boolean(footZone?.visible);
        const sparse = (payload.detections as unknown[] | undefined)?.length
          ? (payload.detections as unknown[]).length < 2
          : true;
        const incomplete = !lockedIdentity && (missingTop || missingShoes || sparse);
        const baseline = cloudSceneBaselineRef.current;
        if (!baseline.detections.length) {
          cloudSceneBaselineRef.current = {
            detections: mapped,
            frameHash,
          };
        }
        const sceneChanged = hasMeaningfulLiveSceneChange(
          baseline.detections,
          mapped,
          baseline.frameHash,
          frameHash,
        );
        sceneChangeStreakRef.current = sceneChanged
          ? sceneChangeStreakRef.current + 1
          : 0;
        const fillMs = (missingTop || missingShoes) ? 2000 : 4000;
        const cloudFillReady = Date.now() - lastCloudFillAtRef.current >= fillMs;
        const sceneEventReady =
          Date.now() - lastCloudFillAtRef.current >= CLOUD_SCENE_EVENT_COOLDOWN_MS;
        const sceneEventDue =
          sceneChangeStreakRef.current >= CLOUD_SCENE_EVENT_FRAMES && sceneEventReady;
        const layerVerifyDue = Date.now() - lastCloudFillAtRef.current >= CLOUD_LAYER_VERIFY_MS;
        const suspect = detectSuspectLiveRead(lockedIdentity ? mapped : corrected);
        const suspectDue = Boolean(
          suspect
          && !suspectAskedRef.current.has(suspect.signature)
          && Date.now() - lastCloudFillAtRef.current >= CLOUD_SUSPECT_COOLDOWN_MS,
        );
        if ((incomplete && cloudFillReady) || suspectDue || sceneEventDue || layerVerifyDue) {
          payload.imageBase64 = ensureJpeg();
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
            detections: mapped,
            frameHash,
          };
        }
      } else if (!firstCloudDue) {
        const published = hasPublishedLiveCore(outfitTruthRef.current);
        const waitMs = published ? CLOUD_LAYER_VERIFY_MS : CLOUD_FIRST_PUBLISH_RETRY_MS;
        if (Date.now() - lastCloudFillAtRef.current >= waitMs) {
          payload.imageBase64 = ensureJpeg();
          payload.cloudFill = true;
          payload.cloudFillReason = published ? 'layer_verify' : 'first_publish';
          lastCloudFillAtRef.current = Date.now();
        }
      }

      if (!payload.imageBase64 && hasPublishedLiveCore(outfitTruthRef.current)) {
        lastHashRef.current = frameHash;
        analysisSucceededRef.current = true;
        const shownScore = scoreGateRef.current.shown;
        const scoreLabel = presentLiveScore(
          shownScore,
          previousFeedbackRef.current?.confidenceLevel || 'high',
        ).display;
        const n = previousItemsRef.current.length;
        setStatusNote(
          n
            ? `${n} piece${n === 1 ? '' : 's'} · ${scoreLabel}`
            : 'No garments yet — hold steadier',
        );
        return;
      }
      if (!payload.imageBase64) {
        return;
      }

      void liveStartCrumb('cloud.request');
      liveTimingRef.current.cloudReqAt = Date.now();
      const res = await apiService.liveScanFrame(payload);
      liveTimingRef.current.cloudResAt = Date.now();
      void liveStartCrumb(
        `cloud.response dt=${liveTimingRef.current.cloudResAt - liveTimingRef.current.cloudReqAt}ms`,
      );
      if (!res.success) {
        if (payload.cloudFillReason === 'first_publish') firstCloudSentRef.current = false;
        void liveStartCrumb(`ANALYSIS_FAILURE cloud:${res.message || 'scan_failed'}`);
        setYoloStatusNote(`Pipeline: ANALYSIS_FAILURE cloud`);
        if (isAiBudgetError({ message: res.message, error: (res as { error?: string }).error })) {
          handleAiBudgetHit(res);
          return;
        }
        setStatusNote(res.message || 'Scan failed');
        return;
      }
      lastHashRef.current = frameHash;
      analysisSucceededRef.current = true;
      void liveStartCrumb(`ANALYSIS_SUCCESS items=${res.itemCount ?? 0}`);
      setYoloStatusNote(`Pipeline: ANALYSIS_SUCCESS items=${res.itemCount ?? 0}`);
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
      if (!analysisSucceededRef.current) firstCloudSentRef.current = false;
      const msg = error instanceof Error ? error.message : 'Frame failed';
      void liveStartCrumb(`ANALYSIS_FAILURE ${msg}`);
      void liveStartCrumb(`frame.error ${msg}`);
      setYoloStatusNote(`Pipeline: ANALYSIS_FAILURE ${msg.slice(0, 48)}`);
      // Allow the next identical hash to retry after a failure.
      lastHashRef.current = null;
      if (isAiBudgetError(error)) {
        handleAiBudgetHit(error);
      } else if (/rate limit|429/i.test(msg) && !/usage limit/i.test(msg)) {
        setStatusNote('Slowing down — rate limited');
      } else if (/buffer|btoa|JPEG|RGBA|encode|pixels|incomplete/i.test(msg)) {
        setStatusNote('Could not read camera frame — retrying…');
      } else {
        setStatusNote('Could not analyse frame — retrying…');
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsBusy(false);
      try {
        image.dispose();
      } catch {
        /* ignore */
      }
    }
  }, [applyResponse, handleAiBudgetHit, occasionType, paintBeliefItems, publishDebug]);

  // Keep latest processFrameSample for onFrameSample (stable identity).
  processFrameRef.current = processFrameSample;

  const startSamplingLoop = useCallback(() => {
    stopSamplingLoop();
    samplingActiveRef.current = true;
    void liveStartCrumb('sampling.active');
  }, [stopSamplingLoop]);

  const waitForCameraReady = useCallback(async (timeoutMs = 4000): Promise<boolean> => {
    const hasRef = () => Boolean(visionCamRef.current);
    const isReady = () => Boolean(visionCamRef.current?.isReady());
    if (isReady()) return true;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (!mountedRef.current) return false;
      if (isReady()) return true;
      // Parent onReady may set cameraReadyRef before isReady() sees the handle update.
      if (cameraReadyRef.current && hasRef()) return true;
      await sleep(100);
    }
    return false;
  }, []);

  /** Mount camera only after user intent — never on screen open. */
  const ensureCameraMounted = useCallback(async (bootGen: number): Promise<boolean> => {
    const bootAlive = () => mountedRef.current && liveBootGenRef.current === bootGen;
    if (!bootAlive()) return false;
    if (!cameraMounted) {
      await liveStartCrumb('camera.mount.begin');
      // Finish navigation/UI work before touching native camera.
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      if (!bootAlive()) return false;
      await sleep(200);
      if (!bootAlive()) return false;
      cameraReadyRef.current = false;
      setCameraMounted(true);
      // Native preview needs a real commit before ready / capture.
      await sleep(250);
      if (!bootAlive()) return false;
      await liveStartCrumb('camera.mount.committed');
    }
    // Slightly under the outer hard timeout so Promise.race can win cleanly.
    const camOk = await waitForCameraReady(CAMERA_READY_TIMEOUT_MS - 500);
    if (!camOk || !bootAlive()) {
      await liveStartCrumb('camera.mount.ready_timeout');
      return false;
    }
    await liveStartCrumb('camera.mount.ready');
    await sleep(200);
    if (!bootAlive()) return false;
    await liveStartCrumb('camera.mount.settled');
    return Boolean(visionCamRef.current?.isReady() || cameraReadyRef.current);
  }, [cameraMounted, waitForCameraReady]);

  /** Reset session refs + minimal UI. Prefer calling BEFORE VisionCamera mounts. */
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
      setItems(customerBoxesFromPublishedTruth(warm.truth, {}));
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
      firstCloudSentRef.current = false;
      liveTimingRef.current = { provenAt: 0, cloudReqAt: 0, cloudResAt: 0, publishedAt: 0 };
      previousItemsRef.current = [];
      previousFeedbackRef.current = null;
      recentLayerTipIdsRef.current = [];
      warmTruthRef.current = null;
      setLabelsReady(false);
      setItems([]);
      setFeedback(null);
      setDebugSnapshot(emptyDebugSnapshot('live'));
    }
  }, []);

  const enterCameraError = useCallback((message: string) => {
    stopSamplingLoop();
    startingLiveRef.current = false;
    liveBootGenRef.current += 1;
    liveStartedAtRef.current = 0;
    if (stillFrameWaiterRef.current) {
      const waiter = stillFrameWaiterRef.current;
      stillFrameWaiterRef.current = null;
      waiter(null);
    }
    setCameraError(message);
    setLiveState('error');
    setStatusNote(message);
    unmountCamera();
  }, [stopSamplingLoop, unmountCamera]);

  const pauseLiveSession = useCallback(() => {
    stopSamplingLoop();
    startingLiveRef.current = false;
    liveBootGenRef.current += 1;
    liveStartedAtRef.current = 0;
    try {
      warmTruthRef.current = stashWarmTruth(outfitTruthRef.current);
    } catch {
      warmTruthRef.current = null;
    }
    setCameraError(null);
    setLiveState('idle');
    unmountCamera();
    analysisSucceededRef.current = false;
    lastHashRef.current = null;
    pipelineProofStreakRef.current = 0;
    pipelineProvenRef.current = false;
    yoloProofStreakRef.current = 0;
    yoloProvenRef.current = false;
    yoloRefDiagDoneRef.current = false;
    yoloRefVerdictRef.current = null;
    yoloLiveVerdictRef.current = null;
    yoloRefStickyUntilRef.current = 0;
    setStatusNote('Paused — tap Start to resume');
    setYoloStatusNote('Camera starts when you tap Start live');
  }, [stopSamplingLoop, unmountCamera]);

  const toggleLive = async () => {
    await liveStartCrumb('START LIVE PRESSED');
    try {
      // Stop / cancel from any active boot or live session
      if (liveState === 'live' || liveState === 'starting' || liveState === 'camera-loading') {
        pauseLiveSession();
        await liveStartCrumb('paused');
        return;
      }
      if (budgetExhausted) {
        setShowBudgetModal(true);
        await liveStartCrumb('start blocked — allowance exhausted');
        return;
      }
      if (startingLiveRef.current) {
        await liveStartCrumb('start ignored — already starting');
        return;
      }
      if (!visionLinked) {
        enterCameraError(
          'Live needs a newer app build (VisionCamera frame processors). OTA is not enough.',
        );
        await liveStartCrumb('start blocked — vision not linked');
        return;
      }
      startingLiveRef.current = true;
      const bootGen = ++liveBootGenRef.current;
      setCameraError(null);
      // STEP 1 — instant UI feedback (never wait for camera success)
      setLiveState('starting');
      setStatusNote('Starting…');
      await sleep(50);
      if (liveBootGenRef.current !== bootGen || !mountedRef.current) {
        startingLiveRef.current = false;
        return;
      }

      // 1) Permissions (before any VisionCamera)
      await liveStartCrumb('1. permissions');
      if (!permission?.granted) {
        const next = await requestPermission();
        if (!next.granted) {
          startingLiveRef.current = false;
          enterCameraError('Camera permission needed — enable it in Settings');
          Alert.alert(
            t('wardrobe.permissionRequired') || 'Permission Required',
            t('wardrobe.cameraAccessWasDeniedPleaseEnableItInSet') || 'Enable camera in Settings.',
            [
              { text: t('common.cancel') || 'Cancel', style: 'cancel' },
              { text: t('common.openSettings') || 'Settings', onPress: () => Linking.openSettings() },
            ],
          );
          await liveStartCrumb('1. permission denied');
          return;
        }
      }
      if (liveBootGenRef.current !== bootGen || !mountedRef.current) {
        startingLiveRef.current = false;
        return;
      }

      // 2) Reset UI/refs while still camera-free
      await liveStartCrumb('2. reset session (pre-camera)');
      resetLiveSessionState();
      lastFrameRgbaRef.current = null;
      yoloEnabledAtRef.current = Date.now() + 600;
      captureAllowedAtRef.current = Date.now() + 400;
      firstFrameLoggedRef.current = false;
      firstDetectionLoggedRef.current = false;
      analysisSucceededRef.current = false;
      pipelineProofStreakRef.current = 0;
      pipelineProvenRef.current = false;
      yoloProofStreakRef.current = 0;
      yoloProvenRef.current = false;
      yoloRefDiagDoneRef.current = false;
      yoloRefVerdictRef.current = null;
      yoloLiveVerdictRef.current = null;
      yoloRefStickyUntilRef.current = 0;
      firstCloudSentRef.current = false;
      lastHashRef.current = null;

      // 3) Mount + wait for ready (hard timeout)
      setLiveState('camera-loading');
      setStatusNote('Camera warming…');
      await liveStartCrumb('3. mount camera');

      const mountPromise = (async () => {
        const camOk = await ensureCameraMounted(bootGen);
        return liveBootGenRef.current === bootGen ? camOk : false;
      })();

      const timedOut = await Promise.race([
        mountPromise.then((ok) => ({ ok, timedOut: false as const })),
        sleep(CAMERA_READY_TIMEOUT_MS).then(() => ({ ok: false, timedOut: true as const })),
      ]);

      if (!mountedRef.current || liveBootGenRef.current !== bootGen) {
        startingLiveRef.current = false;
        return;
      }

      if (timedOut.timedOut || !timedOut.ok) {
        startingLiveRef.current = false;
        await liveStartCrumb(timedOut.timedOut ? '3. camera timeout' : '3. camera not ready');
        enterCameraError(
          timedOut.timedOut
            ? 'Camera failed to start — try again'
            : 'Camera not ready — try again',
        );
        return;
      }

      // 4) Go live + arm frame sampling (driven by onFrameSample)
      await liveStartCrumb('4. set live + arm loop');
      setYoloStatusNote('VisionCamera preview — sampling soon');
      setStatusNote('Live — reading your look…');
      captureAllowedAtRef.current = Date.now() + 400;
      liveStartedAtRef.current = Date.now();
      setLiveState('live');
      startSamplingLoop();
      await liveStartCrumb('5. start armed.vision.ok');
      startingLiveRef.current = false;

      setTimeout(() => {
        if (!mountedRef.current || liveStateRef.current !== 'live') return;
        setYoloStatusNote(
          LIVE_YOLO_ENABLED
            ? 'DBG: YOLO optional — Cloud Vision owns identity'
            : 'DBG: YOLO off for launch — Cloud Vision',
        );
      }, 5000);
    } catch (err) {
      console.warn('[LiveStylist] toggleLive failed:', err);
      await liveStartCrumb(`toggleLive.fail ${err instanceof Error ? err.message : 'unknown'}`);
      startingLiveRef.current = false;
      liveStartedAtRef.current = 0;
      enterCameraError(
        err instanceof Error ? err.message : 'Could not start live — try again',
      );
    }
  };

  const openStillScan = useCallback(async () => {
    if (budgetExhausted) {
      setShowBudgetModal(true);
      return;
    }
    if (inFlightRef.current || !mountedRef.current) return;
    if (!visionLinked && !lastFrameRgbaRef.current) {
      setStatusNote(
        'Still scan needs a newer app build (VisionCamera frame processors). OTA is not enough.',
      );
      return;
    }
    stopSamplingLoop();
    startingLiveRef.current = false;
    inFlightRef.current = true;
    setIsBusy(true);
    setStatusNote('Still scan — locking look…');
    try {
      if (!permission?.granted) {
        const next = await requestPermission();
        if (!next.granted) {
          setStatusNote('Camera permission needed');
          return;
        }
      }

      let frame = lastFrameRgbaRef.current;
      if (!frame) {
        // Mount briefly and wait for one onFrameSample.
        const stillBootGen = ++liveBootGenRef.current;
        setLiveState('camera-loading');
        const camOk = await ensureCameraMounted(stillBootGen);
        if (!camOk || liveBootGenRef.current !== stillBootGen) {
          setStatusNote('Camera not ready — try again');
          setLiveState('idle');
          return;
        }
        const captured = await new Promise<Image | null>((resolve) => {
          const timer = setTimeout(() => {
            if (stillFrameWaiterRef.current) {
              stillFrameWaiterRef.current = null;
              resolve(null);
            }
          }, 8000);
          stillFrameWaiterRef.current = (img) => {
            clearTimeout(timer);
            stillFrameWaiterRef.current = null;
            resolve(img);
          };
        });
        if (!captured || liveBootGenRef.current !== stillBootGen) {
          try { captured?.dispose(); } catch { /* ignore */ }
          setStatusNote('Still scan failed — no frame');
          setLiveState('idle');
          unmountCamera();
          return;
        }
        try {
          const scaled = imageToLiveRgba(captured, Math.max(FRAME_WIDTH, 720));
          const frameHash = hashRgbaFrame(scaled.rgba, scaled.width, scaled.height);
          frame = {
            rgba: scaled.rgba,
            width: scaled.width,
            height: scaled.height,
            hash: frameHash,
          };
          lastFrameRgbaRef.current = frame;
        } finally {
          try { captured.dispose(); } catch { /* ignore */ }
        }
        setLiveState('idle');
        unmountCamera();
      } else if (liveStateRef.current === 'live' || liveStateRef.current === 'camera-loading') {
        setLiveState('idle');
        unmountCamera();
      }

      const { rgba, width, height, hash: frameHash } = frame;
      lastHashRef.current = frameHash;

      const onDevice = LIVE_YOLO_ENABLED
        ? await detectGarmentsFromRgba(rgba, width, height)
        : null;
      const payload: Record<string, unknown> = {
        occasionType,
        hybridMatch: LIVE_YOLO_ENABLED,
        frameHash,
        previousItems: previousItemsRef.current,
        previousFeedback: previousFeedbackRef.current,
        recentLayerTipIds: recentLayerTipIdsRef.current.slice(0, 8),
        month: new Date().getMonth() + 1,
        richCritique: true,
        mode: 'still',
        sceneType: 'worn',
        imageBase64: encodeRgbaToJpegBase64(rgba, width, height, 70),
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

      void liveStartCrumb('cloud.request');
      const res = await apiService.liveScanFrame(payload);
      void liveStartCrumb('cloud.response');
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
      stillFrameWaiterRef.current = null;
      inFlightRef.current = false;
      if (mountedRef.current) setIsBusy(false);
    }
  }, [
    applyResponse,
    budgetExhausted,
    ensureCameraMounted,
    handleAiBudgetHit,
    occasionType,
    permission?.granted,
    publishDebug,
    requestPermission,
    stopSamplingLoop,
    unmountCamera,
    visionLinked,
  ]);

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
        {cameraMounted ? (
          <LiveVisionCameraGate
            ref={visionCamRef}
            // Keep active while loading so onReady can fire; idle still-wait uses camera-loading.
            isActive={liveState === 'camera-loading' || liveState === 'live'}
            onReady={() => {
              cameraReadyRef.current = true;
              void liveStartCrumb('camera.ready');
            }}
            onError={(message) => {
              void liveStartCrumb(`camera.error ${message}`);
              const sessionOpen = isLive || isBooting || startingLiveRef.current
                || Boolean(stillFrameWaiterRef.current);
              if (!sessionOpen) return;
              enterCameraError(message || 'VisionCamera error');
            }}
            onPipelineStage={(stage, detail) => {
              const line = detail ? `${stage} ${detail}` : stage;
              if (/^FRAME_RECEIVED$|^IMAGE_CREATED$|^PIXELS_ON_JS$/.test(stage)) {
                void livePipelineCrumb(line);
              } else {
                void liveStartCrumb(line);
              }
              if (/_INVALID$|_FAIL$/.test(stage) || stage === 'IMAGE_CREATED_FAIL') {
                pipelineProofStreakRef.current = 0;
                void liveStartCrumb(`PIPELINE_FAIL ${line}`);
                setYoloStatusNote(`DBG: FAIL @ ${line}`);
                setStatusNote(`Pipeline fail @ ${stage}`);
                return;
              }
              // Don't thrash customer HUD with per-frame crumbs — DBG line only.
              if (!pipelineProvenRef.current) {
                setYoloStatusNote(`DBG: ${stage}`);
              }
            }}
            onFrameSample={(image) => {
              if (stillFrameWaiterRef.current) {
                const waiter = stillFrameWaiterRef.current;
                stillFrameWaiterRef.current = null;
                waiter(image);
                return;
              }
              if (!samplingActiveRef.current || liveStateRef.current !== 'live') {
                try { image.dispose(); } catch { /* ignore */ }
                return;
              }
              void processFrameRef.current(image);
            }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
        )}
        <LiveArOverlay
          width={layout.width}
          height={layout.height}
          items={items}
          feedback={feedback}
          selectedTrackId={selected?.trackId}
          showRegionGuides={beliefDebugAllowed && showBeliefDebug}
          showLabels={labelsReady}
          sourceWidth={sourceSize.width}
          sourceHeight={sourceSize.height}
          logBboxTransform={beliefDebugAllowed && showBeliefDebug}
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

        {liveState === 'error' ? (
          <View style={styles.cameraErrorOverlay}>
            <ThemedText type="body" style={{ color: '#FFF', fontWeight: '700', textAlign: 'center', marginBottom: Spacing.sm }}>
              Camera failed to start
            </ThemedText>
            <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: Spacing.md }}>
              {cameraError || 'Something went wrong starting the camera.'}
            </ThemedText>
            <Pressable
              onPress={() => {
                setCameraError(null);
                setLiveState('idle');
                requestAnimationFrame(() => {
                  void toggleLive();
                });
              }}
              style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold, marginBottom: Spacing.sm }]}
            >
              <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '700' }}>
                Retry
              </ThemedText>
            </Pressable>
            <Pressable onPress={pauseLiveSession} style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.35)' }]}>
              <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Dismiss
              </ThemedText>
            </Pressable>
          </View>
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
            style={{ flex: 1, minHeight: 18, justifyContent: 'center' }}
          >
            <ThemedText
              type="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              {sourceLabel} · {sanitizeLiveUserHudText(statusNote) || 'Live'}
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
        {beliefDebugAllowed && showBeliefDebug ? (
        <View style={styles.dbgLine}>
          <ThemedText
            type="caption"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            {yoloStatusNote}
          </ThemedText>
        </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
            <Feather name="x" size={22} color="#FFF" />
          </Pressable>
          {budgetExhausted ? (
            <>
              <Pressable
                onPress={() => {
                  const paywall = getAiAllowancePaywallCopy(budgetPlanTier || tier);
                  if (paywall.primaryAction === 'topup') openAiTopUp();
                  else openSubscription();
                }}
                style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold, flex: 1 }]}
              >
                <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '700' }}>
                  {getAiAllowancePaywallCopy(budgetPlanTier || tier).primaryLabel}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={openSanityCheck}
                style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.35)' }]}
              >
                <ThemedText type="caption" style={{ color: '#FFF' }}>
                  Sanity check
                </ThemedText>
              </Pressable>
            </>
          ) : liveState === 'error' ? (
            <>
              <Pressable
                onPress={() => {
                  setCameraError(null);
                  setLiveState('idle');
                  requestAnimationFrame(() => {
                    void toggleLive();
                  });
                }}
                style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold, flex: 1 }]}
              >
                <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '700' }}>
                  Retry
                </ThemedText>
              </Pressable>
              <Pressable onPress={openStillScan} style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.35)' }]}>
                <ThemedText type="caption" style={{ color: '#FFF' }}>
                  Still scan
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={toggleLive}
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: isLive ? '#C45C4A' : LuxuryColors.gold,
                    flex: 1,
                    opacity: isBooting ? 0.92 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: isLive ? '#FFF' : LuxuryColors.midnight,
                    fontWeight: '700',
                  }}
                >
                  {liveState === 'live'
                    ? 'Stop'
                    : liveState === 'camera-loading'
                      ? 'Warming…'
                      : liveState === 'starting'
                        ? 'Starting…'
                        : 'Start live'}
                </ThemedText>
              </Pressable>
              <Pressable onPress={openStillScan} style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.35)' }]}>
                <ThemedText type="caption" style={{ color: '#FFF' }}>
                  Still scan
                </ThemedText>
              </Pressable>
            </>
          )}
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
  cameraErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
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
    minHeight: 22,
  },
  dbgLine: {
    minHeight: 18,
    marginBottom: 8,
    justifyContent: 'center',
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
