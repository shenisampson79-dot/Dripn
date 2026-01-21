import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert, Linking, Platform, Switch, ActivityIndicator, Modal, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StyleTheme, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useStyleTheme } from "@/hooks/useStyleTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useReferral } from "@/contexts/ReferralContext";
import { useSmartNotifications } from "@/contexts/SmartNotificationsContext";
import { useVoiceSettings, SUPPORTED_LANGUAGES, SPEED_OPTIONS } from "@/contexts/VoiceSettingsContext";
import { apiService } from "@/services/ApiService";
import colorTrendService from "@/services/ColorTrendService";
import dfyService, { DFYAccessStatus, DFYTier } from "@/services/DFYService";
import { useColorScheme, ColorSchemeMode } from "@/contexts/ColorSchemeContext";

const NEWSLETTER_STATUS_KEY = "@dripn_newsletter_subscribed";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { SettingsStackParamList } from "@/navigation/SettingsStackNavigator";
import type { PortalMode } from "@/App";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
};

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList | SettingsStackParamList, "Settings">;
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
  isDark: boolean;
  iconGradient?: readonly [string, string];
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  danger = false,
  theme,
  isDark,
  iconGradient,
}: SettingItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {iconGradient ? (
        <LinearGradient
          colors={iconGradient}
          style={styles.settingIconGradient}
        >
          <Feather name={icon} size={16} color="#FFFFFF" />
        </LinearGradient>
      ) : (
        <View style={[styles.settingIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
          <Feather
            name={icon}
            size={16}
            color={danger ? "#FF3B30" : theme.text}
          />
        </View>
      )}
      <View style={styles.settingContent}>
        <ThemedText
          type="body"
          style={[
            styles.settingTitle,
            danger && { color: "#FF3B30" },
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
        <Feather name="chevron-right" size={18} color={theme.tabIconDefault} />
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
  const { theme, isDark } = useTheme();
  const { hasTrendColors, trendInfo, isLoading: trendLoading, refreshTrends } = useStyleTheme();
  const { user, logout, updateProfile } = useAuth();
  const { referralCode, totalReferrals, bonusAIRequests, shareReferral } = useReferral();
  const { preferences: notificationPrefs, updatePreferences } = useSmartNotifications();
  const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceSettings();
  const { colorScheme, setColorScheme } = useColorScheme();
  const [isNewsletterSubscribed, setIsNewsletterSubscribed] = useState(false);
  const [pickerModal, setPickerModal] = useState<{ type: 'language' | 'speed' | 'colorScheme' | null; visible: boolean }>({ type: null, visible: false });
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(false);
  const [pantoneColor, setPantoneColor] = useState<PantoneColor | null>(null);
  const [pantoneLoading, setPantoneLoading] = useState(true);
  const [dfyAccess, setDfyAccess] = useState<DFYAccessStatus | null>(null);
  const [dfyLoading, setDfyLoading] = useState(false);

  const loadDFYAccess = async () => {
    if (!user?.id) return;
    try {
      const status = await dfyService.getDFYAccessStatus(user.id);
      setDfyAccess(status);
    } catch (error) {
      console.error('Error loading DFY access:', error);
    }
  };

  useEffect(() => {
    loadDFYAccess();
  }, [user?.id]);

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


  const handleAISuggestions = () => {
    const isEnabled = user?.aiSuggestionsEnabled !== false;
    Alert.alert(
      "Style Suggestions",
      isEnabled 
        ? "Style suggestions from your personal stylist are currently ON. Would you like to turn them off and only receive feedback from the community?"
        : "Style suggestions are currently OFF. Would you like to turn them on to receive personalized styling advice?",
      [
        { 
          text: isEnabled ? "Turn Off" : "Turn On", 
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
    navigation.navigate("Support");
  };

  const handlePartnerWithUs = () => {
    navigation.navigate("Partner");
  };

  const handleLanguageSelect = () => {
    setPickerModal({ type: 'language', visible: true });
  };

  const handleSpeedSelect = () => {
    setPickerModal({ type: 'speed', visible: true });
  };

  const handleColorSchemeSelect = () => {
    setPickerModal({ type: 'colorScheme', visible: true });
  };

  const closePickerModal = () => {
    setPickerModal({ type: null, visible: false });
  };

  const COLOR_SCHEME_OPTIONS: { value: ColorSchemeMode; label: string; description: string }[] = [
    { value: 'colorful', label: 'Colorful', description: 'Vibrant gradients and bold colors' },
    { value: 'minimalist', label: 'Minimalist', description: 'Subtle, understated tones' },
  ];

  const handleDFYToggle = async (tier: DFYTier, value: boolean) => {
    if (!user?.id) return;
    setDfyLoading(true);
    try {
      if (value) {
        if (dfyAccess?.hasAccess && dfyAccess.tier !== tier) {
          await dfyService.clearDFYAccess(user.id);
        }
        await dfyService.activateDFYAccess(user.id, tier);
      } else {
        await dfyService.clearDFYAccess(user.id);
      }
      await loadDFYAccess();
    } catch (error) {
      console.error('Error toggling DFY access:', error);
      Alert.alert('Error', 'Could not update DFY access. Please try again.');
    } finally {
      setDfyLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          ScreenGradients.settings.primary[0],
          ScreenGradients.settings.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>Settings</ThemedText>
          <View style={{ width: 40 }} />
        </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            style={styles.sectionIcon}
          >
            <Feather name="user" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Account</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="user"
            title="Edit Profile"
            subtitle={user?.name}
            onPress={() => navigation.navigate("EditProfile")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
          <SettingItem
            icon="credit-card"
            title="Subscription"
            subtitle={user?.subscriptionTier === "free" ? "Free Plan" : `${user?.subscriptionTier} Plan`}
            onPress={() => navigation.navigate("Subscription")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          />
          <SettingItem
            icon="mail"
            title="Email"
            subtitle={user?.email}
            onPress={() => {}}
            showChevron={false}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.coral, '#C46A4F']}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.rose, LUXURY_COLORS.coral]}
            style={styles.sectionIcon}
          >
            <Feather name="heart" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Preferences</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="heart"
            title="Style Theme"
            subtitle={STYLE_NAMES[user?.stylePreference || "luxury"]}
            onPress={handleChangeStyle}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.rose, LUXURY_COLORS.coral]}
          />
          <SettingItem
            icon="map-pin"
            title="Country"
            subtitle={user?.country}
            onPress={() => {}}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.coral, '#C46A4F']}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
            style={styles.sectionIcon}
          >
            <Feather name="droplet" size={12} color={LUXURY_COLORS.midnight} />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Trending Colors</ThemedText>
          {trendLoading || pantoneLoading ? (
            <ActivityIndicator size="small" color={LUXURY_COLORS.gold} style={{ marginLeft: Spacing.sm }} />
          ) : null}
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <View style={styles.trendingColorsContainer}>
            {pantoneColor ? (
              <View style={styles.pantoneSection}>
                <ThemedText type="small" style={styles.trendLabel}>
                  Pantone Color of the Year {pantoneColor.year}
                </ThemedText>
                <View style={styles.colorRow}>
                  <LinearGradient
                    colors={[pantoneColor.hex, pantoneColor.hex]}
                    style={styles.colorSwatchGradient}
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
                      <LinearGradient
                        colors={[trendInfo.colors.secondary.hex, trendInfo.colors.secondary.hex]}
                        style={styles.colorSwatchSmall}
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
                      <LinearGradient
                        colors={[trendInfo.colors.accent.hex, trendInfo.colors.accent.hex]}
                        style={styles.colorSwatchSmall}
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
                <LinearGradient
                  colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                  style={styles.refreshButtonGradient}
                >
                  <Pressable
                    onPress={refreshTrends}
                    style={styles.refreshButtonInner}
                  >
                    <Feather name="refresh-cw" size={14} color="#FFFFFF" />
                    <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      Check for trends
                    </ThemedText>
                  </Pressable>
                </LinearGradient>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.coral, '#C46A4F']}
            style={styles.sectionIcon}
          >
            <Feather name="gift" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Invite Friends</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <Pressable
            onPress={handleShareReferral}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={[LUXURY_COLORS.coral, '#C46A4F']}
              style={styles.settingIconGradient}
            >
              <Feather name="gift" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={[styles.settingTitle, { color: LUXURY_COLORS.coral }]}>
                Share Your Code: {referralCode}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {totalReferrals > 0
                  ? `${totalReferrals} friends joined - ${bonusAIRequests} AI requests & 10% discount earned`
                  : "Invite friends and you both get 20 AI requests & 10% discount"}
              </ThemedText>
            </View>
            <Feather name="share-2" size={18} color={LUXURY_COLORS.coral} />
          </Pressable>
        </View>
      </View>


      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            style={styles.sectionIcon}
          >
            <Feather name="bell" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Notifications</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.emerald, '#059669']}
              style={styles.settingIconGradient}
            >
              <Feather name="tag" size={16} color="#FFFFFF" />
            </LinearGradient>
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
              trackColor={{ false: theme.tabIconDefault, true: LUXURY_COLORS.violet }}
              thumbColor={notificationPrefs.priceAlerts ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
            style={styles.sectionIcon}
          >
            <Feather name="volume-2" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Voice & Language</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="globe"
            title="Language"
            subtitle={SUPPORTED_LANGUAGES.find(l => l.code === voiceSettings.preferredLanguage)?.name || "English"}
            onPress={handleLanguageSelect}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
          <SettingItem
            icon="fast-forward"
            title="Voice Speed"
            subtitle={SPEED_OPTIONS.find(s => s.value === voiceSettings.voiceSpeed)?.label || "Normal"}
            onPress={handleSpeedSelect}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.coral, '#C46A4F']}
          />
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
              style={styles.settingIconGradient}
            >
              <Feather name="play-circle" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Auto-Play Responses
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                Automatically play voice when stylist responds
              </ThemedText>
            </View>
            <Switch
              value={voiceSettings.autoPlayResponses}
              onValueChange={(value) => updateVoiceSettings({ autoPlayResponses: value })}
              trackColor={{ false: theme.tabIconDefault, true: LUXURY_COLORS.teal }}
              thumbColor={voiceSettings.autoPlayResponses ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.settingIconGradient}
            >
              <Feather name="file-text" size={16} color={LUXURY_COLORS.midnight} />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Show Transcriptions
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                Display text version of voice messages
              </ThemedText>
            </View>
            <Switch
              value={voiceSettings.showTranscriptions}
              onValueChange={(value) => updateVoiceSettings({ showTranscriptions: value })}
              trackColor={{ false: theme.tabIconDefault, true: LUXURY_COLORS.gold }}
              thumbColor={voiceSettings.showTranscriptions ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
            style={styles.sectionIcon}
          >
            <Feather name="help-circle" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Support</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="help-circle"
            title="Help & FAQ"
            subtitle="Browse questions and chat with Julia"
            onPress={() => navigation.navigate("Help")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          />
          <SettingItem
            icon="message-circle"
            title="Chat with Julia"
            subtitle="Get instant support from our assistant"
            onPress={handleSupport}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
          <SettingItem
            icon="cpu"
            title="AI Feature Lab"
            subtitle="View AI-generated feature suggestions"
            onPress={() => navigation.navigate("FeatureSuggestions")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.coral, '#C46A4F']}
          />
          <SettingItem
            icon="file-text"
            title="Terms of Service"
            onPress={handleTerms}
            theme={theme}
            isDark={isDark}
          />
          <SettingItem
            icon="shield"
            title="Privacy Policy"
            onPress={handlePrivacy}
            theme={theme}
            isDark={isDark}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
            style={styles.sectionIcon}
          >
            <Feather name="briefcase" size={12} color={LUXURY_COLORS.midnight} />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Company</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="users"
            title="Partner With Us"
            subtitle="Stylists and brands enquiries"
            onPress={handlePartnerWithUs}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          />
        </View>
      </View>

      {onOpenPortal ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={[LUXURY_COLORS.berry, '#6B2430']}
              style={styles.sectionIcon}
            >
              <Feather name="lock" size={12} color="#FFFFFF" />
            </LinearGradient>
            <ThemedText type="h4" style={styles.sectionTitle}>Staff Access</ThemedText>
          </View>
          <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
            <SettingItem
              icon="scissors"
              title="Stylist Portal"
              subtitle="Access stylist dashboard"
              onPress={() => onOpenPortal('stylist')}
              theme={theme}
              isDark={isDark}
              iconGradient={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
            />
            <SettingItem
              icon="shield"
              title="Admin Portal"
              subtitle="Access admin dashboard"
              onPress={() => onOpenPortal('admin')}
              theme={theme}
              isDark={isDark}
              iconGradient={[LUXURY_COLORS.berry, '#6B2430']}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={['#64748B', '#475569']}
            style={styles.sectionIcon}
          >
            <Feather name="code" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>Development</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="image"
            title="Logo Preview"
            subtitle="View Dripn logo variations"
            onPress={() => navigation.navigate("LogoPreview")}
            theme={theme}
            isDark={isDark}
          />
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.coral, '#C46A4F']}
              style={styles.settingIconGradient}
            >
              <Feather name="book-open" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                DFY Lite Access
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {dfyAccess?.tier === 'lite' ? `${dfyAccess.daysRemaining}d remaining` : 'Test 14-day Lookbook'}
              </ThemedText>
            </View>
            <Switch
              value={dfyAccess?.tier === 'lite' && dfyAccess?.hasAccess}
              onValueChange={(value) => handleDFYToggle('lite', value)}
              disabled={dfyLoading}
              trackColor={{ false: isDark ? '#333' : '#E0E0E0', true: LUXURY_COLORS.coral }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.settingIconGradient}
            >
              <Feather name="grid" size={16} color={LUXURY_COLORS.midnight} />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                DFY Core Access
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {dfyAccess?.tier === 'core' ? `${dfyAccess.daysRemaining}d remaining` : 'Test 30-day Modular Wardrobe'}
              </ThemedText>
            </View>
            <Switch
              value={dfyAccess?.tier === 'core' && dfyAccess?.hasAccess}
              onValueChange={(value) => handleDFYToggle('core', value)}
              disabled={dfyLoading}
              trackColor={{ false: isDark ? '#333' : '#E0E0E0', true: LUXURY_COLORS.gold }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconPlain, { backgroundColor: 'rgba(255,59,48,0.15)' }]}>
            <Feather name="alert-circle" size={12} color="#FF3B30" />
          </View>
          <ThemedText type="h4" style={styles.sectionTitle}>Account Actions</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="log-out"
            title="Sign Out"
            onPress={handleLogout}
            showChevron={false}
            theme={theme}
            isDark={isDark}
          />
          <SettingItem
            icon="trash-2"
            title="Delete Account"
            onPress={handleDeleteAccount}
            showChevron={false}
            danger
            theme={theme}
            isDark={isDark}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <LinearGradient
          colors={[LUXURY_COLORS.gold + '30', 'transparent']}
          style={styles.footerGradient}
        >
          <ThemedText type="small" style={styles.versionText}>
            Dripn v1.0.0
          </ThemedText>
        </LinearGradient>
      </View>

      <Modal
        visible={pickerModal.visible}
        transparent
        animationType="slide"
        onRequestClose={closePickerModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closePickerModal}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}>
            <LinearGradient
              colors={isDark 
                ? [LUXURY_COLORS.violet + '30', 'transparent'] 
                : [LUXURY_COLORS.violet + '15', 'transparent']
              }
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="h3" style={styles.modalTitle}>
                  {pickerModal.type === 'language' ? 'Select Language' : 'Voice Speed'}
                </ThemedText>
                <Pressable 
                  onPress={closePickerModal} 
                  style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                >
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
              </View>
            </LinearGradient>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {pickerModal.type === 'language' ? (
                SUPPORTED_LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang.code}
                    style={({ pressed }) => [
                      styles.modalOption,
                      { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent' },
                      voiceSettings.preferredLanguage === lang.code && { backgroundColor: LUXURY_COLORS.violet + '20' },
                    ]}
                    onPress={() => {
                      updateVoiceSettings({ preferredLanguage: lang.code });
                      closePickerModal();
                    }}
                  >
                    <ThemedText type="body" style={styles.modalOptionText}>
                      {lang.name}
                    </ThemedText>
                    <ThemedText type="small" style={styles.modalOptionSubtext}>
                      {lang.nativeName}
                    </ThemedText>
                    {voiceSettings.preferredLanguage === lang.code ? (
                      <Feather name="check" size={20} color={LUXURY_COLORS.violet} />
                    ) : null}
                  </Pressable>
                ))
              ) : (
                SPEED_OPTIONS.map((speed) => (
                  <Pressable
                    key={speed.value}
                    style={({ pressed }) => [
                      styles.modalOption,
                      { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent' },
                      voiceSettings.voiceSpeed === speed.value && { backgroundColor: LUXURY_COLORS.violet + '20' },
                    ]}
                    onPress={() => {
                      updateVoiceSettings({ voiceSpeed: speed.value });
                      closePickerModal();
                    }}
                  >
                    <ThemedText type="body" style={styles.modalOptionText}>
                      {speed.label}
                    </ThemedText>
                    {voiceSettings.voiceSpeed === speed.value ? (
                      <Feather name="check" size={20} color={LUXURY_COLORS.violet} />
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    paddingBottom: Spacing.xl,
    marginBottom: Spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconPlain: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
  },
  sectionContent: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: 'center',
  },
  settingIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontWeight: "600",
  },
  settingSubtitle: {
    opacity: 0.6,
    marginTop: 2,
  },
  footer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  footerGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  versionText: {
    opacity: 0.5,
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
  colorSwatchGradient: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
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
    borderTopColor: "rgba(128, 128, 128, 0.15)",
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
    borderRadius: BorderRadius.sm,
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
  refreshButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  refreshButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
    paddingBottom: Spacing.xl,
  },
  modalHeaderGradient: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  modalTitle: {
    flex: 1,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollView: {
    paddingHorizontal: Spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginVertical: 2,
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionSubtext: {
    opacity: 0.6,
    marginRight: Spacing.md,
  },
});
