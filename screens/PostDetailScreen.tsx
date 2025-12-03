import React, { useState } from "react";
import { StyleSheet, View, Image, TextInput, Pressable, ScrollView, Dimensions, KeyboardAvoidingView, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts, Post, Comment } from "@/contexts/PostsContext";
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
  const { posts, getPostComments, addComment, votePost, thankPost } = usePosts();

  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <ThemedText type="caption" style={styles.commentTime}>
            {formatTime(comment.createdAt)}
          </ThemedText>
        </View>
        <ThemedText type="body" style={styles.commentText}>
          {comment.content}
        </ThemedText>
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

          <ThemedText type="body" style={styles.description}>
            {post.description}
          </ThemedText>

          {post.aiAdvice ? (
            <View style={[styles.aiAdviceCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.aiAdviceHeader}>
                <Feather name="cpu" size={18} color={theme.link} />
                <ThemedText type="h3" style={{ color: theme.link }}>
                  StyleWise AI Advice
                </ThemedText>
              </View>
              <ThemedText type="body" style={styles.aiAdviceText}>
                {post.aiAdvice}
              </ThemedText>
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
        </View>
      </ThemedView>
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
