/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Pressable, Animated, ActivityIndicator, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useVoiceCredits } from "@/hooks/useVoiceCredits";
import { apiService } from "@/services/ApiService";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type VoiceConversationScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "VoiceConversation">;
};

type ConversationState = "idle" | "listening" | "processing" | "speaking";

interface VoiceMessage {
  id: string;
  role: "user" | "stylist";
  text: string;
  timestamp: Date;
}

const RUBY_RESPONSES = [
  "I love that you're thinking about your wardrobe! Based on your style profile, I'd suggest adding more statement pieces in jewel tones.",
  "That's a great question! For your body type, I recommend focusing on structured blazers that create a beautiful silhouette.",
  "Absolutely! Mixing patterns can be tricky, but the key is to vary the scale. Try pairing a bold stripe with a subtle floral.",
  "For your upcoming event, I'd suggest something elegant yet comfortable. A midi dress with subtle draping would be perfect!",
  "Your color palette is beautiful! To enhance it, consider adding some metallic accessories that complement your warm undertones.",
];

const MAX_RESPONSES = [
  "Great question! For a polished casual look, I'd recommend starting with well-fitted chinos and building from there.",
  "That's a solid foundation! I'd suggest investing in a quality leather belt and some versatile dress shoes.",
  "Absolutely! Layering is key for men's fashion. A light sweater over a crisp shirt works wonders.",
  "For your style goals, I'd recommend building a capsule wardrobe with interchangeable pieces.",
  "That color would work great with your complexion! Try pairing it with navy or charcoal for a sophisticated look.",
];

export default function VoiceConversationScreen({ navigation }: VoiceConversationScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const { 
    hasCredits, 
    isUnlimited, 
    isFreeUser,
    updateBalance,
    refreshBalance,
  } = useVoiceCredits();
  const gender = user?.gender || "female";
  
  const [conversationState, setConversationState] = useState<ConversationState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);

  const stylistName = gender === "female" ? "Ruby" : "Max";
  const stylistResponses = gender === "female" ? RUBY_RESPONSES : MAX_RESPONSES;
  const gradientColors: readonly [string, string] = gender === "female" 
    ? ["#f093fb", "#f5576c"] 
    : ["#667eea", "#764ba2"];

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (conversationState === "listening") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [conversationState, pulseAnim, waveAnim]);

  const checkPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === "granted");
    } catch (error) {
      setHasPermission(false);
    }
  };

  const startListening = async () => {
    if (!hasPermission) {
      await checkPermissions();
      return;
    }

    setError(null);
    setConversationState("listening");
    setCurrentTranscript("");

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
    } catch (err) {
      console.error('[VoiceConversation] Failed to start recording:', err);
      setError('Failed to start recording');
      setConversationState("idle");
    }
  };

  const stopListeningAndTranscribe = async () => {
    if (!recordingRef.current) {
      setConversationState("idle");
      return;
    }

    setConversationState("processing");
    setCurrentTranscript("Processing your voice...");

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No recording URI available');
      }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/webm';
      
      const transcriptionResponse = await apiService.transcribeAudio(audioBase64, mimeType as 'audio/webm' | 'audio/wav' | 'audio/mp3' | 'audio/m4a' | 'audio/mp4', 'en');

      if (transcriptionResponse.success && transcriptionResponse.text) {
        const userTranscript = transcriptionResponse.text;
        setCurrentTranscript(userTranscript);

        const userMessage: VoiceMessage = {
          id: Date.now().toString(),
          role: "user",
          text: userTranscript,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        await getStylistResponse(userTranscript);
      } else {
        throw new Error('Transcription failed');
      }
    } catch (err) {
      console.error('[VoiceConversation] Transcription error:', err);
      setError('Failed to transcribe audio. Please try again.');
      setConversationState("idle");
      setCurrentTranscript("");
    }
  };

  const playVoiceAudio = async (base64Audio: string) => {
    try {
      const fileUri = `${FileSystem.cacheDirectory}stylist_response_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: 'base64',
      });
      
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      await sound.playAsync();
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          setConversationState("idle");
        }
      });
    } catch (err) {
      console.error('[VoiceConversation] Audio playback error:', err);
      await new Promise(resolve => setTimeout(resolve, 3000));
      setConversationState("idle");
    }
  };

  const getStylistResponse = async (userText: string) => {
    if (!hasCredits) {
      setError("Voice sessions are limited on your current plan. Upgrade for extended access.");
      setConversationState("idle");
      return;
    }

    try {
      const chatResponse = await apiService.sendVoiceChatMessage({
        stylistId: stylistName.toLowerCase(),
        message: userText,
        generateVoice: true,
        voiceSettings: { accent: 'british' },
      });

      if (chatResponse.voiceCreditsExhausted) {
        setError(chatResponse.voiceError?.message || "Voice session limit reached. Upgrade for extended access.");
        setConversationState("idle");
        return;
      }

      if (chatResponse.voiceCredits) {
        updateBalance(chatResponse.voiceCredits);
      }

      if (chatResponse.response) {
        const stylistMessage: VoiceMessage = {
          id: (Date.now() + 1).toString(),
          role: "stylist",
          text: chatResponse.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, stylistMessage]);
        setConversationState("speaking");
        
        const audioData = chatResponse.voice?.audio || chatResponse.voiceAudio;
        if (audioData) {
          await playVoiceAudio(audioData);
        } else {
          await new Promise(resolve => setTimeout(resolve, 3000));
          setConversationState("idle");
        }
      } else {
        const randomResponse = stylistResponses[Math.floor(Math.random() * stylistResponses.length)];
        const stylistMessage: VoiceMessage = {
          id: (Date.now() + 1).toString(),
          role: "stylist",
          text: randomResponse,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, stylistMessage]);
        setConversationState("speaking");

        await new Promise(resolve => setTimeout(resolve, 3000));
        setConversationState("idle");
      }
    } catch (err) {
      console.error('[VoiceConversation] Chat error:', err);
      const randomResponse = stylistResponses[Math.floor(Math.random() * stylistResponses.length)];
      const stylistMessage: VoiceMessage = {
        id: (Date.now() + 1).toString(),
        role: "stylist",
        text: randomResponse,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, stylistMessage]);
      setConversationState("speaking");

      await new Promise(resolve => setTimeout(resolve, 3000));
      setConversationState("idle");
    }
    setCurrentTranscript("");
  };

  const stopConversation = async () => {
    if (conversationState === "listening" && recordingRef.current) {
      await stopListeningAndTranscribe();
    } else {
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          console.log('[VoiceConversation] Error stopping recording:', e);
        }
        recordingRef.current = null;
      }
      setConversationState("idle");
      setCurrentTranscript("");
    }
  };

  const renderMessage = (message: VoiceMessage) => {
    const isUser = message.role === "user";
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.stylistMessageContainer,
        ]}
      >
        {!isUser ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stylistAvatar}
          >
            <Feather name="mic" size={16} color="#FFFFFF" />
          </LinearGradient>
        ) : null}
        
        <View
          style={[
            styles.messageBubble,
            isUser 
              ? { backgroundColor: theme.link }
              : { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ThemedText
            style={[
              styles.messageText,
              { color: isUser ? "#FFFFFF" : theme.text },
            ]}
          >
            {message.text}
          </ThemedText>
        </View>
        
        {isUser ? (
          <View style={[styles.userAvatar, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="user" size={16} color={theme.text} />
          </View>
        ) : null}
      </View>
    );
  };

  const renderVoiceButton = () => {
    const isActive = conversationState === "listening" || conversationState === "speaking";
    
    return (
      <View style={styles.voiceButtonContainer}>
        {conversationState === "listening" ? (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                borderColor: theme.link + "40",
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        ) : null}
        
        <Pressable
          onPress={isActive ? stopConversation : startListening}
          style={({ pressed }) => [
            styles.voiceButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <LinearGradient
            colors={isActive ? ["#C94C5A", "#8B2F39"] : gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.voiceButtonGradient}
          >
            {conversationState === "processing" ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Feather
                name={isActive ? "x" : "mic"}
                size={32}
                color="#FFFFFF"
              />
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  };


  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="headphones" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h1" style={styles.title}>Voice Chat with {stylistName}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Have a real-time voice conversation with your personal AI stylist
        </ThemedText>
        
      </View>
      

      {hasPermission === false ? (
        <Card style={styles.permissionCard}>
          <Feather name="mic-off" size={48} color={theme.error} />
          <ThemedText type="h3" style={styles.permissionTitle}>
            Microphone Access Required
          </ThemedText>
          <ThemedText style={[styles.permissionDescription, { color: theme.tabIconDefault }]}>
            To use voice conversations, please grant microphone access in your device settings
          </ThemedText>
          {(Platform.OS as string) !== "web" ? (
            <Pressable
              onPress={checkPermissions}
              style={({ pressed }) => [
                styles.permissionButton,
                { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Grant Permission
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={[styles.webNote, { color: theme.warning }]}>
              Run in Expo Go to use voice features
            </ThemedText>
          )}
        </Card>
      ) : (
        <>
          <Card style={styles.stylistCard}>
            <View style={styles.stylistInfo}>
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stylistLargeAvatar}
              >
                <Feather name={gender === "female" ? "heart" : "star"} size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.stylistDetails}>
                <ThemedText type="h3">{stylistName}</ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                  Your Personal AI Stylist
                </ThemedText>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                  <ThemedText type="caption" style={{ color: theme.success }}>
                    Online
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.specialties}>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
                Specialties:
              </ThemedText>
              <View style={styles.specialtyTags}>
                {["Color Analysis", "Body Styling", "Wardrobe Planning", "Trend Advice"].map((specialty) => (
                  <View key={specialty} style={[styles.specialtyTag, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption">{specialty}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </Card>

          <View style={styles.conversationSection}>
            <ThemedText type="h4" style={styles.sectionLabel}>
              Conversation
            </ThemedText>
            
            {messages.length === 0 ? (
              <View style={styles.emptyConversation}>
                <Feather name="message-circle" size={48} color={theme.tabIconDefault} />
                <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                  Tap the microphone to start talking with {stylistName}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.messagesList}>
                {messages.map(renderMessage)}
              </View>
            )}

            {currentTranscript ? (
              <View style={styles.transcriptContainer}>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, fontStyle: "italic" }}>
                  {conversationState === "listening" ? "Listening: " : "You said: "}
                  {currentTranscript}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.voiceSection}>
            <ThemedText type="small" style={[styles.stateText, { color: theme.tabIconDefault }]}>
              {conversationState === "idle" && "Tap to speak"}
              {conversationState === "listening" && "Listening..."}
              {conversationState === "processing" && `${stylistName} is thinking...`}
              {conversationState === "speaking" && `${stylistName} is speaking...`}
            </ThemedText>
            
            {renderVoiceButton()}

            <View style={styles.tipsRow}>
              <Feather name="info" size={14} color={theme.tabIconDefault} />
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, flex: 1 }}>
                Ask about outfit ideas, color matching, styling tips, or fashion advice
              </ThemedText>
            </View>
          </View>
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },
  permissionCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  permissionTitle: {
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  permissionDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  permissionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  webNote: {
    textAlign: "center",
    fontStyle: "italic",
  },
  stylistCard: {
    padding: Spacing.lg,
  },
  stylistInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stylistLargeAvatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  stylistDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  specialties: {
    marginTop: Spacing.sm,
  },
  specialtyTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  specialtyTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  conversationSection: {
    gap: Spacing.md,
  },
  sectionLabel: {
    marginBottom: Spacing.xs,
  },
  emptyConversation: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
  messagesList: {
    gap: Spacing.md,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  userMessageContainer: {
    justifyContent: "flex-end",
  },
  stylistMessageContainer: {
    justifyContent: "flex-start",
  },
  stylistAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBubble: {
    maxWidth: "70%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  messageText: {
    lineHeight: 22,
  },
  transcriptContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  voiceSection: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  stateText: {
    marginBottom: Spacing.lg,
  },
  voiceButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  pulseRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  voiceButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
  },
  voiceButtonGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tipsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  creditsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  creditsText: {
    fontSize: 14,
  },
  buyCreditsButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.xs,
  },
  buyCreditsText: {
    fontSize: 12,
    fontWeight: "600",
  },
  lowCreditsWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  lowCreditsText: {
    fontSize: 12,
    flex: 1,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  creditsModal: {
    width: "90%",
    maxWidth: 400,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    flex: 1,
  },
  modalText: {
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  packageList: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  packageItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  popularText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#000000",
  },
  packageName: {
    flex: 1,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeModalButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
});
