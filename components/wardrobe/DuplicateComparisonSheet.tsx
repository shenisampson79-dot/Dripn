import React from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import type { DuplicateDecisionType, DuplicateMatch } from '@/utils/wardrobeDuplicateMatch';
import { DEDUPE_COPY } from '@/utils/wardrobeDuplicateMatch';

export type DuplicateComparisonProps = {
  visible: boolean;
  type: DuplicateDecisionType;
  title?: string;
  message?: string;
  candidateImageUri?: string | null;
  candidateLabel?: string;
  matches: DuplicateMatch[];
  onClose: () => void;
  onAddAnyway?: () => void;
  onContinue?: () => void;
  onViewExisting?: (match: DuplicateMatch) => void;
  /** When true, show Add Anyway (hard warn). similar_item uses Continue instead. */
  allowForceAdd?: boolean;
};

function MatchCard({
  match,
  theme,
  onPress,
}: {
  match: DuplicateMatch;
  theme: { backgroundSecondary: string; border: string; tabIconDefault: string };
  onPress?: () => void;
}) {
  const uri = match.imageUrl || match.imageUri;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.matchCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.matchImage} resizeMode="cover" />
      ) : (
        <View style={[styles.matchImage, styles.matchImagePlaceholder]}>
          <Feather name="image" size={22} color={theme.tabIconDefault} />
        </View>
      )}
      <View style={styles.matchMeta}>
        <ThemedText type="body" numberOfLines={2}>{match.name || 'Wardrobe item'}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault }} numberOfLines={2}>
          {[match.color, match.category, match.brand].filter(Boolean).join(' · ')}
        </ThemedText>
        {match.message ? (
          <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginTop: 4 }} numberOfLines={3}>
            {match.message}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function DuplicateComparisonSheet({
  visible,
  type,
  title,
  message,
  candidateImageUri,
  candidateLabel,
  matches,
  onClose,
  onAddAnyway,
  onContinue,
  onViewExisting,
  allowForceAdd = true,
}: DuplicateComparisonProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const primary = matches[0];
  const isSimilar = type === 'similar_item';
  const isConflict = type === 'classification_conflict';
  const heading = title
    || (isSimilar
      ? (t('wardrobe.isThisDifferentItem') || DEDUPE_COPY.probable)
      : isConflict
        ? (t('wardrobe.looksFamiliar') || DEDUPE_COPY.conflict)
        : (t('wardrobe.alreadyHaveThis') || DEDUPE_COPY.hard));
  const body = message
    || primary?.message
    || (isSimilar
      ? (t('wardrobe.similarItemMessage') || 'Close, but not the same piece — add it if it is a different item.')
      : isConflict
        ? (t('wardrobe.classificationConflictMessage') || 'This photo looks like something you already own, even if the category label disagrees.')
        : (t('wardrobe.alreadyHaveThisMessage') || 'This looks very similar to something you already own.')
          .replace('{names}', primary?.name || 'an existing item'));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <ThemedText type="body" style={{ color: theme.link }}>{t('common.cancel') || 'Cancel'}</ThemedText>
          </Pressable>
          <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
            {isSimilar ? 'Similar' : isConflict ? 'Familiar' : 'Duplicate'}
          </ThemedText>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <ThemedText type="h3" style={styles.title}>{heading}</ThemedText>
          <ThemedText type="body" style={{ color: theme.tabIconDefault, marginBottom: Spacing.lg }}>
            {body}
          </ThemedText>

          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <ThemedText type="caption" style={styles.compareLabel}>
                {t('wardrobe.newItem') || 'New'}
              </ThemedText>
              {candidateImageUri ? (
                <Image source={{ uri: candidateImageUri }} style={styles.compareImage} resizeMode="cover" />
              ) : (
                <View style={[styles.compareImage, styles.matchImagePlaceholder]}>
                  <Feather name="camera" size={28} color={theme.tabIconDefault} />
                </View>
              )}
              <ThemedText type="caption" numberOfLines={2} style={{ marginTop: Spacing.xs }}>
                {candidateLabel || 'Candidate'}
              </ThemedText>
            </View>

            <Feather name="git-compare" size={20} color={LuxuryColors.gold} style={{ marginTop: 48 }} />

            <View style={styles.compareCol}>
              <ThemedText type="caption" style={styles.compareLabel}>
                {t('wardrobe.yourWardrobe') || 'Yours'}
              </ThemedText>
              {primary?.imageUrl || primary?.imageUri ? (
                <Image
                  source={{ uri: (primary.imageUrl || primary.imageUri)! }}
                  style={styles.compareImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.compareImage, styles.matchImagePlaceholder]}>
                  <Feather name="archive" size={28} color={theme.tabIconDefault} />
                </View>
              )}
              <ThemedText type="caption" numberOfLines={2} style={{ marginTop: Spacing.xs }}>
                {primary?.name || 'Existing'}
              </ThemedText>
            </View>
          </View>

          {matches.length > 1 ? (
            <View style={{ marginTop: Spacing.lg }}>
              <ThemedText type="small" style={{ marginBottom: Spacing.sm }}>
                {t('wardrobe.otherMatches') || 'Other matches'}
              </ThemedText>
              {matches.slice(1).map((m, idx) => (
                <MatchCard
                  key={`${m.id}-${idx}`}
                  match={m}
                  theme={theme}
                  onPress={onViewExisting ? () => onViewExisting(m) : undefined}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: theme.border }]}>
          {isSimilar ? (
            <>
              <Pressable
                onPress={onClose}
                style={[styles.secondaryBtn, { borderColor: theme.border }]}
              >
                <ThemedText type="body">{t('wardrobe.keepExisting') || 'Keep existing'}</ThemedText>
              </Pressable>
              <Pressable
                onPress={onContinue || onAddAnyway || onClose}
                style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}
              >
                <ThemedText type="body" style={styles.primaryBtnText}>
                  {t('wardrobe.addAsDifferentItem') || 'Add as a different item'}
                </ThemedText>
              </Pressable>
            </>
          ) : isConflict ? (
            <>
              <Pressable
                onPress={() => (primary && onViewExisting ? onViewExisting(primary) : onClose())}
                style={[styles.secondaryBtn, { borderColor: theme.border }]}
              >
                <ThemedText type="body">{t('wardrobe.useExisting') || 'Use existing'}</ThemedText>
              </Pressable>
              {(onAddAnyway || onContinue) ? (
                <Pressable
                  onPress={onAddAnyway || onContinue}
                  style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}
                >
                  <ThemedText type="body" style={styles.primaryBtnText}>
                    {t('wardrobe.addSeparately') || 'Add separately'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              {primary && onViewExisting ? (
                <Pressable
                  onPress={() => onViewExisting(primary)}
                  style={[styles.secondaryBtn, { borderColor: theme.border }]}
                >
                  <ThemedText type="body">{t('wardrobe.viewExisting') || 'View existing'}</ThemedText>
                </Pressable>
              ) : null}
              {allowForceAdd && onAddAnyway ? (
                <Pressable
                  onPress={onAddAnyway}
                  style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}
                >
                  <ThemedText type="body" style={styles.primaryBtnText}>
                    {t('common.addAnyway') || 'Add anyway'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  content: { paddingHorizontal: Spacing.lg },
  title: { marginBottom: Spacing.sm },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  compareCol: { flex: 1, alignItems: 'center' },
  compareLabel: {
    marginBottom: Spacing.xs,
    color: LuxuryColors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  compareImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1a1a1a10',
  },
  matchCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  matchImage: {
    width: 64,
    height: 80,
    borderRadius: BorderRadius.sm,
  },
  matchImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#88888822',
  },
  matchMeta: { flex: 1, justifyContent: 'center' },
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#111', fontWeight: '600' },
  secondaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
