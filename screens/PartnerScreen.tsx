import React from "react";
import { StyleSheet, View, Pressable, Linking, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type PartnerScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Partner">;
};

interface PartnerOption {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  benefits: string[];
  gradientColors: [string, string];
  email: string;
}

const PARTNER_OPTIONS: PartnerOption[] = [
  {
    id: "stylist",
    title: "Become a Stylist",
    description: "Join our team of professional fashion stylists and help users discover their perfect look.",
    icon: "scissors",
    benefits: [
      "Set your own schedule",
      "Earn competitive rates per session",
      "Build your client base",
      "Access to styling tools and resources",
      "Connect with fashion-forward clients",
    ],
    gradientColors: ["#E91E63", "#9C27B0"],
    email: "stylists@dripn.app",
  },
  {
    id: "brand",
    title: "Brand Partnership",
    description: "Partner with Dripn to showcase your brand to our engaged fashion community.",
    icon: "briefcase",
    benefits: [
      "Featured product placements",
      "Sponsored challenges and campaigns",
      "Affiliate partnership opportunities",
      "Access to user insights and trends",
      "Exclusive brand showcase events",
    ],
    gradientColors: ["#2196F3", "#00BCD4"],
    email: "partnerships@dripn.app",
  },
  {
    id: "influencer",
    title: "Influencer Program",
    description: "Are you a fashion influencer? Join our exclusive program and grow your audience.",
    icon: "star",
    benefits: [
      "Verified influencer badge",
      "Early access to new features",
      "Exclusive collaboration opportunities",
      "Analytics and growth tools",
      "Monetization opportunities",
    ],
    gradientColors: ["#FF9800", "#FF5722"],
    email: "influencers@dripn.app",
  },
];

export default function PartnerScreen({ navigation }: PartnerScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();

  const handleContactPress = async (email: string) => {
    const mailtoUrl = `mailto:${email}?subject=Dripn Partnership Inquiry`;
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        if (Platform.OS === 'web') {
          Alert.alert(
            "Email Not Available",
            `Please email us directly at ${email} to inquire about partnership opportunities.`
          );
        } else {
          Alert.alert(
            "Email App Not Found",
            `Please email us at ${email} to learn more about partnering with Dripn.`
          );
        }
      }
    } catch (error) {
      Alert.alert(
        "Unable to Open Email",
        `Please contact us directly at ${email} for partnership inquiries.`
      );
    }
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <ThemedText type="h1" style={styles.title}>
          Partner With Dripn
        </ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Join our growing fashion community and help shape the future of personal styling.
        </ThemedText>
      </View>

      <View style={styles.optionsContainer}>
        {PARTNER_OPTIONS.map((option) => (
          <Card key={option.id} style={styles.optionCard}>
            <LinearGradient
              colors={option.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconContainer}
            >
              <Feather name={option.icon} size={28} color="#FFFFFF" />
            </LinearGradient>

            <ThemedText type="h2" style={styles.optionTitle}>
              {option.title}
            </ThemedText>
            <ThemedText type="body" style={[styles.optionDescription, { color: theme.tabIconDefault }]}>
              {option.description}
            </ThemedText>

            <View style={styles.benefitsContainer}>
              <ThemedText type="h3" style={styles.benefitsTitle}>
                Benefits
              </ThemedText>
              {option.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitRow}>
                  <Feather name="check-circle" size={16} color={option.gradientColors[0]} />
                  <ThemedText type="body" style={styles.benefitText}>
                    {benefit}
                  </ThemedText>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => handleContactPress(option.email)}
              style={({ pressed }) => [
                styles.contactButton,
                { backgroundColor: option.gradientColors[0], opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="mail" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={styles.contactButtonText}>
                Get in Touch
              </ThemedText>
            </Pressable>
          </Card>
        ))}
      </View>

      <View style={[styles.footerSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h3" style={styles.footerTitle}>
          Have Questions?
        </ThemedText>
        <ThemedText type="body" style={[styles.footerText, { color: theme.tabIconDefault }]}>
          Our partnership team is here to help. Reach out to us at partnerships@dripn.app and we'll get back to you within 24 hours.
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    lineHeight: 22,
  },
  optionsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  optionCard: {
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  optionTitle: {
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  benefitsContainer: {
    marginBottom: Spacing.lg,
  },
  benefitsTitle: {
    marginBottom: Spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  benefitText: {
    flex: 1,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contactButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  footerSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  footerTitle: {
    marginBottom: Spacing.sm,
  },
  footerText: {
    lineHeight: 22,
  },
});
