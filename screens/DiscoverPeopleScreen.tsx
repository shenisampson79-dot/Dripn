import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image, TextInput } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ContributorColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSocial } from "@/contexts/SocialContext";
import { getAllDiscoverableUsers, getDiscoverableUserCountries, UserSummary } from "@/contexts/SocialContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";

type DiscoverPeopleScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "DiscoverPeople">;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

export default function DiscoverPeopleScreen({ navigation }: DiscoverPeopleScreenProps) {
  const { theme } = useTheme();
  const { sendFriendRequest, followUser, isFriend, hasPendingRequestTo, isFollowing } = useSocial();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showCountryFilter, setShowCountryFilter] = useState(false);

  const allMembers = useMemo(() => getAllDiscoverableUsers(), []);
  const countries = useMemo(() => getDiscoverableUserCountries(), []);

  const filteredMembers = useMemo(() => {
    return allMembers.filter(member => {
      const matchesSearch = searchQuery.trim() === "" || 
        member.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCountry = !selectedCountry || member.country === selectedCountry;
      return matchesSearch && matchesCountry;
    });
  }, [allMembers, searchQuery, selectedCountry]);

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const handleFollow = async (member: UserSummary) => {
    if (!isFollowing(member.id)) {
      await followUser(member.id);
    }
  };

  const handleFriendRequest = async (member: UserSummary) => {
    if (!isFriend(member.id) && !hasPendingRequestTo(member.id)) {
      await sendFriendRequest(member.id, member.name);
    }
  };

  const renderMemberCard = (item: UserSummary) => {
    const tierColor = item.tier ? ContributorColors[item.tier].background : theme.tabIconDefault;
    const isAlreadyFollowing = isFollowing(item.id);
    const isAlreadyFriend = isFriend(item.id);
    const hasPendingRequest = hasPendingRequestTo(item.id);

    return (
      <Pressable
        key={item.id}
        onPress={() => handleUserPress(item.id)}
        style={({ pressed }) => [
          styles.memberCard,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: tierColor + '30' }]}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <Feather name="user" size={28} color={tierColor} />
            )}
          </View>
          <View style={styles.memberInfo}>
            <ThemedText type="h3" style={styles.memberName}>
              {item.name}
            </ThemedText>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={theme.tabIconDefault} />
              <ThemedText type="small" style={styles.countryText}>
                {item.country || "Unknown"}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.tierBadge, { backgroundColor: tierColor + '20' }]}>
            <Feather name="award" size={12} color={tierColor} />
          </View>
        </View>

        <ThemedText type="body" style={styles.bio} numberOfLines={2}>
          {item.bio || "Fashion enthusiast"}
        </ThemedText>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText type="h4">{formatNumber(item.followersCount || 0)}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>Followers</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText type="h4">{item.postsCount || 0}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>Posts</ThemedText>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => handleFollow(item)}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: isAlreadyFollowing ? theme.backgroundSecondary : theme.link,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name={isAlreadyFollowing ? "check" : "user-plus"}
              size={14}
              color={isAlreadyFollowing ? theme.text : "#FFFFFF"}
            />
            <ThemedText
              type="small"
              style={{ color: isAlreadyFollowing ? theme.text : "#FFFFFF", fontWeight: "600" }}
            >
              {isAlreadyFollowing ? "Following" : "Follow"}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => handleFriendRequest(item)}
            disabled={isAlreadyFriend || hasPendingRequest}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: isAlreadyFriend
                  ? theme.link + '20'
                  : hasPendingRequest
                  ? theme.backgroundSecondary
                  : theme.backgroundSecondary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name={isAlreadyFriend ? "users" : hasPendingRequest ? "clock" : "user-plus"}
              size={14}
              color={isAlreadyFriend ? theme.link : theme.text}
            />
            <ThemedText
              type="small"
              style={{ color: isAlreadyFriend ? theme.link : theme.text, fontWeight: "600" }}
            >
              {isAlreadyFriend ? "Friends" : hasPendingRequest ? "Pending" : "Add Friend"}
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.headerContainer}>
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.tabIconDefault} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name..."
            placeholderTextColor={theme.tabIconDefault}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={18} color={theme.tabIconDefault} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => setShowCountryFilter(!showCountryFilter)}
          style={[
            styles.filterButton,
            {
              backgroundColor: selectedCountry ? theme.link : theme.backgroundDefault,
            },
          ]}
        >
          <Feather
            name="globe"
            size={16}
            color={selectedCountry ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="small"
            style={{
              color: selectedCountry ? "#FFFFFF" : theme.text,
              fontWeight: "600",
              marginLeft: Spacing.xs,
            }}
          >
            {selectedCountry || "All Countries"}
          </ThemedText>
          <Feather
            name={showCountryFilter ? "chevron-up" : "chevron-down"}
            size={14}
            color={selectedCountry ? "#FFFFFF" : theme.text}
          />
        </Pressable>

        {showCountryFilter ? (
          <View style={[styles.countryList, { backgroundColor: theme.backgroundDefault }]}>
            <Pressable
              onPress={() => {
                setSelectedCountry(null);
                setShowCountryFilter(false);
              }}
              style={[
                styles.countryItem,
                !selectedCountry && { backgroundColor: theme.link + '20' },
              ]}
            >
              <ThemedText type="body" style={!selectedCountry ? { fontWeight: "600" } : undefined}>
                All Countries
              </ThemedText>
            </Pressable>
            {countries.map(country => (
              <Pressable
                key={country}
                onPress={() => {
                  setSelectedCountry(country);
                  setShowCountryFilter(false);
                }}
                style={[
                  styles.countryItem,
                  selectedCountry === country && { backgroundColor: theme.link + '20' },
                ]}
              >
                <ThemedText
                  type="body"
                  style={selectedCountry === country ? { fontWeight: "600" } : undefined}
                >
                  {country}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <ThemedText type="body" style={styles.resultsText}>
          {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""} found
        </ThemedText>
      </View>

      {filteredMembers.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={64} color={theme.tabIconDefault} />
          <ThemedText type="h2" style={styles.emptyTitle}>
            No Members Found
          </ThemedText>
          <ThemedText type="body" style={styles.emptyText}>
            Try adjusting your search or filter criteria
          </ThemedText>
          {(searchQuery || selectedCountry) ? (
            <Pressable
              style={[styles.clearButton, { backgroundColor: theme.link }]}
              onPress={() => {
                setSearchQuery("");
                setSelectedCountry(null);
              }}
            >
              <ThemedText type="body" style={styles.clearButtonText}>
                Clear Filters
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.membersList}>
          {filteredMembers.map(member => renderMemberCard(member))}
        </View>
      )}
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: Spacing.lg,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
    gap: Spacing.xs,
  },
  countryList: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    maxHeight: 200,
    overflow: "hidden",
  },
  countryItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  resultsText: {
    marginTop: Spacing.md,
    opacity: 0.7,
  },
  membersList: {
    gap: Spacing.md,
  },
  memberCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  memberInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  memberName: {
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countryText: {
    opacity: 0.7,
  },
  tierBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bio: {
    opacity: 0.8,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.md,
  },
  emptyText: {
    opacity: 0.7,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  clearButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
