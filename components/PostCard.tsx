import React from "react";
import { StyleSheet, View, Image, Pressable, Dimensions, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { Post, PostMedia } from "@/contexts/PostsContext";

const { width } = Dimensions.get("window");

interface PostCardProps {
  post: Post;
  onPress: () => void;
  onVote: (postId: string, voteType: "up" | "down") => void;
  onComparisonVote: (postId: string, mediaId: string) => void;
  onThank: (postId: string) => void;
  onSave?: (post: Post) => void;
  isSaved?: boolean;
  compact?: boolean;
}

export function PostCard({
  post,
  onPress,
  onVote,
  onComparisonVote,
  onThank,
  onSave,
  isSaved = false,
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

  const handleVote = async (voteType: "up" | "down") => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onVote(post.id, voteType);
  };

  const handleComparisonVote = async (mediaId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComparisonVote(post.id, mediaId);
  };

  const handleThank = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onThank(post.id);
  };

  const handleSave = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onSave) {
      onSave(post);
    }
  };

  const mediaSize = compact ? 160 : width - Spacing.xl * 2;
  const mediaList = post.media?.length > 0 ? post.media : post.images;

  const renderMedia = (item: PostMedia, index: number) => {
    const isVideo = item.type === 'video';
    
    if (isVideo) {
      return (
        <View key={item.id} style={{ width: post.type === "comparison" ? mediaSize : undefined }}>
          <Image
            source={{ uri: item.thumbnail || item.uri }}
            style={[styles.postMedia, { width: mediaSize, height: compact ? mediaSize * 0.75 : mediaSize }]}
          />
          <View style={styles.videoOverlay}>
            <View style={[styles.playButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
              <Feather name="play" size={32} color="#FFFFFF" />
            </View>
          </View>
          {item.duration ? (
            <View style={styles.durationBadge}>
              <ThemedText type="caption" style={styles.durationText}>
                {Math.round(item.duration / 1000)}s
              </ThemedText>
            </View>
          ) : null}
          {post.type === "comparison" ? (
            <>
              <Pressable
                onPress={() => handleComparisonVote(item.id)}
                style={[styles.voteOverlay, { backgroundColor: theme.link }]}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
                <ThemedText type="small" style={styles.voteText}>
                  Vote ({item.votes || 0})
                </ThemedText>
              </Pressable>
              <View style={styles.optionBadge}>
                <ThemedText type="caption" style={styles.optionText}>
                  Option {index + 1}
                </ThemedText>
              </View>
            </>
          ) : null}
        </View>
      );
    }

    return (
      <View key={item.id} style={{ width: post.type === "comparison" ? mediaSize : undefined }}>
        <Image
          source={{ uri: item.uri }}
          style={[styles.postMedia, { width: mediaSize, height: compact ? mediaSize * 0.75 : mediaSize }]}
        />
        {post.type === "comparison" ? (
          <>
            <Pressable
              onPress={() => handleComparisonVote(item.id)}
              style={[styles.voteOverlay, { backgroundColor: theme.link }]}
            >
              <Feather name="check" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={styles.voteText}>
                Vote ({item.votes || 0})
              </ThemedText>
            </Pressable>
            <View style={styles.optionBadge}>
              <ThemedText type="caption" style={styles.optionText}>
                Option {index + 1}
              </ThemedText>
            </View>
          </>
        ) : null}
      </View>
    );
  };

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
            {post.isViralBadge ? (
              <View style={[styles.viralBadge, { backgroundColor: "#FF6B6B" }]}>
                <Feather name="trending-up" size={10} color="#FFFFFF" />
              </View>
            ) : null}
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

      <View style={styles.mediaContainer}>
        {post.type === "comparison" ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.comparisonScroll}
          >
            {mediaList.map((item, index) => renderMedia(item, index))}
          </ScrollView>
        ) : (
          mediaList[0] ? renderMedia(mediaList[0], 0) : null
        )}
      </View>

      <View style={styles.engagementRow}>
        <View style={styles.voteButtons}>
          <Pressable
            onPress={() => handleVote("up")}
            style={({ pressed }) => [styles.voteButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="heart" size={20} color={theme.text} />
            <ThemedText type="small">{post.upvotes}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleVote("down")}
            style={({ pressed }) => [styles.voteButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="thumbs-down" size={20} color={theme.text} />
            <ThemedText type="small">{post.downvotes}</ThemedText>
          </Pressable>
          <View style={styles.commentCount}>
            <Feather name="message-circle" size={20} color={theme.tabIconDefault} />
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {post.commentsCount}
            </ThemedText>
          </View>
          <View style={styles.shareCount}>
            <Feather name="share" size={18} color={theme.tabIconDefault} />
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {post.sharesCount || 0}
            </ThemedText>
          </View>
          {onSave ? (
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.saveButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather 
                name={isSaved ? "bookmark" : "bookmark"} 
                size={20} 
                color={isSaved ? theme.link : theme.tabIconDefault} 
              />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={handleThank}
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
  viralBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaContainer: {
    width: "100%",
  },
  comparisonScroll: {
    width: "100%",
  },
  postMedia: {
    resizeMode: "cover",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 12,
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
  shareCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saveButton: {
    padding: 4,
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
