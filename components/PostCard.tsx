import React from "react";
import { StyleSheet, View, Image, Pressable, Dimensions, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { Post } from "@/contexts/PostsContext";

const { width } = Dimensions.get("window");

interface PostCardProps {
  post: Post;
  onPress: () => void;
  onVote: (postId: string, voteType: "up" | "down") => void;
  onComparisonVote: (postId: string, imageId: string) => void;
  onThank: (postId: string) => void;
  compact?: boolean;
}

export function PostCard({
  post,
  onPress,
  onVote,
  onComparisonVote,
  onThank,
  compact = false,
}: PostCardProps) {
  const { theme } = useTheme();

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return "now";
  };

  const imageSize = compact ? 160 : width - Spacing.xl * 2;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
          {post.userAvatar ? (
            <Image source={{ uri: post.userAvatar }} style={styles.avatarImage} />
          ) : post.userId === "ai-stylist" ? (
            <Feather name="cpu" size={18} color={theme.link} />
          ) : (
            <Feather name="user" size={18} color={theme.tabIconDefault} />
          )}
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <ThemedText type="body" style={styles.userName}>
              {post.userName}
            </ThemedText>
            <SubscriptionBadge tier={post.userSubscriptionTier} small />
          </View>
          <ThemedText type="caption" style={styles.time}>
            {formatTime(post.createdAt)}
          </ThemedText>
        </View>
        {post.isAIAdviceRequested ? (
          <View style={[styles.aiBadge, { backgroundColor: theme.link }]}>
            <Feather name="cpu" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <View style={styles.imageContainer}>
        {post.type === "comparison" ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.comparisonScroll}
          >
            {post.images.map((image, index) => (
              <View key={image.id} style={{ width: imageSize }}>
                <Image
                  source={{ uri: image.uri }}
                  style={[styles.postImage, { width: imageSize, height: imageSize }]}
                />
                <Pressable
                  onPress={() => onComparisonVote(post.id, image.id)}
                  style={[styles.voteOverlay, { backgroundColor: theme.link }]}
                >
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.voteText}>
                    Vote ({image.votes || 0})
                  </ThemedText>
                </Pressable>
                <View style={styles.optionBadge}>
                  <ThemedText type="caption" style={styles.optionText}>
                    Option {index + 1}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Image
            source={{ uri: post.images[0]?.uri }}
            style={[styles.postImage, { width: imageSize, height: compact ? imageSize * 0.75 : imageSize }]}
          />
        )}
      </View>

      <View style={styles.engagementRow}>
        <View style={styles.voteButtons}>
          <Pressable
            onPress={() => onVote(post.id, "up")}
            style={({ pressed }) => [styles.voteButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="heart" size={20} color={theme.text} />
            <ThemedText type="small">{post.upvotes}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => onVote(post.id, "down")}
            style={({ pressed }) => [styles.voteButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="x" size={20} color={theme.text} />
            <ThemedText type="small">{post.downvotes}</ThemedText>
          </Pressable>
          <View style={styles.commentCount}>
            <Feather name="message-circle" size={20} color={theme.tabIconDefault} />
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {post.commentsCount}
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => onThank(post.id)}
          style={({ pressed }) => [
            styles.thankButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="gift" size={14} color={theme.link} />
          <ThemedText type="caption" style={{ color: theme.link }}>
            {post.thanksCount}
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText type="body" numberOfLines={compact ? 2 : 3} style={styles.description}>
        <ThemedText type="body" style={styles.userName}>
          {post.userName}
        </ThemedText>{" "}
        {post.description}
      </ThemedText>

      {post.aiAdvice && !compact ? (
        <View style={[styles.aiAdvice, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.aiAdviceHeader}>
            <Feather name="cpu" size={14} color={theme.link} />
            <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
              AI Advice
            </ThemedText>
          </View>
          <ThemedText type="small" numberOfLines={2} style={styles.aiAdviceText}>
            {post.aiAdvice}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  userName: {
    fontWeight: "600",
  },
  time: {
    opacity: 0.5,
  },
  aiBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    width: "100%",
  },
  comparisonScroll: {
    width: "100%",
  },
  postImage: {
    resizeMode: "cover",
  },
  voteOverlay: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  voteText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  optionBadge: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  optionText: {
    color: "#FFFFFF",
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  voteButtons: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  thankButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  description: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  aiAdvice: {
    margin: Spacing.md,
    marginTop: 0,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  aiAdviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  aiAdviceText: {
    opacity: 0.8,
  },
});
