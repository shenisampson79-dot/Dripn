/**
 * Reusable voice credit purchase modal — Stripe (web/Android) or Apple IAP (iOS).
 */
import React, { useCallback } from 'react';
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
import { useVoiceCredits } from '@/hooks/useVoiceCredits';
import { getVoicePackDisplay } from '@/utils/voiceCreditPacks';

interface VoiceCreditsPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess?: (creditsAdded?: number) => void;
}

export function VoiceCreditsPurchaseModal({
  visible,
  onClose,
  onPurchaseSuccess,
}: VoiceCreditsPurchaseModalProps) {
  const { theme } = useTheme();
  const {
    packages,
    isPurchasing,
    purchaseVoiceCredits,
    getPackagePriceLabel,
    useAppleIAP,
    isLoading,
    remainingCredits,
    isUnlimited,
    credits,
  } = useVoiceCredits();

  const handleBuyCredits = useCallback(async (packageId: string) => {
    try {
      const result = await purchaseVoiceCredits(packageId);
      onClose();
      const added = 'creditsAdded' in (result || {})
        ? (result as { creditsAdded?: number }).creditsAdded
        : undefined;
      onPurchaseSuccess?.(added);
      Alert.alert(
        'Credits added',
        added && added > 0
          ? `${added} voice credits are now on your account.`
          : 'Your voice credit balance has been updated.',
      );
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'cancelled' in error && (error as { cancelled?: boolean }).cancelled) {
        return;
      }
      Alert.alert(
        'Purchase failed',
        error instanceof Error ? error.message : 'Could not complete purchase. Please try again.',
      );
    }
  }, [onClose, onPurchaseSuccess, purchaseVoiceCredits]);

  const balanceLabel = isUnlimited
    ? 'Unlimited spoken replies on your plan'
    : isLoading
      ? 'Loading balance…'
      : `${remainingCredits} spoken repl${remainingCredits === 1 ? 'y' : 'ies'} available`;

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
            <ThemedText type="h3" style={styles.modalTitle}>Buy voice credits</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={theme.tabIconDefault} />
            </Pressable>
          </View>

          <View style={[styles.balanceRow, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="headphones" size={16} color={theme.link} />
            <ThemedText type="small" style={{ color: theme.tabIconDefault, flex: 1 }}>
              {balanceLabel}
              {!isUnlimited && credits?.purchasedCredits
                ? ` · ${credits.purchasedCredits} purchased`
                : ''}
            </ThemedText>
          </View>

          <ThemedText style={[styles.modalText, { color: theme.tabIconDefault }]}>
            {useAppleIAP
              ? 'Add a pack for hands-free spoken replies from your AI stylist. Purchases are handled by the App Store; credits stay on your Dripn account.'
              : 'Add credits for hands-free spoken replies from your AI stylist. Purchased credits never expire.'}
          </ThemedText>

          <View style={styles.packageList}>
            {packages.map((pkg) => {
              const display = getVoicePackDisplay(pkg.id, pkg.description, pkg.credits);
              return (
                <Pressable
                  key={pkg.id}
                  disabled={isPurchasing}
                  onPress={() => handleBuyCredits(pkg.id)}
                  style={({ pressed }) => [
                    styles.packageItem,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      opacity: pressed || isPurchasing ? 0.75 : 1,
                      borderWidth: pkg.popular ? 1 : 0,
                      borderColor: pkg.popular ? theme.link : 'transparent',
                    },
                  ]}
                >
                  {pkg.popular ? (
                    <View style={[styles.popularBadge, { backgroundColor: theme.link }]}>
                      <ThemedText style={styles.popularText}>BEST VALUE</ThemedText>
                    </View>
                  ) : null}
                  <View style={styles.packageName}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>{display.label}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                      {display.subtitle} · {pkg.credits} credits
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.packagePrice, { color: theme.link }]}>
                    {getPackagePriceLabel(pkg.id, pkg.priceLabel)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {isPurchasing ? (
            <ActivityIndicator color={theme.link} style={{ marginBottom: Spacing.md }} />
          ) : null}

          <Pressable
            onPress={onClose}
            style={[styles.closeModalButton, { borderColor: theme.border }]}
          >
            <ThemedText>Close</ThemedText>
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
