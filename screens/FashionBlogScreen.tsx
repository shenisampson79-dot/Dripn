import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type FashionBlogScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "FashionBlog">;
};

interface BlogPost {
  id: string;
  subject: string;
  headline: string;
  previewText: string;
  introduction: string;
  category: string;
  tags: string[];
  publishedAt: string;
  tips: Array<{
    title: string;
    content: string;
    proTip: string;
  }>;
}

const NEWSLETTER_SUBSCRIPTION_KEY = "@stylewise_newsletter_subscribed";

const FALLBACK_BLOG_POSTS: BlogPost[] = [
  {
    id: "fallback-1",
    subject: "StyleWise Weekly: 5 Winter Wardrobe Essentials",
    headline: "5 Winter Wardrobe Essentials You Need Right Now",
    previewText: "Build your perfect cold-weather capsule wardrobe",
    introduction: "Build your perfect cold-weather capsule with these versatile pieces that work for every occasion.",
    category: "Seasonal Fashion Trends",
    tags: ["winter", "wardrobe", "essentials"],
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Tailored Wool Coat", content: "A well-fitted wool coat in camel, black, or charcoal instantly elevates any outfit.", proTip: "Choose a single-breasted style for a slimming silhouette." },
      { title: "Cashmere Knitwear", content: "Invest in quality over quantity. A cashmere jumper in neutral tones works under blazers or on its own.", proTip: "Hand wash in cold water to keep your knits looking fresh." },
      { title: "Leather Boots", content: "Chelsea boots or knee-high styles in quality leather that will age beautifully.", proTip: "Waterproof spray is your boots' best friend." }
    ]
  },
  {
    id: "fallback-2",
    subject: "StyleWise Weekly: The Colour Confidence Guide",
    headline: "The Colour Confidence Guide - Find Your Perfect Palette",
    previewText: "Discover which colours make you look radiant",
    introduction: "Discover which colours make you look radiant and how to build a palette that works for you.",
    category: "Colour Trends",
    tags: ["colour", "palette", "styling"],
    publishedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Warm Undertones", content: "Your veins appear greenish and gold jewellery looks better on you.", proTip: "Stick to warm reds, oranges, olive greens, and warm browns." },
      { title: "Cool Undertones", content: "Your veins appear blue/purple and silver jewellery suits you better.", proTip: "Navy, emerald, soft pinks, and lavender are your friends." },
      { title: "Neutral Undertones", content: "Both gold and silver jewellery look good on you.", proTip: "Focus on jade green, dusty rose, taupe, and soft navy." }
    ]
  },
  {
    id: "fallback-3",
    subject: "StyleWise Weekly: Smart Casual Decoded",
    headline: "Smart Casual Decoded - What It Actually Means",
    previewText: "Master effortlessly polished dressing",
    introduction: "The dress code everyone gets wrong. Here's how to nail it every time.",
    category: "Wardrobe Essentials",
    tags: ["smart-casual", "office", "versatile"],
    publishedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Golden Formula", content: "One piece dressed up + one piece dressed down = smart casual perfection.", proTip: "A blazer with jeans or chinos with a polo work every time." },
      { title: "Quality Fabrics", content: "Invest in well-made pieces in quality fabrics that look polished.", proTip: "Avoid heavily distressed denim or activewear." },
      { title: "Footwear Matters", content: "Clean leather trainers or loafers bridge the gap perfectly.", proTip: "When in doubt, choose closed-toe shoes." }
    ]
  }
];

export default function FashionBlogScreen({ navigation }: FashionBlogScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
    fetchPosts();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      const subscribed = await AsyncStorage.getItem(NEWSLETTER_SUBSCRIPTION_KEY);
      setIsSubscribed(subscribed === "true");
    } catch (error) {
      console.log("Error loading subscription status:", error);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      
      if (!apiService.isConfigured()) {
        setPosts(FALLBACK_BLOG_POSTS);
        return;
      }

      const response = await apiService.getPublishedNewsletters({ limit: 20 });
      
      if (response.newsletters && response.newsletters.length > 0) {
        const formattedPosts: BlogPost[] = response.newsletters.map(newsletter => ({
          id: newsletter.id,
          subject: newsletter.subject,
          headline: newsletter.headline,
          previewText: newsletter.introduction?.substring(0, 100) || "",
          introduction: newsletter.introduction,
          category: newsletter.category,
          tags: newsletter.tags || [],
          publishedAt: newsletter.publishedAt,
          tips: newsletter.tips || []
        }));
        setPosts(formattedPosts);
      } else {
        setPosts(FALLBACK_BLOG_POSTS);
      }
    } catch (error) {
      console.log("Error fetching newsletters, using fallback:", error);
      setPosts(FALLBACK_BLOG_POSTS);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      if (apiService.isConfigured() && user?.email) {
        await apiService.subscribeToNewsletter(user.email, user.displayName);
      }
      
      await AsyncStorage.setItem(NEWSLETTER_SUBSCRIPTION_KEY, "true");
      setIsSubscribed(true);
      
      Alert.alert(
        "Subscribed!",
        "You'll receive our weekly fashion newsletter straight to your inbox.",
        [{ text: "Great!" }]
      );
    } catch (error) {
      console.log("Error subscribing to newsletter:", error);
      Alert.alert(
        "Subscription Failed",
        "We couldn't complete your subscription. Please try again later.",
        [{ text: "OK" }]
      );
    }
  };

  const handleReport = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReportingPostId(postId);
    
    Alert.alert(
      "Report Issue",
      "What would you like to report?",
      [
        { text: "Typo or Error", onPress: () => submitReport(postId, "typo", "Typo or grammatical error reported") },
        { text: "Offensive Content", onPress: () => submitReport(postId, "offensive", "Content flagged as potentially offensive") },
        { text: "Inaccurate Information", onPress: () => submitReport(postId, "inaccurate", "Information reported as potentially inaccurate") },
        { text: "Cancel", style: "cancel", onPress: () => setReportingPostId(null) }
      ]
    );
  };

  const submitReport = async (postId: string, issueType: string, description: string) => {
    try {
      if (apiService.isConfigured()) {
        await apiService.reportNewsletterIssue({
          newsletterId: postId,
          issueType,
          description,
          userEmail: user?.email
        });
      }
      
      Alert.alert(
        "Report Submitted",
        "Thank you for your feedback. Our team will review this content.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.log("Error submitting report:", error);
      Alert.alert(
        "Report Failed",
        "We couldn't submit your report. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setReportingPostId(null);
    }
  };

  const toggleExpanded = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedPost(expandedPost === postId ? null : postId);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <ThemedText type="h2" style={styles.title}>Fashion Blog</ThemedText>
      <ThemedText type="body" style={styles.subtitle}>
        Weekly style insights and expert fashion advice
      </ThemedText>
      
      {!isSubscribed ? (
        <Card style={[styles.subscribeCard, { backgroundColor: isDark ? "rgba(201, 169, 97, 0.15)" : "rgba(201, 169, 97, 0.1)" }]}>
          <View style={styles.subscribeContent}>
            <View style={styles.subscribeIcon}>
              <Feather name="mail" size={24} color={theme.link} />
            </View>
            <View style={styles.subscribeText}>
              <ThemedText type="h3">Get Weekly Updates</ThemedText>
              <ThemedText type="small" style={styles.subscribeSubtext}>
                Join our newsletter for exclusive styling tips delivered to your inbox
              </ThemedText>
            </View>
          </View>
          <Button onPress={handleSubscribe} style={styles.subscribeButton}>
            Subscribe
          </Button>
        </Card>
      ) : (
        <View style={[styles.subscribedBadge, { backgroundColor: isDark ? "rgba(52, 199, 89, 0.2)" : "rgba(52, 199, 89, 0.1)" }]}>
          <Feather name="check-circle" size={16} color={theme.success || "#34C759"} />
          <ThemedText type="small" style={{ color: theme.success || "#34C759" }}>
            Subscribed to newsletter
          </ThemedText>
        </View>
      )}
    </View>
  );

  const renderPost = ({ item }: { item: BlogPost }) => {
    const isExpanded = expandedPost === item.id;
    
    return (
      <Pressable onPress={() => toggleExpanded(item.id)}>
        <Card style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={[styles.categoryBadge, { backgroundColor: isDark ? "rgba(201, 169, 97, 0.2)" : "rgba(201, 169, 97, 0.15)" }]}>
              <ThemedText type="caption" style={{ color: theme.link }}>
                {item.category}
              </ThemedText>
            </View>
            <ThemedText type="caption" style={styles.dateText}>
              {formatDate(item.publishedAt)}
            </ThemedText>
          </View>
          
          <ThemedText type="h3" style={styles.postTitle}>
            {item.headline}
          </ThemedText>
          
          <ThemedText type="body" style={styles.postPreview}>
            {item.introduction}
          </ThemedText>
          
          {isExpanded ? (
            <View style={styles.expandedContent}>
              {item.tips.map((tip, index) => (
                <View key={index} style={[styles.tipCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
                  <ThemedText type="body" style={[styles.tipTitle, { fontWeight: "600" }]}>
                    {index + 1}. {tip.title}
                  </ThemedText>
                  <ThemedText type="body" style={styles.tipContent}>
                    {tip.content}
                  </ThemedText>
                  <ThemedText type="small" style={[styles.proTip, { color: theme.link }]}>
                    Pro Tip: {tip.proTip}
                  </ThemedText>
                </View>
              ))}
              
              <View style={styles.postActions}>
                <View style={styles.tagsRow}>
                  {item.tags.map((tag, index) => (
                    <View key={index} style={[styles.tag, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
                      <ThemedText type="caption">#{tag}</ThemedText>
                    </View>
                  ))}
                </View>
                
                <Pressable 
                  onPress={() => handleReport(item.id)}
                  style={styles.reportButton}
                  disabled={reportingPostId === item.id}
                >
                  {reportingPostId === item.id ? (
                    <ActivityIndicator size="small" color={theme.tabIconDefault} />
                  ) : (
                    <>
                      <Feather name="flag" size={14} color={theme.tabIconDefault} />
                      <ThemedText type="caption" style={styles.reportText}>Report</ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
          
          <View style={styles.expandIndicator}>
            <Feather 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={theme.tabIconDefault} 
            />
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              {isExpanded ? "Show less" : "Read more"}
            </ThemedText>
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="book-open" size={48} color={theme.tabIconDefault} />
      <ThemedText type="h3" style={styles.emptyTitle}>No Articles Yet</ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        Check back soon for the latest fashion insights and styling tips.
      </ThemedText>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={styles.loadingText}>Loading articles...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScreenFlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.link}
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    opacity: 0.7,
  },
  headerContainer: {
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  subscribeCard: {
    padding: Spacing.lg,
  },
  subscribeContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  subscribeIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  subscribeText: {
    flex: 1,
  },
  subscribeSubtext: {
    opacity: 0.7,
    marginTop: 4,
  },
  subscribeButton: {
    marginTop: Spacing.sm,
  },
  subscribedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  postCard: {
    padding: Spacing.lg,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  dateText: {
    opacity: 0.6,
  },
  postTitle: {
    marginBottom: Spacing.sm,
  },
  postPreview: {
    opacity: 0.8,
    lineHeight: 22,
  },
  expandedContent: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  tipCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  tipTitle: {
    marginBottom: Spacing.xs,
  },
  tipContent: {
    opacity: 0.8,
    marginBottom: Spacing.sm,
  },
  proTip: {
    fontStyle: "italic",
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    flex: 1,
  },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: Spacing.sm,
  },
  reportText: {
    opacity: 0.6,
  },
  expandIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    opacity: 0.7,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
