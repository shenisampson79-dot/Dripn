import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'text' | 'deal' | 'post';
  metadata?: {
    dealId?: string;
    dealTitle?: string;
    dealBrand?: string;
    dealDiscount?: string;
    postId?: string;
    postTitle?: string;
  };
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  isBlocked: boolean;
  isMuted: boolean;
}

export interface BlockedUser {
  userId: string;
  userName: string;
  blockedAt: string;
  reason?: string;
}

export interface Report {
  id: string;
  reportedUserId: string;
  reportedUserName: string;
  reporterUserId: string;
  reason: 'spam' | 'harassment' | 'inappropriate' | 'scam' | 'other';
  description?: string;
  messageId?: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

interface MessagingContextType {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  blockedUsers: BlockedUser[];
  isLoading: boolean;
  unreadCount: number;
  sendMessage: (conversationId: string, content: string, type?: 'text' | 'deal' | 'post', metadata?: Message['metadata']) => Promise<void>;
  startConversation: (userId: string, userName: string, userAvatar?: string, initialMessage?: string) => Promise<string>;
  markAsRead: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  blockUser: (userId: string, userName: string, reason?: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  isUserBlocked: (userId: string) => boolean;
  muteConversation: (conversationId: string) => Promise<void>;
  unmuteConversation: (conversationId: string) => Promise<void>;
  reportUser: (userId: string, userName: string, reason: Report['reason'], description?: string, messageId?: string) => Promise<void>;
  getConversation: (conversationId: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  refreshConversations: () => Promise<void>;
  shareToUser: (userId: string, userName: string, content: string, type: 'deal' | 'post', metadata: Message['metadata']) => Promise<void>;
}

const MessagingContext = createContext<MessagingContextType | null>(null);

const MESSAGING_STORAGE_KEY = '@dripn_messaging';
const BLOCKED_USERS_KEY = '@dripn_blocked_users';
const REPORTS_KEY = '@dripn_reports';

const SAMPLE_USERS: Record<string, { name: string; avatar?: string }> = {
  '1': { name: 'Emma Style' },
  '2': { name: 'Jordan Chic' },
  '3': { name: 'Sam Trendy' },
  '4': { name: 'Alex Fashion' },
  '5': { name: 'Casey Vogue' },
};

function generateSampleConversations(): Conversation[] {
  const now = Date.now();
  return [
    {
      id: 'conv_1',
      participantId: '1',
      participantName: 'Emma Style',
      lastMessage: 'Love that outfit! Where did you get the jacket?',
      lastMessageTimestamp: new Date(now - 30 * 60 * 1000).toISOString(),
      unreadCount: 2,
      isBlocked: false,
      isMuted: false,
    },
    {
      id: 'conv_2',
      participantId: '2',
      participantName: 'Jordan Chic',
      lastMessage: 'Thanks for the style tip!',
      lastMessageTimestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      unreadCount: 0,
      isBlocked: false,
      isMuted: false,
    },
    {
      id: 'conv_3',
      participantId: '3',
      participantName: 'Sam Trendy',
      lastMessage: 'Check out this deal I found!',
      lastMessageTimestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      unreadCount: 1,
      isBlocked: false,
      isMuted: false,
    },
  ];
}

function generateSampleMessages(): Record<string, Message[]> {
  const now = Date.now();
  return {
    'conv_1': [
      {
        id: 'msg_1_1',
        conversationId: 'conv_1',
        senderId: '1',
        senderName: 'Emma Style',
        content: 'Hey! Saw your post, really love your style!',
        timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        isRead: true,
        type: 'text',
      },
      {
        id: 'msg_1_2',
        conversationId: 'conv_1',
        senderId: 'me',
        senderName: 'Me',
        content: 'Thank you so much! I appreciate it',
        timestamp: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
        isRead: true,
        type: 'text',
      },
      {
        id: 'msg_1_3',
        conversationId: 'conv_1',
        senderId: '1',
        senderName: 'Emma Style',
        content: 'Love that outfit! Where did you get the jacket?',
        timestamp: new Date(now - 30 * 60 * 1000).toISOString(),
        isRead: false,
        type: 'text',
      },
    ],
    'conv_2': [
      {
        id: 'msg_2_1',
        conversationId: 'conv_2',
        senderId: 'me',
        senderName: 'Me',
        content: 'Try pairing it with some white sneakers for a casual look',
        timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        isRead: true,
        type: 'text',
      },
      {
        id: 'msg_2_2',
        conversationId: 'conv_2',
        senderId: '2',
        senderName: 'Jordan Chic',
        content: 'Thanks for the style tip!',
        timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        isRead: true,
        type: 'text',
      },
    ],
    'conv_3': [
      {
        id: 'msg_3_1',
        conversationId: 'conv_3',
        senderId: '3',
        senderName: 'Sam Trendy',
        content: 'Check out this deal I found!',
        timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        isRead: false,
        type: 'deal',
        metadata: {
          dealId: 'deal_123',
          dealTitle: 'Winter Coat Sale',
          dealBrand: 'Zara',
          dealDiscount: '50% OFF',
        },
      },
    ],
  };
}

interface MessagingProviderProps {
  children: ReactNode;
}

export function MessagingProvider({ children }: MessagingProviderProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const unreadCount = conversations.reduce((total, conv) => total + conv.unreadCount, 0);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [messagingData, blockedData] = await Promise.all([
        AsyncStorage.getItem(MESSAGING_STORAGE_KEY),
        AsyncStorage.getItem(BLOCKED_USERS_KEY),
      ]);

      if (messagingData) {
        const parsed = JSON.parse(messagingData);
        setConversations(parsed.conversations || []);
        setMessages(parsed.messages || {});
      } else {
        const sampleConvs = generateSampleConversations();
        const sampleMsgs = generateSampleMessages();
        setConversations(sampleConvs);
        setMessages(sampleMsgs);
      }

      if (blockedData) {
        setBlockedUsers(JSON.parse(blockedData));
      }
    } catch (error) {
      console.error('Error loading messaging data:', error);
      const sampleConvs = generateSampleConversations();
      const sampleMsgs = generateSampleMessages();
      setConversations(sampleConvs);
      setMessages(sampleMsgs);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = async (newConversations: Conversation[], newMessages: Record<string, Message[]>) => {
    try {
      await AsyncStorage.setItem(MESSAGING_STORAGE_KEY, JSON.stringify({
        conversations: newConversations,
        messages: newMessages,
      }));
    } catch (error) {
      console.error('Error saving messaging data:', error);
    }
  };

  const saveBlockedUsers = async (users: BlockedUser[]) => {
    try {
      await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.error('Error saving blocked users:', error);
    }
  };

  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    type: 'text' | 'deal' | 'post' = 'text',
    metadata?: Message['metadata']
  ) => {
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId,
      senderId: user?.id || 'me',
      senderName: user?.name || 'Me',
      senderAvatar: user?.avatar || undefined,
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
      type,
      metadata,
    };

    const newMessages = { ...messages };
    if (!newMessages[conversationId]) {
      newMessages[conversationId] = [];
    }
    newMessages[conversationId] = [...newMessages[conversationId], newMessage];

    const newConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          lastMessage: content,
          lastMessageTimestamp: newMessage.timestamp,
        };
      }
      return conv;
    });

    setMessages(newMessages);
    setConversations(newConversations);
    await saveData(newConversations, newMessages);
  }, [messages, conversations, user]);

  const startConversation = useCallback(async (
    userId: string,
    userName: string,
    userAvatar?: string,
    initialMessage?: string
  ): Promise<string> => {
    const existingConv = conversations.find(c => c.participantId === userId);
    if (existingConv) {
      if (initialMessage) {
        await sendMessage(existingConv.id, initialMessage);
      }
      return existingConv.id;
    }

    const newConversation: Conversation = {
      id: `conv_${Date.now()}`,
      participantId: userId,
      participantName: userName,
      participantAvatar: userAvatar,
      lastMessage: initialMessage || '',
      lastMessageTimestamp: new Date().toISOString(),
      unreadCount: 0,
      isBlocked: false,
      isMuted: false,
    };

    const newConversations = [newConversation, ...conversations];
    const newMessages = { ...messages, [newConversation.id]: [] };

    setConversations(newConversations);
    setMessages(newMessages);
    await saveData(newConversations, newMessages);

    if (initialMessage) {
      await sendMessage(newConversation.id, initialMessage);
    }

    return newConversation.id;
  }, [conversations, messages, sendMessage]);

  const markAsRead = useCallback(async (conversationId: string) => {
    const newMessages = { ...messages };
    if (newMessages[conversationId]) {
      newMessages[conversationId] = newMessages[conversationId].map(msg => ({
        ...msg,
        isRead: true,
      }));
    }

    const newConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    });

    setMessages(newMessages);
    setConversations(newConversations);
    await saveData(newConversations, newMessages);
  }, [messages, conversations]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    const newConversations = conversations.filter(c => c.id !== conversationId);
    const newMessages = { ...messages };
    delete newMessages[conversationId];

    setConversations(newConversations);
    setMessages(newMessages);
    await saveData(newConversations, newMessages);
  }, [conversations, messages]);

  const blockUser = useCallback(async (userId: string, userName: string, reason?: string) => {
    const newBlockedUser: BlockedUser = {
      userId,
      userName,
      blockedAt: new Date().toISOString(),
      reason,
    };

    const newBlockedUsers = [...blockedUsers, newBlockedUser];
    setBlockedUsers(newBlockedUsers);
    await saveBlockedUsers(newBlockedUsers);

    const newConversations = conversations.map(conv => {
      if (conv.participantId === userId) {
        return { ...conv, isBlocked: true };
      }
      return conv;
    });
    setConversations(newConversations);
    await saveData(newConversations, messages);
  }, [blockedUsers, conversations, messages]);

  const unblockUser = useCallback(async (userId: string) => {
    const newBlockedUsers = blockedUsers.filter(u => u.userId !== userId);
    setBlockedUsers(newBlockedUsers);
    await saveBlockedUsers(newBlockedUsers);

    const newConversations = conversations.map(conv => {
      if (conv.participantId === userId) {
        return { ...conv, isBlocked: false };
      }
      return conv;
    });
    setConversations(newConversations);
    await saveData(newConversations, messages);
  }, [blockedUsers, conversations, messages]);

  const isUserBlocked = useCallback((userId: string): boolean => {
    return blockedUsers.some(u => u.userId === userId);
  }, [blockedUsers]);

  const muteConversation = useCallback(async (conversationId: string) => {
    const newConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, isMuted: true };
      }
      return conv;
    });
    setConversations(newConversations);
    await saveData(newConversations, messages);
  }, [conversations, messages]);

  const unmuteConversation = useCallback(async (conversationId: string) => {
    const newConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, isMuted: false };
      }
      return conv;
    });
    setConversations(newConversations);
    await saveData(newConversations, messages);
  }, [conversations, messages]);

  const reportUser = useCallback(async (
    userId: string,
    userName: string,
    reason: Report['reason'],
    description?: string,
    messageId?: string
  ) => {
    const report: Report = {
      id: `report_${Date.now()}`,
      reportedUserId: userId,
      reportedUserName: userName,
      reporterUserId: user?.id || 'unknown',
      reason,
      description,
      messageId,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    try {
      const existingReports = await AsyncStorage.getItem(REPORTS_KEY);
      const reports: Report[] = existingReports ? JSON.parse(existingReports) : [];
      reports.push(report);
      await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    } catch (error) {
      console.error('Error saving report:', error);
    }
  }, [user]);

  const getConversation = useCallback((conversationId: string): Conversation | undefined => {
    return conversations.find(c => c.id === conversationId);
  }, [conversations]);

  const getMessages = useCallback((conversationId: string): Message[] => {
    return messages[conversationId] || [];
  }, [messages]);

  const refreshConversations = useCallback(async () => {
    await loadData();
  }, []);

  const shareToUser = useCallback(async (
    userId: string,
    userName: string,
    content: string,
    type: 'deal' | 'post',
    metadata: Message['metadata']
  ) => {
    const conversationId = await startConversation(userId, userName);
    await sendMessage(conversationId, content, type, metadata);
  }, [startConversation, sendMessage]);

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        messages,
        blockedUsers,
        isLoading,
        unreadCount,
        sendMessage,
        startConversation,
        markAsRead,
        deleteConversation,
        blockUser,
        unblockUser,
        isUserBlocked,
        muteConversation,
        unmuteConversation,
        reportUser,
        getConversation,
        getMessages,
        refreshConversations,
        shareToUser,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging(): MessagingContextType {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}
