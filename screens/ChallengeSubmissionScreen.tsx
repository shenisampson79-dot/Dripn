import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Image, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useGamification } from "@/contexts/GamificationContext";
import { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type NavigationProp = NativeStackNavigationProp<DiscoverStackParamList>;
type RouteType = RouteProp<DiscoverStackParamList, "ChallengeSubmission">;

export default function ChallengeSubmissionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { challengeId } = route.params;
  const { theme, isDark } = useTheme();
  const { challenges, submitChallengeEntry, joinChallenge } = useGamification();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const challenge = challenges.find((c) => c.id === challengeId);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to select an image."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setImageUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take a photo."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setImageUri(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImageUri(null);
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert("Image Required", "Please add a photo of your outfit.");
      return;
    }

    if (!caption.trim()) {
      Alert.alert("Caption Required", "Please add a caption for your entry.");
      return;
    }

    if (!challenge) {
      Alert.alert("Error", "Challenge not found.");
      return;
    }

    setIsSubmitting(true);
    try {
      await joinChallenge(challengeId);
      await submitChallengeEntry(challengeId, imageUri, caption.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Entry Submitted",
        "Your outfit has been submitted to the challenge. Good luck!",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to submit entry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!challenge) {
    return (
      <ThemedView style={styles.notFoundContainer}>
        <Feather name="alert-circle" size={48} color={theme.tabIconDefault} />
        <ThemedText type="h3">Challenge Not Found</ThemedText>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </ThemedView>
    );
  }

  if (!challenge.isActive) {
    return (
      <ThemedView style={styles.notFoundContainer}>
        <Feather name="clock" size={48} color={theme.tabIconDefault} />
        <ThemedText type="h3">Challenge Ended</ThemedText>
        <ThemedText type="body" style={{ textAlign: "center", opacity: 0.7 }}>
          This challenge is no longer accepting submissions.
        </ThemedText>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </ThemedView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <Card elevation={2} style={styles.challengeCard}>
        <View style={styles.challengeHeader}>
          <View style={[styles.themeIcon, { backgroundColor: theme.link + "15" }]}>
            <Feather name="flag" size={20} color={theme.link} />
          </View>
          <View style={styles.challengeInfo}>
            <ThemedText type="h3">{challenge.title}</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {challenge.theme}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="body" style={styles.challengeDescription}>
          {challenge.description}
        </ThemedText>
        <View style={styles.rewardRow}>
          <Feather name="gift" size={14} color={theme.link} />
          <ThemedText type="small" style={{ color: theme.link }}>
            {challenge.rewardPoints} points reward
          </ThemedText>
        </View>
      </Card>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Your Outfit Photo
        </ThemedText>

        {imageUri ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.selectedImage} />
            <Pressable
              onPress={handleRemoveImage}
              style={[styles.removeButton, { backgroundColor: theme.error || "#FF3B30" }]}
            >
              <Feather name="x" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <View style={styles.imageButtons}>
              <Pressable
                onPress={handlePickImage}
                style={[styles.imageButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="image" size={28} color={theme.link} />
                <ThemedText type="body">Gallery</ThemedText>
              </Pressable>
              {Platform.OS !== "web" ? (
                <Pressable
                  onPress={handleTakePhoto}
                  style={[styles.imageButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="camera" size={28} color={theme.link} />
                  <ThemedText type="body">Camera</ThemedText>
                </Pressable>
              ) : (
                <View
                  style={[styles.imageButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="smartphone" size={28} color={theme.tabIconDefault} />
                  <ThemedText type="caption" style={{ textAlign: "center" }}>
                    Use Expo Go for camera
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Caption
        </ThemedText>
        <ThemedText type="small" style={styles.captionHint}>
          Describe your outfit and what inspired your look
        </ThemedText>
        <TextInput
          style={[
            styles.captionInput,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          value={caption}
          onChangeText={setCaption}
          placeholder="Tell us about your outfit..."
          placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
          multiline
          maxLength={200}
          textAlignVertical="top"
        />
        <ThemedText type="caption" style={styles.characterCount}>
          {caption.length}/200
        </ThemedText>
      </View>

      <View style={styles.tipsCard}>
        <View style={[styles.tipsHeader, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="info" size={16} color={theme.link} />
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            Tips for a Great Entry
          </ThemedText>
        </View>
        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <Feather name="check" size={14} color={theme.link} />
            <ThemedText type="small">Use good lighting for your photo</ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Feather name="check" size={14} color={theme.link} />
            <ThemedText type="small">Show your full outfit clearly</ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Feather name="check" size={14} color={theme.link} />
            <ThemedText type="small">Match the challenge theme</ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Feather name="check" size={14} color={theme.link} />
            <ThemedText type="small">Write an engaging caption</ThemedText>
          </View>
        </View>
      </View>

      <Button
        onPress={handleSubmit}
        disabled={isSubmitting || !imageUri || !caption.trim()}
        style={styles.submitButton}
      >
        {isSubmitting ? "Submitting..." : "Submit Entry"}
      </Button>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  challengeCard: {
    gap: Spacing.md,
  },
  challengeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  themeIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  challengeInfo: {
    flex: 1,
    gap: 2,
  },
  challengeDescription: {
    opacity: 0.8,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  captionHint: {
    opacity: 0.7,
  },
  imageContainer: {
    position: "relative",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  selectedImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: BorderRadius.xl,
  },
  removeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholder: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  imageButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  imageButton: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
  },
  captionInput: {
    minHeight: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  characterCount: {
    textAlign: "right",
    opacity: 0.5,
  },
  tipsCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  tipsList: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
});
