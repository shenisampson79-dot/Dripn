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
import { styleDirectionService, StyleDirection } from "@/services/StyleDirectionService";

type DecideForMeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "DecideForMe">;
};

const OCCASION_ICONS: Record<string, "briefcase" | "heart" | "coffee" | "calendar" | "eye"> = {
  work: "briefcase",
  date: "heart",
  casual: "coffee",
  event: "calendar",
  browsing: "eye",
};

const MAX_EXPRESSION_LENGTH = 280;

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
const STYLE_DIRECTION_SET_KEY = "dripn_style_direction_set";

const STYLE_CHIPS = [
  { id: "masculine" as StyleDirection, label: "Masculine" },
  { id: "feminine" as StyleDirection, label: "Feminine" },
  { id: "androgynous" as StyleDirection, label: "Androgynous" },
  { id: "not_sure" as StyleDirection, label: "Not sure yet" },
];

interface FallbackOutfit {
  outfit: string;
  reasoning: string;
  occasions?: string[];
  coldWeather?: boolean;
  warmWeather?: boolean;
}

const FALLBACK_OUTFITS: FallbackOutfit[] = [
  {
    outfit: "Wear tailored trousers with a crisp white shirt and a structured blazer. Add clean white trainers for a modern finish.",
    reasoning: "This classic combination works perfectly for your occasion. Smart enough for most settings, comfortable enough for all day.",
    occasions: ["work", "casual", "event"],
  },
  {
    outfit: "Try dark slim-fit jeans with a fitted crew neck jumper in navy or grey. Layer with a quality overcoat.",
    reasoning: "Smart casual that works for most occasions. The layers keep you warm without sacrificing style.",
    occasions: ["casual", "date"],
    coldWeather: true,
  },
  {
    outfit: "Go for chinos in a neutral tone with a well-fitted Oxford shirt. Roll the sleeves for a relaxed but refined look.",
    reasoning: "This versatile combination takes you from day to evening with ease.",
    occasions: ["work", "casual", "date"],
    warmWeather: true,
  },
  {
    outfit: "Pair straight-leg trousers with a quality turtleneck in black or cream. Add loafers for a sophisticated edge.",
    reasoning: "Minimalist and impactful. Fewer pieces, more intention.",
    occasions: ["work", "date", "event"],
    coldWeather: true,
  },
  {
    outfit: "Choose a flowy midi dress in a solid colour. Add heeled ankle boots and simple gold jewellery.",
    reasoning: "Elegant without trying too hard. The silhouette does the work.",
    occasions: ["date", "event"],
  },
  {
    outfit: "Opt for a relaxed linen shirt over well-fitted chinos. Leather loafers complete the look.",
    reasoning: "Easy and breathable. Perfect when you want to look good without overthinking.",
    occasions: ["casual", "date"],
    warmWeather: true,
  },
  {
    outfit: "A well-fitted navy or charcoal suit with a crisp white shirt and polished Oxford shoes. Add a quality leather belt.",
    reasoning: "Classic professional attire that commands respect. Timeless for a reason.",
    occasions: ["work", "event"],
  },
  {
    outfit: "Dark tailored jeans with a fitted cashmere jumper. Add clean leather Chelsea boots for a polished finish.",
    reasoning: "Elevated casual that works for upscale venues. Comfortable yet refined.",
    occasions: ["date", "event", "casual"],
    coldWeather: true,
  },
  {
    outfit: "Structured wide-leg trousers with a tucked-in silk camisole and a tailored blazer. Pointed-toe heels add polish.",
    reasoning: "Modern power dressing. Makes a statement without saying a word.",
    occasions: ["work", "event"],
  },
  {
    outfit: "Lightweight cotton t-shirt in a neutral tone with well-fitted shorts and quality leather sandals.",
    reasoning: "Summer simplicity done right. Cool, clean, and effortlessly put together.",
    occasions: ["casual"],
    warmWeather: true,
  },
];

const getFilteredOutfits = (occasion: string | null, temperature: number | null): FallbackOutfit[] => {
  let filtered = [...FALLBACK_OUTFITS];
  
  if (occasion) {
    const occasionFiltered = filtered.filter(o => !o.occasions || o.occasions.includes(occasion));
    if (occasionFiltered.length > 0) filtered = occasionFiltered;
  }
  
  if (temperature !== null) {
    if (temperature < 12) {
      const coldFiltered = filtered.filter(o => o.coldWeather !== false && !o.warmWeather);
      if (coldFiltered.length > 0) filtered = coldFiltered;
    } else if (temperature > 20) {
      const warmFiltered = filtered.filter(o => o.warmWeather !== false && !o.coldWeather);
      if (warmFiltered.length > 0) filtered = warmFiltered;
    }
  }
  
  return filtered.length > 0 ? filtered : FALLBACK_OUTFITS;
};

export default function DecideForMeScreen({ navigation }: DecideForMeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  const [step, setStep] = useState<"occasion" | "loading" | "result">("occasion");
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [expressionText, setExpressionText] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [cachedOutfitsCount, setCachedOutfitsCount] = useState(0);
  const [showStyleChips, setShowStyleChips] = useState(false);
  const [selectedStyleDirection, setSelectedStyleDirection] = useState<StyleDirection | null>(null);
  const [styleDirectionSet, setStyleDirectionSet] = useState(false);
  const [firstMessages, setFirstMessages] = useState<{
    message: string;
    options: { id: string; label: string }[];
  } | null>(null);
  const recommendationCountRef = useRef(0);
  const outfitIndexRef = useRef(0);
  const [isLoadingAnotherOption, setIsLoadingAnotherOption] = useState(false);

  useEffect(() => {
    fetchWeather();
    loadCachedOutfitsCount();
    loadRecommendationCount();
    checkStyleDirectionStatus();
    loadFirstMessages();
  }, []);

  const loadFirstMessages = async () => {
    const messages = await styleDirectionService.getFirstMessages();
    setFirstMessages(messages);
  };

  const checkStyleDirectionStatus = async () => {
    try {
      const isSet = await AsyncStorage.getItem(STYLE_DIRECTION_SET_KEY);
      if (isSet === "true") {
        setStyleDirectionSet(true);
      }
    } catch (error) {
      console.log("Failed to check style direction status");
    }
  };

  const handleStyleChipSelect = async (direction: StyleDirection) => {
    setSelectedStyleDirection(direction);
    const success = await styleDirectionService.setStyleDirection(direction, "chips");
    if (success) {
      setStyleDirectionSet(true);
      await AsyncStorage.setItem(STYLE_DIRECTION_SET_KEY, "true");
      setTimeout(() => setShowStyleChips(false), 500);
    }
  };

  const dismissStyleChips = () => {
    setShowStyleChips(false);
  };

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
      
      if (recommendationCountRef.current === 1 && !styleDirectionSet) {
        setTimeout(() => setShowStyleChips(true), 1500);
      }
      
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
        const lat = location.coords.latitude;
        const lon = location.coords.longitude;
        
        // Use Open-Meteo API (free, no API key required)
        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const weatherData = await weatherResponse.json();
        
        if (weatherData.current_weather) {
          const temp = Math.round(weatherData.current_weather.temperature);
          const weatherCode = weatherData.current_weather.weathercode;
          
          // Map weather code to condition
          let condition = "mild";
          if (weatherCode <= 3) condition = "clear";
          else if (weatherCode <= 48) condition = "cloudy";
          else if (weatherCode <= 67) condition = "rainy";
          else if (weatherCode <= 77) condition = "snowy";
          else condition = "stormy";
          
          // Get location name using reverse geocoding
          let locationName = "Your area";
          try {
            const geoResponse = await fetch(
              `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1`
            );
            const geoData = await geoResponse.json();
            if (geoData.results && geoData.results.length > 0) {
              locationName = geoData.results[0].name || geoData.results[0].admin1 || "Your area";
            }
          } catch {
            // Keep default location name
          }
          
          setWeather({
            temperature: temp,
            condition,
            location: locationName,
          });
        }
      }
    } catch (error: unknown) {
      // Fallback - don't show weather if we can't get it
      setWeather(null);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleOccasionSelect = async (occasionId: string) => {
    setSelectedOccasion(occasionId);
    setStep("loading");
    
    // Get context-aware fallback
    const filteredOutfits = getFilteredOutfits(occasionId, weather?.temperature ?? null);
    const randomIndex = Math.floor(Math.random() * filteredOutfits.length);
    outfitIndexRef.current = randomIndex;
    const fallbackOutfit = filteredOutfits[randomIndex];

    try {
      const data = await apiService.post<{ id?: string; recommendation?: string; reasoning?: string; stylistName?: string }>("/api/onboarding/quick-recommendation", {
        occasion: occasionId,
        weather: weather,
        region: weather?.location || "UK",
        styleExpression: expressionText.trim() || undefined,
      });

      if (data && data.recommendation) {
        setRecommendation({
          id: data.id,
          outfit: data.recommendation,
          reasoning: data.reasoning || "This look balances comfort with style, perfect for your occasion.",
          stylistName: data.stylistName || "Ruby",
        });
      } else {
        setRecommendation({
          outfit: fallbackOutfit.outfit,
          reasoning: fallbackOutfit.reasoning,
          stylistName: "Ruby",
        });
      }
      setStep("result");
      incrementRecommendationCount();
    } catch (error: unknown) {
      setRecommendation({
        outfit: fallbackOutfit.outfit,
        reasoning: fallbackOutfit.reasoning,
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
    setIsLoadingAnotherOption(true);
    await recordInteraction("another_option");
    
    // Get filtered outfits based on occasion and weather
    const filteredOutfits = getFilteredOutfits(selectedOccasion, weather?.temperature ?? null);
    
    // Cycle to next outfit within filtered set
    outfitIndexRef.current = (outfitIndexRef.current + 1) % filteredOutfits.length;
    const nextOutfit = filteredOutfits[outfitIndexRef.current];
    
    // Brief delay for visual feedback
    setTimeout(() => {
      setRecommendation({
        outfit: nextOutfit.outfit,
        reasoning: nextOutfit.reasoning,
        stylistName: "Ruby",
      });
      setIsLoadingAnotherOption(false);
      incrementRecommendationCount();
    }, 400);
  };

  const handleSecondOpinion = async () => {
    await recordInteraction("second_opinion");
    navigation.navigate("SoftSignupGate", { fromPath: "second_opinion" });
  };

  const [isSubmittingExpression, setIsSubmittingExpression] = useState(false);
  
  const handleExpressionSubmit = async () => {
    if (expressionText.trim() && !isSubmittingExpression) {
      setIsSubmittingExpression(true);
      const userExpression = expressionText.trim();
      
      try {
        await styleDirectionService.recordStyleExpression(userExpression);
        await recordInteraction("style_expression", userExpression);
        
        // Generate a tailored response based on user's expression
        const tailoredRecommendation = generateTailoredRecommendation(userExpression, selectedOccasion || "work");
        
        setRecommendation({
          outfit: tailoredRecommendation.outfit,
          reasoning: tailoredRecommendation.reasoning,
          stylistName: "Ruby",
        });
        
        setExpressionText("");
      } catch (error) {
        console.log("Failed to submit expression");
      } finally {
        setIsSubmittingExpression(false);
      }
    }
  };
  
  const generateTailoredRecommendation = (expression: string, occasion: string): { outfit: string; reasoning: string } => {
    const expressionLower = expression.toLowerCase();
    
    // Finance/formal work context
    if (expressionLower.includes("finance") || expressionLower.includes("bank") || expressionLower.includes("suit") || expressionLower.includes("formal")) {
      return {
        outfit: "A well-fitted navy or charcoal suit with a crisp white shirt, silk tie in a subtle pattern, and polished Oxford shoes. Add a quality leather belt to complete the look.",
        reasoning: "For finance, precision matters. This classic combination commands respect while staying professionally appropriate.",
      };
    }
    
    // Casual preferences
    if (expressionLower.includes("casual") || expressionLower.includes("jeans") || expressionLower.includes("comfortable")) {
      return {
        outfit: "Dark slim-fit jeans with a well-fitted jumper in a neutral tone. Add clean white trainers and a quality watch for polish.",
        reasoning: "Casual doesn't mean sloppy. This look is relaxed but intentional.",
      };
    }
    
    // Creative/relaxed work
    if (expressionLower.includes("creative") || expressionLower.includes("startup") || expressionLower.includes("tech")) {
      return {
        outfit: "Smart chinos with a quality fitted t-shirt and a structured blazer. Clean minimalist trainers tie it together.",
        reasoning: "Modern workplaces value authenticity. This says capable without being corporate.",
      };
    }
    
    // Default tailored response
    return {
      outfit: "Tailored trousers with a quality shirt in a flattering colour for you. Add appropriate footwear for your environment and a confidence-boosting accessory.",
      reasoning: `I've noted your preferences. This adapts to what you've told me: "${expression.slice(0, 50)}${expression.length > 50 ? "..." : ""}"`,
    };
  };

  const handlePersonalise = () => {
    navigation.navigate("StyleMeProperly");
  };

  const handleJustBrowsing = () => {
    navigation.navigate("OnboardingEntry");
  };

  const renderOccasionStep = () => {
    const options = firstMessages?.options || [
      { id: "work", label: "Work" },
      { id: "date", label: "Date" },
      { id: "casual", label: "Casual" },
      { id: "event", label: "Event" },
      { id: "browsing", label: "Just browsing" },
    ];
    const message = firstMessages?.message || "Tell me what you're dressing for — I'll decide the outfit.";

    return (
      <Animated.View entering={FadeIn} style={styles.stepContainer}>
        <View style={styles.stylistMessage}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.link }]}>
            <Feather name="message-circle" size={20} color="#FFFFFF" />
          </View>
          <View style={[styles.messageBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="body" style={[styles.messageText, { color: theme.text }]}>
              {message}
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
          {options.map((option, index) => (
            <Animated.View 
              key={option.id} 
              entering={FadeInUp.delay(100 + index * 50)}
              style={styles.optionWrapper}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.optionCard,
                  { 
                    backgroundColor: selectedOccasion === option.id ? theme.link : theme.backgroundSecondary,
                    opacity: pressed ? 0.9 : 1,
                  }
                ]}
                onPress={() => handleOccasionSelect(option.id)}
              >
                <Feather 
                  name={OCCASION_ICONS[option.id] || "circle"} 
                  size={24} 
                  color={selectedOccasion === option.id ? "#FFFFFF" : theme.text} 
                />
                <ThemedText 
                  type="body" 
                  style={[
                    styles.optionLabel,
                    { color: selectedOccasion === option.id ? "#FFFFFF" : theme.text }
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    );
  };

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

      <ThemedText type="small" style={[styles.disclaimerText, { color: theme.tabIconDefault }]}>
        I'm choosing generally. With your wardrobe, I'd choose specifically.
      </ThemedText>

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
          style={[
            styles.actionButton, 
            { 
              backgroundColor: isLoadingAnotherOption ? theme.link : theme.backgroundSecondary, 
              borderColor: isLoadingAnotherOption ? theme.link : theme.border, 
              borderWidth: 1,
              opacity: isLoadingAnotherOption ? 0.8 : 1,
            }
          ]}
          onPress={handleAnotherOption}
          disabled={isLoadingAnotherOption}
        >
          <Feather 
            name="refresh-cw" 
            size={18} 
            color={isLoadingAnotherOption ? "#FFFFFF" : theme.text} 
            style={isLoadingAnotherOption ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
          <ThemedText type="body" style={[styles.actionButtonText, { color: isLoadingAnotherOption ? "#FFFFFF" : theme.text }]}>
            {isLoadingAnotherOption ? "Loading..." : "Another option"}
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

      <Animated.View entering={FadeInDown.delay(300)} style={styles.calibrationSection}>
        <ThemedText type="body" style={[styles.calibrationMessage, { color: theme.tabIconDefault }]}>
          {styleDirectionService.getCalibrationMessage()}
        </ThemedText>
        <View style={[styles.expressionInputContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <TextInput
            style={[styles.expressionInput, { color: theme.text, minHeight: 44, maxHeight: 120 }]}
            placeholder={styleDirectionService.getExpressionPlaceholder()}
            placeholderTextColor={theme.tabIconDefault}
            value={expressionText}
            onChangeText={(text) => setExpressionText(text.slice(0, MAX_EXPRESSION_LENGTH))}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleExpressionSubmit}
            multiline={true}
            textAlignVertical="top"
            maxLength={MAX_EXPRESSION_LENGTH}
          />
          {expressionText.trim() ? (
            <Pressable 
              onPress={handleExpressionSubmit} 
              style={styles.expressionSendButton}
              disabled={isSubmittingExpression}
            >
              <Feather name="send" size={18} color={isSubmittingExpression ? theme.tabIconDefault : theme.link} />
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
  disclaimerText: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    fontStyle: "italic",
    textAlign: "center",
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
  calibrationSection: {
    marginBottom: Spacing.lg,
  },
  calibrationMessage: {
    fontSize: 15,
    fontStyle: "italic",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  expressionInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  expressionInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  expressionSendButton: {
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
  styleChipsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  styleChipsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  styleChipsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  dismissButton: {
    padding: Spacing.xs,
  },
  styleChipsSubtitle: {
    marginBottom: Spacing.lg,
  },
  styleChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  styleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
