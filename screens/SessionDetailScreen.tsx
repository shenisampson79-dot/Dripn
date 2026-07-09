import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useStylistAuth, VIPSession } from "@/contexts/StylistAuthContext";
import { useTranslations } from "@/contexts/TranslationContext";

type SessionDetailScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ SessionDetail: { sessionId: string } }, 'SessionDetail'>;
  onExit: () => void;
};

export default function SessionDetailScreen({ navigation, route, onExit }: SessionDetailScreenProps) {
  const { sessionId } = route.params;
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { getSession, completeSession, updateSessionNotes } = useStylistAuth();

  const [session, setSession] = useState<VIPSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data);
      if (data?.sessionNotes) {
        setNotes(data.sessionNotes);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      Alert.alert('Error', 'Failed to load session details');
    } finally {
      setIsLoading(false);
    }
  }, [getSession, sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSaveNotes = async () => {
    if (!notes.trim()) return;

    setIsSaving(true);
    try {
      await updateSessionNotes(sessionId, notes);
      Alert.alert('Success', 'Notes saved successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteSession = async () => {
    Alert.alert(t('common.completeSession') || "Complete Session", t('common.areYouSureYouWantToMarkThisSessionAsComp') || "Are you sure you want to mark this session as completed?",
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setIsCompleting(true);
            try {
              await completeSession(sessionId, notes);
              Alert.alert('Success', 'Session marked as completed');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to complete session');
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
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

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Session Details</ThemedText>
          <Pressable
            onPress={onExit}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="x" size={20} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
        </View>
      </ThemedView>
    );
  }

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Session Details</ThemedText>
          <Pressable
            onPress={onExit}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="x" size={20} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={theme.tabIconDefault} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>
            Session not found
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Session Details</ThemedText>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <Card style={styles.clientCard}>
          <View style={styles.clientHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.link + '20' }]}>
              <ThemedText type="h2" style={{ color: theme.link }}>
                {session.vipUser.displayName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.clientInfo}>
              <ThemedText type="h3">{session.vipUser.displayName}</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                {session.vipUser.email}
              </ThemedText>
              <View style={[styles.vipBadge, { backgroundColor: '#F59E0B20' }]}>
                <Feather name="award" size={12} color="#F59E0B" />
                <ThemedText type="small" style={{ color: '#F59E0B', marginLeft: 4 }}>
                  VIP Member
                </ThemedText>
              </View>
            </View>
          </View>
        </Card>

        <Card style={styles.detailsCard}>
          <View style={styles.statusRow}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>Status</ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status) + '20' }]}>
              <ThemedText type="body" style={{ color: getStatusColor(session.status), fontWeight: '600' }}>
                {getStatusLabel(session.status)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="calendar" size={20} color={theme.link} />
            </View>
            <View>
              <ThemedText type="small" style={{ opacity: 0.7 }}>Date</ThemedText>
              <ThemedText type="body">{formatDate(session.scheduledAt)}</ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="clock" size={20} color={theme.link} />
            </View>
            <View>
              <ThemedText type="small" style={{ opacity: 0.7 }}>Time</ThemedText>
              <ThemedText type="body">{formatTime(session.scheduledAt)}</ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="watch" size={20} color={theme.link} />
            </View>
            <View>
              <ThemedText type="small" style={{ opacity: 0.7 }}>Duration</ThemedText>
              <ThemedText type="body">{session.durationMinutes} minutes</ThemedText>
            </View>
          </View>
        </Card>

        {session.notes ? (
          <Card style={styles.notesCard}>
            <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
              Client Notes
            </ThemedText>
            <ThemedText type="body" style={{ opacity: 0.8 }}>
              {session.notes}
            </ThemedText>
          </Card>
        ) : null}

        <Card style={styles.sessionNotesCard}>
          <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
            Session Notes
          </ThemedText>
          <ThemedText type="small" style={{ opacity: 0.7, marginBottom: Spacing.md }}>
            Add notes about the session, recommendations given, or follow-up items.
          </ThemedText>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('common.enterYourSessionNotesHere') || "Enter your session notes here..."}
            placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Button
            onPress={handleSaveNotes}
            disabled={isSaving || !notes.trim()}
            style={[styles.saveButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <ThemedText style={{ color: theme.text }}>{isSaving ? "Saving..." : "Save Notes"}</ThemedText>
          </Button>
        </Card>

        {session.status === 'scheduled' || session.status === 'in_progress' ? (
          <Button
            onPress={handleCompleteSession}
            disabled={isCompleting}
            style={[styles.completeButton, { backgroundColor: '#10B981' }]}
          >
            <ThemedText style={{ color: '#FFFFFF' }}>{isCompleting ? "Completing..." : "Mark as Completed"}</ThemedText>
          </Button>
        ) : null}

        {session.completedAt ? (
          <View style={[styles.completedInfo, { backgroundColor: '#10B98120' }]}>
            <Feather name="check-circle" size={20} color="#10B981" />
            <ThemedText type="small" style={{ color: '#10B981', marginLeft: Spacing.sm }}>
              Completed on {formatDate(session.completedAt)} at {formatTime(session.completedAt)}
            </ThemedText>
          </View>
        ) : null}
      </ScreenKeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientCard: {
    padding: Spacing.md,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  detailsCard: {
    padding: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(100, 100, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesCard: {
    padding: Spacing.md,
  },
  sessionNotesCard: {
    padding: Spacing.md,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.body.fontSize,
    minHeight: 120,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
  completeButton: {
    marginTop: Spacing.md,
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});
