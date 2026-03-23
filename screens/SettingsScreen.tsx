import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert, Linking, Platform, Switch, ActivityIndicator, Modal, ScrollView, TextInput } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StyleTheme, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useReferral } from "@/contexts/ReferralContext";
import { useSmartNotifications } from "@/contexts/SmartNotificationsContext";
import { useVoiceSettings, SUPPORTED_LANGUAGES, SPEED_OPTIONS } from "@/contexts/VoiceSettingsContext";
import { apiService } from "@/services/ApiService";
import dfyService, { DFYAccessStatus, DFYTier } from "@/services/DFYService";
import { useColorScheme, ColorSchemeMode } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";

const NEWSLETTER_STATUS_KEY = "@dripn_newsletter_subscribed";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { SettingsStackParamList } from "@/navigation/SettingsStackNavigator";
import type { PortalMode } from "@/App";

// LUXURY_COLORS now dynamically set from palette in component

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
  luxury: "Minimalist",
  streetwear: "Casual",
  boho: "Creative",
  sporty: "Active",
  "smart-casual": "Smart Casual",
  business: "Professional",
  edgy: "Trendsetter",
};


export default function SettingsScreen({ navigation, onOpenPortal }: SettingsScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, logout, updateProfile } = useAuth();
  const { referralCode, totalReferrals, bonusAIRequests, shareReferral } = useReferral();
  const { preferences: notificationPrefs, updatePreferences } = useSmartNotifications();
  const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceSettings();
  const { setLanguage: setAppLanguage, t, translations } = useTranslations();
  const { colorScheme, setColorScheme, palette } = useColorScheme();
  
  // Dynamic colors from palette
  const LUXURY_COLORS = {
    gold: palette.gold,
    deepGold: palette.deepGold,
    rose: palette.rose,
    berry: palette.berry,
    violet: palette.violet,
    deepViolet: palette.deepViolet,
    champagne: '#F5E6D3',
    midnight: '#1A1A2E',
    coral: palette.coral,
    teal: palette.teal,
    emerald: palette.emerald,
  };
  
  const [isNewsletterSubscribed, setIsNewsletterSubscribed] = useState(false);
  const [pickerModal, setPickerModal] = useState<{ type: 'language' | 'speed' | 'colorScheme' | null; visible: boolean }>({ type: null, visible: false });
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(false);
  const [dfyAccess, setDfyAccess] = useState<DFYAccessStatus | null>(null);
  const [dfyLoading, setDfyLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const ALL_COUNTRIES = [
    "Albania", "Andorra", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
    "Austria", "Azerbaijan", "Bahamas", "Bangladesh", "Barbados", "Belarus", "Belgium",
    "Belize", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Bulgaria",
    "Canada", "Cayman Islands", "Chile", "China", "Colombia", "Costa Rica", "Croatia",
    "Cuba", "Curacao", "Cyprus", "Czech Republic", "Denmark", "Dominica", "Dominican Republic",
    "Ecuador", "Egypt", "El Salvador", "Estonia", "Ethiopia", "Fiji", "Finland", "France",
    "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guyana", "Haiti",
    "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel",
    "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Latvia",
    "Lebanon", "Lithuania", "Luxembourg", "Macau", "Malaysia", "Maldives", "Malta", "Mauritius",
    "Mexico", "Monaco", "Montenegro", "Morocco", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
    "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan", "Panama", "Paraguay", "Peru",
    "Philippines", "Poland", "Portugal", "Puerto Rico", "Qatar", "Romania", "Russia", "Rwanda",
    "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "San Marino",
    "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Singapore", "Slovakia", "Slovenia",
    "South Africa", "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan",
    "Tanzania", "Thailand", "Trinidad and Tobago", "Tunisia", "Turkey", "UAE", "Uganda", "Ukraine",
    "United Kingdom", "United States", "Uruguay", "Vatican City", "Venezuela", "Vietnam", "Zambia", "Zimbabwe",
  ];

  const filteredCountries = ALL_COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleSelectCountry = async (selectedCountry: string) => {
    setShowCountryPicker(false);
    setCountrySearch("");
    try {
      await updateProfile({ country: selectedCountry });
    } catch (error) {
      console.error('Failed to update country:', error);
      Alert.alert("Error", "Failed to update country. Please try again.");
    }
  };

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
    { value: 'colorful', label: t('settings.colorful'), description: t('settings.colorfulDesc') },
    { value: 'minimalist', label: t('settings.minimalist'), description: t('settings.minimalistDesc') },
  ];

  const handleDFYToggle = async (tier: DFYTier, value: boolean) => {
    if (!user?.id) return;
    setDfyLoading(true);
    try {
      if (value) {
        if (dfyAccess?.hasAccess && dfyAccess.tier !== tier) {
          await dfyService.clearDFYAccess(user.id);
        }
        if (tier === 'lite') {
          await dfyService.createMockLiteDelivery(user.id, user.stylistPreferences?.selectedStylistId || 'ruby');
        } else {
          await dfyService.activateDFYAccess(user.id, tier);
        }
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

  const handleTestingModeToggle = async (value: boolean) => {
    if (!user?.id) return;
    try {
      await updateProfile({ subscriptionTier: value ? 'pro' : 'free' });
      if (value) {
        await dfyService.createMockLiteDelivery(user.id, user.stylistPreferences?.selectedStylistId || 'ruby');
        await loadDFYAccess();
      }
    } catch (error) {
      console.error('Error toggling testing mode:', error);
      Alert.alert('Error', 'Could not update testing mode. Please try again.');
    }
  };

  const headerGradientColors: readonly [string, string, string] = colorScheme === 'minimalist' 
    ? ['#C9A87C', '#A88B5C', '#3D3426'] as const
    : [ScreenGradients.settings.primary[0], ScreenGradients.settings.primary[1], LuxuryColors.obsidian] as const;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={headerGradientColors}
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
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('settings.title')}</ThemedText>
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
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.account')}</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="user"
            title={t('settings.editProfile')}
            subtitle={user?.name}
            onPress={() => navigation.navigate("EditProfile")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
          <SettingItem
            icon="credit-card"
            title={t('settings.subscription')}
            subtitle={user?.subscriptionTier === "free" ? "Free Plan" : `${user?.subscriptionTier} Plan`}
            onPress={() => navigation.navigate("Subscription")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          />
          <SettingItem
            icon="mail"
            title={t('settings.email')}
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
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.preferences')}</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="heart"
            title={t('settings.styleTheme')}
            subtitle={STYLE_NAMES[user?.stylePreference || "luxury"]}
            onPress={handleChangeStyle}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.rose, LUXURY_COLORS.coral]}
          />
          <SettingItem
            icon="droplet"
            title={t('settings.colourScheme')}
            subtitle={colorScheme === 'colorful' ? t('settings.colorful') : t('settings.minimalist')}
            onPress={handleColorSchemeSelect}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          />
          <SettingItem
            icon="map-pin"
            title={t('settings.country')}
            subtitle={user?.country || t('settings.notSet')}
            onPress={() => setShowCountryPicker(true)}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.coral, '#C46A4F']}
          />
          <SettingItem
            icon="user"
            title={t('settings.bodyMeasurements')}
            subtitle={user?.bodyMeasurements?.height ? `${user.bodyMeasurements.height} ${user.bodyMeasurements.heightUnit}` : t('settings.notSet')}
            onPress={() => navigation.navigate("BodyMeasurements")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.rose, LUXURY_COLORS.violet]}
          />
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
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.inviteFriends')}</ThemedText>
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
                {t('settings.shareYourCode')}: {referralCode}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {totalReferrals > 0
                  ? `${totalReferrals} friends joined - ${bonusAIRequests} AI requests & 10% discount earned`
                  : t('settings.inviteDescription')}
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
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.notifications')}</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
              style={styles.settingIconGradient}
            >
              <Feather name="users" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                {t('settings.communityVoting')}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {t('settings.communityVotingDesc')}
              </ThemedText>
            </View>
            <Switch
              value={notificationPrefs.communityVoting}
              onValueChange={(value) => updatePreferences({ communityVoting: value })}
              trackColor={{ false: theme.tabIconDefault, true: LUXURY_COLORS.violet }}
              thumbColor={notificationPrefs.communityVoting ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.emerald, '#059669']}
              style={styles.settingIconGradient}
            >
              <Feather name="tag" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                {t('settings.priceAlerts')}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {t('settings.priceAlertsDesc')}
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
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.voiceAndLanguage')}</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="globe"
            title={t('settings.language')}
            subtitle={SUPPORTED_LANGUAGES.find(l => l.code === voiceSettings.preferredLanguage)?.nativeName || "English"}
            onPress={handleLanguageSelect}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
          <SettingItem
            icon="fast-forward"
            title={t('settings.voiceSpeed')}
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
                {t('settings.autoPlayResponses')}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {t('settings.autoPlayDescription')}
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
                {t('settings.showTranscriptions')}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {t('settings.showTranscriptionsDescription')}
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
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.support')}</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="help-circle"
            title={t('settings.helpAndFaq')}
            subtitle={t('settings.helpSubtitle')}
            onPress={() => navigation.navigate("Help")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          />
          <SettingItem
            icon="message-circle"
            title={t('settings.chatWithJulia')}
            subtitle={t('settings.chatWithJuliaSubtitle')}
            onPress={handleSupport}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
          <SettingItem
            icon="cpu"
            title={t('settings.aiFeatureLab')}
            subtitle={t('settings.aiFeatureLabSubtitle')}
            onPress={() => navigation.navigate("FeatureSuggestions")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.coral, '#C46A4F']}
          />
          <SettingItem
            icon="edit-3"
            title={t('settings.sendFeedback')}
            subtitle={t('settings.sendFeedbackSubtitle')}
            onPress={() => navigation.navigate("Feedback")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
          />
          <SettingItem
            icon="file-text"
            title={t('settings.termsOfService')}
            onPress={handleTerms}
            theme={theme}
            isDark={isDark}
          />
          <SettingItem
            icon="shield"
            title={t('settings.privacyPolicy')}
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
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.company')}</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="users"
            title={t('settings.partnerWithUs')}
            subtitle={t('settings.partnerWithUsSubtitle')}
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
              colors={[LUXURY_COLORS.emerald, LUXURY_COLORS.teal]}
              style={styles.settingIconGradient}
            >
              <Feather name="unlock" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                Testing Mode
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {user?.subscriptionTier === 'pro' ? 'Full access enabled' : 'Unlock all features'}
              </ThemedText>
            </View>
            <Switch
              value={user?.subscriptionTier === 'pro'}
              onValueChange={handleTestingModeToggle}
              trackColor={{ false: isDark ? '#333' : '#E0E0E0', true: LUXURY_COLORS.emerald }}
              thumbColor="#FFFFFF"
            />
          </View>
          <SettingItem
            icon="users"
            title="Community Vote Preview"
            subtitle="View voting screen as a member"
            onPress={() => navigation.navigate("CommunityVoting", { session: null })}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
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
          <SettingItem
            icon="users"
            title="Community Vote Preview"
            subtitle="View voting screen as a member"
            onPress={() => navigation.navigate("CommunityVoting", { session: null })}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconPlain, { backgroundColor: 'rgba(255,59,48,0.15)' }]}>
            <Feather name="alert-circle" size={12} color="#FF3B30" />
          </View>
          <ThemedText type="h4" style={styles.sectionTitle}>{t('settings.accountActions')}</ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <SettingItem
            icon="log-out"
            title={t('settings.signOut')}
            onPress={handleLogout}
            showChevron={false}
            theme={theme}
            isDark={isDark}
          />
          <SettingItem
            icon="trash-2"
            title={t('settings.deleteAccount')}
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
                  {pickerModal.type === 'language' ? t('settings.selectLanguage') : pickerModal.type === 'colorScheme' ? t('settings.selectColourScheme') : t('settings.voiceSpeed')}
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
                    onPress={async () => {
                      updateVoiceSettings({ preferredLanguage: lang.code });
                      await setAppLanguage(lang.code);
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
              ) : pickerModal.type === 'colorScheme' ? (
                COLOR_SCHEME_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.modalOption,
                      { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent' },
                      colorScheme === option.value && { backgroundColor: LUXURY_COLORS.teal + '20' },
                    ]}
                    onPress={() => {
                      setColorScheme(option.value);
                      closePickerModal();
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={styles.modalOptionText}>
                        {option.label}
                      </ThemedText>
                      <ThemedText type="small" style={styles.modalOptionSubtext}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {colorScheme === option.value ? (
                      <Feather name="check" size={20} color={LUXURY_COLORS.teal} />
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

      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCountryPicker(false);
          setCountrySearch("");
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowCountryPicker(false);
            setCountrySearch("");
          }}
        >
          <View style={[styles.countryModalContent, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}>
            <LinearGradient
              colors={isDark 
                ? [LUXURY_COLORS.coral + '30', 'transparent'] 
                : [LUXURY_COLORS.coral + '15', 'transparent']
              }
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="h3" style={styles.modalTitle}>
                  Select Country
                </ThemedText>
                <Pressable 
                  onPress={() => {
                    setShowCountryPicker(false);
                    setCountrySearch("");
                  }} 
                  style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                >
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
              </View>
            </LinearGradient>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color={theme.tabIconDefault} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={[styles.searchInput, { backgroundColor: 'transparent', color: theme.text, flex: 1 }]}
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Search countries..."
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                autoCapitalize="none"
              />
            </View>
            <ScrollView style={styles.countryListScroll} showsVerticalScrollIndicator={false}>
              {filteredCountries.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => handleSelectCountry(c)}
                  style={({ pressed }) => [
                    styles.countryItem,
                    { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent' },
                    user?.country === c && { backgroundColor: LUXURY_COLORS.coral + '20' },
                  ]}
                >
                  <ThemedText type="body">{c}</ThemedText>
                  {user?.country === c ? (
                    <Feather name="check" size={20} color={LUXURY_COLORS.coral} />
                  ) : null}
                </Pressable>
              ))}
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
  countryModalContent: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  countryListScroll: {
    paddingHorizontal: Spacing.md,
    maxHeight: 400,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginVertical: 2,
  },
});
