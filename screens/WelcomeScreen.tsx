import React from "react";
import { StyleSheet, View, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/images/dripn-logo-icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="body" style={styles.tagline}>
            Your personal stylist and global fashion community
          </ThemedText>
        </View>

        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="camera"
            title="Share Your Style"
            description="Post outfit photos and get real feedback"
            theme={theme}
          />
          <FeatureItem
            icon="message-circle"
            title="Expert Advice"
            description="Personal styling tips and community support"
            theme={theme}
          />
          <FeatureItem
            icon="heart"
            title="Find Your Look"
            description="Discover styles that match your personality"
            theme={theme}
          />
          <FeatureItem
            icon="tag"
            title="Exclusive Offers"
            description="Daily and weekly deals from top fashion brands"
            theme={theme}
          />
          <FeatureItem
            icon="calendar"
            title="Events Near You"
            description="Discover events and get outfit suggestions"
            theme={theme}
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Button
          onPress={() => navigation.navigate("Auth", { mode: "signup" })}
          style={styles.primaryButton}
        >
          Get Started
        </Button>

        <Pressable
          onPress={() => navigation.navigate("Auth", { mode: "login" })}
          style={({ pressed }) => [
            styles.secondaryButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText type="body" style={styles.secondaryButtonText}>
            Already have an account?{" "}
            <ThemedText type="link" style={styles.linkText}>
              Sign In
            </ThemedText>
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  theme: any;
}

function FeatureItem({ icon, title, description, theme }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name={icon} size={24} color={theme.link} />
      </View>
      <View style={styles.featureText}>
        <ThemedText type="h3" style={styles.featureTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" style={styles.featureDescription}>
          {description}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
    marginTop: Spacing["2xl"],
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
  },
  tagline: {
    textAlign: "center",
    opacity: 0.7,
    paddingHorizontal: Spacing.xl,
  },
  featuresContainer: {
    gap: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    marginBottom: Spacing.xs,
  },
  featureDescription: {
    opacity: 0.7,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    textAlign: "center",
  },
  linkText: {
    fontWeight: "600",
  },
});
