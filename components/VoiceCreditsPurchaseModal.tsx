/**
 * Reusable voice credit purchase modal — Stripe (web/Android) or Apple IAP (iOS).
 */

import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useVoiceCredits, isPurchaseCancelledError, getPurchaseErrorMessage } from '@/hooks/useVoiceCredits';
import { getVoicePackDisplay } from '@/utils/voiceCreditPacks';

interface VoiceCreditsPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess?: (creditsAdded?: number) => void;
}

/** Guard against key-derived placeholders like "Buy Title". */
function labelOrFallback(value: string, fallback: string, badValues: string[] = []): string {
  const trimmed = (value || '').trim();
  if (!trimmed || badValues.includes(trimmed)) return fallback;
  return trimmed;
}

export function VoiceCreditsPurchaseModal({
  visible,
  onClose,
  onPurchaseSuccess,
}: VoiceCreditsPurchaseModalProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);

  const {
    packages,
    isPurchasing,
    purchaseVoiceCredits,
    getPackagePriceLabel,
    useAppleIAP,
    isLoading,
    remainingCredits,
    usageLabel,
    credits,
    weekendUnlimitedActive,
    weekendExpiryLabel,
    shouldShowBuyPacks,
  } = useVoiceCredits();

  const buyTitle = labelOrFallback(t('voiceCredits.buyTitle'), 'Buy Voice Package', ['Buy Title']);
  const needMore = labelOrFallback(
    t('voiceCredits.needMore'),
    'Running low on spoken replies. Top up to keep talking with your stylist.',
    ['Need More'],
  );
  const topUpApple = labelOrFallback(t('voiceCredits.topUpApple'), 'Top up with Apple', ['Top Up Apple']);
  const topUpStripe = labelOrFallback(t('voiceCredits.topUpStripe'), 'Top up with Stripe', ['Top Up Stripe']);
  const unlimited48h = labelOrFallback(
    t('voiceCredits.unlimited48h'),
    'Unlimited for 48 hours',
    ['Unlimited48h'],
  );
  const unlimited48hBadge = labelOrFallback(
    t('voiceCredits.unlimited48hBadge'),
    '48h Unlimited',
    ['Unlimited48h Badge'],
  );

  const handleBuyCredits = useCallback(async (packageId: string) => {
    setPurchasingPackageId(packageId);
    // Close overlay before Stripe opens — an open modal after checkout freezes taps behind it
    onClose();
    try {
      const result = await purchaseVoiceCredits(packageId);
      const added = 'creditsAdded' in (result || {})
        ? (result as { creditsAdded?: number }).creditsAdded
        : undefined;
      const isWeekend = 'weekendUnlimited' in (result || {})
        && (result as { weekendUnlimited?: boolean }).weekendUnlimited;
      onPurchaseSuccess?.(added);
      const title = isWeekend
        ? labelOrFallback(t('voiceCredits.weekendVoiceActive'), '2-day unlimited active', [
            'Weekend Voice Active',
            'Weekend unlimited active',
          ])
        : labelOrFallback(t('voiceCredits.creditsAdded'), 'Credits added', ['Credits Added']);
      const body = isWeekend
        ? labelOrFallback(
            t('voiceCredits.weekendAddedMessage'),
            '2-day unlimited is now active on your account.',
            ['Weekend Added Message', 'Weekend unlimited is now active on your account.'],
          )
        : added && added > 0
          ? `${added} ${labelOrFallback(
              t('voiceCredits.creditsAddedMessage'),
              'spoken replies added to your balance.',
              ['Credits Added Message'],
            )}`
          : labelOrFallback(t('voiceCredits.balanceUpdated'), 'Balance updated', ['Balance Updated']);
      // Wait for Stripe/auth sheet dismiss animation so it doesn't collide with Alert
      setTimeout(() => {
        Alert.alert(title, body);
      }, 400);
    } catch (error: unknown) {
      if (isPurchaseCancelledError(error)) {
        return;
      }
      const message = getPurchaseErrorMessage(error);
      if (!message) return;
      setTimeout(() => {
        Alert.alert(
          labelOrFallback(t('voiceCredits.purchaseFailed'), 'Purchase failed', ['Purchase Failed']),
          message,
        );
      }, 400);
    } finally {
      setPurchasingPackageId(null);
    }
  }, [onClose, onPurchaseSuccess, purchaseVoiceCredits, t]);

  const balanceLabel = weekendUnlimitedActive
    ? `${labelOrFallback(t('voiceCredits.weekendVoiceActive'), '2-day unlimited active', [
        'Weekend Voice Active',
        'Weekend unlimited active',
      ])} — ${labelOrFallback(t('voiceCredits.expires'), 'Expires')} ${weekendExpiryLabel}`
    : isLoading
      ? labelOrFallback(t('voiceCredits.loadingBalance'), 'Loading balance…', ['Loading Balance'])
      : usageLabel
        ? `${usageLabel} ${labelOrFallback(t('voiceCredits.thisMonth'), 'this month', ['This Month'])}`
        : `${remainingCredits} ${remainingCredits === 1
          ? labelOrFallback(t('voiceCredits.spokenReply'), 'spoken reply', ['Spoken Reply'])
          : labelOrFallback(t('voiceCredits.spokenReplies'), 'spoken replies', ['Spoken Replies'])}`;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        onPress={onClose}
      >
        <Pressable
          style={[styles.creditsModal, { backgroundColor: theme.backgroundDefault }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Feather name="zap" size={20} color={theme.link} />
            <ThemedText type="h3" style={styles.modalTitle}>{buyTitle}</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={theme.tabIconDefault} />
            </Pressable>
          </View>

          <View style={[styles.balanceRow, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name={weekendUnlimitedActive ? 'sun' : 'headphones'} size={16} color={theme.link} />
            <ThemedText type="small" style={{ color: theme.tabIconDefault, flex: 1 }}>
              {balanceLabel}
              {!weekendUnlimitedActive && credits?.purchasedCredits
                ? ` · ${credits.purchasedCredits} ${labelOrFallback(t('voiceCredits.purchased'), 'purchased', ['Purchased'])}`
                : ''}
            </ThemedText>
          </View>

          <ThemedText style={[styles.modalText, { color: theme.tabIconDefault }]}>
            {shouldShowBuyPacks && !weekendUnlimitedActive
              ? needMore
              : useAppleIAP
                ? topUpApple
                : topUpStripe}
          </ThemedText>

          <View style={styles.packageList}>
            {packages.map((pkg) => {
              const display = getVoicePackDisplay(pkg.id, pkg.description, pkg.credits, pkg.weekendUnlimited);
              const detailLabel = pkg.weekendUnlimited
                ? unlimited48h
                : `${pkg.credits} ${labelOrFallback(t('voiceCredits.spokenReplies'), 'spoken replies', ['Spoken Replies'])}`;
              const showInlineSpinner = isPurchasing && purchasingPackageId === pkg.id;

              return (
                <Pressable
                  key={pkg.id}
                  disabled={isPurchasing}
                  onPress={() => handleBuyCredits(pkg.id)}
                  style={({ pressed }) => [
                    styles.packageItem,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      opacity: pressed || (isPurchasing && purchasingPackageId !== pkg.id) ? 0.75 : 1,
                      borderWidth: pkg.popular || pkg.weekendUnlimited ? 1 : 0,
                      borderColor: pkg.weekendUnlimited ? '#F59E0B' : pkg.popular ? theme.link : 'transparent',
                    },
                  ]}
                >
                  {pkg.popular ? (
                    <View style={[styles.popularBadge, { backgroundColor: theme.link }]}>
                      <ThemedText style={styles.popularText}>
                        {labelOrFallback(t('voiceCredits.mostPopular'), 'Most Popular')}
                      </ThemedText>
                    </View>
                  ) : null}
                  {pkg.weekendUnlimited && !pkg.popular ? (
                    <View style={[styles.popularBadge, { backgroundColor: '#F59E0B' }]}>
                      <ThemedText style={styles.popularText}>{unlimited48hBadge}</ThemedText>
                    </View>
                  ) : null}
                  <View style={styles.packageName}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>
                      {display.label}{pkg.id === 'pro' ? ' ⭐' : ''}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                      {display.subtitle} · {detailLabel}
                    </ThemedText>
                  </View>
                  <View style={styles.packagePriceSlot}>
                    {showInlineSpinner ? (
                      <ActivityIndicator color={theme.link} size="small" />
                    ) : (
                      <ThemedText style={[styles.packagePrice, { color: theme.link }]}>
                        {getPackagePriceLabel(pkg.id, pkg.priceLabel)}
                      </ThemedText>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.closeModalButton, { borderColor: theme.border }]}
          >
            <ThemedText>{t('common.cancel') || 'Cancel'}</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  creditsModal: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    flex: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  modalText: {
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  packageList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  packageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  packageName: {
    flex: 1,
  },
  packagePriceSlot: {
    minWidth: 56,
    minHeight: 22,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  packagePrice: {
    fontWeight: '700',
    fontSize: 16,
  },
  closeModalButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
});
