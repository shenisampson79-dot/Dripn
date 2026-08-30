import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutfitSaveActions } from '@/components/outfit/OutfitSaveActions';
import { OutfitTasteFeedback } from '@/components/outfit/OutfitTasteFeedback';
import { WardrobeItemImage } from '@/components/WardrobeItemImage';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { CATEGORY_LABELS, type WardrobeItem } from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';
import { sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';
import { humanizeStylistMessage } from '@/utils/humanizeStylistMessage';
import { wardrobeProcessedTileBackground, wardrobeTileBackground } from '@/utils/wardrobeImage';
import { useTranslations } from "@/contexts/TranslationContext";
import { recordStylistOutfitFeedback } from '@/utils/outfitFeedbackBrain';
import { shouldShowGonRefineCta } from '@/utils/sanityFollowUpCta';

export type GeneratedOutfitModalData = {
  items: WardrobeItem[];
  stylistMessage?: string;
};

type Props = {
  visible: boolean;
  outfit: GeneratedOutfitModalData | null;
  occasion?: string;
  defaultTitle?: string;
  onClose: () => void;
  /** Called after "Don't like" — parent can show next look */
  onSkipLook?: () => void;
  /** Continue this look in Stylist Chat */
  onAskStylist?: () => void;
};

export function GeneratedOutfitModal({
  visible,
  outfit,
  occasion = 'custom',
  defaultTitle = 'My Outfit',
  onClose,
  onSkipLook,
  onAskStylist,
}: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [savedThisSession, setSavedThisSession] = useState(false);
  const [liked, setLiked] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const orderedItems = useMemo(
    () => sortOutfitItemsByVisualOrder(outfit?.items || []),
    [outfit?.items],
  );

  const whyCopy = useMemo(
    () => humanizeStylistMessage(outfit?.stylistMessage),
    [outfit?.stylistMessage],
  );

  const wardrobeItemIds = useMemo(
    () => orderedItems.map((item) => String(item.id)).filter(Boolean),
    [orderedItems],
  );

  const sheetHeight = Math.min(windowHeight * 0.9, windowHeight - insets.top - Spacing.md);

  const handleClose = () => {
    setSavedThisSession(false);
    setLiked(false);
    setSkipped(false);
    onClose();
  };

  const feedbackItems = orderedItems.map((item) => ({
    id: String(item.id),
    name: item.name,
    category: item.category,
    color: item.color,
  }));

  const handleLike = () => {
    setLiked(true);
    setSkipped(false);
    void recordStylistOutfitFeedback({
      items: feedbackItems,
      signal: 'liked',
      source: 'get_outfits_now',
      occasion,
    });
  };

  const handleSkip = () => {
    setSkipped(true);
    setLiked(false);
    void recordStylistOutfitFeedback({
      items: feedbackItems,
      signal: 'skipped',
      source: 'get_outfits_now',
      occasion,
    });
    if (onSkipLook) onSkipLook();
    else handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: isDark ? theme.backgroundDefault : '#FFFFFF',
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h2">{t('wardrobe.yourPerfectOutfit') || 'Your Perfect Outfit'}</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            bounces
          >
            {whyCopy ? (
              <View style={[styles.stylistMessage, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <ThemedText type="caption" style={{ color: theme.tabIconDefault, fontWeight: '700', marginBottom: 4 }}>
                  {t('wardrobe.whyThisWorks') || 'Why this works'}
                </ThemedText>
                <ThemedText style={{ fontSize: 14, lineHeight: 20, color: theme.text }}>
                  {whyCopy}
                </ThemedText>
              </View>
            ) : null}

            {orderedItems.map((item, idx) => {
              const hasProcessedImage = item.imageProcessed === true;
              const tileBackground = hasProcessedImage
                ? wardrobeProcessedTileBackground()
                : wardrobeTileBackground(isDark);

              return (
                <View key={`${item.id}-${idx}`} style={styles.row}>
                  <View style={[styles.imageWrap, { backgroundColor: tileBackground }]}>
                    <WardrobeItemImage
                      item={item}
                      style={styles.image}
                      processed={hasProcessedImage}
                      preferCover={!hasProcessedImage}
                      displayScale={1.18}
                      tileBackgroundColor={tileBackground}
                    />
                  </View>
                  <View style={styles.info}>
                    <ThemedText type="body" numberOfLines={2}>{item.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            {orderedItems.length > 0 ? (
              <OutfitTasteFeedback
                liked={liked}
                skipped={skipped}
                onLike={handleLike}
                onSkip={handleSkip}
              />
            ) : null}

            {!savedThisSession ? (
              <OutfitSaveActions
                wardrobeItemIds={wardrobeItemIds}
                defaultTitle={defaultTitle}
                defaultDescription={whyCopy}
                occasion={occasion}
                onSaved={() => {
                  setSavedThisSession(true);
                  void recordStylistOutfitFeedback({
                    items: feedbackItems,
                    signal: 'saved',
                    source: 'get_outfits_now',
                    occasion,
                  });
                }}
              />
            ) : (
              <View style={styles.savedHint}>
                <Feather name="check-circle" size={16} color={LuxuryColors.emerald} />
                <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                  {t('wardrobe.savedOutfitHint') || 'Saved — find it in Profile → Saved Outfits'}
                </ThemedText>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleClose();
              }}
            >
              <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {t('common.gotIt') || 'Got it!'}
              </ThemedText>
            </Pressable>
            {shouldShowGonRefineCta() && onAskStylist ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onAskStylist();
                }}
              >
                <ThemedText type="body" style={{ color: LuxuryColors.violet, fontWeight: '600' }}>
                  {t('stylistFlow.refineWithStylist') || 'Ask Ivy to finish this look'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  stylistMessage: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  imageWrap: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: Spacing.sm,
  },
  savedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  button: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: LuxuryColors.violet,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: LuxuryColors.violet,
    alignItems: 'center',
  },
});
