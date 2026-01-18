import React, { useState } from "react";
import { StyleSheet, View, Pressable, TextInput, ScrollView, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { 
  useAuth, 
  BodyMeasurements, 
  ExtendedPreferences, 
  Lifestyle, 
  ShoppingFrequency,
  HeightUnit,
  WeightUnit,
  BudgetRange
} from "@/contexts/AuthContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type OnboardingQuizScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "OnboardingQuiz">;
};

const LIFESTYLE_OPTIONS: { id: Lifestyle; name: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { id: "casual", name: "Casual", icon: "sun", description: "Relaxed, everyday comfort" },
  { id: "professional", name: "Professional", icon: "briefcase", description: "Office-ready, polished looks" },
  { id: "active", name: "Active", icon: "activity", description: "Sporty, athleisure focused" },
  { id: "creative", name: "Creative", icon: "edit-3", description: "Artistic, expressive style" },
  { id: "minimalist", name: "Minimalist", icon: "minus-square", description: "Simple, timeless pieces" },
  { id: "trendsetter", name: "Trendsetter", icon: "trending-up", description: "Latest fashion, bold choices" },
];

const SHOPPING_FREQUENCY_OPTIONS: { id: ShoppingFrequency; name: string }[] = [
  { id: "weekly", name: "Weekly" },
  { id: "monthly", name: "Monthly" },
  { id: "seasonal", name: "Seasonally" },
  { id: "rarely", name: "Rarely" },
];

const POPULAR_BRANDS = [
  "Zara", "H&M", "Nike", "Adidas", "Gucci", "Louis Vuitton", "Chanel",
  "Prada", "Uniqlo", "ASOS", "Mango", "COS", "Massimo Dutti", "Lululemon",
  "Ralph Lauren", "Tommy Hilfiger", "Calvin Klein", "Burberry", "Dior",
  "Versace", "Balenciaga", "Off-White", "Reformation", "Everlane", "Patagonia"
];

const COLOR_OPTIONS = [
  { id: "black", name: "Black", color: "#1A1A1A" },
  { id: "white", name: "White", color: "#FFFFFF" },
  { id: "navy", name: "Navy", color: "#1E3A5F" },
  { id: "grey", name: "Grey", color: "#808080" },
  { id: "beige", name: "Beige", color: "#C9A87C" },
  { id: "brown", name: "Brown", color: "#5D4037" },
  { id: "red", name: "Red", color: "#C62828" },
  { id: "pink", name: "Pink", color: "#E91E63" },
  { id: "blue", name: "Blue", color: "#1976D2" },
  { id: "green", name: "Green", color: "#388E3C" },
  { id: "yellow", name: "Yellow", color: "#FBC02D" },
  { id: "purple", name: "Purple", color: "#7B1FA2" },
  { id: "orange", name: "Orange", color: "#F57C00" },
  { id: "teal", name: "Teal", color: "#00897B" },
];

const OCCASION_OPTIONS = [
  { id: "work", name: "Work", icon: "briefcase" },
  { id: "casual", name: "Casual", icon: "coffee" },
  { id: "date", name: "Date Night", icon: "heart" },
  { id: "party", name: "Party", icon: "music" },
  { id: "wedding", name: "Wedding", icon: "gift" },
  { id: "vacation", name: "Vacation", icon: "sun" },
  { id: "gym", name: "Gym", icon: "activity" },
  { id: "formal", name: "Formal Events", icon: "award" },
];

const BUDGET_OPTIONS: { id: BudgetRange; name: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { id: "Budget", name: "Budget", icon: "tag", description: "Affordable finds under $50" },
  { id: "Mid-Range", name: "Mid-Range", icon: "shopping-bag", description: "Quality pieces $50-$200" },
  { id: "Premium", name: "Premium", icon: "award", description: "Designer brands $200-$500" },
  { id: "Luxury", name: "Luxury", icon: "star", description: "High-end fashion $500+" },
];

const TOTAL_STEPS = 7;

export default function OnboardingQuizScreen({ navigation }: OnboardingQuizScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { completeQuiz, user } = useAuth();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements>({
    height: user?.bodyMeasurements?.height || null,
    heightUnit: user?.bodyMeasurements?.heightUnit || 'cm',
    weight: user?.bodyMeasurements?.weight || null,
    weightUnit: user?.bodyMeasurements?.weightUnit || 'kg',
  });

  const [lifestyle, setLifestyle] = useState<Lifestyle>(user?.extendedPreferences?.lifestyle || null);
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>(user?.extendedPreferences?.favoriteBrands || []);
  const [colorPreferences, setColorPreferences] = useState<string[]>(user?.extendedPreferences?.colorPreferences || []);
  const [shoppingFrequency, setShoppingFrequency] = useState<ShoppingFrequency>(user?.extendedPreferences?.shoppingFrequency || null);
  const [preferOnlineShopping, setPreferOnlineShopping] = useState(user?.extendedPreferences?.preferOnlineShopping ?? true);
  const [sustainabilityImportant, setSustainabilityImportant] = useState(user?.extendedPreferences?.sustainabilityImportant ?? false);
  const [occasions, setOccasions] = useState<string[]>(user?.extendedPreferences?.occasions || []);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(user?.budgetRange || null);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");

  const filteredBrands = POPULAR_BRANDS.filter(
    brand => brand.toLowerCase().includes(brandSearchQuery.toLowerCase()) && !favoriteBrands.includes(brand)
  );

  const toggleBrand = (brand: string) => {
    if (favoriteBrands.includes(brand)) {
      setFavoriteBrands(favoriteBrands.filter(b => b !== brand));
    } else if (favoriteBrands.length < 10) {
      setFavoriteBrands([...favoriteBrands, brand]);
    }
  };

  const toggleColor = (colorId: string) => {
    if (colorPreferences.includes(colorId)) {
      setColorPreferences(colorPreferences.filter(c => c !== colorId));
    } else if (colorPreferences.length < 5) {
      setColorPreferences([...colorPreferences, colorId]);
    }
  };

  const toggleOccasion = (occasionId: string) => {
    if (occasions.includes(occasionId)) {
      setOccasions(occasions.filter(o => o !== occasionId));
    } else {
      setOccasions([...occasions, occasionId]);
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const extendedPreferences: ExtendedPreferences = {
        lifestyle,
        favoriteBrands,
        colorPreferences,
        shoppingFrequency,
        preferOnlineShopping,
        sustainabilityImportant,
        occasions,
        favoriteShops: user?.extendedPreferences?.favoriteShops || [],
        usageGoals: user?.extendedPreferences?.usageGoals || [],
        culturalStyle: user?.extendedPreferences?.culturalStyle || {
          dressCodePreference: null,
          religiousOrCulturalDressCode: null,
          subcultureStyle: null,
          dressCodeStrictness: null,
        },
      };

      await completeQuiz({
        bodyMeasurements,
        extendedPreferences,
        budgetRange,
      });

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return lifestyle !== null;
      case 2:
        return true;
      case 3:
        return colorPreferences.length > 0;
      case 4:
        return shoppingFrequency !== null;
      case 5:
        return budgetRange !== null;
      case 6:
        return occasions.length > 0;
      default:
        return true;
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressDot,
            {
              backgroundColor: index <= step ? theme.link : theme.backgroundSecondary,
              flex: 1,
              marginHorizontal: 2,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Animated.View 
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <ThemedText type="h2" style={styles.stepTitle}>
              Body Measurements
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Optional: Help us suggest better-fitting styles
            </ThemedText>

            <View style={styles.measurementSection}>
              <ThemedText type="h3" style={styles.sectionLabel}>Height</ThemedText>
              <View style={styles.measurementRow}>
                <TextInput
                  style={[
                    styles.measurementInput,
                    { 
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: theme.backgroundSecondary,
                    }
                  ]}
                  placeholder={bodyMeasurements.heightUnit === 'cm' ? "170" : "5'9"}
                  placeholderTextColor={theme.tabIconDefault}
                  keyboardType="numeric"
                  value={bodyMeasurements.height?.toString() || ""}
                  onChangeText={(text) => setBodyMeasurements({
                    ...bodyMeasurements,
                    height: text ? parseFloat(text) : null
                  })}
                />
                <View style={styles.unitToggle}>
                  {(['cm', 'ft'] as HeightUnit[]).map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => setBodyMeasurements({ ...bodyMeasurements, heightUnit: unit })}
                      style={[
                        styles.unitButton,
                        {
                          backgroundColor: bodyMeasurements.heightUnit === unit 
                            ? theme.link 
                            : theme.backgroundDefault,
                        }
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: bodyMeasurements.heightUnit === unit ? '#FFFFFF' : theme.text }}
                      >
                        {unit}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.measurementSection}>
              <ThemedText type="h3" style={styles.sectionLabel}>Weight</ThemedText>
              <View style={styles.measurementRow}>
                <TextInput
                  style={[
                    styles.measurementInput,
                    { 
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: theme.backgroundSecondary,
                    }
                  ]}
                  placeholder={bodyMeasurements.weightUnit === 'kg' ? "70" : "154"}
                  placeholderTextColor={theme.tabIconDefault}
                  keyboardType="numeric"
                  value={bodyMeasurements.weight?.toString() || ""}
                  onChangeText={(text) => setBodyMeasurements({
                    ...bodyMeasurements,
                    weight: text ? parseFloat(text) : null
                  })}
                />
                <View style={styles.unitToggle}>
                  {(['kg', 'lbs'] as WeightUnit[]).map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => setBodyMeasurements({ ...bodyMeasurements, weightUnit: unit })}
                      style={[
                        styles.unitButton,
                        {
                          backgroundColor: bodyMeasurements.weightUnit === unit 
                            ? theme.link 
                            : theme.backgroundDefault,
                        }
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: bodyMeasurements.weightUnit === unit ? '#FFFFFF' : theme.text }}
                      >
                        {unit}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 1:
        return (
          <Animated.View 
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <ThemedText type="h2" style={styles.stepTitle}>
              Your Lifestyle
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              How would you describe your daily style needs?
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.lifestyleOptions}>
                {LIFESTYLE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => setLifestyle(option.id)}
                    style={({ pressed }) => [
                      styles.lifestyleOption,
                      {
                        backgroundColor: lifestyle === option.id 
                          ? theme.link 
                          : theme.backgroundDefault,
                        borderColor: lifestyle === option.id 
                          ? theme.link 
                          : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={option.icon}
                      size={24}
                      color={lifestyle === option.id ? "#FFFFFF" : theme.text}
                    />
                    <View style={styles.lifestyleTextContainer}>
                      <ThemedText
                        type="h3"
                        style={{ color: lifestyle === option.id ? "#FFFFFF" : theme.text }}
                      >
                        {option.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ 
                          color: lifestyle === option.id ? "rgba(255,255,255,0.8)" : theme.tabIconDefault,
                        }}
                      >
                        {option.description}
                      </ThemedText>
                    </View>
                    {lifestyle === option.id ? (
                      <View style={[styles.checkCircle, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                        <Feather name="check" size={16} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View 
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <ThemedText type="h2" style={styles.stepTitle}>
              Favorite Brands
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Select up to 10 brands you love (optional)
            </ThemedText>

            <TextInput
              style={[
                styles.searchInput,
                { 
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.backgroundSecondary,
                }
              ]}
              placeholder="Search brands..."
              placeholderTextColor={theme.tabIconDefault}
              value={brandSearchQuery}
              onChangeText={setBrandSearchQuery}
            />

            {favoriteBrands.length > 0 ? (
              <View style={styles.selectedBrandsContainer}>
                <ThemedText type="small" style={styles.selectedLabel}>
                  Selected ({favoriteBrands.length}/10)
                </ThemedText>
                <View style={styles.brandsGrid}>
                  {favoriteBrands.map((brand) => (
                    <Pressable
                      key={brand}
                      onPress={() => toggleBrand(brand)}
                      style={[styles.brandChip, { backgroundColor: theme.link }]}
                    >
                      <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                        {brand}
                      </ThemedText>
                      <Feather name="x" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.brandsGrid}>
                {filteredBrands.map((brand) => (
                  <Pressable
                    key={brand}
                    onPress={() => toggleBrand(brand)}
                    style={({ pressed }) => [
                      styles.brandChip,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderWidth: 1,
                        borderColor: theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ThemedText type="small">{brand}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View 
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <ThemedText type="h2" style={styles.stepTitle}>
              Color Preferences
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Select up to 5 colors you wear most
            </ThemedText>

            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.colorsGrid}>
                {COLOR_OPTIONS.map((colorOption) => (
                  <Pressable
                    key={colorOption.id}
                    onPress={() => toggleColor(colorOption.id)}
                    style={({ pressed }) => [
                      styles.colorOption,
                      {
                        borderColor: colorPreferences.includes(colorOption.id) 
                          ? theme.link 
                          : theme.backgroundSecondary,
                        borderWidth: colorPreferences.includes(colorOption.id) ? 3 : 1,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View 
                      style={[
                        styles.colorSwatch,
                        { 
                          backgroundColor: colorOption.color,
                          borderWidth: colorOption.id === 'white' ? 1 : 0,
                          borderColor: theme.backgroundSecondary,
                        }
                      ]} 
                    />
                    <ThemedText type="small" style={styles.colorName}>
                      {colorOption.name}
                    </ThemedText>
                    {colorPreferences.includes(colorOption.id) ? (
                      <View style={[styles.colorCheck, { backgroundColor: theme.link }]}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        );

      case 4:
        return (
          <Animated.View 
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <ThemedText type="h2" style={styles.stepTitle}>
              Shopping Habits
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Tell us about how you shop
            </ThemedText>

            <View style={styles.shoppingSection}>
              <ThemedText type="h3" style={styles.sectionLabel}>
                How often do you shop for clothes?
              </ThemedText>
              <View style={styles.frequencyOptions}>
                {SHOPPING_FREQUENCY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => setShoppingFrequency(option.id)}
                    style={({ pressed }) => [
                      styles.frequencyOption,
                      {
                        backgroundColor: shoppingFrequency === option.id 
                          ? theme.link 
                          : theme.backgroundDefault,
                        borderColor: shoppingFrequency === option.id 
                          ? theme.link 
                          : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      type="body"
                      style={{ color: shoppingFrequency === option.id ? "#FFFFFF" : theme.text }}
                    >
                      {option.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.toggleSection}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <ThemedText type="h3">Online Shopping</ThemedText>
                  <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                    I prefer shopping online over in-store
                  </ThemedText>
                </View>
                <Switch
                  value={preferOnlineShopping}
                  onValueChange={setPreferOnlineShopping}
                  trackColor={{ false: theme.backgroundSecondary, true: theme.link }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <ThemedText type="h3">Sustainability</ThemedText>
                  <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                    Eco-friendly fashion is important to me
                  </ThemedText>
                </View>
                <Switch
                  value={sustainabilityImportant}
                  onValueChange={setSustainabilityImportant}
                  trackColor={{ false: theme.backgroundSecondary, true: theme.link }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </Animated.View>
        );

      case 5:
        return (
          <Animated.View 
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <ThemedText type="h2" style={styles.stepTitle}>
              Your Budget
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              What's your typical fashion spending range?
            </ThemedText>

            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.lifestyleOptions}>
                {BUDGET_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => setBudgetRange(option.id)}
                    style={({ pressed }) => [
                      styles.lifestyleOption,
                      {
                        backgroundColor: budgetRange === option.id 
                          ? theme.link 
                          : theme.backgroundDefault,
                        borderColor: budgetRange === option.id 
                          ? theme.link 
                          : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={option.icon}
                      size={24}
                      color={budgetRange === option.id ? "#FFFFFF" : theme.text}
                    />
                    <View style={styles.lifestyleTextContainer}>
                      <ThemedText
                        type="h3"
                        style={{ color: budgetRange === option.id ? "#FFFFFF" : theme.text }}
                      >
                        {option.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ 
                          color: budgetRange === option.id ? "rgba(255,255,255,0.8)" : theme.tabIconDefault,
                        }}
                      >
                        {option.description}
                      </ThemedText>
                    </View>
                    {budgetRange === option.id ? (
                      <View style={[styles.checkCircle, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                        <Feather name="check" size={16} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        );

      case 6:
        return (
          <Animated.View 
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepContent}
          >
            <ThemedText type="h2" style={styles.stepTitle}>
              Style Occasions
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              What occasions do you dress for most?
            </ThemedText>

            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.occasionsGrid}>
                {OCCASION_OPTIONS.map((occasion) => (
                  <Pressable
                    key={occasion.id}
                    onPress={() => toggleOccasion(occasion.id)}
                    style={({ pressed }) => [
                      styles.occasionOption,
                      {
                        backgroundColor: occasions.includes(occasion.id) 
                          ? theme.link 
                          : theme.backgroundDefault,
                        borderColor: occasions.includes(occasion.id) 
                          ? theme.link 
                          : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={occasion.icon as keyof typeof Feather.glyphMap}
                      size={24}
                      color={occasions.includes(occasion.id) ? "#FFFFFF" : theme.text}
                    />
                    <ThemedText
                      type="body"
                      style={{ 
                        color: occasions.includes(occasion.id) ? "#FFFFFF" : theme.text,
                        marginTop: Spacing.xs,
                      }}
                    >
                      {occasion.name}
                    </ThemedText>
                    {occasions.includes(occasion.id) ? (
                      <View style={[styles.occasionCheck, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={step > 0 ? handleBack : () => navigation.goBack()} style={styles.backButton}>
          <Feather name={step > 0 ? "arrow-left" : "x"} size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>
          Style Quiz
        </ThemedText>
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <ThemedText type="body" style={{ color: theme.link }}>
            Skip
          </ThemedText>
        </Pressable>
      </View>

      {renderProgressBar()}

      {renderStep()}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button
          onPress={handleNext}
          disabled={!canProceed() || isSubmitting}
        >
          {step === TOTAL_STEPS - 1 ? "Complete Quiz" : "Continue"}
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  skipButton: {
    padding: Spacing.xs,
  },
  progressContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  progressDot: {
    height: 4,
    borderRadius: 2,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    opacity: 0.7,
    marginBottom: Spacing.xl,
  },
  optionsScroll: {
    flex: 1,
  },
  measurementSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    marginBottom: Spacing.md,
  },
  measurementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  measurementInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  unitToggle: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  unitButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  lifestyleOptions: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  lifestyleOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  lifestyleTextContainer: {
    flex: 1,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  selectedBrandsContainer: {
    marginBottom: Spacing.lg,
  },
  selectedLabel: {
    marginBottom: Spacing.sm,
    opacity: 0.7,
  },
  brandsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  brandChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  colorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  colorOption: {
    width: 80,
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    position: "relative",
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: Spacing.xs,
  },
  colorName: {
    textAlign: "center",
  },
  colorCheck: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  shoppingSection: {
    marginBottom: Spacing["2xl"],
  },
  frequencyOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  frequencyOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  toggleSection: {
    gap: Spacing.lg,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  occasionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  occasionOption: {
    width: "47%",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    position: "relative",
  },
  occasionCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});
