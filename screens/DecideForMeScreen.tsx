import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, TextInput, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { stylistUpgradeService } from "@/services/StylistUpgradeService";

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
  id?: string;
  outfit: string;
  reasoning: string;
  stylistName: string;
}

const CACHED_OUTFITS_KEY = "dripn_cached_outfits";
const RECOMMENDATION_COUNT_KEY = "dripn_recommendation_count";

export default function DecideForMeScreen({ navigation }: DecideForMeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  const [step, setStep] = useState<"occasion" | "comfort" | "loading" | "result">("occasion");
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedComfort, setSelectedComfort] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [tweakText, setTweakText] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [cachedOutfitsCount, setCachedOutfitsCount] = useState(0);
  const recommendationCountRef = useRef(0);

  useEffect(() => {
    fetchWeather();
    loadCachedOutfitsCount();
    loadRecommendationCount();
  }, []);

  const loadCachedOutfitsCount = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHED_OUTFITS_KEY);
      if (cached) {
        const outfits = JSON.parse(cached);
        setCachedOutfitsCount(outfits.length);
      }
    } catch (error) {
      console.log("Failed to load cached outfits count");
    }
  };

  const loadRecommendationCount = async () => {
    try {
      const count = await AsyncStorage.getItem(RECOMMENDATION_COUNT_KEY);
      recommendationCountRef.current = count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.log("Failed to load recommendation count");
    }
  };

  const incrementRecommendationCount = async () => {
    try {
      recommendationCountRef.current += 1;
      await AsyncStorage.setItem(RECOMMENDATION_COUNT_KEY, recommendationCountRef.current.toString());
      
      if (recommendationCountRef.current >= 3) {
        checkGate();
      }
    } catch (error) {
      console.log("Failed to increment recommendation count");
    }
  };

  const checkGate = async () => {
    try {
      const data = await apiService.post<{ showGate?: boolean }>("/api/onboarding/check-gate", {
        recommendationCount: recommendationCountRef.current,
      });
      if (data?.showGate) {
        navigation.navigate("SoftSignupGate", { fromPath: "browsing" });
      }
    } catch (error) {
      console.log("Failed to check gate");
    }
  };

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
      const data = await apiService.post<{ id?: string; recommendation?: string; reasoning?: string; stylistName?: string }>("/api/onboarding/quick-recommendation", {
        occasion: selectedOccasion,
        comfort: comfortId,
        weather: weather,
      });

      if (data) {
        setRecommendation({
          id: data.id,
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
      incrementRecommendationCount();
    } catch (error: unknown) {
      setRecommendation({
        outfit: "Wear a black midi dress with ankle boots and a structured coat. Keep jewellery minimal.",
        reasoning: "This classic combination works perfectly for your occasion and the current weather.",
        stylistName: "Ruby",
      });
      setStep("result");
      incrementRecommendationCount();
    }
  };

  const recordInteraction = async (action: string, details?: string) => {
    try {
      await apiService.post("/api/onboarding/record-interaction", {
        action,
        recommendationId: recommendation?.id,
        details,
      });
    } catch (error) {
      console.log("Failed to record interaction");
    }
  };

  const handleSaveOutfit = async () => {
    await recordInteraction("save_outfit");
    
    await stylistUpgradeService.recordSignal("SAVE", recommendation?.stylistName?.toLowerCase(), {
      message: "User tapped save outfit",
      occasion: selectedOccasion,
      comfort: selectedComfort,
    });
    
    setShowSavePrompt(true);
  };

  const handleCreateAccount = () => {
    setShowSavePrompt(false);
    navigation.navigate("SoftSignupGate", { fromPath: "save_outfit" });
  };

  const handleNotNow = async () => {
    setShowSavePrompt(false);
    
    try {
      const cached = await AsyncStorage.getItem(CACHED_OUTFITS_KEY);
      const outfits = cached ? JSON.parse(cached) : [];
      
      if (outfits.length >= 3) {
        Alert.alert(
          "Create an account to save more",
          "You've saved 3 outfits. Create a free account to keep them forever.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Create account", onPress: handleCreateAccount },
          ]
        );
        return;
      }
      
      outfits.push({
        ...recommendation,
        savedAt: new Date().toISOString(),
        occasion: selectedOccasion,
        comfort: selectedComfort,
      });
      
      await AsyncStorage.setItem(CACHED_OUTFITS_KEY, JSON.stringify(outfits));
      setCachedOutfitsCount(outfits.length);
      
      Alert.alert(
        "Saved temporarily",
        "This will disappear when you leave the app. Create an account to keep it forever.",
        [{ text: "Got it" }]
      );
    } catch (error) {
      console.log("Failed to cache outfit");
    }
  };

  const handleAnotherOption = async () => {
    await recordInteraction("another_option");
    setSelectedOccasion(null);
    setSelectedComfort(null);
    setRecommendation(null);
    setTweakText("");
    setStep("occasion");
  };

  const handleSecondOpinion = async () => {
    await recordInteraction("second_opinion");
    navigation.navigate("SoftSignupGate", { fromPath: "second_opinion" });
  };

  const handleTweakSubmit = async () => {
    if (tweakText.trim()) {
      await recordInteraction("tweak", tweakText.trim());
      setTweakText("");
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

      {weather && !isLoadingWeather ? (
        <Animated.View entering={FadeInDown.delay(200)} style={[styles.weatherBadge, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="cloud" size={16} color={theme.tabIconDefault} />
          <ThemedText type="small" style={{ color: theme.tabIconDefault, marginLeft: Spacing.xs }}>
            {weather.temperature}° in {weather.location}
          </ThemedText>
        </Animated.View>
      ) : null}

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

  const renderSavePrompt = () => (
    <Animated.View entering={FadeIn} style={[styles.savePromptOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
      <View style={[styles.savePromptCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h3" style={[styles.savePromptTitle, { color: theme.text }]}>
          Keep this outfit?
        </ThemedText>
        <ThemedText type="body" style={[styles.savePromptSubtitle, { color: theme.tabIconDefault }]}>
          Create a free account to save it forever
        </ThemedText>
        
        <Button onPress={handleCreateAccount} style={[styles.savePromptButton, { backgroundColor: theme.link }]}>
          Create account
        </Button>
        
        <Pressable onPress={handleNotNow} style={styles.savePromptSecondary}>
          <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
            Not now
          </ThemedText>
          {cachedOutfitsCount > 0 ? (
            <ThemedText type="small" style={{ color: theme.tabIconDefault, marginTop: 4 }}>
              ({3 - cachedOutfitsCount} saves left)
            </ThemedText>
          ) : null}
        </Pressable>
      </View>
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

      <Animated.View entering={FadeInDown.delay(200)} style={styles.actionButtonsRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.link, borderWidth: 1 }]}
          onPress={handleSaveOutfit}
        >
          <Feather name="bookmark" size={18} color={theme.link} />
          <ThemedText type="body" style={[styles.actionButtonText, { color: theme.link }]}>
            Save outfit
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }]}
          onPress={handleAnotherOption}
        >
          <Feather name="refresh-cw" size={18} color={theme.text} />
          <ThemedText type="body" style={[styles.actionButtonText, { color: theme.text }]}>
            Another option
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }]}
          onPress={handleSecondOpinion}
        >
          <Feather name="users" size={18} color={theme.text} />
          <ThemedText type="body" style={[styles.actionButtonText, { color: theme.text }]}>
            Second opinion
          </ThemedText>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)} style={styles.tweakSection}>
        <View style={[styles.tweakInputContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <TextInput
            style={[styles.tweakInput, { color: theme.text }]}
            placeholder="Want to tweak this? (optional)"
            placeholderTextColor={theme.tabIconDefault}
            value={tweakText}
            onChangeText={setTweakText}
            onSubmitEditing={handleTweakSubmit}
            returnKeyType="send"
          />
          {tweakText.trim() ? (
            <Pressable onPress={handleTweakSubmit} style={styles.tweakSendButton}>
              <Feather name="send" size={18} color={theme.link} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)} style={styles.ctaSection}>
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

      {showSavePrompt ? renderSavePrompt() : null}
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

      <ScreenScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {step === "occasion" ? renderOccasionStep() : null}
        {step === "comfort" ? renderComfortStep() : null}
        {step === "loading" ? renderLoadingStep() : null}
        {step === "result" ? renderResultStep() : null}
      </ScreenScrollView>
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
  actionButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  tweakSection: {
    marginBottom: Spacing.lg,
  },
  tweakInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tweakInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  tweakSendButton: {
    padding: Spacing.sm,
  },
  ctaSection: {
    marginTop: Spacing.lg,
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
  savePromptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  savePromptCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  savePromptTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  savePromptSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  savePromptButton: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  savePromptSecondary: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
});
