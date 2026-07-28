/**
 * Equal-size ranked multi-look cards for Stylist Chat.
 * Hierarchy via labels + CTA weight — not card size.
 */

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { SafeOutfitPieces } from '@/components/SafeOutfitPieces';
import { OutfitSaveActions } from '@/components/outfit/OutfitSaveActions';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useWardrobe, type WardrobeItem } from '@/contexts/WardrobeContext';
import { apiService } from '@/services/ApiService';
import {
  setWornDaily,
  todaysOutfitDateKey,
} from '@/utils/todaysOutfitDailyStore';
import {
  buildRankedLookCards,
  multiLookIntroText,
  type RankedLookCard,
  type RankedLookMeta,
} from '@/utils/rankedMultiLook';
import type { WardrobeVisualPayload } from '@/utils/wardrobeMentionMatcher';

type Props = {
  content: string;
  wardrobeVisual: WardrobeVisualPayload;
  wardrobeItems: WardrobeItem[];
  looks?: RankedLookMeta[] | null;
  messageId: string;
  canvasWidth: number;
  occasion?: string;
};

function todayPlannedDateIso(): string {
  return `${todaysOutfitDateKey()}T12:00:00.000Z`;
}

export function RankedMultiLookCards({
  content,
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
  const [wornId, setWornId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const handleWear = async (card: RankedLookCard) => {
    if (busyId) return;
    setBusyId(card.id);
    setSelectedId(card.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const outfitId = `chat_multi_${messageId}_${card.index}`;
    const pieces = card.itemIds
      .map((id) => wardrobeItems.find((item) => String(item.id) === String(id)))
      .filter((item): item is WardrobeItem => Boolean(item));

    try {
      await setWornDaily(outfitId);
      setWornId(card.id);

      if (pieces.length >= 2) {
        const todayKeyStr = todaysOutfitDateKey();
        const existing = plannedOutfits.find((plan) => (plan.date || '').slice(0, 10) === todayKeyStr);
        let planId = existing?.id;
        if (existing) {
          await updatePlannedOutfit(existing.id, {
            itemIds: pieces.map((p) => String(p.id)),
            eventName: card.roleLabel || card.title,
            eventType: 'casual',
            notes: card.reason || undefined,
          });
        } else {
          const created = await planOutfit({
            date: todayPlannedDateIso(),
            itemIds: pieces.map((p) => String(p.id)),
            eventName: card.roleLabel || card.title,
            eventType: 'casual',
            notes: card.reason || undefined,
          });
          planId = created.id;
        }
        if (planId) {
          await markPlannedOutfitWorn(planId);
        }

        apiService
          .recordOutfitEngagement({
            items: pieces.map((item) => ({
              id: String(item.id),
              name: item.name,
              category: item.category,
              color: item.color,
            })),
            signal: 'wore',
            occasion: occasion || 'stylist_chat_multi',
            contextSnapshot: {
              source: 'stylist_chat_ranked_multi',
              role: card.role,
              messageId,
            },
          })
          .catch(() => {});
      }

      Alert.alert(
        t('aiStylist.youreSetTitle') || "You're set",
        t('aiStylist.youreSetMessage') || 'This look is marked for today.',
      );
    } catch (err) {
      console.warn('[RankedMultiLookCards] Wear failed:', err);
      Alert.alert(
        t('common.error') || 'Error',
        t('aiStylist.wearFailed') || 'Could not mark this look. Try Save instead.',
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

      {cards.map((card) => {
        const isSelected = selectedId === card.id || (!selectedId && card.isPrimary);
        const isWorn = wornId === card.id;
        const busy = busyId === card.id;
        const primaryLabel = isWorn
          ? (t('home.wearingToday') || 'Wearing today')
          : card.primaryCta === 'wear'
            ? (t('home.wearThis') || 'Wear this')
            : (t('aiStylist.tryThis') || 'Try this');

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
                  {card.roleLabel}
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
                onPress={() => void handleWear(card)}
                disabled={Boolean(busyId) || isWorn}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: isWorn
                      ? (isDark ? '#3D3426' : '#E8DFD0')
                      : card.isPrimary
                        ? theme.link
                        : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                    opacity: pressed || busy ? 0.75 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={card.isPrimary && !isWorn ? theme.buttonText : theme.text} />
                ) : (
                  <ThemedText
                    style={{
                      color: isWorn || !card.isPrimary ? theme.text : theme.buttonText,
                      fontWeight: '700',
                      fontSize: 15,
                    }}
                  >
                    {primaryLabel}
                  </ThemedText>
                )}
              </Pressable>
            </View>

            {card.itemIds.length >= 2 ? (
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
