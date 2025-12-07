import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type StylistHubScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "StylistHub">;
};

interface StylistFeature {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  screen: keyof UserStylistStackParamList;
  gradientColors: readonly [string, string];
  premium?: boolean;
}

const STYLIST_FEATURES: StylistFeature[] = [
  {
    id: "ai-stylist",
    title: "Personal Stylist",
    description: "Chat with your AI stylist for personalized outfit recommendations based on your wardrobe",
    icon: "message-circle",
    screen: "AIStylist",
    gradientColors: ["#667eea", "#764ba2"] as const,
  },
  {
    id: "style-shuffle",
    title: "Style Shuffle",
    description: "Discover new outfit combinations by shuffling through your wardrobe items",
    icon: "shuffle",
    screen: "StyleShuffle",
    gradientColors: ["#f093fb", "#f5576c"] as const,
  },
  {
    id: "visual-search",
    title: "Visual Search",
    description: "Snap a photo of any outfit and find similar items from your favorite stores",
    icon: "camera",
    screen: "VisualSearch",
    gradientColors: ["#4facfe", "#00f2fe"] as const,
    premium: true,
  },
];

export default function StylistHubScreen({ navigation }: StylistHubScreenProps) {
  const { theme } = useTheme();
  const { tier } = useSubscription();

  const handleFeaturePress = (feature: StylistFeature) => {
    if (feature.premium && tier === "free") {
      navigation.navigate("AIStylist");
      return;
    }
    navigation.navigate(feature.screen);
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <ThemedText type="h1" style={styles.title}>
          Your Style Assistant
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Get personalized fashion advice and discover your perfect look
        </ThemedText>
      </View>

      <View style={styles.featuresGrid}>
        {STYLIST_FEATURES.map((feature) => (
          <Pressable
            key={feature.id}
            onPress={() => handleFeaturePress(feature)}
            style={({ pressed }) => [
              styles.featureCard,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Card style={styles.cardContent}>
              <LinearGradient
                colors={feature.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconContainer}
              >
                <Feather name={feature.icon} size={28} color="#FFFFFF" />
              </LinearGradient>
              
              <View style={styles.featureTextContainer}>
                <View style={styles.titleRow}>
                  <ThemedText type="h4" style={styles.featureTitle}>
                    {feature.title}
                  </ThemedText>
                  {feature.premium && tier === "free" ? (
                    <View style={[styles.premiumBadge, { backgroundColor: theme.warning }]}>
                      <Feather name="star" size={10} color="#FFFFFF" />
                      <ThemedText style={styles.premiumText}>Premium</ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={[styles.featureDescription, { color: theme.tabIconDefault }]}>
                  {feature.description}
                </ThemedText>
              </View>
              
              <View style={[styles.arrowContainer, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="chevron-right" size={20} color={theme.link} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={styles.tipsSection}>
        <Card style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Feather name="info" size={20} color={theme.link} />
            <ThemedText type="h4" style={styles.tipsTitle}>
              Style Tips
            </ThemedText>
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: theme.link }]} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Add items to your wardrobe for better recommendations
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: theme.success }]} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Tell your stylist about occasions for tailored advice
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: theme.warning }]} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Use Visual Search to find items you love in the wild
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.sm,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.small.fontSize,
    lineHeight: 20,
  },
  featuresGrid: {
    gap: Spacing.md,
  },
  featureCard: {
    width: "100%",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  featureTitle: {
    fontSize: Typography.body.fontSize,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  premiumText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  featureDescription: {
    fontSize: Typography.small.fontSize,
    lineHeight: 18,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tipsSection: {
    marginTop: Spacing.sm,
  },
  tipsCard: {
    padding: Spacing.md,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tipsTitle: {
    fontSize: Typography.body.fontSize,
  },
  tipsList: {
    gap: Spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    lineHeight: 18,
  },
});
