/**
 * Hands-free voice mode for Personal Stylist — spoken replies use voice credits.
 */
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import * as FileSystem from 'expo-file-system/legacy';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
} from 'expo-audio';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useVoiceCredits } from '@/hooks/useVoiceCredits';
import { apiService } from '@/services/ApiService';
import { VoiceCreditsPurchaseModal } from '@/components/VoiceCreditsPurchaseModal';
import type { PersonalStylist } from '@/services/PersonalStylistService';

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceExchange {
  userText: string;
  assistantText: string;
}

interface PersonalStylistVoicePanelProps {
  stylist: PersonalStylist;
  effectiveLanguage: string;
  onExchange?: (exchange: VoiceExchange) => void;
}

function getMimeTypeFromUri(uri: string): 'audio/m4a' | 'audio/webm' | 'audio/wav' | 'audio/mp3' | 'audio/mp4' {
  const lower = uri.toLowerCase();
  if (lower.includes('.webm')) return 'audio/webm';
  if (lower.includes('.wav')) return 'audio/wav';
  if (lower.includes('.mp3')) return 'audio/mp3';
  if (lower.includes('.mp4')) return 'audio/mp4';
  return 'audio/m4a';
}

const TAB_BAR_HEIGHT = 56;

export function PersonalStylistVoicePanel({
  stylist,
  effectiveLanguage,
  onExchange,
}: PersonalStylistVoicePanelProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeightContext = useContext(BottomTabBarHeightContext);
  const tabBarHeight =
    typeof tabBarHeightContext === 'number' && tabBarHeightContext > 0
      ? tabBarHeightContext
      : TAB_BAR_HEIGHT + insets.bottom;
  const controlsBottomPad = tabBarHeight + Spacing.lg;
  const {
    hasCredits,
    remainingCredits,
    hasMonthlyAllowance,
    usageLabel,
    usageNudge,
    shouldShowBuyPacks,
    isLoading: creditsLoading,
    updateBalance,
    refreshBalance,
    weekendUnlimitedActive,
    weekendExpiryLabel,
  } = useVoiceCredits();

  const [showCreditsModal, setShowCreditsModal] = useState(false);

  const gradientColors: readonly [string, string] =
    stylist.id === 'ruby'
      ? ['#f093fb', '#f5576c']
      : stylist.id === 'ivy'
        ? ['#059669', '#0d9488']
        : ['#667eea', '#764ba2'];

  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [transcript, setTranscript] = useState('');
  const [recentLines, setRecentLines] = useState<VoiceExchange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    requestRecordingPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const playVoiceAudio = async (base64Audio: string) => {
    try {
      const fileUri = `${FileSystem.cacheDirectory}stylist_voice_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, { encoding: 'base64' });
      const player = createAudioPlayer({ uri: fileUri });
      player.play();
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          player.remove();
          setConversationState('idle');
        }
      });
    } catch {
      setConversationState('idle');
    }
  };

  const processRecording = async () => {
    setConversationState('processing');
    setTranscript('Processing…');
    setError(null);

    try {
      const token = await apiService.getToken();
      if (!token) {
        throw new Error('Please sign in to use voice mode.');
      }

      if (!hasCredits) {
        throw new Error("You've used this month's spoken replies. Add a top-up voice pack to keep chatting hands-free — or switch to Chat for unlimited text.");
      }

      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No recording found.');

      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const mimeType = getMimeTypeFromUri(uri);
      const voiceRange = stylist.gender === 'female' ? 'mezzo-soprano' : 'baritone';

      let userMessage = '';
      let aiResponse = '';
      let audioBase64Out: string | null = null;

      try {
        const response = await apiService.voiceChat({
          audio: audioBase64,
          mimeType,
          stylist: stylist.id,
          accent: 'american',
          voiceRange,
          language: effectiveLanguage,
        });

        if (response.voiceCreditsExhausted) {
          throw new Error(response.message || "You've used your spoken replies for now. Add credits or switch to Chat.");
        }

        if (response.success !== false && response.aiResponse) {
          userMessage = response.userMessage || 'Voice message';
          aiResponse = response.aiResponse;
          audioBase64Out = response.audioBase64;
          if (response.voiceCredits) {
            updateBalance(response.voiceCredits);
          }
        } else {
          throw new Error(response.message || 'Voice session failed');
        }
      } catch {
        const transcriptRes = await apiService.transcribeAudio(audioBase64, mimeType, effectiveLanguage);
        const transcribedText = transcriptRes.text?.trim();
        if (!transcribedText) {
          throw new Error('Could not understand that — try again.');
        }

        userMessage = transcribedText;
        const chatResponse = await apiService.sendVoiceChatMessage({
          stylistId: stylist.id,
          message: transcribedText,
          generateVoice: true,
          accent: 'american',
          voiceRange,
          language: effectiveLanguage,
        });

        if (chatResponse.voiceCreditsExhausted) {
          setError(chatResponse.voiceError?.message || "Spoken replies used up — text reply below. Add credits anytime to keep talking.");
        }
        if (chatResponse.voiceCredits) {
          updateBalance(chatResponse.voiceCredits);
        }

        aiResponse = chatResponse.response;
        audioBase64Out = chatResponse.voiceAudio || chatResponse.voice?.audio || null;
        if (!aiResponse) throw new Error('Stylist did not respond.');
      }

      const exchange = { userText: userMessage, assistantText: aiResponse };
      setRecentLines((prev) => [...prev.slice(-4), exchange]);
      onExchange?.(exchange);
      setTranscript(userMessage);
      setConversationState('speaking');

      if (audioBase64Out) {
        await playVoiceAudio(audioBase64Out);
      } else {
        setConversationState('idle');
      }

      refreshBalance();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setConversationState('idle');
      setTranscript('');
    }
  };

  const startListening = async () => {
    if (conversationState !== 'idle' || creditsLoading) return;

    if (!hasCredits) {
      setError("You've used your spoken replies. Add a top-up voice pack or switch to Chat for unlimited text.");
      return;
    }

    setError(null);
    setTranscript('');

    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        setHasPermission(false);
        return;
      }
      setHasPermission(true);
      setConversationState('listening');

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setError('Could not start recording.');
      setConversationState('idle');
    }
  };

  const stopListening = async () => {
    if (conversationState !== 'listening') return;
    await processRecording();
  };

  const toggleMic = () => {
    if (conversationState === 'listening') {
      stopListening();
    } else if (conversationState === 'idle') {
      startListening();
    }
  };

  const handleCreditsPurchased = () => {
    setError(null);
  };

  const stateLabel =
    conversationState === 'listening'
      ? 'Listening… tap when done'
      : conversationState === 'processing'
        ? `${stylist.name} is thinking…`
        : conversationState === 'speaking'
          ? `${stylist.name} is speaking…`
          : 'Tap to speak';

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Feather name="mic-off" size={40} color={theme.error} />
        <ThemedText type="body" style={styles.permissionText}>
          Microphone access is required for voice mode. Enable it in Settings.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.transcriptScroll}
        contentContainerStyle={styles.transcriptContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <ThemedText type="small" style={{ color: theme.tabIconDefault, textAlign: 'center' }}>
          Hands-free mode — {stylist.name} speaks replies aloud. Text chat stays unlimited in Chat mode.
        </ThemedText>

        {recentLines.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="headphones" size={36} color={theme.tabIconDefault} />
            <ThemedText style={{ color: theme.tabIconDefault, textAlign: 'center', marginTop: Spacing.md }}>
              Ask about outfits, colours, or what to wear today.
            </ThemedText>
          </View>
        ) : (
          recentLines.map((line, index) => (
            <View key={`${index}-${line.userText.slice(0, 12)}`} style={styles.exchangeBlock}>
              <ThemedText type="small" style={{ color: theme.link }}>You</ThemedText>
              <ThemedText type="body">{line.userText}</ThemedText>
              <ThemedText type="small" style={{ color: theme.link, marginTop: Spacing.sm }}>
                {stylist.name}
              </ThemedText>
              <ThemedText type="body">{line.assistantText}</ThemedText>
            </View>
          ))
        )}

        {transcript && conversationState === 'listening' ? (
          <ThemedText type="caption" style={{ fontStyle: 'italic', color: theme.tabIconDefault }}>
            {transcript}
          </ThemedText>
        ) : null}
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: controlsBottomPad }]}>
        <ThemedText type="small" style={{ color: theme.tabIconDefault, textAlign: 'center' }}>
          {stateLabel}
        </ThemedText>

        {error ? (
          <ThemedText type="small" style={{ color: theme.error, textAlign: 'center' }}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={toggleMic}
          disabled={conversationState === 'processing' || conversationState === 'speaking'}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={
              conversationState === 'listening'
                ? (['#C94C5A', '#8B2F39'] as const)
                : gradientColors
            }
            style={styles.micCircle}
          >
            {conversationState === 'processing' ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Feather
                name={conversationState === 'listening' ? 'check' : 'mic'}
                size={32}
                color="#FFFFFF"
              />
            )}
          </LinearGradient>
        </Pressable>

        {hasMonthlyAllowance && !creditsLoading ? (
          <View style={styles.creditsRow}>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, textAlign: 'center', flex: 1 }}>
              {weekendUnlimitedActive
                ? `Weekend voice active — expires ${weekendExpiryLabel}`
                : usageLabel
                  ? `${usageLabel} this month`
                  : hasCredits
                    ? `${remainingCredits} spoken repl${remainingCredits === 1 ? 'y' : 'ies'} left`
                    : 'Monthly spoken replies used up — try Weekend Unlimited or add a credit pack.'}
            </ThemedText>
            {shouldShowBuyPacks ? (
              <Pressable
                onPress={() => setShowCreditsModal(true)}
                style={({ pressed }) => [
                  styles.buyCreditsButton,
                  { backgroundColor: theme.link, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <ThemedText style={styles.buyCreditsText}>Top up</ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : !hasMonthlyAllowance && !creditsLoading ? (
          <View style={styles.creditsRow}>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, textAlign: 'center', flex: 1 }}>
              {hasCredits
                ? `${remainingCredits} spoken repl${remainingCredits === 1 ? 'y' : 'ies'} left`
                : 'Add a voice pack to use hands-free spoken replies.'}
            </ThemedText>
            <Pressable
              onPress={() => setShowCreditsModal(true)}
              style={({ pressed }) => [
                styles.buyCreditsButton,
                { backgroundColor: theme.link, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText style={styles.buyCreditsText}>Buy credits</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {usageNudge ? (
          <ThemedText type="caption" style={{ color: theme.link, textAlign: 'center', paddingHorizontal: Spacing.sm }}>
            {usageNudge}
          </ThemedText>
        ) : null}
      </View>

      {showCreditsModal ? (
        <VoiceCreditsPurchaseModal
          visible={showCreditsModal}
          onClose={() => setShowCreditsModal(false)}
          onPurchaseSuccess={handleCreditsPurchased}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permissionText: {
    textAlign: 'center',
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  exchangeBlock: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 4,
  },
  controls: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  micCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  buyCreditsButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  buyCreditsText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
