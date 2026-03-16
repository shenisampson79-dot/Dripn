import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
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
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiService } from "@/services/ApiService";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

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

  // Conversation phase management - keeps frontend in control, bypasses broken backend templates
  type ConversationPhase = 'initial' | 'profiling' | 'recommendations';
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>('initial');
  const [userProfile, setUserProfile] = useState<{
    gender?: string;
    location?: string;
    weather?: string;
    vibe?: string;
    fit?: string;
    occasion?: string;
  } | null>(null);

  useEffect(() => {
    initializeGuestSession();
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

  // Extract user profile from their answers to the 5 questions
  const extractProfileFromText = (text: string) => {
    const t = text.toLowerCase();
    
    // Gender detection - look near "4)" pattern first, then full text
    let gender: string | undefined;
    const genderPatterns = [
      /4[).\s:]+[^0-9]*\b(male|man|guy|dude|bloke|he\/him)\b/i,
      /gender[^a-z]*(male|man|guy)\b/i,
      /i(?:'m| am) a? ?(male|man|guy)\b/i,
      /\b(male|man|guy)\b/i,
    ];
    const femalePatterns = [
      /4[).\s:]+[^0-9]*\b(female|woman|girl|lady|she\/her)\b/i,
      /gender[^a-z]*(female|woman|girl)\b/i,
      /i(?:'m| am) a? ?(female|woman|girl)\b/i,
      /\b(female|woman|girl)\b/i,
    ];
    const nonBinaryPatterns = [/non.?binary|they\/them|enby/i];
    
    for (const p of genderPatterns) { if (p.test(t)) { gender = 'male'; break; } }
    if (!gender) { for (const p of femalePatterns) { if (p.test(t)) { gender = 'female'; break; } } }
    if (!gender) { for (const p of nonBinaryPatterns) { if (p.test(t)) { gender = 'non-binary'; break; } } }

    // Fit detection
    let fit: string | undefined;
    if (/loose|comfortable|relaxed/i.test(t)) fit = 'loose and comfortable';
    else if (/fitted|tailored|slim/i.test(t)) fit = 'fitted and tailored';
    else if (/oversized/i.test(t)) fit = 'oversized';

    // Vibe detection
    let vibe: string | undefined;
    if (/sporty.{0,15}polish|polished.{0,15}sport/i.test(t)) vibe = 'sporty but polished';
    else if (/athletic|athlet/i.test(t)) vibe = 'athletic';
    else if (/minimal|clean/i.test(t)) vibe = 'clean and minimal';
    else if (/casual/i.test(t)) vibe = 'casual';
    else if (/formal|smart/i.test(t)) vibe = 'smart and polished';

    return { gender, fit, vibe };
  };

  // Get the 5-question profiling template for each stylist
  const getProfilingTemplate = (stylistId: string): string => {
    const templates: Record<string, string> = {
      max: `To dial this in without overcomplicating it, tell me 5 quick things:\n1) Where exactly is the occasion (coffee walk, mini golf, climbing gym, dinner, etc.)?\n2) Weather + time of day (temp, day or evening)?\n3) Your vibe goal: more "athletic core" or "sporty but polished"?\n4) Your gender/how you identify?\n5) Do you prefer your clothes fitted & tailored, loose & comfortable, or oversized?`,
      ruby: `Let me help you look amazing! Tell me 5 things:\n1) Where's the occasion?\n2) Weather + time (temp, day or evening)?\n3) What vibe are you feeling - bold or effortless chic?\n4) Your gender/how you identify?\n5) Fitted & tailored, loose & comfortable, or oversized?`,
      ace: `Yo, let's get you sorted. 5 quick things:\n1) Where's the date/event?\n2) Weather + time?\n3) Vibe: street-smart or clean & polished?\n4) Your gender/how you identify?\n5) Fit preference: fitted, loose, or oversized?`,
      ivy: `Let's find you something perfect and sustainable! Quick 5:\n1) Where's the occasion?\n2) Weather + time?\n3) Vibe: natural & minimal or earthy bold?\n4) Your gender/how you identify?\n5) Fitted & tailored, loose & comfortable, or oversized?`,
    };
    return templates[stylistId] || templates.max;
  };

  // Build the explicit backend prompt after profile is collected
  const buildRecommendationPrompt = (
    userAnswers: string,
    profile: NonNullable<typeof userProfile>,
    originalOccasion: string
  ): string => {
    const genderLine = profile.gender === 'male'
      ? 'GENDER: MALE — recommend menswear only. DO NOT suggest female-oriented styles.'
      : profile.gender === 'female'
      ? 'GENDER: FEMALE — recommend womenswear appropriate for the occasion.'
      : profile.gender === 'non-binary'
      ? 'GENDER: NON-BINARY — recommend gender-neutral or androgynous styles.'
      : 'GENDER: not specified';

    return `Please give me specific outfit recommendations based on my full profile:

${genderLine}
OCCASION: ${originalOccasion}
DETAILS: ${userAnswers}
FIT PREFERENCE: ${profile.fit || 'not specified'}
VIBE GOAL: ${profile.vibe || 'not specified'}

Give me 3 specific, complete outfit options with exact clothing items (tops, bottoms, shoes, outerwear if needed). Be direct and practical.`;
  };

  const handleSelectStylist = (stylist: GuestStylist) => {
    setSelectedStylist(stylist);
    setConversationPhase('initial');
    setUserProfile(null);
    const greeting = STYLIST_GREETINGS[stylist.id] || `Hi! I'm ${stylist.name}. What can I help you with today?`;
    setMessages([{
      id: "greeting",
      content: greeting,
      isUser: false,
      timestamp: new Date(),
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !sessionToken || !selectedStylist || isSending) return;

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
      // PHASE 1: First user message → show 5-question template from frontend
      // This completely bypasses the deployed backend's broken profile collection
      if (conversationPhase === 'initial') {
        const profilingTemplate = getProfilingTemplate(selectedStylist.id);
        const templateMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: profilingTemplate,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, templateMessage]);
        setConversationPhase('profiling');
        setIsSending(false);
        return;
      }

      // PHASE 2: User answered the 5 questions → extract profile and get recommendations
      if (conversationPhase === 'profiling') {
        // Extract profile from user's answers
        const extractedProfile = extractProfileFromText(userText);
        
        // Also check the initial message for context
        const initialUserMsg = messages.find(m => m.isUser)?.content || '';
        const fullContext = `${initialUserMsg} ${userText}`;
        const fullProfile = extractProfileFromText(fullContext);
        
        const finalProfile = {
          gender: extractedProfile.gender || fullProfile.gender,
          fit: extractedProfile.fit || fullProfile.fit,
          vibe: extractedProfile.vibe || fullProfile.vibe,
          occasion: initialUserMsg,
        };
        
        setUserProfile(finalProfile);
        setConversationPhase('recommendations');

        // Build an explicit, gender-aware prompt for the backend
        const recommendationPrompt = buildRecommendationPrompt(userText, finalProfile, initialUserMsg);
        
        // Call backend with explicit profile context
        const conversationHistory = [
          { role: 'user' as const, content: initialUserMsg },
          { role: 'assistant' as const, content: getProfilingTemplate(selectedStylist.id) },
          { role: 'user' as const, content: userText },
        ];

        const rawResponse = await apiService.guestChat(
          sessionToken, 
          recommendationPrompt, 
          selectedStylist.id, 
          conversationHistory
        ) as any;

        let aiContent = rawResponse?.response || rawResponse?.message || rawResponse?.text || "Let me put together some looks for you!";
        aiContent = aiContent.replace(/\*\*/g, '').replace(/\*/g, '');

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: aiContent,
          isUser: false,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, aiMessage]);
        const remaining = rawResponse?.remainingMessages ?? messagesRemaining - 1;
        setMessagesRemaining(remaining);

        if (rawResponse?.limitReached === true || remaining <= 0) {
          setShowLimitReached(true);
        }
        setIsSending(false);
        return;
      }

      // PHASE 3+: Ongoing recommendations chat — call backend normally with full history
      const conversationHistory = messages.map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // Add gender context to follow-up messages too
      const genderPrefix = userProfile?.gender === 'male'
        ? '[User is male — menswear only] '
        : userProfile?.gender === 'female'
        ? '[User is female] '
        : '';

      const rawResponse = await apiService.guestChat(
        sessionToken, 
        `${genderPrefix}${userText}`, 
        selectedStylist.id, 
        conversationHistory
      ) as any;

      let aiContent = rawResponse?.response || rawResponse?.message || rawResponse?.text || "I'm here to help with your style!";
      aiContent = aiContent.replace(/\*\*/g, '').replace(/\*/g, '');

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiContent,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
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

  const handleBack = () => {
    if (selectedStylist) {
      setSelectedStylist(null);
      setMessages([]);
      setConversationPhase('initial');
      setUserProfile(null);
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

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const colors = selectedStylist ? STYLIST_COLORS[selectedStylist.id] : { primary: "#6B7280", secondary: "#374151" };
    
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
          <ThemedText
            type="body"
            style={{ color: item.isUser ? "#FFFFFF" : theme.text }}
          >
            {item.content}
          </ThemedText>
          {item.imageUrl && (
            <View style={styles.outfitImageContainer}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.outfitImage}
                resizeMode="cover"
              />
              {item.isPlaceholder && (
                <View style={[styles.placeholderBadge, { backgroundColor: colors.primary }]}>
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Upgrade for AI-generated looks
                  </ThemedText>
                </View>
              )}
            </View>
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
            <Pressable onPress={handleSignUp} style={styles.signupButton}>
              <ThemedText type="body" style={{ color: theme.link, fontWeight: "600" }}>
                Create Account
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
                style={[styles.unlockButton, { backgroundColor: stylistColors.primary }]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Create Free Account
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Ask about an outfit..."
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
                  <ActivityIndicator size="small" color="#FFFFFF" />
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
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
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
    height: 200,
    borderRadius: BorderRadius.md,
  },
  placeholderBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
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
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
});
