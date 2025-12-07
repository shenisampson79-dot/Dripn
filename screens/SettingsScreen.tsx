import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert, Linking, Platform, Switch, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StyleTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useStyleTheme } from "@/hooks/useStyleTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useReferral } from "@/contexts/ReferralContext";
import { useSmartNotifications } from "@/contexts/SmartNotificationsContext";
import { apiService } from "@/services/ApiService";
import colorTrendService from "@/services/ColorTrendService";

const NEWSLETTER_STATUS_KEY = "@dripn_newsletter_subscribed";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { PortalMode } from "@/App";

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Settings">;
  onOpenPortal?: (mode: PortalMode) => void;
};

interface SettingItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
  theme: any;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  danger = false,
  theme,
}: SettingItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.settingIconContainer}>
        <Feather
          name={icon}
          size={20}
          color={danger ? theme.error || "#FF3B30" : theme.text}
        />
      </View>
      <View style={styles.settingContent}>
        <ThemedText
          type="body"
          style={[
            styles.settingTitle,
            danger && { color: theme.error || "#FF3B30" },
          ]}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={styles.settingSubtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {showChevron ? (
        <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
      ) : null}
    </Pressable>
  );
}

const STYLE_NAMES: Record<StyleTheme, string> = {
  luxury: "Luxury",
  streetwear: "Streetwear",
  boho: "Boho",
  sporty: "Sporty",
  "smart-casual": "Smart Casual",
  business: "Business",
  edgy: "Edgy",
};

interface PantoneColor {
  year: number;
  name: string;
  hex: string;
  description?: string;
}

export default function SettingsScreen({ navigation, onOpenPortal }: SettingsScreenProps) {
  const { theme } = useTheme();
  const { hasTrendColors, trendInfo, isLoading: trendLoading, refreshTrends } = useStyleTheme();
  const { user, logout, updateProfile } = useAuth();
  const { referralCode, totalReferrals, bonusAIRequests, shareReferral } = useReferral();
  const { preferences: notificationPrefs, updatePreferences } = useSmartNotifications();
  const [isNewsletterSubscribed, setIsNewsletterSubscribed] = useState(false);
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(false);
  const [pantoneColor, setPantoneColor] = useState<PantoneColor | null>(null);
  const [pantoneLoading, setPantoneLoading] = useState(true);

  useEffect(() => {
    const loadNewsletterStatus = async () => {
      try {
        const stored = await AsyncStorage.getItem(NEWSLETTER_STATUS_KEY);
        if (stored !== null) {
          setIsNewsletterSubscribed(stored === "true");
        }
      } catch (error) {
        console.error("Error loading newsletter status:", error);
      }
    };
    loadNewsletterStatus();
  }, []);

  useEffect(() => {
    const loadPantoneColor = async () => {
      try {
        const data = await colorTrendService.getPantoneColorOfTheYear();
        if (data) {
          setPantoneColor(data);
        }
      } catch (error) {
        console.error("Error loading Pantone color:", error);
      } finally {
        setPantoneLoading(false);
      }
    };
    loadPantoneColor();
  }, []);

  const handleShareReferral = async () => {
    const success = await shareReferral();
    if (!success) {
      Alert.alert("Sharing Failed", "Could not share your referral code. Please try again.");
    }
  };

  const handleNewsletterToggle = async (value: boolean) => {
    if (!user?.email) {
      Alert.alert("Error", "Please add an email to your account first.");
      return;
    }

    setIsNewsletterLoading(true);
    try {
      if (value) {
        await apiService.subscribeToNewsletter(user.email, user.name);
        setIsNewsletterSubscribed(true);
        await AsyncStorage.setItem(NEWSLETTER_STATUS_KEY, "true");
        Alert.alert("Subscribed", "You're now subscribed to Dripn fashion updates!");
      } else {
        await apiService.unsubscribeFromNewsletter(user.email);
        setIsNewsletterSubscribed(false);
        await AsyncStorage.setItem(NEWSLETTER_STATUS_KEY, "false");
        Alert.alert("Unsubscribed", "You've been unsubscribed from the newsletter.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not update newsletter subscription. Please try again.");
    } finally {
      setIsNewsletterLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Deletion",
              "This will permanently delete all your data, posts, and comments. Are you absolutely sure?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    await logout();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleChangeStyle = () => {
    navigation.navigate("StyleExplorer");
  };

  const handleFeedPreference = () => {
    Alert.alert(
      "Feed Preference",
      "Choose your default feed:",
      [
        { text: "Global", onPress: () => updateProfile({ feedPreference: "global" }) },
        { text: "Prioritize My Region", onPress: () => updateProfile({ feedPreference: "regional" }) },
        { text: "Local Only", onPress: () => updateProfile({ feedPreference: "local" }) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleAISuggestions = () => {
    const isEnabled = user?.aiSuggestionsEnabled !== false;
    Alert.alert(
      "AI Style Suggestions",
      isEnabled 
        ? "AI suggestions are currently ON. Would you like to turn them off and only receive feedback from the community?"
        : "AI suggestions are currently OFF. Would you like to turn them on to receive AI-powered style advice?",
      [
        { 
          text: isEnabled ? "Turn Off AI" : "Turn On AI", 
          onPress: () => updateProfile({ aiSuggestionsEnabled: !isEnabled }) 
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handlePrivacy = () => {
    navigation.navigate("PrivacyPolicy");
  };

  const handleTerms = () => {
    navigation.navigate("TermsOfService");
  };

  const handleSupport = () => {
    Linking.openURL("mailto:support@dripn.app");
  };

  return (
    <ScreenScrollView>
      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Account
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="user"
            title="Edit Profile"
            subtitle={user?.name}
            onPress={() => navigation.navigate("EditProfile")}
            theme={theme}
          />
          <SettingItem
            icon="credit-card"
            title="Subscription"
            subtitle={user?.subscriptionTier === "free" ? "Free Plan" : `${user?.subscriptionTier} Plan`}
            onPress={() => navigation.navigate("Subscription")}
            theme={theme}
          />
          <SettingItem
            icon="mail"
            title="Email"
            subtitle={user?.email}
            onPress={() => {}}
            showChevron={false}
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Preferences
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="heart"
            title="Style Theme"
            subtitle={STYLE_NAMES[user?.stylePreference || "luxury"]}
            onPress={handleChangeStyle}
            theme={theme}
          />
          <SettingItem
            icon="globe"
            title="Feed Preference"
            subtitle={
              user?.feedPreference === "global"
                ? "Global"
                : user?.feedPreference === "regional"
                  ? "My Region"
                  : "Local Only"
            }
            onPress={handleFeedPreference}
            theme={theme}
          />
          <SettingItem
            icon="cpu"
            title="AI Style Suggestions"
            subtitle={user?.aiSuggestionsEnabled !== false ? "On - Get AI advice" : "Off - Community only"}
            onPress={handleAISuggestions}
            theme={theme}
          />
          <SettingItem
            icon="map-pin"
            title="Country"
            subtitle={user?.country}
            onPress={() => {}}
            theme={theme}
          />
          <SettingItem
            icon="clipboard"
            title="Style Quiz"
            subtitle={user?.hasCompletedQuiz ? "Retake quiz" : "Complete your style profile"}
            onPress={() => navigation.navigate("OnboardingQuiz")}
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Trending Colors
          </ThemedText>
          {trendLoading || pantoneLoading ? (
            <ActivityIndicator size="small" color={theme.tabIconDefault} />
          ) : null}
        </View>
        <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.trendingColorsContainer}>
            {pantoneColor ? (
              <View style={styles.pantoneSection}>
                <ThemedText type="small" style={styles.trendLabel}>
                  Pantone Color of the Year {pantoneColor.year}
                </ThemedText>
                <View style={styles.colorRow}>
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: pantoneColor.hex },
                    ]}
                  />
                  <View style={styles.colorInfo}>
                    <ThemedText type="body" style={styles.colorName}>
                      {pantoneColor.name}
                    </ThemedText>
                    <ThemedText type="small" style={styles.colorHex}>
                      {pantoneColor.hex}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : !pantoneLoading ? (
              <ThemedText type="small" style={styles.noTrendText}>
                Pantone Color of the Year not available
              </ThemedText>
            ) : null}

            {hasTrendColors && trendInfo.colors ? (
              <View style={styles.styleTrendsSection}>
                <ThemedText type="small" style={styles.trendLabel}>
                  Your Style Theme Colors ({STYLE_NAMES[user?.stylePreference || "luxury"]})
                </ThemedText>
                <View style={styles.trendColorsRow}>
                  {trendInfo.colors.secondary ? (
                    <View style={styles.trendColorItem}>
                      <View
                        style={[
                          styles.colorSwatchSmall,
                          { backgroundColor: trendInfo.colors.secondary.hex },
                        ]}
                      />
                      <ThemedText type="caption" style={styles.colorLabel}>
                        Secondary
                      </ThemedText>
                      <ThemedText type="caption" style={styles.colorHexSmall}>
                        {trendInfo.colors.secondary.hex}
                      </ThemedText>
                    </View>
                  ) : null}
                  {trendInfo.colors.accent ? (
                    <View style={styles.trendColorItem}>
                      <View
                        style={[
                          styles.colorSwatchSmall,
                          { backgroundColor: trendInfo.colors.accent.hex },
                        ]}
                      />
                      <ThemedText type="caption" style={styles.colorLabel}>
                        Accent
                      </ThemedText>
                      <ThemedText type="caption" style={styles.colorHexSmall}>
                        {trendInfo.colors.accent.hex}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                {trendInfo.year && trendInfo.region ? (
                  <ThemedText type="caption" style={styles.trendMeta}>
                    {trendInfo.year} trends for {trendInfo.region}
                  </ThemedText>
                ) : null}
              </View>
            ) : !trendLoading ? (
              <View style={styles.noTrendsContainer}>
                <ThemedText type="small" style={styles.noTrendText}>
                  Using base theme colors
                </ThemedText>
                <Pressable
                  onPress={refreshTrends}
                  style={({ pressed }) => [
                    styles.refreshButton,
                    { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="refresh-cw" size={14} color={theme.link} />
                  <ThemedText type="small" style={{ color: theme.link }}>
                    Check for trends
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Invite Friends
        </ThemedText>
        <View style={styles.sectionContent}>
          <Pressable
            onPress={handleShareReferral}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={styles.settingIconContainer}>
              <Feather name="gift" size={20} color={theme.link} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={[styles.settingTitle, { color: theme.link }]}>
                Share Your Code: {referralCode}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {totalReferrals > 0
                  ? `${totalReferrals} friends joined - ${bonusAIRequests} AI requests & 10% discount earned`
                  : "Invite friends and you both get 20 AI requests & 10% discount"}
              </ThemedText>
            </View>
            <Feather name="share-2" size={20} color={theme.link} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Newsletter
        </ThemedText>
        <View style={styles.sectionContent}>
          <View
            style={[
              styles.settingItem,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.settingIconContainer}>
              <Feather name="mail" size={20} color={theme.text} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Fashion Updates
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                Get weekly style tips and trend alerts
              </ThemedText>
            </View>
            <Switch
              value={isNewsletterSubscribed}
              onValueChange={handleNewsletterToggle}
              disabled={isNewsletterLoading}
              trackColor={{ false: theme.tabIconDefault, true: theme.link }}
              thumbColor={isNewsletterSubscribed ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Notifications
        </ThemedText>
        <View style={styles.sectionContent}>
          <View
            style={[
              styles.settingItem,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.settingIconContainer}>
              <Feather name="cloud" size={20} color={theme.text} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Weather-Based Styling
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                Get outfit suggestions based on local weather
              </ThemedText>
            </View>
            <Switch
              value={notificationPrefs.weatherStyling}
              onValueChange={(value) => updatePreferences({ weatherStyling: value })}
              trackColor={{ false: theme.tabIconDefault, true: theme.link }}
              thumbColor={notificationPrefs.weatherStyling ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
          <View
            style={[
              styles.settingItem,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.settingIconContainer}>
              <Feather name="tag" size={20} color={theme.text} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Price Alerts
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                Notify when tracked items drop in price
              </ThemedText>
            </View>
            <Switch
              value={notificationPrefs.priceAlerts}
              onValueChange={(value) => updatePreferences({ priceAlerts: value })}
              trackColor={{ false: theme.tabIconDefault, true: theme.link }}
              thumbColor={notificationPrefs.priceAlerts ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
          <View
            style={[
              styles.settingItem,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.settingIconContainer}>
              <Feather name="trending-up" size={20} color={theme.text} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Trend Notifications
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                Stay updated on the latest fashion trends
              </ThemedText>
            </View>
            <Switch
              value={notificationPrefs.trendNotifications}
              onValueChange={(value) => updatePreferences({ trendNotifications: value })}
              trackColor={{ false: theme.tabIconDefault, true: theme.link }}
              thumbColor={notificationPrefs.trendNotifications ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
          <View
            style={[
              styles.settingItem,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.settingIconContainer}>
              <Feather name="star" size={20} color={theme.text} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Style of the Day
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                Daily personalized outfit inspiration
              </ThemedText>
            </View>
            <Switch
              value={notificationPrefs.styleOfTheDay}
              onValueChange={(value) => updatePreferences({ styleOfTheDay: value })}
              trackColor={{ false: theme.tabIconDefault, true: theme.link }}
              thumbColor={notificationPrefs.styleOfTheDay ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Support
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="help-circle"
            title="Help & Support"
            onPress={handleSupport}
            theme={theme}
          />
          <SettingItem
            icon="file-text"
            title="Terms of Service"
            onPress={handleTerms}
            theme={theme}
          />
          <SettingItem
            icon="shield"
            title="Privacy Policy"
            onPress={handlePrivacy}
            theme={theme}
          />
        </View>
      </View>

      {onOpenPortal ? (
        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Staff Access
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="scissors"
              title="Stylist Portal"
              subtitle="Access stylist dashboard"
              onPress={() => onOpenPortal('stylist')}
              theme={theme}
            />
            <SettingItem
              icon="shield"
              title="Admin Portal"
              subtitle="Access admin dashboard"
              onPress={() => onOpenPortal('admin')}
              theme={theme}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Development
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="image"
            title="Logo Preview"
            subtitle="View Dripn logo variations"
            onPress={() => navigation.navigate("LogoPreview")}
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Account Actions
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="log-out"
            title="Sign Out"
            onPress={handleLogout}
            showChevron={false}
            theme={theme}
          />
          <SettingItem
            icon="trash-2"
            title="Delete Account"
            onPress={handleDeleteAccount}
            showChevron={false}
            danger
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={styles.versionText}>
          Dripn v1.0.0
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  sectionContent: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    gap: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingIconContainer: {
    width: 24,
    alignItems: "center",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontWeight: "500",
  },
  settingSubtitle: {
    opacity: 0.6,
    marginTop: 2,
  },
  footer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  versionText: {
    opacity: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  trendingColorsContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  pantoneSection: {
    gap: Spacing.sm,
  },
  trendLabel: {
    opacity: 0.7,
    marginBottom: Spacing.xs,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  colorInfo: {
    flex: 1,
  },
  colorName: {
    fontWeight: "600",
  },
  colorHex: {
    opacity: 0.6,
  },
  styleTrendsSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  trendColorsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  trendColorItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  colorSwatchSmall: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
  },
  colorLabel: {
    opacity: 0.7,
  },
  colorHexSmall: {
    opacity: 0.5,
  },
  trendMeta: {
    opacity: 0.5,
    marginTop: Spacing.sm,
  },
  noTrendsContainer: {
    alignItems: "center",
    gap: Spacing.md,
  },
  noTrendText: {
    opacity: 0.6,
    textAlign: "center",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
