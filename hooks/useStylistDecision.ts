import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert, BackHandler } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/AuthContext';
import { useWardrobe } from '@/contexts/WardrobeContext';
import { useTranslations } from '@/contexts/TranslationContext';
import {
  decisionService,
  DecisionType,
  DecisionContext,
  DecisionAccessStatus,
  DecisionResponse,
  DecisionRequest,
  shouldDisplayStyleRating,
} from '@/services/DecisionService';
import { apiService } from '@/services/ApiService';
import {
  decisionSessionManager,
  DecisionFlow,
  DecisionSession,
  DecisionSessionStatus,
  DecisionDraftSubstep,
  getDerivedStep,
  buildWardrobeSignature,
  buildPersonaSignature,
  computeContextHash,
} from '@/services/DecisionSessionManager';
import { stabilizeDecisionImage } from '@/services/VisionAnalysisService';
import { generateWardrobeOutfit } from '@/utils/generatedOutfit';
import { recordStylistOutfitFeedback } from '@/utils/outfitFeedbackBrain';
import { canSaveDecisionHistory, getMaxComparisonImages, getOutfitDecisionImageLimit } from '@/utils/tierMatrix';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { navigateToSubscription } from '@/utils/navigateToSubscription';
import { safeEnforceDecisionContract } from '@/utils/decisionContract';
import { sanitizeOutfitPieces } from '@/utils/safeRender';
import {
  MAX_DECISION_WARDROBE_ITEMS,
  MAX_SANITY_CHECK_PHOTOS,
} from '@/utils/decisionWardrobeGroups';
import {
  buildDecisionContinuity,
  saveLastDecisionContinuity,
} from '@/utils/decisionContinuity';
import { resolveEventOutfitOccasion } from '@/utils/eventOutfitOccasion';
import { resolveWardrobeSelectionMode } from '@/utils/wardrobeSelectionMode';
import { sanitizeStylistUserText } from '@/utils/sanitizeStylistUserText';
import { genderAwareGapSuggestions, filterSuggestionStringsForUi } from '@/utils/shopDressCodeFilters';

export type StylistFlowStep = 'event' | 'input' | 'context' | 'response';

export interface EventDetails {
  eventType: string;
  dressCode: string;
  venue: string;
  timeOfDay: string;
}

export interface UseStylistDecisionOptions {
  decisionType: Exclude<DecisionType, 'what-to-wear'>;
  navigation: {
    goBack: () => void;
    navigate?: (name: string, params?: Record<string, unknown>) => void;
    dispatch?: (action: unknown) => void;
  };
  initialStep?: StylistFlowStep;
}

const DECISION_TYPE_MAP: Record<string, 'sanity_check' | 'shopping' | 'what_to_wear' | 'event_outfit'> = {
  'sanity-check': 'sanity_check',
  shopping: 'shopping',
  'event-outfit': 'event_outfit',
};

function isWardrobeGapError(error: {
  message?: string;
  error?: string;
  errorCode?: string;
  status?: string | number;
  displayState?: string;
  type?: string;
}): boolean {
  const code = error?.error || error?.errorCode || '';
  const raw = error?.message || '';
  const status = String(error?.status || '');
  return (
    code === 'wardrobe_gap'
    || code === 'no_wardrobe'
    || code === 'no_outfit_possible'
    || code === 'refused'
    || code === 'clash_blocked'
    || code === 'missing_event_type'
    || status === 'SHOP_REQUIRED'
    || status === 'wardrobe_gap'
    || error?.displayState === 'SHOP_REQUIRED'
    || error?.type === 'shop_required'
    || /wardrobe (gap|doesn\'t|does not)|add .*polished|owned wardrobe/i.test(raw)
  );
}

function isSystemRetryError(error: {
  message?: string;
  error?: string;
  errorCode?: string;
  status?: number;
}): boolean {
  const code = error?.error || error?.errorCode || '';
  return (
    code === 'system_error'
    || code === 'surprise_failed'
    || code === 'DECISION_FAILED'
    || error?.status === 503
  );
}

function formatSubmitError(
  error: {
    message?: string;
    error?: string;
    errorCode?: string;
    status?: number;
    maxAllowed?: number;
  },
  opts: { photoLimit: number; wardrobeLimit: number; usedWardrobe: boolean },
) {
  const raw = error?.message || error?.error || '';
  const code = error?.error || error?.errorCode || '';
  const maxAllowed = typeof error?.maxAllowed === 'number' ? error.maxAllowed : null;
  const tooMany =
    code === 'too_many_images'
    || raw === 'too_many_images'
    || raw.includes('too_many_images')
    || /up to \d+ (photos|items) for this question/i.test(raw)
    || /Too many (photos|items) for this question/i.test(raw);
  if (tooMany) {
    if (opts.usedWardrobe) {
      const limit = maxAllowed ?? opts.wardrobeLimit;
      return `You can select up to ${limit} wardrobe items for this question. Remove a few and try again.`;
    }
    const limit = maxAllowed ?? opts.photoLimit;
    return `You can add up to ${limit} photos for this question. Remove a few and try again.`;
  }
  if (raw.includes('Images required')) {
    return 'Add at least one photo, or describe what you\'re deciding between.';
  }
  if (raw.includes('Add photos or describe')) {
    return raw;
  }
  if (code === 'missing_event_type' || /tell me the event type/i.test(raw)) {
    return raw || 'Tell me the event type (for example wedding, dinner, or interview) so I can style you for it.';
  }
  if (isWardrobeGapError(error)) {
    return raw || 'Your wardrobe needs a few more occasion-ready pieces for this request.';
  }
  if (isSystemRetryError(error)) {
    return raw || 'Something went wrong styling that look. Please try again in a moment.';
  }
  return raw || 'Something went wrong. Please try again.';
}

export function useStylistDecision({
  decisionType,
  navigation,
  initialStep,
}: UseStylistDecisionOptions) {
  const { user } = useAuth();
  const { items: wardrobeItems } = useWardrobe();
  const { t } = useTranslations();

  const defaultStep: StylistFlowStep = decisionType === 'event-outfit' ? 'event' : 'input';
  const flowKey = decisionType as DecisionFlow;

  const [step, setStep] = useState<StylistFlowStep>(initialStep ?? defaultStep);
  /** Stable local JPEG URIs for preview (not ephemeral gallery content:// / ph://). */
  const [images, setImages] = useState<string[]>([]);
  /** Parallel data-URIs ready for /api/decision — kept in sync with `images`. */
  const [imageDataUris, setImageDataUris] = useState<string[]>([]);
  const [selectedWardrobeIds, setSelectedWardrobeIds] = useState<string[]>([]);
  const [contextNotes, setContextNotes] = useState('');
  const [selectedContexts, setSelectedContexts] = useState<DecisionContext[]>([]);
  const [isSurpriseMe, setIsSurpriseMe] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails>({
    eventType: '',
    dressCode: '',
    venue: '',
    timeOfDay: '',
  });
  const [accessStatus, setAccessStatus] = useState<DecisionAccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  /** Monotonic submit generation — only the latest in-flight request may commit UI. */
  const submitGenerationRef = useRef(0);
  const submitAbortRef = useRef<AbortController | null>(null);

  // Abort in-flight stylist call when category changes or screen unmounts
  useEffect(() => {
    submitAbortRef.current?.abort();
    submitGenerationRef.current += 1;
  }, [decisionType]);

  useEffect(() => () => {
    submitAbortRef.current?.abort();
  }, []);
  const [response, setResponse] = useState<DecisionResponse | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<DecisionSessionStatus>('draft');
  const [brokenImageCount, setBrokenImageCount] = useState(0);

  const sessionHydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<DecisionSession | null>(null);
  const contextHashRef = useRef<string>('');

  const contextChips = decisionService.getContextChips(decisionType);
  const allowedContextIds = useMemo(
    () => new Set(contextChips.map((chip) => chip.id)),
    [contextChips],
  );
  const activeContexts = useMemo(
    () => selectedContexts.filter((id) => allowedContextIds.has(id)),
    [allowedContextIds, selectedContexts],
  );
  // Data-truth: recommendation locks the UI; step is derived, not trusted from storage
  const derivedStep: StylistFlowStep = response
    ? 'response'
    : step === 'response'
      ? defaultStep
      : step;
  const isReadOnly = Boolean(response) || sessionStatus === 'completed' || sessionStatus === 'stale';
  const isStale = sessionStatus === 'stale';

  const setDraftStep = useCallback((next: StylistFlowStep) => {
    if (response || sessionRef.current?.result) return; // locked
    if (next === 'response') return;
    setStep(next);
  }, [response]);

  /** True when in-flow / hardware back should step within the flow instead of exiting. */
  const canGoBackOneStep = Boolean(
    !isReadOnly
    && (
      (decisionType === 'event-outfit' && derivedStep === 'input')
      || (derivedStep === 'response' && !response) // shouldn't happen; keep safe
    ),
  );

  const goBackOneStep = useCallback((): boolean => {
    if (isReadOnly) return false;
    if (decisionType === 'event-outfit' && step === 'input') {
      setDraftStep('event');
      return true;
    }
    return false;
  }, [decisionType, isReadOnly, setDraftStep, step]);

  // Android hardware back: step back when possible, else leave screen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (goBackOneStep()) return true;
      return false;
    });
    return () => sub.remove();
  }, [goBackOneStep]);

  const getUploadLimit = useCallback(() => {
    // Gallery / camera only — wardrobe selection uses getWardrobeSelectLimit()
    if (decisionType === 'sanity-check') return MAX_SANITY_CHECK_PHOTOS;
    if (decisionType === 'shopping') {
      const comparisonMax =
        accessStatus?.maxImages ?? getMaxComparisonImages(user?.subscriptionTier || 'free');
      return Math.min(3, comparisonMax);
    }
    if (decisionType === 'event-outfit') {
      return getOutfitDecisionImageLimit(user?.subscriptionTier || 'free');
    }
    return accessStatus?.maxImages ?? getMaxComparisonImages(user?.subscriptionTier || 'free');
  }, [accessStatus, decisionType, user?.subscriptionTier]);

  const getWardrobeSelectLimit = useCallback(() => MAX_DECISION_WARDROBE_ITEMS, []);

  const resolveContextHash = useCallback(async () => {
    const hash = await computeContextHash({
      wardrobeSignature: buildWardrobeSignature(wardrobeItems),
      personaSignature: buildPersonaSignature(user),
    });
    contextHashRef.current = hash;
    return hash;
  }, [wardrobeItems, user]);

  const checkAccess = useCallback(
    async (opts?: { showPaywallIfBlocked?: boolean }) => {
      if (!user?.id) return null;
      const status = await decisionService.checkDecisionAccess(
        user.id,
        user.subscriptionTier || 'free',
      );
      setAccessStatus(status);
      if (!status.canMakeDecision && opts?.showPaywallIfBlocked !== false) {
        setShowUpgradeModal(true);
      }
      return status;
    },
    [user?.id, user?.subscriptionTier],
  );

  useEffect(() => {
    checkAccess({ showPaywallIfBlocked: false });
  }, [checkAccess]);

  const applySessionToState = (session: DecisionSession) => {
    const normalized = decisionSessionManager.normalizeSession(session);
    sessionRef.current = normalized;
    setSessionStatus(normalized.status);
    setStep(getDerivedStep(normalized));
    setImages(normalized.input.images || []);
    setImageDataUris(normalized.input.imageDataUris || []);
    setSelectedWardrobeIds(normalized.input.selectedWardrobeIds || []);
    setContextNotes(normalized.input.text || '');
    setSelectedContexts(normalized.input.selectedContexts || []);
    // Event details only belong to event-outfit — keep other flows clean
    setEventDetails(
      flowKey === 'event-outfit'
        ? (normalized.input.eventDetails || { eventType: '', dressCode: '', venue: '', timeOfDay: '' })
        : { eventType: '', dressCode: '', venue: '', timeOfDay: '' },
    );
    setResponse(normalized.result || null);
    setIsSurpriseMe(Boolean(normalized.isSurpriseMe));
  };

  useEffect(() => {
    let cancelled = false;
    sessionHydratedRef.current = false;
    setSessionReady(false);

    const hydrate = async () => {
      if (!user?.id) {
        sessionHydratedRef.current = true;
        if (!cancelled) setSessionReady(true);
        return;
      }

      const hash = await resolveContextHash();
      const { session, step: loadedStep, brokenImageIndexes } = await decisionSessionManager.loadForScreen(
        user.id,
        flowKey,
        hash,
      );
      if (cancelled) return;

      if (session) {
        // Shopping / sanity: stale completed snapshots must not block a fresh start
        // with an outdated banner (and must not reuse event SHOP_REQUIRED visuals).
        let nextSession = session;
        if (
          (flowKey === 'shopping' || flowKey === 'sanity-check')
          && session.status === 'stale'
          && session.result
        ) {
          nextSession = decisionSessionManager.markDraftForEdit(session, hash);
          await decisionSessionManager.persist(nextSession);
        }
        // Isolate flows: never carry event details into shopping / sanity sessions
        if (flowKey !== 'event-outfit') {
          nextSession = {
            ...nextSession,
            input: {
              ...nextSession.input,
              eventDetails: { eventType: '', dressCode: '', venue: '', timeOfDay: '' },
            },
          };
        }
        // Contaminated shopping result: formal SHOP_REQUIRED with no shopping photos
        // was often an event-outfit payload leaked into the wrong flow UI.
        if (
          flowKey === 'shopping'
          && nextSession.result
          && (
            nextSession.result.displayState === 'SHOP_REQUIRED'
            || nextSession.result.status === 'SHOP_REQUIRED'
          )
          && !(nextSession.input.images?.length)
          && !(nextSession.input.text?.trim())
        ) {
          nextSession = decisionSessionManager.markDraftForEdit(nextSession, hash);
          await decisionSessionManager.persist(nextSession);
        }
        applySessionToState(nextSession);
        setBrokenImageCount(brokenImageIndexes.length);
        console.log('[StylistDecision] Session restored', {
          id: nextSession.id,
          status: nextSession.status,
          step: loadedStep,
          hasResult: Boolean(nextSession.result),
          brokenImages: brokenImageIndexes.length,
        });
      } else {
        const created = decisionSessionManager.createSession(user.id, flowKey, hash);
        sessionRef.current = created;
        setSessionStatus('draft');
        setStep(getDerivedStep(created));
        setBrokenImageCount(0);
      }

      sessionHydratedRef.current = true;
      if (!cancelled) setSessionReady(true);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per user/flow
  }, [user?.id, flowKey]);

  // Autosave DRAFT input only — completed sessions with result are immutable
  useEffect(() => {
    if (!sessionReady || !sessionHydratedRef.current || !user?.id) return;
    if (response || sessionRef.current?.result) return;
    if (sessionStatus === 'completed' || sessionStatus === 'stale') return;

    const draftSubstep: DecisionDraftSubstep =
      step === 'event' || step === 'input' || step === 'context' ? step : 'input';

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const base = sessionRef.current;
      if (!base || base.result) return;
      void decisionSessionManager
        .autosaveDraft(base, {
          contextHash: contextHashRef.current || base.contextHash,
          isSurpriseMe,
          input: {
            text: contextNotes,
            images,
            imageDataUris,
            selectedContexts,
            selectedWardrobeIds,
            eventDetails: flowKey === 'event-outfit'
              ? eventDetails
              : { eventType: '', dressCode: '', venue: '', timeOfDay: '' },
            draftSubstep,
          },
        })
        .then((next) => {
          if (!sessionRef.current?.result) {
            sessionRef.current = next;
          }
        });
    }, 400);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Never flush a draft wipe after result exists
      if (sessionRef.current?.result) return;
    };
  }, [
    sessionReady,
    user?.id,
    sessionStatus,
    response,
    step,
    contextNotes,
    images,
    imageDataUris,
    selectedContexts,
    selectedWardrobeIds,
    eventDetails,
    isSurpriseMe,
    flowKey,
  ]);

  const openSubscriptionFromPaywall = () => {
    setShowUpgradeModal(false);
    navigateToSubscription(navigation as never, 'personal_stylist');
  };

  const dismissPaywall = () => setShowUpgradeModal(false);

  const guardAccess = () => {
    if (isReadOnly) return false;
    if (accessStatus && !accessStatus.canMakeDecision) {
      setShowUpgradeModal(true);
      return false;
    }
    return true;
  };

  const buildSelectedWardrobeContext = (): string | undefined => {
    if (selectedWardrobeIds.length === 0) return undefined;
    const lines = selectedWardrobeIds
      .map((id) => wardrobeItems.find((item) => String(item.id) === id))
      .filter(Boolean)
      .map((item) => {
        const parts = [
          item!.name || 'Item',
          item!.category ? `(${item!.category})` : null,
          item!.color ? `colour: ${item!.color}` : null,
          item!.brand ? `brand: ${item!.brand}` : null,
        ].filter(Boolean);
        return `- ${parts.join(' · ')} [id:${item!.id}]`;
      });
    if (lines.length === 0) return undefined;
    const mode = resolveWardrobeSelectionMode(selectedWardrobeIds, wardrobeItems);
    if (mode === 'pick_one') {
      return `Selected wardrobe pieces in the SAME category — pick the best one for this request:\n${lines.join('\n')}`;
    }
    return `Selected wardrobe pieces proposed as ONE outfit — sanity-check the full look (approve, tweak, or suggest an alternative if inappropriate):\n${lines.join('\n')}`;
  };

  const buildDecisionContext = (): string => {
    const situational = decisionService.formatContextForApi(activeContexts);
    const notes = contextNotes.trim() || undefined;
    const wardrobeBlock = buildSelectedWardrobeContext();

    if (decisionType === 'event-outfit') {
      const eventParts: string[] = [];
      if (eventDetails.eventType) eventParts.push(`Event type: ${eventDetails.eventType}`);
      if (eventDetails.dressCode) eventParts.push(`Dress code: ${eventDetails.dressCode}`);
      if (eventDetails.timeOfDay) eventParts.push(`Time of day: ${eventDetails.timeOfDay}`);
      if (eventDetails.venue?.trim()) eventParts.push(`Venue: ${eventDetails.venue.trim()}`);
      const sections = [situational, eventParts.join('\n'), wardrobeBlock, notes].filter(Boolean);
      return sections.join('\n\n');
    }

    const base = decisionService.formatContextForApi(activeContexts, notes);
    return [base, wardrobeBlock].filter(Boolean).join('\n\n');
  };

  const buildUserProfile = () => {
    const mappedGender =
      user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : user?.gender || null;

    return {
      ...(user?.profileData || {}),
      gender: mappedGender,
      name: user?.name,
      country: user?.country || user?.profileData?.country || user?.profileData?.countryCode || null,
      countryCode:
        user?.profileData?.countryCode
        || user?.countryCode
        || user?.country
        || user?.profileData?.country
        || null,
      skinUndertone: user?.skinUndertone,
      bodyType: user?.bodyShape,
      bodyMeasurements: user?.bodyMeasurements,
      colorScanData: user?.colorScanData,
      extendedPreferences: user?.extendedPreferences,
      stylistPreferences: user?.stylistPreferences,
      stylePreference: user?.stylePreference,
      sizeRange: user?.sizeRange,
      budgetRange: user?.budgetRange,
      subscriptionTier: user?.subscriptionTier,
      retailers: user?.extendedPreferences?.favoriteShops || [],
    };
  };

  const collectImageUris = (): string[] => {
    if (images.length > 0) return images;

    // Wardrobe picks become outfit-piece images for vision (Sanity + Event).
    // Cap is getWardrobeSelectLimit(), not the gallery photo cap.
    if (
      (decisionType === 'sanity-check' || decisionType === 'event-outfit')
      && selectedWardrobeIds.length > 0
    ) {
      return selectedWardrobeIds
        .slice(0, getWardrobeSelectLimit())
        .map((id) => wardrobeItems.find((item) => String(item.id) === id))
        .filter(Boolean)
        .map((item) => item!.enhancedImageUri || item!.imageUri)
        .filter((uri): uri is string => Boolean(uri));
    }

    return [];
  };

  const appendStabilizedImages = async (
    assets: Array<{ uri?: string | null; base64?: string | null }>,
  ) => {
    const uploadLimit = getUploadLimit();
    const remaining = Math.max(0, uploadLimit - images.length);
    if (remaining === 0) return;

    const prepared = [];
    for (let i = 0; i < Math.min(assets.length, remaining); i++) {
      const asset = assets[i];
      prepared.push(
        await stabilizeDecisionImage({
          uri: asset.uri,
          base64: asset.base64,
          label: `Photo ${images.length + i + 1}`,
        }),
      );
    }

    setSelectedWardrobeIds([]);
    setImages((prev) => [...prev, ...prepared.map((p) => p.uri)].slice(0, uploadLimit));
    setImageDataUris((prev) => [...prev, ...prepared.map((p) => p.dataUri)].slice(0, uploadLimit));
    console.log('[StylistDecision] Photos stabilized', {
      added: prepared.length,
      bytes: prepared.map((p) => p.byteLength),
    });
  };

  /** Prefer cached data-URIs; re-stabilize from preview URIs if out of sync. */
  const resolveSubmitImages = async (imageUris: string[]): Promise<string[]> => {
    if (
      imageDataUris.length === imageUris.length
      && imageDataUris.length > 0
      && imageDataUris.every((d) => typeof d === 'string' && d.startsWith('data:image/') && d.length > 1000)
    ) {
      return imageDataUris;
    }

    const rebuilt = await Promise.all(
      imageUris.map(async (uri, index) => {
        const cached = imageDataUris[index];
        if (cached && cached.startsWith('data:image/') && cached.length > 1000) return cached;
        const stabilized = await stabilizeDecisionImage({
          uri,
          label: `Photo ${index + 1}`,
        });
        return stabilized.dataUri;
      }),
    );

    if (rebuilt.some((d) => !d || d.length < 1000)) {
      throw new Error('One or more photos could not be read. Remove them and add again from Gallery or Camera.');
    }
    setImageDataUris(rebuilt);
    return rebuilt;
  };

  const persistResult = async (result: DecisionResponse, imageUris: string[]) => {
    if (!user?.id) return;
    const stylistId = user?.stylistPreferences?.selectedStylistId || 'ruby';
    await decisionService.incrementDecisionsToday(user.id);
    await decisionService.incrementTotalDecisions(user.id);
    const tier = normalizeSubscriptionTier(user.subscriptionTier);
    if (canSaveDecisionHistory(tier)) {
      const historyRequest: DecisionRequest = {
        id: result.requestId,
        userId: user.id,
        type: decisionType,
        images: imageUris,
        contextNotes: contextNotes.trim() || undefined,
        contextChips: activeContexts,
        timestamp: new Date().toISOString(),
        stylistId: stylistId as DecisionRequest['stylistId'],
      };
      await decisionService.saveToHistory(user.id, historyRequest, result, user.subscriptionTier);
    }
    await checkAccess({ showPaywallIfBlocked: true });
  };

  const handleSubmitError = async (error: {
    limitCopy?: { message?: string; cta?: string };
    message?: string;
    error?: string;
    errorCode?: string;
    status?: number;
    maxAllowed?: number;
    suggestions?: string[];
    missingPieces?: string[];
    stylistResponse?: string;
  }) => {
    console.warn('[StylistDecision] Submit failed:', {
      decisionType,
      message: error?.message,
      error: error?.error,
      status: error?.status,
      eventType: eventDetails?.eventType,
      surpriseMe: isSurpriseMe,
    });
    if (
      error.limitCopy
      || error.message?.includes('your decision for today')
      || error.status === 429
    ) {
      await checkAccess({ showPaywallIfBlocked: true });
      Alert.alert(
        t('askStylist.unableToSubmit'),
        error.limitCopy?.message || error.message || t('askStylist.decisionLimitDefault'),
        [
          { text: t('common.maybeLater'), style: 'cancel' },
          {
            text: error.limitCopy?.cta || t('askStylist.unlockUnlimitedDecisions'),
            onPress: openSubscriptionFromPaywall,
          },
        ],
      );
      return;
    }

    // First-class refuse / wardrobe gap — show in-flow sheet, not a fake score card
    if (isWardrobeGapError(error)) {
      const errAny = error as {
        displayState?: string;
        status?: string | number;
        type?: string;
        retailOutfit?: DecisionResponse['retailOutfit'];
        recommendedOutfit?: DecisionResponse['recommendedOutfit'];
        retailers?: DecisionResponse['retailers'];
        nearbyStores?: DecisionResponse['nearbyStores'];
        nearbyStoresSource?: string | null;
        missing?: DecisionResponse['missing'];
        recommendation?: string;
        decision?: string;
        reasoning?: string;
      };
      const isShopRequired = errAny.displayState === 'SHOP_REQUIRED'
        || String(errAny.status || '') === 'SHOP_REQUIRED'
        || errAny.type === 'shop_required'
        || Boolean(errAny.retailOutfit?.products?.length || errAny.retailOutfit?.outfit);
      const copy = formatSubmitError(error, {
        photoLimit: getUploadLimit(),
        wardrobeLimit: getWardrobeSelectLimit(),
        usedWardrobe: selectedWardrobeIds.length > 0 && images.length === 0,
      });
      const suggestions = Array.isArray(error.suggestions) && error.suggestions.length
        ? filterSuggestionStringsForUi(error.suggestions, {
          gender: user?.gender,
          dressCode: eventDetails?.dressCode || eventDetails?.eventType || 'formal',
        })
        : Array.isArray(error.missingPieces) && error.missingPieces.length
          ? filterSuggestionStringsForUi(error.missingPieces, {
            gender: user?.gender,
            dressCode: eventDetails?.dressCode || eventDetails?.eventType || 'formal',
          })
          : genderAwareGapSuggestions(user?.gender, true);
      const gapResult: DecisionResponse = {
        id: `gap-${Date.now()}`,
        requestId: `request-${Date.now()}`,
        recommendation: sanitizeStylistUserText(
          errAny.recommendation || errAny.decision || copy,
        ),
        reasoning: sanitizeStylistUserText(errAny.reasoning || ''),
        success: isShopRequired ? true : false,
        status: (isShopRequired
          ? 'SHOP_REQUIRED'
          : (error.error || error.errorCode || 'wardrobe_gap')) as DecisionResponse['status'],
        displayState: isShopRequired ? 'SHOP_REQUIRED' : undefined,
        type: isShopRequired ? 'shop_required' : undefined,
        retailOutfit: errAny.retailOutfit || null,
        recommendedOutfit: errAny.recommendedOutfit || null,
        retailers: errAny.retailers,
        nearbyStores: errAny.nearbyStores || null,
        nearbyStoresSource: errAny.nearbyStoresSource || null,
        missing: errAny.missing,
        suggestions,
        missingPieces: suggestions,
        styleRating: null,
        ratingLabel: null,
        outfitPieces: undefined,
        outfitSummary: undefined,
        stylistId: (user?.stylistPreferences?.selectedStylistId || 'ruby') as DecisionResponse['stylistId'],
        timestamp: new Date().toISOString(),
      };
      setResponse(gapResult);
      setStep('response');
      return;
    }

    // Infra / transient — soft retry, never "Unable to submit" framing
    if (isSystemRetryError(error)) {
      Alert.alert(
        t('common.tryAgain') || 'Try again',
        formatSubmitError(error, {
          photoLimit: getUploadLimit(),
          wardrobeLimit: getWardrobeSelectLimit(),
          usedWardrobe: selectedWardrobeIds.length > 0 && images.length === 0,
        }),
      );
      return;
    }

    Alert.alert(
      t('askStylist.unableToSubmit'),
      formatSubmitError(error, {
        photoLimit: getUploadLimit(),
        wardrobeLimit: getWardrobeSelectLimit(),
        usedWardrobe: selectedWardrobeIds.length > 0 && images.length === 0,
      }),
    );
  };

  const submitDecision = async (surpriseMe = false, opts?: { force?: boolean }) => {
    if (!opts?.force && !guardAccess()) return;

    const imageUris = collectImageUris();
    const wardrobeSelectionMode = resolveWardrobeSelectionMode(selectedWardrobeIds, wardrobeItems);
    const hasWardrobeOnly =
      !surpriseMe
      && imageUris.length === 0
      && selectedWardrobeIds.length > 0
      && (decisionType === 'event-outfit' || decisionType === 'sanity-check');

    if (!surpriseMe && imageUris.length === 0 && decisionType !== 'shopping' && !hasWardrobeOnly) {
      return;
    }
    if (!surpriseMe && decisionType === 'shopping' && imageUris.length === 0 && !contextNotes.trim() && activeContexts.length === 0) {
      return;
    }

    // Abort any prior in-flight request (category change / new photo / rapid re-submit)
    submitAbortRef.current?.abort();
    const abortController = new AbortController();
    submitAbortRef.current = abortController;
    const generation = ++submitGenerationRef.current;
    const isStale = () => generation !== submitGenerationRef.current;

    setIsLoading(true);
    setIsSurpriseMe(surpriseMe);

    try {
      const stylistId = user?.stylistPreferences?.selectedStylistId || 'ruby';
      const context = buildDecisionContext();
      let base64Images: string[] = [];
      if (!surpriseMe && imageUris.length > 0) {
        base64Images = await resolveSubmitImages(imageUris);
      }
      if (isStale() || abortController.signal.aborted) return;

      if (!surpriseMe && imageUris.length > 0 && base64Images.length === 0) {
        throw new Error('Photos were selected but could not be attached. Please re-add them and try again.');
      }
      if (!surpriseMe && imageUris.length > 0 && base64Images.length !== imageUris.length) {
        throw new Error('Some photos failed to attach. Remove them and add again from Gallery or Camera.');
      }

      let localPieces: Array<{
        wardrobeItemId: string;
        name: string;
        category?: string;
        imageUrl?: string;
      }> | null = null;
      let localSummary: string | null = null;

      if (surpriseMe && decisionType === 'event-outfit' && wardrobeItems.length >= 3) {
        try {
          const occasionResolved = resolveEventOutfitOccasion({
            eventDetails,
            context,
            decisionType: 'event_outfit',
          });
          const local = await generateWardrobeOutfit({
            occasionType: occasionResolved.allocatorOccasion,
            wardrobeItems,
            stylistId,
            user,
            skipDecorate: true,
          });
          if (local.items.length >= 3) {
            localPieces = local.items.map((item) => ({
              wardrobeItemId: String(item.id),
              name: item.name || 'Item',
              category: item.category,
              imageUrl: item.enhancedImageUri || item.imageUri || undefined,
            }));
            localSummary =
              local.stylistMessage || local.items.map((i) => i.name).filter(Boolean).join(' · ');
          }
        } catch {
          // Local allocator is best-effort
        }
      }
      if (isStale() || abortController.signal.aborted) return;

      // Manual multi-category picks → show the full proposed look, not a single "winner" piece.
      const selectionPieces =
        !surpriseMe && wardrobeSelectionMode === 'evaluate_outfit'
          ? selectedWardrobeIds
            .slice(0, getWardrobeSelectLimit())
            .map((id) => wardrobeItems.find((item) => String(item.id) === id))
            .filter(Boolean)
            .map((item) => ({
              wardrobeItemId: String(item!.id),
              name: item!.name || 'Item',
              category: item!.category,
              imageUrl: item!.enhancedImageUri || item!.imageUri || undefined,
              type: 'owned' as const,
            }))
          : null;

      const mappedType = DECISION_TYPE_MAP[decisionType] || 'sanity_check';
      const approxKb = Math.round(
        base64Images.reduce((sum, img) => sum + img.length, 0) / 1024,
      );
      console.log('[StylistDecision] Submitting', {
        decisionType: mappedType,
        imageCount: base64Images.length,
        previewUriCount: imageUris.length,
        approxPayloadKb: approxKb,
        contextLength: context.length,
        stylist: stylistId,
        surpriseMe,
        wardrobeSelected: selectedWardrobeIds.length,
        wardrobeSelectionMode,
        wardrobeAvailable: wardrobeItems.length,
        submitGeneration: generation,
      });

      const apiResult = await apiService.submitDecisionCheck({
        decisionType: mappedType,
        images: base64Images,
        context,
        stylist: stylistId,
        userProfile: buildUserProfile(),
        surpriseMe,
        clientImageCount: surpriseMe ? 0 : imageUris.length,
        decisionSessionId: sessionRef.current?.id,
        selectedContexts: activeContexts,
        eventDetails: decisionType === 'event-outfit' ? eventDetails : undefined,
        location: decisionType === 'event-outfit'
          ? (eventDetails.venue?.trim()
            || (contextNotes.match(/\b(?:in|at|near)\s+([A-Za-z][A-Za-z\s-]{2,40})\b/i)?.[1]?.trim())
            || undefined)
          : undefined,
        // Surprise Me ignores draft wardrobe picks — sending evaluate_outfit diverted
        // the server into the LLM catch → "Unable to submit / please resend".
        selectedWardrobeIds: surpriseMe
          ? []
          : selectedWardrobeIds.slice(0, getWardrobeSelectLimit()),
        wardrobeSelectionMode: surpriseMe ? undefined : (wardrobeSelectionMode || undefined),
        wardrobeItems: wardrobeItems.slice(0, 80).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color,
          brand: item.brand,
          occasions: item.occasions,
          subcategory: item.subcategory,
        })),
        signal: abortController.signal,
      });

      // Stale / aborted — newer category or photo already owns the UI
      if (isStale() || abortController.signal.aborted) {
        console.log('[StylistDecision] Discarding stale response', { generation, current: submitGenerationRef.current });
        return;
      }

      // Evaluate-outfit: pieces of one look — never require a multi-compare winner.
      const contractOptionCount =
        wardrobeSelectionMode === 'evaluate_outfit' ? 0 : imageUris.length;
      const enforced = safeEnforceDecisionContract(apiResult, {
        optionCount: contractOptionCount,
        requireAdvice: true,
      });
      if (!enforced.ok && imageUris.length >= 2 && wardrobeSelectionMode !== 'evaluate_outfit') {
        console.warn('[StylistDecision] Multi-compare contract soft-fail; showing all options', {
          issues: enforced.issues,
        });
      }

      const result: DecisionResponse = {
        id: `response-${Date.now()}`,
        requestId: `request-${Date.now()}-g${generation}`,
        recommendation: sanitizeStylistUserText(
          (mappedType === 'shopping'
            ? (apiResult.message
              || apiResult.shoppingDecision?.message
              || apiResult.shoppingDecision?.text
              || apiResult.purchaseDecision?.reason
              || apiResult.recommendation
              || apiResult.decision)
            : null)
          || apiResult.message
          || enforced.payload.advice
          || apiResult.decision
          || apiResult.recommendation
          || apiResult.response
          || '',
        ),
        reasoning: (apiResult.message || apiResult.outfitId || (mappedType === 'shopping' && imageUris.length > 1))
          ? undefined
          : sanitizeStylistUserText(apiResult.reasoning || ''),
        confidenceNote: sanitizeStylistUserText(
          apiResult.confidenceNote
          || apiResult.decisionConfidence?.note
          || '',
        ) || undefined,
        decisionConfidence: apiResult.decisionConfidence
          ? {
            band: apiResult.decisionConfidence.band,
            label: sanitizeStylistUserText(apiResult.decisionConfidence.label || '') || undefined,
            note: sanitizeStylistUserText(
              apiResult.decisionConfidence.note || apiResult.confidenceNote || '',
            ) || undefined,
            source: apiResult.decisionConfidence.source,
          }
          : undefined,
        deterministic: Boolean(apiResult.deterministic),
        aiEnhanced: Boolean(apiResult.aiEnhanced),
        partial: Boolean(apiResult.partial),
        verdict: apiResult.verdict
          || (apiResult.evaluateResult?.suitable === true
            ? 'works'
            : apiResult.evaluateResult?.suitable === false
              ? 'doesnt_work'
              : undefined),
        styleRating: shouldDisplayStyleRating(apiResult.styleRating ?? null)
          ? (apiResult.styleRating ?? null)
          : null,
        ratingLabel: shouldDisplayStyleRating(apiResult.styleRating ?? null)
          ? sanitizeStylistUserText(apiResult.ratingLabel ?? '') || null
          : null,
        status: (apiResult.status as DecisionResponse['status'])
          || (apiResult.isFallback || apiResult.type === 'fallback_outfit' ? 'fallback_outfit' : 'ok'),
        type: apiResult.type,
        isFallback: Boolean(apiResult.isFallback || apiResult.status === 'fallback_outfit' || apiResult.type === 'fallback_outfit'),
        displayState: apiResult.displayState
          || (apiResult.status === 'SHOP_REQUIRED' || apiResult.type === 'shop_required'
            ? 'SHOP_REQUIRED'
            : apiResult.isFallback || apiResult.status === 'fallback_outfit'
              ? 'REJECTED_WARDROBE_FIX'
              : undefined),
        message: apiResult.message
          ? sanitizeStylistUserText(apiResult.message)
          : undefined,
        outfitId: apiResult.outfitId || undefined,
        boundOutfitId: apiResult.boundOutfitId || undefined,
        changeNote: apiResult.changeNote
          || apiResult.displayMeta?.changeNote
          || null,
        displayMeta: apiResult.displayMeta || (
          (apiResult.changeNote || apiResult.displayMeta?.changeNote)
            ? { changeNote: apiResult.changeNote || apiResult.displayMeta?.changeNote }
            : undefined
        ),
        recommendedOutfit: apiResult.recommendedOutfit || null,
        retailers: apiResult.retailers || undefined,
        nearbyStores: apiResult.nearbyStores || null,
        nearbyStoresSource: apiResult.nearbyStoresSource || null,
        retailOutfit: apiResult.retailOutfit || null,
        stylistNote: apiResult.stylistNote
          ? sanitizeStylistUserText(apiResult.stylistNote)
          : undefined,
        missing: apiResult.missing,
        suggestions: apiResult.suggestions,
        missingPieces: apiResult.missingPieces,
        outfitPieces: (() => {
          const pieces = sanitizeOutfitPieces(
            apiResult.outfitPieces || selectionPieces || localPieces || [],
          );
          return pieces.length > 0 ? pieces : null;
        })(),
        outfitSummary: (() => {
          const fromApi = sanitizeStylistUserText(apiResult.outfitSummary || '');
          if (fromApi && !/ · /.test(fromApi)) return fromApi;
          // Never prefer a bare "Name · Name · Name" list as the only summary — it hides analysis.
          const fromLocal = sanitizeStylistUserText(localSummary || '');
          if (fromLocal && !/ · /.test(fromLocal)) return fromLocal;
          return fromApi || null;
        })(),
        unifiedScore: apiResult.unifiedScore ?? null,
        stylistId: stylistId as DecisionResponse['stylistId'],
        timestamp: new Date().toISOString(),
        outfitImageUrl: localPieces ? undefined : apiResult.outfitImageUrl,
        // Evaluate mode: hide multi-photo "winner" framing so the full outfit grid shows.
        uploadedImages: wardrobeSelectionMode === 'evaluate_outfit' ? [] : imageUris,
        recommendedIndex:
          wardrobeSelectionMode === 'evaluate_outfit'
            ? undefined
            : enforced.payload.recommendedIndex,
        success: apiResult.success !== false,
        alreadyOwned: mappedType === 'shopping'
          ? (apiResult.alreadyOwned || apiResult.alreadyOwnedMatches)
          : undefined,
        alreadyOwnedMatches: mappedType === 'shopping'
          ? (apiResult.alreadyOwnedMatches || apiResult.alreadyOwned)
          : undefined,
        ownershipDecision: mappedType === 'shopping' ? apiResult.ownershipDecision : undefined,
        purchaseDecision: mappedType === 'shopping' ? apiResult.purchaseDecision : undefined,
        optionLabels: mappedType === 'shopping'
          ? (apiResult.optionLabels
            || apiResult.purchaseDecision?.optionLabels
            || undefined)
          : undefined,
        shoppingDecision: mappedType === 'shopping'
          ? (apiResult.shoppingDecision
            || apiResult.purchaseDecision?.shoppingDecision
            || undefined)
          : undefined,
        oneLiner: mappedType === 'shopping'
          ? (apiResult.oneLiner
            || apiResult.purchaseDecision?.oneLiner
            || undefined)
          : undefined,
        wardrobeCoverage: mappedType === 'shopping' ? apiResult.wardrobeCoverage : undefined,
        alreadyOwnedOverride: mappedType === 'shopping'
          ? Boolean(apiResult.alreadyOwnedOverride)
          : false,
      };

      // Multi shopping: one output source only — winner line + compact skips
      if (
        mappedType === 'shopping'
        && Array.isArray(imageUris)
        && imageUris.length > 1
      ) {
        const single = sanitizeStylistUserText(
          result.shoppingDecision?.text
          || result.recommendation
          || result.decision
          || '',
        );
        if (single) {
          result.decision = single;
          result.recommendation = single;
          result.message = single;
          result.reasoning = undefined;
          result.stylistNote = undefined;
          result.outfitSummary = undefined;
        }
      }

      if (isStale() || abortController.signal.aborted) {
        console.log('[StylistDecision] Discarding stale response before commit', { generation });
        return;
      }

      await persistResult(result, imageUris);
      if (isStale() || abortController.signal.aborted) return;

      const hash = await resolveContextHash();
      const base =
        sessionRef.current
        || (user?.id
          ? decisionSessionManager.createSession(user.id, flowKey, hash)
          : null);
      if (base) {
        const completed = decisionSessionManager.markCompleted(base, result, hash);
        sessionRef.current = completed;
        setSessionStatus(completed.status);
        await decisionSessionManager.persist(completed);
        const continuity = buildDecisionContinuity({
          session: completed,
          response: result,
          stylistId: result.stylistId || stylistId,
        });
        if (continuity && user?.id) {
          await saveLastDecisionContinuity(user.id, continuity);
        }
      }
      if (isStale() || abortController.signal.aborted) return;
      setResponse(result);
      setStep('response');
    } catch (error) {
      if (isStale() || abortController.signal.aborted || (error as Error)?.name === 'AbortError') {
        console.log('[StylistDecision] Ignoring aborted/stale submit error', {
          generation,
          name: (error as Error)?.name,
        });
        return;
      }
      await handleSubmitError(error as never);
    } finally {
      if (generation === submitGenerationRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handlePickImage = async () => {
    const uploadLimit = getUploadLimit();
    if (uploadLimit === 0 || !guardAccess()) return;
    if (images.length >= uploadLimit) {
      Alert.alert(
        t('askStylist.maxImagesReached'),
        t('askStylist.maxImagesMessage').replace('{n}', String(uploadLimit)),
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: decisionType !== 'sanity-check',
      quality: 0.8,
      selectionLimit: uploadLimit - images.length,
      base64: true,
    });

    if (result.canceled) return;

    // New photo while a decision is in flight → stale; abort prior request
    if (isLoading) {
      submitAbortRef.current?.abort();
      submitGenerationRef.current += 1;
    }

    try {
      await appendStabilizedImages(result.assets);
    } catch (error) {
      console.warn('[StylistDecision] Gallery stabilize failed:', error);
      Alert.alert(
        t('askStylist.unableToSubmit'),
        (error as Error)?.message || 'Could not read those photos. Try again or use Camera.',
      );
    }
  };

  const handleTakePhoto = async () => {
    const uploadLimit = getUploadLimit();
    if (uploadLimit === 0 || !guardAccess()) return;
    if (images.length >= uploadLimit) {
      Alert.alert(
        t('askStylist.maxImagesReached'),
        t('askStylist.maxImagesMessage').replace('{n}', String(uploadLimit)),
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('askStylist.cameraPermissionNeeded'), t('askStylist.enableCameraInSettings'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    if (result.canceled) return;

    // New photo while a decision is in flight → stale; abort prior request
    if (isLoading) {
      submitAbortRef.current?.abort();
      submitGenerationRef.current += 1;
    }

    try {
      await appendStabilizedImages(result.assets);
    } catch (error) {
      console.warn('[StylistDecision] Camera stabilize failed:', error);
      Alert.alert(
        t('askStylist.unableToSubmit'),
        (error as Error)?.message || 'Could not read that photo. Please try again.',
      );
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageDataUris((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleWardrobeItem = (id: string) => {
    setImages([]);
    setImageDataUris([]);
    const wardrobeLimit = getWardrobeSelectLimit();
    setSelectedWardrobeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= wardrobeLimit) {
        Alert.alert(
          t('askStylist.maxImagesReached') || 'Selection limit reached',
          (t('stylistFlow.maxWardrobeItemsMessage') || 'You can select up to {n} wardrobe items for this question.')
            .replace('{n}', String(wardrobeLimit)),
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleContext = (context: DecisionContext) => {
    if (!allowedContextIds.has(context)) return;
    setSelectedContexts((prev) =>
      prev.includes(context) ? prev.filter((c) => c !== context) : [...prev, context],
    );
  };

  const resetFlow = () => {
    setStep(defaultStep);
    setImages([]);
    setImageDataUris([]);
    setSelectedWardrobeIds([]);
    setContextNotes('');
    setSelectedContexts([]);
    setEventDetails({ eventType: '', dressCode: '', venue: '', timeOfDay: '' });
    setResponse(null);
    setIsSurpriseMe(false);
    setBrokenImageCount(0);
    setSessionStatus('draft');
    if (user?.id) {
      void decisionSessionManager.clearSession(user.id, flowKey);
      const hash = contextHashRef.current || '';
      const created = decisionSessionManager.createSession(user.id, flowKey, hash);
      sessionRef.current = created;
    } else {
      sessionRef.current = null;
    }
  };

  /** Done: complete and leave — keep completed session (Start over clears). */
  const completeAndClose = () => {
    // Taste learning: accepting an approved look reinforces preferences
    try {
      const pieces = response?.outfitPieces || [];
      const displayState = response?.displayState;
      if (
        pieces.length >= 2
        && displayState !== 'SHOP_REQUIRED'
        && displayState !== 'REJECTED_WARDROBE_FIX'
        && response?.success !== false
      ) {
        void recordStylistOutfitFeedback({
          items: pieces
            .map((p) => ({
              id: String(p.wardrobeItemId ?? p.id ?? ''),
              name: p.name || 'item',
              category: p.category || undefined,
              color: (p as { color?: string }).color,
            }))
            .filter((p) => p.id),
          signal: 'liked',
          source: 'stylist_decision',
          occasion: eventDetails?.eventType || decisionType || undefined,
          contextSnapshot: {
            displayState: displayState || null,
            decisionType,
          },
        });
      }
    } catch {
      // non-blocking
    }
    navigation.goBack();
  };

  /** Explicit reject — soft skip for stylist brain (does not alter hard rules). */
  const rejectAndClose = () => {
    try {
      const pieces = response?.outfitPieces || [];
      if (pieces.length >= 1) {
        void recordStylistOutfitFeedback({
          items: pieces
            .map((p) => ({
              id: String(p.wardrobeItemId ?? p.id ?? ''),
              name: p.name || 'item',
              category: p.category || undefined,
              color: (p as { color?: string }).color,
            }))
            .filter((p) => p.id),
          signal: 'skipped',
          source: 'stylist_decision',
          occasion: eventDetails?.eventType || decisionType || undefined,
          contextSnapshot: {
            displayState: response?.displayState || null,
            decisionType,
            action: 'not_this',
          },
        });
      }
    } catch {
      /* ignore */
    }
    navigation.goBack();
  };

  /** Build continuity snapshot for Stylist Chat handoff (no image payloads). */
  const getDecisionContinuity = () => {
    if (!sessionRef.current || !response) return null;
    const stylistId = (response.stylistId
      || user?.stylistPreferences?.selectedStylistId
      || 'ruby') as string;
    return buildDecisionContinuity({
      session: sessionRef.current,
      response,
      stylistId,
    });
  };

  /** Primary CTA: open AI Stylist with same stylist + seeded follow-up + continuity. */
  const continueInChat = async (opts?: { seedMessage?: string }) => {
    const continuity = getDecisionContinuity();
    if (!continuity) {
      navigation.navigate?.('AIStylist', opts?.seedMessage ? { initialPrompt: opts.seedMessage } : undefined);
      return;
    }
    if (user?.id) {
      await saveLastDecisionContinuity(user.id, continuity);
    }
    navigation.navigate?.('AIStylist', {
      initialPrompt: opts?.seedMessage || continuity.followUpPrompt,
      decisionContinuity: continuity,
      fromDecisionSessionId: continuity.decisionSessionId,
    });
  };

  /** Unlock completed/stale snapshot for a new run with same photos/notes. */
  const editAndRerun = async () => {
    const hash = await resolveContextHash();
    if (user?.id) {
      const base =
        sessionRef.current
        || decisionSessionManager.createSession(user.id, flowKey, hash);
      const draft = decisionSessionManager.markDraftForEdit(
        {
          ...base,
          input: {
            text: contextNotes,
            images,
            imageDataUris,
            selectedContexts,
            selectedWardrobeIds,
            eventDetails,
            draftSubstep: flowKey === 'event-outfit' ? 'event' : 'input',
          },
        },
        hash,
      );
      applySessionToState(draft);
      setBrokenImageCount(0);
      await decisionSessionManager.persist(draft);
      return;
    }
    // Offline / no user: reopen edit without clearing inputs
    setResponse(null);
    setSessionStatus('draft');
    setBrokenImageCount(0);
    setDraftStep(flowKey === 'event-outfit' ? 'event' : 'input');
  };

  /** Re-run decision engine for a stale completed session. */
  const refreshStaleRecommendation = async () => {
    if (!user?.id) return;
    const hash = await resolveContextHash();
    // Keep inputs; clear lock by editing then force submit (submit replaces result)
    const base =
      sessionRef.current
      || decisionSessionManager.createSession(user.id, flowKey, hash);
    const unlocked = decisionSessionManager.markDraftForEdit(
      {
        ...base,
        input: {
          text: contextNotes,
          images,
          imageDataUris,
          selectedContexts,
          selectedWardrobeIds,
          eventDetails,
          draftSubstep: 'input',
        },
        result: null,
      },
      hash,
    );
    // Keep response in UI until new one arrives — submit will replace
    sessionRef.current = { ...unlocked, result: null };
    setSessionStatus('draft');
    await decisionSessionManager.persist(unlocked);
    await submitDecision(false, { force: true });
  };

  const canProceedFromInput = () => {
    if (isReadOnly) return false;
    if (decisionType === 'shopping') {
      return images.length >= 1 || contextNotes.trim().length > 0 || activeContexts.length > 0;
    }
    if (decisionType === 'sanity-check') {
      return images.length >= 1 || selectedWardrobeIds.length >= 1;
    }
    if (decisionType === 'event-outfit') {
      // Photos, wardrobe picks, or Surprise Me (submitDecision(true) bypasses this)
      return images.length >= 1 || selectedWardrobeIds.length >= 1;
    }
    return false;
  };

  return {
    step: derivedStep,
    setStep: setDraftStep,
    goBackOneStep,
    canGoBackOneStep,
    images,
    selectedWardrobeIds,
    contextNotes,
    setContextNotes,
    selectedContexts,
    eventDetails,
    setEventDetails,
    accessStatus,
    isLoading,
    isSurpriseMe,
    response,
    showUpgradeModal,
    contextChips,
    wardrobeItems,
    user,
    sessionReady,
    sessionStatus,
    isReadOnly,
    isStale,
    brokenImageCount,
    getUploadLimit,
    getWardrobeSelectLimit,
    canProceedFromInput,
    handlePickImage,
    handleTakePhoto,
    handleRemoveImage,
    toggleWardrobeItem,
    toggleContext,
    submitDecision,
    resetFlow,
    completeAndClose,
    rejectAndClose,
    continueInChat,
    getDecisionContinuity,
    editAndRerun,
    refreshStaleRecommendation,
    openSubscriptionFromPaywall,
    dismissPaywall,
    guardAccess,
  };
}
