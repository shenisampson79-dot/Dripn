import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp, FadeInDown } from 'react-native-reanimated';
import { KeyboardStickyView, KeyboardProvider } from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import {
  supportService,
  SupportMessage,
  QUICK_TROUBLESHOOTING,
  TICKET_CATEGORIES,
  TicketCategory,
} from '@/services/SupportService';
import { PersonalStylist } from '@/services/PersonalStylistService';

const INPUT_CONTAINER_HEIGHT = 80;

export default function SupportScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { paddingTop, paddingBottom } = useScreenInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [stylist, setStylist] = useState<PersonalStylist | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);
  const [ticketDescription, setTicketDescription] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      await supportService.initialize(user?.gender);
      setStylist(supportService.getStylist());
      const history = supportService.getChatHistory();
      if (history.length === 0) {
        const welcome = supportService.getWelcomeMessage();
        setMessages([welcome]);
      } else {
        setMessages(history);
      }
      setIsInitialized(true);
    };
    initialize();
  }, [user?.gender]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    setShowQuickActions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: SupportMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    scrollToEnd();

    setIsLoading(true);
    try {
      const response = await supportService.sendMessage(userMessage);
      setMessages(prev => [...prev, response]);
      scrollToEnd();
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (actionId: string) => {
    const action = QUICK_TROUBLESHOOTING.find(a => a.id === actionId);
    if (!action) return;

    setShowQuickActions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: SupportMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: action.label,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    scrollToEnd();

    setIsLoading(true);
    try {
      const response = await supportService.sendMessage(action.label);
      setMessages(prev => [...prev, response]);
      scrollToEnd();
    } catch (error) {
      Alert.alert('Error', 'Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = () => {
    setShowTicketModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const submitTicket = async () => {
    if (!selectedCategory || !ticketDescription.trim()) {
      Alert.alert('Missing Information', 'Please select a category and describe your issue.');
      return;
    }

    setIsLoading(true);
    try {
      await supportService.createSupportTicket(
        selectedCategory,
        ticketDescription.trim(),
        { id: user?.id, email: user?.email, name: user?.name }
      );
      const updatedHistory = supportService.getChatHistory();
      setMessages(updatedHistory);
      setShowTicketModal(false);
      setSelectedCategory(null);
      setTicketDescription('');
      scrollToEnd();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to create ticket. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear your support chat history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await supportService.clearChatHistory();
            const welcome = supportService.getWelcomeMessage();
            setMessages([welcome]);
            setShowQuickActions(true);
          },
        },
      ]
    );
  };

  const renderMessage = ({ item, index }: { item: SupportMessage; index: number }) => {
    const isUser = item.role === 'user';
    const isFirst = index === 0;

    return (
      <Animated.View
        entering={isFirst ? undefined : FadeInUp.duration(300).springify()}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        {!isUser && stylist ? (
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: stylist.color + '20' },
            ]}
          >
            <Feather
              name={stylist.icon}
              size={16}
              color={stylist.color}
            />
          </View>
        ) : null}
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: theme.link }]
              : [styles.assistantBubble, { backgroundColor: theme.backgroundSecondary }],
          ]}
        >
          <ThemedText
            type="body"
            style={[
              styles.messageText,
              isUser && { color: '#FFFFFF' },
            ]}
          >
            {item.content}
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderQuickActions = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.quickActionsContainer}>
      <ThemedText type="small" style={styles.quickActionsTitle}>
        Common Issues
      </ThemedText>
      <View style={styles.quickActionsGrid}>
        {QUICK_TROUBLESHOOTING.slice(0, 4).map((action) => (
          <Pressable
            key={action.id}
            onPress={() => handleQuickAction(action.id)}
            style={({ pressed }) => [
              styles.quickActionButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText type="small" style={styles.quickActionText}>
              {action.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={handleCreateTicket}
        style={({ pressed }) => [
          styles.createTicketButton,
          { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="file-plus" size={18} color="#FFFFFF" />
        <ThemedText type="body" style={styles.createTicketText}>
          Create Support Ticket
        </ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderTicketModal = () => (
    <Modal
      visible={showTicketModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowTicketModal(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Create Support Ticket</ThemedText>
            <Pressable
              onPress={() => setShowTicketModal(false)}
              hitSlop={12}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <ThemedText type="body" style={styles.modalLabel}>
              Select Category
            </ThemedText>
            <View style={styles.categoriesGrid}>
              {TICKET_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={({ pressed }) => [
                    styles.categoryButton,
                    {
                      backgroundColor:
                        selectedCategory === cat.id
                          ? theme.link + '20'
                          : theme.backgroundSecondary,
                      borderColor:
                        selectedCategory === cat.id ? theme.link : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={cat.icon as any}
                    size={20}
                    color={selectedCategory === cat.id ? theme.link : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={[
                      styles.categoryLabel,
                      selectedCategory === cat.id && { color: theme.link },
                    ]}
                  >
                    {cat.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="body" style={styles.modalLabel}>
              Describe Your Issue
            </ThemedText>
            <TextInput
              style={[
                styles.ticketInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.tabIconDefault,
                },
              ]}
              placeholder="Tell us what's happening..."
              placeholderTextColor={theme.tabIconDefault}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={() => setShowTicketModal(false)}
              style={({ pressed }) => [
                styles.modalButton,
                styles.cancelButton,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText type="body">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={submitTicket}
              disabled={isLoading || !selectedCategory || !ticketDescription.trim()}
              style={({ pressed }) => [
                styles.modalButton,
                styles.submitButton,
                {
                  backgroundColor: theme.link,
                  opacity:
                    pressed || isLoading || !selectedCategory || !ticketDescription.trim()
                      ? 0.6
                      : 1,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText type="body" style={{ color: '#FFFFFF' }}>
                  Submit Ticket
                </ThemedText>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  if (!isInitialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.link} />
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault, paddingTop }]}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            {stylist ? (
              <View
                style={[
                  styles.headerAvatar,
                  { backgroundColor: stylist.color + '20' },
                ]}
              >
                <Feather name={stylist.icon} size={20} color={stylist.color} />
              </View>
            ) : null}
            <View>
              <ThemedText type="h3">{stylist?.name || 'Support'}</ThemedText>
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                Dripn Support Assistant
              </ThemedText>
            </View>
          </View>
          <Pressable onPress={handleClearChat} hitSlop={12}>
            <Feather name="trash-2" size={20} color={theme.tabIconDefault} />
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messagesList,
            { paddingBottom: INPUT_CONTAINER_HEIGHT + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={
            <>
              {isLoading ? (
                <View style={styles.typingIndicator}>
                  <ActivityIndicator size="small" color={theme.link} />
                  <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
                    {stylist?.name || 'Support'} is typing...
                  </ThemedText>
                </View>
              ) : null}
              {showQuickActions && messages.length <= 1 ? renderQuickActions() : null}
            </>
          }
        />

        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: theme.backgroundDefault,
                borderTopColor: theme.tabIconDefault + '30',
                paddingBottom: Math.max(paddingBottom, Spacing.md),
              },
            ]}
          >
            <Pressable
              onPress={handleCreateTicket}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="file-plus" size={20} color={theme.link} />
            </Pressable>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder="Type your message..."
              placeholderTextColor={theme.tabIconDefault}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline={false}
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: inputText.trim() ? theme.link : theme.backgroundSecondary,
                  opacity: pressed || !inputText.trim() ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="send"
                size={20}
                color={inputText.trim() ? '#FFFFFF' : theme.tabIconDefault}
              />
            </Pressable>
          </View>
        </KeyboardStickyView>

        {renderTicketModal()}
      </View>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: Spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginTop: 4,
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    maxWidth: '100%',
  },
  userBubble: {
    borderBottomRightRadius: BorderRadius.sm,
  },
  assistantBubble: {
    borderBottomLeftRadius: BorderRadius.sm,
  },
  messageText: {
    lineHeight: 22,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  quickActionsContainer: {
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  quickActionsTitle: {
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickActionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  quickActionText: {
    fontWeight: '500',
  },
  createTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  createTicketText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalLabel: {
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  categoryLabel: {
    fontWeight: '500',
  },
  ticketInput: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: Typography.body.fontSize,
    minHeight: 100,
    borderWidth: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {},
  submitButton: {},
});
