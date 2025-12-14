/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image, TextInput, ActivityIndicator, Share } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, StyleThemes, StyleTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSocial } from "@/contexts/SocialContext";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type SocialStyleSyncScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "SocialStyleSync">;
};

interface SyncedFriend {
  id: string;
  name: string;
  avatar?: string;
  syncedAt: Date;
  styleMatch: number;
  sharedPreferences: string[];
  lastActive: string;
}

interface StylePreference {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  enabled: boolean;
}

const STYLE_PREFERENCES: StylePreference[] = [
  { id: "color-palette", label: "Color Palette", icon: "droplet", enabled: true },
  { id: "brands", label: "Favorite Brands", icon: "tag", enabled: true },
  { id: "occasions", label: "Occasion Styles", icon: "calendar", enabled: true },
  { id: "wardrobe", label: "Wardrobe Items", icon: "shopping-bag", enabled: false },
  { id: "trends", label: "Trend Preferences", icon: "trending-up", enabled: true },
  { id: "budget", label: "Budget Range", icon: "dollar-sign", enabled: false },
];

const MOCK_SYNCED_FRIENDS: SyncedFriend[] = [
  {
    id: "1",
    name: "Sarah Chen",
    avatar: "https://randomuser.me/api/portraits/women/1.jpg",
    syncedAt: new Date(Date.now() - 86400000 * 2),
    styleMatch: 87,
    sharedPreferences: ["Colors", "Brands", "Trends"],
    lastActive: "2 hours ago",
  },
  {
    id: "2",
    name: "Emma Williams",
    avatar: "https://randomuser.me/api/portraits/women/2.jpg",
    syncedAt: new Date(Date.now() - 86400000 * 5),
    styleMatch: 72,
    sharedPreferences: ["Colors", "Occasions"],
    lastActive: "1 day ago",
  },
];

export default function SocialStyleSyncScreen({ navigation }: SocialStyleSyncScreenProps) {
  const { theme, isDark } = useTheme();
  const { friends } = useSocial();
  
  const [preferences, setPreferences] = useState<StylePreference[]>(STYLE_PREFERENCES);
  const [syncedFriends, setSyncedFriends] = useState<SyncedFriend[]>(MOCK_SYNCED_FRIENDS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCode, setSyncCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);

  const generateSyncCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const togglePreference = (prefId: string) => {
    setPreferences(prev =>
      prev.map(p => (p.id === prefId ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleShareCode = async () => {
    const code = generateSyncCode();
    try {
      await Share.share({
        message: `Connect with me on Dripn and sync our style preferences. Use code: ${code}\n\n#Dripn #StyleSync`,
        title: "Sync Styles on Dripn",
      });
    } catch (error) {}
  };

  const handleJoinWithCode = async () => {
    if (syncCode.length < 6) return;
    
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newFriend: SyncedFriend = {
      id: Date.now().toString(),
      name: "New Friend",
      syncedAt: new Date(),
      styleMatch: 75 + Math.floor(Math.random() * 20),
      sharedPreferences: preferences.filter(p => p.enabled).map(p => p.label),
      lastActive: "Just now",
    };
    
    setSyncedFriends(prev => [newFriend, ...prev]);
    setIsSyncing(false);
    setShowCodeInput(false);
    setSyncCode("");
  };

  const handleRemoveSync = (friendId: string) => {
    setSyncedFriends(prev => prev.filter(f => f.id !== friendId));
  };

  const enabledPreferencesCount = preferences.filter(p => p.enabled).length;

  const renderSyncedFriend = (friend: SyncedFriend) => (
    <Card key={friend.id} style={styles.friendCard}>
      <View style={styles.friendHeader}>
        <View style={[styles.avatarContainer, { borderColor: theme.link }]}>
          {friend.avatar ? (
            <Image source={{ uri: friend.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="user" size={24} color={theme.tabIconDefault} />
            </View>
          )}
        </View>
        
        <View style={styles.friendInfo}>
          <ThemedText type="h4">{friend.name}</ThemedText>
          <View style={styles.syncedRow}>
            <Feather name="link" size={12} color={theme.success} />
            <ThemedText type="caption" style={{ color: theme.success }}>
              Synced
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              - {friend.lastActive}
            </ThemedText>
          </View>
        </View>

        <View style={styles.matchBadge}>
          <ThemedText style={[styles.matchText, { color: theme.link }]}>
            {friend.styleMatch}%
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
            match
          </ThemedText>
        </View>
      </View>

      <View style={styles.sharedSection}>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
          Sharing:
        </ThemedText>
        <View style={styles.sharedTags}>
          {friend.sharedPreferences.map((pref) => (
            <View key={pref} style={[styles.sharedTag, { backgroundColor: theme.link + "20" }]}>
              <ThemedText type="caption" style={{ color: theme.link }}>{pref}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.friendActions}>
        <Pressable
          style={({ pressed }) => [
            styles.friendActionButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="message-circle" size={14} color={theme.text} />
          <ThemedText type="small" style={{ fontWeight: "500" }}>Message</ThemedText>
        </Pressable>
        
        <Pressable
          style={({ pressed }) => [
            styles.friendActionButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="eye" size={14} color={theme.text} />
          <ThemedText type="small" style={{ fontWeight: "500" }}>View Style</ThemedText>
        </Pressable>
        
        <Pressable
          onPress={() => handleRemoveSync(friend.id)}
          style={({ pressed }) => [
            styles.friendActionButton,
            styles.removeButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="x" size={14} color={theme.error} />
        </Pressable>
      </View>
    </Card>
  );

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={["#4facfe", "#00f2fe"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="users" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h1" style={styles.title}>Social Style Sync</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Connect with friends to share style preferences and get coordinated outfit suggestions
        </ThemedText>
      </View>

      <Card style={styles.preferencesCard}>
        <View style={styles.preferencesHeader}>
          <ThemedText type="h4">What to Share</ThemedText>
          <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
            {enabledPreferencesCount} of {preferences.length} enabled
          </ThemedText>
        </View>

        <View style={styles.preferencesGrid}>
          {preferences.map((pref) => (
            <Pressable
              key={pref.id}
              onPress={() => togglePreference(pref.id)}
              style={({ pressed }) => [
                styles.preferenceItem,
                {
                  backgroundColor: pref.enabled ? theme.link + "15" : theme.backgroundSecondary,
                  borderColor: pref.enabled ? theme.link : "transparent",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.preferenceIcon, { backgroundColor: pref.enabled ? theme.link : theme.tabIconDefault }]}>
                <Feather name={pref.icon} size={16} color="#FFFFFF" />
              </View>
              <ThemedText type="small" style={{ flex: 1, fontWeight: pref.enabled ? "600" : "400" }}>
                {pref.label}
              </ThemedText>
              <View style={[styles.checkbox, { borderColor: pref.enabled ? theme.link : theme.tabIconDefault }]}>
                {pref.enabled ? (
                  <Feather name="check" size={12} color={theme.link} />
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.connectCard}>
        <ThemedText type="h4" style={styles.connectTitle}>Connect with Friends</ThemedText>
        
        <View style={styles.connectOptions}>
          <Pressable
            onPress={handleShareCode}
            style={({ pressed }) => [styles.connectButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <LinearGradient
              colors={["#4facfe", "#00f2fe"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.connectButtonGradient}
            >
              <Feather name="share-2" size={18} color="#FFFFFF" />
              <ThemedText style={styles.connectButtonText}>Share Sync Code</ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => setShowCodeInput(!showCodeInput)}
            style={({ pressed }) => [
              styles.connectButtonAlt,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="link" size={18} color={theme.text} />
            <ThemedText style={{ fontWeight: "600" }}>Enter Code</ThemedText>
          </Pressable>
        </View>

        {showCodeInput ? (
          <View style={styles.codeInputSection}>
            <TextInput
              style={[
                styles.codeInput,
                { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Enter 6-digit code"
              placeholderTextColor={theme.tabIconDefault}
              value={syncCode}
              onChangeText={(text) => setSyncCode(text.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={handleJoinWithCode}
              disabled={syncCode.length < 6 || isSyncing}
              style={({ pressed }) => [
                styles.joinButton,
                {
                  backgroundColor: syncCode.length >= 6 ? theme.link : theme.backgroundSecondary,
                  opacity: pressed || syncCode.length < 6 || isSyncing ? 0.6 : 1,
                },
              ]}
            >
              {isSyncing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={{ color: syncCode.length >= 6 ? "#FFFFFF" : theme.tabIconDefault, fontWeight: "600" }}>
                  Join
                </ThemedText>
              )}
            </Pressable>
          </View>
        ) : null}
      </Card>

      <View style={styles.friendsSection}>
        <View style={styles.friendsHeader}>
          <ThemedText type="h3">Synced Friends</ThemedText>
          <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
            {syncedFriends.length} connected
          </ThemedText>
        </View>

        {syncedFriends.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="users" size={48} color={theme.tabIconDefault} />
            <ThemedText type="h4" style={styles.emptyTitle}>No Synced Friends Yet</ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
              Share your sync code with friends to start sharing style preferences
            </ThemedText>
          </Card>
        ) : (
          <View style={styles.friendsList}>
            {syncedFriends.map(renderSyncedFriend)}
          </View>
        )}
      </View>

      <Card style={styles.benefitsCard}>
        <View style={styles.benefitsHeader}>
          <Feather name="zap" size={18} color={theme.warning} />
          <ThemedText type="h4">Sync Benefits</ThemedText>
        </View>
        <View style={styles.benefitsList}>
          {[
            "Get outfit suggestions based on combined preferences",
            "Coordinate looks for events you attend together",
            "Discover new styles through friends recommendations",
            "Shop together with shared wishlists",
          ].map((benefit, index) => (
            <View key={index} style={styles.benefitItem}>
              <Feather name="check-circle" size={14} color={theme.success} />
              <ThemedText type="small" style={{ flex: 1, lineHeight: 20 }}>{benefit}</ThemedText>
            </View>
          ))}
        </View>
      </Card>
    </ScreenKeyboardAwareScrollView>
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
  preferencesCard: {
    padding: Spacing.lg,
  },
  preferencesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  preferencesGrid: {
    gap: Spacing.sm,
  },
  preferenceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  preferenceIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  connectCard: {
    padding: Spacing.lg,
  },
  connectTitle: {
    marginBottom: Spacing.md,
  },
  connectOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  connectButton: {
    flex: 1,
  },
  connectButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  connectButtonAlt: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  codeInputSection: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  codeInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  joinButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  friendsSection: {
    gap: Spacing.md,
  },
  friendsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  friendsList: {
    gap: Spacing.md,
  },
  friendCard: {
    padding: Spacing.md,
  },
  friendHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  friendInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  syncedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  matchBadge: {
    alignItems: "center",
  },
  matchText: {
    fontSize: 18,
    fontWeight: "700",
  },
  sharedSection: {
    marginBottom: Spacing.md,
  },
  sharedTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  sharedTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  friendActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  friendActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  removeButton: {
    flex: 0,
    width: 40,
    backgroundColor: "rgba(200, 50, 50, 0.1)",
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
  benefitsCard: {
    padding: Spacing.lg,
  },
  benefitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  benefitsList: {
    gap: Spacing.sm,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
});
