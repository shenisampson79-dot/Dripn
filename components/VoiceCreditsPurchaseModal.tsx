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
import { useTranslations } from '@/contexts/TranslationContext';
import { useVoiceCredits, isPurchaseCancelledError, getPurchaseErrorMessage } from '@/hooks/useVoiceCredits';

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
  const { t } = useTranslations();

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



  const handleBuyCredits = useCallback(async (packageId: string) => {

    try {

      const result = await purchaseVoiceCredits(packageId);

      onClose();

      const added = 'creditsAdded' in (result || {})

        ? (result as { creditsAdded?: number }).creditsAdded

        : undefined;

      const isWeekend = 'weekendUnlimited' in (result || {})

        && (result as { weekendUnlimited?: boolean }).weekendUnlimited;

      onPurchaseSuccess?.(added);

      Alert.alert(
        isWeekend ? t('voiceCredits.weekendVoiceActive') : t('voiceCredits.creditsAdded'),
        isWeekend
          ? t('voiceCredits.weekendAddedMessage')
          : added && added > 0
            ? `${added} ${t('voiceCredits.creditsAddedMessage')}`
            : t('voiceCredits.balanceUpdated'),
      );

    } catch (error: unknown) {

      if (isPurchaseCancelledError(error)) {

        return;

      }

      const message = getPurchaseErrorMessage(error);

      if (!message) return;

      Alert.alert(t('voiceCredits.purchaseFailed'), message);

    }

  }, [onClose, onPurchaseSuccess, purchaseVoiceCredits, t]);

  const balanceLabel = weekendUnlimitedActive
    ? `${t('voiceCredits.weekendVoiceActive')} — ${t('voiceCredits.expires')} ${weekendExpiryLabel}`
    : isLoading
      ? t('voiceCredits.loadingBalance')
      : usageLabel
        ? `${usageLabel} ${t('voiceCredits.thisMonth')}`
        : `${remainingCredits} ${remainingCredits === 1 ? t('voiceCredits.spokenReply') : t('voiceCredits.spokenReplies')}`;



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

            <ThemedText type="h3" style={styles.modalTitle}>{t('voiceCredits.buyTitle')}</ThemedText>

            <Pressable onPress={onClose} hitSlop={8}>

              <Feather name="x" size={20} color={theme.tabIconDefault} />

            </Pressable>

          </View>



          <View style={[styles.balanceRow, { backgroundColor: theme.backgroundSecondary }]}>

            <Feather name={weekendUnlimitedActive ? 'sun' : 'headphones'} size={16} color={theme.link} />

            <ThemedText type="small" style={{ color: theme.tabIconDefault, flex: 1 }}>

              {balanceLabel}

              {!weekendUnlimitedActive && credits?.purchasedCredits
                ? ` · ${credits.purchasedCredits} ${t('voiceCredits.purchased')}`
                : ''}

            </ThemedText>

          </View>



          <ThemedText style={[styles.modalText, { color: theme.tabIconDefault }]}>

            {shouldShowBuyPacks && !weekendUnlimitedActive
              ? t('voiceCredits.needMore')
              : useAppleIAP
                ? t('voiceCredits.topUpApple')
                : t('voiceCredits.topUpStripe')}

          </ThemedText>



          <View style={styles.packageList}>

            {packages.map((pkg) => {

              const display = getVoicePackDisplay(pkg.id, pkg.description, pkg.credits, pkg.weekendUnlimited);

              const detailLabel = pkg.weekendUnlimited
                ? t('voiceCredits.unlimited48h')
                : `${pkg.credits} ${t('voiceCredits.spokenReplies')}`;

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

                      borderWidth: pkg.popular || pkg.weekendUnlimited ? 1 : 0,

                      borderColor: pkg.weekendUnlimited ? '#F59E0B' : pkg.popular ? theme.link : 'transparent',

                    },

                  ]}

                >

                  {pkg.popular ? (

                    <View style={[styles.popularBadge, { backgroundColor: theme.link }]}>

                      <ThemedText style={styles.popularText}>{t('voiceCredits.mostPopular')}</ThemedText>

                    </View>

                  ) : null}

                  {pkg.weekendUnlimited && !pkg.popular ? (

                    <View style={[styles.popularBadge, { backgroundColor: '#F59E0B' }]}>

                      <ThemedText style={styles.popularText}>{t('voiceCredits.unlimited48hBadge')}</ThemedText>

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

            <ThemedText>{t('common.cancel')}</ThemedText>

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


