import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from "@/hooks/useTheme";
import apiService from "@/services/ApiService";

type VideoCallParams = {
  callId?: string;
  roomUrl: string;
  roomToken?: string;
  calleeId?: string;
  calleeName?: string;
  sessionId?: string;
  isStylistSession?: boolean;
};

type VideoCallScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ VideoCall: VideoCallParams }, 'VideoCall'>;
};

export default function VideoCallScreen({ navigation, route }: VideoCallScreenProps) {
  const { callId, roomUrl, calleeName, isStylistSession } = route.params;
  const { theme } = useTheme();

  const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'active') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCallStatus('active');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    setIsEnding(true);
    try {
      if (callId && apiService.isConfigured()) {
        await apiService.endCall(callId);
      }
      setCallStatus('ended');
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to end call:', error);
      navigation.goBack();
    }
  };

  const handleOpenInBrowser = async () => {
    try {
      await WebBrowser.openBrowserAsync(roomUrl);
    } catch (error) {
      Alert.alert('Error', 'Failed to open video call in browser');
    }
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <ThemedText type="body" style={{ opacity: 0.7 }}>
            {isStylistSession ? 'Stylist Session' : 'VIP Video Call'}
          </ThemedText>
          {callStatus === 'active' ? (
            <ThemedText type="h3" style={{ color: '#10B981' }}>
              {formatDuration(callDuration)}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.callContainer}>
        <View style={[styles.participantCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={[styles.avatar, { backgroundColor: theme.link + '20' }]}>
            <ThemedText type="h1" style={{ color: theme.link }}>
              {(calleeName || 'VIP').charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText type="h2" style={{ marginTop: Spacing.lg }}>
            {calleeName || 'VIP Member'}
          </ThemedText>

          {callStatus === 'connecting' ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={theme.link} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, opacity: 0.7 }}>
                Connecting...
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.activeBadge, { backgroundColor: '#10B98120' }]}>
              <View style={[styles.activeDot, { backgroundColor: '#10B981' }]} />
              <ThemedText type="body" style={{ color: '#10B981' }}>
                Call Active
              </ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: theme.link + '15' }]}>
          <Feather name="info" size={16} color={theme.link} />
          <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, opacity: 0.7 }}>
            Video calls are hosted on Dripn. Tap the button below to join the video room in your browser.
          </ThemedText>
        </View>

        <Button
          onPress={handleOpenInBrowser}
          style={[styles.joinButton, { backgroundColor: theme.link }]}
        >
          Join Video Room
        </Button>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.controlButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="mic" size={24} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={handleEndCall}
            disabled={isEnding}
            style={({ pressed }) => [
              styles.endCallButton,
              { backgroundColor: '#EF4444', opacity: pressed || isEnding ? 0.7 : 1 },
            ]}
          >
            {isEnding ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather name="phone-off" size={28} color="#FFF" />
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.controlButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="video" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingBottom: Spacing.md,
  },
  headerInfo: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  callContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantCard: {
    width: '100%',
    paddingVertical: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  joinButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
  },
  controls: {
    paddingTop: Spacing.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
