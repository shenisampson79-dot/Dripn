import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
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
import { convertImageToBase64 } from '@/services/VisionAnalysisService';
import { generateWardrobeOutfit } from '@/utils/generatedOutfit';
import { canSaveDecisionHistory, getMaxComparisonImages, getOutfitDecisionImageLimit } from '@/utils/tierMatrix';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { navigateToSubscription } from '@/utils/navigateToSubscription';

export type StylistFlowStep = 'event' | 'input' | 'context' | 'response';

export interface EventDetails {
  eventType: string;
  dressCode: string;
  venue: string;
  timeOfDay: string;
}

export interface UseStylistDecisionOptions {
  decisionType: Exclude<DecisionType, 'what-to-wear'>;
  navigation: { goBack: () => void; navigate?: (name: string) => void; dispatch?: (action: unknown) => void };
  initialStep?: StylistFlowStep;
}

const DECISION_TYPE_MAP: Record<string, 'sanity_check' | 'shopping' | 'what_to_wear' | 'event_outfit'> = {
  'sanity-check': 'sanity_check',
  shopping: 'shopping',
  'event-outfit': 'event_outfit',
};

function formatSubmitError(error: { message?: string }, limit: number) {
  const raw = error?.message || '';
  if (raw === 'too_many_images' || raw.includes('too_many_images')) {
    return `You can add up to ${limit} photos for this question. Remove a few and try again.`;
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

  const [step, setStep] = useState<StylistFlowStep>(initialStep ?? defaultStep);
  const [images, setImages] = useState<string[]>([]);
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

  const contextChips = decisionService.getContextChips();

  const getUploadLimit = useCallback(() => {
    if (decisionType === 'sanity-check') return 1;
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

  const openSubscriptionFromPaywall = () => {
    setShowUpgradeModal(false);
    navigateToSubscription(navigation as never, 'personal_stylist');
  };

  const dismissPaywall = () => setShowUpgradeModal(false);

  const guardAccess = () => {
    if (accessStatus && !accessStatus.canMakeDecision) {
      setShowUpgradeModal(true);
      return false;
    }
    return true;
  };

  const buildDecisionContext = (): string => {
    const situational = decisionService.formatContextForApi(selectedContexts);
    const notes = contextNotes.trim() || undefined;

    if (decisionType === 'event-outfit') {
      const eventParts: string[] = [];
      if (eventDetails.eventType) eventParts.push(`Event type: ${eventDetails.eventType}`);
      if (eventDetails.dressCode) eventParts.push(`Dress code: ${eventDetails.dressCode}`);
      if (eventDetails.timeOfDay) eventParts.push(`Time of day: ${eventDetails.timeOfDay}`);
      if (eventDetails.venue?.trim()) eventParts.push(`Venue: ${eventDetails.venue.trim()}`);
      const sections = [situational, eventParts.join('\n'), notes].filter(Boolean);
      return sections.join('\n\n');
    }

    return decisionService.formatContextForApi(selectedContexts, notes);
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

    if (decisionType === 'sanity-check' && selectedWardrobeIds.length > 0) {
      return selectedWardrobeIds
        .map((id) => wardrobeItems.find((item) => String(item.id) === id))
        .filter(Boolean)
        .map((item) => item!.enhancedImageUri || item!.imageUri)
        .filter((uri): uri is string => Boolean(uri));
    }

    return [];
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
    status?: number;
  }) => {
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
      Alert.alert(t('askStylist.unableToSubmit'), formatSubmitError(error, getUploadLimit()));
    }
  };

  const submitDecision = async (surpriseMe = false) => {
    if (!guardAccess()) return;

    const imageUris = collectImageUris();
    if (!surpriseMe && imageUris.length === 0 && decisionType !== 'shopping') {
      return;
    }
    if (!surpriseMe && decisionType === 'shopping' && imageUris.length === 0 && !contextNotes.trim()) {
      return;
    }

    setIsLoading(true);
    setIsSurpriseMe(surpriseMe);

    try {
      const stylistId = user?.stylistPreferences?.selectedStylistId || 'ruby';
      const context = buildDecisionContext();
      const base64Images = surpriseMe
        ? []
        : await Promise.all(
            imageUris.map(async (uri) => {
              const base64 = await convertImageToBase64(uri);
              return `data:image/jpeg;base64,${base64}`;
            }),
          );

      let localPieces: Array<{
        wardrobeItemId: string;
        name: string;
        category?: string;
        imageUrl?: string;
      }> | null = null;
      let localSummary: string | null = null;

      if (surpriseMe && decisionType === 'event-outfit' && wardrobeItems.length >= 3) {
        try {
          const local = await generateWardrobeOutfit({
            occasionType: 'evening_out',
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

      const apiResult = await apiService.submitDecisionCheck({
        decisionType: DECISION_TYPE_MAP[decisionType] || 'sanity_check',
        images: base64Images,
        context,
        stylist: stylistId,
        userProfile: buildUserProfile(),
        surpriseMe,
      });

      const recommendedIndex = apiResult.recommendedIndex ?? 0;
      const result: DecisionResponse = {
        id: `response-${Date.now()}`,
        requestId: `request-${Date.now()}`,
        recommendation: apiResult.decision || apiResult.recommendation || apiResult.response || '',
        reasoning: apiResult.reasoning || '',
        styleRating: apiResult.styleRating ?? null,
        ratingLabel: apiResult.ratingLabel ?? null,
        outfitPieces: localPieces || apiResult.outfitPieces || null,
        outfitSummary: localSummary || apiResult.outfitSummary || null,
        unifiedScore: apiResult.unifiedScore ?? null,
        stylistId: stylistId as DecisionResponse['stylistId'],
        timestamp: new Date().toISOString(),
        outfitImageUrl: localPieces ? undefined : apiResult.outfitImageUrl,
        uploadedImages: imageUris,
        recommendedIndex,
      };

      await persistResult(result, imageUris);
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
    });

    if (!result.canceled) {
      setSelectedWardrobeIds([]);
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, uploadLimit));
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

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setSelectedWardrobeIds([]);
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, uploadLimit));
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleWardrobeItem = (id: string) => {
    setImages([]);
    setSelectedWardrobeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
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
    setSelectedWardrobeIds([]);
    setContextNotes('');
    setSelectedContexts([]);
    setEventDetails({ eventType: '', dressCode: '', venue: '', timeOfDay: '' });
    setResponse(null);
    setIsSurpriseMe(false);
  };

  const canProceedFromInput = () => {
    if (decisionType === 'shopping') {
      return images.length >= 1 || contextNotes.trim().length > 0;
    }
    if (decisionType === 'sanity-check') {
      return images.length >= 1 || selectedWardrobeIds.length >= 1;
    }
    if (decisionType === 'event-outfit') {
      return images.length >= 1;
    }
    return false;
  };

  return {
    step,
    setStep,
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
    getUploadLimit,
    canProceedFromInput,
    handlePickImage,
    handleTakePhoto,
    handleRemoveImage,
    toggleWardrobeItem,
    toggleContext,
    submitDecision,
    resetFlow,
    openSubscriptionFromPaywall,
    dismissPaywall,
    guardAccess,
  };
}
