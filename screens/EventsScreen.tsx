import React, { useState, useEffect, useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable, RefreshControl, Platform, ActivityIndicator, Linking, Alert, Share } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useEventsFavorites } from "@/contexts/EventsFavoritesContext";
import { useStyleProfile } from "@/contexts/StyleProfileContext";
import apiService from "@/services/ApiService";
import { 
  EventsService, 
  Event, 
  LocationData,
  getCategoryIcon,
  estimateTravelTime,
  getMapsUrl,
} from "@/services/EventsService";

interface PersonalizedEventRanking {
  eventTitle: string;
  matchScore: number;
  whyItSuits: string;
  outfitSuggestion: string;
}

export default function EventsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useEventsFavorites();
  const { hasStyleProfile } = useStyleProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [personalizedRankings, setPersonalizedRankings] = useState<PersonalizedEventRanking[]>([]);
  const [loadingPersonalization, setLoadingPersonalization] = useState(false);
  const [topPick, setTopPick] = useState<{ eventTitle: string; reason: string } | null>(null);

  const isVip = user?.subscriptionTier === "vip";

  const getEventRanking = useCallback((eventTitle: string): PersonalizedEventRanking | undefined => {
    return personalizedRankings.find(r => r.eventTitle.toLowerCase() === eventTitle.toLowerCase());
  }, [personalizedRankings]);

  const handleShareEvent = async (event: Event) => {
    try {
      const message = `Check out this event on Dripn!\n\n${event.title}\n${event.date} at ${event.time}\n${event.location}\n${event.price}\n\nWhat to wear: ${event.outfitSuggestion}`;
      await Share.share({
        message,
        title: event.title,
      });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const handleToggleLike = async (event: Event) => {
    await toggleLike(event);
  };

  const categories = EventsService.getCategories(events);
  const filteredEvents = EventsService.filterEvents(events, selectedCategory, isVip);

  const fetchLocationAndEvents = useCallback(async () => {
    try {
      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      const cityName = reverseGeocode?.city || reverseGeocode?.subregion || reverseGeocode?.region || "your area";
      
      const locData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        cityName,
      };
      
      setLocationData(locData);
      
      const fetchedEvents = await EventsService.fetchEvents(locData, user?.country);
      setEvents(fetchedEvents);
    } catch (error) {
      console.log("Location/Events fetch error:", error);
      const fetchedEvents = await EventsService.fetchEvents(undefined, user?.country);
      setEvents(fetchedEvents);
    } finally {
      setLoading(false);
    }
  }, [user?.country]);

  const fetchEventsWithoutLocation = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedEvents = await EventsService.fetchEvents(undefined, user?.country);
      setEvents(fetchedEvents);
    } catch (error) {
      console.log("Events fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.country]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (locationEnabled && locationData) {
        const refreshedEvents = await EventsService.refreshEvents(locationData, user?.country);
        setEvents(refreshedEvents);
      } else if (locationEnabled) {
        await fetchLocationAndEvents();
      } else {
        const refreshedEvents = await EventsService.refreshEvents(undefined, user?.country);
        setEvents(refreshedEvents);
      }
    } catch (error) {
      console.log("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [locationEnabled, locationData, fetchLocationAndEvents, user?.country]);

  const requestLocation = useCallback(async () => {
    try {
      const currentPermission = await Location.getForegroundPermissionsAsync();
      
      if (currentPermission.status === "denied" && !currentPermission.canAskAgain) {
        Alert.alert(
          "Location Permission Required",
          "Location access was previously denied. Please enable location in your device Settings to see events near you.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Open Settings", 
              onPress: () => {
                if (Platform.OS !== "web") {
                  Linking.openSettings().catch(() => {});
                }
              }
            }
          ]
        );
        return;
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationEnabled(status === "granted");
      if (status === "granted") {
        await fetchLocationAndEvents();
      } else {
        Alert.alert(
          "Location Not Enabled",
          "Enable location access to see personalized events near you and get directions."
        );
      }
    } catch (error) {
      console.log("Location permission error:", error);
      Alert.alert("Error", "Could not request location permission. Please try again.");
    }
  }, [fetchLocationAndEvents]);

  useEffect(() => {
    const initialize = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationEnabled(status === "granted");
      if (status === "granted") {
        await fetchLocationAndEvents();
      } else {
        await fetchEventsWithoutLocation();
      }
    };
    initialize();
  }, [fetchLocationAndEvents, fetchEventsWithoutLocation]);

  useEffect(() => {
    const fetchPersonalizedRankings = async () => {
      if (!hasStyleProfile || events.length === 0 || !apiService.isConfigured()) {
        setPersonalizedRankings([]);
        setTopPick(null);
        return;
      }

      setLoadingPersonalization(true);
      try {
        const eventsForApi = events.slice(0, 10).map(e => ({
          id: e.id,
          title: e.title,
          category: e.category,
          date: e.date,
          time: e.time,
          description: e.description,
        }));

        const result = await apiService.getPersonalizedEventRankings(eventsForApi);
        if (result.personalized && result.eventRecommendations) {
          setPersonalizedRankings(result.eventRecommendations.rankedEvents);
          setTopPick(result.eventRecommendations.topPick);
        }
      } catch (error) {
        console.log("Failed to fetch personalized event rankings:", error);
      } finally {
        setLoadingPersonalization(false);
      }
    };

    fetchPersonalizedRankings();
  }, [hasStyleProfile, events]);

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.link} />
      }
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Feather name="calendar" size={24} color={theme.link} />
            <ThemedText type="h1" style={styles.title}>
              {locationData?.cityName ? `Events in ${locationData.cityName}` : "Events Near You"}
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.subtitle}>
            {loading ? "Finding events near you..." : "Discover events to wear your outfits to"}
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.link} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
              Discovering events...
            </ThemedText>
          </View>
        ) : null}

        {!locationEnabled ? (
          <Card style={styles.locationCard}>
            <Feather name="map-pin" size={24} color={theme.link} />
            <View style={styles.locationContent}>
              <ThemedText type="h3">Enable Location</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Get personalized event recommendations near you
              </ThemedText>
            </View>
            <Pressable
              onPress={requestLocation}
              style={({ pressed }) => [
                styles.enableButton,
                { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                Enable
              </ThemedText>
            </Pressable>
          </Card>
        ) : null}

        {!loading && hasStyleProfile && topPick ? (
          <Card style={styles.topPickCard}>
            <View style={styles.topPickHeader}>
              <View style={[styles.topPickBadge, { backgroundColor: theme.link }]}>
                <Feather name="award" size={14} color="#FFFFFF" />
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: 4 }}>
                  Your Top Pick
                </ThemedText>
              </View>
              {loadingPersonalization ? (
                <ActivityIndicator size="small" color={theme.link} />
              ) : null}
            </View>
            <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
              {topPick.eventTitle}
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.8, marginTop: Spacing.xs }}>
              {topPick.reason}
            </ThemedText>
          </Card>
        ) : null}

        {!loading ? (
          <View style={styles.categoriesContainer}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selectedCategory === category.id ? theme.link : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{ color: selectedCategory === category.id ? "#FFFFFF" : theme.text }}
                >
                  {category.name} ({category.count})
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.eventsContainer}>
          {filteredEvents.map((event) => {
            const ranking = getEventRanking(event.title);
            const isTopPick = topPick?.eventTitle.toLowerCase() === event.title.toLowerCase();
            
            return (
            <Card key={event.id} style={styles.eventCard}>
              {isTopPick && hasStyleProfile ? (
                <View style={[styles.topPickIndicator, { backgroundColor: theme.link }]}>
                  <Feather name="award" size={12} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 4, fontSize: 11 }}>
                    Top Pick For You
                  </ThemedText>
                </View>
              ) : null}
              
              {ranking && !isTopPick ? (
                <View style={[styles.matchScoreBadge, { backgroundColor: ranking.matchScore >= 80 ? "#27AE60" : ranking.matchScore >= 60 ? "#F39C12" : theme.backgroundSecondary }]}>
                  <Feather name="target" size={12} color={ranking.matchScore >= 60 ? "#FFFFFF" : theme.text} />
                  <ThemedText type="small" style={{ color: ranking.matchScore >= 60 ? "#FFFFFF" : theme.text, fontWeight: "600", marginLeft: 4, fontSize: 11 }}>
                    {ranking.matchScore}% Match
                  </ThemedText>
                </View>
              ) : null}
              
              <View style={styles.eventHeader}>
                <View style={[styles.categoryIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name={getCategoryIcon(event.category) as any} size={20} color={theme.link} />
                </View>
                <View style={styles.eventHeaderText}>
                  <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
                    {event.category}
                  </ThemedText>
                  <ThemedText type="h3">{event.title}</ThemedText>
                </View>
                {event.isVipOnly ? (
                  <View style={[styles.vipBadge, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="award" size={12} color={theme.link} />
                  </View>
                ) : null}
              </View>

              <ThemedText type="body" style={styles.description}>
                {event.description}
              </ThemedText>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Feather name="calendar" size={14} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ marginLeft: 4, opacity: 0.7 }}>
                    {event.date}
                  </ThemedText>
                </View>
                <View style={styles.detailItem}>
                  <Feather name="clock" size={14} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ marginLeft: 4, opacity: 0.7 }}>
                    {event.time}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Feather name="map-pin" size={14} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ marginLeft: 4, opacity: 0.7 }}>
                    {event.location}
                  </ThemedText>
                </View>
                <View style={styles.detailItem}>
                  <ThemedText type="small" style={{ opacity: 0.7 }}>
                    {event.price.toLowerCase().includes("free") ? "Free Entry" : event.price}
                  </ThemedText>
                </View>
              </View>

              {event.category !== "Flights" && event.distance && event.distance > 0 ? (
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Feather name="navigation" size={14} color={theme.link} />
                    <ThemedText type="small" style={{ marginLeft: 4, color: theme.link, fontWeight: "600" }}>
                      {event.distance} km away
                    </ThemedText>
                  </View>
                  <View style={styles.detailItem}>
                    <Feather name="clock" size={14} color={theme.link} />
                    <ThemedText type="small" style={{ marginLeft: 4, color: theme.link, fontWeight: "600" }}>
                      {estimateTravelTime(event.distance)}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {event.coordinates && event.category !== "Flights" ? (
                <Pressable
                  onPress={async () => {
                    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
                    const url = getMapsUrl(event.coordinates!, event.title, platform);
                    try {
                      const canOpen = await Linking.canOpenURL(url);
                      if (canOpen) {
                        await Linking.openURL(url);
                      } else {
                        Alert.alert("Unable to Open Maps", "Please ensure you have a maps app or web browser installed.");
                      }
                    } catch (error) {
                      Alert.alert("Error", "Could not open directions. Please try again.");
                    }
                  }}
                  style={({ pressed }) => [
                    styles.directionsButton,
                    { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="map" size={14} color={theme.link} />
                  <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.link, fontWeight: "600" }}>
                    Get Directions
                  </ThemedText>
                  <Feather name="external-link" size={12} color={theme.link} style={{ marginLeft: 4 }} />
                </Pressable>
              ) : null}

              <View style={[styles.outfitSuggestion, { backgroundColor: ranking ? theme.link + "15" : theme.backgroundSecondary }]}>
                <Feather name={ranking ? "zap" : "star"} size={14} color={theme.link} />
                <View style={{ marginLeft: Spacing.xs, flex: 1 }}>
                  <ThemedText type="small">
                    <ThemedText type="small" style={{ fontWeight: "600" }}>
                      {ranking ? "Personalized outfit: " : "What to wear: "}
                    </ThemedText>
                    {ranking?.outfitSuggestion || event.outfitSuggestion}
                  </ThemedText>
                  {ranking?.whyItSuits ? (
                    <ThemedText type="small" style={{ opacity: 0.7, marginTop: 4, fontStyle: "italic" }}>
                      {ranking.whyItSuits}
                    </ThemedText>
                  ) : null}
                </View>
              </View>

              <View style={styles.eventFooter}>
                <ThemedText type="small" style={{ opacity: 0.5 }}>
                  via {event.source}
                </ThemedText>
                <View style={styles.actionButtons}>
                  <Pressable
                    onPress={() => handleToggleLike(event)}
                    style={({ pressed }) => [
                      styles.likeButton,
                      { 
                        backgroundColor: isLiked(event.id) ? "#E74C3C" : theme.backgroundSecondary, 
                        opacity: pressed ? 0.7 : 1 
                      },
                    ]}
                  >
                    <Feather 
                      name="heart" 
                      size={16} 
                      color={isLiked(event.id) ? "#FFFFFF" : theme.tabIconDefault} 
                    />
                    {isLiked(event.id) ? (
                      <ThemedText type="small" style={styles.savedText}>Saved</ThemedText>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => handleShareEvent(event)}
                    style={({ pressed }) => [
                      styles.iconButton,
                      { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="share-2" size={18} color={theme.tabIconDefault} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        event.title,
                        `${event.description}\n\nDate: ${event.date}\nTime: ${event.time}\nLocation: ${event.location}\nPrice: ${event.price}\n\nWhat to wear: ${event.outfitSuggestion}\n\nSource: ${event.source}`,
                        [{ text: "Close", style: "default" }]
                      );
                    }}
                    style={({ pressed }) => [
                      styles.viewButton,
                      { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                      View Details
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </Card>
            );
          })}
        </View>

        <Card style={styles.sourcesCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
            Event Sources
          </ThemedText>
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            We curate events from Timeout, TodayTix, Eventbrite, Meetup, ClassPass, and local sources to help you find the perfect occasions to wear your outfits.
          </ThemedText>
        </Card>
      </ThemedView>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    marginLeft: Spacing.xs,
  },
  subtitle: {
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  locationContent: {
    flex: 1,
  },
  enableButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  categoryChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  eventsContainer: {
    gap: Spacing.md,
  },
  eventCard: {
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  eventHeaderText: {
    flex: 1,
  },
  vipBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    marginBottom: Spacing.sm,
    opacity: 0.8,
  },
  detailsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  outfitSuggestion: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
    minHeight: 36,
  },
  savedText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  viewButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  sourcesCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
  topPickCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  topPickHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topPickBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  topPickIndicator: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  matchScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
});
