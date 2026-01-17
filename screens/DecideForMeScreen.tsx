import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";

type DecideForMeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "DecideForMe">;
};

const OCCASIONS = [
  { id: "work", label: "Work", icon: "briefcase" as const },
  { id: "casual", label: "Casual day", icon: "coffee" as const },
  { id: "date", label: "Date night", icon: "heart" as const },
  { id: "event", label: "Special event", icon: "star" as const },
  { id: "workout", label: "Workout", icon: "activity" as const },
  { id: "brunch", label: "Brunch", icon: "sun" as const },
];

const COMFORT_LEVELS = [
  { id: "cozy", label: "Cozy & relaxed" },
  { id: "polished", label: "Polished & put-together" },
  { id: "bold", label: "Bold & expressive" },
];

interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
}

interface Recommendation {
  outfit: string;
  reasoning: string;
  stylistName: string;
}

export default function DecideForMeScreen({ navigation }: DecideForMeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  const [step, setStep] = useState<"occasion" | "comfort" | "loading" | "result">("occasion");
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedComfort, setSelectedComfort] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const data = await apiService.get<{ temperature: number; condition: string; location?: string }>(`/api/weather?lat=${location.coords.latitude}&lon=${location.coords.longitude}`);
        if (data) {
          setWeather({
            temperature: data.temperature,
            condition: data.condition,
            location: data.location || "Your area",
          });
        }
      }
    } catch (error: unknown) {
      setWeather({ temperature: 18, condition: "mild", location: "Your area" });
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleOccasionSelect = (occasionId: string) => {
    setSelectedOccasion(occasionId);
    setStep("comfort");
  };

  const handleComfortSelect = async (comfortId: string) => {
    setSelectedComfort(comfortId);
    setStep("loading");

    try {
      const data = await apiService.post<{ recommendation?: string; reasoning?: string; stylistName?: string }>("/api/onboarding/quick-recommendation", {
        occasion: selectedOccasion,
        comfort: comfortId,
        weather: weather,
      });

      if (data) {
        setRecommendation({
          outfit: data.recommendation || "Wear a black midi dress with ankle boots and a structured coat. Keep jewellery minimal.",
          reasoning: data.reasoning || "This look balances comfort with style, perfect for your occasion.",
          stylistName: data.stylistName || "Ruby",
        });
      } else {
        setRecommendation({
          outfit: "Wear a black midi dress with ankle boots and a structured coat. Keep jewellery minimal.",
          reasoning: "This classic combination works perfectly for your occasion and the current weather.",
          stylistName: "Ruby",
        });
      }
      setStep("result");
    } catch (error: unknown) {
      setRecommendation({
        outfit: "Wear a black midi dress with ankle boots and a structured coat. Keep jewellery minimal.",
        reasoning: "This classic combination works perfectly for your occasion and the current weather.",
        stylistName: "Ruby",
      });
      setStep("result");
    }
  };

  const handlePersonalise = () => {
    navigation.navigate("StyleMeProperly");
  };

  const handleJustBrowsing = () => {
    navigation.navigate("OnboardingEntry");
  };

  const renderOccasionStep = () => (
    <Animated.View entering={FadeIn} style={styles.stepContainer}>
      <View style={styles.stylistMessage}>
        <View style={[styles.avatarCircle, { backgroundColor: theme.link }]}>
          <Feather name="message-circle" size={20} color="#FFFFFF" />
        </View>
        <View style={[styles.messageBubble, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="body" style={[styles.messageText, { color: theme.text }]}>
            Tell me what the occasion is and I'll decide the outfit.
          </ThemedText>
        </View>
      </View>

      {weather && !isLoadingWeather && (
        <Animated.View entering={FadeInDown.delay(200)} style={[styles.weatherBadge, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="cloud" size={16} color={theme.tabIconDefault} />
          <ThemedText type="small" style={{ color: theme.tabIconDefault, marginLeft: Spacing.xs }}>
            {weather.temperature}° in {weather.location}
          </ThemedText>
        </Animated.View>
      )}

      <View style={styles.optionsGrid}>
        {OCCASIONS.map((occasion, index) => (
          <Animated.View 
            key={occasion.id} 
            entering={FadeInUp.delay(100 + index * 50)}
            style={styles.optionWrapper}
          >
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { 
                  backgroundColor: selectedOccasion === occasion.id ? theme.link : theme.backgroundSecondary,
                  opacity: pressed ? 0.9 : 1,
                }
              ]}
              onPress={() => handleOccasionSelect(occasion.id)}
            >
              <Feather 
                name={occasion.icon} 
                size={24} 
                color={selectedOccasion === occasion.id ? "#FFFFFF" : theme.text} 
              />
              <ThemedText 
                type="body" 
                style={[
                  styles.optionLabel,
                  { color: selectedOccasion === occasion.id ? "#FFFFFF" : theme.text }
                ]}
              >
                {occasion.label}
              </ThemedText>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );

  const renderComfortStep = () => (
    <Animated.View entering={FadeIn} style={styles.stepContainer}>
      <View style={styles.stylistMessage}>
        <View style={[styles.avatarCircle, { backgroundColor: theme.link }]}>
          <Feather name="message-circle" size={20} color="#FFFFFF" />
        </View>
        <View style={[styles.messageBubble, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="body" style={[styles.messageText, { color: theme.text }]}>
            How do you want to feel today?
          </ThemedText>
        </View>
      </View>

      <View style={styles.comfortOptions}>
        {COMFORT_LEVELS.map((comfort, index) => (
          <Animated.View 
            key={comfort.id} 
            entering={FadeInUp.delay(100 + index * 100)}
          >
            <Pressable
              style={({ pressed }) => [
                styles.comfortCard,
                { 
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: selectedComfort === comfort.id ? theme.link : theme.border,
                  borderWidth: selectedComfort === comfort.id ? 2 : 1,
                  opacity: pressed ? 0.9 : 1,
                }
              ]}
              onPress={() => handleComfortSelect(comfort.id)}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                {comfort.label}
              </ThemedText>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );

  const renderLoadingStep = () => (
    <Animated.View entering={FadeIn} style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.link} />
      <ThemedText type="body" style={[styles.loadingText, { color: theme.tabIconDefault }]}>
        Ruby is deciding your outfit...
      </ThemedText>
    </Animated.View>
  );

  const renderResultStep = () => (
    <Animated.View entering={FadeIn} style={styles.resultContainer}>
      <View style={styles.stylistMessage}>
        <View style={[styles.avatarCircle, { backgroundColor: "#E91E63" }]}>
          <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>R</ThemedText>
        </View>
        <View style={[styles.messageBubble, styles.resultBubble]}>
          <ThemedText type="body" style={[styles.messageText, styles.recommendationText]}>
            {recommendation?.outfit}
          </ThemedText>
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(300)} style={styles.ctaSection}>
        <ThemedText type="body" style={[styles.ctaPrompt, { color: theme.tabIconDefault }]}>
          Want this personalised to your wardrobe?
        </ThemedText>

        <Button onPress={handlePersonalise} style={[styles.primaryButton, { backgroundColor: theme.link }]}>
          Yes, personalise it
        </Button>

        <Pressable onPress={handleJustBrowsing} style={styles.secondaryButton}>
          <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
            I'm just browsing
          </ThemedText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text }}>Decide for me</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {step === "occasion" && renderOccasionStep()}
        {step === "comfort" && renderComfortStep()}
        {step === "loading" && renderLoadingStep()}
        {step === "result" && renderResultStep()}
      </ScrollView>
    </View>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  stepContainer: {
    flex: 1,
  },
  stylistMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  messageBubble: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  weatherBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  optionWrapper: {
    width: "47%",
  },
  optionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  comfortOptions: {
    gap: Spacing.md,
  },
  comfortCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: Spacing.lg,
  },
  resultContainer: {
    flex: 1,
  },
  resultBubble: {
    backgroundColor: "rgba(233,30,99,0.1)",
  },
  recommendationText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "500",
  },
  ctaSection: {
    marginTop: Spacing["3xl"],
    alignItems: "center",
  },
  ctaPrompt: {
    marginBottom: Spacing.lg,
    textAlign: "center",
    fontStyle: "italic",
  },
  primaryButton: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
  },
});
