/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState } from "react";
import { StyleSheet, View, Pressable, Image, Alert, ScrollView, ActivityIndicator, ImageSourcePropType } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { PostCard } from "@/components/PostCard";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, SubscriptionColors, ContributorColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/contexts/PostsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useEventsFavorites } from "@/contexts/EventsFavoritesContext";
import { useOutfitFavorites, LikedOutfit } from "@/contexts/OutfitFavoritesContext";
import { getCategoryIcon } from "@/services/EventsService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { PortalMode } from "@/App";

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
  const { theme } = useTheme();
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

  const handleWardrobePress = () => {
    navigation.navigate("Wardrobe");
  };

  const handleCalendarPress = () => {
    navigation.navigate("OutfitCalendar");
  };

  const handleFashionTherapyPress = () => {
    navigation.navigate("FashionTherapy");
  };

  const handleWeatherOutfitPress = () => {
    navigation.navigate("WeatherOutfit");
  };

  const handleCostPerWearPress = () => {
    navigation.navigate("CostPerWear");
  };

  const handleStyleDNAPress = () => {
    navigation.navigate("StyleDNA");
  };

  const handleVirtualTryOnPress = () => {
    navigation.navigate("VirtualTryOn");
  };

  const handleColorAnalysisPress = () => {
    navigation.navigate("ColorAnalysis");
  };

  const getSubscriptionBadge = () => {
    const tier = user?.subscriptionTier || "free";
    const colors = SubscriptionColors[tier];
    return (
      <View style={[styles.subscriptionBadge, { backgroundColor: colors.backgroundStart || colors.background }]}>
        <ThemedText type="caption" style={{ color: colors.text, fontWeight: "600" }}>
          {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </ThemedText>
      </View>
    );
  };

  const getContributorBadge = () => {
    const tier = user?.contributorTier || "none";
    if (tier === "none") return null;
    const colors = ContributorColors[tier];
    return (
      <View style={[styles.contributorBadge, { backgroundColor: colors.background }]}>
        <Feather name="award" size={12} color={colors.text} />
        <ThemedText type="caption" style={{ color: colors.text, fontWeight: "600" }}>
          {colors.label}
        </ThemedText>
      </View>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <Pressable
          onPress={handleSettingsPress}
          style={({ pressed }) => [
            styles.settingsButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="settings" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.profileSection}>
        <Pressable onPress={handleEditProfilePress}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundDefault }]}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <Feather name="user" size={48} color={theme.tabIconDefault} />
            )}
            <View style={[styles.editAvatarBadge, { backgroundColor: theme.link }]}>
              <Feather name="edit-2" size={12} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        <ThemedText type="h2" style={styles.userName}>
          {user?.name || "Guest User"}
        </ThemedText>

        <View style={styles.badgesContainer}>
          {getSubscriptionBadge()}
          {getContributorBadge()}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h3">{user?.postsCount || 0}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Posts
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{user?.helpfulVotes || 0}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Helpful
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{user?.thanksReceived || 0}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Thanks
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={handleSubscriptionPress}
          style={({ pressed }) => [
            styles.upgradeButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="zap" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            {user?.subscriptionTier === "free" ? "Upgrade to Premium" : "Manage Subscription"}
          </ThemedText>
        </Pressable>

        {limits.canMakeVideoCalls ? (
          <Pressable
            onPress={handleVIPMembersPress}
            style={({ pressed }) => [
              styles.vipCallButton,
              { backgroundColor: '#F59E0B', opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Feather name="video" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={styles.upgradeButtonText}>
              VIP Video Calling
            </ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleWardrobePress}
          style={({ pressed }) => [
            styles.wardrobeButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="grid" size={18} color={theme.text} />
          <ThemedText type="body" style={styles.wardrobeButtonText}>
            My Wardrobe
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleCalendarPress}
          style={({ pressed }) => [
            styles.wardrobeButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1, marginTop: Spacing.sm },
          ]}
        >
          <Feather name="calendar" size={18} color={theme.text} />
          <ThemedText type="body" style={styles.wardrobeButtonText}>
            Outfit Calendar
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleFashionTherapyPress}
          style={({ pressed }) => [
            styles.therapyButton,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.sm },
          ]}
        >
          <Feather name="heart" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            Fashion Therapy
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleWeatherOutfitPress}
          style={({ pressed }) => [
            styles.weatherButton,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.sm },
          ]}
        >
          <Feather name="cloud" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            Weather Outfits
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleCostPerWearPress}
          style={({ pressed }) => [
            styles.analyticsButton,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.sm },
          ]}
        >
          <Feather name="pie-chart" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            Cost-per-Wear
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleStyleDNAPress}
          style={({ pressed }) => [
            styles.styleDNAButton,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.sm },
          ]}
        >
          <Feather name="git-branch" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            Style DNA
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleVirtualTryOnPress}
          style={({ pressed }) => [
            styles.tryOnButton,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.sm },
          ]}
        >
          <Feather name="camera" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            Virtual Try-On
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleColorAnalysisPress}
          style={({ pressed }) => [
            styles.colorAnalysisButton,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.sm },
          ]}
        >
          <Feather name="droplet" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            Color Analysis
          </ThemedText>
        </Pressable>

      </View>

      <View style={styles.tabsContainer}>
        <Pressable
          onPress={() => setActiveTab("posts")}
          style={[
            styles.tab,
            {
              borderBottomColor: activeTab === "posts" ? theme.link : "transparent",
            },
          ]}
        >
          <Feather
            name="grid"
            size={20}
            color={activeTab === "posts" ? theme.link : theme.tabIconDefault}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "posts" ? theme.link : theme.tabIconDefault,
              fontWeight: activeTab === "posts" ? "600" : "400",
            }}
          >
            My Posts
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("advice")}
          style={[
            styles.tab,
            {
              borderBottomColor: activeTab === "advice" ? theme.link : "transparent",
            },
          ]}
        >
          <Feather
            name="message-circle"
            size={20}
            color={activeTab === "advice" ? theme.link : theme.tabIconDefault}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "advice" ? theme.link : theme.tabIconDefault,
              fontWeight: activeTab === "advice" ? "600" : "400",
            }}
          >
            Advice
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("outfits")}
          style={[
            styles.tab,
            {
              borderBottomColor: activeTab === "outfits" ? theme.link : "transparent",
            },
          ]}
        >
          <Feather
            name="bookmark"
            size={20}
            color={activeTab === "outfits" ? theme.link : theme.tabIconDefault}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "outfits" ? theme.link : theme.tabIconDefault,
              fontWeight: activeTab === "outfits" ? "600" : "400",
              fontSize: 13,
            }}
          >
            Outfits
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("events")}
          style={[
            styles.tab,
            {
              borderBottomColor: activeTab === "events" ? theme.link : "transparent",
            },
          ]}
        >
          <Feather
            name="calendar"
            size={20}
            color={activeTab === "events" ? theme.link : theme.tabIconDefault}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "events" ? theme.link : theme.tabIconDefault,
              fontWeight: activeTab === "events" ? "600" : "400",
              fontSize: 13,
            }}
          >
            Events
          </ThemedText>
        </Pressable>
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
              <Feather name="camera" size={48} color={theme.tabIconDefault} />
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
            <Feather name="message-circle" size={48} color={theme.tabIconDefault} />
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
              <ActivityIndicator size="large" color={theme.link} />
              <ThemedText type="body" style={styles.emptySubtitle}>
                Loading liked outfits...
              </ThemedText>
            </View>
          ) : likedOutfits.length > 0 ? (
            <View style={styles.outfitsContainer}>
              {likedOutfits.map((outfit) => (
                <Card key={outfit.id} style={styles.likedOutfitCard}>
                  {outfit.outfitType === 'style_of_the_day' ? (
                    <>
                      <View style={styles.likedOutfitHeader}>
                        <View style={[styles.likedOutfitBadge, { backgroundColor: theme.link }]}>
                          <Feather name="star" size={12} color="#FFFFFF" />
                          <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                            Style of the Day
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => toggleOutfitLike(outfit)}
                          style={({ pressed }) => [
                            styles.unlikeButton,
                            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="bookmark" size={16} color={theme.link} />
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
                        <View style={[styles.likedOutfitBadge, { backgroundColor: theme.success || '#10B981' }]}>
                          <Feather name="grid" size={12} color="#FFFFFF" />
                          <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                            Similar Outfit
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => toggleOutfitLike(outfit)}
                          style={({ pressed }) => [
                            styles.unlikeButton,
                            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="bookmark" size={16} color={theme.link} />
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
                      <View style={[styles.styleTag, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText type="small" style={{ opacity: 0.8 }}>
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
                          <View style={[styles.likedOutfitAvatar, { backgroundColor: theme.backgroundSecondary }]}>
                            {(outfit as any).userAvatar ? (
                              <Image source={{ uri: (outfit as any).userAvatar }} style={styles.likedOutfitAvatarImg} />
                            ) : (
                              <Feather name="user" size={14} color={theme.tabIconDefault} />
                            )}
                          </View>
                          <ThemedText type="small" style={{ fontWeight: "600" }}>
                            {(outfit as any).userName}
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => toggleOutfitLike(outfit)}
                          style={({ pressed }) => [
                            styles.unlikeButton,
                            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="bookmark" size={16} color={theme.link} />
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
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="bookmark" size={48} color={theme.tabIconDefault} />
              <ThemedText type="h3" style={styles.emptyTitle}>
                No liked outfits
              </ThemedText>
              <ThemedText type="body" style={styles.emptySubtitle}>
                Save outfits from Style of the Day or community posts to view them here
              </ThemedText>
            </View>
          )
        ) : eventsLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={theme.link} />
            <ThemedText type="body" style={styles.emptySubtitle}>
              Loading liked events...
            </ThemedText>
          </View>
        ) : likedEvents.length > 0 ? (
          <View style={styles.eventsContainer}>
            {likedEvents.map((event) => (
              <Card key={event.id} style={styles.likedEventCard}>
                <View style={styles.likedEventHeader}>
                  <View style={[styles.likedEventIcon, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name={getCategoryIcon(event.category) as any} size={18} color={theme.link} />
                  </View>
                  <View style={styles.likedEventText}>
                    <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
                      {event.category}
                    </ThemedText>
                    <ThemedText type="h3" numberOfLines={1}>{event.title}</ThemedText>
                  </View>
                  <Pressable
                    onPress={() => toggleLike(event)}
                    style={({ pressed }) => [
                      styles.unlikeButton,
                      { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="heart" size={16} color="#E74C3C" />
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
                <View style={[styles.likedEventOutfit, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="star" size={12} color={theme.link} />
                  <ThemedText type="small" style={{ marginLeft: 4, flex: 1 }} numberOfLines={2}>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>Wear: </ThemedText>
                    {event.outfitSuggestion}
                  </ThemedText>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="heart" size={48} color={theme.tabIconDefault} />
            <ThemedText type="h3" style={styles.emptyTitle}>
              No liked events
            </ThemedText>
            <ThemedText type="body" style={styles.emptySubtitle}>
              Like events to save them here for easy access later
            </ThemedText>
          </View>
        )}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: Spacing.md,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
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
    marginBottom: Spacing.lg,
  },
  subscriptionBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  contributorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  statLabel: {
    opacity: 0.7,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  vipCallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  wardrobeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  therapyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: "#EC4899",
  },
  weatherButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: "#3B82F6",
  },
  analyticsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: "#8B5CF6",
  },
  styleDNAButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
  },
  tryOnButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: "#8B5CF6",
  },
  colorAnalysisButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: "#EC4899",
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  wardrobeButtonText: {
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
  },
  contentSection: {
    minHeight: 200,
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
  },
  likedEventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  likedEventIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
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
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  outfitsContainer: {
    gap: Spacing.md,
  },
  likedOutfitCard: {
    padding: Spacing.md,
    overflow: "hidden",
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
    borderRadius: BorderRadius.xs,
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
  },
  likedOutfitAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  likedOutfitImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.sm,
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
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
});
