/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState } from "react";
import { StyleSheet, View, Pressable, Image, Alert, ScrollView, ActivityIndicator, ImageSourcePropType } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { PostCard } from "@/components/PostCard";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, SubscriptionColors, ContributorColors, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/contexts/PostsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useEventsFavorites } from "@/contexts/EventsFavoritesContext";
import { useOutfitFavorites, LikedOutfit } from "@/contexts/OutfitFavoritesContext";
import { getCategoryIcon } from "@/services/EventsService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { PortalMode } from "@/App";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
};

type RegionalModelType = 'multicultural' | 'asian' | 'african' | 'middle-eastern' | 'south-asian' | 'latin-american';

const REGIONAL_STYLE_IMAGES: Record<RegionalModelType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/models/multicultural.png"),
  'asian': require("../assets/images/models/asian.png"),
  'african': require("../assets/images/models/african.png"),
  'middle-eastern': require("../assets/images/models/middle-eastern.png"),
  'south-asian': require("../assets/images/models/south-asian.png"),
  'latin-american': require("../assets/images/models/latin-american.png"),
};

const getStyleOfTheDayImage = (region: string): ImageSourcePropType => {
  return REGIONAL_STYLE_IMAGES[region as RegionalModelType] || REGIONAL_STYLE_IMAGES['multicultural'];
};

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Profile">;
  onOpenPortal?: (mode: PortalMode) => void;
};

export default function ProfileScreen({ navigation, onOpenPortal }: ProfileScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { posts, votePost, voteComparison, thankPost } = usePosts();
  const { limits } = useSubscription();
  const { getLikedEvents, toggleLike, isLoading: eventsLoading } = useEventsFavorites();
  const { getLikedOutfits, toggleOutfitLike, isOutfitLiked, isLoading: outfitsLoading } = useOutfitFavorites();
  const [activeTab, setActiveTab] = useState<"posts" | "advice" | "outfits" | "events">("posts");

  const userPosts = posts.filter((p) => p.userId === user?.id);
  const likedEvents = getLikedEvents();
  const likedOutfits = getLikedOutfits();

  const handleSettingsPress = () => {
    navigation.navigate("Settings");
  };

  const handleEditProfilePress = () => {
    navigation.navigate("EditProfile");
  };

  const handleSubscriptionPress = () => {
    navigation.navigate("Subscription");
  };

  const handleVIPMembersPress = () => {
    navigation.navigate("VIPMembers");
  };

  const getSubscriptionBadgeGradient = (): readonly [string, string] => {
    const tier = user?.subscriptionTier || "free";
    if (tier === 'premium' || tier === 'vip') {
      return [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const;
    }
    return [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const;
  };

  const getContributorBadge = () => {
    const tier = user?.contributorTier || "none";
    if (tier === "none") return null;
    const colors = ContributorColors[tier];
    return (
      <LinearGradient
        colors={[colors.background, colors.background]}
        style={styles.contributorBadge}
      >
        <Feather name="award" size={10} color={colors.text} />
        <ThemedText type="caption" style={{ color: colors.text, fontWeight: "600", fontSize: 11 }}>
          {colors.label}
        </ThemedText>
      </LinearGradient>
    );
  };

  const tabConfig = [
    { key: 'posts', label: 'Posts', icon: 'grid', color: LUXURY_COLORS.violet },
    { key: 'advice', label: 'Advice', icon: 'message-circle', color: LUXURY_COLORS.coral },
    { key: 'outfits', label: 'Outfits', icon: 'bookmark', color: LUXURY_COLORS.gold },
    { key: 'events', label: 'Events', icon: 'calendar', color: LUXURY_COLORS.teal },
  ];

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          ScreenGradients.profile.primary[0],
          ScreenGradients.profile.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>Profile</ThemedText>
          <Pressable
            onPress={handleSettingsPress}
            style={({ pressed }) => [
              styles.settingsButton,
              { backgroundColor: 'rgba(255,255,255,0.15)', opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="settings" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.profileSection}>
          <Pressable onPress={handleEditProfilePress}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold + '40', LUXURY_COLORS.violet + '40']}
              style={styles.avatarRing}
            >
              <View style={[styles.avatarContainer, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                    style={styles.avatarPlaceholder}
                  >
                    <Feather name="user" size={36} color="#FFFFFF" />
                  </LinearGradient>
                )}
              </View>
            </LinearGradient>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.editAvatarBadge}
            >
              <Feather name="edit-2" size={10} color={LUXURY_COLORS.midnight} />
            </LinearGradient>
          </Pressable>

          <ThemedText type="h2" style={[styles.userName, { color: '#FFFFFF' }]}>
            {user?.name || "Guest User"}
          </ThemedText>

          <View style={styles.badgesContainer}>
            <LinearGradient
              colors={getSubscriptionBadgeGradient()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscriptionBadge}
            >
              <ThemedText type="caption" style={styles.subscriptionBadgeText}>
                {(user?.subscriptionTier || 'free').charAt(0).toUpperCase() + (user?.subscriptionTier || 'free').slice(1)}
              </ThemedText>
            </LinearGradient>
            {getContributorBadge()}
          </View>
        </View>

        <View style={[styles.statsSection, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <LinearGradient
                colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                style={styles.statIconContainer}
              >
                <Feather name="image" size={14} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="h2" style={[styles.statNumber, { color: '#FFFFFF' }]}>{user?.postsCount || 0}</ThemedText>
              <ThemedText type="caption" style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>Posts</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
            <View style={styles.statItem}>
              <LinearGradient
                colors={[LUXURY_COLORS.coral, '#C46A4F']}
                style={styles.statIconContainer}
              >
                <Feather name="thumbs-up" size={14} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="h2" style={[styles.statNumber, { color: '#FFFFFF' }]}>{user?.helpfulVotes || 0}</ThemedText>
              <ThemedText type="caption" style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>Helpful</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
            <View style={styles.statItem}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.statIconContainer}
              >
                <Feather name="heart" size={14} color={LUXURY_COLORS.midnight} />
              </LinearGradient>
              <ThemedText type="h2" style={[styles.statNumber, { color: '#FFFFFF' }]}>{user?.thanksReceived || 0}</ThemedText>
              <ThemedText type="caption" style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>Thanks</ThemedText>
            </View>
          </View>
        </View>

      <View style={styles.actionsSection}>
        <LinearGradient
          colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.upgradeButtonGradient}
        >
          <Pressable
            onPress={handleSubscriptionPress}
            style={styles.upgradeButtonInner}
          >
            <Feather name="zap" size={18} color={LUXURY_COLORS.midnight} />
            <ThemedText type="body" style={styles.upgradeButtonText}>
              {user?.subscriptionTier === "free" ? "Upgrade to Personal Stylist" : "Manage Subscription"}
            </ThemedText>
          </Pressable>
        </LinearGradient>

        {limits.canMakeVideoCalls ? (
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.vipButtonGradient}
          >
            <Pressable
              onPress={handleVIPMembersPress}
              style={styles.upgradeButtonInner}
            >
              <Feather name="video" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                VIP Video Calling
              </ThemedText>
            </Pressable>
          </LinearGradient>
        ) : null}
      </View>

      <View style={styles.tabsContainer}>
        {tabConfig.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key as any)}
            style={styles.tabWrapper}
          >
            {activeTab === tab.key ? (
              <LinearGradient
                colors={[tab.color, tab.color + '80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.tabActive}
              >
                <Feather name={tab.icon as any} size={18} color="#FFFFFF" />
                <ThemedText type="caption" style={styles.tabTextActive}>
                  {tab.label}
                </ThemedText>
              </LinearGradient>
            ) : (
              <View style={[styles.tabInactive, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <Feather name={tab.icon as any} size={18} color={theme.tabIconDefault} />
                <ThemedText type="caption" style={{ opacity: 0.7 }}>
                  {tab.label}
                </ThemedText>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.contentSection}>
        {activeTab === "posts" ? (
          userPosts.length > 0 ? (
            <View style={styles.postsContainer}>
              {userPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => {}}
                  onVote={votePost}
                  onComparisonVote={voteComparison}
                  onThank={thankPost}
                  compact
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={[LUXURY_COLORS.violet + '30', LUXURY_COLORS.rose + '20']}
                style={styles.emptyIconOuter}
              >
                <LinearGradient
                  colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                  style={styles.emptyIconInner}
                >
                  <Feather name="camera" size={28} color="#FFFFFF" />
                </LinearGradient>
              </LinearGradient>
              <ThemedText type="h3" style={styles.emptyTitle}>
                No posts yet
              </ThemedText>
              <ThemedText type="body" style={styles.emptySubtitle}>
                Share your first outfit to get style advice
              </ThemedText>
            </View>
          )
        ) : activeTab === "advice" ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[LUXURY_COLORS.coral + '30', LUXURY_COLORS.rose + '20']}
              style={styles.emptyIconOuter}
            >
              <LinearGradient
                colors={[LUXURY_COLORS.coral, '#C46A4F']}
                style={styles.emptyIconInner}
              >
                <Feather name="message-circle" size={28} color="#FFFFFF" />
              </LinearGradient>
            </LinearGradient>
            <ThemedText type="h3" style={styles.emptyTitle}>
              No advice given yet
            </ThemedText>
            <ThemedText type="body" style={styles.emptySubtitle}>
              Help others with their style choices to build your reputation
            </ThemedText>
          </View>
        ) : activeTab === "outfits" ? (
          outfitsLoading ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.loadingContainer}
              >
                <ActivityIndicator size="large" color={LUXURY_COLORS.midnight} />
              </LinearGradient>
              <ThemedText type="body" style={styles.emptySubtitle}>
                Loading liked outfits...
              </ThemedText>
            </View>
          ) : likedOutfits.length > 0 ? (
            <View style={styles.outfitsContainer}>
              {likedOutfits.map((outfit) => (
                <View key={outfit.id} style={[styles.likedOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}>
                  {outfit.outfitType === 'style_of_the_day' ? (
                    <>
                      <View style={styles.likedOutfitHeader}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.likedOutfitBadge}
                        >
                          <Feather name="star" size={10} color={LUXURY_COLORS.midnight} />
                          <ThemedText type="caption" style={{ color: LUXURY_COLORS.midnight, fontWeight: "700", fontSize: 10 }}>
                            Style of the Day
                          </ThemedText>
                        </LinearGradient>
                        <Pressable
                          onPress={() => toggleOutfitLike(outfit)}
                          style={({ pressed }) => [
                            styles.unlikeButton,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="bookmark" size={14} color={LUXURY_COLORS.gold} />
                        </Pressable>
                      </View>
                      <Image 
                        source={getStyleOfTheDayImage(outfit.region)} 
                        style={styles.likedOutfitImage}
                      />
                      <ThemedText type="h3" style={styles.likedOutfitTitle}>
                        {outfit.title}
                      </ThemedText>
                      <ThemedText type="small" style={styles.likedOutfitDesc} numberOfLines={2}>
                        {outfit.description}
                      </ThemedText>
                    </>
                  ) : outfit.outfitType === 'similar_outfit' ? (
                    <>
                      <View style={styles.likedOutfitHeader}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.likedOutfitBadge}
                        >
                          <Feather name="grid" size={10} color="#FFFFFF" />
                          <ThemedText type="caption" style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 10 }}>
                            Similar Outfit
                          </ThemedText>
                        </LinearGradient>
                        <Pressable
                          onPress={() => toggleOutfitLike(outfit)}
                          style={({ pressed }) => [
                            styles.unlikeButton,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="bookmark" size={14} color={LUXURY_COLORS.teal} />
                        </Pressable>
                      </View>
                      {outfit.imageUri ? (
                        <Image 
                          source={{ uri: outfit.imageUri }} 
                          style={styles.likedOutfitImage}
                        />
                      ) : null}
                      <ThemedText type="h3" style={styles.likedOutfitTitle}>
                        {outfit.title}
                      </ThemedText>
                      <View style={[styles.styleTag, { backgroundColor: LUXURY_COLORS.teal + '20' }]}>
                        <ThemedText type="small" style={{ color: LUXURY_COLORS.teal, fontWeight: '600' }}>
                          {outfit.style.charAt(0).toUpperCase() + outfit.style.slice(1)} Style
                        </ThemedText>
                      </View>
                      {outfit.description ? (
                        <ThemedText type="small" style={styles.likedOutfitDesc} numberOfLines={2}>
                          {outfit.description}
                        </ThemedText>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <View style={styles.likedOutfitHeader}>
                        <View style={styles.likedOutfitUser}>
                          <LinearGradient
                            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                            style={styles.likedOutfitAvatar}
                          >
                            {(outfit as any).userAvatar ? (
                              <Image source={{ uri: (outfit as any).userAvatar }} style={styles.likedOutfitAvatarImg} />
                            ) : (
                              <Feather name="user" size={12} color="#FFFFFF" />
                            )}
                          </LinearGradient>
                          <ThemedText type="small" style={{ fontWeight: "600" }}>
                            {(outfit as any).userName}
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => toggleOutfitLike(outfit)}
                          style={({ pressed }) => [
                            styles.unlikeButton,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="bookmark" size={14} color={LUXURY_COLORS.violet} />
                        </Pressable>
                      </View>
                      {(outfit as any).media?.[0]?.uri || (outfit as any).images?.[0]?.uri ? (
                        <Image 
                          source={{ uri: (outfit as any).media?.[0]?.uri || (outfit as any).images?.[0]?.uri }} 
                          style={styles.likedOutfitImage}
                        />
                      ) : null}
                      <ThemedText type="small" style={styles.likedOutfitDesc} numberOfLines={2}>
                        {(outfit as any).description}
                      </ThemedText>
                    </>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold + '30', LUXURY_COLORS.champagne + '40']}
                style={styles.emptyIconOuter}
              >
                <LinearGradient
                  colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                  style={styles.emptyIconInner}
                >
                  <Feather name="bookmark" size={28} color={LUXURY_COLORS.midnight} />
                </LinearGradient>
              </LinearGradient>
              <ThemedText type="h3" style={styles.emptyTitle}>
                No liked outfits
              </ThemedText>
              <ThemedText type="body" style={styles.emptySubtitle}>
                Save outfits from Style of the Day or community posts
              </ThemedText>
            </View>
          )
        ) : eventsLoading ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
              style={styles.loadingContainer}
            >
              <ActivityIndicator size="large" color="#FFFFFF" />
            </LinearGradient>
            <ThemedText type="body" style={styles.emptySubtitle}>
              Loading liked events...
            </ThemedText>
          </View>
        ) : likedEvents.length > 0 ? (
          <View style={styles.eventsContainer}>
            {likedEvents.map((event) => (
              <View key={event.id} style={[styles.likedEventCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}>
                <View style={styles.likedEventHeader}>
                  <LinearGradient
                    colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                    style={styles.likedEventIcon}
                  >
                    <Feather name={getCategoryIcon(event.category) as any} size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.likedEventText}>
                    <ThemedText type="caption" style={{ color: LUXURY_COLORS.teal, fontWeight: "600" }}>
                      {event.category}
                    </ThemedText>
                    <ThemedText type="h3" numberOfLines={1}>{event.title}</ThemedText>
                  </View>
                  <Pressable
                    onPress={() => toggleLike(event)}
                    style={({ pressed }) => [
                      styles.unlikeButton,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="heart" size={14} color={LUXURY_COLORS.coral} />
                  </Pressable>
                </View>
                <View style={styles.likedEventDetails}>
                  <View style={styles.likedEventDetail}>
                    <Feather name="calendar" size={12} color={theme.tabIconDefault} />
                    <ThemedText type="small" style={{ marginLeft: 4, opacity: 0.7 }}>
                      {event.date}
                    </ThemedText>
                  </View>
                  <View style={styles.likedEventDetail}>
                    <Feather name="clock" size={12} color={theme.tabIconDefault} />
                    <ThemedText type="small" style={{ marginLeft: 4, opacity: 0.7 }}>
                      {event.time}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.likedEventDetail}>
                  <Feather name="map-pin" size={12} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ marginLeft: 4, opacity: 0.7 }}>
                    {event.location}
                  </ThemedText>
                </View>
                <LinearGradient
                  colors={[LUXURY_COLORS.gold + '20', LUXURY_COLORS.champagne + '30']}
                  style={styles.likedEventOutfit}
                >
                  <Feather name="star" size={12} color={LUXURY_COLORS.gold} />
                  <ThemedText type="small" style={{ marginLeft: 4, flex: 1 }} numberOfLines={2}>
                    <ThemedText type="small" style={{ fontWeight: "700", color: LUXURY_COLORS.gold }}>Wear: </ThemedText>
                    {event.outfitSuggestion}
                  </ThemedText>
                </LinearGradient>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[LUXURY_COLORS.teal + '30', LUXURY_COLORS.emerald + '20']}
              style={styles.emptyIconOuter}
            >
              <LinearGradient
                colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                style={styles.emptyIconInner}
              >
                <Feather name="calendar" size={28} color="#FFFFFF" />
              </LinearGradient>
            </LinearGradient>
            <ThemedText type="h3" style={styles.emptyTitle}>
              No liked events
            </ThemedText>
            <ThemedText type="body" style={styles.emptySubtitle}>
              Like events to save them here for easy access
            </ThemedText>
          </View>
        )}
        </View>
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroGradient: {
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    alignItems: "center",
  },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: Spacing.md,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    marginBottom: Spacing.sm,
  },
  badgesContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  subscriptionBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  subscriptionBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  contributorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  statsSection: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: -Spacing.md,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 22,
  },
  statLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
  },
  actionsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  upgradeButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  vipButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  upgradeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  upgradeButtonText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: "700",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tabWrapper: {
    flex: 1,
  },
  tabActive: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabInactive: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contentSection: {
    minHeight: 200,
    paddingHorizontal: Spacing.lg,
  },
  postsContainer: {
    gap: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  eventsContainer: {
    gap: Spacing.md,
  },
  likedEventCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  likedEventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  likedEventIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  likedEventText: {
    flex: 1,
  },
  unlikeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  likedEventDetails: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  likedEventDetail: {
    flexDirection: "row",
    alignItems: "center",
  },
  likedEventOutfit: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  outfitsContainer: {
    gap: Spacing.md,
  },
  likedOutfitCard: {
    padding: Spacing.md,
    overflow: "hidden",
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  likedOutfitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  likedOutfitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  likedOutfitUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  likedOutfitAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
  },
  likedOutfitAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  likedOutfitImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  likedOutfitTitle: {
    marginBottom: 4,
  },
  likedOutfitDesc: {
    opacity: 0.7,
  },
  styleTag: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
});
