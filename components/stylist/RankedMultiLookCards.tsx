/**
 * Equal-size ranked multi-look cards for Stylist Chat.
 * StyleSession.targetDate is the single source of truth for Wear/Try/Save.
 */

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { SafeOutfitPieces } from '@/components/SafeOutfitPieces';
import { OutfitSaveActions } from '@/components/outfit/OutfitSaveActions';
import { SaveOutfitPromptModal, type SaveOutfitIntent } from '@/components/outfit/SaveOutfitPromptModal';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useWardrobe, type WardrobeItem } from '@/contexts/WardrobeContext';
import { recordStylistOutfitFeedback } from '@/utils/outfitFeedbackBrain';
import { OutfitTasteFeedback } from '@/components/outfit/OutfitTasteFeedback';
import { setWornDaily } from '@/utils/todaysOutfitDailyStore';
import {
  buildStyleSession,
  logStyleSessionAction,
  plannedDateIsoFromKey,
  wearCtaLabels,
  wearTargetFromSession,
  type StyleSession,
} from '@/utils/chatWearTargetDate';
import {
  buildRankedLookCards,
  multiLookIntroText,
  type RankedLookCard,
  type RankedLookMeta,
} from '@/utils/rankedMultiLook';
import type { WardrobeVisualPayload } from '@/utils/wardrobeMentionMatcher';

type Props = {
  content: string;
  userMessage?: string;
  /** Persisted session — if present, date is never re-derived on alt taps */
  styleSession?: StyleSession | null;
  wardrobeVisual: WardrobeVisualPayload;
  wardrobeItems: WardrobeItem[];
  looks?: RankedLookMeta[] | null;
  messageId: string;
  canvasWidth: number;
  occasion?: string;
};

export function RankedMultiLookCards({
  content,
  userMessage = '',
  styleSession: styleSessionProp = null,
  wardrobeVisual,
  wardrobeItems,
  looks,
  messageId,
  canvasWidth,
  occasion = 'casual',
}: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { planOutfit, updatePlannedOutfit, markPlannedOutfitWorn, plannedOutfits } = useWardrobe();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [committedId, setCommittedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savePrompt, setSavePrompt] = useState<{
    visible: boolean;
    intent: SaveOutfitIntent;
    itemIds: string[];
    title: string;
  } | null>(null);

  // Freeze session for this card tree — selecting alternatives must NOT reset date
  const session = useMemo(
    () => styleSessionProp || buildStyleSession({
      userMessage,
      assistantContent: content,
      intent: 'multi_look',
      occasion,
    }),
    [styleSessionProp, userMessage, content, occasion],
  );
  const wearTarget = useMemo(() => wearTargetFromSession(session), [session]);

  const cards = useMemo(
    () => buildRankedLookCards({
      outfits: wardrobeVisual.outfits,
      looks,
      content,
    }),
    [wardrobeVisual.outfits, looks, content],
  );

  const intro = useMemo(() => multiLookIntroText(content), [content]);

  if (cards.length < 2) return null;

  const handlePrimaryAction = async (card: RankedLookCard) => {
    if (busyId) return;
    setBusyId(card.id);
    setSelectedId(card.id); // Try this / Pick this — promote selection, keep session.targetDate
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const outfitId = `chat_multi_${messageId}_${card.index}`;
    const pieces = card.itemIds
      .map((id) => wardrobeItems.find((item) => String(item.id) === String(id)))
      .filter((item): item is WardrobeItem => Boolean(item));
    const labels = wearCtaLabels(wearTarget, {
      isPrimary: card.isPrimary,
      isCommitted: true,
    });

    try {
      if (labels.resolvedAction === 'save') {
        logStyleSessionAction({
          sessionDate: session.targetDate,
          actionTriggered: 'primary_cta',
          resolvedAction: 'save',
          savedTo: 'save_prompt',
          lookRole: card.role,
        });
        setSavePrompt({
          visible: true,
          intent: 'save',
          itemIds: card.itemIds,
          title: card.roleLabel || card.title,
        });
        setCommittedId(card.id);
        return;
      }

      if (labels.resolvedAction === 'wear_today') {
        await setWornDaily(outfitId);
      }

      if (pieces.length >= 2 && session.targetDate) {
        const targetKey = session.targetDate;
        const existing = plannedOutfits.find((plan) => (plan.date || '').slice(0, 10) === targetKey);
        let planId = existing?.id;
        const eventName = `${card.roleLabel || card.title} · ${session.dayLabel || targetKey}`;

        if (existing) {
          await updatePlannedOutfit(existing.id, {
            itemIds: pieces.map((p) => String(p.id)),
            eventName,
            eventType: 'casual',
            notes: card.reason || undefined,
          });
        } else {
          const created = await planOutfit({
            date: plannedDateIsoFromKey(targetKey),
            itemIds: pieces.map((p) => String(p.id)),
            eventName,
            eventType: 'casual',
            notes: card.reason || undefined,
          });
          planId = created.id;
        }

        if (planId && labels.resolvedAction === 'wear_today') {
          await markPlannedOutfitWorn(planId);
        }

        logStyleSessionAction({
          sessionDate: session.targetDate,
          actionTriggered: 'primary_cta',
          resolvedAction: labels.resolvedAction,
          savedTo: labels.resolvedAction === 'wear_today' ? 'today_outfit+planner' : 'planner',
          lookRole: card.role,
        });

        void recordStylistOutfitFeedback({
          items: pieces.map((item) => ({
            id: String(item.id),
            name: item.name,
            category: item.category,
            color: item.color,
          })),
          signal: labels.resolvedAction === 'wear_today' ? 'wore' : 'saved',
          source: 'stylist_chat',
          occasion: session.occasion || occasion || 'stylist_chat_multi',
          contextSnapshot: {
            role: card.role,
            messageId,
            styleSession: {
              targetDate: session.targetDate,
              kind: session.kind,
              timeContext: session.timeContext,
            },
          },
        });
      }

      setCommittedId(card.id);
      Alert.alert(
        t('aiStylist.youreSetTitle') || "You're set",
        labels.confirmBody,
      );
    } catch (err) {
      console.warn('[RankedMultiLookCards] Action failed:', err);
      Alert.alert(
        t('common.error') || 'Error',
        t('aiStylist.wearFailed') || 'Could not save this look. Try Save instead.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      {intro ? (
        <ThemedText style={[styles.intro, { color: theme.text }]}>
          {intro}
        </ThemedText>
      ) : null}

      {session.targetDate && session.kind !== 'today' ? (
        <ThemedText style={[styles.dayHint, { color: theme.tabIconDefault }]}>
          {`For ${session.dayLabel}`}
        </ThemedText>
      ) : null}

      {cards.map((card) => {
        const isSelected = selectedId === card.id || (!selectedId && card.isPrimary);
        const isCommitted = committedId === card.id;
        const busy = busyId === card.id;
        const labels = wearCtaLabels(wearTarget, {
          isPrimary: card.isPrimary,
          isCommitted,
        });
        const primaryLabel = isCommitted ? labels.committed : labels.primary;
        const badgeText = (card.isPrimary && labels.heroBadgeHint)
          ? labels.heroBadgeHint
          : card.roleLabel;

        return (
          <View
            key={card.id}
            style={[
              styles.card,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: isSelected
                  ? theme.link
                  : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: card.isPrimary
                      ? theme.link
                      : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.badgeText,
                    { color: card.isPrimary ? theme.buttonText : theme.text },
                  ]}
                >
                  {badgeText}
                </ThemedText>
              </View>
              {card.isPrimary ? (
                <ThemedText style={[styles.pickHint, { color: theme.link }]}>
                  {t('aiStylist.pickThis') || 'Pick this'}
                </ThemedText>
              ) : null}
            </View>

            {card.reason ? (
              <ThemedText style={[styles.reason, { color: theme.tabIconDefault }]}>
                {card.reason}
              </ThemedText>
            ) : null}

            <SafeOutfitPieces
              pieces={card.pieces}
              wardrobeItems={wardrobeItems}
              label=""
              large
              canvasWidth={canvasWidth}
            />

            <View style={styles.ctaRow}>
              <Pressable
                onPress={() => void handlePrimaryAction(card)}
                disabled={Boolean(busyId) || isCommitted}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: isCommitted
                      ? (isDark ? '#3D3426' : '#E8DFD0')
                      : card.isPrimary
                        ? theme.link
                        : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                    opacity: pressed || busy ? 0.75 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={card.isPrimary && !isCommitted ? theme.buttonText : theme.text} />
                ) : (
                  <ThemedText
                    style={{
                      color: isCommitted || !card.isPrimary ? theme.text : theme.buttonText,
                      fontWeight: '700',
                      fontSize: 15,
                    }}
                  >
                    {primaryLabel}
                  </ThemedText>
                )}
              </Pressable>
            </View>

            <OutfitTasteFeedback
              compact
              disabled={Boolean(busyId)}
              onLike={() => {
                const pieces = card.itemIds
                  .map((id) => wardrobeItems.find((item) => String(item.id) === String(id)))
                  .filter((item): item is WardrobeItem => Boolean(item));
                void recordStylistOutfitFeedback({
                  items: pieces.map((item) => ({
                    id: String(item.id),
                    name: item.name,
                    category: item.category,
                    color: item.color,
                  })),
                  signal: 'liked',
                  source: 'stylist_chat',
                  occasion: session.occasion || occasion,
                  contextSnapshot: { role: card.role, messageId, action: 'like' },
                });
              }}
              onSkip={() => {
                const pieces = card.itemIds
                  .map((id) => wardrobeItems.find((item) => String(item.id) === String(id)))
                  .filter((item): item is WardrobeItem => Boolean(item));
                void recordStylistOutfitFeedback({
                  items: pieces.map((item) => ({
                    id: String(item.id),
                    name: item.name,
                    category: item.category,
                    color: item.color,
                  })),
                  signal: 'skipped',
                  source: 'stylist_chat',
                  occasion: session.occasion || occasion,
                  contextSnapshot: { role: card.role, messageId, action: 'not_this' },
                });
              }}
            />

            {card.itemIds.length >= 2 && labels.resolvedAction !== 'save' ? (
              <OutfitSaveActions
                wardrobeItemIds={card.itemIds}
                defaultTitle={card.roleLabel || card.title}
                defaultDescription={card.reason || content}
                occasion={occasion}
              />
            ) : null}
          </View>
        );
      })}

      {savePrompt ? (
        <SaveOutfitPromptModal
          visible={savePrompt.visible}
          intent={savePrompt.intent}
          wardrobeItemIds={savePrompt.itemIds}
          defaultTitle={savePrompt.title}
          defaultDescription={content}
          occasion={occasion}
          onClose={() => setSavePrompt(null)}
          onSaved={() => {
            logStyleSessionAction({
              sessionDate: session.targetDate,
              actionTriggered: 'save_confirm',
              resolvedAction: 'save',
              savedTo: 'saved_outfits',
            });
            setSavePrompt(null);
            Alert.alert(
              t('aiStylist.youreSetTitle') || "You're set",
              wearCtaLabels(wearTarget, { isPrimary: true, isCommitted: true }).confirmBody,
            );
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  intro: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  dayHint: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: -4,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  badge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pickHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  reason: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaRow: {
    marginTop: Spacing.xs,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
});

export default RankedMultiLookCards;
