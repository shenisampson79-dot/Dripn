import { useState, useEffect, useCallback, useRef } from 'react';
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
  if (
    code === 'wardrobe_gap'
    || code === 'no_wardrobe'
    || /wardrobe (gap|doesn\'t|does not)|add .*polished|owned wardrobe/i.test(raw)
  ) {
    return raw || 'Your wardrobe needs a few more occasion-ready pieces for this request.';
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
  const [response, setResponse] = useState<DecisionResponse | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<DecisionSessionStatus>('draft');
  const [brokenImageCount, setBrokenImageCount] = useState(0);

  const sessionHydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<DecisionSession | null>(null);
  const contextHashRef = useRef<string>('');

  const contextChips = decisionService.getContextChips();
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

  /** True when header/hardware back should step within the flow instead of exiting. */
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
    setEventDetails(
      normalized.input.eventDetails || { eventType: '', dressCode: '', venue: '', timeOfDay: '' },
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
        applySessionToState(session);
        setBrokenImageCount(brokenImageIndexes.length);
        console.log('[StylistDecision] Session restored', {
          id: session.id,
          status: session.status,
          step: loadedStep,
          hasResult: Boolean(session.result),
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
            eventDetails,
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
    return `Selected wardrobe pieces to evaluate as one outfit:\n${lines.join('\n')}`;
  };

  const buildDecisionContext = (): string => {
    const situational = decisionService.formatContextForApi(selectedContexts);
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

    const base = decisionService.formatContextForApi(selectedContexts, notes);
    return [base, wardrobeBlock].filter(Boolean).join('\n\n');
  };

  const buildUserProfile = () => {
    const mappedGender =
      user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : user?.gender || null;

    return {
      ...(user?.profileData || {}),
      gender: mappedGender,
      name: user?.name,
      country: user?.country,
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
        contextChips: selectedContexts,
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
    } else {
      Alert.alert(
        t('askStylist.unableToSubmit'),
        formatSubmitError(error, {
          photoLimit: getUploadLimit(),
          wardrobeLimit: getWardrobeSelectLimit(),
          usedWardrobe: selectedWardrobeIds.length > 0 && images.length === 0,
        }),
      );
    }
  };

  const submitDecision = async (surpriseMe = false, opts?: { force?: boolean }) => {
    if (!opts?.force && !guardAccess()) return;

    const imageUris = collectImageUris();
    if (!surpriseMe && imageUris.length === 0 && decisionType !== 'shopping') {
      return;
    }
    if (!surpriseMe && decisionType === 'shopping' && imageUris.length === 0 && !contextNotes.trim() && selectedContexts.length === 0) {
      return;
    }

    setIsLoading(true);
    setIsSurpriseMe(surpriseMe);

    try {
      const stylistId = user?.stylistPreferences?.selectedStylistId || 'ruby';
      const context = buildDecisionContext();
      let base64Images: string[] = [];
      if (!surpriseMe && imageUris.length > 0) {
        base64Images = await resolveSubmitImages(imageUris);
      }

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
        wardrobeAvailable: wardrobeItems.length,
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
        selectedContexts,
        eventDetails: decisionType === 'event-outfit' ? eventDetails : undefined,
        selectedWardrobeIds: selectedWardrobeIds.slice(0, getWardrobeSelectLimit()),
        wardrobeItems: wardrobeItems.slice(0, 80).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color,
          brand: item.brand,
          occasions: item.occasions,
          subcategory: item.subcategory,
        })),
      });

      // Contract BEFORE result UI — never invent a multi-compare winner (no ?? 0)
      const enforced = safeEnforceDecisionContract(apiResult, {
        optionCount: imageUris.length,
        requireAdvice: true,
      });
      if (!enforced.ok && imageUris.length >= 2) {
        console.warn('[StylistDecision] Multi-compare contract soft-fail; showing all options', {
          issues: enforced.issues,
        });
      }

      const result: DecisionResponse = {
        id: `response-${Date.now()}`,
        requestId: `request-${Date.now()}`,
        recommendation:
          enforced.payload.advice
          || apiResult.decision
          || apiResult.recommendation
          || apiResult.response
          || '',
        reasoning: apiResult.reasoning || '',
        styleRating: apiResult.styleRating ?? null,
        ratingLabel: apiResult.ratingLabel ?? null,
        outfitPieces: (() => {
          // Prefer server occasion-locked pieces; local allocator is best-effort only
          const pieces = sanitizeOutfitPieces(apiResult.outfitPieces || localPieces || []);
          return pieces.length > 0 ? pieces : null;
        })(),
        outfitSummary: apiResult.outfitSummary || localSummary || null,
        unifiedScore: apiResult.unifiedScore ?? null,
        stylistId: stylistId as DecisionResponse['stylistId'],
        timestamp: new Date().toISOString(),
        outfitImageUrl: localPieces ? undefined : apiResult.outfitImageUrl,
        uploadedImages: imageUris,
        recommendedIndex: enforced.payload.recommendedIndex,
      };

      await persistResult(result, imageUris);
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
      setResponse(result);
      setStep('response');
    } catch (error) {
      await handleSubmitError(error as never);
    } finally {
      setIsLoading(false);
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

  /** Done: navigate only — never mutate/clear the completed session. */
  const completeAndClose = () => {
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
  const continueInChat = async () => {
    const continuity = getDecisionContinuity();
    if (!continuity) {
      navigation.navigate?.('AIStylist');
      return;
    }
    if (user?.id) {
      await saveLastDecisionContinuity(user.id, continuity);
    }
    navigation.navigate?.('AIStylist', {
      initialPrompt: continuity.followUpPrompt,
      decisionContinuity: continuity,
      fromDecisionSessionId: continuity.decisionSessionId,
    });
  };

  /** Unlock completed/stale snapshot for a new run with same photos/notes. */
  const editAndRerun = async () => {
    if (!user?.id) return;
    const hash = await resolveContextHash();
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
      return images.length >= 1 || contextNotes.trim().length > 0 || selectedContexts.length > 0;
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
    continueInChat,
    getDecisionContinuity,
    editAndRerun,
    refreshStaleRecommendation,
    openSubscriptionFromPaywall,
    dismissPaywall,
    guardAccess,
  };
}
