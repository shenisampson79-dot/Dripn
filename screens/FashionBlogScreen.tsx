import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/ApiService";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";
import {
  type BlogPost,
  applyCurrentYearToBlogPost,
  filterBlogPostsForProfile,
  formatBlogPostDate,
  prepareFallbackBlogPosts,
} from "@/utils/fashionBlogUtils";
import { getFallbackBlogPosts } from "@/data/blog/getFallbackBlogPosts";
import { resolveContentLang } from "@/utils/contentLang";
import { getCurrentCalendarSeason, mapUserGenderToNewsletterFilter } from "@/utils/fashionSeason";
import { useTranslations } from "@/contexts/TranslationContext";

type FashionBlogScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "FashionBlog">;
};

const NEWSLETTER_SUBSCRIPTION_KEY = "@dripn_newsletter_subscribed";
export default function FashionBlogScreen({ navigation }: FashionBlogScreenProps) {
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const { user } = useAuth();
  const route = useRoute<RouteProp<UserStylistStackParamList, "FashionBlog">>();
  const highlightArticle = route.params?.highlightArticle;
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [contentNotice, setContentNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
    fetchPosts();
  }, [user?.gender, currentLanguage]);

  useEffect(() => {
    if (!highlightArticle || loading) return;

    const ensureHighlightedPost = () => {
      setPosts((prev) => {
        if (prev.some((p) => p.id === highlightArticle)) return prev;
        if (highlightArticle !== "fallback-color-guide") return prev;
        const guide = prepareFallbackBlogPosts(getFallbackBlogPosts(currentLanguage)).find(
          (p) => p.id === highlightArticle,
        );
        return guide ? [guide, ...prev] : prev;
      });
      setExpandedPost(highlightArticle);
    };

    ensureHighlightedPost();
  }, [highlightArticle, loading, currentLanguage]);

  const applyProfileFilters = useCallback((items: BlogPost[]) => {
    return filterBlogPostsForProfile(items, user, getCurrentCalendarSeason());
  }, [user]);

  const loadFallbackPosts = useCallback((notice?: string) => {
    const prepared = prepareFallbackBlogPosts(getFallbackBlogPosts(currentLanguage));
    setPosts(applyProfileFilters(prepared));
    setIsUsingFallback(true);
    setContentNotice(notice ?? null);
  }, [applyProfileFilters, currentLanguage]);

  const mapNewslettersToPosts = (newsletters: Array<Record<string, unknown>>): BlogPost[] => {
    return newsletters.map((newsletter) => {
      const aiGenerated = Boolean(newsletter.aiGenerated);
      const base: BlogPost = {
        id: String(newsletter.id ?? newsletter.slug ?? ''),
        subject: String(newsletter.subject ?? ''),
        headline: String(newsletter.headline ?? newsletter.subject ?? ''),
        previewText: String(newsletter.previewText ?? newsletter.introduction ?? '').substring(0, 100),
        introduction: String(newsletter.introduction ?? newsletter.previewText ?? ''),
        category: String(newsletter.category ?? 'Style'),
        tags: (newsletter.tags as string[]) || [],
        publishedAt: String(newsletter.publishedAt ?? new Date().toISOString()),
        tips: (newsletter.tips as BlogPost['tips']) || [],
        gender: (newsletter.gender as BlogPost['gender']) || 'all',
        season: (newsletter.season as BlogPost['season']) || 'all',
        isEvergreen: false,
        aiGenerated,
        sourcesUsed: (newsletter.sourcesUsed as string[]) || [],
        researchedAt: newsletter.researchedAt ? String(newsletter.researchedAt) : null,
      };
      return aiGenerated ? base : applyCurrentYearToBlogPost(base);
    });
  };

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
      setContentNotice(null);

      // Non-English UI: prefer localized curated guides over English API newsletters.
      if (resolveContentLang(currentLanguage) !== 'en') {
        loadFallbackPosts(t('blog.curatedGuides') || 'Curated style guides — not live newsletter issues.');
        return;
      }

      const gender = mapUserGenderToNewsletterFilter(user?.gender);
      
      if (!apiService.isConfigured()) {
        loadFallbackPosts(t('blog.offlineNotice') || 'Connect to the internet to load weekly newsletter issues.');
        return;
      }

      const response = await apiService.getPublishedNewsletters({
        limit: 20,
        gender,
        season: getCurrentCalendarSeason(),
      });
      
      const newsletters = response.newsletters ?? [];
      if (newsletters.length > 0) {
        const formattedPosts = mapNewslettersToPosts(newsletters as Array<Record<string, unknown>>);
        const filtered = applyProfileFilters(formattedPosts);
        if (filtered.length > 0) {
          setPosts(filtered);
          setIsUsingFallback(false);
        } else {
          setPosts(formattedPosts);
          setIsUsingFallback(false);
          setContentNotice(t('blog.filterNotice') || 'No issues matched your season or profile filter — showing all published newsletters.');
        }
      } else {
        loadFallbackPosts(t('blog.noIssuesYet') || 'No weekly issues published yet — curated guides below until the newsletter feed goes live.');
      }
    } catch (error) {
      console.log("Error fetching newsletters, using fallback:", error);
      loadFallbackPosts(t('blog.serverError') || "Couldn't reach the newsletter server — curated guides below.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [user?.gender, currentLanguage, applyProfileFilters, loadFallbackPosts]);

  const formatDate = (post: BlogPost) => formatBlogPostDate(post, post.publishedAt);

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!user?.email) {
      Alert.alert(
        t('settings.newsletterEmailRequired') || t('common.emailRequired') || "Email Required",
        t('settings.newsletterEmailRequiredMessage') || t('common.addAnEmailAddressToYourDripnAccountToRec') || "Add an email address to your Dripn account to receive the weekly newsletter.",
        [{ text: t('common.ok') || "OK" }],
      );
      return;
    }

    if (!apiService.isConfigured()) {
      Alert.alert(
        t('settings.newsletterConnectionRequired') || t('common.connectionRequired') || "Connection Required",
        t('settings.newsletterConnectionRequiredMessage') || t('common.connectToTheInternetToSubscribeToTheWeek') || "Connect to the internet to subscribe to the weekly newsletter.",
        [{ text: t('common.ok') || "OK" }],
      );
      return;
    }

    try {
      const result = await apiService.subscribeToNewsletter(user.email, user.name);
      const subscribed = Boolean(
        result?.success
        || result?.alreadySubscribed
        || result?.resubscribed
        || /subscribed|resubscribed/i.test(result?.message ?? ''),
      );
      if (!subscribed) {
        throw new Error(result?.message || "Subscribe failed");
      }

      await AsyncStorage.setItem(NEWSLETTER_SUBSCRIPTION_KEY, "true");
      setIsSubscribed(true);
      await fetchPosts();

      Alert.alert(
        t('blog.subscribed'),
        t('settings.newsletterSubscribed'),
        [{ text: t('common.ok') || "OK" }],
      );
    } catch (error) {
      console.log("Newsletter subscribe failed:", error);
      Alert.alert(
        t('settings.newsletterUpdateFailed') || t('common.subscriptionFailed') || "Subscription Failed",
        t('common.weCouldntSaveYourSubscription') || "We couldn't save your subscription. Please try again later.",
        [{ text: t('common.ok') || "OK" }],
      );
    }
  };

  const handleReport = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReportingPostId(postId);
    
    Alert.alert(t('common.reportIssue') || "Report Issue", t('common.whatWouldYouLikeToReport') || "What would you like to report?",
      [
        { text: t('fashionBlog.reportTypo') || "Typo or Error", onPress: () => submitReport(postId, "typo", "Typo or grammatical error reported") },
        { text: t('fashionBlog.reportOffensive') || "Offensive Content", onPress: () => submitReport(postId, "offensive", "Content flagged as potentially offensive") },
        { text: t('fashionBlog.reportInaccurate') || "Inaccurate Information", onPress: () => submitReport(postId, "inaccurate", "Information reported as potentially inaccurate") },
        { text: t('common.cancel'), style: "cancel", onPress: () => setReportingPostId(null) }
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
      
      Alert.alert(t('common.reportSubmitted') || "Report Submitted", t('common.thankYouForYourFeedbackOurTeamWillReview') || "Thank you for your feedback. Our team will review this content.",
        [{ text: t('common.ok') || "OK" }]
      );
    } catch (error) {
      console.log("Error submitting report:", error);
      Alert.alert(
        t('common.reportFailed') || "Report Failed",
        t('common.weCouldntSubmitYourReport') || "We couldn't submit your report. Please try again later.",
        [{ text: t('common.ok') || "OK" }],
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
      <ThemedText type="body" style={styles.subtitle}>
        {t('fashionBlog.subtitle') || t('blog.subtitle') || 'AI-researched weekly style insights and styling tips'}
      </ThemedText>

      {isUsingFallback || contentNotice ? (
        <View style={[styles.fallbackBanner, { backgroundColor: isDark ? 'rgba(255,193,7,0.12)' : 'rgba(255,193,7,0.18)' }]}>
          <Feather name="book-open" size={16} color={theme.link} />
          <ThemedText type="small" style={styles.fallbackBannerText}>
            {contentNotice
              ?? (isUsingFallback
                ? (isSubscribed
                  ? (t('blog.noIssuesYet') || 'No weekly issues published yet — curated guides below.')
                  : (t('blog.curatedGuides') || 'Curated style guides — not live newsletter issues.'))
                : null)}
          </ThemedText>
        </View>
      ) : null}
      
      {!isSubscribed ? (
        <Card style={[styles.subscribeCard, { backgroundColor: isDark ? "rgba(201, 169, 97, 0.15)" : "rgba(201, 169, 97, 0.1)" }]}>
          <View style={styles.subscribeContent}>
            <View style={styles.subscribeIcon}>
              <Feather name="mail" size={24} color={theme.link} />
            </View>
            <View style={styles.subscribeText}>
              <ThemedText type="h3">
                {t('fashionBlog.getWeeklyUpdates') || t('blog.subscribe') || 'Get Weekly Updates'}
              </ThemedText>
              <ThemedText type="small" style={styles.subscribeSubtext}>
                {t('fashionBlog.newsletterJoin') || t('blog.joinNewsletter') || 'Join the Dripn newsletter for weekly fashion insights delivered to your inbox.'}
              </ThemedText>
            </View>
          </View>
          <Button onPress={handleSubscribe} style={styles.subscribeButton}>
            {t('fashionBlog.subscribe') || t('blog.subscribe') || 'Subscribe'}
          </Button>
        </Card>
      ) : (
        <View style={[styles.subscribedBadge, { backgroundColor: isDark ? "rgba(52, 199, 89, 0.2)" : "rgba(52, 199, 89, 0.1)" }]}>
          <Feather name="check-circle" size={16} color={theme.success || "#34C759"} />
          <ThemedText type="small" style={[styles.subscribedBadgeText, { color: theme.success || "#34C759" }]}>
            {t('fashionBlog.subscribedWeekly') || t('blog.subscribed') || "Subscribed · weekly issues below"}
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
            <View style={styles.postHeaderBadges}>
              <View style={[styles.categoryBadge, { backgroundColor: isDark ? "rgba(201, 169, 97, 0.2)" : "rgba(201, 169, 97, 0.15)" }]}>
                <ThemedText type="caption" style={{ color: theme.link }}>
                  {item.category}
                </ThemedText>
              </View>
              {item.aiGenerated ? (
                <View style={[styles.aiBadge, { backgroundColor: isDark ? "rgba(100, 149, 237, 0.2)" : "rgba(100, 149, 237, 0.15)" }]}>
                  <Feather name="cpu" size={11} color={theme.link} />
                  <ThemedText type="caption" style={{ color: theme.link, marginLeft: 4 }}>
                    AI-researched
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText type="caption" style={styles.dateText}>
              {formatDate(item)}
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
              {item.aiGenerated && item.sourcesUsed && item.sourcesUsed.length > 0 ? (
                <ThemedText type="caption" style={styles.sourcesLine}>
                  Researched from: {item.sourcesUsed.slice(0, 4).join(' · ')}
                </ThemedText>
              ) : null}
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
              {isExpanded
                ? (t('fashionBlog.showLess') || t('blog.showLess') || 'Show less')
                : (t('fashionBlog.readMore') || t('blog.readMore') || 'Read more')}
            </ThemedText>
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="book-open" size={48} color={theme.tabIconDefault} />
      <ThemedText type="h3" style={styles.emptyTitle}>
        {t('fashionBlog.noArticlesYet') || t('blog.emptyTitle') || 'No articles yet'}
      </ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        {t('fashionBlog.checkBackSoon') || t('blog.emptyMessage') || 'Check back soon for new fashion reads.'}
      </ThemedText>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={styles.loadingText}>
          {t('fashionBlog.loadingArticles') || 'Loading articles...'}
        </ThemedText>
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
      opaqueHeader
      contentContainerStyle={styles.listContent}
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
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 0,
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
    marginBottom: Spacing.lg,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: Spacing.md,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  fallbackBannerText: {
    flex: 1,
    opacity: 0.85,
    lineHeight: 18,
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
  subscribedBadgeText: {
    flex: 1,
    fontWeight: "600",
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
  postHeaderBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexShrink: 1,
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  sourcesLine: {
    opacity: 0.65,
    marginBottom: Spacing.md,
    lineHeight: 18,
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
