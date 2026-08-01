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
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/ThemedText";
import { ZoomableWardrobeImage } from "@/components/ZoomableWardrobeImage";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiService } from "@/services/ApiService";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";
import { useVoiceSettings } from "@/contexts/VoiceSettingsContext";
import { onboardingProfileService } from "@/services/OnboardingProfileService";
import {
  GUEST_TOKEN_KEY,
  clearGuestChatMap,
  hydrateChatMap,
  loadGuestChatMap,
  saveGuestChatMap,
  toStoredChatMap,
  type GuestStoredMessage,
} from "@/services/GuestChatStorage";
import {
  getStylistSpeakTranslator,
  resolveStylistSpeakLanguage,
} from "@/utils/stylistLanguage";
import { OutfitTasteFeedback } from "@/components/outfit/OutfitTasteFeedback";
import { recordStylistOutfitFeedback } from "@/utils/outfitFeedbackBrain";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "GuestBrowse">;

interface GuestStylist {
  id: string;
  name: string;
  personality: string;
  greeting: string;
  avatar: string;
}

type OutfitPiece = { role: string; garment?: string; descriptor: string };

interface OutfitVisualContext {
  description: string;
  pieces?: OutfitPiece[];
  occasion?: string | null;
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
  outfitPieces?: OutfitPiece[];
  outfitOccasion?: string | null;
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
  /** Per-stylist threads for this guest session (survives stylist switches). */
  const messagesByStylistRef = useRef<Record<string, ChatMessage[]>>({});
  const sessionTokenRef = useRef<string | null>(null);

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
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const lastOutfitVisualRef = useRef<OutfitVisualContext | null>(null);

  const persistGuestChats = async (token?: string | null) => {
    const active = token ?? sessionTokenRef.current;
    if (!active) return;
    await saveGuestChatMap(active, toStoredChatMap(messagesByStylistRef.current));
  };

  const storedToChatMessages = (stored: GuestStoredMessage[]): ChatMessage[] =>
    stored.map((m) => ({
      id: m.id,
      content: m.content,
      isUser: m.isUser,
      timestamp: new Date(m.timestamp || Date.now()),
      imageUrl: m.imageUrl,
      outfitContext: m.outfitContext,
      outfitOccasion: m.outfitOccasion,
      showVisualizeButton: false,
      isGeneratingImage: false,
    }));

  const setMessagesForStylist = (
    stylistId: string,
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => {
    setMessages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      messagesByStylistRef.current = {
        ...messagesByStylistRef.current,
        [stylistId]: next,
      };
      void persistGuestChats();
      return next;
    });
  };

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

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    if (!selectedStylist || messages.length === 0) return;
    const t = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedStylist?.id]);

  const hydrateThreadsForToken = async (token: string) => {
    const stored = await loadGuestChatMap(token);
    const hydrated = hydrateChatMap(stored);
    const next: Record<string, ChatMessage[]> = {};
    for (const [stylistId, msgs] of Object.entries(hydrated)) {
      next[stylistId] = storedToChatMessages(msgs);
    }
    messagesByStylistRef.current = next;
  };

  const initializeGuestSession = async () => {
    setIsLoading(true);
    try {
      const cachedToken = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
      
      if (cachedToken) {
        try {
          const status = await apiService.getGuestStatus(cachedToken) as any;
          setSessionToken(cachedToken);
          sessionTokenRef.current = cachedToken;
          const remaining = status?.session?.messagesRemaining ?? status?.messagesRemaining ?? 5;
          setMessagesRemaining(remaining);
          await hydrateThreadsForToken(cachedToken);
          await loadStylists(cachedToken);
          setIsLoading(false);
          return;
        } catch (e) {
          await clearGuestChatMap(cachedToken);
          await AsyncStorage.removeItem(GUEST_TOKEN_KEY);
          messagesByStylistRef.current = {};
        }
      }

      const session = await apiService.createGuestSession();
      await AsyncStorage.setItem(GUEST_TOKEN_KEY, session.sessionToken);
      setSessionToken(session.sessionToken);
      sessionTokenRef.current = session.sessionToken;
      messagesByStylistRef.current = {};
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

  const buildGreetingMessage = (stylist: GuestStylist): ChatMessage => {
    const greeting =
      stylistT(`guestBrowse.greeting.${stylist.id}`)
      || t(`guestBrowse.greeting.${stylist.id}`)
      || STYLIST_GREETINGS[stylist.id]
      || `Hi! I'm ${stylist.name}. What can I help you with today?`;
    return {
      id: "greeting",
      content: greeting,
      isUser: false,
      timestamp: new Date(),
    };
  };

  const handleSelectStylist = (stylist: GuestStylist) => {
    setSelectedStylist(stylist);
    const existing = messagesByStylistRef.current[stylist.id];
    if (existing && existing.length > 0) {
      setMessages(existing);
      return;
    }
    const greetingMessage = buildGreetingMessage(stylist);
    messagesByStylistRef.current = {
      ...messagesByStylistRef.current,
      [stylist.id]: [greetingMessage],
    };
    setMessages([greetingMessage]);
    void persistGuestChats();
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
        if (selectedStylist) {
          setMessagesForStylist(selectedStylist.id, prev => [...prev, errorMessage]);
        } else {
          setMessages(prev => [...prev, errorMessage]);
        }
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

    const historyForApi = messages.map(msg => ({
      role: msg.isUser ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));

    setMessagesForStylist(selectedStylist.id, prev => [...prev, userMessage]);
    setInputText("");
    setIsSending(true);

    try {
      const conversationHistory = historyForApi;

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

      const suggestion = rawResponse?.outfitVisualSuggestion;
      const suggestionDescription =
        typeof suggestion?.outfitDescription === 'string'
          ? suggestion.outfitDescription.trim()
          : '';
      const suggestionPieces = Array.isArray(suggestion?.pieces)
        ? suggestion.pieces.filter((p: OutfitPiece) => p?.descriptor || p?.garment)
        : undefined;
      const suggestionOccasion =
        typeof suggestion?.occasion === 'string' ? suggestion.occasion : null;

      // Prefer structured outfitVisualSuggestion — never feed loose chat prose to SDXL
      const outfitContext = (
        suggestionDescription
        || lastOutfitVisualRef.current?.description
        || ''
      ).trim();

      if (rawResponse?.hasOutfitRecommendation === true && outfitContext) {
        lastOutfitVisualRef.current = {
          description: outfitContext,
          pieces: suggestionPieces?.length
            ? suggestionPieces
            : lastOutfitVisualRef.current?.pieces,
          occasion: suggestionOccasion ?? lastOutfitVisualRef.current?.occasion ?? null,
        };
      }

      const askedForVisual = /\b(visual|visualize|picture|photo|image|show me|see (it|the|that)|render)\b/i.test(userText);
      const canGenerateImage = imageGenUsed < GUEST_VISUAL_LIMIT;
      // Prefer auto-visualize whenever the server flags an outfit recommendation
      const shouldVisualize = canGenerateImage && (
        rawResponse?.hasOutfitRecommendation === true
        || (askedForVisual && Boolean(lastOutfitVisualRef.current?.description || outfitContext))
      );
      const showVisualizeButton = canGenerateImage && (
        rawResponse?.hasOutfitRecommendation === true
        || askedForVisual
      );
      const visualContext = (
        askedForVisual
          ? (lastOutfitVisualRef.current?.description || outfitContext)
          : outfitContext
      );
      const visualPieces = (
        suggestionPieces?.length
          ? suggestionPieces
          : lastOutfitVisualRef.current?.pieces
      );
      const visualOccasion = suggestionOccasion ?? lastOutfitVisualRef.current?.occasion ?? null;

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiContent,
        isUser: false,
        timestamp: new Date(),
        showVisualizeButton: showVisualizeButton && !shouldVisualize,
        outfitContext: visualContext,
        outfitPieces: visualPieces,
        outfitOccasion: visualOccasion,
        isGeneratingImage: shouldVisualize,
        visualError: (!canGenerateImage && (rawResponse?.hasOutfitRecommendation === true || askedForVisual))
          ? GUEST_VISUAL_LIMIT_MSG
          : undefined,
      };

      setMessagesForStylist(selectedStylist.id, prev => [...prev, aiMessage]);
      if (shouldVisualize && visualContext) {
        void handleGenerateOutfitImage(
          aiMessage.id,
          visualContext,
          activeToken,
          { pieces: visualPieces, occasion: visualOccasion },
        );
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
      setMessagesForStylist(selectedStylist.id, prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSignUp = () => {
    void persistGuestChats();
    navigation.navigate("Auth", { mode: "signup" });
  };

  const handleGenerateOutfitImage = async (
    messageId: string,
    outfitContext: string,
    tokenOverride?: string | null,
    extras?: { pieces?: OutfitPiece[]; occasion?: string | null },
  ) => {
    const activeToken = tokenOverride || sessionToken;
    if (!activeToken || !selectedStylist) return;
    const stylistId = selectedStylist.id;

    if (imageGenUsed >= GUEST_VISUAL_LIMIT) {
      setMessagesForStylist(stylistId, prev => prev.map(m => m.id === messageId
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

    lastOutfitVisualRef.current = {
      description: outfitContext,
      pieces: extras?.pieces?.length ? extras.pieces : lastOutfitVisualRef.current?.pieces,
      occasion: extras?.occasion ?? lastOutfitVisualRef.current?.occasion ?? null,
    };
    setMessagesForStylist(stylistId, prev => prev.map(m => m.id === messageId
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
        stylistId,
        userGender,
        {
          pieces: extras?.pieces,
          occasion: extras?.occasion,
        },
      ) as any;

      if (result?.limitReached === true) {
        setImageGenUsed(GUEST_VISUAL_LIMIT);
        setMessagesForStylist(stylistId, prev => prev.map(m => m.id === messageId
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
        setMessagesForStylist(stylistId, prev => prev.map(m => m.id === messageId
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
      setMessagesForStylist(stylistId, prev => prev.map(m => m.id === messageId
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
      setMessagesForStylist(stylistId, prev => prev.map(m =>
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
      // Keep per-stylist map; only leave the chat view
      messagesByStylistRef.current = {
        ...messagesByStylistRef.current,
        [selectedStylist.id]: messages,
      };
      void persistGuestChats();
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
            <Pressable
              onPress={() => setViewerImageUrl(item.imageUrl!)}
              accessibilityRole="imagebutton"
              accessibilityLabel="View outfit image full screen"
              style={styles.outfitImageContainer}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.outfitImage}
                resizeMode="cover"
                onError={() => {
                  if (!selectedStylist) return;
                  setMessagesForStylist(selectedStylist.id, prev => prev.map(m =>
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
              <View style={styles.imageTapHint}>
                <Feather name="maximize-2" size={12} color="#FFFFFF" />
                <Text style={styles.imageTapHintText}>Tap to enlarge</Text>
              </View>
            </Pressable>
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
              onPress={() => handleGenerateOutfitImage(
                item.id,
                item.outfitContext || lastOutfitVisualRef.current?.description || '',
                undefined,
                { pieces: item.outfitPieces, occasion: item.outfitOccasion },
              )}
              disabled={item.isGeneratingImage || !(item.outfitContext || lastOutfitVisualRef.current?.description)}
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

          {(item.outfitPieces?.length || item.outfitContext) ? (
            <View style={{ marginTop: 10 }}>
              <OutfitTasteFeedback
                compact
                onLike={() => {
                  void recordStylistOutfitFeedback({
                    items: (item.outfitPieces || []).map((p, i) => ({
                      id: `guest_${item.id}_${p.role || i}`,
                      name: p.descriptor || p.garment || 'piece',
                    })),
                    signal: 'liked',
                    source: 'guest_chat',
                    occasion: item.outfitOccasion || undefined,
                    localOnly: true,
                    contextSnapshot: { messageId: item.id },
                  });
                }}
                onSkip={() => {
                  void recordStylistOutfitFeedback({
                    items: (item.outfitPieces || []).map((p, i) => ({
                      id: `guest_${item.id}_${p.role || i}`,
                      name: p.descriptor || p.garment || 'piece',
                    })),
                    signal: 'skipped',
                    source: 'guest_chat',
                    occasion: item.outfitOccasion || undefined,
                    localOnly: true,
                    contextSnapshot: { messageId: item.id },
                  });
                }}
              />
            </View>
          ) : null}
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

      <Modal
        visible={Boolean(viewerImageUrl)}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerImageUrl(null)}
      >
        <GestureHandlerRootView style={styles.viewerRoot}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + Spacing.sm }]}>
            <Pressable
              onPress={() => setViewerImageUrl(null)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
            >
              <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                Close
              </ThemedText>
            </Pressable>
            <ThemedText type="h3" style={{ color: '#FFFFFF' }}>
              Outfit look
            </ThemedText>
            <View style={{ width: 48 }} />
          </View>
          <View style={styles.viewerBody}>
            <ZoomableWardrobeImage uri={viewerImageUrl} hintColor="#AAAAAA" />
          </View>
        </GestureHandlerRootView>
      </Modal>
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
    position: "relative",
  },
  outfitImage: {
    width: "100%",
    height: 260,
    borderRadius: BorderRadius.md,
  },
  imageTapHint: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageTapHintText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  viewerBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
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
