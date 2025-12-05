import React, { useState } from "react";
import { StyleSheet, View, Image, TextInput, Pressable, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Alert, Share } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { ReportModal } from "@/components/ReportModal";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts, Post, Comment } from "@/contexts/PostsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getAIFashionAdvice, getComparisonAdvice, AIAdviceResult } from "@/services/AIAdviceService";
import { sharePost, generateHashtags } from "@/services/SharingService";
import { VoiceCommentInput, VoiceCommentPlayer } from "@/components/VoiceCommentInput";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type PostDetailScreenProps = {
  navigation: NativeStackNavigationProp<HomeStackParamList, "PostDetail">;
  route: RouteProp<HomeStackParamList, "PostDetail">;
};

const { width } = Dimensions.get("window");

export default function PostDetailScreen({ navigation, route }: PostDetailScreenProps) {
  const { postId } = route.params;
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { posts, getPostComments, addComment, votePost, thankPost, updatePost } = usePosts();
  const { tier, canRequestAIAdvice, incrementAIAdvice, canRecordVoice, incrementVoiceComment } = useSubscription();

  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingAI, setIsRequestingAI] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<AIAdviceResult | null>(null);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const post = posts.find((p) => p.id === postId);
  const comments = getPostComments(postId);

  if (!post) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="body">Post not found</ThemedText>
      </ThemedView>
    );
  }

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user) return;

    setIsSubmitting(true);
    try {
      await addComment(postId, {
        postId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        content: commentText.trim(),
        isVoice: false,
        isAI: false,
      });
      setCommentText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = (voteType: "up" | "down") => {
    votePost(postId, voteType);
  };

  const handleThank = () => {
    thankPost(postId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRequestAIAdvice = async () => {
    if (!post) return;

    if (!canRequestAIAdvice()) {
      Alert.alert(
        "AI Advice Limit Reached",
        "You've used all your AI advice requests this month. Upgrade your plan for unlimited AI styling advice.",
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "View Plans", onPress: () => navigation.navigate("Subscription") },
        ]
      );
      return;
    }

    setIsRequestingAI(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const isPremium = tier !== "free" && tier !== "basic";
      const advice = await getAIFashionAdvice(
        post.images[0]?.uri || "",
        post.description,
        isPremium,
        user?.country || undefined,
        user?.gender || undefined
      );

      setAiAdvice(advice);
      await incrementAIAdvice();

      if (updatePost) {
        updatePost(postId, { aiAdvice: advice.mainAdvice });
      }

      await addComment(postId, {
        postId,
        userId: "ai-stylist",
        userName: "StyleWise AI",
        content: advice.mainAdvice,
        isVoice: false,
        isAI: true,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Could not get AI advice. Please try again.");
    } finally {
      setIsRequestingAI(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;

    try {
      const shared = await sharePost(post);
      if (shared) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.log("Share cancelled");
    }
  };

  const handleReport = () => {
    setShowReportModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleVoiceRecordingComplete = async (uri: string, duration: number) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await addComment(postId, {
        postId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        content: uri,
        isVoice: true,
        voiceDuration: duration,
        isAI: false,
      });
      await incrementVoiceComment();
      setShowVoiceInput(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  const renderComment = (comment: Comment) => (
    <View key={comment.id} style={styles.commentItem}>
      <View style={[styles.commentAvatar, { backgroundColor: theme.backgroundSecondary }]}>
        {comment.userAvatar ? (
          <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatarImage} />
        ) : comment.isAI ? (
          <Feather name="cpu" size={16} color={theme.link} />
        ) : comment.isVoice ? (
          <Feather name="mic" size={16} color={theme.link} />
        ) : (
          <Feather name="user" size={16} color={theme.tabIconDefault} />
        )}
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <ThemedText type="small" style={styles.commentUserName}>
            {comment.userName}
          </ThemedText>
          {comment.isAI ? (
            <View style={[styles.aiBadge, { backgroundColor: theme.link }]}>
              <ThemedText type="caption" style={styles.aiBadgeText}>
                AI
              </ThemedText>
            </View>
          ) : null}
          {comment.isVoice ? (
            <View style={[styles.voiceBadge, { backgroundColor: theme.success || theme.link }]}>
              <Feather name="mic" size={10} color="#FFFFFF" />
            </View>
          ) : null}
          <ThemedText type="caption" style={styles.commentTime}>
            {formatTime(comment.createdAt)}
          </ThemedText>
        </View>
        {comment.isVoice && comment.voiceDuration ? (
          <VoiceCommentPlayer
            uri={comment.content}
            duration={comment.voiceDuration}
            transcript={comment.voiceTranscript}
          />
        ) : (
          <ThemedText type="body" style={styles.commentText}>
            {comment.content}
          </ThemedText>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
        >
          <View style={styles.postHeader}>
            <View style={[styles.userAvatar, { backgroundColor: theme.backgroundDefault }]}>
              {post.userAvatar ? (
                <Image source={{ uri: post.userAvatar }} style={styles.userAvatarImage} />
              ) : (
                <Feather name="user" size={20} color={theme.tabIconDefault} />
              )}
            </View>
            <View style={styles.userInfo}>
              <ThemedText type="h3">{post.userName}</ThemedText>
              <ThemedText type="caption" style={styles.postTime}>
                {formatTime(post.createdAt)}
              </ThemedText>
            </View>
            <SubscriptionBadge tier={post.userSubscriptionTier} />
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.imageContainer}
          >
            {post.images.map((image, index) => (
              <View key={image.id} style={styles.imageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.postImage} />
                {post.type === "comparison" ? (
                  <View style={styles.voteOverlay}>
                    <Pressable
                      style={[styles.voteButton, { backgroundColor: theme.link }]}
                      onPress={() => {}}
                    >
                      <ThemedText type="body" style={styles.voteButtonText}>
                        Vote ({image.votes || 0})
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
                {post.images.length > 1 ? (
                  <View style={styles.imagePagination}>
                    <ThemedText type="caption" style={styles.paginationText}>
                      {index + 1}/{post.images.length}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>

          <View style={styles.engagementRow}>
            <View style={styles.voteButtons}>
              <Pressable
                onPress={() => handleVote("up")}
                style={({ pressed }) => [
                  styles.engagementButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="heart" size={24} color={theme.text} />
                <ThemedText type="body">{post.upvotes}</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleVote("down")}
                style={({ pressed }) => [
                  styles.engagementButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="x" size={24} color={theme.text} />
                <ThemedText type="body">{post.downvotes}</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.engagementButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="share-2" size={24} color={theme.text} />
              </Pressable>
              <Pressable
                onPress={handleReport}
                style={({ pressed }) => [
                  styles.engagementButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="flag" size={24} color={theme.tabIconDefault} />
              </Pressable>
            </View>
            <Pressable
              onPress={handleThank}
              style={({ pressed }) => [
                styles.thankButton,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="gift" size={18} color={theme.link} />
              <ThemedText type="small" style={{ color: theme.link }}>
                Thanks ({post.thanksCount})
              </ThemedText>
            </Pressable>
          </View>

          {!post.aiAdvice && !aiAdvice ? (
            <Pressable
              onPress={handleRequestAIAdvice}
              disabled={isRequestingAI}
              style={({ pressed }) => [
                styles.aiRequestButton,
                { backgroundColor: theme.link, opacity: isRequestingAI ? 0.6 : pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="cpu" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.aiRequestButtonText}>
                {isRequestingAI ? "Getting AI Advice..." : "Get AI Style Advice"}
              </ThemedText>
            </Pressable>
          ) : null}

          <ThemedText type="body" style={styles.description}>
            {post.description}
          </ThemedText>

          {post.aiAdvice || aiAdvice ? (
            <View style={[styles.aiAdviceCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.aiAdviceHeader}>
                <Feather name="cpu" size={18} color={theme.link} />
                <ThemedText type="h3" style={{ color: theme.link }}>
                  StyleWise AI Advice
                </ThemedText>
              </View>
              <ThemedText type="body" style={styles.aiAdviceText}>
                {aiAdvice?.mainAdvice || post.aiAdvice}
              </ThemedText>

              {aiAdvice?.colorAdvice ? (
                <View style={styles.aiAdviceSection}>
                  <ThemedText type="small" style={[styles.aiSectionTitle, { color: theme.link }]}>
                    Color Analysis
                  </ThemedText>
                  <ThemedText type="body" style={styles.aiAdviceText}>
                    {aiAdvice.colorAdvice}
                  </ThemedText>
                </View>
              ) : null}

              {aiAdvice?.proportionAdvice ? (
                <View style={styles.aiAdviceSection}>
                  <ThemedText type="small" style={[styles.aiSectionTitle, { color: theme.link }]}>
                    Proportions
                  </ThemedText>
                  <ThemedText type="body" style={styles.aiAdviceText}>
                    {aiAdvice.proportionAdvice}
                  </ThemedText>
                </View>
              ) : null}

              {aiAdvice?.productRecommendations && aiAdvice.productRecommendations.length > 0 ? (
                <View style={styles.aiAdviceSection}>
                  <ThemedText type="small" style={[styles.aiSectionTitle, { color: theme.link }]}>
                    Shop Similar
                  </ThemedText>
                  {aiAdvice.productRecommendations.map((rec, idx) => (
                    <View key={idx} style={styles.productCategory}>
                      <ThemedText type="caption" style={styles.productCategoryTitle}>
                        {rec.category}:
                      </ThemedText>
                      <ThemedText type="body" style={styles.productItems}>
                        {rec.items.join(" • ")}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {aiAdvice?.hashtags && aiAdvice.hashtags.length > 0 ? (
                <View style={styles.hashtagRow}>
                  {aiAdvice.hashtags.map((tag, idx) => (
                    <ThemedText key={idx} type="caption" style={[styles.hashtag, { color: theme.link }]}>
                      {tag}
                    </ThemedText>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.commentsSection}>
            <ThemedText type="h3" style={styles.commentsTitle}>
              Comments ({comments.length})
            </ThemedText>
            {comments.length > 0 ? (
              <View style={styles.commentsList}>
                {comments.map(renderComment)}
              </View>
            ) : (
              <View style={styles.emptyComments}>
                <Feather name="message-circle" size={32} color={theme.tabIconDefault} />
                <ThemedText type="body" style={styles.emptyCommentsText}>
                  No comments yet. Be the first to share your thoughts!
                </ThemedText>
              </View>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.commentInputContainer,
            { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.sm },
          ]}
        >
          {showVoiceInput ? (
            <VoiceCommentInput
              onRecordingComplete={handleVoiceRecordingComplete}
              onCancel={() => setShowVoiceInput(false)}
            />
          ) : (
            <>
              <Pressable
                onPress={() => setShowVoiceInput(true)}
                style={({ pressed }) => [
                  styles.voiceToggleButton,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="mic" size={20} color={theme.link} />
              </Pressable>
              <TextInput
                style={[
                  styles.commentInput,
                  { backgroundColor: theme.backgroundDefault, color: theme.text },
                ]}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add your style advice..."
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                multiline
                maxLength={500}
              />
              <Pressable
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || isSubmitting}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: theme.link,
                    opacity: !commentText.trim() || isSubmitting ? 0.5 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name="send" size={20} color="#FFFFFF" />
              </Pressable>
            </>
          )}
        </View>
      </ThemedView>

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        contentType="post"
        contentId={postId}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  postTime: {
    opacity: 0.6,
  },
  imageContainer: {
    marginHorizontal: -Spacing.xl,
    marginBottom: Spacing.lg,
  },
  imageWrapper: {
    width: width,
    position: "relative",
  },
  postImage: {
    width: width,
    height: width,
  },
  voteOverlay: {
    position: "absolute",
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  voteButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  voteButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  imagePagination: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  paginationText: {
    color: "#FFFFFF",
  },
  engagementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  voteButtons: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  thankButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  description: {
    marginBottom: Spacing.lg,
  },
  aiAdviceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  aiAdviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  aiAdviceText: {
    opacity: 0.9,
    lineHeight: 22,
  },
  aiRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  aiRequestButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  aiAdviceSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  aiSectionTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  productCategory: {
    marginTop: Spacing.xs,
  },
  productCategoryTitle: {
    fontWeight: "600",
    opacity: 0.7,
  },
  productItems: {
    opacity: 0.9,
  },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  hashtag: {
    fontWeight: "500",
  },
  commentsSection: {
    marginTop: Spacing.md,
  },
  commentsTitle: {
    marginBottom: Spacing.lg,
  },
  commentsList: {
    gap: Spacing.md,
  },
  commentItem: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  commentUserName: {
    fontWeight: "600",
  },
  aiBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.xs,
  },
  aiBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 10,
  },
  voiceBadge: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  commentTime: {
    opacity: 0.5,
  },
  commentText: {
    opacity: 0.9,
  },
  emptyComments: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  emptyCommentsText: {
    opacity: 0.7,
    textAlign: "center",
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.body.fontSize,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
