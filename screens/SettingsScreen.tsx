import React from "react";
import { StyleSheet, View, Pressable, Alert, Linking, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StyleTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Settings">;
};

interface SettingItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
  theme: any;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  danger = false,
  theme,
}: SettingItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.settingIconContainer}>
        <Feather
          name={icon}
          size={20}
          color={danger ? theme.error || "#FF3B30" : theme.text}
        />
      </View>
      <View style={styles.settingContent}>
        <ThemedText
          type="body"
          style={[
            styles.settingTitle,
            danger && { color: theme.error || "#FF3B30" },
          ]}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={styles.settingSubtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {showChevron ? (
        <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
      ) : null}
    </Pressable>
  );
}

const STYLE_NAMES: Record<StyleTheme, string> = {
  luxury: "Luxury",
  streetwear: "Streetwear",
  boho: "Boho",
  sporty: "Sporty",
  romantic: "Romantic",
  edgy: "Edgy",
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { theme } = useTheme();
  const { user, logout, updateProfile } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Deletion",
              "This will permanently delete all your data, posts, and comments. Are you absolutely sure?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    await logout();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleChangeStyle = () => {
    Alert.alert(
      "Change Style Theme",
      "Choose your preferred style:",
      [
        { text: "Luxury", onPress: () => updateProfile({ stylePreference: "luxury" }) },
        { text: "Streetwear", onPress: () => updateProfile({ stylePreference: "streetwear" }) },
        { text: "Boho", onPress: () => updateProfile({ stylePreference: "boho" }) },
        { text: "Sporty", onPress: () => updateProfile({ stylePreference: "sporty" }) },
        { text: "Romantic", onPress: () => updateProfile({ stylePreference: "romantic" }) },
        { text: "Edgy", onPress: () => updateProfile({ stylePreference: "edgy" }) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleFeedPreference = () => {
    Alert.alert(
      "Feed Preference",
      "Choose your default feed:",
      [
        { text: "Global", onPress: () => updateProfile({ feedPreference: "global" }) },
        { text: "Prioritize My Region", onPress: () => updateProfile({ feedPreference: "regional" }) },
        { text: "Local Only", onPress: () => updateProfile({ feedPreference: "local" }) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handlePrivacy = () => {
    Linking.openURL("https://stylewise.app/privacy");
  };

  const handleTerms = () => {
    Linking.openURL("https://stylewise.app/terms");
  };

  const handleSupport = () => {
    Linking.openURL("mailto:support@stylewise.app");
  };

  return (
    <ScreenScrollView>
      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Account
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="user"
            title="Edit Profile"
            subtitle={user?.name}
            onPress={() => navigation.navigate("EditProfile")}
            theme={theme}
          />
          <SettingItem
            icon="credit-card"
            title="Subscription"
            subtitle={user?.subscriptionTier === "free" ? "Free Plan" : `${user?.subscriptionTier} Plan`}
            onPress={() => navigation.navigate("Subscription")}
            theme={theme}
          />
          <SettingItem
            icon="mail"
            title="Email"
            subtitle={user?.email}
            onPress={() => {}}
            showChevron={false}
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Preferences
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="palette"
            title="Style Theme"
            subtitle={STYLE_NAMES[user?.stylePreference || "luxury"]}
            onPress={handleChangeStyle}
            theme={theme}
          />
          <SettingItem
            icon="globe"
            title="Feed Preference"
            subtitle={
              user?.feedPreference === "global"
                ? "Global"
                : user?.feedPreference === "regional"
                  ? "My Region"
                  : "Local Only"
            }
            onPress={handleFeedPreference}
            theme={theme}
          />
          <SettingItem
            icon="map-pin"
            title="Country"
            subtitle={user?.country}
            onPress={() => {}}
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Support
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="help-circle"
            title="Help & Support"
            onPress={handleSupport}
            theme={theme}
          />
          <SettingItem
            icon="file-text"
            title="Terms of Service"
            onPress={handleTerms}
            theme={theme}
          />
          <SettingItem
            icon="shield"
            title="Privacy Policy"
            onPress={handlePrivacy}
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Account Actions
        </ThemedText>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="log-out"
            title="Sign Out"
            onPress={handleLogout}
            showChevron={false}
            theme={theme}
          />
          <SettingItem
            icon="trash-2"
            title="Delete Account"
            onPress={handleDeleteAccount}
            showChevron={false}
            danger
            theme={theme}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={styles.versionText}>
          StyleWise v1.0.0
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  sectionContent: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    gap: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingIconContainer: {
    width: 24,
    alignItems: "center",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontWeight: "500",
  },
  settingSubtitle: {
    opacity: 0.6,
    marginTop: 2,
  },
  footer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  versionText: {
    opacity: 0.5,
  },
});
