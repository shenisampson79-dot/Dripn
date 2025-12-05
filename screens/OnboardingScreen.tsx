import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView, Image, ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, StyleTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SizeRange, BodyShape, BudgetRange, Gender } from "@/contexts/AuthContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

const GENDER_OPTIONS: { id: Gender; name: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "woman", name: "Woman", icon: "user" },
  { id: "man", name: "Man", icon: "user" },
  { id: "non-binary", name: "Non-Binary", icon: "users" },
  { id: "prefer-not-to-say", name: "Prefer not to say", icon: "user-x" },
];

const WOMEN_BODY_SHAPES: { id: BodyShape; name: string; description: string }[] = [
  { id: "Hourglass", name: "Hourglass", description: "Balanced shoulders and hips, defined waist" },
  { id: "Pear", name: "Pear", description: "Hips wider than shoulders" },
  { id: "Apple", name: "Apple", description: "Fuller midsection, slimmer legs" },
  { id: "Rectangle", name: "Rectangle", description: "Similar measurements throughout" },
  { id: "Athletic", name: "Athletic", description: "Broader shoulders, defined muscles" },
];

const MEN_BODY_SHAPES: { id: BodyShape; name: string; description: string }[] = [
  { id: "Rectangle", name: "Rectangle", description: "Shoulders, waist, and hips similar width" },
  { id: "Trapezoid", name: "Trapezoid", description: "Broader shoulders, narrower waist" },
  { id: "Inverted Triangle", name: "Inverted Triangle", description: "Wide shoulders, narrow hips" },
  { id: "Oval", name: "Oval", description: "Fuller midsection" },
  { id: "Athletic", name: "Athletic", description: "Muscular build, defined physique" },
];

const STYLE_IMAGES: Record<Exclude<StyleTheme, 'romantic' | 'boho' | 'sporty'>, ImageSourcePropType> = {
  luxury: require("../assets/images/styles/luxury.png"),
  streetwear: require("../assets/images/styles/streetwear.png"),
  edgy: require("../assets/images/styles/edgy.png"),
};

type RegionalType = 'multicultural' | 'nordic' | 'asian' | 'african' | 'middle-eastern' | 'south-asian' | 'latin-american';

const ROMANTIC_REGIONAL_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/romantic/multicultural.png"),
  'nordic': require("../assets/images/styles/romantic/nordic.png"),
  'asian': require("../assets/images/styles/romantic/asian.png"),
  'african': require("../assets/images/styles/romantic/african.png"),
  'middle-eastern': require("../assets/images/styles/romantic/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/romantic/south-asian.png"),
  'latin-american': require("../assets/images/styles/romantic/latin-american.png"),
};

const BOHO_FEMALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/boho/female/multicultural.png"),
  'nordic': require("../assets/images/styles/boho/female/nordic.png"),
  'asian': require("../assets/images/styles/boho/female/asian.png"),
  'african': require("../assets/images/styles/boho/female/african.png"),
  'middle-eastern': require("../assets/images/styles/boho/female/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/boho/female/south-asian.png"),
  'latin-american': require("../assets/images/styles/boho/female/latin-american.png"),
};

const BOHO_MALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/boho/male/multicultural.png"),
  'nordic': require("../assets/images/styles/boho/male/nordic.png"),
  'asian': require("../assets/images/styles/boho/male/asian.png"),
  'african': require("../assets/images/styles/boho/male/african.png"),
  'middle-eastern': require("../assets/images/styles/boho/male/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/boho/male/south-asian.png"),
  'latin-american': require("../assets/images/styles/boho/male/latin-american.png"),
};

const SPORTY_FEMALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/sporty/female/multicultural.png"),
  'nordic': require("../assets/images/styles/sporty/female/nordic.png"),
  'asian': require("../assets/images/styles/sporty/female/asian.png"),
  'african': require("../assets/images/styles/sporty/female/african.png"),
  'middle-eastern': require("../assets/images/styles/sporty/female/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/sporty/female/south-asian.png"),
  'latin-american': require("../assets/images/styles/sporty/female/latin-american.png"),
};

const SPORTY_MALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/sporty/male/multicultural.png"),
  'nordic': require("../assets/images/styles/sporty/male/nordic.png"),
  'asian': require("../assets/images/styles/sporty/male/asian.png"),
  'african': require("../assets/images/styles/sporty/male/african.png"),
  'middle-eastern': require("../assets/images/styles/sporty/male/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/sporty/male/south-asian.png"),
  'latin-american': require("../assets/images/styles/sporty/male/latin-american.png"),
};

const getGenderSpecificBohoImage = (region: RegionalType, gender: Gender): ImageSourcePropType => {
  if (gender === 'man') return BOHO_MALE_IMAGES[region];
  return BOHO_FEMALE_IMAGES[region];
};

const getGenderSpecificSportyImage = (region: RegionalType, gender: Gender): ImageSourcePropType => {
  if (gender === 'man') return SPORTY_MALE_IMAGES[region];
  return SPORTY_FEMALE_IMAGES[region];
};

const getRegionFromCountry = (country: string): RegionalType => {
  const nordicEasternEuropeanCountries = [
    'Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark',
    'Estonia', 'Latvia', 'Lithuania', 'Poland', 'Czech Republic', 'Slovakia',
    'Hungary', 'Romania', 'Bulgaria', 'Russia', 'Ukraine', 'Belarus', 'Moldova'
  ];
  const multiculturalCountries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'New Zealand',
    'Germany', 'France', 'Italy', 'Spain', 'Portugal', 'Netherlands',
    'Belgium', 'Switzerland', 'Austria', 'Ireland', 'Greece',
    'Croatia', 'Serbia', 'Slovenia', 'Luxembourg', 'Malta', 'Cyprus', 
    'Albania', 'Montenegro', 'North Macedonia', 'Bosnia and Herzegovina', 
    'Andorra', 'Armenia', 'Azerbaijan', 'Georgia', 'Kazakhstan', 'Kosovo'
  ];
  const asianCountries = [
    'Japan', 'South Korea', 'China', 'Taiwan', 'Hong Kong', 'Singapore', 'Thailand',
    'Vietnam', 'Malaysia', 'Indonesia', 'Philippines', 'Myanmar', 'Cambodia', 'Laos'
  ];
  const southAsianCountries = ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Maldives'];
  const africanCountries = [
    'Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Ethiopia', 'Egypt', 'Morocco',
    'Tanzania', 'Uganda', 'Senegal', 'Cameroon', 'Ivory Coast', 'Algeria', 'Tunisia',
    'Zimbabwe', 'Zambia', 'Rwanda', 'Angola', 'Mozambique', 'Madagascar'
  ];
  const middleEasternCountries = [
    'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
    'Jordan', 'Lebanon', 'Israel', 'Turkey', 'Iran', 'Iraq', 'Yemen', 'Syria'
  ];
  const latinAmericanCountries = [
    'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela',
    'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Costa Rica', 'Panama',
    'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Dominican Republic',
    'Jamaica', 'Cuba', 'Puerto Rico', 'Haiti', 'Trinidad and Tobago', 'Barbados',
    'Bahamas', 'Belize', 'Guyana', 'Suriname'
  ];

  if (nordicEasternEuropeanCountries.includes(country)) return 'nordic';
  if (multiculturalCountries.includes(country)) return 'multicultural';
  if (asianCountries.includes(country)) return 'asian';
  if (southAsianCountries.includes(country)) return 'south-asian';
  if (africanCountries.includes(country)) return 'african';
  if (middleEasternCountries.includes(country)) return 'middle-eastern';
  if (latinAmericanCountries.includes(country)) return 'latin-american';

  return 'multicultural';
};

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Onboarding">;
};

const STYLE_OPTIONS: { id: StyleTheme; name: string; description: string }[] = [
  { id: "luxury", name: "Formal", description: "Elegant, refined, timeless pieces" },
  { id: "streetwear", name: "Casual", description: "Relaxed, comfortable, everyday style" },
  { id: "boho", name: "Boho", description: "Earthy, relaxed, artistic" },
  { id: "sporty", name: "Sporty", description: "Active, dynamic, athletic" },
  { id: "romantic", name: "Romantic", description: "Soft, feminine, delicate" },
  { id: "edgy", name: "Edgy", description: "Bold, alternative, dramatic" },
];

const SIZE_OPTIONS: SizeRange[] = ["XS-S", "M-L", "XL-2X", "3X+"];

const BUDGET_OPTIONS: { id: BudgetRange; name: string }[] = [
  { id: "Budget", name: "Budget-Friendly" },
  { id: "Mid-Range", name: "Mid-Range" },
  { id: "Premium", name: "Premium" },
  { id: "Luxury", name: "Luxury" },
];

const PRIMARY_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "South Korea",
  "Brazil",
  "Mexico",
  "Other",
];

const ALL_COUNTRIES = [
  "Albania",
  "Andorra",
  "Argentina",
  "Armenia",
  "Austria",
  "Azerbaijan",
  "Bangladesh",
  "Belarus",
  "Belgium",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Bulgaria",
  "Chile",
  "China",
  "Colombia",
  "Costa Rica",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "Estonia",
  "Ethiopia",
  "Finland",
  "Georgia",
  "Ghana",
  "Greece",
  "Guatemala",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Kazakhstan",
  "Kenya",
  "Kosovo",
  "Latvia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Malta",
  "Moldova",
  "Monaco",
  "Montenegro",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Pakistan",
  "Panama",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "San Marino",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "Spain",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "Uruguay",
  "Vatican City",
  "Venezuela",
  "Vietnam",
];

export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { completeOnboarding } = useAuth();

  const [step, setStep] = useState(0);
  const [country, setCountry] = useState("United States");
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [gender, setGender] = useState<Gender>(null);
  const [stylePreference, setStylePreference] = useState<StyleTheme>("luxury");
  const [sizeRange, setSizeRange] = useState<SizeRange>(null);
  const [bodyShape, setBodyShape] = useState<BodyShape>(null);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(null);

  const totalSteps = 4;

  const getBodyShapeOptions = () => {
    if (gender === "man") return MEN_BODY_SHAPES;
    if (gender === "woman") return WOMEN_BODY_SHAPES;
    return [...WOMEN_BODY_SHAPES, ...MEN_BODY_SHAPES.filter(s => !WOMEN_BODY_SHAPES.find(w => w.id === s.id))];
  };

  const handleCountrySelect = (c: string) => {
    if (c === "Other") {
      setShowAllCountries(true);
    } else {
      setCountry(c);
    }
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setShowAllCountries(false);
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    await completeOnboarding({
      country,
      gender,
      stylePreference,
      sizeRange,
      bodyShape,
      budgetRange,
    });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        const countriesToShow = showAllCountries ? ALL_COUNTRIES : PRIMARY_COUNTRIES;
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Where are you located?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              {showAllCountries 
                ? "Select your country from the full list" 
                : "This helps us show seasonal and regional content"}
            </ThemedText>
            {showAllCountries ? (
              <Pressable
                onPress={() => setShowAllCountries(false)}
                style={({ pressed }) => [
                  styles.backButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="arrow-left" size={16} color={theme.link} />
                <ThemedText type="body" style={{ color: theme.link, marginLeft: Spacing.xs }}>
                  Back to common countries
                </ThemedText>
              </Pressable>
            ) : null}
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.optionsGrid}>
                {countriesToShow.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => handleCountrySelect(c)}
                    style={({ pressed }) => [
                      styles.optionChip,
                      {
                        backgroundColor:
                          country === c ? theme.link : theme.backgroundDefault,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      type="body"
                      style={{
                        color: country === c ? "#FFFFFF" : theme.text,
                      }}
                    >
                      {c}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              How do you identify?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              This helps us tailor style recommendations for you
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.genderOptions}>
                {GENDER_OPTIONS.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setGender(g.id)}
                    style={({ pressed }) => [
                      styles.genderOption,
                      {
                        backgroundColor:
                          gender === g.id ? theme.link : theme.backgroundDefault,
                        borderColor:
                          gender === g.id ? theme.link : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={g.icon}
                      size={24}
                      color={gender === g.id ? "#FFFFFF" : theme.text}
                    />
                    <ThemedText
                      type="h3"
                      style={{
                        color: gender === g.id ? "#FFFFFF" : theme.text,
                      }}
                    >
                      {g.name}
                    </ThemedText>
                    {gender === g.id ? (
                      <View style={[styles.checkCircleSmall, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              What's your style?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Pick the aesthetic that speaks to you
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.styleOptions}>
                {STYLE_OPTIONS.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setStylePreference(s.id)}
                    style={({ pressed }) => [
                      styles.styleOption,
                      {
                        borderColor:
                          stylePreference === s.id
                            ? theme.link
                            : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Image
                      source={
                        s.id === 'romantic' 
                          ? ROMANTIC_REGIONAL_IMAGES[getRegionFromCountry(country)]
                          : s.id === 'boho'
                            ? getGenderSpecificBohoImage(getRegionFromCountry(country), gender)
                            : s.id === 'sporty'
                              ? getGenderSpecificSportyImage(getRegionFromCountry(country), gender)
                              : STYLE_IMAGES[s.id as keyof typeof STYLE_IMAGES]
                      }
                      style={styles.styleImagePreview}
                      resizeMode="cover"
                    />
                    <View style={styles.styleTextContainer}>
                      <ThemedText type="h3">
                        {s.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ opacity: 0.7 }}
                      >
                        {s.description}
                      </ThemedText>
                    </View>
                    {stylePreference === s.id ? (
                      <View style={[styles.checkCircle, { backgroundColor: theme.link }]}>
                        <Feather name="check" size={16} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Tell us more (optional)
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Help us personalize your recommendations
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Size Range
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
                        style={{
                          color: sizeRange === size ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {size}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Body Shape
                </ThemedText>
                <View style={styles.bodyShapeOptions}>
                  {getBodyShapeOptions().map((shape) => (
                    <Pressable
                      key={shape.id}
                      onPress={() =>
                        setBodyShape(bodyShape === shape.id ? null : shape.id)
                      }
                      style={({ pressed }) => [
                        styles.bodyShapeOption,
                        {
                          backgroundColor:
                            bodyShape === shape.id
                              ? theme.link
                              : theme.backgroundDefault,
                          borderColor:
                            bodyShape === shape.id
                              ? theme.link
                              : theme.backgroundSecondary,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: bodyShape === shape.id ? "#FFFFFF" : theme.text,
                          fontWeight: "600",
                        }}
                      >
                        {shape.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{
                          color: bodyShape === shape.id ? "#FFFFFF" : theme.text,
                          opacity: 0.7,
                        }}
                      >
                        {shape.description}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Budget Range
                </ThemedText>
                <View style={styles.optionsRow}>
                  {BUDGET_OPTIONS.map((budget) => (
                    <Pressable
                      key={budget.id}
                      onPress={() =>
                        setBudgetRange(budgetRange === budget.id ? null : budget.id)
                      }
                      style={({ pressed }) => [
                        styles.optionChip,
                        {
                          backgroundColor:
                            budgetRange === budget.id
                              ? theme.link
                              : theme.backgroundDefault,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: budgetRange === budget.id ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {budget.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor: i <= step ? theme.link : theme.backgroundSecondary,
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText type="body" style={{ color: theme.link }}>
            Skip
          </ThemedText>
        </Pressable>
      </View>

      {renderStep()}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Button onPress={handleNext} style={styles.nextButton}>
          {step === totalSteps - 1 ? "Get Started" : "Continue"}
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
    paddingBottom: Spacing.lg,
  },
  progressContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  optionsScroll: {
    flex: 1,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  styleOptions: {
    gap: Spacing.md,
  },
  styleOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  styleImagePreview: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
  },
  styleTextContainer: {
    flex: 1,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  genderOptions: {
    gap: Spacing.md,
  },
  genderOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  optionalSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    marginBottom: Spacing.md,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  bodyShapeOptions: {
    gap: Spacing.sm,
  },
  bodyShapeOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  nextButton: {
    width: "100%",
  },
});
