import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
  Image,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { KeyboardStickyView, KeyboardProvider } from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useWardrobe, WardrobeItem, ClothingOccasion, ClothingSeason } from '@/contexts/WardrobeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenInsets } from '@/hooks/useScreenInsets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const INPUT_CONTAINER_HEIGHT = 80;

const CHAT_STORAGE_KEY = '@dripn_ai_stylist_chat';
const DAILY_MESSAGES_KEY = '@dripn_ai_daily_messages';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  outfitSuggestion?: {
    items: WardrobeItem[];
    occasion: string;
    reason: string;
  };
}

interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  icon: keyof typeof Feather.glyphMap;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { id: 'occasion', label: 'Outfit for Today', prompt: 'What should I wear today?', icon: 'sun' },
  { id: 'work', label: 'Work Outfit', prompt: 'Suggest a professional outfit for work', icon: 'briefcase' },
  { id: 'date', label: 'Date Night', prompt: 'Help me put together a date night outfit', icon: 'heart' },
  { id: 'weekend', label: 'Weekend Look', prompt: 'What casual outfit would you recommend for the weekend?', icon: 'coffee' },
  { id: 'party', label: 'Party Style', prompt: 'I need an outfit for a party tonight', icon: 'star' },
  { id: 'color', label: 'Color Advice', prompt: 'What colors go well together from my wardrobe?', icon: 'droplet' },
];

const AI_GREETINGS = [
  "Hello! I'm your personal AI stylist. I've looked through your wardrobe and I'm ready to help you create amazing outfits. What occasion are you dressing for?",
  "Welcome! I'm here to help you look your best. I've analyzed your wardrobe and can suggest outfits tailored to your style. What's on your schedule today?",
  "Hi there! As your AI stylist, I have access to your wardrobe and can help you put together the perfect look. What are we styling for today?",
];

function generateAIResponse(
  userMessage: string,
  wardrobeItems: WardrobeItem[],
  userGender: string
): { content: string; outfitSuggestion?: ChatMessage['outfitSuggestion'] } {
  const lowerMessage = userMessage.toLowerCase();
  
  const tops = wardrobeItems.filter(item => item.category === 'tops');
  const bottoms = wardrobeItems.filter(item => item.category === 'bottoms');
  const dresses = wardrobeItems.filter(item => item.category === 'dresses');
  const outerwear = wardrobeItems.filter(item => item.category === 'outerwear');
  const shoes = wardrobeItems.filter(item => item.category === 'shoes');
  const accessories = wardrobeItems.filter(item => item.category === 'accessories');
  
  const hasWardrobe = wardrobeItems.length > 0;
  
  if (!hasWardrobe) {
    return {
      content: "I notice your digital wardrobe is empty! To give you personalized outfit suggestions, please add some items to your wardrobe first. You can photograph your clothes and I'll help you create amazing outfits with them.",
    };
  }
  
  let occasion: ClothingOccasion = 'casual';
  let season: ClothingSeason = 'all-season';
  
  if (lowerMessage.includes('work') || lowerMessage.includes('office') || lowerMessage.includes('professional')) {
    occasion = 'work';
  } else if (lowerMessage.includes('date') || lowerMessage.includes('romantic')) {
    occasion = 'date-night';
  } else if (lowerMessage.includes('party') || lowerMessage.includes('club') || lowerMessage.includes('night out')) {
    occasion = 'party';
  } else if (lowerMessage.includes('formal') || lowerMessage.includes('wedding') || lowerMessage.includes('event')) {
    occasion = 'formal';
  } else if (lowerMessage.includes('workout') || lowerMessage.includes('gym') || lowerMessage.includes('exercise')) {
    occasion = 'workout';
  } else if (lowerMessage.includes('vacation') || lowerMessage.includes('holiday') || lowerMessage.includes('travel')) {
    occasion = 'vacation';
  }
  
  if (lowerMessage.includes('summer') || lowerMessage.includes('hot') || lowerMessage.includes('warm')) {
    season = 'summer';
  } else if (lowerMessage.includes('winter') || lowerMessage.includes('cold') || lowerMessage.includes('snow')) {
    season = 'winter';
  } else if (lowerMessage.includes('spring')) {
    season = 'spring';
  } else if (lowerMessage.includes('autumn') || lowerMessage.includes('fall')) {
    season = 'autumn';
  }
  
  const suitableTops = tops.filter(t => t.occasions.includes(occasion) || t.occasions.includes('everyday'));
  const suitableBottoms = bottoms.filter(b => b.occasions.includes(occasion) || b.occasions.includes('everyday'));
  const suitableDresses = dresses.filter(d => d.occasions.includes(occasion) || d.occasions.includes('everyday'));
  const suitableShoes = shoes.filter(s => s.occasions.includes(occasion) || s.occasions.includes('everyday'));
  
  if (lowerMessage.includes('color') || lowerMessage.includes('colour')) {
    const colorCounts: Record<string, number> = {};
    wardrobeItems.forEach(item => {
      colorCounts[item.color] = (colorCounts[item.color] || 0) + 1;
    });
    const dominantColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => color);
    
    const colorAdvice = `Looking at your wardrobe, your dominant colors are ${dominantColors.join(', ')}. Here are some tips:\n\n` +
      `- ${dominantColors[0]} pairs beautifully with neutral tones like white, cream, or black\n` +
      `- Try creating contrast with complementary colors for a bold look\n` +
      `- For a sophisticated ensemble, stick to a monochromatic palette using different shades\n\n` +
      `Would you like me to suggest a specific outfit using these colors?`;
    
    return { content: colorAdvice };
  }
  
  if (lowerMessage.includes('today') || lowerMessage.includes('suggest') || lowerMessage.includes('outfit') || 
      lowerMessage.includes('wear') || lowerMessage.includes('help') || lowerMessage.includes('recommend')) {
    
    const selectedItems: WardrobeItem[] = [];
    let responseContent = '';
    let outfitReason = '';
    
    if (suitableDresses.length > 0 && Math.random() > 0.5) {
      const dress = suitableDresses[Math.floor(Math.random() * suitableDresses.length)];
      selectedItems.push(dress);
      
      if (suitableShoes.length > 0) {
        const matchingShoe = suitableShoes.find(s => 
          s.color === dress.color || s.color === 'black' || s.color === 'beige' || s.color === 'white'
        ) || suitableShoes[0];
        selectedItems.push(matchingShoe);
      }
      
      outfitReason = `This ${dress.name} is perfect for ${occasion}. The ${dress.color} color will make you stand out elegantly.`;
      responseContent = `I've put together a beautiful outfit for ${occasion}!\n\n` +
        `Your ${dress.name} in ${dress.color} is an excellent choice. `;
      
      if (selectedItems.length > 1) {
        responseContent += `I'd pair it with your ${selectedItems[1].name} to complete the look. `;
      }
      
      responseContent += `\n\nStyle tip: ${occasion === 'work' 
        ? 'Add a structured blazer for a more professional appearance.' 
        : occasion === 'date-night' 
          ? 'Add some statement jewelry to elevate the look.' 
          : 'Keep accessories minimal for a clean, polished look.'}`;
      
    } else if (suitableTops.length > 0 && suitableBottoms.length > 0) {
      const top = suitableTops[Math.floor(Math.random() * suitableTops.length)];
      const bottom = suitableBottoms[Math.floor(Math.random() * suitableBottoms.length)];
      selectedItems.push(top, bottom);
      
      if (suitableShoes.length > 0) {
        const matchingShoe = suitableShoes.find(s => 
          s.color === top.color || s.color === bottom.color || s.color === 'black' || s.color === 'white'
        ) || suitableShoes[0];
        selectedItems.push(matchingShoe);
      }
      
      if (outerwear.length > 0 && (season === 'winter' || season === 'autumn')) {
        const jacket = outerwear.find(o => 
          o.seasons.includes(season) || o.seasons.includes('all-season')
        );
        if (jacket) selectedItems.push(jacket);
      }
      
      outfitReason = `This combination of ${top.color} ${top.name} with ${bottom.color} ${bottom.name} creates a balanced, stylish look for ${occasion}.`;
      responseContent = `Here's my outfit recommendation for ${occasion}:\n\n` +
        `Start with your ${top.name} in ${top.color} - it's versatile and stylish. ` +
        `Pair it with your ${bottom.name} for a perfectly coordinated look.\n\n`;
      
      if (selectedItems.length > 2) {
        responseContent += `Complete the outfit with your ${selectedItems[2].name}. `;
      }
      if (selectedItems.length > 3) {
        responseContent += `And don't forget your ${selectedItems[3].name} to stay warm!`;
      }
      
      responseContent += `\n\nPro tip: ${occasion === 'work' 
        ? 'Tuck in your top for a more polished, professional silhouette.' 
        : occasion === 'casual' 
          ? 'Roll up your sleeves slightly for a relaxed, effortless vibe.' 
          : 'Add a belt to define your waist and elevate the look.'}`;
    } else {
      responseContent = `Based on your wardrobe, I'd love to help you with more outfit options. ` +
        `You currently have ${wardrobeItems.length} items. For better outfit suggestions, ` +
        `consider adding more ${tops.length === 0 ? 'tops' : bottoms.length === 0 ? 'bottoms' : 'variety'} to your collection.\n\n` +
        `Would you like tips on building a versatile capsule wardrobe?`;
      
      return { content: responseContent };
    }
    
    return {
      content: responseContent,
      outfitSuggestion: {
        items: selectedItems,
        occasion,
        reason: outfitReason,
      },
    };
  }
  
  if (lowerMessage.includes('capsule') || lowerMessage.includes('essentials') || lowerMessage.includes('basics')) {
    const missingCategories: string[] = [];
    if (tops.length < 5) missingCategories.push('versatile tops');
    if (bottoms.length < 3) missingCategories.push('classic bottoms');
    if (outerwear.length < 2) missingCategories.push('quality outerwear');
    if (shoes.length < 3) missingCategories.push('essential footwear');
    
    let capsuleAdvice = `Let me analyze your wardrobe for capsule essentials:\n\n` +
      `You have ${wardrobeItems.length} items total:\n` +
      `- Tops: ${tops.length}\n` +
      `- Bottoms: ${bottoms.length}\n` +
      `- Dresses: ${dresses.length}\n` +
      `- Outerwear: ${outerwear.length}\n` +
      `- Shoes: ${shoes.length}\n` +
      `- Accessories: ${accessories.length}\n\n`;
    
    if (missingCategories.length > 0) {
      capsuleAdvice += `For a complete capsule wardrobe, consider adding: ${missingCategories.join(', ')}.\n\n`;
    }
    
    capsuleAdvice += `Tip: A well-curated capsule wardrobe typically has 30-40 pieces that all work together. Focus on neutral colors as your base!`;
    
    return { content: capsuleAdvice };
  }
  
  if (lowerMessage.includes('favorite') || lowerMessage.includes('favourite') || lowerMessage.includes('best')) {
    const favorites = wardrobeItems.filter(item => item.isFavorite);
    const mostWorn = [...wardrobeItems].sort((a, b) => b.timesWorn - a.timesWorn).slice(0, 3);
    
    let favoritesResponse = `Here's what I've noticed about your style preferences:\n\n`;
    
    if (favorites.length > 0) {
      favoritesResponse += `Your favorite pieces: ${favorites.map(f => f.name).join(', ')}\n\n`;
    }
    
    if (mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
      favoritesResponse += `Your most-worn items:\n`;
      mostWorn.forEach((item, index) => {
        favoritesResponse += `${index + 1}. ${item.name} (worn ${item.timesWorn} times)\n`;
      });
    }
    
    favoritesResponse += `\nWould you like outfit ideas featuring your favorite pieces?`;
    
    return { content: favoritesResponse };
  }
  
  return {
    content: `I'm here to help you with your styling needs! You can ask me to:\n\n` +
      `- Suggest outfits for specific occasions (work, dates, parties)\n` +
      `- Recommend color combinations from your wardrobe\n` +
      `- Analyze your capsule wardrobe essentials\n` +
      `- Create looks based on your favorite pieces\n\n` +
      `Just tell me what you're looking for, and I'll create personalized recommendations from your ${wardrobeItems.length} wardrobe items!`,
  };
}

export default function AIStylistScreen() {
  const { theme } = useTheme();
  const { limits, tier } = useSubscription();
  const { items: wardrobeItems } = useWardrobe();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { headerHeight } = useScreenInsets();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messagesToday, setMessagesToday] = useState(0);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  
  const navigateToSubscription = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ProfileTab',
        params: {
          screen: 'Subscription',
        },
      })
    );
  }, [navigation]);
  
  const navigateToWardrobe = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ProfileTab',
        params: {
          screen: 'Wardrobe',
        },
      })
    );
  }, [navigation]);
  
  useEffect(() => {
    loadChatHistory();
    loadDailyMessageCount();
  }, []);
  
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = AI_GREETINGS[Math.floor(Math.random() * AI_GREETINGS.length)];
      const greetingMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: greeting,
        timestamp: new Date().toISOString(),
      };
      setMessages([greetingMessage]);
    }
  }, []);
  
  const loadChatHistory = async () => {
    try {
      const data = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const today = new Date().toDateString();
        const recentMessages = parsed.filter((msg: ChatMessage) => 
          new Date(msg.timestamp).toDateString() === today
        ).slice(-20);
        if (recentMessages.length > 0) {
          setMessages(recentMessages);
          setShowQuickPrompts(false);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };
  
  const loadDailyMessageCount = async () => {
    try {
      const data = await AsyncStorage.getItem(DAILY_MESSAGES_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const today = new Date().toDateString();
        if (parsed.date === today) {
          setMessagesToday(parsed.count);
        } else {
          await AsyncStorage.setItem(DAILY_MESSAGES_KEY, JSON.stringify({ date: today, count: 0 }));
          setMessagesToday(0);
        }
      }
    } catch (error) {
      console.error('Failed to load daily message count:', error);
    }
  };
  
  const saveChatHistory = async (newMessages: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(newMessages.slice(-50)));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };
  
  const incrementDailyMessages = async () => {
    try {
      const today = new Date().toDateString();
      const newCount = messagesToday + 1;
      await AsyncStorage.setItem(DAILY_MESSAGES_KEY, JSON.stringify({ date: today, count: newCount }));
      setMessagesToday(newCount);
    } catch (error) {
      console.error('Failed to increment daily messages:', error);
    }
  };
  
  const canSendMessage = () => {
    if (limits.aiChatMessagesPerDay === Infinity) return true;
    return messagesToday < limits.aiChatMessagesPerDay;
  };
  
  const getRemainingMessages = () => {
    if (limits.aiChatMessagesPerDay === Infinity) return Infinity;
    return Math.max(0, limits.aiChatMessagesPerDay - messagesToday);
  };
  
  const sendMessage = async (text: string) => {
    if (!text.trim() || !canSendMessage()) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setShowQuickPrompts(false);
    setIsTyping(true);
    
    await incrementDailyMessages();
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    setTimeout(async () => {
      const response = generateAIResponse(text, wardrobeItems, user?.gender || 'unspecified');
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        outfitSuggestion: response.outfitSuggestion,
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);
      
      await saveChatHistory(finalMessages);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 1500 + Math.random() * 1000);
  };
  
  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };
  
  const clearChat = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    const greeting = AI_GREETINGS[Math.floor(Math.random() * AI_GREETINGS.length)];
    const greetingMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    };
    
    setMessages([greetingMessage]);
    setShowQuickPrompts(true);
    await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
  };
  
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user';
    
    return (
      <Animated.View
        entering={FadeInUp.delay(index * 50).duration(300)}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        {!isUser ? (
          <View style={[styles.avatarContainer, { backgroundColor: theme.link }]}>
            <Feather name="zap" size={16} color="#FFFFFF" />
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
            style={[
              styles.messageText,
              isUser ? { color: '#FFFFFF' } : null,
            ]}
          >
            {item.content}
          </ThemedText>
          
          {item.outfitSuggestion && item.outfitSuggestion.items.length > 0 ? (
            <View style={styles.outfitSuggestionContainer}>
              <View style={[styles.outfitDivider, { backgroundColor: theme.border }]} />
              <ThemedText style={styles.outfitTitle}>Suggested Outfit</ThemedText>
              <View style={styles.outfitItemsRow}>
                {item.outfitSuggestion.items.slice(0, 4).map((wardrobeItem) => (
                  <View key={wardrobeItem.id} style={styles.outfitItemContainer}>
                    {wardrobeItem.imageUri ? (
                      <Image
                        source={{ uri: wardrobeItem.imageUri }}
                        style={[styles.outfitItemImage, { backgroundColor: theme.backgroundTertiary }]}
                      />
                    ) : (
                      <View style={[styles.outfitItemPlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
                        <Feather name="image" size={20} color={theme.tabIconDefault} />
                      </View>
                    )}
                    <ThemedText style={styles.outfitItemName} numberOfLines={1}>
                      {wardrobeItem.name}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
        
        {isUser ? (
          <View style={[styles.userAvatar, { backgroundColor: theme.success }]}>
            <Feather name="user" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </Animated.View>
    );
  };
  
  const renderQuickPrompts = () => (
    <View style={styles.quickPromptsContainer}>
      <ThemedText style={[styles.quickPromptsTitle, { color: theme.tabIconDefault }]}>
        Quick suggestions
      </ThemedText>
      <View style={styles.quickPromptsGrid}>
        {QUICK_PROMPTS.map((prompt) => (
          <Pressable
            key={prompt.id}
            onPress={() => handleQuickPrompt(prompt.prompt)}
            disabled={!canSendMessage()}
            style={({ pressed }) => [
              styles.quickPromptButton,
              { 
                backgroundColor: theme.backgroundSecondary,
                opacity: pressed ? 0.7 : canSendMessage() ? 1 : 0.5,
              },
            ]}
          >
            <Feather name={prompt.icon} size={16} color={canSendMessage() ? theme.link : theme.tabIconDefault} />
            <ThemedText style={[styles.quickPromptLabel, !canSendMessage() && { color: theme.tabIconDefault }]}>
              {prompt.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
  
  const remainingMessages = getRemainingMessages();
  const showLimitWarning = remainingMessages !== Infinity && remainingMessages <= 3;
  const limitReached = !canSendMessage();
  
  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[theme.link, theme.success]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stylistIcon}
          >
            <Feather name="zap" size={20} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <ThemedText style={styles.headerTitle}>AI Stylist</ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>
              {wardrobeItems.length} items in wardrobe
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          {remainingMessages !== Infinity ? (
            <View style={[styles.messageCounter, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText style={[styles.messageCountText, showLimitWarning ? { color: theme.warning } : null]}>
                {remainingMessages} left
              </ThemedText>
            </View>
          ) : null}
          <Pressable onPress={clearChat} style={styles.clearButton}>
            <Feather name="refresh-cw" size={20} color={theme.tabIconDefault} />
          </Pressable>
        </View>
      </View>
      
      {wardrobeItems.length === 0 ? (
        <Card elevation={2} style={styles.emptyWardrobeCard}>
          <View style={styles.emptyWardrobeContent}>
            <View style={[styles.emptyWardrobeIcon, { backgroundColor: theme.warning + '20' }]}>
              <Feather name="inbox" size={24} color={theme.warning} />
            </View>
            <ThemedText style={styles.emptyWardrobeTitle}>Add items to your wardrobe</ThemedText>
            <ThemedText style={[styles.emptyWardrobeText, { color: theme.tabIconDefault }]}>
              For personalized outfit suggestions, photograph your clothes first
            </ThemedText>
            <Pressable
              onPress={navigateToWardrobe}
              style={({ pressed }) => [
                styles.addWardrobeButton,
                { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <ThemedText style={styles.addWardrobeButtonText}>Open Wardrobe</ThemedText>
            </Pressable>
          </View>
        </Card>
      ) : null}
    </View>
  );
  
  const renderFooter = () => (
    <>
      {isTyping ? (
        <View style={styles.typingContainer}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.link }]}>
            <Feather name="zap" size={16} color="#FFFFFF" />
          </View>
          <View style={[styles.typingBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator size="small" color={theme.link} />
            <ThemedText style={[styles.typingText, { color: theme.tabIconDefault }]}>
              Styling...
            </ThemedText>
          </View>
        </View>
      ) : null}
      {showQuickPrompts && !isTyping && messages.length <= 1 ? renderQuickPrompts() : null}
      <View style={{ height: INPUT_CONTAINER_HEIGHT + Spacing.xl }} />
    </>
  );

  const renderInputBar = () => (
    <View
      style={[
        styles.inputContainerWrapper,
        { 
          paddingBottom: insets.bottom + Spacing.sm,
          backgroundColor: theme.backgroundDefault,
        }
      ]}
    >
      {limitReached ? (
        <Animated.View 
          entering={FadeIn.duration(300)}
          style={[
            styles.limitReachedBanner, 
            { backgroundColor: theme.warning + '20' }
          ]}
        >
          <Feather name="alert-circle" size={16} color={theme.warning} />
          <ThemedText style={[styles.limitReachedText, { color: theme.warning }]}>
            Daily message limit reached
          </ThemedText>
          <Pressable onPress={navigateToSubscription}>
            <ThemedText style={[styles.upgradeLink, { color: theme.link }]}>Upgrade</ThemedText>
          </Pressable>
        </Animated.View>
      ) : null}
      <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary }]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={limitReached ? "Daily limit reached - upgrade for more" : "Ask for styling advice..."}
          placeholderTextColor={theme.tabIconDefault}
          style={[styles.textInput, { color: theme.text }]}
          multiline
          maxLength={500}
          editable={!limitReached}
          onSubmitEditing={() => sendMessage(inputText)}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || limitReached || isTyping}
          style={({ pressed }) => [
            styles.sendButton,
            {
              backgroundColor: inputText.trim() && !limitReached && !isTyping
                ? theme.link
                : theme.backgroundTertiary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name="send"
            size={18}
            color={inputText.trim() && !limitReached && !isTyping ? '#FFFFFF' : theme.tabIconDefault}
          />
        </Pressable>
      </View>
    </View>
  );
  
  return (
    <KeyboardProvider>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md }
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      />
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        {renderInputBar()}
      </KeyboardStickyView>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  headerContent: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stylistIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h3,
  },
  headerSubtitle: {
    ...Typography.caption,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  messageCounter: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  messageCountText: {
    ...Typography.caption,
  },
  clearButton: {
    padding: Spacing.sm,
  },
  emptyWardrobeCard: {
    marginBottom: Spacing.lg,
  },
  emptyWardrobeContent: {
    alignItems: 'center',
  },
  emptyWardrobeIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyWardrobeTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyWardrobeText: {
    ...Typography.small,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  addWardrobeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  addWardrobeButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.7,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  assistantBubble: {
    borderBottomLeftRadius: Spacing.xs,
  },
  messageText: {
    ...Typography.body,
    lineHeight: 22,
  },
  outfitSuggestionContainer: {
    marginTop: Spacing.md,
  },
  outfitDivider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  outfitTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  outfitItemsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  outfitItemContainer: {
    alignItems: 'center',
    width: 60,
  },
  outfitItemImage: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
  },
  outfitItemPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitItemName: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: Spacing.xs,
  },
  typingText: {
    ...Typography.small,
  },
  quickPromptsContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  quickPromptsTitle: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  quickPromptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  quickPromptLabel: {
    ...Typography.small,
  },
  limitReachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  limitReachedText: {
    ...Typography.small,
  },
  upgradeLink: {
    ...Typography.small,
    fontWeight: '600',
  },
  inputContainerWrapper: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
