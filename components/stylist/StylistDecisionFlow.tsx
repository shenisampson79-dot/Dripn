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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { OutfitPiecesVisual } from '@/components/OutfitPiecesVisual';
import { SurpriseMeLoadingOverlay } from '@/components/SurpriseMeLoadingOverlay';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { DecisionType } from '@/services/DecisionService';
import { decisionService } from '@/services/DecisionService';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { useStylistDecision } from '@/hooks/useStylistDecision';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WARDROBE_THUMB = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 2) / 3;

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
  navigation: { goBack: () => void; navigate?: (name: string) => void; dispatch?: (action: unknown) => void };
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
  const flow = useStylistDecision({ decisionType, navigation });

  const stylistId = flow.user?.stylistPreferences?.selectedStylistId || 'ruby';
  const stylistGradient = getStylistGradient(stylistId);
  const stylistName = getStylistName(stylistId);
  const stylistIcon = getStylistIcon(stylistId);

  const steps = useMemo(() => {
    if (decisionType === 'event-outfit') {
      return ['event', 'context', 'input', 'response'] as const;
    }
    if (decisionType === 'shopping') {
      return ['input', 'context', 'response'] as const;
    }
    return ['input', 'context', 'response'] as const;
  }, [decisionType]);

  const stepIndex = steps.indexOf(flow.step as typeof steps[number]);
  const progress = stepIndex >= 0 ? (stepIndex + 1) / steps.length : 0;

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

  const renderProgress = () => (
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
          <>
            <ThemedText type="body" style={styles.primaryButtonText}>
              {label}
            </ThemedText>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );

  const renderUploadActions = () => (
    <View style={styles.uploadActionsRow}>
      <Pressable
        onPress={flow.handlePickImage}
        style={({ pressed }) => [
          styles.uploadAction,
          { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="image" size={20} color={LuxuryColors.gold} />
        <ThemedText type="small">{t('stylistFlow.gallery')}</ThemedText>
      </Pressable>
      <Pressable
        onPress={flow.handleTakePhoto}
        style={({ pressed }) => [
          styles.uploadAction,
          { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="camera" size={20} color={LuxuryColors.gold} />
        <ThemedText type="small">{t('stylistFlow.camera')}</ThemedText>
      </Pressable>
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

        <ThemedText type="body" style={styles.orLabel}>
          {t('stylistFlow.orDescribe')}
        </ThemedText>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border },
          ]}
          placeholder={t('stylistFlow.shopping.describePlaceholder')}
          placeholderTextColor={theme.tabIconDefault}
          value={flow.contextNotes}
          onChangeText={flow.setContextNotes}
          multiline
          numberOfLines={4}
          maxLength={400}
        />

        {flow.canProceedFromInput()
          ? renderPrimaryButton(t('stylistFlow.continue'), () => flow.setStep('context'))
          : null}
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

      {flow.wardrobeItems.length === 0 ? (
        <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
          {t('stylistFlow.emptyWardrobeHint')}
        </ThemedText>
      ) : (
        <View style={styles.wardrobeGrid}>
          {flow.wardrobeItems.slice(0, 12).map((item) => {
            const id = String(item.id);
            const selected = flow.selectedWardrobeIds.includes(id);
            const uri = item.enhancedImageUri || item.imageUri;
            if (!uri) return null;
            return (
              <Pressable
                key={id}
                onPress={() => flow.toggleWardrobeItem(id)}
                style={[
                  styles.wardrobeThumb,
                  selected && { borderColor: LuxuryColors.gold, borderWidth: 2 },
                ]}
              >
                <Image source={{ uri }} style={styles.wardrobeThumbImage} />
                {selected ? (
                  <View style={styles.wardrobeCheck}>
                    <Feather name="check" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {flow.canProceedFromInput()
        ? renderPrimaryButton(t('stylistFlow.continue'), () => flow.setStep('context'))
        : null}
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

      {flow.canProceedFromInput()
        ? renderPrimaryButton(
            t('stylistFlow.getRecommendation'),
            () => flow.submitDecision(false),
            false,
            flow.isLoading,
          )
        : null}
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

      {flow.eventDetails.eventType && flow.eventDetails.dressCode
        ? renderPrimaryButton(t('stylistFlow.continue'), () => flow.setStep('context'))
        : null}
    </Animated.View>
  );

  const renderContextStep = () => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
      <ThemedText type="h3">
        {decisionType === 'event-outfit'
          ? t('stylistFlow.contextEventTitle')
          : t('stylistFlow.contextTitle')}
      </ThemedText>
      <ThemedText style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
        {decisionType === 'event-outfit'
          ? t('stylistFlow.contextEventSubtitle')
          : t('stylistFlow.contextSubtitle')}
      </ThemedText>

      <View style={styles.chipRow}>
        {flow.contextChips.map((chip) => {
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

      {decisionType !== 'shopping' ? (
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
        />
      ) : null}

      {decisionType === 'shopping'
        ? renderPrimaryButton(
            t('stylistFlow.getRecommendation'),
            () => flow.submitDecision(false),
            false,
            flow.isLoading,
          )
        : decisionType === 'sanity-check'
          ? renderPrimaryButton(
              t('stylistFlow.getVerdict'),
              () => flow.submitDecision(false),
              false,
              flow.isLoading,
            )
          : renderPrimaryButton(t('stylistFlow.continue'), () => flow.setStep('input'))}
    </Animated.View>
  );

  const renderResponse = () => {
    const res = flow.response;
    if (!res) return null;

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

        {res.uploadedImages && res.uploadedImages.length > 0 && res.recommendedIndex !== undefined ? (
          <Image
            source={{ uri: res.uploadedImages[res.recommendedIndex] }}
            style={styles.responseHero}
          />
        ) : res.outfitImageUrl ? (
          <Image source={{ uri: res.outfitImageUrl }} style={styles.responseHero} />
        ) : res.outfitPieces && res.outfitPieces.length > 0 ? (
          <OutfitPiecesVisual pieces={res.outfitPieces} wardrobeItems={flow.wardrobeItems} large />
        ) : null}

        <View style={[styles.responseCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          {res.styleRating != null ? (
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

          {res.outfitSummary ? (
            <ThemedText type="body" style={styles.responseBody}>
              {res.outfitSummary}
            </ThemedText>
          ) : (
            <ThemedText type="body" style={styles.responseBody}>
              {renderMarkdownText(res.recommendation)}
            </ThemedText>
          )}

          {res.reasoning ? (
            <ThemedText style={[styles.reasoning, { color: theme.tabIconDefault }]}>
              {renderMarkdownText(res.reasoning)}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.responseActions}>
          {renderPrimaryButton(t('stylistFlow.done'), () => navigation.goBack())}
          <Pressable onPress={flow.resetFlow} style={styles.secondaryButton}>
            <ThemedText type="body" style={{ color: LuxuryColors.gold }}>
              {t('stylistFlow.startOver')}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScreenKeyboardAwareScrollView opaqueHeader contentContainerStyle={styles.scrollContent}>
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

        {flow.step === 'event' ? renderEventStep() : null}
        {flow.step === 'input' && decisionType === 'shopping' ? renderShoppingInput() : null}
        {flow.step === 'input' && decisionType === 'sanity-check' ? renderSanityInput() : null}
        {flow.step === 'input' && decisionType === 'event-outfit' ? renderEventInput() : null}
        {flow.step === 'context' ? renderContextStep() : null}
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
  scrollContent: {
    paddingBottom: Spacing.xxl,
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
    marginTop: Spacing.md,
    gap: Spacing.xs,
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
    gap: Spacing.sm,
  },
  uploadAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
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
  wardrobeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  wardrobeThumb: {
    width: WARDROBE_THUMB,
    height: WARDROBE_THUMB,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  wardrobeThumbImage: {
    width: '100%',
    height: '100%',
  },
  wardrobeCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: Spacing.sm,
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
