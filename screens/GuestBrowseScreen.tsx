import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiService } from "@/services/ApiService";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";
import { useVoiceSettings } from "@/contexts/VoiceSettingsContext";
import { onboardingProfileService } from "@/services/OnboardingProfileService";
import {
  getStylistSpeakTranslator,
  resolveStylistSpeakLanguage,
} from "@/utils/stylistLanguage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GUEST_TOKEN_KEY = "@dripn_guest_token";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "GuestBrowse">;

interface GuestStylist {
  id: string;
  name: string;
  personality: string;
  greeting: string;
  avatar: string;
}

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string;
  isPlaceholder?: boolean;
  showVisualizeButton?: boolean;
  isGeneratingImage?: boolean;
  outfitContext?: string;
  /** Inline error under the bubble when visualize fails or limit is hit */
  visualError?: string;
}

const GUEST_VISUAL_LIMIT = 3;
const GUEST_VISUAL_LIMIT_MSG =
  "You've used your free outfit visuals for this guest session. Sign up to unlock unlimited looks.";
const GUEST_VISUAL_FAIL_MSG =
  "Couldn't create that outfit visual. Tap retry to try again.";

function isRenderableHttpsImageUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

const DEFAULT_STYLISTS: GuestStylist[] = [
  { id: "ruby", name: "Ruby", personality: "Bold & glamorous", greeting: "Hey there! Ready to make a statement?", avatar: "" },
  { id: "max", name: "Max", personality: "Clean & minimal", greeting: "Less is more. Let's find your perfect look.", avatar: "" },
  { id: "ace", name: "Ace", personality: "Street-smart", greeting: "What's good! Let's get you styled up.", avatar: "" },
  { id: "ivy", name: "Ivy", personality: "Eco-conscious", greeting: "Sustainable style starts here!", avatar: "" },
];

const STYLIST_COLORS: Record<string, { primary: string; secondary: string }> = {
  ruby: { primary: "#EC4899", secondary: "#4A1942" },
  max: { primary: "#64748B", secondary: "#1E293B" },
  ace: { primary: "#F59E0B", secondary: "#78350F" },
  ivy: { primary: "#22C55E", secondary: "#14532D" },
};

const STYLIST_DESCRIPTIONS: Record<string, { tagline: string; description: string }> = {
  ruby: { 
    tagline: "Bold & Glamorous",
    description: "Warm, encouraging, and genuinely excited about helping you look and feel amazing"
  },
  max: { 
    tagline: "Clean & Minimal", 
    description: "Sophisticated, knowledgeable, and refreshingly honest with timeless style advice"
  },
  ace: { 
    tagline: "Street-Smart Style",
    description: "Calm, confident, and direct - making the call so you don't have to"
  },
  ivy: { 
    tagline: "Eco-Conscious Fashion",
    description: "Thoughtful and creative with a focus on sustainable, mindful style choices"
  },
};

const STYLIST_GREETINGS: Record<string, string> = {
  ruby: "Hey gorgeous! I'm Ruby, and I'm so excited to help you look absolutely amazing today. What are we styling you for?",
  max: "Hey there. I'm Max - let's cut to the chase and find you something that actually works. What's the occasion?",
  ace: "Yo, what's good! I'm Ace. Let's get you looking fresh. What vibe are we going for today?",
  ivy: "Hi there! I'm Ivy. Let's find you something stylish and sustainable. What look are you going for?",
};

export default function GuestBrowseScreen({ navigation }: { navigation: NavigationProp }) {
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const { settings: voiceSettings } = useVoiceSettings();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [stylists, setStylists] = useState<GuestStylist[]>(DEFAULT_STYLISTS);
  const [selectedStylist, setSelectedStylist] = useState<GuestStylist | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messagesRemaining, setMessagesRemaining] = useState(5);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [signupPrompt, setSignupPrompt] = useState<string | null>(null);
  const [userGender, setUserGender] = useState<string | null>(null);
  const [imageGenUsed, setImageGenUsed] = useState(0);
  const lastOutfitContextRef = useRef<string | null>(null);

  const stylistSpeakCode = resolveStylistSpeakLanguage({
    preferredLanguageCode: voiceSettings.preferredLanguage,
    uiLanguageCode: currentLanguage,
  });
  const stylistT = getStylistSpeakTranslator(stylistSpeakCode);

  useEffect(() => {
    initializeGuestSession();
    void onboardingProfileService.getProfile().then((profile) => {
      if (profile.quizGender) setUserGender(profile.quizGender);
    });
  }, []);

  const initializeGuestSession = async () => {
    setIsLoading(true);
    try {
      const cachedToken = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
      
      if (cachedToken) {
        try {
          const status = await apiService.getGuestStatus(cachedToken) as any;
          setSessionToken(cachedToken);
          const remaining = status?.session?.messagesRemaining ?? status?.messagesRemaining ?? 5;
          setMessagesRemaining(remaining);
          await loadStylists(cachedToken);
          setIsLoading(false);
          return;
        } catch (e) {
          await AsyncStorage.removeItem(GUEST_TOKEN_KEY);
        }
      }

      const session = await apiService.createGuestSession();
      await AsyncStorage.setItem(GUEST_TOKEN_KEY, session.sessionToken);
      setSessionToken(session.sessionToken);
      await loadStylists(session.sessionToken);
    } catch (error) {
      console.log("Failed to create guest session:", error);
      setStylists(DEFAULT_STYLISTS);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStylists = async (token: string) => {
    try {
      const response = await apiService.getGuestStylists(token);
      if (response.stylists?.length) {
        setStylists(response.stylists);
      }
    } catch (error) {
      console.log("Failed to load stylists:", error);
    }
  };

  const handleSelectStylist = (stylist: GuestStylist) => {
    setSelectedStylist(stylist);
    const greeting =
      stylistT(`guestBrowse.greeting.${stylist.id}`)
      || t(`guestBrowse.greeting.${stylist.id}`)
      || STYLIST_GREETINGS[stylist.id]
      || `Hi! I'm ${stylist.name}. What can I help you with today?`;
    setMessages([{
      id: "greeting",
      content: greeting,
      isUser: false,
      timestamp: new Date(),
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedStylist || isSending) return;

    // If session isn't ready yet, try to re-initialise it before giving up
    let activeToken = sessionToken;
    if (!activeToken) {
      setIsSending(true);
      try {
        const session = await apiService.createGuestSession() as any;
        activeToken = session.sessionToken ?? null;
        if (activeToken) {
          await AsyncStorage.setItem(GUEST_TOKEN_KEY, activeToken);
          setSessionToken(activeToken);
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          content: "Couldn't connect to your stylist. Please check your connection and try again.",
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsSending(false);
        return;
      }
    }

    if (!activeToken) {
      setIsSending(false);
      return;
    }

    const userText = inputText.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: userText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsSending(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const rawResponse = await apiService.guestChat(
        activeToken,
        userText,
        selectedStylist.id,
        conversationHistory,
        {
          language: stylistSpeakCode,
          gender: userGender,
        },
      ) as any;

      let aiContent = rawResponse?.response || rawResponse?.message || rawResponse?.text || "I'm here to help with your style!";
      // Replace ### headings with ► so renderer can bold them; strip other markdown
      aiContent = aiContent.replace(/^#{1,6}\s+(.+)/gm, '►$1').replace(/\*\*/g, '').replace(/\*/g, '');
      // Collapse runaway blank lines that inflate message bubbles
      aiContent = aiContent.replace(/\n{3,}/g, '\n\n').trim();

      // Track gender for image generation context
      const lowerUserText = userText.toLowerCase();
      if (!userGender) {
        if (/\b(male|man|guy|he|him|bloke|lad)\b/.test(lowerUserText)) setUserGender('male');
        else if (/\b(female|woman|girl|she|her|lady)\b/.test(lowerUserText)) setUserGender('female');
      }

      const outfitContext = (
        rawResponse?.outfitVisualSuggestion?.outfitDescription
        || aiContent.replace(/►/g, '').substring(0, 400)
      ).trim();
      if (rawResponse?.hasOutfitRecommendation === true && outfitContext) {
        lastOutfitContextRef.current = outfitContext;
      }

      const askedForVisual = /\b(visual|visualize|picture|photo|image|show me|see (it|the|that)|render)\b/i.test(userText);
      const canGenerateImage = imageGenUsed < GUEST_VISUAL_LIMIT;
      // Prefer auto-visualize whenever the server flags an outfit recommendation
      const shouldVisualize = canGenerateImage && (
        rawResponse?.hasOutfitRecommendation === true
        || (askedForVisual && Boolean(lastOutfitContextRef.current || outfitContext))
      );
      const showVisualizeButton = canGenerateImage && (
        rawResponse?.hasOutfitRecommendation === true
        || askedForVisual
      );
      const visualContext = (
        askedForVisual
          ? (lastOutfitContextRef.current || outfitContext)
          : outfitContext
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiContent,
        isUser: false,
        timestamp: new Date(),
        showVisualizeButton: showVisualizeButton && !shouldVisualize,
        outfitContext: visualContext,
        isGeneratingImage: shouldVisualize,
        visualError: (!canGenerateImage && (rawResponse?.hasOutfitRecommendation === true || askedForVisual))
          ? GUEST_VISUAL_LIMIT_MSG
          : undefined,
      };

      setMessages(prev => [...prev, aiMessage]);
      if (shouldVisualize && visualContext) {
        void handleGenerateOutfitImage(aiMessage.id, visualContext, activeToken);
      } else if (askedForVisual && !canGenerateImage) {
        // Limit message already attached via visualError on the AI bubble
      }

      const remaining = rawResponse?.remainingMessages ?? messagesRemaining - 1;
      setMessagesRemaining(remaining);

      if (rawResponse?.limitReached === true || remaining <= 0) {
        setShowLimitReached(true);
        if (rawResponse?.signupPrompt) {
          setSignupPrompt(rawResponse.signupPrompt);
        }
      }
    } catch (error: any) {
      console.log("Guest chat error:", error?.message || error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "Something went wrong. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSignUp = () => {
    navigation.navigate("Auth", { mode: "signup" });
  };

  const handleGenerateOutfitImage = async (
    messageId: string,
    outfitContext: string,
    tokenOverride?: string | null,
  ) => {
    const activeToken = tokenOverride || sessionToken;
    if (!activeToken || !selectedStylist) return;

    if (imageGenUsed >= GUEST_VISUAL_LIMIT) {
      setMessages(prev => prev.map(m => m.id === messageId
        ? {
            ...m,
            isGeneratingImage: false,
            showVisualizeButton: false,
            imageUrl: undefined,
            visualError: GUEST_VISUAL_LIMIT_MSG,
          }
        : m));
      return;
    }

    lastOutfitContextRef.current = outfitContext;
    setMessages(prev => prev.map(m => m.id === messageId
      ? {
          ...m,
          isGeneratingImage: true,
          showVisualizeButton: false,
          visualError: undefined,
        }
      : m));
    try {
      const result = await apiService.guestGenerateOutfitImage(
        activeToken,
        outfitContext,
        "smart casual",
        selectedStylist.id,
        userGender,
      ) as any;

      if (result?.limitReached === true) {
        setImageGenUsed(GUEST_VISUAL_LIMIT);
        setMessages(prev => prev.map(m => m.id === messageId
          ? {
              ...m,
              isGeneratingImage: false,
              showVisualizeButton: false,
              imageUrl: undefined,
              isPlaceholder: false,
              visualError: (typeof result.message === 'string' && result.message)
                || GUEST_VISUAL_LIMIT_MSG,
            }
          : m));
        return;
      }

      const rawUrl = result?.imageUrl;
      const hasRealImage =
        result?.success === true
        && isRenderableHttpsImageUrl(rawUrl)
        && result?.isPlaceholder !== true;

      if (hasRealImage) {
        setImageGenUsed((used) => Math.min(GUEST_VISUAL_LIMIT, used + 1));
        setMessages(prev => prev.map(m => m.id === messageId
          ? {
              ...m,
              isGeneratingImage: false,
              showVisualizeButton: false,
              imageUrl: rawUrl,
              isPlaceholder: false,
              visualError: undefined,
            }
          : m));
        return;
      }

      // Placeholder / invalid URL / soft failure — never render a blank box
      const failMsg =
        (typeof result?.message === 'string' && result.message)
        || (result?.isPlaceholder === true
          ? 'Outfit visuals are temporarily unavailable. Tap retry to try again.'
          : GUEST_VISUAL_FAIL_MSG);
      const canRetry = imageGenUsed < GUEST_VISUAL_LIMIT && result?.limitReached !== true;
      setMessages(prev => prev.map(m => m.id === messageId
        ? {
            ...m,
            isGeneratingImage: false,
            showVisualizeButton: canRetry,
            imageUrl: undefined,
            isPlaceholder: result?.isPlaceholder === true,
            visualError: failMsg,
          }
        : m));
    } catch (error: any) {
      const failMsg =
        (typeof error?.message === 'string' && error.message && !/^HTTP\s*\d+/i.test(error.message))
          ? error.message
          : GUEST_VISUAL_FAIL_MSG;
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              isGeneratingImage: false,
              showVisualizeButton: imageGenUsed < GUEST_VISUAL_LIMIT,
              imageUrl: undefined,
              visualError: failMsg,
            }
          : m
      ));
    }
  };

  const handleBack = () => {
    if (selectedStylist) {
      setSelectedStylist(null);
      setMessages([]);
    } else {
      navigation.goBack();
    }
  };

  const renderStylistCard = ({ item }: { item: GuestStylist }) => {
    const colors = STYLIST_COLORS[item.id] || { primary: "#6B7280", secondary: "#374151" };
    
    return (
      <Animated.View entering={FadeInUp.delay(DEFAULT_STYLISTS.findIndex(s => s.id === item.id) * 100)}>
        <Pressable
          onPress={() => handleSelectStylist(item)}
          style={({ pressed }) => [
            styles.stylistCard,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.primary,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <View style={[styles.stylistAvatar, { backgroundColor: colors.primary + "30" }]}>
            <ThemedText type="h2" style={{ color: colors.primary }}>
              {item.name.charAt(0)}
            </ThemedText>
          </View>
          <View style={styles.stylistInfo}>
            <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
              {item.name}
            </ThemedText>
            <ThemedText type="small" style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", marginBottom: 4 }}>
              {STYLIST_DESCRIPTIONS[item.id]?.tagline || item.personality}
            </ThemedText>
            <ThemedText type="small" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 18 }}>
              {STYLIST_DESCRIPTIONS[item.id]?.description}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </Animated.View>
    );
  };

  // Helper to parse markdown bold text
  const renderMarkdownText = (text: string, textColor: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={index} style={{ fontWeight: '700', color: textColor }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return (
        <Text key={index} style={{ color: textColor }}>
          {part}
        </Text>
      );
    });
  };

  const renderFormattedContent = (text: string, textColor: string) => {
    const lines = text.split('\n');
    // Drop leading/trailing empties and collapse consecutive blank lines
    const compacted: string[] = [];
    for (const line of lines) {
      if (line.trim() === '') {
        if (compacted.length === 0) continue;
        if (compacted[compacted.length - 1] === '') continue;
        compacted.push('');
      } else {
        compacted.push(line);
      }
    }
    while (compacted.length && compacted[compacted.length - 1] === '') compacted.pop();

    return (
      <View>
        {compacted.map((line, i) => {
          if (line.startsWith('►')) {
            return (
              <Text key={i} style={{ fontWeight: '700', fontSize: 15, color: textColor, marginTop: i > 0 ? 8 : 0, marginBottom: 2 }}>
                {line.substring(1)}
              </Text>
            );
          }
          if (line.trim() === '') {
            return <View key={i} style={{ height: 6 }} />;
          }
          return (
            <Text key={i} style={{ fontSize: 15, color: textColor, lineHeight: 22 }}>
              {renderMarkdownText(line, textColor)}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const colors = selectedStylist ? STYLIST_COLORS[selectedStylist.id] : { primary: "#6B7280", secondary: "#374151" };
    const hasValidImage = isRenderableHttpsImageUrl(item.imageUrl) && item.isPlaceholder !== true;
    
    return (
      <View style={[styles.messageRow, item.isUser ? styles.userRow : styles.aiRow]}>
        <View
          style={[
            styles.messageBubble,
            item.isUser
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: theme.backgroundSecondary, borderBottomLeftRadius: 4 },
          ]}
        >
          {renderFormattedContent(item.content, item.isUser ? "#FFFFFF" : theme.text)}

          {item.isGeneratingImage && !hasValidImage && (
            <View style={styles.imageLoadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: theme.textSecondary || theme.text, fontSize: 12, marginLeft: 8, opacity: 0.7 }}>
                Creating outfit visual…
              </Text>
            </View>
          )}

          {hasValidImage && (
            <View style={styles.outfitImageContainer}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.outfitImage}
                resizeMode="cover"
                onError={() => {
                  setMessages(prev => prev.map(m =>
                    m.id === item.id
                      ? {
                          ...m,
                          imageUrl: undefined,
                          showVisualizeButton: imageGenUsed < GUEST_VISUAL_LIMIT,
                          visualError: GUEST_VISUAL_FAIL_MSG,
                        }
                      : m
                  ));
                }}
              />
            </View>
          )}

          {!hasValidImage && !item.isGeneratingImage && !!item.visualError && (
            <Text style={{
              color: theme.textSecondary || theme.text,
              fontSize: 12,
              marginTop: 8,
              opacity: 0.85,
              lineHeight: 17,
            }}>
              {item.visualError}
            </Text>
          )}

          {!hasValidImage && !item.isGeneratingImage && item.showVisualizeButton && (
            <Pressable
              onPress={() => handleGenerateOutfitImage(item.id, item.outfitContext || item.content)}
              disabled={item.isGeneratingImage}
              style={[styles.visualizeButton, { backgroundColor: colors.primary }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="image" size={14} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                  {item.visualError ? 'Retry visual' : 'Visualize this outfit'}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const gradientColors = isDark 
    ? ["#1A1A2E", "#16213E"] as const 
    : ["#F5F0EB", "#E8E0D8"] as const;

  if (isLoading) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
            Setting up your session...
          </ThemedText>
        </View>
      </LinearGradient>
    );
  }

  if (!selectedStylist) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <Pressable 
          onPress={handleBack} 
          style={[styles.backButtonAbsolute, { top: insets.top + Spacing.md }]}
        >
          <View style={styles.backButtonInner}>
            <Feather name="arrow-left" size={20} color={theme.text} />
          </View>
        </Pressable>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <View style={{ width: 40 }} />
          <View style={styles.headerCenter}>
            <ThemedText type="h2">Try Dripn</ThemedText>
            <ThemedText type="small" style={{ opacity: 0.7, marginTop: 2 }}>
              {messagesRemaining ?? 5} free messages remaining
            </ThemedText>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeIn} style={styles.introSection}>
            <ThemedText type="h3" style={{ textAlign: "center", marginBottom: Spacing.sm }}>
              Choose Your Stylist
            </ThemedText>
            <ThemedText type="body" style={{ textAlign: "center", opacity: 0.7 }}>
              Each stylist has their own unique personality and approach to fashion
            </ThemedText>
          </Animated.View>

          <FlatList
            data={stylists}
            renderItem={renderStylistCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.stylistList}
            showsVerticalScrollIndicator={false}
          />

          <View style={[styles.signupPrompt, { marginBottom: insets.bottom + Spacing.sm }]}>
            <ThemedText type="small" style={{ opacity: 0.7, textAlign: "center" }}>
              Want unlimited access, voice chat, and a personalized wardrobe?
            </ThemedText>
            <Pressable
              onPress={handleSignUp}
              style={({ pressed }) => [
                styles.signupButton,
                {
                  backgroundColor: pressed ? LuxuryColors.deepGold : LuxuryColors.gold,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("auth.createAccount") || "Create Account"}
            >
              <ThemedText type="body" style={styles.signupButtonText}>
                {t("auth.createAccount") || "Create Account"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    );
  }

  const stylistColors = STYLIST_COLORS[selectedStylist.id];

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="h3">{selectedStylist.name}</ThemedText>
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            {messagesRemaining ?? 5} messages left
          </ThemedText>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messageList, { paddingBottom: Spacing.lg }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={isSending ? (
            <View style={[styles.messageRow, styles.aiRow]}>
              <View style={[styles.typingIndicator, { backgroundColor: theme.backgroundSecondary }]}>
                <ActivityIndicator size="small" color={stylistColors.primary} style={{ marginRight: Spacing.sm }} />
                <ThemedText type="body" style={{ color: theme.text, fontStyle: 'italic' }}>
                  {selectedStylist.name} is styling...
                </ThemedText>
              </View>
            </View>
          ) : null}
        />

        {showLimitReached ? (
          <View style={[styles.limitReachedContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={[styles.limitReachedCard, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="lock" size={32} color={theme.link} />
              <ThemedText type="h3" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                You've used all your free messages
              </ThemedText>
              <ThemedText type="body" style={{ marginTop: Spacing.sm, textAlign: "center", opacity: 0.7 }}>
                {signupPrompt || "Sign up to continue chatting and unlock all features!"}
              </ThemedText>
              <Pressable
                onPress={handleSignUp}
                style={({ pressed }) => [
                  styles.unlockButton,
                  {
                    backgroundColor: pressed ? LuxuryColors.deepGold : LuxuryColors.gold,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("auth.createAccount") || "Create Account"}
              >
                <ThemedText type="body" style={styles.signupButtonText}>
                  {t("auth.createAccount") || "Create Account"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder={t('guest.askAboutAnOutfit') || "Ask about an outfit..."}
                placeholderTextColor={theme.tabIconDefault}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSendMessage}
                editable={!isSending}
                multiline
                maxLength={500}
                textAlignVertical="center"
              />
              <Pressable
                onPress={handleSendMessage}
                disabled={!inputText.trim() || isSending}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() ? stylistColors.primary : "transparent",
                    opacity: inputText.trim() && !isSending ? 1 : 0.5,
                  },
                ]}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={inputText.trim() ? "#FFFFFF" : theme.tabIconDefault} />
                ) : (
                  <Feather name="send" size={18} color={inputText.trim() ? "#FFFFFF" : theme.tabIconDefault} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonAbsolute: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(128,128,128,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  introSection: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  stylistList: {
    paddingHorizontal: Spacing.lg,
  },
  stylistCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
  stylistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  stylistInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    paddingRight: Spacing.sm,
  },
  signupPrompt: {
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  signupButton: {
    marginTop: Spacing.md,
    alignSelf: "stretch",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  signupButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  messageRow: {
    marginBottom: Spacing.md,
  },
  userRow: {
    alignItems: "flex-end",
  },
  aiRow: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
  },
  outfitImageContainer: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  outfitImage: {
    width: "100%",
    height: 260,
    borderRadius: BorderRadius.md,
  },
  imageLoadingRow: {
    marginTop: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
  },
  visualizeButton: {
    marginTop: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  limitReachedContainer: {
    padding: Spacing.lg,
  },
  limitReachedCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  unlockButton: {
    marginTop: Spacing.lg,
    alignSelf: "stretch",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
});
