/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Text, Pressable, Animated, ActivityIndicator, Platform, ScrollView, Image, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useVoiceCredits } from "@/hooks/useVoiceCredits";
import { apiService } from "@/services/ApiService";
import { getStylistForUser } from "@/services/PersonalStylistService";
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
  imageUri?: string;
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

const IVY_RESPONSES = [
  "Straight answer: that works. Wear it.",
  "Good foundation. Add one quality piece — a sharp jacket or clean leather shoe — and you're done.",
  "Skip the trend. Classic, well-fitted basics will always outperform whatever's popular right now.",
  "That outfit has one too many things going on. Drop the accessory. Keep it clean.",
  "Solid choice. Stop second-guessing and wear it with confidence.",
];

function getMimeTypeFromUri(uri: string): 'audio/m4a' | 'audio/webm' | 'audio/wav' | 'audio/mp3' | 'audio/mp4' {
  const lower = uri.toLowerCase();
  if (lower.includes('.webm')) return 'audio/webm';
  if (lower.includes('.wav')) return 'audio/wav';
  if (lower.includes('.mp3')) return 'audio/mp3';
  if (lower.includes('.mp4')) return 'audio/mp4';
  return 'audio/m4a';
}

export default function VoiceConversationScreen({ navigation }: VoiceConversationScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const insets = useSafeAreaInsets();
  const { 
    hasCredits, 
    isUnlimited, 
    isFreeUser,
    updateBalance,
    refreshBalance,
  } = useVoiceCredits();
  const messagesScrollRef = useRef<ScrollView>(null);
  const stylist = getStylistForUser(user?.gender || null, user?.stylistPreferences);
  const stylistName = stylist.name;
  const stylistResponses = stylist.id === 'ruby' ? RUBY_RESPONSES : stylist.id === 'ivy' ? IVY_RESPONSES : MAX_RESPONSES;
  const gradientColors: readonly [string, string] = stylist.id === 'ruby'
    ? ["#f093fb", "#f5576c"]
    : stylist.id === 'ivy'
    ? ["#059669", "#0d9488"]
    : ["#667eea", "#764ba2"];

  const [conversationState, setConversationState] = useState<ConversationState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Image picker error:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      setHasPermission(granted);
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
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      console.error('[VoiceConversation] Failed to start recording:', err);
      setError('Failed to start recording');
      setConversationState("idle");
    }
  };

  const stopListeningAndTranscribe = async () => {
    if (!audioRecorder.isRecording && !audioRecorder.uri) {
      setConversationState("idle");
      return;
    }

    setConversationState("processing");
    setCurrentTranscript("Processing your voice...");

    try {
      const token = await apiService.getToken();
      if (!token) {
        setError('Please log in to use voice chat.');
        setConversationState("idle");
        setCurrentTranscript("");
        return;
      }

      await audioRecorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
      });

      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error('No recording URI available');
      }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const mimeType = getMimeTypeFromUri(uri);
      const voiceRange = stylist.gender === 'female' ? 'mezzo-soprano' : 'baritone';

      let userMessage = '';
      let aiResponse = '';
      let audioBase64Out: string | null = null;

      // Primary: combined transcribe + chat + TTS endpoint
      try {
        const response = await apiService.voiceChat({
          audio: audioBase64,
          mimeType,
          stylist: stylist.id,
          accent: 'american',
          voiceRange,
        });

        if (response.success !== false && response.aiResponse) {
          userMessage = response.userMessage || 'Voice message';
          aiResponse = response.aiResponse;
          audioBase64Out = response.audioBase64;
        } else {
          throw new Error(response.message || 'Voice chat returned no response');
        }
      } catch (voiceChatErr) {
        console.warn('[VoiceConversation] Combined voice-chat failed, trying transcribe + chat:', voiceChatErr);

        const transcript = await apiService.transcribeAudio(audioBase64, mimeType, 'en');
        const transcribedText = transcript.text?.trim();
        if (!transcribedText) {
          throw new Error('Could not understand your voice. Please try speaking again.');
        }

        userMessage = transcribedText;
        const chatResponse = await apiService.sendVoiceChatMessage({
          stylistId: stylist.id,
          message: transcribedText,
          generateVoice: true,
          accent: 'american',
          voiceRange,
        });

        if (chatResponse.voiceCreditsExhausted) {
          setError(chatResponse.voiceError?.message || 'Voice session limit reached. Text response shown below.');
        }

        if (chatResponse.voiceCredits) {
          updateBalance(chatResponse.voiceCredits);
        }

        aiResponse = chatResponse.response;
        audioBase64Out = chatResponse.voiceAudio || chatResponse.voice?.audio || null;

        if (!aiResponse) {
          throw new Error('Stylist did not respond. Please try again.');
        }
      }

      setCurrentTranscript(userMessage);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          text: userMessage,
          timestamp: new Date(),
        },
        {
          id: (Date.now() + 1).toString(),
          role: "stylist",
          text: aiResponse,
          timestamp: new Date(),
        },
      ]);
      setConversationState("speaking");

      if (audioBase64Out) {
        await playVoiceAudio(audioBase64Out);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setConversationState("idle");
      }
    } catch (err: any) {
      console.error('[VoiceConversation] Error:', err);
      setError(err?.message || 'Something went wrong. Please try again.');
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
      
      const player = createAudioPlayer({ uri: fileUri });
      player.play();

      const subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          player.remove();
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
    if (conversationState === "listening" && audioRecorder.isRecording) {
      await stopListeningAndTranscribe();
    } else if (audioRecorder.isRecording) {
      try {
        await audioRecorder.stop();
      } catch (e) {
        console.log('[VoiceConversation] Error stopping recording:', e);
      }
      setConversationState("idle");
      setCurrentTranscript("");
    } else {
      setConversationState("idle");
      setCurrentTranscript("");
    }
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
            {renderMarkdownText(message.text, isUser ? "#FFFFFF" : theme.text)}
          </ThemedText>
          
          {message.imageUri && (
            <Image
              source={{ uri: message.imageUri }}
              style={[styles.messageImage, { marginTop: Spacing.md }]}
              resizeMode="cover"
            />
          )}
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


  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messagesScrollRef.current) {
      setTimeout(() => {
        messagesScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  return (
    <ThemedView style={[styles.screenContainer, { paddingBottom: insets.bottom + 8 }]}>
      {/* Scrollable Content Area */}
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Header */}
        <View style={styles.compactHeader}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.compactHeaderIcon}
          >
            <Feather name="headphones" size={20} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.compactHeaderText}>
            <ThemedText type="h3">Voice Chat with {stylistName}</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Have a real-time voice conversation with your personal AI stylist
            </ThemedText>
          </View>
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
            {/* Compact Stylist Info */}
            <Card style={styles.compactStylistCard}>
              <View style={styles.stylistInfo}>
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.compactStylistAvatar}
                >
                  <Feather name={stylist.gender === "female" ? "heart" : "star"} size={18} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.stylistDetails}>
                  <ThemedText type="body" style={{ fontWeight: '600' }}>{stylistName}</ThemedText>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                    <ThemedText type="caption" style={{ color: theme.success }}>
                      Online
                    </ThemedText>
                  </View>
                </View>
              </View>
              <View style={styles.compactSpecialties}>
                {["Color Analysis", "Body Styling", "Wardrobe Planning", "Trend Advice"].map((specialty) => (
                  <View key={specialty} style={[styles.specialtyTag, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption">{specialty}</ThemedText>
                  </View>
                ))}
              </View>
            </Card>

            {/* Conversation Section */}
            <View style={styles.conversationSection}>
              <ThemedText type="h4" style={styles.sectionLabel}>
                Conversation
              </ThemedText>
              
              {messages.length === 0 ? (
                <View style={styles.emptyConversation}>
                  <Feather name="message-circle" size={36} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                    Tap the microphone to start talking with {stylistName}
                  </ThemedText>
                </View>
              ) : (
                <ScrollView 
                  ref={messagesScrollRef}
                  style={styles.messagesScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.messagesList}>
                    {messages.map(renderMessage)}
                  </View>
                </ScrollView>
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
          </>
        )}
      </ScrollView>

      {/* Fixed Voice Button Section at Bottom */}
      {hasPermission !== false ? (
        <View style={[styles.fixedVoiceSection, { paddingBottom: Spacing.md }]}>
          <ThemedText type="small" style={[styles.stateText, { color: theme.tabIconDefault }]}>
            {conversationState === "idle" && "Tap to speak"}
            {conversationState === "listening" && "Listening..."}
            {conversationState === "processing" && `${stylistName} is thinking...`}
            {conversationState === "speaking" && `${stylistName} is speaking...`}
          </ThemedText>

          {error ? (
            <ThemedText type="small" style={{ color: theme.error, textAlign: 'center', paddingHorizontal: Spacing.md }}>
              {error}
            </ThemedText>
          ) : null}
          
          <View style={{ flexDirection: 'row', gap: Spacing.md, justifyContent: 'center', alignItems: 'center' }}>
            {renderVoiceButton()}
            <Pressable
              onPress={pickImage}
              disabled={conversationState !== 'idle'}
              style={({ pressed }) => [
                styles.photoButton,
                {
                  backgroundColor: conversationState === 'idle' ? gradientColors[0] : theme.backgroundTertiary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name="image"
                size={20}
                color={conversationState === 'idle' ? '#FFFFFF' : theme.tabIconDefault}
              />
            </Pressable>
          </View>

          <View style={styles.tipsRow}>
            <Feather name="info" size={14} color={theme.tabIconDefault} />
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, flex: 1 }}>
              Ask about outfit ideas, color matching, styling tips, or fashion advice
            </ThemedText>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  container: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  compactHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  compactHeaderText: {
    flex: 1,
  },
  compactStylistCard: {
    padding: Spacing.md,
  },
  compactStylistAvatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  compactSpecialties: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  messagesScroll: {
    maxHeight: 200,
  },
  fixedVoiceSection: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
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
  messageImage: {
    width: 200,
    height: 250,
    borderRadius: BorderRadius.md,
  },
  photoButton: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
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
