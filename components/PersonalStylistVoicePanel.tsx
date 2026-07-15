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
import { useTranslations } from "@/contexts/TranslationContext";

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceExchange {
  userText: string;
  assistantText: string;
}

interface PersonalStylistVoicePanelProps {
  stylist: PersonalStylist;
  effectiveLanguage: string;
  /** Backend accent key for native TTS (e.g. spanish, italian). Defaults to american. */
  accent?: string;
  wardrobeItems?: Array<{
    id: string;
    name: string;
    color: string;
    category: string;
    brand?: string | null;
    wearCount?: number;
    timesWorn?: number;
    isFavorite?: boolean;
    origin?: string | null;
  }>;
  onExchange?: (exchange: VoiceExchange) => void;
  /** Sync credit balance back to parent (header usage card). */
  onCreditsChange?: (credits: {
    remaining?: string | number;
    monthlyAllowance?: number;
    monthlyHardCap?: number;
    usedThisMonth?: number;
    monthlyRemaining?: number;
    purchasedCredits?: number;
    isUnlimited?: boolean;
    weekendUnlimitedActive?: boolean;
    weekendUnlimitedExpiresAt?: string | null;
    softCapWarning?: 'usage_high' | 'approaching_limit' | null;
  }) => void;
  /** Ask parent to re-fetch balance (e.g. after purchase). */
  onBalanceRefreshNeeded?: () => void;
}

function getMimeTypeFromUri(uri: string): 'audio/m4a' | 'audio/webm' | 'audio/wav' | 'audio/mp3' | 'audio/mp4' {
  const lower = uri.toLowerCase();
  if (lower.includes('.webm')) return 'audio/webm';
  if (lower.includes('.wav')) return 'audio/wav';
  if (lower.includes('.mp3')) return 'audio/mp3';
  if (lower.includes('.mp4')) return 'audio/mp4';
  return 'audio/m4a';
}

/**
 * ApiService.request throws plain Error(message) without status codes.
 * Only retry the slow STT + resilient-chat path on transport / 5xx style failures —
 * never on credit (402), auth, or other client/business errors.
 */
function isTransientVoiceChatFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const lower = message.toLowerCase();

  if (
    lower.includes('authentication required') ||
    lower.includes('please log in') ||
    lower.includes('please sign in') ||
    lower.includes('access denied') ||
    lower.includes('spoken replies') ||
    lower.includes('spoken reply') ||
    lower.includes('voice credits') ||
    lower.includes('credit') ||
    lower.includes('402') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return false;
  }

  if (
    lower.includes('network error') ||
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('took too long') ||
    lower.includes('server error') ||
    lower.includes('service unavailable') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    /(?:^|\D)5\d{2}(?:\D|$)/.test(message)
  ) {
    return true;
  }

  return false;
}

const TAB_BAR_HEIGHT = 56;

export function PersonalStylistVoicePanel({
  stylist,
  effectiveLanguage,
  accent = 'american',
  wardrobeItems,
  onExchange,
  onCreditsChange,
  onBalanceRefreshNeeded,
}: PersonalStylistVoicePanelProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const tabBarHeightContext = useContext(BottomTabBarHeightContext);
  const tabBarHeight =
    typeof tabBarHeightContext === 'number' && tabBarHeightContext > 0
      ? tabBarHeightContext
      : TAB_BAR_HEIGHT + insets.bottom;
  const controlsBottomPad = tabBarHeight + Spacing.lg;
  const {
    hasCredits,
    isLoading: creditsLoading,
    balanceError,
    denialMessage,
    updateBalance,
    refreshBalance,
    shouldShowBuyPacks,
  } = useVoiceCredits();

  const applyCreditsUpdate = (credits: Parameters<NonNullable<PersonalStylistVoicePanelProps['onCreditsChange']>>[0]) => {
    updateBalance(credits);
    onCreditsChange?.(credits);
  };

  const [showCreditsModal, setShowCreditsModal] = useState(false);

  const gradientColors: readonly [string, string] =
    stylist.id === 'ruby'
      ? ['#f093fb', '#f5576c']
      : stylist.id === 'ivy'
        ? ['#059669', '#0d9488']
        : ['#667eea', '#764ba2'];

  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [transcript, setTranscript] = useState('');
  const [processingPhase, setProcessingPhase] = useState<'transcribing' | 'answering'>('answering');
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

  useEffect(() => {
    // Always re-check server balance when opening voice mode
    refreshBalance();
  }, [refreshBalance]);

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

    const stylistName = stylist.name || stylist.id || 'Ace';
    const isNonRetryableVoiceError = (err: unknown): boolean => {
      if (!(err instanceof Error)) return false;
      const e = err as Error & { status?: number; statusCode?: number; voiceCreditsExhausted?: boolean };
      if (e.voiceCreditsExhausted) return true;
      const status = e.status ?? e.statusCode;
      if (status === 401 || status === 402 || status === 403) return true;
      // Other 4xx are client/request issues — don't burn a second STT+LLM+TTS path
      if (typeof status === 'number' && status >= 400 && status < 500) return true;
      const msg = e.message.toLowerCase();
      if (
        msg.includes('sign in') ||
        msg.includes('spoken replies') ||
        msg.includes('voice credits') ||
        msg.includes('spoken reply limit')
      ) {
        return true;
      }
      return false;
    };

    try {
      const token = await apiService.getToken();
      if (!token) {
        throw new Error('Please sign in to use voice mode.');
      }

      if (!hasCredits) {
        throw new Error(denialMessage);
      }

      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No recording found.');

      setProcessingPhase('transcribing');
      setTranscript('Transcribing…');
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const mimeType = getMimeTypeFromUri(uri);
      const voiceRange = stylist.gender === 'female' ? 'mezzo-soprano' : 'baritone';

      let userMessage = '';
      let aiResponse = '';
      let audioBase64Out: string | null = null;

      try {
        setProcessingPhase('answering');
        setTranscript(`${stylistName} is answering…`);
        const response = await apiService.voiceChat({
          audio: audioBase64,
          mimeType,
          stylist: stylist.id,
          accent,
          voiceRange,
          language: effectiveLanguage,
        });

        if (response.voiceCreditsExhausted) {
          const creditErr = new Error(
            response.message || "You've used your spoken replies for now. Add credits or switch to Chat.",
          ) as Error & { voiceCreditsExhausted?: boolean; status?: number };
          creditErr.voiceCreditsExhausted = true;
          creditErr.status = 402;
          throw creditErr;
        }

        if (response.success !== false && response.aiResponse) {
          userMessage = response.userMessage || 'Voice message';
          aiResponse = response.aiResponse;
          audioBase64Out = response.audioBase64;
          if (response.voiceCredits) {
            applyCreditsUpdate(response.voiceCredits);
          }
        } else {
          throw new Error(response.message || 'Voice session failed');
        }
      } catch (primaryErr) {
        if (isNonRetryableVoiceError(primaryErr)) {
          throw primaryErr;
        }

        // Transport / 5xx only — avoid silently doubling STT+LLM+TTS on credit/auth errors
        console.log('[VoicePanel] Primary voice-chat failed, trying resilient fallback:', primaryErr);
        setProcessingPhase('answering');
        setTranscript(`${stylistName} is answering…`);
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
          accent,
          voiceRange,
          language: effectiveLanguage,
          wardrobeItems,
        });

        if (chatResponse.voiceCreditsExhausted) {
          setError(chatResponse.voiceError?.message || "Spoken replies used up — text reply below. Add credits anytime to keep talking.");
        }
        if (chatResponse.voiceCredits) {
          applyCreditsUpdate(chatResponse.voiceCredits);
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
      onBalanceRefreshNeeded?.();
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
      setError(denialMessage);
      if (balanceError) {
        refreshBalance();
      } else {
        setShowCreditsModal(true);
      }
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
    void refreshBalance();
    onBalanceRefreshNeeded?.();
  };

  const stateLabel =
    conversationState === 'listening'
      ? 'Listening… tap when done'
      : conversationState === 'processing'
        ? processingPhase === 'transcribing'
          ? 'Transcribing…'
          : `${stylist.name} is answering…`
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

        {!hasCredits && !creditsLoading ? (
          <Pressable
            onPress={() => (balanceError ? refreshBalance() : setShowCreditsModal(true))}
            style={({ pressed }) => [
              styles.buyCreditsButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <ThemedText style={styles.buyCreditsText}>
              {balanceError ? 'Retry' : shouldShowBuyPacks ? 'Top up' : 'Buy credits'}
            </ThemedText>
          </Pressable>
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
