import React, { useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Image,
  Text,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { SafeOutfitPieces } from '@/components/SafeOutfitPieces';
import { SurpriseMeLoadingOverlay } from '@/components/SurpriseMeLoadingOverlay';
import { ThemedText } from '@/components/ThemedText';
import { AiAllowanceBlockedBanner } from '@/components/AiAllowanceBlockedBanner';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useTranslations } from '@/contexts/TranslationContext';
import { DecisionType } from '@/services/DecisionService';
import { decisionService } from '@/services/DecisionService';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { getAiAllowancePaywallCopy } from '@/utils/aiBudgetError';
import { useStylistDecision } from '@/hooks/useStylistDecision';
import { sanitizeOutfitPieces } from '@/utils/safeRender';
import { DecisionWardrobePicker } from '@/components/stylist/DecisionWardrobePicker';
import { FallbackShopSection } from '@/components/stylist/FallbackShopSection';
import { RetailOutfitSection } from '@/components/stylist/RetailOutfitSection';
import { MAX_DECISION_WARDROBE_ITEMS } from '@/utils/decisionWardrobeGroups';
import { shouldShowSanityFollowUpCta } from '@/utils/sanityFollowUpCta';
import { sanitizeStylistUserText, formatOutfitPieceRoleLabel, isOutfitRejectedByStylist } from '@/utils/sanitizeStylistUserText';
import { editorialGarmentName } from '@/utils/wardrobeItemName';
import { resolveStylistResultDisplayState } from '@/utils/stylistResultDisplayState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EVENT_TYPES = [
  { id: 'wedding', labelKey: 'stylistFlow.event.wedding' },
  { id: 'date', labelKey: 'stylistFlow.event.date' },
  { id: 'party', labelKey: 'stylistFlow.event.party' },
  { id: 'business', labelKey: 'stylistFlow.event.business' },
  { id: 'interview', labelKey: 'stylistFlow.event.interview' },
  { id: 'dinner', labelKey: 'stylistFlow.event.dinner' },
  { id: 'hiking', labelKey: 'stylistFlow.event.hiking' },
  { id: 'other', labelKey: 'stylistFlow.event.other' },
];

const DRESS_CODES = [
  { id: 'casual', labelKey: 'stylistFlow.dressCode.casual' },
  { id: 'smart-casual', labelKey: 'stylistFlow.dressCode.smartCasual' },
  { id: 'business', labelKey: 'stylistFlow.dressCode.business' },
  { id: 'cocktail', labelKey: 'stylistFlow.dressCode.cocktail' },
  { id: 'formal', labelKey: 'stylistFlow.dressCode.formal' },
  { id: 'black-tie', labelKey: 'stylistFlow.dressCode.blackTie' },
];

const TIME_OPTIONS = [
  { id: 'morning', labelKey: 'stylistFlow.time.morning' },
  { id: 'afternoon', labelKey: 'stylistFlow.time.afternoon' },
  { id: 'evening', labelKey: 'stylistFlow.time.evening' },
  { id: 'night', labelKey: 'stylistFlow.time.night' },
];

type FlowDecisionType = Exclude<DecisionType, 'what-to-wear'>;

interface StylistDecisionFlowProps {
  decisionType: FlowDecisionType;
  navigation: {
    goBack: () => void;
    navigate?: (name: string, params?: Record<string, unknown>) => void;
    dispatch?: (action: unknown) => void;
  };
}

function getStylistGradient(stylistId?: string): readonly [string, string] {
  if (stylistId === 'ruby') return [LuxuryColors.rose, '#D4949A'];
  if (stylistId === 'max') return [LuxuryColors.violet, LuxuryColors.deepViolet];
  if (stylistId === 'ace') return [LuxuryColors.obsidian, '#1A1A1A'];
  if (stylistId === 'ivy') return [LuxuryColors.emerald, LuxuryColors.teal];
  return [LuxuryColors.gold, LuxuryColors.deepGold];
}

function getStylistIcon(stylistId?: string): keyof typeof Feather.glyphMap {
  if (stylistId === 'ruby') return 'heart';
  if (stylistId === 'max') return 'zap';
  if (stylistId === 'ace') return 'target';
  if (stylistId === 'ivy') return 'compass';
  return 'star';
}

function getStylistName(stylistId?: string): string {
  if (stylistId === 'ruby') return 'Ruby';
  if (stylistId === 'max') return 'Max';
  if (stylistId === 'ace') return 'Ace';
  if (stylistId === 'ivy') return 'Ivy';
  return 'Your Stylist';
}

function renderMarkdownText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
}

function looksLikeItemNameList(text?: string | null): boolean {
  const value = String(text || '').trim();
  if (!value) return false;
  return / · /.test(value) && !/[.!?…]/.test(value);
}

export default function StylistDecisionFlow({ decisionType, navigation }: StylistDecisionFlowProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { paddingBottom: tabAwarePaddingBottom, hasTabBar } = useScreenInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const flow = useStylistDecision({ decisionType, navigation });
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const stylistId = flow.user?.stylistPreferences?.selectedStylistId || 'ruby';
  const stylistGradient = getStylistGradient(stylistId);
  const stylistName = getStylistName(stylistId);
  const stylistIcon = getStylistIcon(stylistId);

  // Sticky CTA height clearance for KeyboardAwareScrollView bottomOffset (not layout padding —
  // footer is a flex sibling, not position:absolute).
  const stickyFooterClearance = Spacing.md + 52 + (hasTabBar ? tabAwarePaddingBottom : Spacing.lg);

  // Collapsed flows: context chips live on the first input step (event details for event-outfit)
  const steps = useMemo(() => {
    if (decisionType === 'event-outfit') {
      return ['event', 'input', 'response'] as const;
    }
    return ['input', 'response'] as const;
  }, [decisionType]);

  const stepIndex = steps.indexOf(flow.step as typeof steps[number]);
  const progress = stepIndex >= 0 ? (stepIndex + 1) / steps.length : 0;

  useEffect(() => {
    if (flow.step !== 'response') return;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [flow.step, flow.response?.id]);

  // Occasion/vibe already collected on event step 1 — omit duplicate chips there.
  const visibleContextChips = useMemo(
    () => decisionService.getContextChips(decisionType),
    [decisionType],
  );

  const introCopy = {
    shopping: {
      title: t('stylistFlow.shopping.title'),
      subtitle: t('stylistFlow.shopping.subtitle'),
    },
    'event-outfit': {
      title: t('stylistFlow.eventOutfit.title'),
      subtitle: t('stylistFlow.eventOutfit.subtitle'),
    },
    'sanity-check': {
      title: t('stylistFlow.sanityCheck.title'),
      subtitle: t('stylistFlow.sanityCheck.subtitle'),
    },
  }[decisionType];

  const stickyCta = (() => {
    if (flow.isReadOnly) return null;
    if (flow.allowanceBlocked && flow.step !== 'response') {
      const paywall = getAiAllowancePaywallCopy(flow.user?.subscriptionTier);
      return {
        label: paywall.primaryLabel,
        onPress: () => flow.openAllowanceDestination(),
        loading: false,
      };
    }
    if (flow.step === 'event') {
      if (!flow.eventDetails.eventType || !flow.eventDetails.dressCode) return null;
      return {
        label: t('stylistFlow.continue'),
        onPress: () => flow.setStep('input'),
        loading: false,
      };
    }
    if (flow.step === 'input' && flow.canProceedFromInput()) {
      if (decisionType === 'shopping') {
        return {
          label: t('stylistFlow.getRecommendation'),
          onPress: () => flow.submitDecision(false),
          loading: flow.isLoading,
        };
      }
      if (decisionType === 'sanity-check') {
        return {
          label: t('stylistFlow.getVerdict'),
          onPress: () => flow.submitDecision(false),
          loading: flow.isLoading,
        };
      }
      if (decisionType === 'event-outfit') {
        return {
          label: t('stylistFlow.getRecommendation'),
          onPress: () => flow.submitDecision(false),
          loading: flow.isLoading,
        };
      }
    }
    return null;
  })();

  const renderProgress = () => (
    <View style={styles.progressBlock}>
      {flow.canGoBackOneStep ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            flow.goBackOneStep();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.stepBackRow}
        >
          <Feather name="arrow-left" size={16} color={LuxuryColors.gold} />
          <ThemedText type="caption" style={{ color: LuxuryColors.gold, fontWeight: '600' }}>
            {t('common.back')}
          </ThemedText>
        </Pressable>
      ) : null}
      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSecondary }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(progress * 100, 12)}%`, backgroundColor: LuxuryColors.gold },
            ]}
          />
        </View>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
          {t('stylistFlow.stepOf')
            .replace('{current}', String(Math.max(stepIndex + 1, 1)))
            .replace('{total}', String(steps.length))}
        </ThemedText>
      </View>
    </View>
  );

  const renderPrimaryButton = (
    label: string,
    onPress: () => void,
    disabled = false,
    loading = false,
  ) => (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      disabled={disabled || loading}
      style={[styles.primaryButton, (disabled || loading) && styles.primaryButtonDisabled]}
    >
      <LinearGradient colors={stylistGradient} style={styles.primaryButtonGradient}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText type="body" style={styles.primaryButtonText}>
            {label}
          </ThemedText>
        )}
      </LinearGradient>
    </Pressable>
  );

  const renderUploadActions = () => (
    <View style={styles.uploadActionsRow}>
      <Pressable
        onPress={flow.handlePickImage}
        accessibilityRole="button"
        accessibilityLabel={t('stylistFlow.gallery')}
        style={({ pressed }) => [
          styles.uploadAction,
          {
            backgroundColor: theme.backgroundRoot,
            borderColor: theme.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.uploadActionIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="image" size={20} color={LuxuryColors.gold} />
        </View>
        <ThemedText type="small" style={styles.uploadActionLabel}>
          {t('stylistFlow.gallery')}
        </ThemedText>
      </Pressable>

      <View style={[styles.uploadDivider, { backgroundColor: theme.border }]} />

      <Pressable
        onPress={flow.handleTakePhoto}
        accessibilityRole="button"
        accessibilityLabel={t('stylistFlow.camera')}
        style={({ pressed }) => [
          styles.uploadAction,
          {
            backgroundColor: theme.backgroundRoot,
            borderColor: theme.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.uploadActionIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="camera" size={20} color={LuxuryColors.gold} />
        </View>
        <ThemedText type="small" style={styles.uploadActionLabel}>
          {t('stylistFlow.camera')}
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderContextChips = (subtitle?: string) => (
    <View style={styles.contextBlock}>
      <ThemedText type="body" style={styles.contextBlockTitle}>
        {t('stylistFlow.contextTitle')}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
        {subtitle || t('stylistFlow.contextHelper')}
      </ThemedText>
      <View style={styles.chipRow}>
        {visibleContextChips.map((chip) => {
          const selected = flow.selectedContexts.includes(chip.id);
          return (
            <Pressable
              key={chip.id}
              onPress={() => flow.toggleContext(chip.id)}
              style={[
                styles.chip,
                { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
                selected && styles.chipSelected,
              ]}
            >
              <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                {chip.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        style={[
          styles.textArea,
          { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border },
        ]}
        placeholder={
          decisionType === 'shopping'
            ? t('stylistFlow.shopping.describePlaceholder')
            : t('common.addAnyExtraDetailsOptional')
        }
        placeholderTextColor={theme.tabIconDefault}
        value={flow.contextNotes}
        onChangeText={flow.setContextNotes}
        multiline
        numberOfLines={decisionType === 'shopping' ? 4 : 3}
        maxLength={decisionType === 'shopping' ? 400 : 200}
        editable={!flow.isReadOnly}
      />
    </View>
  );

  const renderShoppingInput = () => {
    const limit = flow.getUploadLimit();
    const optionLabels = [
      t('stylistFlow.option1'),
      t('stylistFlow.option2'),
      t('stylistFlow.option3'),
    ];

    return (
      <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
        <ThemedText type="h3">{t('stylistFlow.shopping.inputTitle')}</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
          {t('stylistFlow.shopping.inputSubtitle').replace('{n}', String(limit))}
        </ThemedText>

        <View style={styles.optionsStack}>
          {optionLabels.slice(0, limit).map((label, index) => {
            const uri = flow.images[index];
            return (
              <View
                key={label}
                style={[styles.optionCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                <ThemedText type="small" style={styles.optionLabel}>
                  {label}
                </ThemedText>
                {uri ? (
                  <View style={styles.optionImageWrap}>
                    <Image source={{ uri }} style={styles.optionImage} />
                    <Pressable onPress={() => flow.handleRemoveImage(index)} style={styles.removeBadge}>
                      <Feather name="x" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ) : index === 0 || flow.images[index - 1] ? (
                  renderUploadActions()
                ) : (
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                    {t('stylistFlow.uploadPreviousFirst')}
                  </ThemedText>
                )}
              </View>
            );
          })}
        </View>

        {renderContextChips()}
      </Animated.View>
    );
  };

  const renderSanityInput = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
      <ThemedText type="h3">{t('stylistFlow.sanityCheck.inputTitle')}</ThemedText>
      <ThemedText style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
        {t('stylistFlow.sanityCheck.inputSubtitle')}
      </ThemedText>

      {flow.images[0] ? (
        <View style={styles.heroImageWrap}>
          <Image source={{ uri: flow.images[0] }} style={styles.heroImage} />
          <Pressable onPress={() => flow.handleRemoveImage(0)} style={styles.removeBadge}>
            <Feather name="x" size={14} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        renderUploadActions()
      )}

      <ThemedText type="body" style={styles.orLabel}>
        {t('stylistFlow.orFromWardrobe')}
      </ThemedText>

      <DecisionWardrobePicker
        items={flow.wardrobeItems}
        selectedIds={flow.selectedWardrobeIds}
        onToggle={flow.toggleWardrobeItem}
        maxItems={flow.getWardrobeSelectLimit?.() ?? MAX_DECISION_WARDROBE_ITEMS}
        disabled={flow.isReadOnly}
      />

      {renderContextChips(t('stylistFlow.contextSubtitle'))}
    </Animated.View>
  );

  const renderEventInput = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
      <ThemedText type="h3">{t('stylistFlow.eventOutfit.photosTitle')}</ThemedText>
      <ThemedText style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
        {t('stylistFlow.eventOutfit.photosSubtitle')}
      </ThemedText>

      <View style={styles.pieceGrid}>
        {Array.from({ length: flow.getUploadLimit() }).map((_, index) => {
          const uri = flow.images[index];
          return uri ? (
            <View key={index} style={styles.pieceSlotFilled}>
              <Image source={{ uri }} style={styles.pieceImage} />
              <Pressable onPress={() => flow.handleRemoveImage(index)} style={styles.removeBadge}>
                <Feather name="x" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              key={index}
              onPress={flow.handlePickImage}
              style={[styles.pieceSlotEmpty, { borderColor: theme.border }]}
            >
              <Feather name="plus" size={22} color={theme.tabIconDefault} />
            </Pressable>
          );
        })}
      </View>

      {flow.images.length < flow.getUploadLimit() ? renderUploadActions() : null}

      <ThemedText type="body" style={styles.orLabel}>
        {t('stylistFlow.orFromWardrobe')}
      </ThemedText>

      <DecisionWardrobePicker
        items={flow.wardrobeItems}
        selectedIds={flow.selectedWardrobeIds}
        onToggle={flow.toggleWardrobeItem}
        maxItems={flow.getWardrobeSelectLimit?.() ?? MAX_DECISION_WARDROBE_ITEMS}
        disabled={flow.isReadOnly}
      />

      <View style={styles.surpriseSection}>
        <ThemedText type="caption" style={[styles.orLabel, { color: theme.tabIconDefault }]}>
          {t('stylistFlow.or')}
        </ThemedText>
        <Pressable
          onPress={() => flow.submitDecision(true)}
          disabled={flow.isLoading}
          style={({ pressed }) => [styles.surpriseButton, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient colors={[LuxuryColors.gold, LuxuryColors.deepGold]} style={styles.surpriseGradient}>
            <ThemedText type="body" style={styles.surpriseText}>
              {t('stylistFlow.surpriseMe')}
            </ThemedText>
          </LinearGradient>
        </Pressable>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault, textAlign: 'center' }}>
          {t('stylistFlow.surpriseMeHint')}
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderEventStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
      <ThemedText type="h3">{t('stylistFlow.eventOutfit.detailsTitle')}</ThemedText>
      <ThemedText style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
        {t('stylistFlow.eventOutfit.detailsSubtitle')}
      </ThemedText>

      <ThemedText type="small" style={styles.fieldLabel}>
        {t('stylistFlow.eventType')}
      </ThemedText>
      <View style={styles.chipRow}>
        {EVENT_TYPES.map((type) => (
          <Pressable
            key={type.id}
            onPress={() => flow.setEventDetails((p) => ({ ...p, eventType: type.id }))}
            style={[
              styles.chip,
              { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
              flow.eventDetails.eventType === type.id && styles.chipSelected,
            ]}
          >
            <ThemedText
              type="small"
              style={flow.eventDetails.eventType === type.id ? styles.chipTextSelected : undefined}
            >
              {t(type.labelKey)}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" style={styles.fieldLabel}>
        {t('stylistFlow.dressCode')}
      </ThemedText>
      <View style={styles.chipRow}>
        {DRESS_CODES.map((code) => (
          <Pressable
            key={code.id}
            onPress={() => flow.setEventDetails((p) => ({ ...p, dressCode: code.id }))}
            style={[
              styles.chip,
              { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
              flow.eventDetails.dressCode === code.id && styles.chipSelected,
            ]}
          >
            <ThemedText
              type="small"
              style={flow.eventDetails.dressCode === code.id ? styles.chipTextSelected : undefined}
            >
              {t(code.labelKey)}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" style={styles.fieldLabel}>
        {t('stylistFlow.timeOfDay')}
      </ThemedText>
      <View style={styles.chipRow}>
        {TIME_OPTIONS.map((time) => (
          <Pressable
            key={time.id}
            onPress={() => flow.setEventDetails((p) => ({ ...p, timeOfDay: time.id }))}
            style={[
              styles.chip,
              { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
              flow.eventDetails.timeOfDay === time.id && styles.chipSelected,
            ]}
          >
            <ThemedText
              type="small"
              style={flow.eventDetails.timeOfDay === time.id ? styles.chipTextSelected : undefined}
            >
              {t(time.labelKey)}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={[
          styles.textInput,
          { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border },
        ]}
        placeholder={t('stylistFlow.venuePlaceholder')}
        placeholderTextColor={theme.tabIconDefault}
        value={flow.eventDetails.venue}
        onChangeText={(venue) => flow.setEventDetails((p) => ({ ...p, venue }))}
      />

      <View style={styles.contextBlock}>
        <ThemedText type="body" style={styles.contextBlockTitle}>
          {t('stylistFlow.contextTitle')}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
          {t('stylistFlow.contextEventSubtitle')}
        </ThemedText>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border },
          ]}
          placeholder={t('common.addAnyExtraDetailsOptional')}
          placeholderTextColor={theme.tabIconDefault}
          value={flow.contextNotes}
          onChangeText={flow.setContextNotes}
          multiline
          numberOfLines={3}
          maxLength={200}
          editable={!flow.isReadOnly}
        />
      </View>
    </Animated.View>
  );

  const renderResponse = () => {
    const res = flow.response;
    if (!res) return null;

    const stylistName = getStylistName(res.stylistId || flow.user?.stylistPreferences?.selectedStylistId || 'ruby');
    const stylistIcon = getStylistIcon(res.stylistId);
    const stylistGradient = getStylistGradient(res.stylistId);
    const textReject = isOutfitRejectedByStylist(
      `${res.recommendation || ''} ${res.reasoning || ''} ${res.stylistNote || ''}`,
    );
    // DO_NOT_BUY / already-owned is a shopping verdict — NEVER formal SHOP_REQUIRED UI.
    const displayState = resolveStylistResultDisplayState(res, decisionType, { textReject });

    // State 3: SHOP_REQUIRED — event gaps only. Sanity check is EVALUATE_OUTFIT — never shop UI.
    if (displayState === 'SHOP_REQUIRED' && decisionType !== 'sanity-check') {
      const gapCopy = sanitizeStylistUserText(
        res.recommendation || res.stylistNote || res.reasoning
        || "You don't currently own suitable pieces for this occasion.",
      )
        .replace(/\s*[—–-]\s*or save this look once you have( the pieces| them)?\.?/gi, '')
        .replace(/\s*or save this look once you have( the pieces| them)\.?/gi, '')
        .trim();
      const recommended = res.recommendedOutfit || null;
      const shopMissing = Array.isArray(res.missing) && res.missing.length
        ? res.missing
        : (res.suggestions || res.missingPieces || []).map((tip) => ({
          role: 'piece',
          label: typeof tip === 'string' ? tip : String(tip),
          reason: 'Needed for this occasion',
        }));
      const inspirationRows = recommended
        ? Object.entries(recommended).filter(([, v]) => !!v)
        : [];
      const isWoman = flow.user?.gender === 'woman'
        || res.gender === 'female'
        || res.gender === 'woman';
      const shopHero = isWoman
        ? require('../../assets/images/editorial-fullbody/female_work_formal_fullbody.png')
        : require('../../assets/images/editorial-fullbody/male_date_evening_fullbody.png');
      const styleGender = flow.user?.gender === 'man'
        ? 'male'
        : flow.user?.gender === 'woman'
          ? 'female'
          : (res.gender || flow.user?.gender || null);
      const dressLabel = res.retailOutfit?.dressCodeLabel
        || res.retailOutfit?.dressCodeKey
        || null;
      const shopHeadline = dressLabel
        ? (t('stylistFlow.shopSuggestedForDressCode') || 'Pieces to match {code}')
          .replace('{code}', String(dressLabel).replace(/_/g, ' '))
        : (t('stylistFlow.shopRecreateLook') || t('stylistFlow.shopPiecesToMatch') || 'Recreate this look');

      return (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
          <View style={styles.stylistHeader}>
            <LinearGradient colors={stylistGradient} style={styles.stylistAvatar}>
              <Feather name={stylistIcon} size={24} color="#FFFFFF" />
            </LinearGradient>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {stylistName}
            </ThemedText>
          </View>

          {res.retailOutfit?.products?.length || res.retailOutfit?.outfit ? (
            <>
              <RetailOutfitSection
                retailOutfit={res.retailOutfit}
                recommendedOutfit={recommended}
                dressCode={res.retailOutfit?.dressCodeKey || undefined}
                gender={styleGender}
                requestPreview
                fallbackHeroSource={shopHero}
                headline={shopHeadline}
                heroCaption={null}
                lead={
                  <View style={[styles.responseCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                    <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
                      {t('stylistFlow.shopGapTitle') || 'Recreate this look'}
                    </ThemedText>
                    <ThemedText type="body" style={styles.responseBody}>
                      {gapCopy}
                    </ThemedText>
                  </View>
                }
                footerNote={(
                  <ThemedText type="small" style={{ color: theme.tabIconDefault, marginTop: Spacing.xs, marginBottom: Spacing.sm }}>
                    {t('shoppable.noCommissionDisclosure')
                      || 'Dripn does not earn commission on purchases via Buy links.'}
                  </ThemedText>
                )}
              />
              {Array.isArray(res.nearbyStores) && res.nearbyStores.length > 0 ? (
                <FallbackShopSection
                  missing={[]}
                  headline="Curated stores"
                  gender={styleGender}
                  dressCode={res.retailOutfit?.dressCodeKey || 'formal'}
                  nearbyStores={res.nearbyStores}
                />
              ) : null}
            </>
          ) : (
            <>
              <Image
                source={shopHero}
                style={styles.responseHero}
                resizeMode="cover"
              />
              <View style={[styles.responseCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
                  {t('stylistFlow.shopGapTitle') || 'Recreate this look'}
                </ThemedText>
                <ThemedText type="body" style={styles.responseBody}>
                  {gapCopy}
                </ThemedText>
                {inspirationRows.length > 0 ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
                      {t('stylistFlow.shopRoleSuggestions') || 'Look for these roles instead'}
                    </ThemedText>
                    {inspirationRows.map(([role, label]) => (
                      <ThemedText key={role} type="body" style={{ marginBottom: Spacing.xs }}>
                        {formatOutfitPieceRoleLabel(role)}: {editorialGarmentName(String(label || ''))}
                      </ThemedText>
                    ))}
                  </View>
                ) : null}
              </View>
              {shopMissing.length > 0 ? (
                <FallbackShopSection
                  missing={shopMissing}
                  headline={t('stylistFlow.shopPiecesToMatch') || 'Pieces to match this style'}
                  gender={styleGender}
                  dressCode={res.retailOutfit?.dressCodeKey || 'formal'}
                  nearbyStores={res.nearbyStores || null}
                />
              ) : null}
            </>
          )}

          {Array.isArray(res.retailers) && res.retailers.length > 0 ? (
            <View style={{ marginTop: Spacing.sm, gap: Spacing.xs }}>
              <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
                Shop at
              </ThemedText>
              {res.retailers.slice(0, 4).map((r) => (
                <Pressable
                  key={r.name || r.url}
                  onPress={() => {
                    if (r.url) {
                      Linking.openURL(r.url).catch(() => {});
                    }
                  }}
                  style={styles.secondaryButton}
                >
                  <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                    {r.name || 'Shop'}
                    {r.items?.length ? ` — ${r.items.slice(0, 2).join(', ')}` : ''}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.responseActions}>
            {renderPrimaryButton('Save this look', () => flow.completeAndClose())}
            <Pressable onPress={() => flow.rejectAndClose()} style={styles.secondaryButton}>
              <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                {t('outfitFeedback.dontLike') || "Don't like"}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => { void flow.editAndRerun(); }} style={styles.secondaryButton}>
              <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                {t('stylistFlow.editAndRerun')}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => flow.resetFlow()} style={styles.secondaryButton}>
              <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                {t('stylistFlow.startOver')}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      );
    }

    const uploaded = res.uploadedImages || flow.images || [];
    const allPieces = sanitizeOutfitPieces(res.outfitPieces || []);
    // QSC launch: never treat the result as a wardrobe replacement strip.
    const rejected = decisionType !== 'sanity-check' && displayState === 'REJECTED_WARDROBE_FIX';
    const recommendedPieces = allPieces.filter((p) => p.type === 'recommended');
    const ownedPieces = allPieces.filter((p) => p.type !== 'recommended');
    // State 2: hide user outfit; show stylist wardrobe rebuild
    const displayPieces = decisionType === 'sanity-check'
      ? []
      : rejected
        ? (ownedPieces.length > 0 ? ownedPieces : recommendedPieces)
        : allPieces;
    const visualPieces = decisionType === 'sanity-check'
      ? []
      : rejected
        ? (ownedPieces.length > 0 ? ownedPieces : recommendedPieces).filter(
          (p) => p.wardrobeItemId != null || p.imageUrl,
        )
        : (ownedPieces.length > 0 ? ownedPieces : allPieces.filter((p) => p.wardrobeItemId != null));

    const winnerUri = rejected
      ? null
      : (
        res.recommendedIndex != null
        && res.recommendedIndex >= 0
        && res.recommendedIndex < uploaded.length
          ? uploaded[res.recommendedIndex]
          : uploaded.length === 1
            ? uploaded[0]
            : null
      );

    const qscRating = decisionType === 'sanity-check' && res.styleRating != null && Number.isFinite(Number(res.styleRating))
      ? Number(res.styleRating)
      : null;
    const qscPercent = qscRating != null ? Math.round(qscRating * 10) : null;

    return (
      <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
        <View style={styles.stylistHeader}>
          <LinearGradient colors={stylistGradient} style={styles.stylistAvatar}>
            <Feather name={stylistIcon} size={24} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
            {stylistName}
          </ThemedText>
          {(res.decisionConfidence?.label || res.confidenceNote) ? (
            <View style={styles.confidenceRow}>
              <ThemedText type="caption" style={[styles.confidenceLabel, { color: LuxuryColors.gold }]}>
                {res.decisionConfidence?.label
                  || (res.aiEnhanced ? 'Full look check' : 'Quick brief check')}
              </ThemedText>
              {res.confidenceNote || res.decisionConfidence?.note ? (
                <ThemedText type="caption" style={{ color: theme.tabIconDefault, textAlign: 'center' }}>
                  {res.confidenceNote || res.decisionConfidence?.note}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>

        {rejected ? (
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
            {t('stylistFlow.wearThisInstead') || 'Wear this instead'}
          </ThemedText>
        ) : null}

        {rejected && (res.changeNote || res.displayMeta?.changeNote) ? (
          <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
            {res.changeNote || res.displayMeta?.changeNote}
          </ThemedText>
        ) : null}

        {decisionType === 'shopping' && !rejected && uploaded.length > 1 ? (
          <View style={styles.responseOptionsRow}>
            {uploaded.map((uri, index) => {
              const labelMeta = (res.optionLabels || res.purchaseDecision?.optionLabels || [])
                .find((l) => l.optionIndex === index);
              const labelKey = labelMeta?.label || (
                res.recommendedIndex === index
                  ? 'recommended'
                  : (res.alreadyOwned || []).some((e) => e.optionIndex === index)
                    ? 'already_owned'
                    : 'not_suitable'
              );
              const badge =
                labelKey === 'recommended'
                  ? 'Best choice'
                  : labelKey === 'already_owned'
                    ? 'Already owned'
                    : labelKey === 'not_suitable'
                      ? 'Not suitable'
                      : `Option ${index + 1}`;
              const isReject = labelKey === 'already_owned' || labelKey === 'not_suitable';
              const isWinner = labelKey === 'recommended' || res.recommendedIndex === index;
              return (
                <View
                  key={`${uri}-${index}`}
                  style={[styles.responseOptionCol, isReject ? { opacity: 0.55 } : null]}
                >
                  <Image
                    source={{ uri }}
                    style={[
                      styles.responseOptionThumb,
                      isWinner
                        ? { borderWidth: 2, borderColor: LuxuryColors.gold }
                        : null,
                    ]}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      marginTop: 4,
                      color: isWinner ? LuxuryColors.gold : theme.tabIconDefault,
                      textAlign: 'center',
                    }}
                  >
                    {badge}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ) : winnerUri ? (
          <Image source={{ uri: winnerUri }} style={styles.responseHero} />
        ) : !rejected && uploaded.length > 1 ? (
          <View style={styles.responseOptionsRow}>
            {uploaded.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.responseOptionCol}>
                <Image source={{ uri }} style={styles.responseOptionThumb} />
              </View>
            ))}
          </View>
        ) : res.outfitImageUrl && !rejected ? (
          <Image source={{ uri: res.outfitImageUrl }} style={styles.responseHero} />
        ) : visualPieces.length > 0 ? (
          <SafeOutfitPieces
            pieces={visualPieces}
            wardrobeItems={flow.wardrobeItems}
            large
            label={rejected ? '' : 'Your outfit'}
          />
        ) : null}

        <View style={[styles.responseCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          {qscPercent != null ? (
            <View style={styles.styleRatingRow}>
              <View style={[styles.styleRatingBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText type="h2" style={[styles.styleRatingNumber, { color: LuxuryColors.gold }]}>
                  {`${qscPercent}%`}
                </ThemedText>
              </View>
              {res.ratingLabel ? (
                <ThemedText type="body" style={[styles.styleRatingLabel, { color: theme.text }]}>
                  {sanitizeStylistUserText(res.ratingLabel)}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {decisionType === 'shopping' && uploaded.length > 1 ? (
            <ThemedText type="body" style={styles.responseBody}>
              {sanitizeStylistUserText(
                res.presentation?.body
                || res.message
                || res.shoppingDecision?.message
                || res.shoppingDecision?.text
                || res.recommendation
                || res.decision
                || '',
              )}
            </ThemedText>
          ) : null}

          {/* Single-option shopping ownership (full DO_NOT_BUY) — never used for multi-compare */}
          {decisionType === 'shopping'
            && uploaded.length <= 1
            && Array.isArray(res.alreadyOwned)
            && res.alreadyOwned.length > 0 ? (
            <View style={{ marginBottom: Spacing.md }}>
              <ThemedText type="small" style={{ color: theme.link, marginBottom: Spacing.xs }}>
                {res.alreadyOwned[0]?.confidenceLabel
                  || res.ownershipDecision?.message
                  || t('wardrobe.alreadyOwnPurchase')
                  || 'You already own this'}
              </ThemedText>
              {(res.alreadyOwned[0]?.confidencePercent != null
                || res.purchaseDecision?.confidencePercent != null) ? (
                <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
                  {`${res.alreadyOwned[0]?.confidencePercent
                    ?? res.purchaseDecision?.confidencePercent}% match`}
                </ThemedText>
              ) : null}
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                {res.alreadyOwned[0]?.coverage?.explanation
                  || res.alreadyOwned[0]?.message
                  || (t('wardrobe.alreadyOwnPurchaseMessage')
                    || 'One or more photos look like items already in your wardrobe: {names}. We won\'t treat these as new gaps to fill.')
                    .replace(
                      '{names}',
                      res.alreadyOwned
                        .flatMap((entry) => (entry.matches || []).map((m) => m.name || 'item'))
                        .filter(Boolean)
                        .slice(0, 4)
                        .join(', '),
                    )}
              </ThemedText>

              {res.alreadyOwned.map((entry) => {
                const shopUri = uploaded[entry.optionIndex] || (uploaded.length === 1 ? uploaded[0] : null);
                const match = entry.comparison?.wardrobeItem || entry.matches?.[0];
                const wardrobeUri = match?.imageUrl || null;
                if (!shopUri && !wardrobeUri) return null;
                return (
                  <View
                    key={`owned-compare-single-${entry.optionIndex}`}
                    style={{
                      flexDirection: 'row',
                      gap: Spacing.sm,
                      marginBottom: Spacing.sm,
                      alignItems: 'stretch',
                    }}
                  >
                    {shopUri ? (
                      <View style={{ flex: 1 }}>
                        <Image
                          source={{ uri: shopUri }}
                          style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      </View>
                    ) : null}
                    {wardrobeUri ? (
                      <View style={{ flex: 1 }}>
                        <Image
                          source={{ uri: String(wardrobeUri) }}
                          style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                        <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: 4 }}>
                          {match?.name || 'In your wardrobe'}
                          {entry.confidencePercent != null ? ` · ${entry.confidencePercent}%` : ''}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                );
              })}

              <View style={{ gap: Spacing.sm }}>
                <Pressable
                  onPress={() => {
                    const ownedIds = res.alreadyOwned!
                      .flatMap((entry) => (entry.matches || []).map((m) => m.id))
                      .filter((id): id is string | number => id != null)
                      .map(String);
                    const firstId = ownedIds[0];
                    if (firstId) {
                      try {
                        navigation.navigate?.('WardrobeItemDetail', { itemId: firstId });
                        return;
                      } catch { /* fall through */ }
                    }
                    try {
                      navigation.navigate?.('OutfitCalendar', {
                        seedWardrobeItemIds: ownedIds,
                        fromAlreadyOwned: true,
                      });
                    } catch {
                      navigation.navigate?.('Wardrobe');
                    }
                  }}
                  style={[styles.secondaryButton, { borderColor: LuxuryColors.gold }]}
                >
                  <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                    {t('wardrobe.useWhatIHave') || 'Use what I have'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void flow.continueInChat({
                      seedMessage:
                        t('wardrobe.showAlternativesSeed')
                        || 'I already own something similar to what I was considering. Show me different styles / alternatives instead of buying a near-duplicate.',
                    });
                  }}
                  style={styles.secondaryButton}
                >
                  <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                    {t('wardrobe.showAlternatives') || 'Show alternatives'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {decisionType === 'shopping' && uploaded.length > 1 ? null : (() => {
            const summary = sanitizeStylistUserText(res.stylistNote || res.outfitSummary || '');
            const summaryIsNameList = looksLikeItemNameList(summary);
            // Single message field preferred — never prefer legacy reasoning over bound message
            let recommendation = res.presentation?.body
              || sanitizeStylistUserText(
                res.message || res.recommendation || res.decision || '',
              );
            const reasoning = (res.message || res.outfitId)
              ? ''
              : sanitizeStylistUserText(res.reasoning || '');
            // Heading already says Wear this instead — don't repeat it in the body
            if (rejected) {
              recommendation = recommendation
                .replace(/^Wear this instead\s*[—–-]?\s*/i, '')
                .trim();
            }
            // Always present professional sentence case after lead strip / sanitise
            recommendation = recommendation.replace(
              /(^|[.!?]\s+|—\s*|–\s*)([a-z])/g,
              (_, lead, ch) => `${lead}${ch.toUpperCase()}`,
            );
            const headline = summary && !summaryIsNameList ? summary : null;
            const analysis = rejected
              ? recommendation
              : (
                reasoning
                || (recommendation && !looksLikeItemNameList(recommendation.split('\n\n')[0] || '')
                  ? recommendation
                  : '')
              );
            const showPieceRows = decisionType !== 'sanity-check' && displayPieces.length > 0;

            return (
              <>
                {headline && !rejected ? (
                  <ThemedText type="body" style={styles.responseBody}>
                    {headline}
                  </ThemedText>
                ) : null}

                {showPieceRows ? (
                  <View style={{ marginTop: headline ? Spacing.md : 0 }}>
                    {displayPieces.map((piece, index) => (
                      <View key={`piece-${piece.wardrobeItemId || piece.name || index}`} style={{ marginBottom: Spacing.xs }}>
                        <ThemedText type="body">
                          {formatOutfitPieceRoleLabel(piece.role)}
                          {': '}
                          {editorialGarmentName(piece.name || '', { brand: (piece as { brand?: string }).brand })}
                          {piece.type === 'recommended' ? ' · recommended' : ''}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}

                {analysis ? (
                  <ThemedText
                    type="body"
                    style={[
                      rejected ? styles.responseBody : styles.reasoning,
                      {
                        color: rejected ? theme.text : theme.tabIconDefault,
                        // QSC: keep card padding even — no extra top margin on the verdict text.
                        marginTop: decisionType === 'sanity-check'
                          ? 0
                          : Spacing.md,
                      },
                    ]}
                  >
                    {renderMarkdownText(analysis)}
                  </ThemedText>
                ) : null}

                {!rejected && !headline && !analysis && recommendation ? (
                  <ThemedText
                    type="body"
                    style={[
                      styles.responseBody,
                      {
                        marginTop: decisionType === 'sanity-check' ? 0 : Spacing.md,
                      },
                    ]}
                  >
                    {renderMarkdownText(recommendation)}
                  </ThemedText>
                ) : null}
              </>
            );
          })()}
        </View>

        {(rejected && Array.isArray(res.missing) && res.missing.length > 0) ? (
          <FallbackShopSection
            missing={res.missing}
            headline="Optional upgrades"
          />
        ) : null}

        <View style={styles.responseActions}>
          {(() => {
            const isQsc = decisionType === 'sanity-check';
            const showFollowUp =
              (isQsc && shouldShowSanityFollowUpCta(res))
              || decisionType === 'event-outfit'
              || decisionType === 'shopping';
            const followUpLabel = (t('stylistFlow.refineWithStylist') || 'Refine this — {name}').replace(
              '{name}',
              stylistName,
            );

            if (flow.isStale) {
              return (
                <>
                  {renderPrimaryButton(
                    t('stylistFlow.refreshRecommendation'),
                    () => flow.refreshStaleRecommendation(),
                    false,
                    flow.isLoading,
                  )}
                  {showFollowUp
                    ? renderPrimaryButton(followUpLabel, () => {
                        void flow.continueInChat();
                      })
                    : null}
                  <Pressable onPress={() => flow.completeAndClose()} style={styles.secondaryButton}>
                    <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                      {t('stylistFlow.done')}
                    </ThemedText>
                  </Pressable>
                  {!isQsc ? (
                    <>
                      <Pressable onPress={() => flow.rejectAndClose()} style={styles.secondaryButton}>
                        <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                          {t('outfitFeedback.dontLike') || "Don't like"}
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => { void flow.editAndRerun(); }} style={styles.secondaryButton}>
                        <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                          {t('stylistFlow.editAndRerun')}
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => flow.resetFlow()} style={styles.secondaryButton}>
                        <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                          {t('stylistFlow.startOver')}
                        </ThemedText>
                      </Pressable>
                    </>
                  ) : null}
                </>
              );
            }

            return (
              <>
                {showFollowUp
                  ? renderPrimaryButton(followUpLabel, () => {
                      void flow.continueInChat();
                    })
                  : null}
                {showFollowUp ? (
                  <Pressable onPress={() => flow.completeAndClose()} style={styles.secondaryButton}>
                    <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                      {t('stylistFlow.done')}
                    </ThemedText>
                  </Pressable>
                ) : (
                  renderPrimaryButton(t('stylistFlow.done'), () => flow.completeAndClose())
                )}
                {!isQsc ? (
                  <>
                    <Pressable onPress={() => flow.rejectAndClose()} style={styles.secondaryButton}>
                      <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                        {t('outfitFeedback.dontLike') || "Don't like"}
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => { void flow.editAndRerun(); }} style={styles.secondaryButton}>
                      <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                        {t('stylistFlow.editAndRerun')}
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => flow.resetFlow()} style={styles.secondaryButton}>
                      <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                        {t('stylistFlow.startOver')}
                      </ThemedText>
                    </Pressable>
                  </>
                ) : null}
              </>
            );
          })()}
        </View>
      </Animated.View>
    );
  };

  return (
    // Keyboard-aware tree (NOT absolute footer):
    // flex column → KeyboardAwareScrollView → KeyboardStickyView → SafeAreaView → Continue
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScreenKeyboardAwareScrollView
        ref={scrollRef}
        style={styles.flex}
        opaqueHeader
        keyboardDismissMode="on-drag"
        bottomOffset={stickyCta ? stickyFooterClearance : 0}
        extraKeyboardSpace={stickyCta ? Spacing.sm : 0}
        // Extra space so last fields clear the sticky CTA; tab/safe clearance is on the footer
        contentContainerStyle={[
          styles.scrollContent,
          stickyCta ? styles.scrollContentWithStickyCta : null,
        ]}
      >
        <LinearGradient
          colors={[LuxuryColors.champagne, theme.backgroundRoot]}
          style={styles.heroBanner}
        >
          <View style={styles.heroTitleRow}>
            <ThemedText type="h2" style={{ flex: 1 }}>{introCopy.title}</ThemedText>
            {!flow.isReadOnly ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  flow.resetFlow();
                }}
                hitSlop={8}
              >
                <ThemedText type="caption" style={{ color: theme.tabIconDefault, fontWeight: '600' }}>
                  {t('stylistFlow.startOver') || 'Start over'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          <ThemedText style={[styles.heroSubtitle, { color: theme.tabIconDefault }]}>
            {introCopy.subtitle}
          </ThemedText>
          {flow.step !== 'response' ? renderProgress() : null}
        </LinearGradient>

        {flow.allowanceBlocked && flow.step !== 'response' ? (
          <AiAllowanceBlockedBanner
            tier={flow.user?.subscriptionTier}
            onPrimary={() => flow.openAllowanceDestination()}
            onSecondary={() => flow.resetFlow()}
            secondaryLabel={t('stylistFlow.startOver') || 'Start over'}
          />
        ) : null}

        {flow.isStale ? (
          <View style={[styles.staleBanner, { backgroundColor: '#FFF4E5', borderColor: LuxuryColors.gold }]}>
            <Feather name="alert-circle" size={16} color={LuxuryColors.deepGold} />
            <ThemedText type="caption" style={{ color: LuxuryColors.obsidian, flex: 1 }}>
              {t('stylistFlow.staleBanner')}
            </ThemedText>
          </View>
        ) : null}

        {flow.brokenImageCount > 0 && !flow.isReadOnly ? (
          <View style={[styles.staleBanner, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Feather name="image" size={16} color={theme.tabIconDefault} />
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, flex: 1 }}>
              {t('stylistFlow.brokenImagesBanner').replace('{n}', String(flow.brokenImageCount))}
            </ThemedText>
          </View>
        ) : null}

        {flow.step === 'event' ? renderEventStep() : null}
        {flow.step === 'input' && decisionType === 'shopping' ? renderShoppingInput() : null}
        {flow.step === 'input' && decisionType === 'sanity-check' ? renderSanityInput() : null}
        {flow.step === 'input' && decisionType === 'event-outfit' ? renderEventInput() : null}
        {flow.step === 'response' ? renderResponse() : null}

        {flow.accessStatus && normalizeSubscriptionTier(flow.user?.subscriptionTier) === 'free' ? (
          <View style={[styles.limitBanner, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={14} color={theme.tabIconDefault} />
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, flex: 1 }}>
              {decisionService.getDecisionPickerFooterCopy()}
            </ThemedText>
          </View>
        ) : null}
      </ScreenKeyboardAwareScrollView>

      {stickyCta ? (
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <SafeAreaView
            // Tab bar already clears the home indicator; when keyboard is up the keys own the bottom.
            edges={hasTabBar || isKeyboardVisible ? [] : ['bottom']}
            style={[
              styles.stickyFooter,
              {
                paddingBottom: isKeyboardVisible
                  ? Math.max(Spacing.md, Platform.OS === 'ios' ? Spacing.sm : Spacing.md)
                  : hasTabBar
                    ? tabAwarePaddingBottom
                    : Spacing.md,
                backgroundColor: theme.backgroundRoot,
                borderTopColor: theme.border,
              },
            ]}
          >
            {renderPrimaryButton(stickyCta.label, stickyCta.onPress, false, stickyCta.loading)}
          </SafeAreaView>
        </KeyboardStickyView>
      ) : null}

      <SurpriseMeLoadingOverlay
        visible={flow.isLoading && flow.isSurpriseMe}
        stylistId={stylistId}
        stylistName={stylistName}
        stylistGradient={stylistGradient}
        stylistIcon={stylistIcon}
      />

      <Modal
        visible={flow.showUpgradeModal}
        transparent
        animationType="slide"
        onRequestClose={flow.dismissPaywall}
      >
        <Pressable style={styles.modalOverlay} onPress={flow.dismissPaywall}>
          <Pressable style={styles.upgradeModal} onPress={(e) => e.stopPropagation()}>
            <LinearGradient colors={[LuxuryColors.gold, LuxuryColors.deepGold]} style={styles.upgradeGradient}>
              <Feather name="unlock" size={28} color={LuxuryColors.obsidian} />
              <ThemedText type="h3" style={styles.upgradeTitle}>
                {decisionService.getUpgradeCopy().headline}
              </ThemedText>
              <ThemedText style={styles.upgradeBody}>
                {flow.accessStatus?.reason || t('stylistFlow.upgradeDefault')}
              </ThemedText>
              <Pressable onPress={flow.openSubscriptionFromPaywall} style={styles.upgradeCta}>
                <ThemedText type="body" style={styles.upgradeCtaText}>
                  {decisionService.getUpgradeCopy().cta}
                </ThemedText>
              </Pressable>
              <Pressable onPress={flow.dismissPaywall}>
                <ThemedText type="small" style={styles.upgradeDismiss}>
                  {t('common.maybeLater')}
                </ThemedText>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    // Do NOT set paddingBottom here — ScreenKeyboardAwareScrollView already applies
    // tab-bar-aware bottom inset. Overriding it hides the CTA under the absolute tab bar.
  },
  scrollContentWithStickyCta: {
    // Sticky CTA is a flex sibling (not absolute) — small gap above the footer is enough.
    // Override tab-aware paddingBottom from ScreenKeyboardAwareScrollView (footer owns that).
    paddingBottom: Spacing.xl,
  },
  stickyFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  heroBanner: {
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroSubtitle: {
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  progressRow: {
    gap: Spacing.xs,
  },
  progressBlock: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  stepBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionSubtitle: {
    lineHeight: 20,
  },
  fieldLabel: {
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: LuxuryColors.gold,
    borderColor: LuxuryColors.deepGold,
  },
  chipTextSelected: {
    color: LuxuryColors.obsidian,
    fontWeight: '600',
  },
  contextBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  contextBlockTitle: {
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  uploadActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  uploadDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: Spacing.xs,
  },
  uploadAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 88,
  },
  uploadActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadActionLabel: {
    fontWeight: '600',
  },
  optionsStack: {
    gap: Spacing.md,
  },
  optionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  optionLabel: {
    fontWeight: '600',
  },
  optionImageWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  optionImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orLabel: {
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  heroImageWrap: {
    alignSelf: 'center',
    position: 'relative',
  },
  heroImage: {
    width: SCREEN_WIDTH - Spacing.xl * 2,
    height: (SCREEN_WIDTH - Spacing.xl * 2) * 1.1,
    borderRadius: BorderRadius.lg,
  },
  pieceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pieceSlotEmpty: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceSlotFilled: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  pieceImage: {
    width: '100%',
    height: '100%',
  },
  surpriseSection: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  surpriseButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  surpriseGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  surpriseText: {
    color: LuxuryColors.obsidian,
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stylistHeader: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  confidenceRow: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: 2,
    maxWidth: '92%',
  },
  confidenceLabel: {
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  stylistAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseHero: {
    width: '100%',
    height: 280,
    borderRadius: BorderRadius.lg,
  },
  responseOptionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  responseOptionCol: {
    flex: 1,
  },
  responseOptionThumb: {
    width: '100%',
    height: 140,
    borderRadius: BorderRadius.md,
  },
  responseCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  styleRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    // Equal space around the separator — card gap handles space to verdict text.
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  styleRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  styleRatingNumber: {
    fontWeight: '700',
  },
  styleRatingLabel: {
    flex: 1,
    fontWeight: '500',
  },
  responseBody: {
    lineHeight: 22,
  },
  reasoning: {
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  responseActions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  upgradeModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  upgradeGradient: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  upgradeTitle: {
    color: LuxuryColors.obsidian,
    textAlign: 'center',
  },
  upgradeBody: {
    color: LuxuryColors.obsidian,
    textAlign: 'center',
    opacity: 0.85,
  },
  upgradeCta: {
    backgroundColor: LuxuryColors.obsidian,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    width: '100%',
    alignItems: 'center',
  },
  upgradeCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  upgradeDismiss: {
    color: LuxuryColors.obsidian,
    opacity: 0.7,
  },
});
