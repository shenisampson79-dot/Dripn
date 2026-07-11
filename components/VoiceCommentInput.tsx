import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Pressable, Platform, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
  type AudioPlayer,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { ThemedText } from "./ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useTranslations } from "@/contexts/TranslationContext";

interface VoiceCommentInputProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number;
}

export function VoiceCommentInput({
  onRecordingComplete,
  onCancel,
  maxDuration = 60,
}: VoiceCommentInputProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { canRecordVoice } = useSubscription();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseScale = useSharedValue(1);
  const waveformBars = Array(5).fill(0).map(() => useSharedValue(0.3));

  useEffect(() => {
    checkPermissions();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      cancelAnimation(pulseScale);
      waveformBars.forEach((bar) => cancelAnimation(bar));
      stopRecording(true);
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );

      waveformBars.forEach((bar, index) => {
        bar.value = withRepeat(
          withSequence(
            withTiming(0.3 + Math.random() * 0.7, { duration: 200 + index * 50 }),
            withTiming(0.3, { duration: 200 + index * 50 })
          ),
          -1,
          true
        );
      });
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withSpring(1);
      waveformBars.forEach((bar) => {
        cancelAnimation(bar);
        bar.value = withSpring(0.3);
      });
    }
  }, [isRecording]);

  const checkPermissions = async () => {
    if (Platform.OS === "web") {
      setHasPermission(false);
      return;
    }

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      setHasPermission(granted);
    } catch (error) {
      setHasPermission(false);
    }
  };

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    if (!canRecordVoice()) {
      Alert.alert(
        t('voiceComment.limitReached') || "Voice Comment Limit Reached",
        t('voiceComment.limitReachedMessage'),
        [{ text: t('common.ok') || "OK" }]
      );
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setRecordingDuration(0);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= maxDuration - 1) {
            stopRecording(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert(t('voiceComment.recordingError'), t('aiStylist.couldNotStartRecording'));
    }
  };

  const stopRecording = async (cancelled: boolean) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!audioRecorder.isRecording && !audioRecorder.uri) {
      setIsRecording(false);
      return;
    }

    try {
      await audioRecorder.stop();
      setIsRecording(false);

      if (cancelled) {
        onCancel();
        return;
      }

      const uri = audioRecorder.uri;
      if (uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRecordingComplete(uri, recordingDuration);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="mic-off" size={20} color={theme.tabIconDefault} />
        <ThemedText type="small" style={styles.webMessage}>
          Voice recording is available in Expo Go
        </ThemedText>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable onPress={checkPermissions} style={styles.permissionButton}>
          <Feather name="mic" size={20} color={theme.link} />
          <ThemedText type="small" style={{ color: theme.link }}>
            Enable microphone access
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      {isRecording ? (
        <>
          <View style={styles.waveformContainer}>
            {waveformBars.map((bar, index) => {
              const animatedStyle = useAnimatedStyle(() => ({
                height: 20 * bar.value,
              }));
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.waveformBar,
                    { backgroundColor: theme.link },
                    animatedStyle,
                  ]}
                />
              );
            })}
          </View>

          <ThemedText type="body" style={styles.duration}>
            {formatDuration(recordingDuration)}
          </ThemedText>
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            {t('voiceComment.releaseToSend') || 'Release to send'}
          </ThemedText>

          <View style={styles.recordingActions}>
            <Pressable
              onPress={() => stopRecording(true)}
              style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>

            <Animated.View style={pulseAnimatedStyle}>
              <Pressable
                onPress={() => stopRecording(false)}
                style={[styles.stopButton, { backgroundColor: "#EF4444" }]}
              >
                <View style={styles.stopIcon} />
              </Pressable>
            </Animated.View>
          </View>
        </>
      ) : (
        <Pressable
          onPress={startRecording}
          style={({ pressed }) => [
            styles.recordButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="mic" size={20} color="#FFFFFF" />
          <ThemedText type="small" style={styles.recordButtonText}>
            {t('voiceComment.holdToRecord') || 'Hold to record'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

interface VoiceCommentPlayerProps {
  uri: string;
  duration: number;
  transcript?: string;
}

export function VoiceCommentPlayer({ uri, duration, transcript }: VoiceCommentPlayerProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlayback = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t('voiceComment.notAvailable'), t('voiceComment.playbackAvailableInExpoGo'));
      return;
    }

    try {
      if (isPlaying && playerRef.current) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        if (!playerRef.current) {
          const player = createAudioPlayer({ uri });
          playerRef.current = player;
          player.addListener("playbackStatusUpdate", (status) => {
            if (status.currentTime && status.duration) {
              setProgress(status.currentTime / status.duration);
            }
            if (status.didJustFinish) {
              setIsPlaying(false);
              setProgress(0);
            }
          });
          player.play();
        } else {
          playerRef.current.play();
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  return (
    <View style={[styles.playerContainer, { backgroundColor: theme.backgroundDefault }]}>
      <Pressable
        onPress={togglePlayback}
        style={[styles.playButton, { backgroundColor: theme.link }]}
      >
        <Feather name={isPlaying ? "pause" : "play"} size={16} color="#FFFFFF" />
      </Pressable>

      <View style={styles.playerContent}>
        <View style={styles.waveformRow}>
          {Array(15)
            .fill(0)
            .map((_, index) => {
              const barProgress = (index + 1) / 15;
              const isActive = progress >= barProgress;
              return (
                <View
                  key={index}
                  style={[
                    styles.playerWaveformBar,
                    {
                      height: 8 + Math.sin(index * 0.8) * 6,
                      backgroundColor: isActive ? theme.link : theme.tabIconDefault,
                      opacity: isActive ? 1 : 0.3,
                    },
                  ]}
                />
              );
            })}
        </View>

        <ThemedText type="caption" style={styles.playerDuration}>
          {formatDuration(Math.round(duration * progress))} / {formatDuration(duration)}
        </ThemedText>
      </View>

      {transcript ? (
        <ThemedText type="caption" style={styles.transcript} numberOfLines={2}>
          {transcript}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  webMessage: {
    opacity: 0.7,
    flex: 1,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 24,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  duration: {
    minWidth: 50,
    fontWeight: "600",
  },
  recordingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginLeft: "auto",
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    flex: 1,
    justifyContent: "center",
  },
  recordButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  playerContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playerContent: {
    flex: 1,
    gap: 4,
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 20,
  },
  playerWaveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  playerDuration: {
    opacity: 0.6,
  },
  transcript: {
    width: "100%",
    opacity: 0.7,
    fontStyle: "italic",
    marginTop: Spacing.xs,
  },
});
