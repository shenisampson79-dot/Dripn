import React, { useMemo } from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { SafeOutfitPieces } from '@/components/SafeOutfitPieces';
import { SurpriseMeLoadingOverlay } from '@/components/SurpriseMeLoadingOverlay';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useTranslations } from '@/contexts/TranslationContext';
import { DecisionType } from '@/services/DecisionService';
import { decisionService } from '@/services/DecisionService';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { useStylistDecision } from '@/hooks/useStylistDecision';
import { sanitizeOutfitPieces } from '@/utils/safeRender';
import { DecisionWardrobePicker } from '@/components/stylist/DecisionWardrobePicker';
import { FallbackShopSection } from '@/components/stylist/FallbackShopSection';
import { MAX_DECISION_WARDROBE_ITEMS } from '@/utils/decisionWardrobeGroups';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EVENT_TYPES = [
  { id: 'wedding', labelKey: 'stylistFlow.event.wedding' },
  { id: 'date', labelKey: 'stylistFlow.event.date' },
  { id: 'party', labelKey: 'stylistFlow.event.party' },
  { id: 'business', labelKey: 'stylistFlow.event.business' },
  { id: 'interview', labelKey: 'stylistFlow.event.interview' },
  { id: 'dinner', labelKey: 'stylistFlow.event.dinner' },
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

export default function StylistDecisionFlow({ decisionType, navigation }: StylistDecisionFlowProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { paddingBottom: tabAwarePaddingBottom, hasTabBar } = useScreenInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const flow = useStylistDecision({ decisionType, navigation });

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
            <Feather name="shuffle" size={18} color={LuxuryColors.obsidian} />
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

      {renderContextChips(t('stylistFlow.contextEventSubtitle'))}
    </Animated.View>
  );

  const renderResponse = () => {
    const res = flow.response;
    if (!res) return null;

    const stylistName = getStylistName(res.stylistId || flow.user?.stylistPreferences?.selectedStylistId || 'ruby');
    const stylistIcon = getStylistIcon(res.stylistId);
    const stylistGradient = getStylistGradient(res.stylistId);
    const isFallback =
      res.status === 'fallback_outfit'
      || res.type === 'fallback_outfit'
      || res.isFallback === true;
    const isGap =
      !isFallback
      && (
        res.status === 'wardrobe_gap'
        || res.status === 'no_outfit_possible'
        || res.status === 'refused'
        || res.status === 'clash_blocked'
        || res.status === 'no_wardrobe'
        || res.success === false
      );

    if (isGap) {
      const suggestions = res.suggestions || res.missingPieces || [];
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

          <View style={[styles.responseCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
              Wardrobe gap
            </ThemedText>
            <ThemedText type="body" style={styles.responseBody}>
              {res.recommendation || 'I won\'t recommend a look that misses this occasion. Add a few more polished pieces and try again.'}
            </ThemedText>
            {suggestions.length > 0 ? (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
                  Pieces that would help
                </ThemedText>
                {suggestions.map((tip) => (
                  <ThemedText key={tip} type="body" style={{ marginBottom: Spacing.xs }}>
                    · {tip}
                  </ThemedText>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.responseActions}>
            {renderPrimaryButton(
              t('stylistFlow.editAndRerun'),
              () => {
                void flow.editAndRerun();
              },
            )}
            <Pressable
              onPress={() => navigation.navigate?.('Wardrobe')}
              style={styles.secondaryButton}
            >
              <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                Open wardrobe
              </ThemedText>
            </Pressable>
            <Pressable onPress={flow.resetFlow} style={styles.secondaryButton}>
              <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                {t('stylistFlow.startOver')}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      );
    }

    const uploaded = res.uploadedImages || flow.images || [];
    const winnerUri =
      res.recommendedIndex != null
      && res.recommendedIndex >= 0
      && res.recommendedIndex < uploaded.length
        ? uploaded[res.recommendedIndex]
        : uploaded.length === 1
          ? uploaded[0]
          : null;

    const showRating =
      res.styleRating != null
      && Number(res.styleRating) > 5.4;

    const allPieces = sanitizeOutfitPieces(res.outfitPieces || []);
    const ownedPieces = allPieces.filter((p) => p.type !== 'recommended');
    const visualPieces = ownedPieces.length > 0 ? ownedPieces : allPieces.filter((p) => p.wardrobeItemId != null);

    return (
      <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
        {flow.isReadOnly ? (
          <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
            {t('stylistFlow.lastRecommendation')}
          </ThemedText>
        ) : null}
        <View style={styles.stylistHeader}>
          <LinearGradient colors={stylistGradient} style={styles.stylistAvatar}>
            <Feather name={stylistIcon} size={24} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
            {stylistName}
          </ThemedText>
        </View>

        {isFallback ? (
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
            Here&apos;s your best outfit — plus what to upgrade
          </ThemedText>
        ) : null}

        {winnerUri ? (
          <Image source={{ uri: winnerUri }} style={styles.responseHero} />
        ) : uploaded.length > 1 ? (
          <View style={styles.responseOptionsRow}>
            {uploaded.map((uri, index) => (
              <Image key={`${uri}-${index}`} source={{ uri }} style={styles.responseOptionThumb} />
            ))}
          </View>
        ) : res.outfitImageUrl ? (
          <Image source={{ uri: res.outfitImageUrl }} style={styles.responseHero} />
        ) : visualPieces.length > 0 ? (
          <SafeOutfitPieces
            pieces={visualPieces}
            wardrobeItems={flow.wardrobeItems}
            large
            label={isFallback ? 'Best from your wardrobe' : 'Your outfit'}
          />
        ) : null}

        <View style={[styles.responseCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          {Array.isArray(res.alreadyOwned) && res.alreadyOwned.length > 0 ? (
            <View style={{ marginBottom: Spacing.md }}>
              <ThemedText type="small" style={{ color: theme.link, marginBottom: Spacing.xs }}>
                {t('wardrobe.alreadyOwnPurchase') || 'You already own this'}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                {(t('wardrobe.alreadyOwnPurchaseMessage')
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
            </View>
          ) : null}
          {showRating ? (
            <View style={styles.ratingRow}>
              <ThemedText type="h2">{Number(res.styleRating).toFixed(1)}</ThemedText>
              <ThemedText type="small">/10</ThemedText>
              {res.ratingLabel ? (
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {res.ratingLabel}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {res.stylistNote || res.outfitSummary ? (
            <ThemedText type="body" style={styles.responseBody}>
              {res.stylistNote || res.outfitSummary}
            </ThemedText>
          ) : (
            <ThemedText type="body" style={styles.responseBody}>
              {renderMarkdownText(res.recommendation)}
            </ThemedText>
          )}

          {allPieces.length > 0 ? (
            <View style={{ marginTop: Spacing.md }}>
              {allPieces.map((piece, index) => (
                <View key={`piece-${piece.wardrobeItemId || piece.name || index}`} style={{ marginBottom: Spacing.xs }}>
                  <ThemedText type="body">
                    {(piece.role || 'Piece').charAt(0).toUpperCase() + (piece.role || 'piece').slice(1)}
                    {': '}
                    {piece.name}
                    {piece.type === 'recommended' ? ' · recommended' : ''}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {res.reasoning && !isFallback ? (
            <ThemedText style={[styles.reasoning, { color: theme.tabIconDefault }]}>
              {renderMarkdownText(res.reasoning)}
            </ThemedText>
          ) : null}
        </View>

        {isFallback ? <FallbackShopSection missing={res.missing} /> : null}

        <View style={styles.responseActions}>
          {flow.isStale ? (
            <>
              {renderPrimaryButton(
                t('stylistFlow.refreshRecommendation'),
                () => flow.refreshStaleRecommendation(),
                false,
                flow.isLoading,
              )}
              {renderPrimaryButton(
                t('stylistFlow.yesHelpMe').replace('{name}', stylistName),
                () => {
                  void flow.continueInChat();
                },
              )}
              <Pressable onPress={flow.editAndRerun} style={styles.secondaryButton}>
                <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                  {t('stylistFlow.editAndRerun')}
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              {renderPrimaryButton(
                t('stylistFlow.yesHelpMe').replace('{name}', stylistName),
                () => {
                  void flow.continueInChat();
                },
              )}
              <Pressable onPress={() => flow.completeAndClose()} style={styles.secondaryButton}>
                <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                  {t('stylistFlow.done')}
                </ThemedText>
              </Pressable>
              <Pressable onPress={flow.editAndRerun} style={styles.secondaryButton}>
                <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
                  {t('stylistFlow.editAndRerun')}
                </ThemedText>
              </Pressable>
              <Pressable onPress={flow.resetFlow} style={styles.secondaryButton}>
                <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                  {t('stylistFlow.startOver')}
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    // Keyboard-aware tree (NOT absolute footer):
    // flex column → KeyboardAwareScrollView → KeyboardStickyView → SafeAreaView → Continue
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScreenKeyboardAwareScrollView
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
          <ThemedText type="h2">{introCopy.title}</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: theme.tabIconDefault }]}>
            {introCopy.subtitle}
          </ThemedText>
          {flow.step !== 'response' ? renderProgress() : null}
        </LinearGradient>

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
  responseOptionThumb: {
    flex: 1,
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
