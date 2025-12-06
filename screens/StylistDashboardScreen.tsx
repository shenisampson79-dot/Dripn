import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useStylistAuth, VIPSession } from "@/contexts/StylistAuthContext";

type StylistDashboardScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  onExit?: () => void;
  onLogout?: () => void;
};

export default function StylistDashboardScreen({ navigation, onExit, onLogout }: StylistDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { stylist, getSessions } = useStylistAuth();

  const [sessions, setSessions] = useState<VIPSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'completed'>('upcoming');

  const loadSessions = useCallback(async () => {
    try {
      const data = await getSessions(filter === 'upcoming');
      let filteredSessions = data;
      
      if (filter === 'completed') {
        filteredSessions = data.filter(s => s.status === 'completed');
      } else if (filter === 'upcoming') {
        filteredSessions = data.filter(s => s.status === 'scheduled' || s.status === 'in_progress');
      }
      
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [getSessions, filter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSessions();
  }, [loadSessions]);

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: onLogout,
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return theme.link;
      case 'in_progress': return '#F59E0B';
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return theme.tabIconDefault;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Upcoming';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const renderSessionCard = (session: VIPSession) => (
    <Pressable
      key={session.id}
      onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.clientInfo}>
            <View style={[styles.avatar, { backgroundColor: theme.link + '20' }]}>
              <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
                {session.vipUser.displayName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View>
              <ThemedText type="body" style={styles.clientName}>
                {session.vipUser.displayName}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6 }}>
                VIP Member
              </ThemedText>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status) + '20' }]}>
            <ThemedText type="small" style={{ color: getStatusColor(session.status), fontWeight: '600' }}>
              {getStatusLabel(session.status)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={16} color={theme.tabIconDefault} />
            <ThemedText type="body">{formatDate(session.scheduledAt)}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={16} color={theme.tabIconDefault} />
            <ThemedText type="body">{formatTime(session.scheduledAt)}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather name="watch" size={16} color={theme.tabIconDefault} />
            <ThemedText type="body">{session.durationMinutes} minutes</ThemedText>
          </View>
        </View>

        {session.notes ? (
          <View style={[styles.notesPreview, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="small" numberOfLines={2} style={{ opacity: 0.8 }}>
              {session.notes}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <ThemedText type="small" style={{ color: theme.link }}>
            Tap to view details
          </ThemedText>
          <Feather name="chevron-right" size={16} color={theme.link} />
        </View>
      </Card>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={onExit}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>
            <View>
              <ThemedText type="h2">Welcome back</ThemedText>
              <ThemedText type="body" style={{ opacity: 0.7 }}>
                {stylist?.displayName || 'Stylist'}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="log-out" size={20} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {(['upcoming', 'all', 'completed'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterButton,
                {
                  backgroundColor: filter === f ? theme.link : theme.backgroundSecondary,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: filter === f ? '#FFFFFF' : theme.text,
                  fontWeight: filter === f ? '600' : '400',
                }}
              >
                {f === 'upcoming' ? 'Upcoming' : f === 'all' ? 'All' : 'Completed'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <ScreenScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.link} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
              Loading sessions...
            </ThemedText>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="calendar" size={48} color={theme.tabIconDefault} />
            </View>
            <ThemedText type="h3" style={styles.emptyTitle}>
              No Sessions Found
            </ThemedText>
            <ThemedText type="body" style={styles.emptyText}>
              {filter === 'upcoming'
                ? "You don't have any upcoming sessions scheduled."
                : filter === 'completed'
                ? "You haven't completed any sessions yet."
                : "No sessions found."}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.sessionsList}>
            {sessions.map(renderSessionCard)}
          </View>
        )}

        <View style={styles.statsSection}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Quick Stats
          </ThemedText>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Feather name="users" size={24} color={theme.link} />
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                {sessions.filter(s => s.status === 'scheduled').length}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Upcoming
              </ThemedText>
            </Card>
            <Card style={styles.statCard}>
              <Feather name="check-circle" size={24} color="#10B981" />
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                {sessions.filter(s => s.status === 'completed').length}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Completed
              </ThemedText>
            </Card>
          </View>
        </View>
      </ScreenScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  loadingContainer: {
    paddingVertical: Spacing["2xl"] * 2,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing["2xl"] * 2,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: Spacing.xl,
  },
  sessionsList: {
    gap: Spacing.md,
  },
  sessionCard: {
    padding: Spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  sessionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notesPreview: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statsSection: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
});
