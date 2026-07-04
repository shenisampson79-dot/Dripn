import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ScreenFlatList } from "@/components/ScreenFlatList";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import apiService from "@/services/ApiService";

interface VIPMember {
  id: string;
  displayName: string;
  avatarUrl?: string;
  email: string;
  isOnline?: boolean;
}

type VIPMembersScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function VIPMembersScreen({ navigation }: VIPMembersScreenProps) {
  const { theme } = useTheme();
  const { limits, tier } = useSubscription();

  const [members, setMembers] = useState<VIPMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiatingCall, setIsInitiatingCall] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      setError(null);
      if (!apiService.isConfigured()) {
        setError('Backend API not configured. Please set EXPO_PUBLIC_API_URL to enable VIP video calling.');
        setIsLoading(false);
        return;
      }
      const data = await apiService.getVIPMembers();
      setMembers(data);
    } catch (err: any) {
      console.error('Failed to load VIP members:', err);
      setError(err.message || 'Failed to load VIP members');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleCall = async (member: VIPMember) => {
    if (!limits.canMakeVideoCalls) {
      Alert.alert(
        'VIP Feature',
        'Video calling is exclusively available for VIP members. Upgrade to VIP to connect with other VIP members through video calls.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View VIP', onPress: () => navigation.navigate('Subscription') },
        ]
      );
      return;
    }

    const isAvailable = member.isOnline !== false;
    if (!isAvailable) {
      Alert.alert('Member Offline', `${member.displayName} is currently offline. Try again later.`);
      return;
    }

    setIsInitiatingCall(member.id);
    try {
      const { callId, roomUrl, roomToken } = await apiService.initiateCall(member.id);
      navigation.navigate('VideoCall', {
        callId,
        roomUrl,
        roomToken,
        calleeId: member.id,
        calleeName: member.displayName,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to initiate call');
    } finally {
      setIsInitiatingCall(null);
    }
  };

  const renderHeader = () => (
    <>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">VIP Members</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.link + '15' }]}>
        <Feather name="info" size={16} color={theme.link} />
        <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, opacity: 0.8 }}>
          Start a video call with another VIP member. Calls are hosted exclusively on Dripn.
        </ThemedText>
      </View>
    </>
  );

  const renderMember = ({ item }: { item: VIPMember }) => {
    const isAvailable = item.isOnline !== false;
    return (
      <Card style={styles.memberCard}>
        <View style={styles.memberRow}>
          <View style={[styles.avatar, { backgroundColor: theme.link + '20' }]}>
            <ThemedText type="h3" style={{ color: theme.link }}>
              {item.displayName.charAt(0).toUpperCase()}
            </ThemedText>
            {isAvailable ? (
              <View style={[styles.onlineIndicator, { backgroundColor: '#10B981' }]} />
            ) : null}
          </View>
          <View style={styles.memberInfo}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              {item.displayName}
            </ThemedText>
            <View style={styles.statusRow}>
              <View style={[styles.vipBadge, { backgroundColor: '#F59E0B20' }]}>
                <Feather name="award" size={10} color="#F59E0B" />
                <ThemedText type="small" style={{ color: '#F59E0B', marginLeft: 2 }}>
                  VIP
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ opacity: 0.6 }}>
                {isAvailable ? 'Available' : 'Offline'}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={() => handleCall(item)}
            disabled={isInitiatingCall === item.id}
            style={({ pressed }) => [
              styles.callButton,
              {
                backgroundColor: isAvailable ? theme.link : theme.backgroundSecondary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {isInitiatingCall === item.id ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather
                name="video"
                size={20}
                color={isAvailable ? '#FFF' : theme.tabIconDefault}
              />
            )}
          </Pressable>
        </View>
      </Card>
    );
  };

  const renderEmptyOrError = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.link} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="alert-circle" size={48} color={theme.tabIconDefault} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, textAlign: 'center', opacity: 0.7, paddingHorizontal: Spacing.lg }}>
            {error}
          </ThemedText>
          <Button
            onPress={loadMembers}
            style={[styles.retryButton, { backgroundColor: theme.link }]}
          >
            Try Again
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Feather name="users" size={48} color={theme.tabIconDefault} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
          No VIP members available
        </ThemedText>
      </View>
    );
  };

  if (!limits.canMakeVideoCalls && tier === 'free') {
    return (
      <ScreenFlatList
        data={[]}
        keyExtractor={() => 'upgrade'}
        renderItem={() => null}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="arrow-left" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">VIP Members</ThemedText>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.upgradeContainer}>
              <View style={[styles.upgradeIcon, { backgroundColor: theme.link + '20' }]}>
                <Feather name="video" size={48} color={theme.link} />
              </View>
              <ThemedText type="h2" style={{ textAlign: 'center', marginTop: Spacing.lg }}>
                VIP Video Calling
              </ThemedText>
              <ThemedText
                type="body"
                style={{ textAlign: 'center', opacity: 0.7, marginTop: Spacing.sm }}
              >
                Connect with fellow VIP members through exclusive video calls. Share style tips, get outfit feedback, and build your fashion network.
              </ThemedText>
              <Button
                onPress={() => navigation.navigate('Subscription')}
                style={[styles.upgradeButton, { backgroundColor: theme.link }]}
              >
                Upgrade to VIP
              </Button>
            </View>
          </>
        }
      />
    );
  }

  return (
    <ScreenFlatList
      data={members}
      keyExtractor={(item) => item.id}
      renderItem={renderMember}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyOrError}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
    />
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  listContent: {
    flexGrow: 1,
  },
  memberCard: {
    padding: Spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  memberInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing["2xl"],
  },
  upgradeIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing["2xl"],
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
});
