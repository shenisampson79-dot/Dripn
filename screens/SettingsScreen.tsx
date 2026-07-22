import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, Alert, Linking, Platform, Switch, ActivityIndicator, Modal, ScrollView, TextInput, Share } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Clipboard from "expo-clipboard";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useReferral } from "@/contexts/ReferralContext";
import { useSmartNotifications } from "@/contexts/SmartNotificationsContext";
import { useVoiceSettings, SUPPORTED_LANGUAGES, SPEED_OPTIONS, VoiceSpeed } from "@/contexts/VoiceSettingsContext";
import { apiService } from "@/services/ApiService";
import dfyService, { DFYAccessStatus, DFYTier } from "@/services/DFYService";
import { useColorScheme, ColorSchemeMode } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { normalizeSubscriptionTier } from "@/utils/subscriptionTier";
import { getLocalizedSubscriptionSubtitle } from "@/utils/subscriptionPlanLabels";
import { getStyleThemeLabel } from "@/utils/styleThemeLabels";
import { ALL_COUNTRIES } from "@/constants/countries";
import { filterCountriesBySearch, getLocalizedCountryName } from "@/utils/countryLocalization";
import { isDevTestingModeEnabled, setDevTestingModeEnabled } from "@/utils/devTesting";
import { isStaffUser } from "@/utils/staffAccess";
import { shouldUseAppleIAP } from "@/utils/platformPayments";
import { VoiceCreditsPurchaseModal } from "@/components/VoiceCreditsPurchaseModal";
import { LanguagePickerModal } from "@/components/LanguagePickerModal";
import { useVoiceCredits } from "@/hooks/useVoiceCredits";
import { resolveStylistSpeakLanguage, stylistLanguageCodeToName } from "@/utils/stylistLanguage";
import {
  DEFAULT_TODAYS_OUTFIT_POPUP_PREFS,
  formatHourLabel,
  getOccasionPrefLabel,
  getTodaysOutfitPopupPrefs,
  OCCASION_PREF_OPTIONS,
  saveTodaysOutfitPopupPrefs,
  type TodaysOutfitOccasionPref,
  type TodaysOutfitPopupPrefs,
} from "@/utils/todaysOutfitPrefs";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
} from "@/utils/analyticsConsent";
import { LAUNDRY_HABIT_OPTIONS, normalizeLaundryHabit, type LaundryHabit } from '@/utils/wearRules';
import { getDfyBenefitForSubscription } from '@/utils/dfyEntitlements';
import type { TravelPlan } from '@/utils/travelCapsule';
import { isPlaceholderDestination } from '@/utils/travelCapsule';
import { formatDisplayDate } from '@/utils/lookbookTripDay';

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

export default function SettingsScreen({ navigation, onOpenPortal }: SettingsScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, logout, updateProfile } = useAuth();
  const { referralCode, totalReferrals, shareReferral, applyReferralCode, referredByCode, referralCreditPercent, referralNextInvoicePercent } = useReferral();
  const { preferences: notificationPrefs, updatePreferences } = useSmartNotifications();
  const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceSettings();
  const { t, translations, currentLanguage, availableLanguages } = useTranslations();
  const { colorScheme, setColorScheme, palette } = useColorScheme();
  
  // Staff-only — never shown to regular users (Admin Portal / Development)
  const isStaff = isStaffUser(user);
  const showStaffTools = isStaff;
  // Testing Mode: keep visible for App Store review (remove / re-gate after Apple approval)
  const showTestingTools = true;
  
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
  const [analyticsConsentEnabled, setAnalyticsConsentEnabled] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [pickerModal, setPickerModal] = useState<{ type: 'speed' | 'colorScheme' | null; visible: boolean }>({ type: null, visible: false });
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [stylistLanguagePickerVisible, setStylistLanguagePickerVisible] = useState(false);
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(false);
  const [dfyAccess, setDfyAccess] = useState<DFYAccessStatus | null>(null);
  const [travelPlan, setTravelPlan] = useState<TravelPlan | null>(null);
  const [dfyLoading, setDfyLoading] = useState(false);
  const [testingModeEnabled, setTestingModeEnabled] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showVoiceCreditsModal, setShowVoiceCreditsModal] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [aiUsage, setAiUsage] = useState<{
    month: string;
    usedCents: number;
    budgetCents: number;
    rembgLifetimeCount: number;
    rembgMonthCount: number;
    remainingCents: number;
  } | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [freeRembgLifetimeLimit, setFreeRembgLifetimeLimit] = useState(10);
  const [outfitPopupPrefs, setOutfitPopupPrefs] = useState<TodaysOutfitPopupPrefs>(
    DEFAULT_TODAYS_OUTFIT_POPUP_PREFS,
  );
  const [outfitPopupPicker, setOutfitPopupPicker] = useState<'appearAt' | 'occasion' | null>(null);
  const {
    remainingCredits,
    hasMonthlyAllowance,
    usageLabel,
    shouldShowBuyPacks,
    isLoading: voiceCreditsLoading,
    weekendUnlimitedActive,
    weekendExpiryLabel,
  } = useVoiceCredits();

  const filteredCountries = filterCountriesBySearch(ALL_COUNTRIES, countrySearch, currentLanguage, t);

  const handleSelectCountry = async (selectedCountry: string) => {
    setShowCountryPicker(false);
    setCountrySearch("");
    try {
      await updateProfile({ country: selectedCountry });
    } catch (error) {
      console.error('Failed to update country:', error);
      Alert.alert(t('common.error') || "Error", t('common.failedToUpdateCountryPleaseTryAgain') || "Failed to update country. Please try again.");
    }
  };

  const loadDFYAccess = async () => {
    if (!user?.id) return;
    try {
      const status = await dfyService.getDFYAccessStatus(user.id, user.subscriptionTier);
      setDfyAccess(status);
    } catch (error) {
      console.error('Error loading DFY access:', error);
    }
  };

  const loadTravelPlan = useCallback(async () => {
    if (!user?.id) {
      setTravelPlan(null);
      return;
    }
    try {
      const delivery = await dfyService.getDFYDelivery(user.id);
      setTravelPlan(delivery?.tier === 'lite' ? delivery.travelPlan ?? null : null);
    } catch (error) {
      console.error('Error loading travel plan:', error);
      setTravelPlan(null);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadDFYAccess();
      loadTravelPlan();
    }, [user?.id, user?.subscriptionTier, loadTravelPlan]),
  );

  useEffect(() => {
    if (!user?.id) {
      setAiUsage(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setAiUsageLoading(true);
      try {
        await apiService.init();
        const result = await apiService.getAiUsage();
        if (!cancelled) {
          setAiUsage(result.usage || null);
          if (typeof result.freeRembgLifetimeLimit === 'number') {
            setFreeRembgLifetimeLimit(result.freeRembgLifetimeLimit);
          }
        }
      } catch (err) {
        console.warn('[Settings] AI usage load skipped:', err);
        if (!cancelled) setAiUsage(null);
      } finally {
        if (!cancelled) setAiUsageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await getTodaysOutfitPopupPrefs();
      if (!cancelled) setOutfitPopupPrefs(prefs);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateOutfitPopupPrefs = async (partial: Partial<TodaysOutfitPopupPrefs>) => {
    try {
      const next = await saveTodaysOutfitPopupPrefs(partial);
      setOutfitPopupPrefs(next);
      // Force next Stylist open to rebuild for the new occasion / window
      await AsyncStorage.removeItem('@dripn_todays_wardrobe_outfit');
    } catch (err) {
      console.warn('[Settings] Failed to save outfit popup prefs:', err);
      Alert.alert(t('common.error') || 'Error', t('settings.couldNotSaveOutfitPopup') || 'Could not save outfit popup settings.');
    }
  };

  useEffect(() => {
    if (!showTestingTools) return;
    let cancelled = false;
    (async () => {
      const enabled = await isDevTestingModeEnabled();
      if (!cancelled) {
        setTestingModeEnabled(
          enabled || normalizeSubscriptionTier(user?.subscriptionTier) === 'stylist_unlimited'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showTestingTools, user?.subscriptionTier]);

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
      Alert.alert(t('common.sharingFailed') || "Sharing Failed", t('common.couldNotShareYourReferralCodePleaseTryAg') || "Could not share your referral code. Please try again.");
    }
  };

  const handleApplyReferralCode = async () => {
    const result = await applyReferralCode(referralCodeInput);
    Alert.alert(
      result.success
        ? (t('settings.referralAppliedTitle') || 'Referral applied')
        : (t('common.error') || 'Error'),
      result.message,
    );
    if (result.success) setReferralCodeInput('');
  };

  const handleEmailPress = () => {
    const supportEmail = 'support@dripnapp.com';
    Alert.alert(
      t('settings.emailChangeTitle') || 'Change email',
      t('settings.emailChangeMessage') ||
        "Your email is your account ID and can't be changed here. Contact support@dripnapp.com if you need to update it.",
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('settings.emailContactSupport') || 'Email support',
          onPress: () => {
            const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent('Change account email')}`;
            Linking.openURL(mailtoUrl).catch(() => {
              Alert.alert(
                t('common.error') || 'Error',
                (t('settings.emailSupportFallback') || 'Could not open your email app. Please write to {email}.').replace(
                  '{email}',
                  supportEmail,
                ),
              );
            });
          },
        },
      ],
    );
  };

  const handleNewsletterToggle = async (value: boolean) => {
    if (!user?.email) {
      Alert.alert(t('common.error') || "Error", t('common.pleaseAddAnEmailToYourAccountFirst') || "Please add an email to your account first.");
      return;
    }

    setIsNewsletterLoading(true);
    try {
      if (value) {
        await apiService.subscribeToNewsletter(user.email, user.name);
        setIsNewsletterSubscribed(true);
        await AsyncStorage.setItem(NEWSLETTER_STATUS_KEY, "true");
        Alert.alert(
          t('common.subscribed') || "Subscribed",
          t('common.youreNowSubscribedToDripnFashionUpdates') || "You're now subscribed to Dripn fashion updates!",
        );
      } else {
        await apiService.unsubscribeFromNewsletter(user.email);
        setIsNewsletterSubscribed(false);
        await AsyncStorage.setItem(NEWSLETTER_STATUS_KEY, "false");
        Alert.alert(
          t('common.unsubscribed') || "Unsubscribed",
          t('common.youveBeenUnsubscribedFromTheNewsletter') || "You've been unsubscribed from the newsletter.",
        );
      }
    } catch (error) {
      Alert.alert(t('common.error') || "Error", t('common.couldNotUpdateNewsletterSubscriptionPlea') || "Could not update newsletter subscription. Please try again.");
    } finally {
      setIsNewsletterLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.signOut'),
      t('settings.signOutConfirm'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('settings.signOut'),
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const consent = await getAnalyticsConsent();
      if (!cancelled) setAnalyticsConsentEnabled(consent === 'accepted');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExportMyData = async () => {
    if (exportingData) return;
    setExportingData(true);
    try {
      await apiService.init();
      const data = await apiService.exportMyData();
      const json = JSON.stringify(data, null, 2);
      const fileName = `dripn-data-export-${Date.now()}.json`;
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (dir) {
        const path = `${dir}${fileName}`;
        await FileSystem.writeAsStringAsync(path, json);
        try {
          await Share.share({
            title: t('settings.downloadMyData') || 'Download my data',
            message: Platform.OS === 'android' ? json.slice(0, 50000) : (t('settings.downloadMyDataShareMessage') || 'My Dripn data export'),
            url: Platform.OS === 'ios' ? path : undefined,
          });
        } catch {
          await Clipboard.setStringAsync(json.slice(0, 100000));
          Alert.alert(
            t('settings.downloadMyData') || 'Download my data',
            t('settings.downloadMyDataCopied') || 'Export ready. A copy was saved to your clipboard (large exports may be truncated).',
          );
        }
      } else {
        await Clipboard.setStringAsync(json.slice(0, 100000));
        Alert.alert(
          t('settings.downloadMyData') || 'Download my data',
          t('settings.downloadMyDataCopied') || 'Export copied to clipboard.',
        );
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      Alert.alert(t('common.error'), t('settings.downloadMyDataFailed') || 'Could not export your data. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleAnalyticsConsentToggle = async (enabled: boolean) => {
    setAnalyticsConsentEnabled(enabled);
    await setAnalyticsConsent(enabled ? 'accepted' : 'rejected');
  };

  const handleDeleteAccount = () => {
    const appleBillingWarning = shouldUseAppleIAP()
      ? `\n\n${t('settings.deleteAccountAppleBillingWarning')}`
      : '';

    Alert.alert(
      t('settings.deleteAccount') || 'Delete Account',
      `${t('settings.deleteAccountConfirm')}${appleBillingWarning}`,
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('settings.deleteAccountDelete'),
          style: "destructive",
          onPress: () => {
            Alert.alert(
              t('settings.deleteAccountFinalTitle'),
              `${t('settings.deleteAccountFinalMessage')}${appleBillingWarning}`,
              [
                { text: t('common.cancel'), style: "cancel" },
                {
                  text: t('settings.deleteAccountConfirmButton'),
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const result = await apiService.deleteAccount();
                      if (result.success) {
                        if (result.appleSubscriptionNotice) {
                          Alert.alert(t('settings.deleteAccountDeletedTitle'), result.appleSubscriptionNotice);
                        }
                        await logout();
                      }
                    } catch (error) {
                      console.error('Failed to delete account:', error);
                      Alert.alert(t('common.error'), t('settings.deleteAccountFailed'));
                    }
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
      t('settings.styleSuggestions'),
      isEnabled
        ? t('settings.styleSuggestionsOn')
        : t('settings.styleSuggestionsOff'),
      [
        {
          text: isEnabled ? t('settings.turnOff') : t('settings.turnOn'),
          onPress: () => updateProfile({ aiSuggestionsEnabled: !isEnabled })
        },
        { text: t('common.cancel'), style: "cancel" },
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

  const handleLanguageSelect = () => {
    setLanguagePickerVisible(true);
  };

  const handleStylistLanguageSelect = () => {
    setStylistLanguagePickerVisible(true);
  };

  const handleSpeedSelect = () => {
    setPickerModal({ type: 'speed', visible: true });
  };

  const handleColorSchemeSelect = () => {
    setPickerModal({ type: 'colorScheme', visible: true });
  };

  const getLaundryHabitLabel = (habit: LaundryHabit) => {
    const key = LAUNDRY_HABIT_OPTIONS.find((o) => o.id === habit)?.labelKey;
    return key ? (t(key) || habit) : habit;
  };

  const handleLaundryHabitSelect = () => {
    Alert.alert(
      t('settings.laundry.title') || 'How do you handle laundry?',
      t('settings.laundry.subtitle') || 'Helps Dripn know when pieces are ready to wear again.',
      [
        ...LAUNDRY_HABIT_OPTIONS.map((option) => ({
          text: t(option.labelKey) || option.id,
          onPress: () => {
            void updateProfile({
              extendedPreferences: {
                ...user?.extendedPreferences,
                laundryHabit: option.id,
              },
              profileData: {
                ...(user?.profileData || {}),
                laundryHabit: option.id,
              },
            });
          },
        })),
        { text: t('common.cancel') || 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const closePickerModal = () => {
    setPickerModal({ type: null, visible: false });
  };

  const COLOR_SCHEME_OPTIONS: { value: ColorSchemeMode; label: string; description: string }[] = [
    { value: 'colorful', label: t('settings.colorful'), description: t('settings.colorfulDesc') },
    { value: 'minimalist', label: t('settings.minimalist'), description: t('settings.minimalistDesc') },
  ];

  const languageOptions = availableLanguages.length > 0
    ? availableLanguages
    : SUPPORTED_LANGUAGES.map((lang) => ({
        ...lang,
        direction: (lang.code === 'ar' ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
      }));

  const currentLanguageLabel =
    languageOptions.find((lang) => lang.code === currentLanguage)?.nativeName
    || SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage)?.nativeName
    || translations.localeInfo.language
    || 'English';

  const stylistSpeakCode = resolveStylistSpeakLanguage({
    stylistLanguageName: user?.stylistPreferences?.language,
    preferredLanguageCode: voiceSettings.preferredLanguage,
    uiLanguageCode: currentLanguage,
  });
  const stylistLanguageLabel =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === stylistSpeakCode)?.nativeName
    || stylistLanguageCodeToName(stylistSpeakCode);

  const getSpeedLabel = (value: VoiceSpeed): string => {
    switch (value) {
      case 0.5: return t('settings.verySlow');
      case 0.75: return t('settings.slow');
      case 1.0: return t('settings.normal');
      case 1.25: return t('settings.fast');
      case 1.5: return t('settings.veryFast');
      case 2.0: return t('settings.maximum');
      default: return t('settings.normal');
    }
  };

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
      Alert.alert(t('common.error'), t('settings.couldNotUpdateDfy'));
    } finally {
      setDfyLoading(false);
    }
  };

  const handleTestingModeToggle = async (value: boolean) => {
    if (!user?.id) return;
    try {
      setTestingModeEnabled(value);
      await setDevTestingModeEnabled(value);
      await updateProfile({ subscriptionTier: value ? 'stylist_unlimited' : 'free' });
    } catch (error) {
      console.error('Error toggling testing mode:', error);
      setTestingModeEnabled(!value);
      Alert.alert(t('common.error'), t('settings.couldNotUpdateTesting'));
    }
  };

  const headerGradientColors: readonly [string, string, string] = colorScheme === 'minimalist' 
    ? ['#C9A87C', '#A88B5C', '#3D3426'] as const
    : [ScreenGradients.settings.primary[0], ScreenGradients.settings.primary[1], LuxuryColors.obsidian] as const;

  const hasLiteAccess = dfyAccess?.tier === 'lite' && dfyAccess?.hasAccess;
  const hasTravelCapsuleBenefit = getDfyBenefitForSubscription(user?.subscriptionTier) === 'styling_sprint';
  const showTravelCapsuleSettings = hasLiteAccess || hasTravelCapsuleBenefit || !!travelPlan;

  const travelCapsuleSubtitle = travelPlan?.destination && !isPlaceholderDestination(travelPlan.destination)
    ? (t('settings.travelCapsule.subtitle') || '{destination} · {startDate} – {endDate}')
        .replace('{destination}', travelPlan.destination)
        .replace('{startDate}', formatDisplayDate(travelPlan.startDate))
        .replace('{endDate}', formatDisplayDate(travelPlan.endDate))
    : (t('settings.travelCapsule.emptySubtitle') || 'Add destination and trip dates');

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={headerGradientColors}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={styles.headerContent}>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('settings.title')}</ThemedText>
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
            subtitle={getLocalizedSubscriptionSubtitle(user?.subscriptionTier, t)}
            onPress={() => navigation.navigate("Subscription")}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          />
          {user?.id ? (
            <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
              <LinearGradient
                colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                style={styles.settingIconGradient}
              >
                <Feather name="activity" size={16} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.settingContent}>
                <ThemedText type="body" style={styles.settingTitle}>
                  {t('settings.usageThisMonth') || 'Usage this month'}
                </ThemedText>
                {(() => {
                  const usagePct = aiUsage
                    ? Math.min(
                        100,
                        Math.round(
                          (aiUsage.usedCents / Math.max(aiUsage.budgetCents, 1)) * 100,
                        ),
                      )
                    : 0;
                  const usageRatio = aiUsage
                    ? aiUsage.usedCents / Math.max(aiUsage.budgetCents, 1)
                    : 0;
                  const isFree =
                    normalizeSubscriptionTier(user?.subscriptionTier) === 'free';

                  return (
                    <>
                      <ThemedText type="small" style={styles.settingSubtitle}>
                        {aiUsageLoading
                          ? (t('common.loading') || 'Loading…')
                          : aiUsage
                            ? (t('settings.usageMeterPct') || '{pct}% of monthly allowance used')
                                .replace('{pct}', String(usagePct))
                            : (t('settings.usageUnavailable') ||
                              'Usage will appear after your next AI action')}
                      </ThemedText>
                      {aiUsage ? (
                        <>
                          <View
                            style={[
                              styles.usageTrack,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(0,0,0,0.06)',
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.usageFill,
                                {
                                  width: `${usagePct}%`,
                                  backgroundColor:
                                    usageRatio >= 0.9
                                      ? '#FF3B30'
                                      : usageRatio >= 0.7
                                        ? LUXURY_COLORS.gold
                                        : LUXURY_COLORS.teal,
                                },
                              ]}
                            />
                          </View>
                          <ThemedText
                            type="small"
                            style={[styles.settingSubtitle, { marginTop: 6 }]}
                          >
                            {isFree
                              ? (t('settings.usageRembgFreeLine') ||
                                  'Background removals: {used} of {cap}')
                                  .replace(
                                    '{used}',
                                    String(aiUsage.rembgLifetimeCount ?? aiUsage.rembgMonthCount),
                                  )
                                  .replace('{cap}', String(freeRembgLifetimeLimit))
                              : (t('settings.usageRembgMonthLine') ||
                                  'Background removals: {month} this month').replace(
                                  '{month}',
                                  String(aiUsage.rembgMonthCount),
                                )}
                          </ThemedText>
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </View>
            </View>
          ) : null}
          <SettingItem
            icon="mail"
            title={t('settings.email')}
            subtitle={user?.email || (t('settings.notSet') || 'Not set')}
            onPress={handleEmailPress}
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
            subtitle={getStyleThemeLabel(user?.stylePreference, t)}
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
            icon="droplet"
            title={t('settings.laundry.title') || 'How do you handle laundry?'}
            subtitle={getLaundryHabitLabel(
              normalizeLaundryHabit(user?.extendedPreferences?.laundryHabit ?? user?.profileData?.laundryHabit),
            )}
            onPress={handleLaundryHabitSelect}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          />
          {showTravelCapsuleSettings ? (
            <SettingItem
              icon="briefcase"
              title={t('settings.travelCapsule.title') || 'Travel Capsule'}
              subtitle={travelCapsuleSubtitle}
              onPress={() => navigation.navigate('DFYTravelPlan', { mode: 'edit' })}
              theme={theme}
              isDark={isDark}
              iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
            />
          ) : null}
          <SettingItem
            icon="map-pin"
            title={t('settings.country')}
            subtitle={
              user?.country
                ? getLocalizedCountryName(user.country, currentLanguage, t)
                : t('settings.notSet')
            }
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
            colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
            style={styles.sectionIcon}
          >
            <Feather name="sun" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t('settings.todaysOutfitPopup') || "Today's outfit popup"}
          </ThemedText>
        </View>
        <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.settingIconGradient}
            >
              <Feather name="bell" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                {t('settings.showOutfitPopup') || 'Show daily outfit popup'}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {t('settings.showOutfitPopupDesc') || "Auto-open today's look on Stylist once your wardrobe can make 7 different outfits, from your chosen time until you act on it"}
              </ThemedText>
            </View>
            <Switch
              value={outfitPopupPrefs.enabled}
              onValueChange={(value) => void updateOutfitPopupPrefs({ enabled: value })}
              trackColor={{ false: theme.tabIconDefault, true: LUXURY_COLORS.gold }}
              thumbColor={outfitPopupPrefs.enabled ? '#FFFFFF' : '#F4F4F4'}
            />
          </View>
          <SettingItem
            icon="clock"
            title={t('settings.outfitPopupAppearAt') || 'Appear at'}
            subtitle={formatHourLabel(outfitPopupPrefs.appearAtHour)}
            onPress={() => setOutfitPopupPicker('appearAt')}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          />
          <SettingItem
            icon="briefcase"
            title={t('settings.outfitPopupOccasion') || 'Occasion'}
            subtitle={getOccasionPrefLabel(outfitPopupPrefs.preferredOccasion)}
            onPress={() => setOutfitPopupPicker('occasion')}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
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
          {(hasMonthlyAllowance || shouldShowBuyPacks || remainingCredits > 0 || weekendUnlimitedActive) ? (
            <SettingItem
              icon="zap"
              title={weekendUnlimitedActive ? t('voiceCredits.weekendVoiceActive') : shouldShowBuyPacks ? t('voiceCredits.topUpVoiceReplies') : t('voiceCredits.voiceReplies')}
              subtitle={
                voiceCreditsLoading
                  ? t('voiceCredits.loadingBalance')
                  : weekendUnlimitedActive
                    ? `${t('voiceCredits.expires')} ${weekendExpiryLabel}`
                    : usageLabel
                      ? `${usageLabel} ${t('voiceCredits.thisMonth')}`
                      : `${remainingCredits} ${remainingCredits === 1 ? t('voiceCredits.spokenReply') : t('voiceCredits.spokenReplies')}`
              }
              onPress={() => setShowVoiceCreditsModal(true)}
              theme={theme}
              isDark={isDark}
              iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
            />
          ) : null}
          <SettingItem
            icon="globe"
            title={t('settings.appLanguage') || t('settings.language') || 'App language'}
            subtitle={currentLanguageLabel}
            onPress={handleLanguageSelect}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          />
          <SettingItem
            icon="message-circle"
            title={t('settings.stylistLanguage') || 'Stylist language'}
            subtitle={stylistLanguageLabel}
            onPress={handleStylistLanguageSelect}
            theme={theme}
            isDark={isDark}
            iconGradient={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
          />
          <SettingItem
            icon="fast-forward"
            title={t('settings.voiceSpeed')}
            subtitle={getSpeedLabel(voiceSettings.voiceSpeed)}
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
          <SettingItem
            icon="download"
            title={exportingData ? (t('settings.downloadMyDataLoading') || 'Preparing export…') : (t('settings.downloadMyData') || 'Download my data')}
            subtitle={t('settings.downloadMyDataSubtitle') || 'Export your account data as JSON'}
            onPress={handleExportMyData}
            theme={theme}
            isDark={isDark}
            showChevron={!exportingData}
            iconGradient={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          />
          <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
            <View style={[styles.settingIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              <Feather name="bar-chart-2" size={16} color={theme.text} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body" style={styles.settingTitle}>
                {t('settings.optionalAnalytics') || 'Optional analytics'}
              </ThemedText>
              <ThemedText type="small" style={styles.settingSubtitle}>
                {t('settings.optionalAnalyticsSubtitle') || 'Help improve onboarding. Off by default. Core app works either way.'}
              </ThemedText>
            </View>
            <Switch
              value={analyticsConsentEnabled}
              onValueChange={handleAnalyticsConsentToggle}
              trackColor={{ false: theme.tabIconDefault, true: LUXURY_COLORS.teal }}
              thumbColor={analyticsConsentEnabled ? "#FFFFFF" : "#F4F4F4"}
            />
          </View>
        </View>
      </View>

      {showStaffTools && onOpenPortal ? (
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
              icon="shield"
              title={t('common.adminPortal') || "Admin Portal"}
              subtitle={t('common.accessAdminDashboard') || "Access admin dashboard"}
              onPress={() => onOpenPortal('admin')}
              theme={theme}
              isDark={isDark}
              iconGradient={[LUXURY_COLORS.berry, '#6B2430']}
            />
          </View>
        </View>
      ) : null}

      {showTestingTools ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={[LUXURY_COLORS.emerald, LUXURY_COLORS.teal]}
              style={styles.sectionIcon}
            >
              <Feather name="sliders" size={12} color="#FFFFFF" />
            </LinearGradient>
            <ThemedText type="h4" style={styles.sectionTitle}>Testing</ThemedText>
          </View>
          <View style={[styles.sectionContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }]}>
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
                  {testingModeEnabled ? 'Full access enabled (Stylist Unlimited)' : 'Unlock all app features locally'}
                </ThemedText>
              </View>
              <Switch
                value={testingModeEnabled}
                onValueChange={handleTestingModeToggle}
                trackColor={{ false: isDark ? '#333' : '#E0E0E0', true: LUXURY_COLORS.emerald }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.settingItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
              <LinearGradient
                colors={[LUXURY_COLORS.coral, '#C46A4F']}
                style={styles.settingIconGradient}
              >
                <Feather name="book-open" size={16} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.settingContent}>
                <ThemedText type="body" style={styles.settingTitle}>
                  Travel Capsule Access
                </ThemedText>
                <ThemedText type="small" style={styles.settingSubtitle}>
                  {dfyAccess?.tier === 'lite' && dfyAccess?.hasAccess
                    ? `${dfyAccess.daysRemaining}d remaining`
                    : 'Test Travel Capsule (14-day lookbook)'}
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
                  {dfyAccess?.tier === 'core' && dfyAccess?.hasAccess
                    ? `${dfyAccess.daysRemaining}d remaining`
                    : 'Test Full Wardrobe Setup (30-day modular wardrobe)'}
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
      ) : null}

      {showStaffTools ? (
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
              icon="bar-chart-2"
              title={t('common.retentionAnalytics') || "Retention Analytics"}
              subtitle={t('common.smartOffersWinbackRevenue') || "Smart offers & win-back revenue"}
              onPress={() => navigation.navigate("AnalyticsDashboard")}
              theme={theme}
              isDark={isDark}
              iconGradient={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
            />
            <SettingItem
              icon="image"
              title={t('common.logoPreview') || "Logo Preview"}
              subtitle={t('common.viewDripnLogoVariations') || "View Dripn logo variations"}
              onPress={() => navigation.navigate("LogoPreview")}
              theme={theme}
              isDark={isDark}
            />
          </View>
        </View>
      ) : null}

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
                  ? (t('settings.referralStatsLine') || '{count} friends joined · {next}% off next charge ({credit}% banked)')
                      .replace('{count}', String(totalReferrals))
                      .replace('{next}', String(referralNextInvoicePercent || Math.min(50, referralCreditPercent || 0)))
                      .replace('{credit}', String(referralCreditPercent || 0))
                  : t('settings.inviteDescription')}
              </ThemedText>
            </View>
            <Feather name="share-2" size={18} color={LUXURY_COLORS.coral} />
          </Pressable>
          {!referredByCode ? (
            <View style={styles.referralApplyRow}>
              <TextInput
                value={referralCodeInput}
                onChangeText={setReferralCodeInput}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t('settings.enterReferralCode') || 'Have a code? Enter it here'}
                placeholderTextColor={theme.tabIconDefault}
                style={[
                  styles.referralInput,
                  {
                    color: theme.text,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderColor: theme.border,
                  },
                ]}
              />
              <Pressable
                onPress={handleApplyReferralCode}
                disabled={!referralCodeInput.trim()}
                style={[
                  styles.referralApplyBtn,
                  {
                    backgroundColor: theme.link,
                    opacity: referralCodeInput.trim() ? 1 : 0.5,
                  },
                ]}
              >
                <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {t('settings.applyCode') || 'Apply'}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText type="caption" style={[styles.referralAppliedNote, { color: theme.tabIconDefault }]}>
              {(t('settings.referredByNote') || 'Joined with code {code}')
                .replace('{code}', referredByCode)}
            </ThemedText>
          )}
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
            title={t('settings.deleteAccount') || 'Delete Account'}
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
        visible={outfitPopupPicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOutfitPopupPicker(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOutfitPopupPicker(null)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3" style={styles.modalTitle}>
                {outfitPopupPicker === 'occasion'
                  ? (t('settings.outfitPopupOccasion') || 'Occasion')
                  : (t('settings.outfitPopupAppearAt') || 'Appear at')}
              </ThemedText>
              <Pressable
                onPress={() => setOutfitPopupPicker(null)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {outfitPopupPicker === 'occasion'
                ? OCCASION_PREF_OPTIONS.map((option) => (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        void updateOutfitPopupPrefs({
                          preferredOccasion: option.id as TodaysOutfitOccasionPref,
                        });
                        setOutfitPopupPicker(null);
                      }}
                      style={[
                        styles.modalOption,
                        outfitPopupPrefs.preferredOccasion === option.id && {
                          backgroundColor: isDark ? 'rgba(201,168,124,0.15)' : 'rgba(201,168,124,0.12)',
                        },
                      ]}
                    >
                      <ThemedText type="body">{option.label}</ThemedText>
                      {outfitPopupPrefs.preferredOccasion === option.id ? (
                        <Feather name="check" size={18} color={LUXURY_COLORS.gold} />
                      ) : null}
                    </Pressable>
                  ))
                : Array.from({ length: 24 }, (_, hour) => (
                    <Pressable
                      key={hour}
                      onPress={() => {
                        void updateOutfitPopupPrefs({ appearAtHour: hour });
                        setOutfitPopupPicker(null);
                      }}
                      style={[
                        styles.modalOption,
                        outfitPopupPrefs.appearAtHour === hour && {
                          backgroundColor: isDark ? 'rgba(201,168,124,0.15)' : 'rgba(201,168,124,0.12)',
                        },
                      ]}
                    >
                      <ThemedText type="body">{formatHourLabel(hour)}</ThemedText>
                      {outfitPopupPrefs.appearAtHour === hour ? (
                        <Feather name="check" size={18} color={LUXURY_COLORS.gold} />
                      ) : null}
                    </Pressable>
                  ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

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
                  {pickerModal.type === 'colorScheme' ? t('settings.selectColourScheme') : t('settings.voiceSpeed')}
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
              {pickerModal.type === 'colorScheme' ? (
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
                      {getSpeedLabel(speed.value)}
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
                  {t('settings.selectCountry')}
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
                placeholder={t('settings.searchCountries')}
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
                  <ThemedText type="body">{getLocalizedCountryName(c, currentLanguage, t)}</ThemedText>
                  {user?.country === c ? (
                    <Feather name="check" size={20} color={LUXURY_COLORS.coral} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <VoiceCreditsPurchaseModal
        visible={showVoiceCreditsModal}
        onClose={() => setShowVoiceCreditsModal(false)}
      />
      </ScreenScrollView>
      <LanguagePickerModal
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        mode="app"
      />
      <LanguagePickerModal
        visible={stylistLanguagePickerVisible}
        onClose={() => setStylistLanguagePickerVisible(false)}
        mode="stylist"
      />
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
  usageTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
    width: '100%',
  },
  usageFill: {
    height: '100%',
    borderRadius: 3,
  },
  referralApplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  referralInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  referralApplyBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  referralAppliedNote: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
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
