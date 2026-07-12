import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp, FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from '@/contexts/TranslationContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 56;

import {
  supportService,
  SupportMessage,
  QUICK_TROUBLESHOOTING,
  TICKET_CATEGORIES,
  TicketCategory,
} from '@/services/SupportService';
import { PersonalStylist } from '@/services/PersonalStylistService';
import { currencyService } from '@/services/CurrencyService';

const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 120;

export default function SupportScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslations();
  const { paddingTop, paddingBottom } = useScreenInsets();
  const safeAreaInsets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const sendingRef = useRef(false);

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [stylist, setStylist] = useState<PersonalStylist | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);
  const [ticketDescription, setTicketDescription] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('support.screenTitle') || t('settings.chatWithJulia') || 'Ask Julia',
    });
  }, [navigation, t]);

  const getQuickActionLabel = (id: string) =>
    t(`support.quickAction.${id}`) ||
    QUICK_TROUBLESHOOTING.find((a) => a.id === id)?.label ||
    id;
  const getTicketCategoryLabel = (id: TicketCategory) =>
    t(`support.ticketCategory.${id}`) ||
    TICKET_CATEGORIES.find((c) => c.id === id)?.label ||
    id;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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
      await currencyService.initialize();
      setCurrencySymbol(currencyService.getCurrencySymbol());
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
    if (!inputText.trim() || isLoading || sendingRef.current) return;

    const userMessage = inputText.trim();
    sendingRef.current = true;
    setIsLoading(true);
    setInputText('');
    setShowQuickActions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic bubble — replaced by canonical history after send (prevents duplicates)
    setMessages((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ]);
    scrollToEnd();

    try {
      await supportService.sendMessage(userMessage);
      setMessages(supportService.getChatHistory());
      scrollToEnd();
    } catch (error) {
      setMessages(supportService.getChatHistory());
      Alert.alert(t('common.error'), t('support.sendFailed') || 'Could not send your message. Please try again.');
    } finally {
      sendingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (actionId: string) => {
    const action = QUICK_TROUBLESHOOTING.find(a => a.id === actionId);
    if (!action || isLoading || sendingRef.current) return;

    const label = getQuickActionLabel(actionId);

    sendingRef.current = true;
    setIsLoading(true);
    setShowQuickActions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setMessages((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        role: 'user',
        content: label,
        timestamp: new Date().toISOString(),
      },
    ]);
    scrollToEnd();

    try {
      await supportService.sendMessage(action.label, {
        fromQuickAction: true,
      });
      setMessages(supportService.getChatHistory());
      scrollToEnd();
    } catch (error) {
      setMessages(supportService.getChatHistory());
      Alert.alert(t('common.error'), t('support.responseFailed') || 'Could not get a response. Please try again.');
    } finally {
      sendingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleCreateTicket = () => {
    setShowTicketModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const submitTicket = async () => {
    if (!selectedCategory || !ticketDescription.trim()) {
      Alert.alert(t('support.missingInfoTitle'), t('support.missingInfoMessage'));
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
      Alert.alert(t('common.error'), t('support.ticketFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      t('support.clearChatTitle'),
      t('support.clearChatMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('support.clear'),
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
        {t('support.commonIssues')}
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
              {getQuickActionLabel(action.id)}
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
          {t('support.createTicket')}
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      >
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.modalHeader}>
            <ThemedText type="h3">{t('support.createTicket')}</ThemedText>
            <Pressable
              onPress={() => setShowTicketModal(false)}
              hitSlop={12}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <ThemedText type="body" style={styles.modalLabel}>
              {t('support.selectCategory')}
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
                  {cat.id === 'billing' ? (
                    <ThemedText
                      style={[
                        styles.currencySymbol,
                        { color: selectedCategory === cat.id ? theme.link : theme.text },
                      ]}
                    >
                      {currencySymbol}
                    </ThemedText>
                  ) : (
                    <Feather
                      name={cat.icon as any}
                      size={20}
                      color={selectedCategory === cat.id ? theme.link : theme.text}
                    />
                  )}
                  <ThemedText
                    type="small"
                    style={[
                      styles.categoryLabel,
                      selectedCategory === cat.id && { color: theme.link },
                    ]}
                  >
                    {getTicketCategoryLabel(cat.id)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="body" style={styles.modalLabel}>
              {t('support.describeIssue')}
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
              placeholder={t('support.issuePlaceholder')}
              placeholderTextColor={theme.tabIconDefault}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(safeAreaInsets.bottom, Spacing.lg) }]}>
            <Pressable
              onPress={() => setShowTicketModal(false)}
              style={({ pressed }) => [
                styles.modalButton,
                styles.cancelButton,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText type="body">{t('common.cancel')}</ThemedText>
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
                  {t('support.submitTicket')}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
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
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.backgroundDefault, paddingTop }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
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
            <ThemedText type="h3">{t('support.juliaName') || 'Julia'}</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {t('support.juliaSubtitle') || 'Your support assistant'}
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
          { paddingBottom: Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListFooterComponent={
          <>
            {isLoading ? (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={theme.link} />
                <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
                  {t('support.juliaTyping')}
                </ThemedText>
              </View>
            ) : null}
            {showQuickActions && messages.length <= 1 ? renderQuickActions() : null}
          </>
        }
      />

      <View
        style={[
          styles.inputBarFixed,
          {
            backgroundColor: theme.backgroundDefault,
            borderTopColor: theme.tabIconDefault + '30',
            paddingBottom: isKeyboardVisible ? Spacing.xs : safeAreaInsets.bottom + TAB_BAR_HEIGHT + Spacing.sm,
          },
        ]}
      >
        <View style={styles.inputRow}>
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
            placeholder={t('support.messagePlaceholder') || 'Type your message...'}
            placeholderTextColor={theme.tabIconDefault}
            value={inputText}
            onChangeText={setInputText}
            multiline
            blurOnSubmit={false}
            scrollEnabled
            textAlignVertical="top"
            underlineColorAndroid="transparent"
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
      </View>

      {renderTicketModal()}
    </KeyboardAvoidingView>
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
  inputBarFixed: {
    width: '100%',
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
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
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    borderRadius: 22,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontSize: Typography.body.fontSize,
    lineHeight: 22,
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
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
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
