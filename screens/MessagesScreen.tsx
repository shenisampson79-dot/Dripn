import React, { useState, useCallback } from "react";
import { StyleSheet, View, Pressable, RefreshControl, Image, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useMessaging, Conversation } from "@/contexts/MessagingContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type MessagesScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "Messages">;
};

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function MessagesScreen({ navigation }: MessagesScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { 
    conversations, 
    isLoading, 
    unreadCount,
    refreshConversations, 
    deleteConversation,
    muteConversation,
    unmuteConversation,
    blockUser,
    unblockUser,
    isUserBlocked,
  } = useMessaging();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshConversations();
    }, [refreshConversations])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate("Conversation", { 
      conversationId: conversation.id,
      participantName: conversation.participantName,
    });
  };

  const handleConversationLongPress = (conversation: Conversation) => {
    const isBlocked = isUserBlocked(conversation.participantId);
    
    Alert.alert(
      conversation.participantName,
      t('messages.chooseAction'),
      [
        {
          text: conversation.isMuted ? t('common.unmute') : t('common.mute'),
          onPress: () => {
            if (conversation.isMuted) {
              unmuteConversation(conversation.id);
            } else {
              muteConversation(conversation.id);
            }
          },
        },
        {
          text: isBlocked ? t('community.unblockUser') : t('community.blockUser'),
          style: isBlocked ? "default" : "destructive",
          onPress: () => {
            if (isBlocked) {
              Alert.alert(
                t('community.unblockUser'),
                t('community.unblockUserConfirm').replace('{name}', conversation.participantName),
                [
                  { text: t('common.cancel'), style: "cancel" },
                  { 
                    text: t('common.unblock'), 
                    onPress: () => unblockUser(conversation.participantId)
                  },
                ]
              );
            } else {
              Alert.alert(
                t('community.blockUser'),
                t('community.blockUserConfirm').replace('{name}', conversation.participantName),
                [
                  { text: t('common.cancel'), style: "cancel" },
                  { 
                    text: t('common.block'), 
                    style: "destructive",
                    onPress: () => blockUser(conversation.participantId, conversation.participantName)
                  },
                ]
              );
            }
          },
        },
        {
          text: t('common.deleteConversation'),
          style: "destructive",
          onPress: () => {
            Alert.alert(t('common.deleteConversation'), t('common.areYouSureYouWantToDeleteThisConversatio'),
              [
                { text: t('common.cancel'), style: "cancel" },
                { 
                  text: t('common.delete'), 
                  style: "destructive",
                  onPress: () => deleteConversation(conversation.id)
                },
              ]
            );
          },
        },
        { text: t('common.cancel'), style: "cancel" },
      ]
    );
  };

  const sortedConversations = [...conversations].sort((a, b) => 
    new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime()
  );

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.link} />
      }
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Feather name="message-circle" size={24} color={theme.link} />
            <ThemedText type="h1" style={styles.title}>Messages</ThemedText>
            {unreadCount > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: theme.link }]}>
                <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="body" style={styles.subtitle}>
            Connect with fellow fashion enthusiasts
          </ThemedText>
        </View>

        {sortedConversations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="inbox" size={48} color={theme.tabIconDefault} />
            <ThemedText type="h3" style={styles.emptyTitle}>No messages yet</ThemedText>
            <ThemedText type="body" style={styles.emptyText}>
              When you connect with real members, conversations will show up here. No demo chats.
            </ThemedText>
          </Card>
        ) : (
          <View style={styles.conversationsList}>
            {sortedConversations.map((conversation) => (
              <Pressable
                key={conversation.id}
                onPress={() => handleConversationPress(conversation)}
                onLongPress={() => handleConversationLongPress(conversation)}
                style={({ pressed }) => [
                  styles.conversationItem,
                  { 
                    backgroundColor: pressed ? theme.backgroundSecondary : theme.backgroundDefault,
                    opacity: conversation.isBlocked ? 0.5 : 1,
                  },
                ]}
              >
                <View style={styles.avatarContainer}>
                  {conversation.participantAvatar ? (
                    <Image 
                      source={{ uri: conversation.participantAvatar }} 
                      style={styles.avatar} 
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.link }]}>
                      <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                        {getInitials(conversation.participantName)}
                      </ThemedText>
                    </View>
                  )}
                  {conversation.unreadCount > 0 ? (
                    <View style={[styles.onlineDot, { backgroundColor: theme.link }]} />
                  ) : null}
                </View>

                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <ThemedText 
                      type="body" 
                      style={[
                        styles.participantName,
                        conversation.unreadCount > 0 && { fontWeight: '700' }
                      ]}
                      numberOfLines={1}
                    >
                      {conversation.participantName}
                    </ThemedText>
                    <View style={styles.headerRight}>
                      {conversation.isMuted ? (
                        <Feather name="bell-off" size={14} color={theme.tabIconDefault} style={{ marginRight: 4 }} />
                      ) : null}
                      <ThemedText type="small" style={{ opacity: 0.6 }}>
                        {formatMessageTime(conversation.lastMessageTimestamp)}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.messagePreview}>
                    <ThemedText 
                      type="small" 
                      style={[
                        styles.lastMessage,
                        conversation.unreadCount > 0 && { fontWeight: '600', opacity: 0.9 }
                      ]}
                      numberOfLines={2}
                    >
                      {conversation.isBlocked ? 'User blocked' : conversation.lastMessage}
                    </ThemedText>
                    {conversation.unreadCount > 0 ? (
                      <View style={[styles.unreadCountBadge, { backgroundColor: theme.link }]}>
                        <ThemedText type="small" style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                          {conversation.unreadCount}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>

                <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
              </Pressable>
            ))}
          </View>
        )}

        <Card style={styles.tipCard}>
          <Feather name="info" size={18} color={theme.link} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, flex: 1, opacity: 0.7 }}>
            Long press on a conversation to mute, block, or delete it. Share deals with friends directly from the Bargains tab.
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    marginLeft: Spacing.xs,
    flex: 1,
  },
  subtitle: {
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  conversationsList: {
    gap: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    opacity: 0.7,
  },
  unreadCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
    paddingHorizontal: 6,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: Spacing.md,
  },
  emptyText: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    opacity: 0.7,
  },
  tipCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
