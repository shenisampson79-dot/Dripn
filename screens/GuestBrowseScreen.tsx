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

  const handleSelectStylist = (stylist: GuestStylist) => {
    setSelectedStylist(stylist);
    const greeting = stylist.greeting || STYLIST_GREETINGS[stylist.id] || `Hi! I'm ${stylist.name}. What can I help you with today?`;
    setMessages([{
      id: "greeting",
      content: greeting,
      isUser: false,
      timestamp: new Date(),
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !sessionToken || !selectedStylist || isSending) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsSending(true);

    try {
      console.log("Sending chat request to stylist:", selectedStylist.id);
      const rawResponse = await apiService.guestChat(sessionToken, userMessage.content, selectedStylist.id) as any;
      console.log("Chat response received:", JSON.stringify(rawResponse));
      
      // The backend returns: { success, response, stylist, remainingMessages, showSignupPrompt }
      const aiContent = rawResponse?.response || rawResponse?.message || rawResponse?.text || "I'm here to help with your style!";
      console.log("AI content extracted:", aiContent.substring(0, 50));
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: aiContent,
        isUser: false,
        timestamp: new Date(),
      };

      console.log("Adding AI message to chat");
      setMessages(prev => [...prev, aiMessage]);
      
      const remaining = rawResponse?.remainingMessages ?? messagesRemaining - 1;
      console.log("Remaining messages:", remaining);
      setMessagesRemaining(remaining);

      if (rawResponse?.limitReached || rawResponse?.showSignupPrompt) {
        setShowLimitReached(true);
        if (rawResponse?.signupPrompt) {
          setSignupPrompt(rawResponse.signupPrompt);
        }
      }
      console.log("Chat response processed successfully");
    } catch (error: any) {
      console.log("Guest chat error:", error?.message || error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `Something went wrong: ${error?.message || 'Please try again.'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      console.log("Setting isSending to false");
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
