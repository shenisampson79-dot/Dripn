import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Image, Alert, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts, PostType } from "@/contexts/PostsContext";

interface CreatePostScreenProps {
  onClose: () => void;
}

export default function CreatePostScreen({ onClose }: CreatePostScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { createPost } = usePosts();

  const [postType, setPostType] = useState<PostType>("standard");
  const [images, setImages] = useState<{ id: string; uri: string }[]>([]);
  const [description, setDescription] = useState("");
  const [requestAIAdvice, setRequestAIAdvice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxImages = postType === "comparison" ? 2 : 1;

  const handlePickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert("Limit Reached", `You can only add ${maxImages} image(s) for this post type.`);
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library to add images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImages([...images, { id: Date.now().toString(), uri: result.assets[0].uri }]);
    }
  };

  const handleTakePhoto = async () => {
    if (images.length >= maxImages) {
      Alert.alert("Limit Reached", `You can only add ${maxImages} image(s) for this post type.`);
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your camera to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImages([...images, { id: Date.now().toString(), uri: result.assets[0].uri }]);
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setImages(images.filter((img) => img.id !== imageId));
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      Alert.alert("Image Required", "Please add at least one image to your post.");
      return;
    }

    if (postType === "comparison" && images.length < 2) {
      Alert.alert("Two Images Required", "Please add two images for a comparison post.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Description Required", "Please add a description to your post.");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to create a post.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPost({
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        userSubscriptionTier: user.subscriptionTier,
        type: postType,
        images: images.map((img) => ({
          id: img.id,
          uri: img.uri,
          votes: postType === "comparison" ? 0 : undefined,
        })),
        description: description.trim(),
        isAIAdviceRequested: requestAIAdvice,
        aiAdvice: requestAIAdvice
          ? "Great outfit choice! The colors work well together, and the silhouette is flattering. Consider adding a statement accessory to elevate the look."
          : undefined,
      });
      onClose();
    } catch (error) {
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">New Post</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Post Type
          </ThemedText>
          <View style={styles.typeSelector}>
            <Pressable
              onPress={() => {
                setPostType("standard");
                if (images.length > 1) setImages([images[0]]);
              }}
              style={[
                styles.typeOption,
                {
                  backgroundColor:
                    postType === "standard" ? theme.link : theme.backgroundDefault,
                },
              ]}
            >
              <Feather
                name="image"
                size={20}
                color={postType === "standard" ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="body"
                style={{ color: postType === "standard" ? "#FFFFFF" : theme.text }}
              >
                Standard
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setPostType("comparison")}
              style={[
                styles.typeOption,
                {
                  backgroundColor:
                    postType === "comparison" ? theme.link : theme.backgroundDefault,
                },
              ]}
            >
              <Feather
                name="columns"
                size={20}
                color={postType === "comparison" ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="body"
                style={{ color: postType === "comparison" ? "#FFFFFF" : theme.text }}
              >
                Help Me Choose
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            {postType === "comparison" ? "Add 2 Options" : "Add Photo"}
          </ThemedText>
          <View style={styles.imagesContainer}>
            {images.map((image) => (
              <View key={image.id} style={styles.imageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                <Pressable
                  onPress={() => handleRemoveImage(image.id)}
                  style={[styles.removeImageButton, { backgroundColor: theme.error || "#FF3B30" }]}
                >
                  <Feather name="x" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {images.length < maxImages ? (
              <View style={styles.addImageButtons}>
                <Pressable
                  onPress={handlePickImage}
                  style={[styles.addImageButton, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="image" size={28} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={styles.addImageText}>
                    Gallery
                  </ThemedText>
                </Pressable>
                {Platform.OS !== "web" ? (
                  <Pressable
                    onPress={handleTakePhoto}
                    style={[styles.addImageButton, { backgroundColor: theme.backgroundDefault }]}
                  >
                    <Feather name="camera" size={28} color={theme.tabIconDefault} />
                    <ThemedText type="small" style={styles.addImageText}>
                      Camera
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Description
          </ThemedText>
          <TextInput
            style={[
              styles.descriptionInput,
              { backgroundColor: theme.backgroundDefault, color: theme.text },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder={
              postType === "comparison"
                ? "Tell us about your dilemma - which option do you prefer?"
                : "Describe your outfit and what you'd like feedback on..."
            }
            placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <ThemedText type="caption" style={styles.characterCount}>
            {description.length}/500
          </ThemedText>
        </View>

        <View style={styles.section}>
          <Pressable
            onPress={() => setRequestAIAdvice(!requestAIAdvice)}
            style={styles.aiToggle}
          >
            <View style={styles.aiToggleContent}>
              <Feather name="cpu" size={20} color={theme.link} />
              <View style={styles.aiToggleText}>
                <ThemedText type="body" style={styles.aiToggleTitle}>
                  Get AI Styling Advice
                </ThemedText>
                <ThemedText type="small" style={styles.aiToggleSubtitle}>
                  StyleWise AI will analyze your outfit
                </ThemedText>
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: requestAIAdvice ? theme.link : "transparent",
                  borderColor: requestAIAdvice ? theme.link : theme.tabIconDefault,
                },
              ]}
            >
              {requestAIAdvice ? (
                <Feather name="check" size={14} color="#FFFFFF" />
              ) : null}
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.lg },
        ]}
      >
        <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.submitButton}>
          {isSubmitting ? "Posting..." : "Share with Community"}
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.1)",
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  imagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  imageWrapper: {
    position: "relative",
  },
  imagePreview: {
    width: 140,
    height: 140,
    borderRadius: BorderRadius.md,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addImageButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  addImageText: {
    opacity: 0.7,
  },
  descriptionInput: {
    minHeight: 120,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.body.fontSize,
  },
  characterCount: {
    textAlign: "right",
    opacity: 0.5,
    marginTop: Spacing.xs,
  },
  aiToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiToggleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  aiToggleText: {
    flex: 1,
  },
  aiToggleTitle: {
    fontWeight: "600",
  },
  aiToggleSubtitle: {
    opacity: 0.7,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  submitButton: {
    width: "100%",
  },
});
