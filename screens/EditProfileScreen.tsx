import React, { useCallback, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Alert,
  Image,
  ScrollView,
  Modal,
  InteractionManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SizeRange, BodyShape, BudgetRange, DressCodePreference, SubcultureStyle, DressCodeStrictness, Gender, StylistId, VoicePitch } from "@/contexts/AuthContext";
import { getAllStylists, getDefaultVoiceForStylist } from "@/services/PersonalStylistService";
import { onboardingProfileService } from "@/services/OnboardingProfileService";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";
import { ALL_COUNTRIES } from "@/constants/countries";
import { filterCountriesBySearch, getLocalizedCountryName } from "@/utils/countryLocalization";

const GENDER_OPTIONS: { id: Gender; name: string }[] = [
  { id: "woman", name: "Woman" },
  { id: "man", name: "Man" },
  { id: "non-binary", name: "Non-Binary" },
  { id: "prefer-not-to-say", name: "Prefer not to say" },
];

type EditProfileScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "EditProfile">;
};

const SIZE_OPTIONS: SizeRange[] = ["XS-S", "M-L", "XL-2X", "3X+"];

const BODY_SHAPE_OPTIONS: { id: BodyShape; name: string }[] = [
  { id: "Hourglass", name: "Hourglass" },
  { id: "Pear", name: "Pear" },
  { id: "Apple", name: "Apple" },
  { id: "Rectangle", name: "Rectangle" },
  { id: "Athletic", name: "Athletic" },
];

const BUDGET_OPTIONS: { id: BudgetRange; name: string }[] = [
  { id: "Budget", name: "Budget-Friendly" },
  { id: "Mid-Range", name: "Mid-Range" },
  { id: "Premium", name: "Premium" },
  { id: "Luxury", name: "Luxury" },
];

const DRESS_CODE_OPTIONS: { id: DressCodePreference; name: string }[] = [
  { id: "none", name: "None / Doesn't apply" },
  { id: "hijab-friendly", name: "Hijab-Friendly" },
  { id: "tzniut", name: "Tzniut" },
  { id: "lds-modest", name: "LDS Modest" },
  { id: "hindu-traditional", name: "Hindu Traditional" },
  { id: "sikh", name: "Sikh" },
  { id: "amish-plain", name: "Amish/Plain" },
  { id: "modest-general", name: "Modest (General)" },
];

const SUBCULTURE_OPTIONS: { id: SubcultureStyle; name: string }[] = [
  { id: "none", name: "None / Doesn't apply" },
  { id: "goth", name: "Goth" },
  { id: "emo", name: "Emo" },
  { id: "punk", name: "Punk" },
  { id: "cottagecore", name: "Cottagecore" },
  { id: "dark-academia", name: "Dark Academia" },
  { id: "light-academia", name: "Light Academia" },
  { id: "y2k", name: "Y2K" },
  { id: "vintage", name: "Vintage" },
  { id: "grunge", name: "Grunge" },
  { id: "kawaii", name: "Kawaii" },
  { id: "streetwear", name: "Streetwear" },
  { id: "hypebeast", name: "Hypebeast" },
  { id: "old-money", name: "Old Money" },
  { id: "clean-girl", name: "Clean Girl" },
  { id: "coastal-grandmother", name: "Coastal Grandmother" },
];

const STRICTNESS_OPTIONS: { id: DressCodeStrictness; name: string; description: string }[] = [
  { id: "flexible", name: "Flexible", description: "Prefer but open to alternatives" },
  { id: "moderate", name: "Moderate", description: "Generally follow with some flexibility" },
  { id: "strict", name: "Strict", description: "Always follow these guidelines" },
];

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [country, setCountry] = useState(user?.country || "United States");
  const [gender, setGender] = useState<Gender>(user?.gender || null);
  const [selectedStylistId, setSelectedStylistId] = useState<StylistId>(
    user?.stylistPreferences?.selectedStylistId || "ruby",
  );
  const [sizeRange, setSizeRange] = useState<SizeRange>(user?.sizeRange || null);
  const [bodyShape, setBodyShape] = useState<BodyShape>(user?.bodyShape || null);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(user?.budgetRange || null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Cultural style preferences
  const [dressCodePreference, setDressCodePreference] = useState<DressCodePreference>(
    user?.extendedPreferences?.culturalStyle?.dressCodePreference || null
  );
  const [religiousOrCulturalDressCode, setReligiousOrCulturalDressCode] = useState(
    user?.extendedPreferences?.culturalStyle?.religiousOrCulturalDressCode || ""
  );
  const [subcultureStyle, setSubcultureStyle] = useState<SubcultureStyle>(
    user?.extendedPreferences?.culturalStyle?.subcultureStyle || null
  );
  const [dressCodeStrictness, setDressCodeStrictness] = useState<DressCodeStrictness>(
    user?.extendedPreferences?.culturalStyle?.dressCodeStrictness || null
  );
  const [showDressCodePicker, setShowDressCodePicker] = useState(false);
  const [showSubculturePicker, setShowSubculturePicker] = useState(false);
  const [showStylistPicker, setShowStylistPicker] = useState(false);

  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const scrollYRef = useRef(0);

  const stylists = getAllStylists();
  const selectedStylist = stylists.find((s) => s.id === selectedStylistId);

  const filteredCountries = filterCountriesBySearch(ALL_COUNTRIES, countrySearch, currentLanguage, t);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  /** Page-sheet modals + KeyboardAwareScrollView often jump to top on dismiss; restore scrollY. */
  const restoreScrollPosition = useCallback(() => {
    const y = scrollYRef.current;
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({ y, animated: false });
      });
    });
  }, []);

  const closeDressCodePicker = useCallback(() => {
    setShowDressCodePicker(false);
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  const closeSubculturePicker = useCallback(() => {
    setShowSubculturePicker(false);
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  const closeStylistPicker = useCallback(() => {
    setShowStylistPicker(false);
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  const closeCountryPicker = useCallback(() => {
    setShowCountryPicker(false);
    setCountrySearch("");
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t('common.permissionRequired'), t('common.pleaseAllowAccessToYourPhotoLibraryToCha'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
    }
  };

  const persistAvatarRemoval = async () => {
    setAvatar(null);
    await updateProfile({ avatar: null });
    try {
      await apiService.updateProfile({ avatarUrl: null });
    } catch {
      // Non-fatal — profileData sync still clears avatar in JSON profile
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert(t('common.removeProfilePhoto'), t('common.yourProfileWillShowTheDefaultAvatarInste'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('common.remove'),
          style: "destructive",
          onPress: () => {
            persistAvatarRemoval().catch(() => {
              Alert.alert(t('common.error'), t('common.failedToRemoveProfilePhotoPleaseTryAgain'));
            });
          },
        },
      ],
    );
  };

  const handleAvatarPress = () => {
    if (avatar) {
      Alert.alert(
        t('common.profilePhoto'),
        undefined,
        [
          { text: t('common.changePhoto'), onPress: handlePickImage },
          { text: t('common.removePhoto'), style: "destructive", onPress: handleRemovePhoto },
          { text: t('common.cancel'), style: "cancel" },
        ],
      );
      return;
    }

    handlePickImage();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('common.pleaseEnterYourName'));
      return;
    }

    setIsSaving(true);
    try {
      const stylistId = selectedStylistId || "ruby";
      await updateProfile({
        name: name.trim(),
        avatar: avatar || null,
        country,
        gender,
        sizeRange,
        bodyShape,
        budgetRange,
        stylistPreferences: {
          ...user?.stylistPreferences,
          selectedStylistId: stylistId,
          voicePitch: getDefaultVoiceForStylist(stylistId) as VoicePitch,
        },
        extendedPreferences: {
          ...user?.extendedPreferences,
          culturalStyle: {
            dressCodePreference:
              !dressCodePreference || dressCodePreference === "none" ? null : dressCodePreference,
            religiousOrCulturalDressCode: religiousOrCulturalDressCode.trim() || null,
            subcultureStyle:
              !subcultureStyle || subcultureStyle === "none" ? null : subcultureStyle,
            dressCodeStrictness:
              !dressCodePreference || dressCodePreference === "none" ? null : dressCodeStrictness,
          },
        },
      } as any);

      if (!avatar && user?.avatar) {
        try {
          await apiService.updateProfile({ avatarUrl: null });
        } catch {
          // Non-fatal — profileData sync still clears avatar in JSON profile
        }
      }

      if (gender === "man") {
        await onboardingProfileService.saveProfile({ quizGender: "male" });
      } else if (gender === "woman") {
        await onboardingProfileService.saveProfile({ quizGender: "female" });
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), t('common.failedToSaveProfilePleaseTryAgain'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCountry = (selectedCountry: string) => {
    setCountry(selectedCountry);
    closeCountryPicker();
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
    },
  ];

  return (
    <>
    <ScreenKeyboardAwareScrollView
      ref={scrollRef}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      disableScrollOnKeyboardHide
    >
      <View style={styles.avatarSection}>
        <Pressable onPress={handleAvatarPress}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundDefault }]}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <Feather name="user" size={48} color={theme.tabIconDefault} />
            )}
            <View style={[styles.editAvatarBadge, { backgroundColor: theme.link }]}>
              <Feather name="camera" size={14} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
        <ThemedText type="small" style={styles.avatarHint}>
          Tap to change photo
        </ThemedText>
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          {t('editProfile.displayName') || 'Display Name'}
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder={t('common.enterYourName') || "Enter your name"}
          placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          {t('editProfile.email') || t('settings.email') || 'Email'}
        </ThemedText>
        <View
          style={[
            styles.readOnlyField,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: 0.85,
            },
          ]}
        >
          <ThemedText type="body" style={styles.readOnlyFieldText} numberOfLines={1}>
            {user?.email || (t('settings.notSet') || 'Not set')}
          </ThemedText>
        </View>
        <ThemedText type="small" style={[styles.sectionHint, styles.emailReadOnlyHint]}>
          {t('editProfile.emailReadOnlyHint') ||
            "Your email is your account ID and can't be changed here. Contact support@dripnapp.com if you need to update it."}
        </ThemedText>
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Country
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Updates your regional content and style recommendations
        </ThemedText>
        <Pressable
          onPress={() => setShowCountryPicker(true)}
          style={({ pressed }) => [
            styles.countrySelector,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="map-pin" size={18} color={theme.tabIconDefault} />
          <ThemedText type="body" style={styles.countryText}>
            {getLocalizedCountryName(country, currentLanguage, t)}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={theme.tabIconDefault} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Gender
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Tailors wardrobe categories, styling advice, and recommendations
        </ThemedText>
        <View style={styles.optionsRow}>
          {GENDER_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setGender(gender === option.id ? null : option.id)}
              style={({ pressed }) => [
                styles.optionChip,
                {
                  backgroundColor: gender === option.id ? theme.link : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: gender === option.id ? "#FFFFFF" : theme.text }}
              >
                {option.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Personal Stylist
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Your AI stylist for chat, outfit advice, and recommendations
        </ThemedText>
        <Pressable
          onPress={() => setShowStylistPicker(true)}
          style={[styles.pickerButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText type="body" style={{ color: theme.text }}>
            {selectedStylist ? selectedStylist.name : "Select stylist..."}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={theme.tabIconDefault} />
        </Pressable>
        {selectedStylist ? (
          <ThemedText type="small" style={[styles.sectionHint, { marginTop: Spacing.sm, marginBottom: 0 }]}>
            {selectedStylist.tagline}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Size Range (Optional)
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Helps us show size-inclusive recommendations
        </ThemedText>
        <View style={styles.optionsRow}>
          {SIZE_OPTIONS.map((size) => (
            <Pressable
              key={size}
              onPress={() => setSizeRange(sizeRange === size ? null : size)}
              style={({ pressed }) => [
                styles.optionChip,
                {
                  backgroundColor:
                    sizeRange === size ? theme.link : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: sizeRange === size ? "#FFFFFF" : theme.text }}
              >
                {size}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Body Shape (Optional)
        </ThemedText>
        <View style={styles.optionsRow}>
          {BODY_SHAPE_OPTIONS.map((shape) => (
            <Pressable
              key={shape.id}
              onPress={() => setBodyShape(bodyShape === shape.id ? null : shape.id)}
              style={({ pressed }) => [
                styles.optionChip,
                {
                  backgroundColor:
                    bodyShape === shape.id ? theme.link : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: bodyShape === shape.id ? "#FFFFFF" : theme.text }}
              >
                {shape.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Budget Range (Optional)
        </ThemedText>
        <View style={styles.optionsRow}>
          {BUDGET_OPTIONS.map((budget) => (
            <Pressable
              key={budget.id}
              onPress={() => setBudgetRange(budgetRange === budget.id ? null : budget.id)}
              style={({ pressed }) => [
                styles.optionChip,
                {
                  backgroundColor:
                    budgetRange === budget.id ? theme.link : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: budgetRange === budget.id ? "#FFFFFF" : theme.text }}
              >
                {budget.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Cultural & Subculture Style Section */}
      <View style={[styles.section, styles.culturalSection]}>
        <ThemedText type="h2" style={styles.culturalSectionTitle}>
          Cultural & Style Preferences
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Help the stylists respect your dress code in all recommendations
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Dress Code Preference (Optional)
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Religious or modest dress guidelines
        </ThemedText>
        <Pressable
          onPress={() => setShowDressCodePicker(true)}
          style={[styles.pickerButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText
            type="body"
            style={{
              color: dressCodePreference ? theme.text : theme.tabIconDefault,
            }}
          >
            {dressCodePreference
              ? DRESS_CODE_OPTIONS.find((d) => d.id === dressCodePreference)?.name || "Select..."
              : "Select dress code preference..."}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={theme.tabIconDefault} />
        </Pressable>
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Personal Dress Code Details (Optional)
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Any specific requirements or preferences
        </ThemedText>
        <TextInput
          style={[styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
          value={religiousOrCulturalDressCode}
          onChangeText={setReligiousOrCulturalDressCode}
          placeholder={t('common.egIPreferClothingThatCoversMyArmsAndLegs') || "e.g., I prefer clothing that covers my arms and legs..."}
          placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Subculture Style (Optional)
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          Your aesthetic or style movement
        </ThemedText>
        <Pressable
          onPress={() => setShowSubculturePicker(true)}
          style={[styles.pickerButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText
            type="body"
            style={{
              color: subcultureStyle ? theme.text : theme.tabIconDefault,
            }}
          >
            {subcultureStyle
              ? SUBCULTURE_OPTIONS.find((s) => s.id === subcultureStyle)?.name || "Select..."
              : "Select subculture style..."}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={theme.tabIconDefault} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Dress Code Strictness (Optional)
        </ThemedText>
        <ThemedText type="small" style={styles.sectionHint}>
          How closely should recommendations follow your preferences?
        </ThemedText>
        <View style={styles.strictnessOptions}>
          {STRICTNESS_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setDressCodeStrictness(dressCodeStrictness === option.id ? null : option.id)}
              style={({ pressed }) => [
                styles.strictnessOption,
                {
                  backgroundColor: dressCodeStrictness === option.id ? theme.link : theme.backgroundDefault,
                  borderColor: dressCodeStrictness === option.id ? theme.link : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.strictnessRadio}>
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: dressCodeStrictness === option.id ? "#FFFFFF" : theme.tabIconDefault },
                  ]}
                >
                  {dressCodeStrictness === option.id ? (
                    <View style={[styles.radioInner, { backgroundColor: "#FFFFFF" }]} />
                  ) : null}
                </View>
                <View>
                  <ThemedText
                    type="body"
                    style={{ 
                      color: dressCodeStrictness === option.id ? "#FFFFFF" : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {option.name}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ 
                      color: dressCodeStrictness === option.id ? "rgba(255,255,255,0.8)" : theme.tabIconDefault,
                    }}
                  >
                    {option.description}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <Button onPress={handleSave} disabled={isSaving} style={styles.saveButton}>
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </ScreenKeyboardAwareScrollView>

    <Modal
      visible={showCountryPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeCountryPicker}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.modalHeader}>
          <ThemedText type="h2">Select Country</ThemedText>
          <Pressable onPress={closeCountryPicker} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={theme.tabIconDefault} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            value={countrySearch}
            onChangeText={setCountrySearch}
            placeholder={t('common.searchCountries') || "Search countries..."}
            placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
            autoCapitalize="none"
          />
        </View>
        <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
          {filteredCountries.map((c) => (
            <Pressable
              key={c}
              onPress={() => handleSelectCountry(c)}
              style={({ pressed }) => [
                styles.countryItem,
                {
                  backgroundColor: country === c ? theme.link : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: country === c ? "#FFFFFF" : theme.text }}
              >
                {getLocalizedCountryName(c, currentLanguage, t)}
              </ThemedText>
              {country === c ? (
                <Feather name="check" size={18} color="#FFFFFF" />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>

    <Modal
      visible={showStylistPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeStylistPicker}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.modalHeader}>
          <ThemedText type="h2">Personal Stylist</ThemedText>
          <Pressable onPress={closeStylistPicker} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
          {stylists.map((stylist) => (
            <Pressable
              key={stylist.id}
              onPress={() => {
                setSelectedStylistId(stylist.id as StylistId);
                closeStylistPicker();
              }}
              style={({ pressed }) => [
                styles.stylistPickerItem,
                {
                  backgroundColor: selectedStylistId === stylist.id ? theme.link : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.stylistPickerDot, { backgroundColor: stylist.color }]} />
              <View style={styles.stylistPickerInfo}>
                <ThemedText
                  type="body"
                  style={{
                    color: selectedStylistId === stylist.id ? "#FFFFFF" : theme.text,
                    fontWeight: "600",
                  }}
                >
                  {stylist.name}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: selectedStylistId === stylist.id ? "rgba(255,255,255,0.85)" : theme.tabIconDefault,
                  }}
                >
                  {stylist.tagline}
                </ThemedText>
              </View>
              {selectedStylistId === stylist.id ? (
                <Feather name="check" size={18} color="#FFFFFF" />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>

    <Modal
      visible={showDressCodePicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeDressCodePicker}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.modalHeader}>
          <ThemedText type="h2">Dress Code Preference</ThemedText>
          <Pressable onPress={closeDressCodePicker} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
          {DRESS_CODE_OPTIONS.map((option) => {
            const isSelected = dressCodePreference === option.id;
            return (
              <Pressable
                key={String(option.id)}
                onPress={() => {
                  if (option.id === "none") {
                    setDressCodePreference("none");
                    setDressCodeStrictness(null);
                  } else {
                    setDressCodePreference(option.id);
                  }
                  closeDressCodePicker();
                }}
                style={({ pressed }) => [
                  styles.countryItem,
                  {
                    backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                >
                  {option.name}
                </ThemedText>
                {isSelected ? (
                  <Feather name="check" size={18} color="#FFFFFF" />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>

    <Modal
      visible={showSubculturePicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeSubculturePicker}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.modalHeader}>
          <ThemedText type="h2">Subculture Style</ThemedText>
          <Pressable onPress={closeSubculturePicker} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
          {SUBCULTURE_OPTIONS.map((option) => {
            const isSelected = subcultureStyle === option.id;
            return (
              <Pressable
                key={String(option.id)}
                onPress={() => {
                  setSubcultureStyle(option.id === "none" ? "none" : option.id);
                  closeSubculturePicker();
                }}
                style={({ pressed }) => [
                  styles.countryItem,
                  {
                    backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                >
                  {option.name}
                </ThemedText>
                {isSelected ? (
                  <Feather name="check" size={18} color="#FFFFFF" />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: {
    opacity: 0.6,
    marginTop: Spacing.sm,
  },
  fieldContainer: {
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
    opacity: 0.8,
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 0,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  readOnlyField: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
  },
  readOnlyFieldText: {
    opacity: 0.85,
  },
  emailReadOnlyHint: {
    marginTop: Spacing.sm,
    marginBottom: 0,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  sectionHint: {
    opacity: 0.6,
    marginBottom: Spacing.md,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  countryText: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  searchIcon: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.xl + Spacing.lg,
    paddingRight: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  countryList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  culturalSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  culturalSectionTitle: {
    marginBottom: Spacing.xs,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 0,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.body.fontSize,
  },
  strictnessOptions: {
    gap: Spacing.sm,
  },
  strictnessOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  strictnessRadio: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stylistPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  stylistPickerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stylistPickerInfo: {
    flex: 1,
  },
});
