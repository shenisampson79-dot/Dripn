import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { SubscriptionColors } from "@/constants/theme";
import { SubscriptionTier } from "@/contexts/AuthContext";
import { getTierFeaturesDisplayName, normalizeSubscriptionTier } from "@/utils/subscriptionTier";

interface SubscriptionBadgeProps {
  tier: SubscriptionTier | string;
  small?: boolean;
}

export function SubscriptionBadge({ tier, small = false }: SubscriptionBadgeProps) {
  const normalized = normalizeSubscriptionTier(tier);
  const label = getTierFeaturesDisplayName(normalized);
  const colors = SubscriptionColors[normalized as keyof typeof SubscriptionColors]
    ?? SubscriptionColors.personal_stylist;

  if (normalized !== 'free') {
    return (
      <LinearGradient
        colors={[
          'backgroundStart' in colors ? colors.backgroundStart : colors.background,
          'backgroundEnd' in colors ? colors.backgroundEnd : colors.background,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, small && styles.badgeSmall]}
      >
        <ThemedText
          type="caption"
          style={[styles.text, small && styles.textSmall, { color: colors.text }]}
        >
          {label}
        </ThemedText>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: colors.background }]}>
      <ThemedText
        type="caption"
        style={[styles.text, small && styles.textSmall, { color: colors.text }]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  text: {
    fontWeight: "600",
    fontSize: 12,
  },
  textSmall: {
    fontSize: 10,
  },
});
