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
  Alert,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-audio';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
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
import { getStylistForUser, getStylistGreeting, PersonalStylist } from '@/services/PersonalStylistService';
import { apiService } from '@/services/ApiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const INPUT_CONTAINER_HEIGHT = 80;

const CHAT_STORAGE_KEY = '@dripn_ai_stylist_chat';
const DAILY_MESSAGES_KEY = '@dripn_ai_daily_messages';

interface VoiceMessage {
  uri: string;
  duration: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  voiceMessage?: VoiceMessage;
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

interface MoodInfo {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  label: string;
  typingMessage: string;
}

const MOOD_CONFIG: Record<string, MoodInfo> = {
  happy: { icon: 'smile', color: '#10B981', label: 'Feeling great', typingMessage: 'is excited to help...' },
  excited: { icon: 'star', color: '#F59E0B', label: 'Excited', typingMessage: 'is buzzing with ideas...' },
  neutral: { icon: 'meh', color: '#6B7280', label: 'Focused', typingMessage: 'is styling...' },
  stressed: { icon: 'cloud', color: '#EF4444', label: 'Here for you', typingMessage: 'is here to help...' },
  sad: { icon: 'heart', color: '#8B5CF6', label: 'Caring for you', typingMessage: 'is sending love...' },
  angry: { icon: 'shield', color: '#F97316', label: 'Understanding', typingMessage: 'is listening...' },
  anxious: { icon: 'feather', color: '#06B6D4', label: 'Calming', typingMessage: 'is here for you...' },
  frustrated: { icon: 'anchor', color: '#EC4899', label: 'Patient', typingMessage: 'understands...' },
  tired: { icon: 'moon', color: '#6366F1', label: 'Gentle mode', typingMessage: 'is taking it easy...' },
  grateful: { icon: 'gift', color: '#22C55E', label: 'Grateful', typingMessage: 'appreciates you...' },
};


function generateAIResponse(
  userMessage: string,
  wardrobeItems: WardrobeItem[],
  userGender: string
): { content: string; outfitSuggestion?: ChatMessage['outfitSuggestion'] } {
  const lowerMessage = userMessage.toLowerCase();
  
  const emotionalKeywords = [
    'sad', 'upset', 'angry', 'frustrated', 'stressed', 'anxious', 'worried', 'tired',
    'depressed', 'lonely', 'hurt', 'bad day', 'terrible', 'awful', 'horrible',
    'broke up', 'breakup', 'break up', 'dumped', 'heartbroken', 'heartbreak',
    'crying', 'cried', 'tears', 'miss', 'lost', 'died', 'death', 'grief',
    'hate', 'angry', 'mad', 'furious', 'annoyed', 'irritated',
    'scared', 'afraid', 'nervous', 'panic', 'overwhelmed',
    'failed', 'failure', 'rejected', 'fired', 'laid off',
    'girlfriend', 'boyfriend', 'partner', 'relationship', 'marriage', 'divorce'
  ];
  
  const positiveKeywords = [
    'happy', 'excited', 'great', 'amazing', 'wonderful', 'fantastic', 'love',
    'grateful', 'thankful', 'blessed', 'lucky', 'awesome', 'brilliant'
  ];
  
  const hasEmotionalContent = emotionalKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasPositiveContent = positiveKeywords.some(keyword => lowerMessage.includes(keyword));
  const seemsNegative = hasEmotionalContent && !hasPositiveContent;
  
  if (seemsNegative) {
    const supportiveResponses = [
      "I'm really sorry to hear you're going through this. That sounds incredibly tough. I'm here for you - sometimes just having someone to talk to can help. Would you like to chat about what's on your mind, or would you prefer a distraction? I'm happy to help with either.",
      "Oh, I can hear that you're hurting right now. Please know that your feelings are completely valid. I'm here to listen if you want to share more. Sometimes when we're going through difficult times, a little self-care goes a long way. Is there anything I can do to help you feel a bit better?",
      "That sounds really difficult, and I'm so sorry you're dealing with this. Please be gentle with yourself - it's okay to not be okay sometimes. I'm here if you want to talk, or if you'd like a distraction, I could suggest something to brighten your day.",
      "I hear you, and I want you to know I'm here for you. Going through tough times is never easy, but you don't have to face it alone. Take all the time you need. When you're ready, I'm here - whether you want to talk about what's happening or just need a friendly chat.",
    ];
    return {
      content: supportiveResponses[Math.floor(Math.random() * supportiveResponses.length)],
    };
  }
  
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
  const screenInsets = useScreenInsets();
  const tabBarHeightContext = React.useContext(
    require('@react-navigation/bottom-tabs').BottomTabBarHeightContext
  );
  const tabBarHeight: number = typeof tabBarHeightContext === 'number' ? tabBarHeightContext : 0;
  const headerHeightContext = React.useContext(
    require('@react-navigation/elements').HeaderHeightContext
  );
  const headerHeight: number = typeof headerHeightContext === 'number' ? headerHeightContext : 0;
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  
  const stylist = getStylistForUser(user?.gender || null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messagesToday, setMessagesToday] = useState(0);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const pulseScale = useSharedValue(1);
  const waveformBars = [
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
  ];
  
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

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
    checkAudioPermission();
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      stopRecording(true);
    };
  }, []);
  
  useEffect(() => {
    if (messages.length === 0) {
      const userName = user?.name ? user.name.split(' ')[0] : null;
      const greeting = getStylistGreeting(stylist, userName);
      const greetingMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: greeting,
        timestamp: new Date().toISOString(),
      };
      setMessages([greetingMessage]);
    }
  }, [stylist, user?.name]);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );

      waveformBars.forEach((bar, index) => {
        bar.value = withRepeat(
          withSequence(
            withTiming(0.3 + Math.random() * 0.7, { duration: 200 + index * 50 }),
            withTiming(0.3, { duration: 200 + index * 50 })
          ),
          -1,
          true
        );
      });
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withSpring(1);
      waveformBars.forEach((bar) => {
        cancelAnimation(bar);
        bar.value = withSpring(0.3);
      });
    }
  }, [isRecording]);

  const checkAudioPermission = async () => {
    if (Platform.OS === 'web') {
      setHasAudioPermission(false);
      return;
    }
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasAudioPermission(status === 'granted');
    } catch (error) {
      setHasAudioPermission(false);
    }
  };

  const formatRecordingDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Voice commands are available in Expo Go on your mobile device');
      return;
    }

    if (!hasAudioPermission) {
      const { status, canAskAgain } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain && Platform.OS !== 'web') {
          Alert.alert(
            'Microphone Permission Required',
            `${stylist.name} needs access to your microphone to hear your voice commands. Please enable it in Settings.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.log('Could not open settings');
                  }
                }
              },
            ]
          );
        }
        return;
      }
      setHasAudioPermission(true);
    }

    if (!canSendMessage()) {
      Alert.alert('Daily Limit Reached', 'Upgrade to send more messages today');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 59) {
            stopRecording(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async (cancelled: boolean) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (!recordingRef.current) {
      setIsRecording(false);
      return;
    }

    try {
      const recording = recordingRef.current;
      recordingRef.current = null;

      const status = await recording.getStatusAsync();
      const actualDurationMs = status.isRecording ? status.durationMillis : (status.durationMillis || 0);
      const actualDurationSec = Math.ceil(actualDurationMs / 1000);

      await recording.stopAndUnloadAsync();
      setIsRecording(false);

      if (cancelled) {
        return;
      }

      const uri = recording.getURI();
      const minDurationMs = 300;

      if (uri && actualDurationMs >= minDurationMs) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        handleVoiceMessage(uri, Math.max(actualDurationSec, 1));
      } else if (uri && actualDurationMs < minDurationMs) {
        Alert.alert('Recording Too Short', 'Please hold to record a longer message.');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
    }
  };

  const handleVoiceMessage = async (uri: string, duration: number) => {
    if (!canSendMessage()) return;

    const voiceMessageText = 'I just sent you a voice message about my style needs. Please help me with outfit suggestions.';

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: 'Voice message',
      timestamp: new Date().toISOString(),
      voiceMessage: { uri, duration },
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setShowQuickPrompts(false);
    setIsTyping(true);

    await incrementDailyMessages();

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const wardrobeContext = wardrobeItems.map(item => ({
        id: item.id,
        name: item.name,
        color: item.color,
        category: item.category,
      }));
      
      const chatHistory = updatedMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      const response = await apiService.sendStylistMessage({
        stylistId: stylist.id,
        messages: chatHistory,
        userMessage: voiceMessageText,
        wardrobeItems: wardrobeContext,
        userGender: user?.gender || 'unspecified',
        subscriptionTier: tier,
      });
      
      if (response.mood) {
        setDetectedMood(response.mood.mood);
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      await saveChatHistory(finalMessages);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.log('API call failed for voice, using fallback:', error);
      const voiceResponses = [
        `I heard your voice message! Based on what you shared, let me put together some outfit ideas for you. For a versatile look, I'd suggest mixing your favorite pieces with some statement accessories.`,
        `Thanks for the voice message! I love that you're reaching out. Let me think about some combinations from your wardrobe that would work perfectly for you.`,
        `Got your voice message! I'm analyzing your request. If you're looking for something specific, feel free to type out the details and I'll create a personalized outfit recommendation.`,
        `Lovely to hear from you! I'm processing your style request. In the meantime, try our quick prompts below for instant outfit suggestions, or tell me more about what occasion you're dressing for.`,
      ];

      const responseContent = voiceResponses[Math.floor(Math.random() * voiceResponses.length)];

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      await saveChatHistory(finalMessages);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

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
    
    const lowerMessage = text.trim().toLowerCase();
    const emotionalKeywords = [
      'sad', 'upset', 'angry', 'frustrated', 'stressed', 'anxious', 'worried', 'tired',
      'depressed', 'lonely', 'hurt', 'bad day', 'terrible', 'awful', 'horrible',
      'broke up', 'breakup', 'break up', 'dumped', 'heartbroken', 'heartbreak',
      'crying', 'cried', 'tears', 'miss', 'lost', 'died', 'death', 'grief',
      'hate', 'mad', 'furious', 'annoyed', 'irritated',
      'scared', 'afraid', 'nervous', 'panic', 'overwhelmed',
      'failed', 'failure', 'rejected', 'fired', 'laid off',
      'girlfriend', 'boyfriend', 'partner', 'relationship', 'marriage', 'divorce'
    ];
    const positiveKeywords = [
      'happy', 'excited', 'great', 'amazing', 'wonderful', 'fantastic', 'love',
      'grateful', 'thankful', 'blessed', 'lucky', 'awesome', 'brilliant'
    ];
    
    const hasEmotionalContent = emotionalKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasPositiveContent = positiveKeywords.some(keyword => lowerMessage.includes(keyword));
    const seemsNegative = hasEmotionalContent && !hasPositiveContent;
    
    if (seemsNegative) {
      const supportiveResponses = [
        "I'm really sorry to hear you're going through this. That sounds incredibly tough. I'm here for you - sometimes just having someone to talk to can help. Would you like to chat about what's on your mind, or would you prefer a distraction? I'm happy to help with either.",
        "Oh, I can hear that you're hurting right now. Please know that your feelings are completely valid. I'm here to listen if you want to share more. Sometimes when we're going through difficult times, a little self-care goes a long way. Is there anything I can do to help you feel a bit better?",
        "That sounds really difficult, and I'm so sorry you're dealing with this. Please be gentle with yourself - it's okay to not be okay sometimes. I'm here if you want to talk, or if you'd like a distraction, I could suggest something to brighten your day.",
        "I hear you, and I want you to know I'm here for you. Going through tough times is never easy, but you don't have to face it alone. Take all the time you need. When you're ready, I'm here - whether you want to talk about what's happening or just need a friendly chat.",
      ];
      
      const supportiveResponse = supportiveResponses[Math.floor(Math.random() * supportiveResponses.length)];
      
      setDetectedMood('sad');
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: supportiveResponse,
        timestamp: new Date().toISOString(),
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);
      
      await saveChatHistory(finalMessages);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      return;
    }
    
    try {
      const wardrobeContext = wardrobeItems.map(item => ({
        id: item.id,
        name: item.name,
        color: item.color,
        category: item.category,
      }));
      
      const chatHistory = updatedMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      const response = await apiService.sendStylistMessage({
        stylistId: stylist.id,
        messages: chatHistory,
        userMessage: text.trim(),
        wardrobeItems: wardrobeContext,
        userGender: user?.gender || 'unspecified',
        subscriptionTier: tier,
      });
      
      if (response.mood) {
        setDetectedMood(response.mood.mood);
      }
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);
      
      await saveChatHistory(finalMessages);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.log('API call failed, using fallback:', error);
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
    }
  };
  
  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };
  
  const clearChat = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    const greeting = getStylistGreeting(stylist);
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
          <View style={[styles.avatarContainer, { backgroundColor: stylist.color }]}>
            <Feather name={stylist.icon} size={16} color="#FFFFFF" />
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
  const showUpgradeTeaser = remainingMessages !== Infinity && remainingMessages <= 10 && (tier === 'free' || tier === 'basic');
  const limitReached = !canSendMessage();
  
  const getUpgradeTeaserMessage = () => {
    if (remainingMessages === 0) {
      return {
        title: "Don't leave the conversation here!",
        message: `${stylist.name} has so much more to share with you. Upgrade now for unlimited styling sessions.`,
        icon: 'heart' as const,
      };
    }
    if (remainingMessages <= 3) {
      return {
        title: `Only ${remainingMessages} message${remainingMessages === 1 ? '' : 's'} left today`,
        message: `Loving your chat with ${stylist.name}? Upgrade to keep the style advice flowing.`,
        icon: 'zap' as const,
      };
    }
    return {
      title: `${remainingMessages} messages remaining today`,
      message: `Unlock unlimited conversations with ${stylist.name} and never miss a styling moment.`,
      icon: 'star' as const,
    };
  };
  
  const getMoodInfo = (): MoodInfo | null => {
    if (!detectedMood) return null;
    return MOOD_CONFIG[detectedMood] || null;
  };

  const moodInfo = getMoodInfo();

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={stylist.id === 'ruby' ? ['#E91E63', '#FF4081'] : [theme.link, theme.success]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stylistIcon}
          >
            <Feather name={stylist.icon} size={20} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <View style={styles.headerTitleRow}>
              <ThemedText style={styles.headerTitle}>{stylist.name}</ThemedText>
              {moodInfo ? (
                <Animated.View 
                  entering={FadeIn.duration(300)}
                  style={[styles.moodBadge, { backgroundColor: moodInfo.color + '20' }]}
                >
                  <Feather name={moodInfo.icon} size={10} color={moodInfo.color} />
                  <ThemedText style={[styles.moodBadgeText, { color: moodInfo.color }]}>
                    {moodInfo.label}
                  </ThemedText>
                </Animated.View>
              ) : null}
            </View>
            <ThemedText style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>
              Your Personal Stylist
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
      
      {showUpgradeTeaser ? (
        <Animated.View 
          entering={FadeIn.duration(400)}
          style={[styles.upgradeTeaserCard]}
        >
          <LinearGradient
            colors={stylist.id === 'ruby' ? ['#E91E63', '#FF4081'] : [theme.link, '#4ECDC4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeTeaserGradient}
          >
            <View style={styles.upgradeTeaserContent}>
              <View style={styles.upgradeTeaserIconContainer}>
                <Feather name={getUpgradeTeaserMessage().icon} size={24} color="#FFFFFF" />
              </View>
              <View style={styles.upgradeTeaserTextContainer}>
                <ThemedText style={styles.upgradeTeaserTitle}>{getUpgradeTeaserMessage().title}</ThemedText>
                <ThemedText style={styles.upgradeTeaserMessage}>{getUpgradeTeaserMessage().message}</ThemedText>
              </View>
            </View>
            <Pressable 
              onPress={navigateToSubscription}
              style={({ pressed }) => [
                styles.upgradeTeaserButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <ThemedText style={styles.upgradeTeaserButtonText}>Upgrade Now</ThemedText>
              <Feather name="arrow-right" size={16} color={stylist.id === 'ruby' ? '#E91E63' : theme.link} />
            </Pressable>
          </LinearGradient>
        </Animated.View>
      ) : null}
      
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
  
  const getTypingMessage = () => {
    if (moodInfo) {
      return `${stylist.name} ${moodInfo.typingMessage}`;
    }
    return `${stylist.name} is styling...`;
  };

  const renderFooter = () => (
    <>
      {isTyping ? (
        <View style={styles.typingContainer}>
          <View style={[styles.avatarContainer, { backgroundColor: moodInfo ? moodInfo.color : (stylist.id === 'ruby' ? '#E91E63' : theme.link) }]}>
            <Feather name={moodInfo ? moodInfo.icon : stylist.icon} size={16} color="#FFFFFF" />
          </View>
          <View style={[styles.typingBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator size="small" color={moodInfo ? moodInfo.color : (stylist.id === 'ruby' ? '#E91E63' : theme.link)} />
            <ThemedText style={[styles.typingText, { color: theme.tabIconDefault }]}>
              {getTypingMessage()}
            </ThemedText>
          </View>
        </View>
      ) : null}
      {showQuickPrompts && !isTyping && messages.length <= 1 ? renderQuickPrompts() : null}
      <View style={{ height: INPUT_CONTAINER_HEIGHT + Spacing.xl }} />
    </>
  );

  const renderInputBar = () => {
    if (isRecording) {
      return (
        <View
          style={[
            styles.inputContainerWrapper,
            { 
              paddingBottom: Spacing.sm,
              backgroundColor: theme.backgroundDefault,
            }
          ]}
        >
          <View style={[styles.recordingContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Pressable
              onPress={() => stopRecording(true)}
              style={[styles.cancelRecordingButton, { backgroundColor: theme.backgroundTertiary }]}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>

            <View style={styles.recordingInfo}>
              <View style={styles.waveformContainer}>
                {waveformBars.map((bar, index) => {
                  const animatedStyle = useAnimatedStyle(() => ({
                    height: 20 * bar.value,
                  }));
                  return (
                    <Animated.View
                      key={index}
                      style={[
                        styles.waveformBar,
                        { backgroundColor: stylist.color },
                        animatedStyle,
                      ]}
                    />
                  );
                })}
              </View>
              <ThemedText style={styles.recordingDuration}>
                {formatRecordingDuration(recordingDuration)}
              </ThemedText>
            </View>

            <Animated.View style={pulseAnimatedStyle}>
              <Pressable
                onPress={() => stopRecording(false)}
                style={[styles.stopRecordingButton, { backgroundColor: '#EF4444' }]}
              >
                <View style={styles.stopIcon} />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.inputContainerWrapper,
          { 
            paddingBottom: Spacing.sm,
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
          <Pressable
            onPress={startRecording}
            disabled={limitReached || isTyping}
            style={({ pressed }) => [
              styles.micButton,
              {
                backgroundColor: !limitReached && !isTyping
                  ? stylist.color
                  : theme.backgroundTertiary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="mic"
              size={18}
              color={!limitReached && !isTyping ? '#FFFFFF' : theme.tabIconDefault}
            />
          </Pressable>
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
  };
  
  return (
    <KeyboardProvider>
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
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
            { 
              paddingTop: headerHeight + Spacing.md,
              paddingBottom: INPUT_CONTAINER_HEIGHT + (tabBarHeight > 0 ? tabBarHeight : insets.bottom) + Spacing.md
            }
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          style={styles.flatList}
        />
        <View 
          style={[
            styles.inputBarAbsolute,
            { bottom: tabBarHeight > 0 ? tabBarHeight : insets.bottom }
          ]}
        >
          {renderInputBar()}
        </View>
      </View>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  inputBarAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  moodBadgeText: {
    fontSize: 10,
    fontWeight: '600',
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
  micButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cancelRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  recordingDuration: {
    ...Typography.body,
    fontWeight: '600',
    minWidth: 50,
  },
  stopRecordingButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  voicePlayButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  voiceWaveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDuration: {
    ...Typography.caption,
    marginLeft: Spacing.sm,
  },
  upgradeTeaserCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  upgradeTeaserGradient: {
    padding: Spacing.lg,
  },
  upgradeTeaserContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  upgradeTeaserIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTeaserTextContainer: {
    flex: 1,
  },
  upgradeTeaserTitle: {
    ...Typography.h4,
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  upgradeTeaserMessage: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  upgradeTeaserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  upgradeTeaserButtonText: {
    ...Typography.body,
    fontWeight: '700',
    color: '#E91E63',
  },
});
