import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Image, Alert, ScrollView, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts, PostType, PostMedia, POLL_TIME_FRAMES } from "@/contexts/PostsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { getNavigationRef } from "@/components/ErrorFallback";
import { navigateToSubscription } from "@/utils/navigateToSubscription";

interface CreatePostScreenProps {
  onClose: () => void;
}

export default function CreatePostScreen({ onClose }: CreatePostScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const { createPost } = usePosts();

  const openSubscriptionFromPaywall = () => {
    // Close modal only — do NOT clear usage counters / unlock gated actions
    onClose();
    const rootNav = getNavigationRef();
    if (rootNav?.isReady()) {
      navigateToSubscription(rootNav, "personal_stylist");
    }
  };

  const { 
    tier, 
    limits, 
    canUpload, 
    canRequestAIAdvice, 
    canCreatePoll,
    incrementUpload,
    incrementAIAdvice,
    incrementPoll,
    getRemainingUploads,
    getRemainingAIAdvice,
    getRemainingPolls,
  } = useSubscription();

  const [postType, setPostType] = useState<PostType>("standard");
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [description, setDescription] = useState("");
  const [requestAIAdvice, setRequestAIAdvice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTimeFrameIndex, setSelectedTimeFrameIndex] = useState(2);

  const maxMedia = postType === "comparison" ? limits.maxImagesPerPost : 1;
  const hasVideo = media.some(m => m.type === 'video');
  const remainingUploads = getRemainingUploads();
  const remainingAI = getRemainingAIAdvice();
  const remainingPolls = getRemainingPolls();

  const handlePickImage = async () => {
    if (media.length >= maxMedia) {
      Alert.alert(t('community.limitReached'), t('community.limitReachedMedia').replace('{n}', String(maxMedia)));
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t('community.permissionRequired'), t('community.pleaseAllowAccessToYourPhotoLibraryToAdd'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: limits.canUploadVideo ? ["images", "videos"] : ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      videoMaxDuration: limits.maxVideoSeconds,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      
      if (isVideo && !limits.canUploadVideo) {
        Alert.alert(t('community.upgradeRequired'), t('community.videoUploadsAreAvailableOnPersonalStylis'), [
          { text: t('common.cancel'), style: "cancel" },
          { text: t('common.upgrade'), onPress: openSubscriptionFromPaywall },
        ]);
        return;
      }

      if (isVideo && asset.duration && asset.duration / 1000 > limits.maxVideoSeconds) {
        Alert.alert(t('community.videoTooLong'), t('community.videoTooLongMessage').replace('{n}', String(limits.maxVideoSeconds)));
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMedia([...media, { 
        id: Date.now().toString(), 
        uri: asset.uri, 
        type: isVideo ? 'video' : 'image',
        duration: asset.duration ?? undefined,
      }]);
    }
  };

  const handleTakePhoto = async () => {
    if (media.length >= maxMedia) {
      Alert.alert(t('community.limitReached'), t('community.limitReachedMedia').replace('{n}', String(maxMedia)));
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t('community.permissionRequired'), t('community.pleaseAllowAccessToYourCameraToTakePhoto'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMedia([...media, { 
        id: Date.now().toString(), 
        uri: result.assets[0].uri, 
        type: 'image' 
      }]);
    }
  };

  const handleRecordVideo = async () => {
    if (!limits.canUploadVideo) {
      Alert.alert(t('community.upgradeRequired'), t('community.videoRecordingIsAvailableOnPersonalStyli'), [
        { text: t('common.cancel'), style: "cancel" },
        { text: t('common.upgrade'), onPress: openSubscriptionFromPaywall },
      ]);
      return;
    }

    if (media.length >= maxMedia) {
      Alert.alert(t('community.limitReached'), t('community.limitReachedMedia').replace('{n}', String(maxMedia)));
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t('community.permissionRequired'), t('community.pleaseAllowAccessToYourCameraToRecordVid'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      videoMaxDuration: limits.maxVideoSeconds,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMedia([...media, { 
        id: Date.now().toString(), 
        uri: result.assets[0].uri, 
        type: 'video',
        duration: result.assets[0].duration ?? undefined,
      }]);
    }
  };

  const handleRemoveMedia = (mediaId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMedia(media.filter((m) => m.id !== mediaId));
  };

  const handleSubmit = async () => {
    if (!canUpload()) {
      Alert.alert(
        t('community.uploadLimitReached'),
        t('community.uploadLimitMessage').replace('{n}', String(limits.uploadsPerMonth)),
        [
          { text: t('common.cancel'), style: "cancel" },
          { text: t('common.upgrade'), onPress: openSubscriptionFromPaywall },
        ]
      );
      return;
    }

    if (media.length === 0) {
      Alert.alert(t('community.mediaRequired'), t('community.pleaseAddAtLeastOnePhotoOrVideoToYourPos'));
      return;
    }

    if (postType === "comparison") {
      if (!canCreatePoll()) {
        Alert.alert(
          t('community.pollLimitReached'),
          t('community.pollLimitMessage').replace('{n}', String(limits.comparisonPollsPerMonth)),
          [
            { text: t('common.cancel'), style: "cancel" },
            { text: t('common.upgrade'), onPress: openSubscriptionFromPaywall },
          ]
        );
        return;
      }
      if (media.length < 2) {
        Alert.alert(t('community.twoOptionsRequired'), t('community.pleaseAddAtLeastTwoOptionsForAComparison'));
        return;
      }
    }

    if (!description.trim()) {
      Alert.alert(t('community.descriptionRequired'), t('community.pleaseAddADescriptionToYourPost'));
      return;
    }

    if (requestAIAdvice && !canRequestAIAdvice()) {
      Alert.alert(
        t('community.stylistAdviceLimitReached'),
        t('community.stylistAdviceLimitMessage').replace('{n}', String(limits.aiAdvicePerMonth)),
        [
          { text: t('common.postAnyway'), onPress: () => setRequestAIAdvice(false) },
          { text: t('common.upgrade'), onPress: openSubscriptionFromPaywall },
        ]
      );
      return;
    }

    if (!user) {
      Alert.alert(t('common.error'), t('community.youMustBeLoggedInToCreateAPost'));
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedTimeFrame = POLL_TIME_FRAMES[selectedTimeFrameIndex];
      const pollExpiresAt = postType === "comparison"
        ? new Date(Date.now() + selectedTimeFrame.minutes * 60 * 1000).toISOString()
        : undefined;

      await createPost({
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        userSubscriptionTier: user.subscriptionTier === 'free' ? 'free' : 'premium',
        type: postType,
        media: media.map((m) => ({
          ...m,
          votes: postType === "comparison" ? 0 : undefined,
        })),
        images: media.map((m) => ({
          ...m,
          votes: postType === "comparison" ? 0 : undefined,
        })),
        description: description.trim(),
        isAIAdviceRequested: requestAIAdvice,
        aiAdvice: requestAIAdvice
          ? "Analyzing your outfit... Great style choice! The proportions work well together. Consider accessorizing with complementary pieces to elevate the look."
          : undefined,
        country: user.country,
        pollExpiresAt,
      });

      await incrementUpload();
      if (requestAIAdvice) {
        await incrementAIAdvice();
      }
      if (postType === "comparison") {
        await incrementPoll();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      Alert.alert(t('common.error'), t('community.failedToCreatePostPleaseTryAgain'));
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

      <View style={[styles.usageBar, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.usageItem}>
          <Feather name="upload" size={14} color={theme.tabIconDefault} />
          <ThemedText type="caption">
            {remainingUploads === Infinity ? "Unlimited" : `${remainingUploads} left`}
          </ThemedText>
        </View>
        <View style={styles.usageItem}>
          <Feather name="star" size={14} color={theme.tabIconDefault} />
          <ThemedText type="caption">
            {remainingAI === Infinity ? "Unlimited" : `${remainingAI} advice`}
          </ThemedText>
        </View>
        {postType === "comparison" ? (
          <View style={styles.usageItem}>
            <Feather name="bar-chart-2" size={14} color={theme.tabIconDefault} />
            <ThemedText type="caption">
              {remainingPolls === Infinity ? "Unlimited" : `${remainingPolls} polls`}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <KeyboardAwareScrollView
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
                if (media.length > 1) setMedia([media[0]]);
                Haptics.selectionAsync();
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
              onPress={() => {
                setPostType("comparison");
                Haptics.selectionAsync();
              }}
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
            {postType === "comparison" ? `Add ${limits.maxImagesPerPost} Options` : "Add Photo/Video"}
          </ThemedText>
          <View style={styles.mediaContainer}>
            {media.map((item) => (
              <View key={item.id} style={styles.mediaWrapper}>
                <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
                {item.type === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Feather name="video" size={12} color="#FFFFFF" />
                    {item.duration ? (
                      <ThemedText type="caption" style={styles.videoDuration}>
                        {Math.round(item.duration / 1000)}s
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
                <Pressable
                  onPress={() => handleRemoveMedia(item.id)}
                  style={[styles.removeMediaButton, { backgroundColor: theme.error || "#FF3B30" }]}
                >
                  <Feather name="x" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {media.length < maxMedia ? (
              <View style={styles.addMediaButtons}>
                <Pressable
                  onPress={handlePickImage}
                  style={[styles.addMediaButton, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="image" size={24} color={theme.tabIconDefault} />
                  <ThemedText type="caption" style={styles.addMediaText}>
                    Gallery
                  </ThemedText>
                </Pressable>
                {Platform.OS !== "web" ? (
                  <>
                    <Pressable
                      onPress={handleTakePhoto}
                      style={[styles.addMediaButton, { backgroundColor: theme.backgroundDefault }]}
                    >
                      <Feather name="camera" size={24} color={theme.tabIconDefault} />
                      <ThemedText type="caption" style={styles.addMediaText}>
                        Photo
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={handleRecordVideo}
                      style={[
                        styles.addMediaButton, 
                        { 
                          backgroundColor: limits.canUploadVideo 
                            ? theme.backgroundDefault 
                            : theme.backgroundSecondary,
                          opacity: limits.canUploadVideo ? 1 : 0.6,
                        }
                      ]}
                    >
                      <Feather name="video" size={24} color={theme.tabIconDefault} />
                      <ThemedText type="caption" style={styles.addMediaText}>
                        Video
                      </ThemedText>
                      {!limits.canUploadVideo ? (
                        <View style={[styles.proBadge, { backgroundColor: theme.link }]}>
                          <ThemedText type="caption" style={{ color: "#FFFFFF", fontSize: 8 }}>
                            PRO
                          </ThemedText>
                        </View>
                      ) : null}
                    </Pressable>
                  </>
                ) : (
                  <View style={[styles.webNotice, { backgroundColor: theme.backgroundDefault }]}>
                    <Feather name="smartphone" size={20} color={theme.tabIconDefault} />
                    <ThemedText type="caption" style={styles.webNoticeText}>
                      Use Expo Go for camera access
                    </ThemedText>
                  </View>
                )}
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
                ? "Help me decide! Which outfit works better for..."
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

        {postType === "comparison" ? (
          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Poll Duration
            </ThemedText>
            <ThemedText type="small" style={styles.timeFrameHint}>
              Set how long the community can vote on your outfit options
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timeFrameScroll}
              contentContainerStyle={styles.timeFrameContainer}
            >
              {POLL_TIME_FRAMES.map((timeFrame, index) => (
                <Pressable
                  key={timeFrame.minutes}
                  onPress={() => {
                    setSelectedTimeFrameIndex(index);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.timeFrameOption,
                    {
                      backgroundColor:
                        selectedTimeFrameIndex === index ? theme.link : theme.backgroundDefault,
                      borderColor:
                        selectedTimeFrameIndex === index ? theme.link : theme.tabIconDefault,
                    },
                  ]}
                >
                  <Feather
                    name="clock"
                    size={14}
                    color={selectedTimeFrameIndex === index ? "#FFFFFF" : theme.tabIconDefault}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: selectedTimeFrameIndex === index ? "#FFFFFF" : theme.text,
                      fontWeight: selectedTimeFrameIndex === index ? "600" : "400",
                    }}
                  >
                    {timeFrame.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <View style={[styles.urgencyIndicator, { backgroundColor: theme.backgroundDefault }]}>
              <Feather 
                name={selectedTimeFrameIndex <= 2 ? "zap" : selectedTimeFrameIndex <= 5 ? "clock" : "calendar"} 
                size={16} 
                color={selectedTimeFrameIndex <= 2 ? theme.error || "#FF3B30" : selectedTimeFrameIndex <= 5 ? theme.link : theme.tabIconDefault} 
              />
              <ThemedText type="small" style={styles.urgencyText}>
                {selectedTimeFrameIndex <= 2
                  ? "Quick decision - perfect for shopping!"
                  : selectedTimeFrameIndex <= 5
                    ? "Moderate timeframe for gathering opinions"
                    : "Extended voting for future events"}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Pressable
            onPress={() => {
              setRequestAIAdvice(!requestAIAdvice);
              Haptics.selectionAsync();
            }}
            style={styles.aiToggle}
          >
            <View style={styles.aiToggleContent}>
              <Feather name="star" size={20} color={theme.link} />
              <View style={styles.aiToggleText}>
                <ThemedText type="body" style={styles.aiToggleTitle}>
                  Get Stylist Advice
                </ThemedText>
                <ThemedText type="small" style={styles.aiToggleSubtitle}>
                  {remainingAI === 0 
                    ? "No stylist requests remaining this month" 
                    : remainingAI === Infinity 
                      ? "Unlimited stylist advice" 
                      : `${remainingAI} requests remaining`}
                </ThemedText>
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: requestAIAdvice ? theme.link : "transparent",
                  borderColor: requestAIAdvice ? theme.link : theme.tabIconDefault,
                  opacity: remainingAI === 0 ? 0.5 : 1,
                },
              ]}
            >
              {requestAIAdvice ? (
                <Feather name="check" size={14} color="#FFFFFF" />
              ) : null}
            </View>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>

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
  usageBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  usageItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  mediaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  mediaWrapper: {
    position: "relative",
  },
  mediaPreview: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
  },
  videoBadge: {
    position: "absolute",
    bottom: Spacing.xs,
    left: Spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.xs,
  },
  videoDuration: {
    color: "#FFFFFF",
    fontSize: 10,
  },
  removeMediaButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addMediaButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  addMediaButton: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    position: "relative",
  },
  addMediaText: {
    opacity: 0.7,
  },
  proBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  webNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  webNoticeText: {
    opacity: 0.7,
  },
  descriptionInput: {
    minHeight: 100,
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
  timeFrameHint: {
    opacity: 0.7,
    marginBottom: Spacing.md,
  },
  timeFrameScroll: {
    marginHorizontal: -Spacing.xl,
  },
  timeFrameContainer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  timeFrameOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  urgencyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  urgencyText: {
    flex: 1,
    opacity: 0.8,
  },
});
