import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, Image, ScrollView, Modal } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SizeRange, BodyShape, BudgetRange } from "@/contexts/AuthContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

const ALL_COUNTRIES = [
  "Albania", "Andorra", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Bulgaria",
  "Canada", "Cayman Islands", "Chile", "China", "Colombia", "Costa Rica", "Croatia",
  "Cuba", "Curacao", "Cyprus", "Czech Republic", "Denmark", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Estonia", "Ethiopia", "Finland", "France", "Georgia",
  "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guyana", "Haiti", "Honduras",
  "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy", "Jamaica",
  "Japan", "Kazakhstan", "Kenya", "Kosovo", "Latvia", "Liechtenstein", "Lithuania",
  "Luxembourg", "Malaysia", "Malta", "Mauritius", "Mexico", "Moldova", "Monaco",
  "Montenegro", "Morocco", "Namibia", "Netherlands", "New Zealand", "Nicaragua", "Nigeria",
  "North Macedonia", "Norway", "Pakistan", "Panama", "Paraguay", "Peru", "Philippines",
  "Poland", "Portugal", "Puerto Rico", "Romania", "Russia", "Saint Kitts and Nevis",
  "Saint Lucia", "Saint Vincent and the Grenadines", "San Marino", "Saudi Arabia", "Serbia",
  "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain", "Suriname",
  "Sweden", "Switzerland", "Taiwan", "Thailand", "Trinidad and Tobago", "Turkey",
  "Turks and Caicos Islands", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "US Virgin Islands", "Vatican City", "Venezuela", "Vietnam",
  "Zimbabwe",
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

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [country, setCountry] = useState(user?.country || "United States");
  const [sizeRange, setSizeRange] = useState<SizeRange>(user?.sizeRange || null);
  const [bodyShape, setBodyShape] = useState<BodyShape>(user?.bodyShape || null);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(user?.budgetRange || null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const filteredCountries = ALL_COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library to change your avatar.");
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        avatar,
        country,
        sizeRange,
        bodyShape,
        budgetRange,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCountry = (selectedCountry: string) => {
    setCountry(selectedCountry);
    setShowCountryPicker(false);
    setCountrySearch("");
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
    },
  ];

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.avatarSection}>
        <Pressable onPress={handlePickImage}>
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
          Display Name
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
          autoCapitalize="words"
          returnKeyType="done"
        />
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
            {country}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={theme.tabIconDefault} />
        </Pressable>
      </View>

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h2">Select Country</ThemedText>
            <Pressable
              onPress={() => {
                setShowCountryPicker(false);
                setCountrySearch("");
              }}
              style={styles.closeButton}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color={theme.tabIconDefault} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search countries..."
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
                  {c}
                </ThemedText>
                {country === c ? (
                  <Feather name="check" size={18} color="#FFFFFF" />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

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

      <Button onPress={handleSave} disabled={isSaving} style={styles.saveButton}>
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </ScreenKeyboardAwareScrollView>
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
});
