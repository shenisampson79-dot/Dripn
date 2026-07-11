import React, {useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { 
  StyleSheet, 
  View, 
  Pressable, 
  TextInput, 
  FlatList, 
  Image, 
  Alert,
  Modal,
} from "react-native";
import { KeyboardStickyView, KeyboardProvider } from 'react-native-keyboard-controller';
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import { useMessaging, Message, Report } from "@/contexts/MessagingContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type ConversationScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "Conversation">;
  route: RouteProp<CommunityStackParamList, "Conversation">;
};

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDate(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const REPORT_REASONS: { key: Report['reason']; label: string }[] = [
  { key: 'spam', label: 'Spam or advertising' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'scam', label: 'Scam or fraud' },
  { key: 'other', label: 'Other' },
];

export default function ConversationScreen({ navigation, route }: ConversationScreenProps) {
  const { conversationId, participantName } = route.params;
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  
  const { 
    getConversation, 
    getMessages, 
    sendMessage, 
    markAsRead,
    blockUser,
    unblockUser,
    isUserBlocked,
    muteConversation,
    unmuteConversation,
    reportUser,
    deleteConversation,
  } = useMessaging();

  const [messageText, setMessageText] = useState('');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<Report['reason'] | null>(null);
  const [reportDescription, setReportDescription] = useState('');

  const conversation = getConversation(conversationId);
  const messages = getMessages(conversationId);
  const isBlocked = conversation ? isUserBlocked(conversation.participantId) : false;

  useLayoutEffect(() => {
    markAsRead(conversationId);
  }, [conversationId, markAsRead]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: participantName,
      headerRight: () => (
        <Pressable 
          onPress={() => setShowOptionsModal(true)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}
        >
          <Feather name="more-vertical" size={22} color={theme.text} />
        </Pressable>
      ),
    });
  }, [navigation, participantName, theme.text]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || isBlocked) return;
    
    await sendMessage(conversationId, messageText.trim());
    setMessageText('');
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messageText, conversationId, sendMessage, isBlocked]);

  const handleBlock = () => {
    if (!conversation) return;
    
    setShowOptionsModal(false);
    
    if (isBlocked) {
      Alert.alert(
        t('community.unblockUser'),
        t('community.unblockUserConfirm').replace('{name}', participantName),
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
        t('community.blockUserConfirm').replace('{name}', participantName),
        [
          { text: t('common.cancel'), style: "cancel" },
          { 
            text: t('common.block'), 
            style: "destructive",
            onPress: () => blockUser(conversation.participantId, participantName)
          },
        ]
      );
    }
  };

  const handleMute = () => {
    if (!conversation) return;
    
    setShowOptionsModal(false);
    
    if (conversation.isMuted) {
      unmuteConversation(conversationId);
    } else {
      muteConversation(conversationId);
    }
  };

  const handleDelete = () => {
    setShowOptionsModal(false);
    
    Alert.alert(t('common.deleteConversation'), t('common.areYouSureYouWantToDeleteThisConversatio'),
      [
        { text: t('common.cancel'), style: "cancel" },
        { 
          text: t('common.delete'), 
          style: "destructive",
          onPress: async () => {
            await deleteConversation(conversationId);
            navigation.goBack();
          }
        },
      ]
    );
  };

  const handleReport = () => {
    setShowOptionsModal(false);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!selectedReportReason || !conversation) return;
    
    await reportUser(
      conversation.participantId,
      participantName,
      selectedReportReason,
      reportDescription || undefined
    );
    
    setShowReportModal(false);
    setSelectedReportReason(null);
    setReportDescription('');
    
    Alert.alert(t('common.reportSubmitted'), t('common.thankYouForYourReportOurTeamWillReviewIt'),
      [{ text: t('common.ok') }]
    );
  };

  const groupMessagesByDate = (msgs: Message[]): { date: string; messages: Message[] }[] => {
    const groups: Record<string, Message[]> = {};
    
    msgs.forEach(msg => {
      const dateKey = new Date(msg.timestamp).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    
    return Object.entries(groups).map(([date, messages]) => ({
      date: formatMessageDate(messages[0].timestamp),
      messages,
    }));
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === 'me' || item.senderId === 'current_user';
    
    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessageContainer : styles.theirMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble,
          isMe 
            ? [styles.myMessageBubble, { backgroundColor: theme.link }]
            : [styles.theirMessageBubble, { backgroundColor: theme.backgroundSecondary }],
        ]}>
          {item.type === 'deal' && item.metadata ? (
            <View style={styles.dealMessage}>
              <View style={styles.dealHeader}>
                <Feather name="tag" size={14} color={isMe ? '#FFFFFF' : theme.link} />
                <ThemedText 
                  type="small" 
                  style={{ 
                    marginLeft: 4, 
                    color: isMe ? '#FFFFFF' : theme.link,
                    fontWeight: '600',
                  }}
                >
                  Shared Deal
                </ThemedText>
              </View>
              <ThemedText 
                type="body" 
                style={{ 
                  color: isMe ? '#FFFFFF' : theme.text,
                  fontWeight: '600',
                  marginTop: 4,
                }}
              >
                {item.metadata.dealBrand}
              </ThemedText>
              <ThemedText 
                type="small" 
                style={{ 
                  color: isMe ? 'rgba(255,255,255,0.9)' : theme.text,
                  opacity: isMe ? 1 : 0.8,
                }}
              >
                {item.metadata.dealTitle} - {item.metadata.dealDiscount}
              </ThemedText>
            </View>
          ) : (
            <ThemedText 
              type="body" 
              style={{ color: isMe ? '#FFFFFF' : theme.text }}
            >
              {item.content}
            </ThemedText>
          )}
          <ThemedText 
            type="small" 
            style={[
              styles.messageTime,
              { color: isMe ? 'rgba(255,255,255,0.7)' : theme.tabIconDefault }
            ]}
          >
            {formatMessageTime(item.timestamp)}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderDateHeader = (date: string) => (
    <View style={styles.dateHeader}>
      <View style={[styles.dateLine, { backgroundColor: theme.tabIconDefault }]} />
      <ThemedText type="small" style={styles.dateText}>{date}</ThemedText>
      <View style={[styles.dateLine, { backgroundColor: theme.tabIconDefault }]} />
    </View>
  );

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <KeyboardProvider>
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <View>
              {renderDateHeader(item.date)}
              {item.messages.map((msg: Message) => (
                <View key={msg.id}>{renderMessage({ item: msg })}</View>
              ))}
            </View>
          )}
          contentContainerStyle={[
            styles.messagesList,
            { paddingBottom: insets.bottom + 80 },
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={48} color={theme.tabIconDefault} />
              <ThemedText type="body" style={styles.emptyText}>
                No messages yet. Start the conversation!
              </ThemedText>
            </View>
          }
        />

        <KeyboardStickyView offset={{ closed: insets.bottom }}>
          {isBlocked ? (
            <View style={[styles.blockedBanner, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="slash" size={18} color={theme.tabIconDefault} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, opacity: 0.7 }}>
                You have blocked this user
              </ThemedText>
            </View>
          ) : (
            <View style={[
              styles.inputContainer, 
              { 
                backgroundColor: theme.backgroundDefault,
                paddingBottom: Spacing.sm,
                borderTopColor: theme.backgroundSecondary,
              }
            ]}>
              <TextInput
                style={[
                  styles.textInput,
                  { 
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  }
                ]}
                placeholder={t('common.typeAMessage') || "Type a message..."}
                placeholderTextColor={theme.tabIconDefault}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={1000}
              />
              <Pressable
                onPress={handleSendMessage}
                disabled={!messageText.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  { 
                    backgroundColor: messageText.trim() ? theme.link : theme.backgroundSecondary,
                    opacity: pressed ? 0.8 : 1,
                  }
                ]}
              >
                <Feather 
                  name="send" 
                  size={20} 
                  color={messageText.trim() ? '#FFFFFF' : theme.tabIconDefault} 
                />
              </Pressable>
            </View>
          )}
        </KeyboardStickyView>

      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowOptionsModal(false)}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
          <Pressable 
            style={[styles.optionsModal, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.optionsHeader}>
              <ThemedText type="h3">{participantName}</ThemedText>
              <Pressable onPress={() => setShowOptionsModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <Pressable
              onPress={handleMute}
              style={({ pressed }) => [
                styles.optionItem,
                { backgroundColor: pressed ? theme.backgroundSecondary : 'transparent' }
              ]}
            >
              <Feather 
                name={conversation?.isMuted ? "bell" : "bell-off"} 
                size={20} 
                color={theme.text} 
              />
              <ThemedText type="body" style={styles.optionText}>
                {conversation?.isMuted ? "Unmute notifications" : "Mute notifications"}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleBlock}
              style={({ pressed }) => [
                styles.optionItem,
                { backgroundColor: pressed ? theme.backgroundSecondary : 'transparent' }
              ]}
            >
              <Feather 
                name={isBlocked ? "user-check" : "user-x"} 
                size={20} 
                color={isBlocked ? theme.link : theme.text} 
              />
              <ThemedText type="body" style={styles.optionText}>
                {isBlocked ? "Unblock user" : "Block user"}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleReport}
              style={({ pressed }) => [
                styles.optionItem,
                { backgroundColor: pressed ? theme.backgroundSecondary : 'transparent' }
              ]}
            >
              <Feather name="flag" size={20} color={theme.text} />
              <ThemedText type="body" style={styles.optionText}>
                Report user
              </ThemedText>
            </Pressable>

            <View style={[styles.optionDivider, { backgroundColor: theme.backgroundSecondary }]} />

            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.optionItem,
                { backgroundColor: pressed ? theme.backgroundSecondary : 'transparent' }
              ]}
            >
              <Feather name="trash-2" size={20} color="#FF3B30" />
              <ThemedText type="body" style={[styles.optionText, { color: '#FF3B30' }]}>
                Delete conversation
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowReportModal(false)}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
          <Pressable 
            style={[styles.reportModal, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.optionsHeader}>
              <ThemedText type="h2">Report User</ThemedText>
              <Pressable onPress={() => setShowReportModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText type="body" style={styles.reportSubtitle}>
              Why are you reporting {participantName}?
            </ThemedText>

            <View style={styles.reportReasons}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.key}
                  onPress={() => setSelectedReportReason(reason.key)}
                  style={[
                    styles.reportReasonItem,
                    { 
                      backgroundColor: selectedReportReason === reason.key 
                        ? theme.link 
                        : theme.backgroundSecondary,
                      borderColor: selectedReportReason === reason.key 
                        ? theme.link 
                        : theme.backgroundSecondary,
                    }
                  ]}
                >
                  <ThemedText 
                    type="body" 
                    style={{ 
                      color: selectedReportReason === reason.key ? '#FFFFFF' : theme.text 
                    }}
                  >
                    {reason.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[
                styles.reportDescription,
                { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.backgroundSecondary,
                }
              ]}
              placeholder={t('common.additionalDetailsOptional') || "Additional details (optional)"}
              placeholderTextColor={theme.tabIconDefault}
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            <View style={styles.reportActions}>
              <Pressable
                onPress={() => setShowReportModal(false)}
                style={[styles.reportButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={submitReport}
                disabled={!selectedReportReason}
                style={[
                  styles.reportButton, 
                  { 
                    backgroundColor: selectedReportReason ? theme.link : theme.backgroundSecondary,
                    opacity: selectedReportReason ? 1 : 0.5,
                  }
                ]}
              >
                <ThemedText type="body" style={{ color: selectedReportReason ? '#FFFFFF' : theme.text }}>
                  Submit Report
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    padding: Spacing.md,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
    opacity: 0.2,
  },
  dateText: {
    marginHorizontal: Spacing.md,
    opacity: 0.5,
  },
  messageContainer: {
    marginVertical: 2,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  myMessageBubble: {
    borderRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.xs,
  },
  theirMessageBubble: {
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.xs,
  },
  dealMessage: {
    minWidth: 200,
  },
  dealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing["2xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    opacity: 0.6,
    textAlign: 'center',
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  optionsModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  optionText: {
    marginLeft: Spacing.md,
  },
  optionDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  reportModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing["2xl"],
    maxHeight: '80%',
  },
  reportSubtitle: {
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  reportReasons: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  reportReasonItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reportDescription: {
    minHeight: 80,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  reportActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  reportButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
});
