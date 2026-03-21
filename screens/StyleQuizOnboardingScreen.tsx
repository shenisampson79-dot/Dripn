import React, { useState } from "react";
import { StyleSheet, View, Pressable, TextInput, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { 
  useAuth, 
  BodyMeasurements, 
  HeightUnit,
  WeightUnit,
  Lifestyle,
  ShoppingFrequency,
  BudgetRange,
} from "@/contexts/AuthContext";
import { Switch } from "react-native";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

type StyleQuizOnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "StyleQuizOnboarding">;
};

type BodyShape = 'hourglass' | 'pear' | 'apple' | 'rectangle' | 'inverted-triangle' | 'athletic';
type SkinUndertone = 'warm' | 'cool' | 'neutral';
type PreferredFit = 'fitted' | 'tailored' | 'relaxed' | 'oversize';
type BodyArea = 'shoulders' | 'arms' | 'bust' | 'waist' | 'hips' | 'thighs' | 'legs';
type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55+';

const BODY_SHAPE_OPTIONS: { id: BodyShape; name: string; description: string }[] = [
  { id: 'hourglass', name: 'Hourglass', description: 'Balanced bust & hips, defined waist' },
  { id: 'pear', name: 'Pear', description: 'Hips wider than shoulders' },
  { id: 'apple', name: 'Apple', description: 'Fuller midsection' },
  { id: 'rectangle', name: 'Rectangle', description: 'Balanced proportions throughout' },
  { id: 'inverted-triangle', name: 'Inverted Triangle', description: 'Shoulders wider than hips' },
  { id: 'athletic', name: 'Athletic', description: 'Muscular, well-defined physique' },
];

const SKIN_UNDERTONE_OPTIONS: { id: SkinUndertone; name: string; description: string; colors: string[] }[] = [
  { id: 'warm', name: 'Warm', description: 'Yellow, peachy or golden undertones', colors: ['#FFD89B', '#F5C07B', '#E8A954'] },
  { id: 'cool', name: 'Cool', description: 'Pink, red or bluish undertones', colors: ['#F5C6C6', '#E8B8D4', '#C9B8E8'] },
  { id: 'neutral', name: 'Neutral', description: 'Mix of warm and cool', colors: ['#E8D8C8', '#D4C4B4', '#C0B0A0'] },
];

const PREFERRED_FIT_OPTIONS: { id: PreferredFit; name: string; description: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'fitted', name: 'Fitted', description: 'Close to the body, shows your shape', icon: 'minimize-2' },
  { id: 'tailored', name: 'Tailored', description: 'Structured, professional look', icon: 'align-center' },
  { id: 'relaxed', name: 'Relaxed', description: 'Comfortable, easy movement', icon: 'maximize-2' },
  { id: 'oversize', name: 'Oversize', description: 'Loose, trendy, extra room', icon: 'maximize' },
];

const BODY_AREA_OPTIONS: { id: BodyArea; name: string }[] = [
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'arms', name: 'Arms' },
  { id: 'bust', name: 'Bust/Chest' },
  { id: 'waist', name: 'Waist' },
  { id: 'hips', name: 'Hips' },
  { id: 'thighs', name: 'Thighs' },
  { id: 'legs', name: 'Legs' },
];

const AGE_RANGE_OPTIONS: { id: AgeRange; name: string }[] = [
  { id: '18-24', name: '18-24' },
  { id: '25-34', name: '25-34' },
  { id: '35-44', name: '35-44' },
  { id: '45-54', name: '45-54' },
  { id: '55+', name: '55+' },
];

const LIFESTYLE_OPTIONS: { id: Lifestyle; name: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { id: 'casual', name: 'Casual', icon: 'sun', description: 'Relaxed, everyday comfort' },
  { id: 'professional', name: 'Professional', icon: 'briefcase', description: 'Office-ready, polished looks' },
  { id: 'active', name: 'Active', icon: 'activity', description: 'Sporty, athleisure focused' },
  { id: 'creative', name: 'Creative', icon: 'edit-3', description: 'Artistic, expressive style' },
  { id: 'minimalist', name: 'Minimalist', icon: 'minus-square', description: 'Simple, timeless pieces' },
  { id: 'trendsetter', name: 'Trendsetter', icon: 'trending-up', description: 'Latest fashion, bold choices' },
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

const SHOPPING_FREQUENCY_OPTIONS: { id: ShoppingFrequency; name: string; description: string }[] = [
  { id: "weekly", name: "Weekly", description: "I shop for clothes every week" },
  { id: "monthly", name: "Monthly", description: "A few times a month" },
  { id: "seasonal", name: "Seasonally", description: "When seasons change" },
  { id: "rarely", name: "Rarely", description: "Only when I really need to" },
];

const OCCASION_OPTIONS: { id: string; name: string; icon: keyof typeof Feather.glyphMap }[] = [
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
  { id: "Budget", name: "Budget", icon: "tag", description: "Affordable finds under £50" },
  { id: "Mid-Range", name: "Mid-Range", icon: "shopping-bag", description: "Quality pieces £50-£200" },
  { id: "Premium", name: "Premium", icon: "award", description: "Designer brands £200-£500" },
  { id: "Luxury", name: "Luxury", icon: "star", description: "High-end fashion £500+" },
];

const TOTAL_STEPS = 13;

export default function StyleQuizOnboardingScreen({ navigation }: StyleQuizOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { completeQuiz, completeOnboarding, user } = useAuth();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements>({
    height: user?.bodyMeasurements?.height || null,
    heightUnit: user?.bodyMeasurements?.heightUnit || 'cm',
    weight: user?.bodyMeasurements?.weight || null,
    weightUnit: user?.bodyMeasurements?.weightUnit || 'kg',
  });

  const [bodyShape, setBodyShape] = useState<BodyShape | null>(null);
  const [skinUndertone, setSkinUndertone] = useState<SkinUndertone | null>(null);
  const [preferredFit, setPreferredFit] = useState<PreferredFit | null>(null);
  const [areasToHighlight, setAreasToHighlight] = useState<BodyArea[]>([]);
  const [areasToMinimise, setAreasToMinimise] = useState<BodyArea[]>([]);
  const [dressSize, setDressSize] = useState<string>('');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [lifestyle, setLifestyle] = useState<Lifestyle>(user?.extendedPreferences?.lifestyle || null);
  
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>(user?.extendedPreferences?.favoriteBrands || []);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [colorPreferences, setColorPreferences] = useState<string[]>(user?.extendedPreferences?.colorPreferences || []);
  const [shoppingFrequency, setShoppingFrequency] = useState<ShoppingFrequency>(user?.extendedPreferences?.shoppingFrequency || null);
  const [preferOnlineShopping, setPreferOnlineShopping] = useState(user?.extendedPreferences?.preferOnlineShopping ?? true);
  const [sustainabilityImportant, setSustainabilityImportant] = useState(user?.extendedPreferences?.sustainabilityImportant ?? false);
  const [occasions, setOccasions] = useState<string[]>(user?.extendedPreferences?.occasions || []);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(user?.budgetRange || null);

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

  const toggleAreaHighlight = (area: BodyArea) => {
    if (areasToHighlight.includes(area)) {
      setAreasToHighlight(areasToHighlight.filter(a => a !== area));
    } else if (areasToHighlight.length < 3) {
      setAreasToHighlight([...areasToHighlight, area]);
      if (areasToMinimise.includes(area)) {
        setAreasToMinimise(areasToMinimise.filter(a => a !== area));
      }
    }
  };

  const toggleAreaMinimise = (area: BodyArea) => {
    if (areasToMinimise.includes(area)) {
      setAreasToMinimise(areasToMinimise.filter(a => a !== area));
    } else if (areasToMinimise.length < 3) {
      setAreasToMinimise([...areasToMinimise, area]);
      if (areasToHighlight.includes(area)) {
        setAreasToHighlight(areasToHighlight.filter(a => a !== area));
      }
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

  const handleSkip = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      // Complete onboarding directly - no community features
      await completeOnboarding({});
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const bodyFitPreferences = {
        fitPreference: preferredFit,
        confidentAreas: areasToHighlight,
        preferToMinimize: areasToMinimise,
      };

      const extendedPreferences = {
        ...(user?.extendedPreferences || {}),
        lifestyle,
        bodyFitPreferences,
        bodyShape,
        skinUndertone,
        dressSize: dressSize || null,
        ageRange,
        favoriteBrands,
        colorPreferences,
        shoppingFrequency,
        preferOnlineShopping,
        sustainabilityImportant,
        occasions,
      };

      await completeQuiz({
        bodyMeasurements,
        extendedPreferences: extendedPreferences as any,
        budgetRange,
      });

      // Complete onboarding directly - no community features
      await completeOnboarding({});
    } catch (error) {
      console.error('Failed to save quiz data:', error);
      await completeOnboarding({});
    } finally {
      setIsSubmitting(false);
    }
  };

  const gradientColors = ScreenGradients.styleMeProperly.primary;

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <Pressable onPress={handleBack} style={styles.backButton} disabled={step === 0}>
        <Feather 
          name="arrow-left" 
          size={24} 
          color={step === 0 ? 'transparent' : theme.text} 
        />
      </Pressable>
      <View style={styles.progressBarWrapper}>
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              {
                backgroundColor: index <= step ? theme.link : theme.backgroundSecondary,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderStep0HeightWeight = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        Your Body Measurements
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Optional but helps us find your perfect fit
      </ThemedText>

      <View style={styles.measurementSection}>
        <ThemedText type="caption" style={styles.sectionLabel}>
          Height
        </ThemedText>
        <View style={styles.measurementRow}>
          <TextInput
            style={[
              styles.measurementInput,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
              },
            ]}
            placeholder={bodyMeasurements.heightUnit === 'cm' ? "170" : "5'7\""}
            placeholderTextColor={theme.tabIconDefault}
            keyboardType="numeric"
            value={bodyMeasurements.height?.toString() || ""}
            onChangeText={(text) => {
              const num = parseFloat(text);
              setBodyMeasurements({
                ...bodyMeasurements,
                height: isNaN(num) ? null : num,
              });
            }}
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
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: bodyMeasurements.heightUnit === unit ? "#FFFFFF" : theme.text,
                    fontWeight: bodyMeasurements.heightUnit === unit ? "600" : "400",
                  }}
                >
                  {unit}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.measurementSection}>
        <ThemedText type="caption" style={styles.sectionLabel}>
          Weight
        </ThemedText>
        <View style={styles.measurementRow}>
          <TextInput
            style={[
              styles.measurementInput,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
              },
            ]}
            placeholder={bodyMeasurements.weightUnit === 'kg' ? "70" : "154"}
            placeholderTextColor={theme.tabIconDefault}
            keyboardType="numeric"
            value={bodyMeasurements.weight?.toString() || ""}
            onChangeText={(text) => {
              const num = parseFloat(text);
              setBodyMeasurements({
                ...bodyMeasurements,
                weight: isNaN(num) ? null : num,
              });
            }}
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
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: bodyMeasurements.weightUnit === unit ? "#FFFFFF" : theme.text,
                    fontWeight: bodyMeasurements.weightUnit === unit ? "600" : "400",
                  }}
                >
                  {unit}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.link + '15' }]}>
        <Feather name="info" size={20} color={theme.link} />
        <ThemedText type="caption" style={[styles.infoText, { color: theme.text }]}>
          This helps us recommend clothing that fits you perfectly. Your information is private and never shared.
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderStep1BodyShape = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        What's your body shape?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        This helps us suggest the most flattering styles
      </ThemedText>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.optionsScroll}>
        {BODY_SHAPE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setBodyShape(option.id)}
            style={[
              styles.optionCard,
              {
                backgroundColor: bodyShape === option.id ? theme.link + '20' : theme.backgroundSecondary,
                borderColor: bodyShape === option.id ? theme.link : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <View style={styles.optionContent}>
              <ThemedText type="body" style={[styles.optionTitle, bodyShape === option.id && { color: theme.link }]}>
                {option.name}
              </ThemedText>
              <ThemedText type="caption" style={styles.optionDescription}>
                {option.description}
              </ThemedText>
            </View>
            {bodyShape === option.id ? (
              <Feather name="check-circle" size={24} color={theme.link} />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderStep2SkinTone = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        What's your skin undertone?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Helps us recommend colours that complement you
      </ThemedText>

      <View style={styles.optionsGrid}>
        {SKIN_UNDERTONE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setSkinUndertone(option.id)}
            style={[
              styles.undertoneCard,
              {
                backgroundColor: skinUndertone === option.id ? theme.link + '20' : theme.backgroundSecondary,
                borderColor: skinUndertone === option.id ? theme.link : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <View style={styles.colorSwatches}>
              {option.colors.map((color, idx) => (
                <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
              ))}
            </View>
            <ThemedText type="body" style={[styles.optionTitle, skinUndertone === option.id && { color: theme.link }]}>
              {option.name}
            </ThemedText>
            <ThemedText type="caption" style={styles.optionDescription}>
              {option.description}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.link + '15', marginTop: Spacing.xl }]}>
        <Feather name="help-circle" size={20} color={theme.link} />
        <ThemedText type="caption" style={[styles.infoText, { color: theme.text }]}>
          Try the jewellery test: gold flatters warm, silver flatters cool, both suit neutral. Or pick the swatches that feel most like you.
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderStep3PreferredFit = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        How do you like your clothes to fit?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Your preferred clothing fit
      </ThemedText>

      <View style={styles.fitOptionsGrid}>
        {PREFERRED_FIT_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setPreferredFit(option.id)}
            style={[
              styles.fitCard,
              {
                backgroundColor: preferredFit === option.id ? theme.link + '20' : theme.backgroundSecondary,
                borderColor: preferredFit === option.id ? theme.link : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <View style={[styles.fitIconContainer, { backgroundColor: preferredFit === option.id ? theme.link : theme.tabIconDefault }]}>
              <Feather name={option.icon} size={24} color="#FFFFFF" />
            </View>
            <ThemedText type="body" style={[styles.fitTitle, preferredFit === option.id && { color: theme.link }]}>
              {option.name}
            </ThemedText>
            <ThemedText type="caption" style={styles.fitDescription}>
              {option.description}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  const renderStep4AreasToHighlight = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        Areas you want to highlight
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Select up to 3 areas you're confident about
      </ThemedText>

      <View style={styles.areaOptionsGrid}>
        {BODY_AREA_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => toggleAreaHighlight(option.id)}
            style={[
              styles.areaChip,
              {
                backgroundColor: areasToHighlight.includes(option.id) ? theme.success + '20' : theme.backgroundSecondary,
                borderColor: areasToHighlight.includes(option.id) ? theme.success : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <ThemedText 
              type="body" 
              style={[
                styles.areaChipText, 
                areasToHighlight.includes(option.id) && { color: theme.success }
              ]}
            >
              {option.name}
            </ThemedText>
            {areasToHighlight.includes(option.id) ? (
              <Feather name="check" size={16} color={theme.success} />
            ) : null}
          </Pressable>
        ))}
      </View>

      <ThemedText type="h3" style={[styles.subSectionTitle, { marginTop: Spacing["2xl"] }]}>
        Areas you'd prefer to minimise
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Select up to 3 areas
      </ThemedText>

      <View style={styles.areaOptionsGrid}>
        {BODY_AREA_OPTIONS.map((option) => (
          <Pressable
            key={`min-${option.id}`}
            onPress={() => toggleAreaMinimise(option.id)}
            style={[
              styles.areaChip,
              {
                backgroundColor: areasToMinimise.includes(option.id) ? theme.warning + '20' : theme.backgroundSecondary,
                borderColor: areasToMinimise.includes(option.id) ? theme.warning : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <ThemedText 
              type="body" 
              style={[
                styles.areaChipText, 
                areasToMinimise.includes(option.id) && { color: theme.warning }
              ]}
            >
              {option.name}
            </ThemedText>
            {areasToMinimise.includes(option.id) ? (
              <Feather name="check" size={16} color={theme.warning} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  const renderStep5DressSize = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        What's your usual dress size?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Enter your UK, US, or EU size (e.g., UK 12, US 8, EU 40)
      </ThemedText>

      <TextInput
        style={[
          styles.dressSizeInput,
          {
            backgroundColor: theme.backgroundSecondary,
            color: theme.text,
          },
        ]}
        placeholder="e.g., UK 12 or US 8 or M"
        placeholderTextColor={theme.tabIconDefault}
        value={dressSize}
        onChangeText={setDressSize}
        autoCapitalize="characters"
      />

      <View style={[styles.infoCard, { backgroundColor: theme.link + '15', marginTop: Spacing.xl }]}>
        <Feather name="info" size={20} color={theme.link} />
        <ThemedText type="caption" style={[styles.infoText, { color: theme.text }]}>
          This helps us suggest items in your size when shopping. You can update this anytime in Settings.
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderStep6AgeRange = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        What's your age range?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Helps us tailor style recommendations
      </ThemedText>

      <View style={styles.ageOptionsGrid}>
        {AGE_RANGE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setAgeRange(option.id)}
            style={[
              styles.ageChip,
              {
                backgroundColor: ageRange === option.id ? theme.link + '20' : theme.backgroundSecondary,
                borderColor: ageRange === option.id ? theme.link : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <ThemedText 
              type="body" 
              style={[
                styles.ageChipText,
                ageRange === option.id && { color: theme.link, fontWeight: '600' }
              ]}
            >
              {option.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  const renderStep7Lifestyle = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        What's your lifestyle?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Choose the one that best describes your day-to-day
      </ThemedText>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.optionsScroll}>
        {LIFESTYLE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setLifestyle(option.id)}
            style={[
              styles.lifestyleCard,
              {
                backgroundColor: lifestyle === option.id ? theme.link + '20' : theme.backgroundSecondary,
                borderColor: lifestyle === option.id ? theme.link : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <View style={[styles.lifestyleIcon, { backgroundColor: lifestyle === option.id ? theme.link : theme.tabIconDefault }]}>
              <Feather name={option.icon} size={20} color="#FFFFFF" />
            </View>
            <View style={styles.lifestyleContent}>
              <ThemedText type="body" style={[styles.optionTitle, lifestyle === option.id && { color: theme.link }]}>
                {option.name}
              </ThemedText>
              <ThemedText type="caption" style={styles.optionDescription}>
                {option.description}
              </ThemedText>
            </View>
            {lifestyle === option.id ? (
              <Feather name="check-circle" size={24} color={theme.link} />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderStep8FavoriteBrands = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        Your favourite brands
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Select up to 10 brands you love ({favoriteBrands.length}/10)
      </ThemedText>

      {favoriteBrands.length > 0 ? (
        <View style={styles.selectedBrandsRow}>
          {favoriteBrands.map((brand) => (
            <Pressable
              key={brand}
              onPress={() => toggleBrand(brand)}
              style={[styles.selectedBrandChip, { backgroundColor: theme.link + '20', borderColor: theme.link }]}
            >
              <ThemedText type="caption" style={{ color: theme.link }}>{brand}</ThemedText>
              <Feather name="x" size={14} color={theme.link} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextInput
        style={[styles.brandSearchInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
        placeholder="Search brands..."
        placeholderTextColor={theme.tabIconDefault}
        value={brandSearchQuery}
        onChangeText={setBrandSearchQuery}
      />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.brandListScroll}>
        <View style={styles.brandOptionsGrid}>
          {filteredBrands.slice(0, 20).map((brand) => (
            <Pressable
              key={brand}
              onPress={() => toggleBrand(brand)}
              style={[styles.brandChip, { backgroundColor: theme.backgroundSecondary }]}
            >
              <ThemedText type="body">{brand}</ThemedText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );

  const renderStep9ColorPreferences = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        Colours you love to wear
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Select up to 5 favourite colours ({colorPreferences.length}/5)
      </ThemedText>

      <View style={styles.colorOptionsGrid}>
        {COLOR_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => toggleColor(option.id)}
            style={[
              styles.colorOptionCard,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: colorPreferences.includes(option.id) ? theme.link : 'transparent',
                borderWidth: 3,
              },
            ]}
          >
            <View style={[styles.colorCircle, { backgroundColor: option.color, borderWidth: option.id === 'white' ? 1 : 0, borderColor: theme.tabIconDefault }]} />
            <ThemedText type="caption" style={styles.colorName}>{option.name}</ThemedText>
            {colorPreferences.includes(option.id) ? (
              <View style={[styles.colorCheckmark, { backgroundColor: theme.link }]}>
                <Feather name="check" size={12} color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  const renderStep10ShoppingFrequency = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        How often do you shop?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Your shopping habits help us tailor recommendations
      </ThemedText>

      {SHOPPING_FREQUENCY_OPTIONS.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => setShoppingFrequency(option.id)}
          style={[
            styles.optionCard,
            {
              backgroundColor: shoppingFrequency === option.id ? theme.link + '20' : theme.backgroundSecondary,
              borderColor: shoppingFrequency === option.id ? theme.link : 'transparent',
              borderWidth: 2,
            },
          ]}
        >
          <View style={styles.optionContent}>
            <ThemedText type="body" style={[styles.optionTitle, shoppingFrequency === option.id && { color: theme.link }]}>
              {option.name}
            </ThemedText>
            <ThemedText type="caption" style={styles.optionDescription}>
              {option.description}
            </ThemedText>
          </View>
          {shoppingFrequency === option.id ? (
            <Feather name="check-circle" size={24} color={theme.link} />
          ) : null}
        </Pressable>
      ))}

      <View style={[styles.toggleRow, { marginTop: Spacing["2xl"] }]}>
        <View style={styles.toggleContent}>
          <ThemedText type="body" style={styles.optionTitle}>Prefer online shopping</ThemedText>
          <ThemedText type="caption" style={styles.optionDescription}>
            You prefer shopping online over in-store
          </ThemedText>
        </View>
        <Switch
          value={preferOnlineShopping}
          onValueChange={setPreferOnlineShopping}
          trackColor={{ false: theme.backgroundSecondary, true: theme.link }}
        />
      </View>
    </Animated.View>
  );

  const renderStep11Sustainability = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        Sustainability matters?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Let us know if eco-friendly fashion is important to you
      </ThemedText>

      <Pressable
        onPress={() => setSustainabilityImportant(true)}
        style={[
          styles.sustainabilityCard,
          {
            backgroundColor: sustainabilityImportant ? theme.success + '20' : theme.backgroundSecondary,
            borderColor: sustainabilityImportant ? theme.success : 'transparent',
            borderWidth: 2,
          },
        ]}
      >
        <View style={[styles.sustainabilityIcon, { backgroundColor: sustainabilityImportant ? theme.success : theme.tabIconDefault }]}>
          <Feather name="globe" size={28} color="#FFFFFF" />
        </View>
        <ThemedText type="h3" style={[styles.sustainabilityTitle, sustainabilityImportant && { color: theme.success }]}>
          Yes, it's important to me
        </ThemedText>
        <ThemedText type="body" style={styles.sustainabilityDescription}>
          I prefer sustainable, eco-friendly and ethical fashion choices
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={() => setSustainabilityImportant(false)}
        style={[
          styles.sustainabilityCard,
          {
            backgroundColor: !sustainabilityImportant ? theme.link + '20' : theme.backgroundSecondary,
            borderColor: !sustainabilityImportant ? theme.link : 'transparent',
            borderWidth: 2,
          },
        ]}
      >
        <View style={[styles.sustainabilityIcon, { backgroundColor: !sustainabilityImportant ? theme.link : theme.tabIconDefault }]}>
          <Feather name="shopping-bag" size={28} color="#FFFFFF" />
        </View>
        <ThemedText type="h3" style={[styles.sustainabilityTitle, !sustainabilityImportant && { color: theme.link }]}>
          Not a priority right now
        </ThemedText>
        <ThemedText type="body" style={styles.sustainabilityDescription}>
          I'm open to all fashion options regardless of sustainability
        </ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderStep12OccasionsBudget = () => (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.stepContent}
    >
      <ThemedText type="h2" style={styles.stepTitle}>
        What occasions do you dress for?
      </ThemedText>
      <ThemedText type="body" style={styles.stepSubtitle}>
        Select all that apply
      </ThemedText>

      <View style={styles.occasionOptionsGrid}>
        {OCCASION_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => toggleOccasion(option.id)}
            style={[
              styles.occasionChip,
              {
                backgroundColor: occasions.includes(option.id) ? theme.link + '20' : theme.backgroundSecondary,
                borderColor: occasions.includes(option.id) ? theme.link : 'transparent',
                borderWidth: 2,
              },
            ]}
          >
            <Feather name={option.icon} size={18} color={occasions.includes(option.id) ? theme.link : theme.text} />
            <ThemedText type="body" style={[styles.occasionText, occasions.includes(option.id) && { color: theme.link }]}>
              {option.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="h3" style={[styles.subSectionTitle, { marginTop: Spacing["2xl"] }]}>
        What's your budget range?
      </ThemedText>

      {BUDGET_OPTIONS.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => setBudgetRange(option.id)}
          style={[
            styles.budgetCard,
            {
              backgroundColor: budgetRange === option.id ? theme.link + '20' : theme.backgroundSecondary,
              borderColor: budgetRange === option.id ? theme.link : 'transparent',
              borderWidth: 2,
            },
          ]}
        >
          <View style={[styles.budgetIcon, { backgroundColor: budgetRange === option.id ? theme.link : theme.tabIconDefault }]}>
            <Feather name={option.icon} size={18} color="#FFFFFF" />
          </View>
          <View style={styles.budgetContent}>
            <ThemedText type="body" style={[styles.optionTitle, budgetRange === option.id && { color: theme.link }]}>
              {option.name}
            </ThemedText>
            <ThemedText type="caption" style={styles.optionDescription}>
              {option.description}
            </ThemedText>
          </View>
        </Pressable>
      ))}
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderStep0HeightWeight();
      case 1:
        return renderStep1BodyShape();
      case 2:
        return renderStep2SkinTone();
      case 3:
        return renderStep3PreferredFit();
      case 4:
        return renderStep4AreasToHighlight();
      case 5:
        return renderStep5DressSize();
      case 6:
        return renderStep6AgeRange();
      case 7:
        return renderStep7Lifestyle();
      case 8:
        return renderStep8FavoriteBrands();
      case 9:
        return renderStep9ColorPreferences();
      case 10:
        return renderStep10ShoppingFrequency();
      case 11:
        return renderStep11Sustainability();
      case 12:
        return renderStep12OccasionsBudget();
      default:
        return null;
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={Spacing.xl + insets.bottom}
      >
        <View style={styles.header}>
          {renderProgressBar()}
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <ThemedText type="body" style={{ color: theme.link }}>
              Skip
            </ThemedText>
          </Pressable>
        </View>

        {renderCurrentStep()}

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button
            onPress={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : step === TOTAL_STEPS - 1 ? "Complete" : "Continue"}
          </Button>
        </View>
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  progressBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.md,
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
  subSectionTitle: {
    marginBottom: Spacing.sm,
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
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    lineHeight: 20,
  },
  optionsScroll: {
    flex: 1,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontWeight: '500',
    marginBottom: 2,
  },
  optionDescription: {
    opacity: 0.7,
  },
  optionsGrid: {
    gap: Spacing.md,
  },
  undertoneCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  colorSwatches: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  fitOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  fitCard: {
    width: '47%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  fitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  fitTitle: {
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  fitDescription: {
    opacity: 0.7,
    textAlign: 'center',
    fontSize: 11,
  },
  areaOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  areaChipText: {
    fontWeight: '500',
  },
  dressSizeInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    textAlign: 'center',
  },
  ageOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  ageChip: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  ageChipText: {
    fontWeight: '500',
    fontSize: 16,
  },
  lifestyleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  lifestyleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleContent: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  selectedBrandsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  selectedBrandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  brandSearchInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  brandListScroll: {
    flex: 1,
  },
  brandOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  brandChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  colorOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  colorOptionCard: {
    width: 70,
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: Spacing.xs,
  },
  colorName: {
    fontSize: 11,
    textAlign: 'center',
  },
  colorCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  toggleContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  sustainabilityCard: {
    alignItems: 'center',
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sustainabilityIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  sustainabilityTitle: {
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  sustainabilityDescription: {
    opacity: 0.7,
    textAlign: 'center',
  },
  occasionOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  occasionText: {
    fontWeight: '500',
  },
  budgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  budgetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetContent: {
    flex: 1,
  },
});
