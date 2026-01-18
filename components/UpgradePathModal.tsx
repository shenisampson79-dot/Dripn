import React from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { StylistId } from "@/contexts/AuthContext";
import { dfyService, UpgradePathTrigger } from "@/services/DFYService";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
};

interface UpgradePathModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  featureKey: string;
  stylistId: StylistId;
}

export function UpgradePathModal({
  visible,
  onClose,
  onUpgrade,
  featureKey,
  stylistId,
}: UpgradePathModalProps) {
  const trigger = dfyService.getUpgradeTrigger(featureKey, stylistId);

  if (!trigger) return null;

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpgrade();
  };

  const getStylistAvatar = () => {
    switch (stylistId) {
      case 'ruby':
        return { icon: 'heart' as const, gradient: [LUXURY_COLORS.rose, '#D4949A'] as const };
      case 'max':
        return { icon: 'zap' as const, gradient: [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const };
      default:
        return { icon: 'star' as const, gradient: [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const };
    }
  };

  const avatar = getStylistAvatar();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={e => e.stopPropagation()}>
          <LinearGradient
            colors={[LUXURY_COLORS.midnight, '#0F0F1A']}
            style={styles.modalGradient}
          >
            <View style={styles.stylistSection}>
              <LinearGradient
                colors={avatar.gradient}
                style={styles.stylistAvatar}
              >
                <Feather name={avatar.icon} size={24} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="small" style={styles.stylistName}>
                {stylistId === 'ruby' ? 'Ruby' : stylistId === 'max' ? 'Max' : 'Your Stylist'}
              </ThemedText>
            </View>

            <View style={styles.speechBubble}>
              <ThemedText style={styles.messageText}>
                {trigger.message}
              </ThemedText>
            </View>

            <View style={styles.featureHighlight}>
              <View style={styles.featureIcon}>
                <Feather name="lock" size={16} color={LUXURY_COLORS.gold} />
              </View>
              <ThemedText type="small" style={styles.featureText}>
                {trigger.featureRequested} requires Core
              </ThemedText>
            </View>

            <View style={styles.corePreview}>
              <ThemedText type="h3" style={styles.coreTitle}>
                With Core you get:
              </ThemedText>
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Feather name="check" size={16} color={LUXURY_COLORS.teal} />
                  <ThemedText type="small" style={styles.benefitText}>
                    Individual item photography & analysis
                  </ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <Feather name="check" size={16} color={LUXURY_COLORS.teal} />
                  <ThemedText type="small" style={styles.benefitText}>
                    Swap any piece in your outfits
                  </ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <Feather name="check" size={16} color={LUXURY_COLORS.teal} />
                  <ThemedText type="small" style={styles.benefitText}>
                    Unlimited outfit remixes for 30 days
                  </ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <Feather name="check" size={16} color={LUXURY_COLORS.teal} />
                  <ThemedText type="small" style={styles.benefitText}>
                    Full wardrobe digitization (up to 30 items)
                  </ThemedText>
                </View>
              </View>
            </View>

            <Pressable onPress={handleUpgrade} style={styles.upgradeButton}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.upgradeButtonGradient}
              >
                <ThemedText type="body" style={styles.upgradeButtonText}>
                  Upgrade to Core - £39.99
                </ThemedText>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={onClose} style={styles.dismissButton}>
              <ThemedText style={styles.dismissText}>Not right now</ThemedText>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: Spacing.xl,
    paddingBottom: 50,
  },
  stylistSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  stylistAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  stylistName: {
    color: 'rgba(255,255,255,0.7)',
  },
  speechBubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  messageText: {
    color: '#FFFFFF',
    lineHeight: 24,
    textAlign: 'center',
  },
  featureHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(201,168,124,0.15)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(201,168,124,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: LUXURY_COLORS.gold,
    fontWeight: '600',
  },
  corePreview: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  coreTitle: {
    color: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  benefitsList: {
    gap: Spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  benefitText: {
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  upgradeButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  upgradeButtonGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: '700',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.5)',
  },
});

export default UpgradePathModal;
