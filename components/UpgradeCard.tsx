import React from "react";
import { StyleSheet, View, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown 
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { UpgradeCopy, UnlockType } from "@/services/StylistUpgradeService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface UpgradeCardProps {
  visible: boolean;
  stylistName: string;
  copy: UpgradeCopy;
  onPrimaryAction: (unlocks: UnlockType) => void;
  onSecondaryAction: () => void;
  onDismiss: () => void;
}

const STYLIST_COLORS: Record<string, string> = {
  ruby: "#E91E63",
  max: "#2196F3",
  jade: "#4CAF50",
  marcus: "#FF9800",
};

export function UpgradeCard({
  visible,
  stylistName,
  copy,
  onPrimaryAction,
  onSecondaryAction,
  onDismiss,
}: UpgradeCardProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  if (!visible) return null;

  const stylistColor = STYLIST_COLORS[stylistName.toLowerCase()] || theme.link;
  const stylistInitial = stylistName.charAt(0).toUpperCase();

  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)}
      style={styles.overlay}
    >
      <Pressable style={styles.backdropPressable} onPress={onDismiss} />
      
      <Animated.View
        entering={SlideInDown.springify().damping(15)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.card,
          { 
            backgroundColor: theme.backgroundDefault,
            paddingBottom: insets.bottom + Spacing.lg,
          }
        ]}
      >
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
        </View>

        <Pressable onPress={onDismiss} style={styles.closeButton}>
          <Feather name="x" size={20} color={theme.tabIconDefault} />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, { backgroundColor: stylistColor }]}>
              <ThemedText type="h3" style={styles.avatarText}>
                {stylistInitial}
              </ThemedText>
            </View>
            <View style={styles.nameContainer}>
              <ThemedText type="body" style={[styles.stylistName, { color: theme.text }]}>
                {stylistName}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                Your AI Stylist
              </ThemedText>
            </View>
          </View>

          <View style={[styles.messageBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="body" style={[styles.messageText, { color: theme.text }]}>
              {copy.message}
            </ThemedText>
            {copy.followUp ? (
              <ThemedText type="body" style={[styles.followUpText, { color: theme.tabIconDefault }]}>
                {copy.followUp}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.ctaContainer}>
            <Button
              onPress={() => onPrimaryAction(copy.unlocks)}
              style={[styles.primaryButton, { backgroundColor: stylistColor }]}
            >
              {copy.cta[0] || "Show me options"}
            </Button>

            {copy.cta[1] ? (
              <Pressable onPress={onSecondaryAction} style={styles.secondaryButton}>
                <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
                  {copy.cta[1]}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Feather name="shield" size={14} color={theme.tabIconDefault} />
            <ThemedText type="small" style={[styles.footerText, { color: theme.tabIconDefault }]}>
              One-time · No subscription required
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  backdropPressable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg,
    padding: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  nameContainer: {
    marginLeft: Spacing.md,
  },
  stylistName: {
    fontWeight: "600",
    fontSize: 16,
  },
  messageBubble: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  followUpText: {
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  ctaContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  footerText: {
    fontStyle: "italic",
  },
});
