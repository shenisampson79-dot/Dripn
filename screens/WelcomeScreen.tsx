import React, { useState } from "react";
import { StyleSheet, View, Image, Pressable, Platform, type ImageStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { LoopingBackgroundVideo } from "@/components/LoopingBackgroundVideo";
import { LanguageEntryButton, LanguagePickerModal } from "@/components/LanguagePickerModal";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme, SchemePalette } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { videoRandomizer } from "@/services/VideoRandomizerService";
import { useAuth } from "@/contexts/AuthContext";

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { palette } = useColorScheme();
  const { loginAsTestUser } = useAuth();
  const { t } = useTranslations();
  const [backgroundVideo] = useState(() => videoRandomizer.getNextVideo({ tone: "mixed" }));
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  
  const handleTestLogin = async () => {
    await loginAsTestUser();
  };

  return (
    <View style={styles.container}>
      <LoopingBackgroundVideo
        key={isDark ? "dark-bg" : "light-bg"}
        source={backgroundVideo}
        style={styles.backgroundVideo}
      />

      <LinearGradient
        colors={[
          "transparent",
          "rgba(0,0,0,0.3)",
          "rgba(0,0,0,0.6)",
          "rgba(0,0,0,0.9)"
        ]}
        style={styles.overlay}
        locations={[0, 0.3, 0.6, 1]}
      />
      
      <View style={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.topBar}>
          <View style={styles.logoContainer}>
            <View style={styles.logoRow}>
              <Image
                source={require("../assets/images/dripn-logo-icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.brandTextContainer}>
                <ThemedText type="h1" style={styles.brandName}>
                  Dripn
                </ThemedText>
                <ThemedText type="small" style={styles.taglineBelow}>
                  {t('welcome.tagline')}
                </ThemedText>
              </View>
            </View>
          </View>
          <LanguageEntryButton light onPress={() => setLanguagePickerVisible(true)} />
        </View>

        <View style={styles.spacer} />

        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="zap"
            title={t('welcome.featureStopGuessingTitle')}
            description={t('welcome.featureStopGuessingDesc')}
            theme={theme}
            isDark={isDark}
            palette={palette}
          />
          <FeatureItem
            icon="message-circle"
            title={t('welcome.featureTalkStylistTitle')}
            description={t('welcome.featureTalkStylistDesc')}
            theme={theme}
            isDark={isDark}
            palette={palette}
          />
          <FeatureItem
            icon="users"
            title={t('welcome.featureLookGoodTitle')}
            description={t('welcome.featureLookGoodDesc')}
            theme={theme}
            isDark={isDark}
            palette={palette}
          />
          <FeatureItem
            icon="grid"
            title={t('welcome.featureWardrobeTitle')}
            description={t('welcome.featureWardrobeDesc')}
            theme={theme}
            isDark={isDark}
            palette={palette}
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Button
          onPress={() => navigation.navigate("TrustOnboarding")}
          style={styles.primaryButton}
        >
          {t('welcome.getStyled')}
        </Button>
        
        <Pressable 
          onPress={() => navigation.navigate("Auth", { mode: "login" })}
          style={styles.signInButton}
        >
          <ThemedText type="body" style={styles.signInText}>
            {t('welcome.alreadyHaveAccount')}{' '}
            <ThemedText type="body" style={styles.signInLink}>{t('welcome.signIn')}</ThemedText>
          </ThemedText>
        </Pressable>

        {__DEV__ ? (
          <Pressable 
            onPress={handleTestLogin}
            style={styles.testUserButton}
          >
            <Feather name="code" size={14} color="rgba(255,255,255,0.6)" />
            <ThemedText type="small" style={styles.testUserText}>
              {t('welcome.devLoginAsTestUser')}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <LanguagePickerModal
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        alsoSetStylistLanguage
      />
    </View>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  theme: any;
  isDark: boolean;
  palette: SchemePalette;
}

function FeatureItem({ icon, title, description, theme, isDark, palette }: FeatureItemProps) {
  const FEATURE_GRADIENTS: Record<string, readonly [string, string]> = {
    zap: [palette.coral, palette.magenta],
    'message-circle': [palette.violet, palette.deepViolet],
    users: [palette.teal, palette.emerald],
    grid: [palette.gold, palette.deepGold],
  };
  const gradientColors = FEATURE_GRADIENTS[icon] || [palette.violet, palette.deepViolet];
  
  return (
    <View style={styles.featureItem}>
      <LinearGradient
        colors={gradientColors}
        style={styles.featureIcon}
      >
        <Feather name={icon} size={22} color="#FFFFFF" />
      </LinearGradient>
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
    ...(Platform.OS === "web"
      ? ({ minHeight: "100%", width: "100%", position: "relative" } as ViewStyle)
      : {}),
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    zIndex: 2,
  },
  spacer: {
    flex: 1,
  },
  logoContainer: {
    alignItems: "flex-start",
    flex: 1,
    marginBottom: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  brandTextContainer: {
    alignItems: "flex-start",
  },
  brandName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
  } as ImageStyle,
  taglineBelow: {
    color: "rgba(255, 255, 255, 0.9)",
    fontStyle: "italic",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuresContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
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
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featureDescription: {
    color: "rgba(255, 255, 255, 0.9)",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    zIndex: 2,
  },
  primaryButton: {
    width: "100%",
  },
  signInButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  signInText: {
    color: "rgba(255, 255, 255, 0.8)",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  signInLink: {
    color: "#FFFFFF",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  testUserButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    opacity: 0.7,
  },
  testUserText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
});
