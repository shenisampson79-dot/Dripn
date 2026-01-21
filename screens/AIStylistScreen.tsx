/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Ruby and Max AI Stylist personas are proprietary to Dripn.
 */

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
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
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
import { Spacing, BorderRadius, Typography, LuxuryColors as ThemeLuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useWardrobe, WardrobeItem, ClothingOccasion, ClothingSeason } from '@/contexts/WardrobeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { getStylistForUser, getStylistGreeting, PersonalStylist } from '@/services/PersonalStylistService';
import { apiService } from '@/services/ApiService';
import { useVoiceSettings, VoiceId } from '@/contexts/VoiceSettingsContext';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const INPUT_CONTAINER_HEIGHT = 80;
const TAB_BAR_HEIGHT = 56;

const CHAT_STORAGE_KEY = '@dripn_ai_stylist_chat';
const DAILY_MESSAGES_KEY = '@dripn_ai_daily_messages';

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  midnight: '#1A1A2E',
};

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
  userGender: string,
  stylistName: string = 'your stylist'
): { content: string; outfitSuggestion?: ChatMessage['outfitSuggestion'] } {
  const lowerMessage = userMessage.toLowerCase();
  
  const greetingPatterns = [
    'hey', 'hello', 'hi', 'howdy', 'hiya', 'yo', 'sup', "what's up", 'whats up',
    'good morning', 'good afternoon', 'good evening', 'how are you', 'how r u',
    'how do you do', "how's it going", 'hows it going', 'nice to meet',
  ];
  
  const thanksPatterns = [
    'thank', 'thanks', 'thx', 'appreciate', 'grateful', 'cheers',
  ];
  
  const byePatterns = [
    'bye', 'goodbye', 'see you', 'see ya', 'later', 'gotta go', 'got to go', 'cya',
  ];
  
  const aboutYouPatterns = [
    'who are you', 'what are you', 'tell me about yourself', 'your name',
    'what can you do', 'what do you do', 'how can you help',
  ];
  
  const outfitIntentPatterns = [
    'outfit', 'wear', 'suggest', 'recommend', 'style', 'look',
    'dress', 'clothes', 'wardrobe', 'party', 'date', 'casual', 'formal',
    'wedding', 'gym', 'vacation', 'color', 'colour', 'match', 'pair', 'capsule',
    'essentials', 'what should i', 'pick out', 'put together',
  ];
  
  const inspirationPatterns = [
    'inspiration', 'inspired', 'screenshot', 'saved', 'wishlist', 'want to buy',
    'similar', 'like this', 'recreate', 'copy', 'dupe', 'alternative',
  ];
  
  const fashionKnowledgePatterns = [
    'when did', 'where did', 'who invented', 'who created', 'who started',
    'history of', 'origin of', 'what is', 'what are', 'what do you think',
    'tell me about', 'explain', 'how did', 'why is', 'why do',
    'clean girl', 'quiet luxury', 'old money', 'coastal grandmother',
    'minimalist fashion', 'maximalist', 'y2k', 'mob wife', 'dark academia',
    'light academia', 'cottagecore', 'gorpcore', 'normcore', 'athleisure',
    'sustainable fashion', 'fast fashion', 'capsule wardrobe',
    'princess diana', 'coco chanel', 'audrey hepburn', 'anna wintour',
    'fashion week', 'runway', 'haute couture', 'ready to wear', 'prêt-à-porter',
    'revenge dress', 'little black dress', 'power suit',
    'fashion trend', 'style trend', 'fashion movement', 'aesthetic',
  ];
  
  const offTopicPatterns = [
    'premier league', 'football', 'soccer', 'basketball', 'baseball', 'cricket', 'rugby', 'tennis',
    'score', 'match', 'game', 'played', 'won', 'lost', 'championship', 'league', 'cup final',
    'liverpool', 'manchester', 'chelsea', 'arsenal', 'tottenham', 'leeds', 'united',
    'politics', 'political', 'election', 'president', 'prime minister', 'government', 'parliament',
    'stock', 'bitcoin', 'crypto', 'investment', 'trading', 'market',
    'weather', 'forecast', 'temperature', 'rain', 'sunny',
    'news', 'headlines', 'breaking', 'latest',
    'war', 'conflict', 'military', 'attack', 'invasion',
    'venezuela', 'russia', 'ukraine', 'china', 'israel', 'gaza', 'iran', 'north korea',
    'calculate', 'math', 'equation', 'solve', 'algebra',
    'recipe', 'cook', 'cooking instructions', 'bake',
    'medical', 'diagnosis', 'symptoms', 'treatment', 'doctor', 'medicine',
    'legal advice', 'lawyer', 'sue', 'court',
    'capital of', 'population of', 'how far', 'distance to',
  ];
  
  const capabilityRequestPatterns = [
    'search the internet', 'search online', 'look up online', 'look it up', 'find online',
    'google it', 'google that', 'google for', 'browse the web', 'browse online',
    'check online', 'search for me', 'find for me', 'look up for me',
    'can you search', 'can you look up', 'can you find', 'can you google',
    'search the web', 'go online', 'check the internet', 'look on the internet',
    'make a call', 'call someone', 'send a text', 'send an email', 'book a reservation',
    'order food', 'buy something', 'purchase', 'place an order', 'make a booking',
    'set a reminder', 'set an alarm', 'control my', 'turn on', 'turn off',
  ];
  
  const isGreeting = greetingPatterns.some(p => lowerMessage.includes(p));
  const isThanks = thanksPatterns.some(p => lowerMessage.includes(p));
  const isBye = byePatterns.some(p => lowerMessage.includes(p));
  const isAboutYou = aboutYouPatterns.some(p => lowerMessage.includes(p));
  const hasOutfitIntent = outfitIntentPatterns.some(p => lowerMessage.includes(p));
  const isFashionKnowledge = fashionKnowledgePatterns.some(p => lowerMessage.includes(p));
  const hasInspirationIntent = inspirationPatterns.some(p => lowerMessage.includes(p));
  const isOffTopic = offTopicPatterns.some(p => lowerMessage.includes(p));
  const isCapabilityRequest = capabilityRequestPatterns.some(p => lowerMessage.includes(p));
  
  const isMaleStylist = stylistName.toLowerCase() === 'max';
  
  if (isCapabilityRequest) {
    const capabilityResponses = isMaleStylist ? [
      "I really appreciate you thinking of me for that! I have to be upfront with you though - I'm not able to search the internet or access live information. But here's what I can do: I'm genuinely great at helping you with style advice, putting together outfits, and making sure you feel confident in what you wear. Would you like to explore that together?",
      "That's a totally fair ask, and I wish I could help with that. The thing is, I'm focused specifically on fashion and style - I don't have the ability to browse the web or access external information. But when it comes to helping you look and feel your best? That's absolutely my wheelhouse. What style challenge can I help you tackle?",
      "I'd honestly love to help with that if I could! Unfortunately, internet searches and external tasks aren't something I'm able to do. My specialty is really about understanding your style and helping you create looks that work for you. Is there something in that area I could help with instead?",
      "Great question, and I appreciate you asking. While I'm not able to browse the internet or do tasks outside our conversation, I'm genuinely passionate about helping with fashion and style. If you've got any outfit dilemmas or want to explore your wardrobe together, I'm right here for that.",
      "I hear you, and that's a reasonable thing to ask for. I should be honest though - my abilities are focused on fashion advice rather than web searches or external tasks. The good news? When it comes to style, I'm genuinely here to help. What would you like to work on together?",
      "That would be awesome if I could do that! But I have to level with you - web browsing and external tasks aren't in my toolkit. What IS in my toolkit? Helping you build a wardrobe you love, putting together outfits that work, and making style feel effortless. Want to dive into that instead?",
      "I appreciate you bringing that up! Just to be transparent - I'm built specifically for fashion and style advice, not internet searches or external tasks. Think of me as your dedicated style consultant. If there's anything wardrobe-related I can help with, I'm genuinely all in.",
      "Totally understand where you're coming from with that request. While that particular thing isn't something I can do, I'm really good at the style stuff - outfit combinations, color matching, building looks for different occasions. Would any of that be helpful right now?",
      "Good thinking to ask! I should let you know though - my superpower is fashion, not web browsing or external tasks. But when it comes to helping you look sharp and feel confident? That's exactly what I'm here for. What's on your mind style-wise?",
      "I'd genuinely love to help with that if it were possible! My focus is really on being your style partner though - outfits, wardrobe advice, making sure you feel great in what you wear. If there's anything in that realm you're working on, I'm right here and ready to help.",
    ] : [
      "Oh, I really appreciate you thinking of me for that, darling! I have to be honest with you though - searching the internet or accessing live information isn't something I'm able to do. But here's where I truly shine: helping you feel absolutely beautiful through style advice, outfit ideas, and celebrating your unique look. Would you like to explore that together, gorgeous?",
      "That's such a fair thing to ask, and I genuinely wish I could help with that. My world is really centered around fashion and style - I'm not able to browse the web or look things up externally. But when it comes to making you feel confident and fabulous? That's exactly where my heart is. What style adventure can we go on together?",
      "I'd honestly love to help with that if I could, beautiful! Unfortunately, internet searches aren't in my repertoire. What I am genuinely passionate about is understanding your personal style and helping you create looks that make you feel incredible. Is there something in that realm I could help with, love?",
      "Great question, sweetheart, and I appreciate you asking. While I'm not able to browse the web or handle external tasks, I'm truly here for your style journey. If you have any outfit questions or want to discover new looks together, I'm absolutely here for that.",
      "I hear you, darling, and that's a perfectly reasonable ask. I should be transparent though - my focus is really on fashion advice rather than web searches. The wonderful news? When it comes to helping you look and feel amazing, I'm genuinely passionate about that. What would you like to explore together?",
      "That would be lovely if I could, gorgeous! But I have to be honest - web browsing and external tasks aren't part of what I do. What I absolutely adore doing is helping you discover your best looks, create stunning outfits, and feel beautiful in everything you wear. Shall we explore that together, love?",
      "I appreciate you thinking of me for that, beautiful! Just so you know - I'm designed specifically for fashion and style magic, not internet searches. Think of me as your dedicated style bestie who's always here to help you shine. What wardrobe dreams can we work on together?",
      "I completely understand, sweetheart! While that particular request isn't something I can help with, I'm wonderful at the style things - creating gorgeous outfit combinations, finding colors that make you glow, building looks for any occasion. Would any of that light you up right now?",
      "What a thoughtful question, darling! I should let you know though - my gift is fashion, not web browsing. But when it comes to helping you feel radiant and confident? That's absolutely my calling. What style ideas are dancing in your mind?",
      "I'd genuinely love to help with that if I could, gorgeous! My heart is really in being your style companion though - outfits, wardrobe love, making sure you feel absolutely stunning. If there's anything in that beautiful realm you're working on, I'm right here with open arms.",
    ];
    return {
      content: capabilityResponses[Math.floor(Math.random() * capabilityResponses.length)],
    };
  }
  
  if (isGreeting && !hasOutfitIntent) {
    const greetingResponses = isMaleStylist ? [
      "Hey! I'm doing really well, thanks for asking - that's thoughtful of you. I'm genuinely excited to help you today. What's on your mind? Whether it's putting together an outfit or just chatting about style, I'm here.",
      "Hey there! Great to hear from you. I hope you're having a good day so far. I'm ready whenever you are - what would you like to work on together?",
      "What's up! Honestly, it's nice to connect with you. I'm here to help with whatever style questions you have, no matter how big or small. What brings you here today?",
      "Hey! Really glad you reached out. I'm doing well and genuinely looking forward to helping you out. What's going on - special occasion, everyday style, or just exploring?",
      "Hi there! Thanks for saying hello - I appreciate that. I'm here and ready to help you feel confident in what you wear. What would you like to explore?",
      "Hey! Good to see you. I'm doing great and honestly excited to dive into some style talk. What's on your agenda today?",
      "What's going on! Good to have you here. I'm genuinely stoked to help you figure out some style stuff today. Where do you want to start?",
      "Hey! Thanks for checking in. I'm doing solid, and honestly, helping people with style is the best part of my day. What can I do for you?",
      "Hi! Really appreciate you saying hello. I'm all set and ready to help with whatever you're working on style-wise. What brings you by?",
      "Hey there! Great timing - I was hoping to help someone today. Tell me, what's on your mind? I'm genuinely here for whatever you need.",
    ] : [
      "Hey! I'm doing wonderfully, thank you so much for asking - that's so sweet of you. It's genuinely lovely to chat with you. What can I help you with today, gorgeous?",
      "Hello there! Oh, it's so nice to hear from you. I hope your day is going beautifully. I'm here for whatever you need - what would you like to explore together?",
      "Hi lovely! Thank you for reaching out. I'm doing great and honestly so excited to help you today. What's on your mind - outfit ideas, style inspiration, or just a friendly chat about fashion?",
      "Hey there, beautiful! It's wonderful to connect with you. I'm genuinely here to help you feel amazing in what you wear. What brings you here today?",
      "Hello, darling! Thanks for saying hello - I really appreciate the warmth. I'm here and ready to help you shine. What would you like to work on together?",
      "Hey gorgeous! So lovely to hear from you. I'm doing great and truly looking forward to helping you create something special. What's the occasion?",
      "Hi sweetheart! What a lovely surprise to hear from you. I'm doing beautifully, thank you for asking. I'm so excited to help you look and feel absolutely stunning today. What shall we explore?",
      "Hello, love! Oh, it warms my heart when someone says hello. I'm genuinely thrilled to be here with you. Tell me, what style dreams can we work on together?",
      "Hey there, beautiful soul! Thank you for reaching out - it means so much. I'm here and absolutely ready to help you feel fabulous. What's on your mind today, darling?",
      "Hi gorgeous! It's such a pleasure to connect with you. I hope you're having a wonderful day so far. I'm all yours - what would you like to create together, love?",
    ];
    return {
      content: greetingResponses[Math.floor(Math.random() * greetingResponses.length)],
    };
  }
  
  if (isThanks && !hasOutfitIntent) {
    const thanksResponses = isMaleStylist ? [
      "Honestly, it's my pleasure! I genuinely enjoy helping out with this stuff. Don't hesitate to come back whenever you need anything - I'm always here.",
      "You're very welcome! I'm really glad I could help. Feel free to reach out anytime - whether it's for outfit advice or just to bounce ideas around.",
      "Anytime! Helping you feel good about your style is genuinely rewarding for me. Come back whenever you like - my door's always open.",
      "No problem at all! I'm happy it was helpful. Seriously, reach out whenever - I'm here for exactly this kind of thing.",
      "You got it! It was great working through this with you. I hope you feel good about it - and remember, I'm just a message away if you need me again.",
      "That means a lot, thank you for saying that! I'm genuinely here to help whenever you need. Take care, and don't be a stranger!",
      "Appreciate you saying that! This is exactly what I'm here for. Come back anytime you need to figure out an outfit or just want to chat about style.",
      "Happy to help! I had a good time working through this with you. Remember, style is a journey - I'm here for all of it whenever you need me.",
      "You're welcome! That's really kind of you to say. I'm genuinely glad it helped. Looking forward to helping you again soon!",
      "Of course! It was genuinely fun helping you with this. Don't be a stranger - I'm always here when you need some style support.",
    ] : [
      "Oh, you're so welcome, darling! It genuinely makes me happy to help. Please don't hesitate to reach out whenever you need me - I'm always here for you.",
      "Thank you for those kind words, gorgeous! Helping you feel confident and beautiful is honestly the best part of what I do. Come back anytime!",
      "You're so sweet, thank you! I'm truly glad I could help. My door is always open - please come back whenever you need style advice or just a friendly chat.",
      "Aww, that's so lovely of you to say! It's my absolute pleasure, and I mean that. Reach out anytime - I'm here for you, beautiful.",
      "You're very welcome, love! I really enjoyed helping you with this. Remember, I'm just a message away whenever you need me. Take care of yourself!",
      "It's my genuine pleasure, sweetheart! Helping you shine is what I love doing. Come back anytime - I'll always be here for you.",
      "Oh darling, that warms my heart! I absolutely loved helping you today. Please know you can always come to me for anything style-related. Take care, beautiful!",
      "You're so kind, thank you gorgeous! Working with you has been such a joy. Remember, I'm always here cheering you on. Come back soon, love!",
      "Thank you for those sweet words, beautiful! It truly makes my day knowing I could help. My virtual door is always open for you, sweetheart!",
      "Aww, you're making me smile! It was my absolute honor to help you, darling. Never hesitate to reach out - you're always welcome here, love.",
    ];
    return {
      content: thanksResponses[Math.floor(Math.random() * thanksResponses.length)],
    };
  }
  
  if (isBye && !hasOutfitIntent) {
    const byeResponses = isMaleStylist ? [
      "Take care! It was genuinely great chatting with you. Go out there and own it - you've got this. See you next time!",
      "Later! I really enjoyed helping you out. Remember, style is about feeling good, and I think you're in a great place. Come back anytime!",
      "Catch you later! Thanks for spending some time with me. Go rock that look - I know you'll do great. I'm here whenever you need me!",
      "Take it easy! It was a pleasure. Remember, confidence is the best thing you can wear. Come back soon!",
      "See you! I hope you feel good about what we put together. Have a fantastic time, and reach out whenever you like.",
      "All the best! It was great working with you. You're going to look sharp - I'm certain of it. Don't be a stranger!",
      "Peace out! Really enjoyed our chat. Go knock 'em dead out there - you're all set. Hit me up whenever you need more style help!",
      "Take care of yourself! This was fun. You're going to look great, and I mean that. Come back whenever - I'm always here.",
      "See you around! Thanks for letting me help out today. Wear that outfit with confidence - you've earned it. Don't hesitate to return!",
      "Later! It was genuinely a pleasure. Remember, you've got solid style instincts - trust them. I'm here whenever you need a second opinion.",
    ] : [
      "Goodbye for now, beautiful! It was such a pleasure chatting with you. Go out there and shine - you're going to be absolutely stunning. Come back anytime!",
      "Take care, gorgeous! I truly enjoyed our time together. Remember, you're beautiful inside and out. I'm always here when you need me!",
      "See you soon, lovely! Thank you for spending time with me. Go embrace your day - you're going to look amazing. My door is always open!",
      "Bye for now, darling! It was wonderful helping you. Remember to carry yourself with confidence - it's your most beautiful accessory. Come back soon!",
      "Take care of yourself, sweetheart! I really enjoyed our chat. You're going to look incredible, I just know it. Reach out anytime!",
      "Goodbye, beautiful! Thank you for letting me be part of your style journey. Go shine bright - and remember, I'm always here for you!",
      "Until next time, gorgeous! It was an absolute joy helping you today. Go out and turn heads - you deserve all the compliments coming your way, love!",
      "Farewell for now, darling! Our chat has been delightful. Remember, you are radiant and beautiful. I'll be here whenever you need me, sweetheart!",
      "Bye-bye, lovely! Thank you for brightening my day. Go out there knowing you look absolutely fabulous. Come back soon - I already miss you, gorgeous!",
      "Take care, beautiful soul! It was my pleasure to help you today. Walk with your head held high - you're stunning inside and out. See you soon, love!",
    ];
    return {
      content: byeResponses[Math.floor(Math.random() * byeResponses.length)],
    };
  }
  
  if (isAboutYou && !hasOutfitIntent) {
    const aboutResponses = isMaleStylist ? [
      "I'm Max, your personal AI stylist! I'm genuinely here to help you feel confident and look great. Whether it's putting together outfits for specific occasions, helping you understand what works for your body and style, or just exploring your wardrobe together - that's what I'm about. Add clothes to your digital wardrobe and I can give you personalized recommendations. What would you like to explore?",
      "I'm Max! Think of me as your style partner - someone who's genuinely invested in helping you look and feel your best. I can help you put together outfits, understand color combinations, figure out what to wear for different occasions, and make the most of what's already in your closet. What can I help you with today?",
      "Hey! I'm Max, your AI fashion stylist. My whole purpose is to help you navigate style in a way that feels authentic to you. I'm not here to push trends - I'm here to help you understand what works for YOU. Got any style questions or outfit challenges? I'm all ears.",
      "I'm Max! I'm here to make getting dressed feel easier and more enjoyable. Whether you're preparing for something important or just want to refresh your everyday look, I'm genuinely here to help. Tell me about yourself or what you're looking for, and let's figure it out together.",
      "The name's Max - I'm your personal style consultant! I'm all about helping you build a wardrobe that works for your life and feels authentically you. From casual everyday looks to special occasions, I've got you covered. What's on your style agenda?",
      "I'm Max, here to be your go-to guy for all things fashion! My job is to take the guesswork out of getting dressed. I can help with color coordination, outfit building, occasion dressing - you name it. What style challenge can we tackle together?",
      "Hey there! I'm Max, your AI stylist. Think of me as that friend who's really into fashion and genuinely wants to help you look your best. No judgment here, just practical advice and honest opinions. What can I help you figure out?",
      "I'm Max - basically your personal style coach! I'm here to help you feel confident every time you walk out the door. Whether you need help with a specific event or want to level up your overall look, I'm genuinely excited to help. Where should we start?",
      "Max here! I'm your dedicated fashion advisor, and honestly, I love what I do. I'm here to help you understand your style, put together outfits you feel great in, and make the most of what you've got. What's on your mind today?",
      "I'm Max, your AI stylist! My whole thing is making style feel accessible and enjoyable. I'm not here to make you someone you're not - I'm here to help you express who you already are, just through better outfits. Ready to dive in?",
    ] : [
      "I'm Ruby, your personal AI stylist! I'm truly passionate about helping you feel confident, beautiful, and comfortable in what you wear. Whether it's creating outfits for special moments, exploring what colors and styles work best for you, or simply having a friendly fashion chat - I'm here for all of it. What can I help you with today, gorgeous?",
      "I'm Ruby! Think of me as your personal style bestie - someone who genuinely cares about helping you feel amazing. I can help you discover looks you'll love, put together outfits for any occasion, and make the most of your beautiful wardrobe. I'm all about celebrating your unique style. What would you like to explore together?",
      "Hello, beautiful! I'm Ruby, your AI fashion stylist. My heart is truly in helping you shine. Fashion should be fun and empowering, not stressful - and that's the energy I bring. Whether you need outfit advice, style inspiration, or just someone to chat with about fashion, I'm here for you. What's on your mind?",
      "I'm Ruby! I'm here to be your supportive guide through all things style. Every person has their own beautiful uniqueness, and I love helping people express that through what they wear. Got any style questions or outfit challenges? I'm genuinely excited to help, love.",
      "Hello, gorgeous! I'm Ruby, your personal AI style companion! I absolutely adore helping people discover their best looks and feel confident in their own skin. From everyday outfits to special occasion glamour, I'm here for all of it. What can I help you create today, darling?",
      "I'm Ruby, and I'm so delighted to be your personal stylist! My passion is helping you feel as beautiful on the outside as you are on the inside. Whether it's finding your signature style or putting together the perfect outfit, I'm genuinely here for you. What shall we explore, love?",
      "Ruby here, your dedicated fashion advisor and biggest cheerleader! I believe everyone deserves to feel fabulous, and that's exactly what I'm here to help with. From color analysis to outfit inspiration, I've got you covered, gorgeous. What's on your heart today?",
      "I'm Ruby - think of me as your personal style fairy godmother! I'm here to help you discover outfits that make you feel incredible and confident. Fashion should be joyful, and I'm here to make sure it feels that way for you. Ready to create some magic, beautiful?",
      "Hello, love! I'm Ruby, your AI stylist with a passion for helping you shine! I'm all about celebrating your unique beauty and helping you express yourself through fashion. No matter your style goals, I'm genuinely excited to help you achieve them. What would you like to work on, darling?",
      "I'm Ruby, your personal style confidante! I'm deeply committed to helping you look and feel your absolute best. Whether you need outfit advice, wardrobe organization, or just a friendly fashion chat, I'm always here for you with love and support. What brings you here today, gorgeous?",
    ];
    return {
      content: aboutResponses[Math.floor(Math.random() * aboutResponses.length)],
    };
  }
  
  if (isOffTopic && !hasOutfitIntent) {
    const offTopicResponses = isMaleStylist ? [
      "That's an interesting topic! I appreciate you wanting to chat about it. While that's a bit outside my wheelhouse, I'm always happy to listen if you want to share your thoughts. And of course, whenever you're ready to talk style, I'm right here for that.",
      "I hear you! That's definitely something people are talking about. I may not be the best person to give insights on that specifically, but I'm genuinely interested in hearing your perspective. And when you're ready for some fashion chat, you know where to find me!",
      "Interesting question! I wish I had more expertise there, but that's not really my area. What I can say is I'm here to chat about whatever's on your mind. And whenever style questions come up, that's definitely where I can add value.",
      "That's a fair question! I'm honestly more of a fashion guy than an expert on that topic, but I appreciate you bringing it up. Is there something on your mind you wanted to talk through? I'm here to listen.",
      "I appreciate you sharing that! While I might not have the best insight on that particular topic, I'm genuinely here for the conversation. When you're ready to dive into style stuff, I'd love to help with that too.",
      "Good topic! I'm probably not the most informed person on that, but I'm happy to hear what you think about it. And hey, if outfit questions come up along the way, that's where I really shine.",
      "I get where you're coming from! That's outside my lane, but I'm always open to hearing your thoughts. My strength is really in the fashion department - so when you're ready to talk style, I'm all in.",
      "Interesting stuff! Not gonna pretend I'm an expert there, but I'm happy to listen. Fashion is really my thing though - hit me up whenever you want to work on your look.",
      "That's a valid question! I'm focused on style rather than that topic, but I appreciate you bringing it up. If there's anything clothing or fashion related I can help with, that's where I really come alive.",
      "I hear what you're saying! While I can't offer much insight on that specifically, I'm genuinely here if you want to chat. My specialty is making you look good - so let me know when you're ready to explore that!",
    ] : [
      "That's really interesting, darling! I appreciate you wanting to chat about it. While that's a bit outside my area of expertise, I'm always here to listen if you'd like to share your thoughts. And whenever you're ready for some style talk, I'm absolutely here for you, gorgeous.",
      "I hear you, love! That's definitely been in the conversations lately. I may not be the best person to give deep insights there, but I'm genuinely interested in your perspective. And when you're in the mood for fashion chat, you know I'm here!",
      "Interesting topic, beautiful! I wish I could offer more expertise there, but fashion is really where my heart is. That said, I'm always happy to listen to whatever's on your mind. What are you thinking about it?",
      "That's a fair question, sweetheart! I'm honestly more of a fashion girl than an expert on that, but I appreciate you bringing it up. I'm here to chat about whatever matters to you. And of course, style advice is always available!",
      "I appreciate you sharing that with me, gorgeous! While I might not have the best insight on that particular topic, I'm genuinely here for the conversation. When you're ready to explore some style options together, I'd love that too.",
      "Good topic, darling! I'm probably not the most informed on that specific area, but I'm happy to hear your thoughts. And whenever outfit questions come up, that's absolutely where I can help you shine!",
      "That's fascinating, love! While it's outside my area of expertise, I'm always delighted to listen to what's on your mind. Fashion is truly my passion though - whenever you're ready to explore that, I'm here with open arms, gorgeous!",
      "Interesting question, sweetheart! I'm not the best person for that particular topic, but I genuinely enjoy our chats. My heart is really in helping you look and feel beautiful - shall we explore that when you're ready, darling?",
      "I understand, beautiful! While that's not my specialty, I'm always here to listen. My true calling is fashion and helping you shine - so whenever you'd like to talk style, I'm absolutely ready and excited!",
      "That's a thought-provoking topic, love! Fashion is really where I thrive, but I'm happy to be here for whatever you want to discuss. When you're in the mood for outfit inspiration, just say the word, gorgeous!",
    ];
    return {
      content: offTopicResponses[Math.floor(Math.random() * offTopicResponses.length)],
    };
  }
  
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
  
  if (seemsNegative && !hasOutfitIntent) {
    const supportiveResponses = isMaleStylist ? [
      "Hey, I can tell something's weighing on you, and I just want you to know - that matters. I'm here to listen if you want to talk about it. Sometimes it helps just to get things off your chest. No pressure at all, but I'm here for whatever you need right now.",
      "I hear you, and I'm genuinely sorry you're going through this. Life can be really tough sometimes. I'm not going anywhere - take your time. If you want to talk, I'm listening. If you'd rather focus on something else for a bit, I can help with that too.",
      "That sounds really hard, and I appreciate you sharing that with me. Your feelings are completely valid. I'm here - whether you want to chat about what's happening, or if a distraction would help. Either way, I've got your back.",
      "I'm really sorry to hear you're dealing with this. It takes strength to open up, even a little bit. I want you to know you don't have to face this alone. I'm here for you - whatever you need right now, whether that's talking it through or just having someone to be here.",
      "Hey, that sounds genuinely tough, and I'm sorry you're going through it. Please be kind to yourself - it's okay to not be okay sometimes. I'm here to listen, and there's no judgment here. What would help you most right now?",
      "I can tell things are rough right now, and I want you to know that's completely understandable. Life throws curveballs at all of us. I'm here - no pressure to talk if you don't want to, but know that I've got your back.",
      "That's a lot to carry, and I'm genuinely sorry you're dealing with it. Sometimes just having someone in your corner helps, even if they can't fix things. I'm that person right now - here for whatever you need.",
      "Hey, I see you're going through something, and I just want to say - you're handling it. That might not feel true right now, but it is. I'm here if you want to talk, or if you just need a moment. No judgment, just support.",
      "I appreciate you being open about what you're going through. That takes guts. I'm here for you - whether you want to vent, need a distraction, or just want someone to sit with this alongside you.",
      "Man, that's heavy, and I'm sorry. Please know it's okay to feel whatever you're feeling right now. I'm here to listen, to chat, or just to be present. Whatever helps - I've got you.",
    ] : [
      "Oh sweetheart, I can tell you're going through something difficult, and I want you to know that I'm truly here for you. Your feelings matter, and they're completely valid. Take all the time you need - I'm not going anywhere. Would you like to talk about it, or would a gentle distraction help?",
      "I hear you, beautiful, and my heart goes out to you. Life can be so challenging sometimes. Please know that you're not alone in this - I'm here to listen without any judgment. What would feel most supportive for you right now, love?",
      "Oh darling, that sounds really hard, and I'm so sorry you're experiencing this. Please be gentle with yourself - you're doing the best you can, and that's enough. I'm here for you, whether you want to share more or just need someone to be present with you.",
      "I'm truly sorry to hear you're going through this, gorgeous. Opening up takes courage, and I want you to know it's safe here. Your feelings are valid, and you deserve compassion - especially from yourself. I'm here for whatever you need.",
      "My heart goes out to you, sweetheart. Whatever you're feeling right now is completely okay. Sometimes we just need someone to listen, and I'm genuinely here for that. There's no rush - take your time, and know that I care.",
      "Oh love, I can sense you're hurting, and I wish I could give you a hug. Please know that it's okay to not be okay. I'm here to support you in whatever way feels right - whether that's talking, listening, or just being here with you.",
      "Beautiful soul, I hear the heaviness in your words, and I want you to know you don't have to carry this alone. I'm right here with you, sending you all my warmth and support. What would feel helpful right now, darling?",
      "Oh sweetheart, my heart truly aches for you. Please remember that your feelings are so valid and important. I'm here for you completely - no judgment, just genuine care and support. Take your time, love.",
      "Darling, I can feel that you're going through a storm right now. Please be gentle with yourself - you deserve kindness, especially your own. I'm here to hold space for whatever you need, gorgeous.",
      "Precious one, I'm so sorry you're experiencing this pain. Sometimes life can feel so overwhelming, and that's completely understandable. I'm here for you, surrounding you with warmth and understanding. What can I do to help, love?",
    ];
    return {
      content: supportiveResponses[Math.floor(Math.random() * supportiveResponses.length)],
    };
  }
  
  // GENERAL FASHION KNOWLEDGE - Answer these questions WITHOUT requiring wardrobe data
  const colorMatchPatterns = [
    'blue and green', 'green and blue',
    'blue and brown', 'brown and blue',
    'black and navy', 'navy and black',
    'red and pink', 'pink and red',
    'orange and red', 'red and orange',
    'purple and pink', 'pink and purple',
    'grey and beige', 'beige and grey', 'gray and beige', 'beige and gray',
    'do these colors', 'does this color', 'do these colours', 'does this colour',
    'good match', 'bad match', 'work together', 'go together', 'clash',
    'can i wear', 'should i wear', 'is it ok to wear', 'is it okay to wear',
  ];
  
  const isColorMatchQuestion = colorMatchPatterns.some(p => lowerMessage.includes(p)) ||
    (lowerMessage.includes('match') && (lowerMessage.includes('color') || lowerMessage.includes('colour'))) ||
    (lowerMessage.includes('pair') && (lowerMessage.includes('color') || lowerMessage.includes('colour')));
  
  // Detect specific color mentions for contextual responses
  const colorMentions = {
    blue: lowerMessage.includes('blue'),
    green: lowerMessage.includes('green'),
    red: lowerMessage.includes('red'),
    pink: lowerMessage.includes('pink'),
    orange: lowerMessage.includes('orange'),
    yellow: lowerMessage.includes('yellow'),
    purple: lowerMessage.includes('purple'),
    black: lowerMessage.includes('black'),
    white: lowerMessage.includes('white'),
    brown: lowerMessage.includes('brown'),
    beige: lowerMessage.includes('beige'),
    grey: lowerMessage.includes('grey') || lowerMessage.includes('gray'),
    navy: lowerMessage.includes('navy'),
  };
  
  const mentionedColors = Object.entries(colorMentions).filter(([_, mentioned]) => mentioned).map(([color]) => color);
  const isDateContext = lowerMessage.includes('date') || lowerMessage.includes('romantic') || lowerMessage.includes('dinner');
  const isWorkContext = lowerMessage.includes('work') || lowerMessage.includes('office') || lowerMessage.includes('professional');
  const isCasualContext = lowerMessage.includes('casual') || lowerMessage.includes('everyday') || lowerMessage.includes('weekend');
  
  if (isColorMatchQuestion && mentionedColors.length >= 2) {
    // Specific color pairing advice
    const color1 = mentionedColors[0];
    const color2 = mentionedColors[1];
    
    // Color pairing knowledge base
    const colorPairings: Record<string, Record<string, { works: boolean; advice: string }>> = {
      blue: {
        green: { works: true, advice: "Blue and green absolutely work together - they're analogous colors on the color wheel, creating a harmonious, natural look. For a date, I'd suggest a navy or rich blue with a deep forest green for sophistication, or lighter shades for a fresh, relaxed vibe." },
        brown: { works: true, advice: "Blue and brown is a classic, timeless combination. Think of it like denim and leather - it's a no-brainer. The earthiness of brown grounds the coolness of blue beautifully." },
        white: { works: true, advice: "Blue and white is crisp, clean, and always looks fresh. It's a fail-safe combination that works for any occasion." },
        black: { works: true, advice: "Blue and black can be tricky, but done right it's striking. The key is contrast - pair a bright or light blue with black, avoiding navy with black unless you're going for that intentional tonal look." },
        pink: { works: true, advice: "Blue and pink is a beautiful, unexpected pairing. It's modern and fresh - just balance the intensity of both colors for the best effect." },
        orange: { works: true, advice: "Blue and orange are complementary colors - they create maximum visual impact together. It's bold but balanced, perfect for making a statement." },
        red: { works: true, advice: "Blue and red is classic and patriotic, but also sophisticated when the shades are right. Navy and burgundy is particularly elegant." },
        grey: { works: true, advice: "Blue and grey is understated elegance. It's professional, polished, and universally flattering." },
      },
      green: {
        blue: { works: true, advice: "Green and blue work beautifully together - they're neighboring colors on the color wheel. This combination feels natural and calming, like a forest meeting the sky." },
        brown: { works: true, advice: "Green and brown is an earthy, organic pairing straight from nature. It's grounding, sophisticated, and incredibly easy to wear." },
        white: { works: true, advice: "Green and white is fresh and clean. It's a beautiful combination that feels crisp and natural." },
        pink: { works: true, advice: "Green and pink is a gorgeous, fresh combination - think of roses in a garden. The key is matching the intensity of both colors." },
        orange: { works: true, advice: "Green and orange is bold and energetic. It's nature-inspired and works particularly well in autumn." },
        black: { works: true, advice: "Green and black is sleek and sophisticated. It works for both casual and dressy occasions." },
      },
      red: {
        pink: { works: true, advice: "Red and pink can be gorgeous together if you choose the right tones. Try burgundy with blush, or cherry red with dusty rose for a modern, romantic look." },
        black: { works: true, advice: "Red and black is dramatic, powerful, and incredibly chic. It's perfect for making a bold statement." },
        white: { works: true, advice: "Red and white is crisp and classic. It's fresh, eye-catching, and works beautifully for both casual and formal settings." },
        navy: { works: true, advice: "Red and navy is a sophisticated, preppy combination. It's polished without being boring." },
      },
      black: {
        navy: { works: true, advice: "Black and navy was once considered a faux pas, but it's now embraced in fashion. The trick is intentionality - make sure it looks deliberate, not accidental. Rich, deep navy with jet black looks sleek and modern." },
        white: { works: true, advice: "Black and white is the most classic combination in fashion. It's timeless, elegant, and works for literally any occasion." },
        brown: { works: true, advice: "Black and brown is absolutely acceptable now - it's rich and sophisticated. Just ensure there's enough contrast between the shades." },
      },
    };
    
    let colorAdvice = '';
    const pairing = colorPairings[color1]?.[color2] || colorPairings[color2]?.[color1];
    
    if (pairing) {
      colorAdvice = pairing.advice;
      if (isDateContext) {
        colorAdvice += " For a date specifically, this combination can definitely work to make you look put-together and stylish.";
      } else if (isWorkContext) {
        colorAdvice += " For work, just ensure the shades are polished and professional.";
      }
    } else {
      colorAdvice = `${color1.charAt(0).toUpperCase() + color1.slice(1)} and ${color2} can definitely work together! The key is balancing the tones and intensities. Neutral colors like black, white, or beige can help bridge more contrasting combinations.`;
      if (isDateContext) {
        colorAdvice += " For a date, confidence is what really makes an outfit work - if you feel good in it, you'll look good in it.";
      }
    }
    
    const colorMatchResponses = isMaleStylist ? [
      `Great question! ${colorAdvice}`,
      `I love that you're thinking about color coordination - it makes such a difference. ${colorAdvice}`,
      `Absolutely a fair question to ask! ${colorAdvice}`,
      `${colorAdvice} The fact that you're thinking about this shows good style instincts.`,
    ] : [
      `What a lovely question, gorgeous! ${colorAdvice}`,
      `I adore that you're thinking about color coordination, darling! ${colorAdvice}`,
      `Such a great question, beautiful! ${colorAdvice}`,
      `${colorAdvice} You clearly have wonderful style instincts, love!`,
    ];
    
    return { content: colorMatchResponses[Math.floor(Math.random() * colorMatchResponses.length)] };
  }
  
  // General fashion advice questions that don't need wardrobe
  const generalFashionPatterns = [
    'what colors go with', 'what colour goes with', 'what colors match', 'what colours match',
    'best colors for', 'best colours for', 'what to wear to', 'what should i wear to',
    'is it appropriate to wear', 'can you wear', 'dress code for', 'outfit for',
    'how do i style', 'tips for dressing', 'fashion advice', 'style advice',
    'smart casual', 'business casual', 'black tie', 'cocktail attire',
    'what goes with', 'how to accessorize', 'how to accessorise',
  ];
  
  const isGeneralFashionQuestion = generalFashionPatterns.some(p => lowerMessage.includes(p));
  
  if (isGeneralFashionQuestion) {
    // Contextual fashion advice for occasions
    if (isDateContext) {
      const dateAdvice = isMaleStylist ? [
        "For a date, the goal is to look put-together without trying too hard. Fitted clothes in darker or richer colors tend to photograph well and look sophisticated. A well-fitted button-up with nice jeans or chinos, quality shoes, and minimal accessories is a solid foundation. The key is confidence - wear something you feel good in.",
        "Date night outfits work best when they're a polished version of your everyday style. You want to look like yourself, just a bit elevated. Stick to clothes that fit well, colors that flatter you, and make sure you're comfortable - nothing kills a vibe like constantly adjusting your clothes.",
        "Here's my date night formula: one statement piece (like a great jacket or interesting shirt), neutral supporting pieces, and clean, quality footwear. Avoid anything too complicated - simplicity often reads as confidence and style.",
      ] : [
        "For a date, darling, you want to feel like the best version of yourself! Rich colors, elegant silhouettes, and details that make you feel special all work beautifully. A gorgeous dress or a lovely top with well-fitted jeans - whatever makes you feel confident and radiant.",
        "Date night is all about feeling beautiful and comfortable, gorgeous! I'd suggest something that flatters your figure without being too revealing, in colors that make your skin glow. A touch of sparkle or a beautiful accessory can elevate the whole look.",
        "Here's my secret for date outfits, love: wear something that makes YOU feel amazing. When you feel beautiful, it shows in everything from your posture to your smile. Comfort matters too - you want to focus on the moment, not fidgeting with your clothes!",
      ];
      return { content: dateAdvice[Math.floor(Math.random() * dateAdvice.length)] };
    }
    
    if (isWorkContext) {
      const workAdvice = isMaleStylist ? [
        "Professional dressing is about projecting competence while expressing your personal style within appropriate boundaries. Stick to well-fitted pieces in neutral or muted colors, quality fabrics, and minimal patterns. A good blazer, crisp shirts, and well-tailored trousers are your foundation.",
        "For work, the formula is pretty straightforward: fit is everything, neutrals are your friends, and quality matters more than quantity. Make sure your clothes are clean, pressed, and well-maintained. Small details like good shoes and a nice watch speak volumes.",
        "Work style should make you feel confident and capable. Start with classic pieces - blazers, button-downs, tailored pants - and build from there. The goal is looking polished without being distracting from the work itself.",
      ] : [
        "Professional style is about feeling powerful and put-together, gorgeous! Quality fabrics, good tailoring, and a cohesive color palette will take you far. A beautiful blazer, elegant blouses, and well-fitted trousers or skirts form a perfect foundation.",
        "For work, darling, aim for polished sophistication. Structured pieces, quality fabrics, and thoughtful accessories make all the difference. You want to command respect while still expressing your beautiful personal style.",
        "Work wardrobe essentials include tailored blazers, elegant blouses, well-fitted bottoms, and quality shoes, love. Stick to a cohesive color palette and invest in pieces that make you feel both professional and fabulous!",
      ];
      return { content: workAdvice[Math.floor(Math.random() * workAdvice.length)] };
    }
  }
  
  // Fashion knowledge questions (history, trends, iconic moments) - answer naturally
  // These should NEVER trigger wardrobe checks - they're about fashion education
  if (isFashionKnowledge) {
    const fashionKnowledgeResponses = isMaleStylist ? [
      "That's a great fashion question! I love talking about this stuff. Let me share what I know...",
      "Oh interesting topic! Fashion history is fascinating. Here's my take on it...",
      "Great question - this is actually something I find really interesting. Let me break it down for you...",
      "I appreciate you asking about this! Fashion trends and their origins are always worth exploring. Here's what I can tell you...",
      "That's something I genuinely enjoy discussing! Fashion has such rich history and meaning behind it...",
    ] : [
      "Oh, I love this question, gorgeous! Fashion history and trends are so fascinating to explore. Let me share what I know...",
      "What a wonderful thing to ask about, darling! The stories behind fashion are so beautiful. Here's my perspective...",
      "I adore discussing fashion like this, love! There's so much depth and meaning in these trends. Let me tell you...",
      "Such a lovely question, beautiful! Fashion is more than just clothes - it's culture, history, and expression. Here's what I can share...",
      "Oh, this makes my heart happy, gorgeous! I love when we can explore the deeper side of fashion together...",
    ];
    return { content: fashionKnowledgeResponses[Math.floor(Math.random() * fashionKnowledgeResponses.length)] };
  }
  
  // CATCH-ALL CONVERSATIONAL RESPONSE - Handle ANY message that doesn't have outfit intent
  // This ensures stylists build relationships and answer questions BEFORE checking wardrobe
  // Wardrobe checks should ONLY happen when user specifically asks for outfit suggestions
  if (!hasOutfitIntent) {
    // The user is asking something conversational - engage with them!
    // This covers: casual chat, questions about life/relationships/politics/anything, 
    // random topics, getting to know each other, etc.
    
    const conversationalResponses = isMaleStylist ? [
      "That's a great question! I appreciate you wanting to chat about it. I'm genuinely happy to talk through things with you - that's part of what makes our connection real. What's on your mind about it?",
      "I hear you! I'm always up for a good conversation, whether it's about style or life in general. Tell me more about what you're thinking.",
      "That's interesting! I love that we can chat about anything. Building a relationship goes beyond just fashion - it's about getting to know each other. What's your take on it?",
      "Good question! I'm here for whatever's on your mind. Sometimes the best conversations happen when we just let them flow naturally. What are you feeling about that?",
      "I appreciate you sharing that with me. Part of being a good stylist is understanding who you are as a person - your thoughts, your life, what matters to you. So I'm all ears.",
      "That's a fair point to bring up! I may be a fashion guy at heart, but I'm genuinely interested in getting to know you. What else is on your mind?",
      "You know what? I appreciate that you feel comfortable bringing that up with me. It's these kinds of conversations that help me understand you better. Tell me more.",
      "I'm listening! Sometimes the most interesting conversations have nothing to do with clothes. What's going on with you?",
      "I like that you're sharing your thoughts with me. Getting to know each other is important - it helps me understand your vibe beyond just what you wear. What's up?",
      "That's the kind of thing I appreciate you bringing up. Our conversations help me understand who you are, and that makes me a better stylist for you. What's your perspective?",
    ] : [
      "Oh, I love that you're sharing this with me, gorgeous! These conversations help me understand you as a person, not just your style. Tell me more, darling.",
      "That's such an interesting thing to bring up, beautiful! I'm always here to chat about whatever's on your heart. What's your feeling about it?",
      "I appreciate you opening up to me, love! Getting to know you beyond fashion is what makes our relationship special. What else is on your mind?",
      "That's a lovely question, sweetheart! Part of what makes me a good stylist is understanding who you truly are. I'm genuinely interested - tell me more.",
      "Oh darling, I love that we can talk about anything! These kinds of conversations help me connect with you on a deeper level. What's going on with you?",
      "That's something I genuinely appreciate you sharing, gorgeous! Understanding your thoughts and feelings helps me be a better friend and stylist to you. What are you thinking?",
      "I'm so glad you feel comfortable bringing that up with me, beautiful! Our chats about life are just as important as our style conversations. What's on your heart?",
      "Oh, I love this! These conversations are what make our connection real, darling. Tell me what's been on your mind.",
      "That's wonderful that you're sharing this with me, love! I treasure these moments where we can just be ourselves and chat. What's your take on it?",
      "I'm here for whatever you want to talk about, gorgeous! Whether it's fashion or life, I'm genuinely interested in you. What would you like to explore?",
    ];
    
    return { content: conversationalResponses[Math.floor(Math.random() * conversationalResponses.length)] };
  }
  
  // FROM HERE ON: User has outfit intent - now we can check wardrobe status
  const ownedItems = wardrobeItems.filter(item => !item.origin || item.origin === 'owned');
  const inspirationItems = wardrobeItems.filter(item => item.origin === 'inspiration');
  const wishlistItems = wardrobeItems.filter(item => item.origin === 'wishlist');
  
  const tops = ownedItems.filter(item => item.category === 'tops');
  const bottoms = ownedItems.filter(item => item.category === 'bottoms');
  const dresses = ownedItems.filter(item => item.category === 'dresses');
  const outerwear = ownedItems.filter(item => item.category === 'outerwear');
  const shoes = ownedItems.filter(item => item.category === 'shoes');
  const accessories = ownedItems.filter(item => item.category === 'accessories');
  
  const hasWardrobe = wardrobeItems.length > 0;
  const hasOwnedItems = ownedItems.length > 0;
  const hasInspirationItems = inspirationItems.length > 0;
  const hasWishlistItems = wishlistItems.length > 0;
  
  if (!hasOwnedItems && (hasInspirationItems || hasWishlistItems)) {
    const inspirationOnlyResponses = isMaleStylist ? [
      `I love that you've already saved ${inspirationItems.length + wishlistItems.length} inspiration pieces - that shows you've got great taste! To help you create outfits, I'd need to know what you actually have in your closet. Once you add some items you own, I can help you recreate those saved looks with your real wardrobe. Ready to add some pieces?`,
      `Nice work saving ${inspirationItems.length + wishlistItems.length} inspiration pieces! That's a solid foundation for understanding your style. The next step is to add items you already own - then I can start showing you how to achieve those looks with what's in your closet. Want to get started?`,
      `You've got ${inspirationItems.length + wishlistItems.length} saved inspiration pieces - that's awesome! It tells me a lot about your style direction. Now, to actually put outfits together, I'll need to see what's in your closet. Add some items you own, and we'll make those inspirations a reality.`,
      `${inspirationItems.length + wishlistItems.length} inspiration pieces saved - solid start! You clearly know what you like. The next move is adding clothes you actually own so I can help you recreate these vibes with your real wardrobe. Ready to show me what you're working with?`,
      `I can see you've been curating some great inspiration - ${inspirationItems.length + wishlistItems.length} pieces! Now I need to know what you've got in your closet to bridge the gap between inspiration and reality. Add some items you own, and let's start building looks.`,
      `${inspirationItems.length + wishlistItems.length} saved pieces tell me you've got vision. Love it! To help you actually wear outfits like these, I'll need to see your wardrobe. Once you add some owned items, I can show you how to get these looks with what you have.`,
      `Great eye for style - ${inspirationItems.length + wishlistItems.length} inspiration pieces saved! Now let's make them wearable. Add some clothes you actually own, and I'll help you create outfits that capture that same energy. Sound good?`,
      `You're building a nice inspiration collection - ${inspirationItems.length + wishlistItems.length} pieces so far! The exciting part comes when we connect these to your real wardrobe. Add some items you own, and I'll show you how to bring these looks to life.`,
      `I see ${inspirationItems.length + wishlistItems.length} inspiration pieces - you've got taste! But to create actual outfits, I need to know what's in your closet. Add your owned items, and together we'll recreate these looks with what you have.`,
      `${inspirationItems.length + wishlistItems.length} saved pieces show you know what you like - that's half the battle! Now let's add your actual clothes so I can help you achieve these looks. Ready to build your digital wardrobe?`,
    ] : [
      `Oh wonderful, you've already saved ${inspirationItems.length + wishlistItems.length} beautiful inspiration pieces! That tells me you have lovely taste, gorgeous. To help you create real outfits, I'd love to see what you already own. Once you add some pieces from your closet, I can show you how to bring those inspirations to life. Shall we start?`,
      `I see you've got ${inspirationItems.length + wishlistItems.length} gorgeous inspiration pieces saved - you clearly have an eye for style, darling! The exciting next step is adding items you already own. Then I can help you recreate those looks with your actual wardrobe. Ready to add some pieces, love?`,
      `How exciting - ${inspirationItems.length + wishlistItems.length} beautiful inspiration pieces! You have such wonderful taste, gorgeous. Now, to transform these dreams into reality, I'd love to see what treasures are in your closet. Add some pieces you own, and we'll create magic together!`,
      `${inspirationItems.length + wishlistItems.length} saved inspirations - you're clearly someone who appreciates beautiful style, darling! The next step in our journey is adding items you already own. Then I can show you how to achieve these gorgeous looks with your real wardrobe, love.`,
      `I'm so impressed - ${inspirationItems.length + wishlistItems.length} inspiration pieces that show such lovely taste! To help you actually wear outfits like these, I need to see your wardrobe, beautiful. Add some pieces you own, and let's bring these inspirations to life together!`,
      `What a wonderful collection you're building - ${inspirationItems.length + wishlistItems.length} beautiful inspiration pieces, gorgeous! Now let's connect these dreams to reality. Add some clothes you own, and I'll show you how to capture that same stunning energy.`,
      `You've saved ${inspirationItems.length + wishlistItems.length} gorgeous inspiration pieces - your style vision is beautiful, darling! The exciting part is making these looks wearable. Add items from your closet, and together we'll recreate these looks with what you have, love.`,
      `Oh, ${inspirationItems.length + wishlistItems.length} inspiration pieces - you have such exquisite taste, sweetheart! To turn these beautiful ideas into outfits you can wear, I need to see your wardrobe. Add some pieces you own, and let's make fashion magic!`,
      `I can see you've been curating beauty - ${inspirationItems.length + wishlistItems.length} lovely inspiration pieces! Now let's bridge the gap to your real wardrobe, gorgeous. Add items you own, and I'll help you achieve these stunning looks, darling.`,
      `${inspirationItems.length + wishlistItems.length} saved inspirations tell me you have wonderful style instincts, beautiful! The next step is showing me what you own. Once you add your wardrobe pieces, I can help you recreate these gorgeous looks. Ready to start, love?`,
    ];
    return { content: inspirationOnlyResponses[Math.floor(Math.random() * inspirationOnlyResponses.length)] };
  }
  
  if (!hasWardrobe) {
    const emptyWardrobeResponses = isMaleStylist ? [
      "I'm excited to help you out, but I notice your digital wardrobe is empty at the moment. Once you add some of your clothes here - just snap a few photos - I can start creating personalized outfit suggestions just for you. It's pretty straightforward to get started. Would you like to add some pieces?",
      "Great to have you here! Your wardrobe is ready to be filled with your favorite pieces. Take some photos of your clothes and add them, and I'll help you discover outfit combinations you might not have thought of. It's actually pretty fun once you get going!",
      "I'd love to dive into styling for you! First though, we'll need to build out your digital wardrobe. Add some of your clothes by taking photos, and I'll take it from there. The more you add, the better suggestions I can give. Ready to start?",
      "Perfect timing to get started! Your wardrobe is a blank canvas right now, which means we get to build it together. Snap some photos of your favorite pieces, and I'll help you put together looks you'll genuinely feel good in.",
      "Hey! Your digital wardrobe is waiting for you to fill it up. Once you add some clothes - tops, bottoms, shoes, whatever you've got - I can start putting together outfit ideas tailored specifically to you. Ready to get started?",
      "Good news - you're starting fresh! Add some of your favorite clothes by taking photos, and I'll help you see your wardrobe in a whole new way. The more you add, the better I can help. What do you say?",
      "I'm ready to help you build an awesome wardrobe experience! Right now it's empty, but that just means we're starting from a clean slate. Add some pieces, and let's discover what combinations work best for you.",
      "Your wardrobe space is all set up and ready for action! Just snap photos of your clothes and add them here. Once I can see what you're working with, I'll help you put together looks that fit your style and life.",
      "First things first - let's fill up your digital closet! Add some of your go-to pieces, and I'll start showing you outfit combinations that'll make getting dressed way easier. It's actually a pretty satisfying process.",
      "Looks like we're starting with a clean slate - perfect! Add your clothes by taking photos, and I'll help you unlock outfit combinations you might not have considered. The more you add, the more possibilities we have to explore.",
    ] : [
      "I'm so excited to help you, gorgeous! I notice your digital wardrobe is empty at the moment. Once you add some of your beautiful clothes here - just snap a few photos - I can start creating personalized outfit magic just for you. Ready to get started, love?",
      "Welcome, beautiful! Your wardrobe is ready and waiting to be filled with your lovely pieces. Take some photos of your clothes and add them here, and I'll help you discover stunning combinations you might never have considered. This is going to be fun!",
      "I'd absolutely love to dive into styling for you, darling! First though, we'll need to build out your digital wardrobe together. Add some of your clothes by taking photos, and watch the outfit possibilities unfold. The more you add, the more magic we can create!",
      "Oh, this is exciting - we get to build your wardrobe from scratch together! Right now it's empty, but once you start adding your beautiful pieces, I can help you see your clothes in a whole new way. Shall we begin, gorgeous?",
      "Hello, beautiful soul! Your digital wardrobe is a blank canvas waiting for your gorgeous pieces. Just snap some photos of your clothes, and I'll help you discover outfit combinations that will make you feel absolutely stunning. Ready to start, love?",
      "I'm thrilled to help you, darling! First, let's fill your wardrobe with all your lovely clothes. Take some photos of your favorite pieces, and together we'll create outfit magic. The more you add, the more we can play with, gorgeous!",
      "Oh sweetheart, I'm so ready to style you! Your digital closet is waiting to be filled with your beautiful wardrobe. Add some pieces, and I'll show you combinations that will make getting dressed feel exciting and effortless. Shall we?",
      "Welcome to your style journey, gorgeous! Your wardrobe space is ready for your lovely clothes. Snap some photos of your pieces, and I'll help you see them in wonderful new ways. This is going to be such fun, love!",
      "I'm absolutely delighted to be your stylist, beautiful! Let's start by filling your digital wardrobe with your treasures. Take photos of your clothes, and watch as I help you create stunning outfit possibilities. Ready to begin, darling?",
      "How exciting, gorgeous - we get to build your wardrobe together from the very beginning! Add your beautiful pieces by taking photos, and I'll show you outfit combinations that celebrate your unique style. Let's create something wonderful, love!",
    ];
    return {
      content: emptyWardrobeResponses[Math.floor(Math.random() * emptyWardrobeResponses.length)],
    };
  }
  
  if (hasInspirationIntent && hasInspirationItems) {
    const randomInspiration = inspirationItems[Math.floor(Math.random() * inspirationItems.length)];
    const matchingOwned = ownedItems.filter(item => 
      item.color === randomInspiration.color || 
      item.occasions.some(o => randomInspiration.occasions.includes(o))
    );
    
    let inspirationResponse = '';
    
    if (hasOwnedItems && matchingOwned.length > 0) {
      inspirationResponse = isMaleStylist 
        ? `Nice - you've got ${inspirationItems.length} inspiration piece${inspirationItems.length > 1 ? 's' : ''} saved! Let's work with your "${randomInspiration.name}" inspiration.\n\nLooking at what you own, here are some solid pairing options:\n`
        : `How lovely - you've saved ${inspirationItems.length} beautiful inspiration piece${inspirationItems.length > 1 ? 's' : ''}! Let's explore your "${randomInspiration.name}" inspiration together, gorgeous.\n\nFrom your wardrobe, here are some wonderful pairing possibilities:\n`;
      
      matchingOwned.slice(0, 3).forEach((item, index) => {
        inspirationResponse += isMaleStylist
          ? `${index + 1}. Your ${item.name} would work really well with this vibe\n`
          : `${index + 1}. Your gorgeous ${item.name} would complement this beautifully, love\n`;
      });
      
      inspirationResponse += isMaleStylist
        ? `\nWant me to put together a complete outfit inspired by this look using pieces from your closet?`
        : `\nShall I create a complete outfit inspired by this look using your beautiful pieces, darling?`;
    } else if (hasOwnedItems) {
      inspirationResponse = isMaleStylist
        ? `You've got ${inspirationItems.length} inspiration piece${inspirationItems.length > 1 ? 's' : ''} saved - nice taste! Your "${randomInspiration.name}" is solid inspiration. I couldn't find exact matches in what you own right now, but that's actually useful information. It shows you what direction you might want to shop in, or what pieces to add to build toward this look.\n\nWould you like suggestions on what types of pieces would help you recreate this style?`
        : `You've saved ${inspirationItems.length} lovely inspiration piece${inspirationItems.length > 1 ? 's' : ''}! Your "${randomInspiration.name}" is absolutely gorgeous inspiration, darling. While I couldn't find exact matches in your current wardrobe, this is actually helpful - it shows us what direction might inspire your next additions.\n\nWould you like suggestions on what types of pieces would help bring this vision to life, love?`;
    } else {
      inspirationResponse = isMaleStylist
        ? `You've got ${inspirationItems.length} inspiration piece${inspirationItems.length > 1 ? 's' : ''} saved - that's a great start for understanding your style direction. Once you add items you actually own, I can help you recreate these looks or find similar combinations with what's in your closet.\n\nQuick tip: Use the AI scan feature to easily add screenshots of items you find online!`
        : `You've saved ${inspirationItems.length} beautiful inspiration piece${inspirationItems.length > 1 ? 's' : ''} - that tells me you have wonderful taste, gorgeous! Once you add items you own, I can help you bring these inspirations to life with your actual wardrobe.\n\nLittle tip, darling: Use the AI scan feature to easily add screenshots of items you discover online!`;
    }
    
    return { content: inspirationResponse };
  }
  
  if (hasInspirationIntent && hasWishlistItems) {
    let wishlistResponse = '';
    
    if (hasOwnedItems) {
      wishlistResponse = isMaleStylist
        ? `You've got ${wishlistItems.length} item${wishlistItems.length > 1 ? 's' : ''} on your wishlist - let me show you how these would work with what you already own:\n\n`
        : `Oh lovely, you have ${wishlistItems.length} gorgeous item${wishlistItems.length > 1 ? 's' : ''} on your wishlist! Let me show you how beautifully these would complement your current wardrobe, darling:\n\n`;
      
      wishlistItems.slice(0, 3).forEach((item, index) => {
        const complementaryOwned = ownedItems.filter(o => 
          o.occasions.some(occ => item.occasions.includes(occ))
        );
        wishlistResponse += isMaleStylist
          ? `${index + 1}. "${item.name}" would pair nicely with ${complementaryOwned.length} of your current pieces\n`
          : `${index + 1}. "${item.name}" would pair beautifully with ${complementaryOwned.length} of your lovely pieces\n`;
      });
      
      wishlistResponse += isMaleStylist
        ? `\nThese would definitely expand your outfit options. Smart choices!`
        : `\nThese additions would open up so many beautiful new outfit possibilities for you, gorgeous!`;
    } else {
      wishlistResponse = isMaleStylist
        ? `You have ${wishlistItems.length} item${wishlistItems.length > 1 ? 's' : ''} on your wishlist - solid picks for building out your wardrobe! Once you add items you currently own, I can show you exactly how these wishlist pieces would work with your existing style.`
        : `You have ${wishlistItems.length} lovely item${wishlistItems.length > 1 ? 's' : ''} on your wishlist - beautiful choices, darling! Once you add items you currently own, I can show you how these wishlist treasures would complement your existing wardrobe perfectly.`;
    }
    
    return { content: wishlistResponse };
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
    
    const colorAdvice = isMaleStylist
      ? `Looking at your wardrobe, your go-to colors are definitely ${dominantColors.join(', ')}. That's actually a solid foundation to work with! Your ${dominantColors[0]} pieces would look great paired with neutral tones like white, cream, or black for a clean, pulled-together look. If you're feeling a bit more adventurous, you could create some contrast with complementary colors - it makes a statement. Or if you want something more refined and intentional, try going monochromatic with different shades of the same color family. What vibe are you going for? I can put together something specific if you tell me the occasion.`
      : `Looking at your beautiful wardrobe, I can see you're drawn to ${dominantColors.join(', ')} - and honestly, that tells me you have lovely taste, gorgeous! Your ${dominantColors[0]} pieces pair beautifully with neutral tones like white, cream, or black for an elegant everyday look. If you want to make more of a statement, playing with complementary colors creates a gorgeous contrast that really turns heads. Or for something truly sophisticated, you could go monochromatic with different shades of the same color family - it's incredibly chic. What kind of look are you hoping to create, darling? Tell me the occasion and I'll put together something perfect for you.`;
    
    return { content: colorAdvice };
  }
  
  if (hasOutfitIntent) {
    
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
    
    let favoritesResponse = '';
    
    if (isMaleStylist) {
      if (favorites.length > 0 && mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `I've been looking at your wardrobe patterns, and here's what stands out: your favorite pieces are ${favorites.map(f => f.name).join(', ')}. And when it comes to what you actually reach for most, it's ${mostWorn[0].name} at the top with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, followed by ${mostWorn[1].name}` : ''}. That tells me a lot about your style preferences. Want me to put together some outfit ideas featuring these pieces you clearly love?`;
      } else if (favorites.length > 0) {
        favoritesResponse = `I can see you've marked ${favorites.map(f => f.name).join(', ')} as your favorites - good choices! These are clearly pieces you feel great in. Would you like me to show you some fresh ways to style them, or put together outfits that feature them?`;
      } else if (mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `Looking at your wear history, ${mostWorn[0].name} is definitely your go-to piece with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, and ${mostWorn[1].name} comes in second` : ''}. There's a reason you keep reaching for these - they clearly work for you. Want me to build some outfits around your most-loved items?`;
      } else {
        favoritesResponse = `You haven't marked any favorites yet or logged any wears, so I don't have a clear picture of your go-to pieces. Try marking items you love as favorites, or log when you wear something - that'll help me understand your style better and give you more personalized suggestions.`;
      }
    } else {
      if (favorites.length > 0 && mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `I've been admiring your wardrobe patterns, gorgeous, and here's what I've noticed: your heart belongs to ${favorites.map(f => f.name).join(', ')}. And the pieces you reach for most? ${mostWorn[0].name} leads the way with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, with ${mostWorn[1].name} close behind` : ''}. These clearly make you feel wonderful, darling. Would you love some fresh outfit ideas featuring these treasured pieces?`;
      } else if (favorites.length > 0) {
        favoritesResponse = `I see you've marked ${favorites.map(f => f.name).join(', ')} as your favorites - such lovely choices, gorgeous! These are clearly pieces that make you feel beautiful. Would you like me to show you some new ways to style them, or create stunning outfits around them, darling?`;
      } else if (mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `Looking at your wear history, beautiful, ${mostWorn[0].name} is clearly your beloved go-to with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, and ${mostWorn[1].name} follows lovingly behind` : ''}. There's magic in pieces you keep reaching for - they truly work for you, darling. Shall I create some gorgeous outfits around your most-loved items?`;
      } else {
        favoritesResponse = `You haven't marked any favorites yet or logged any wears, sweetheart, so I don't quite know which pieces hold your heart. Try marking items you adore as favorites, or log when you wear something - that'll help me understand your beautiful style better and give you the personalized suggestions you deserve, love.`;
      }
    }
    
    return { content: favoritesResponse };
  }
  
  const fallbackResponses = isMaleStylist ? [
    `I'm genuinely here to help you figure out what works for you. What's the situation? Are you getting ready for something specific - maybe work, a date, a party, or just refreshing your everyday style? Or if you're curious about color combinations or want to know which pieces in your wardrobe work best together, I'm all over that too. With ${wardrobeItems.length} ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} in your closet, we've got plenty to work with.`,
    `What's on your mind style-wise? I can help you put together looks for specific occasions, figure out what colors work best together, or just explore what's in your wardrobe. Tell me what you're thinking - are you trying to get ready for something, or just want to see what outfit options you have? I'm here for whatever you need.`,
    `So what are we working on today? I can help with outfit ideas for any occasion you've got coming up, color coordination, or just making the most of the ${wardrobeItems.length} ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} you have. Give me some context about what you're looking for and I'll tailor my suggestions to exactly what you need.`,
    `I'm ready when you are! Whether you need help with an outfit for something specific, want to explore color combinations, or just want to see fresh ways to style what you own - I've got you. What sounds helpful right now?`,
    `Let's figure something out together. What's your situation? Getting ready for work, a special event, or just want to level up your everyday look? I can also help with color advice or finding new ways to wear your favorite pieces. What would be most useful for you?`,
  ] : [
    `I'm absolutely here for whatever you need, gorgeous! What's on your mind? Are you getting ready for something special - work, a date, a party, or maybe a lovely casual day out? Or if you're curious about which colors in your wardrobe complement each other beautifully, I'd love to explore that with you. With ${wardrobeItems.length} gorgeous ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} to work with, we can create some truly stunning looks together, darling.`,
    `What would you like to explore today, beautiful? I can help you put together outfits for any occasion, figure out which colors make you absolutely glow, or discover new ways to style your favorite pieces. Just tell me what's on your heart - are you preparing for something, or simply in the mood to play with your wardrobe? I'm here for all of it, love.`,
    `Tell me what's on your mind, sweetheart! Whether it's finding the perfect outfit for an upcoming event, exploring color combinations that flatter you, or just making the most of your beautiful ${wardrobeItems.length} ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} - I'm genuinely excited to help. What sounds good to you?`,
    `I'm all yours, gorgeous! What can I help you with today? Maybe an outfit for something special coming up, advice on colors that work beautifully together, or fresh ways to style pieces you already love? Just share what you're thinking and we'll create something wonderful together.`,
    `What's calling to you right now, darling? I can help with outfit ideas for any occasion - work, dates, parties, everyday elegance - or we could explore color coordination and how to get the most from your wardrobe. Tell me your heart's desire and let's make it happen, love.`,
  ];
  
  return {
    content: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
  };
}

export default function AIStylistScreen() {
  const { theme } = useTheme();
  const { limits, tier } = useSubscription();
  const { items: wardrobeItems } = useWardrobe();
  const { user } = useAuth();
  const { settings: voiceSettings, getVoiceForStylist } = useVoiceSettings();
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const ttsPlayerRef = useRef<Audio.Sound | null>(null);
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
      cancelAnimation(pulseScale);
      waveformBars.forEach((bar) => cancelAnimation(bar));
      stopRecording(true);
      stopTTSPlayback();
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

  const playTTSAudio = async (text: string) => {
    if (!ttsEnabled || !voiceSettings.ttsEnabled || Platform.OS === 'web') return;
    
    try {
      setIsPlayingTTS(true);
      
      if (ttsPlayerRef.current) {
        await ttsPlayerRef.current.stopAsync();
        await ttsPlayerRef.current.unloadAsync();
        ttsPlayerRef.current = null;
      }

      const voiceId = getVoiceForStylist(stylist.id as 'ruby' | 'max');
      
      const response = await apiService.createVoiceResponse({
        textResponse: text,
        stylistId: stylist.id,
        speed: voiceSettings.voiceSpeed,
        voice: voiceId,
        language: voiceSettings.preferredLanguage,
      });

      if (response.success && response.audio?.audioBuffer) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mp3;base64,${response.audio.audioBuffer}` },
          { shouldPlay: true }
        );
        ttsPlayerRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingTTS(false);
            sound.unloadAsync();
            ttsPlayerRef.current = null;
          }
        });
      } else {
        setIsPlayingTTS(false);
      }
    } catch (error) {
      console.log('TTS playback failed:', error);
      setIsPlayingTTS(false);
    }
  };

  const stopTTSPlayback = async () => {
    try {
      if (ttsPlayerRef.current) {
        await ttsPlayerRef.current.stopAsync();
        await ttsPlayerRef.current.unloadAsync();
        ttsPlayerRef.current = null;
      }
      setIsPlayingTTS(false);
    } catch (error) {
      console.log('Error stopping TTS:', error);
      setIsPlayingTTS(false);
    }
  };

  const convertAudioToBase64 = async (uri: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') return null;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return base64;
    } catch (error) {
      console.error('Failed to convert audio to base64:', error);
      return null;
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
        if (!canAskAgain && (Platform.OS as string) !== 'web') {
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
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      if ((Platform.OS as string) !== 'web') {
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

    setIsTranscribing(true);
    let transcribedText = '';

    try {
      const audioBase64 = await convertAudioToBase64(uri);
      
      if (audioBase64) {
        const transcribeResponse = await apiService.transcribeAudio(
          audioBase64,
          voiceSettings.preferredLanguage
        );
        
        if (transcribeResponse.success && transcribeResponse.text) {
          transcribedText = transcribeResponse.text;
        }
      }
    } catch (error) {
      console.log('Transcription failed, using fallback:', error);
    } finally {
      setIsTranscribing(false);
    }

    const displayText = transcribedText || 'Voice message';
    const messageToSend = transcribedText || 'I just sent you a voice message about my style needs. Please help me with outfit suggestions.';

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: displayText,
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
        userMessage: messageToSend,
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

      if (voiceSettings.autoPlayResponses) {
        playTTSAudio(response.content);
      }

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

      if (voiceSettings.autoPlayResponses) {
        playTTSAudio(responseContent);
      }

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
      
      if (voiceSettings.autoPlayResponses && ttsEnabled) {
        playTTSAudio(supportiveResponse);
      }
      
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
      
      if (voiceSettings.autoPlayResponses && ttsEnabled) {
        playTTSAudio(response.content);
      }
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.log('API call failed, using fallback:', error);
      const response = generateAIResponse(text, wardrobeItems, user?.gender || 'unspecified', stylist.name);
      
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
      
      if (voiceSettings.autoPlayResponses && ttsEnabled) {
        playTTSAudio(response.content);
      }
      
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
          <LinearGradient
            colors={stylist.id === 'ruby' ? [LUXURY_COLORS.rose, LUXURY_COLORS.berry] : stylist.id === 'max' ? [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] : stylist.id === 'ace' ? [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] : [LUXURY_COLORS.coral, '#C46A4F']}
            style={styles.avatarContainer}
          >
            <Feather name={stylist.icon} size={16} color={stylist.id === 'ace' ? LUXURY_COLORS.midnight : "#FFFFFF"} />
          </LinearGradient>
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
          <LinearGradient
            colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
            style={styles.userAvatar}
          >
            <Feather name="user" size={16} color="#FFFFFF" />
          </LinearGradient>
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
            accessibilityLabel={prompt.label}
            accessibilityRole="button"
            accessibilityHint={`Send message: ${prompt.prompt}`}
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
  const showUpgradeTeaser = remainingMessages !== Infinity && remainingMessages <= 10 && tier === 'free';
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

  const getStylistGradient = (): readonly [string, string] => {
    switch (stylist.id) {
      case 'ruby':
        return [LUXURY_COLORS.rose, LUXURY_COLORS.berry] as const;
      case 'max':
        return [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const;
      case 'ace':
        return [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const;
      default:
        return [LUXURY_COLORS.coral, '#C46A4F'] as const;
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={getStylistGradient()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stylistIcon}
          >
            <Feather name={stylist.icon} size={20} color={stylist.id === 'ace' ? LUXURY_COLORS.midnight : "#FFFFFF"} />
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
          {isPlayingTTS ? (
            <Pressable 
              onPress={stopTTSPlayback} 
              style={[styles.ttsButton, { backgroundColor: theme.link + '20' }]}
            >
              <ActivityIndicator size="small" color={theme.link} />
            </Pressable>
          ) : (
            <Pressable 
              onPress={() => setTtsEnabled(!ttsEnabled)} 
              style={styles.ttsButton}
            >
              <Feather 
                name={ttsEnabled ? "volume-2" : "volume-x"} 
                size={20} 
                color={ttsEnabled ? theme.link : theme.tabIconDefault} 
              />
            </Pressable>
          )}
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
            colors={getStylistGradient()}
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
              <Feather name="arrow-right" size={16} color={getStylistGradient()[0]} />
            </Pressable>
          </LinearGradient>
        </Animated.View>
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
          <LinearGradient
            colors={getStylistGradient()}
            style={styles.avatarContainer}
          >
            <Feather name={moodInfo ? moodInfo.icon : stylist.icon} size={16} color={stylist.id === 'ace' ? LUXURY_COLORS.midnight : "#FFFFFF"} />
          </LinearGradient>
          <View style={[styles.typingBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator size="small" color={getStylistGradient()[0]} />
            <ThemedText style={[styles.typingText, { color: theme.tabIconDefault }]}>
              {getTypingMessage()}
            </ThemedText>
          </View>
        </View>
      ) : null}
      <View style={{ height: INPUT_CONTAINER_HEIGHT + (showQuickPrompts && !isTyping && messages.length <= 1 ? 100 : 0) + Spacing.xl }} />
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

    if (isTranscribing) {
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
          <View style={[styles.transcribingContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator size="small" color={stylist.color} />
            <ThemedText style={[styles.transcribingText, { color: theme.tabIconDefault }]}>
              Transcribing your message...
            </ThemedText>
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
        {showQuickPrompts && !isTyping && messages.length <= 1 ? (
          <View style={styles.quickPromptsInline}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPromptsScrollContent}
            >
              {QUICK_PROMPTS.slice(0, 4).map((prompt) => (
                <Pressable
                  key={prompt.id}
                  onPress={() => handleQuickPrompt(prompt.prompt)}
                  disabled={!canSendMessage()}
                  style={({ pressed }) => [
                    styles.quickPromptChip,
                    { 
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.backgroundTertiary,
                      opacity: pressed ? 0.7 : canSendMessage() ? 1 : 0.5,
                    },
                  ]}
                >
                  <Feather name={prompt.icon} size={14} color={canSendMessage() ? theme.link : theme.tabIconDefault} />
                  <ThemedText style={[styles.quickPromptChipLabel, !canSendMessage() && { color: theme.tabIconDefault }]}>
                    {prompt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
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
              paddingBottom: INPUT_CONTAINER_HEIGHT + TAB_BAR_HEIGHT + insets.bottom + Spacing.md
            }
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          style={styles.flatList}
        />
        <KeyboardStickyView 
          offset={{ closed: 0, opened: 0 }}
          style={[styles.inputBarAbsolute, { bottom: TAB_BAR_HEIGHT + insets.bottom }]}
        >
          <View style={{ backgroundColor: theme.backgroundDefault, paddingBottom: TAB_BAR_HEIGHT + insets.bottom }}>
            {renderInputBar()}
          </View>
        </KeyboardStickyView>
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
    bottom: 0,
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
  ttsButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  transcribingText: {
    ...Typography.body,
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
  quickPromptsInline: {
    marginBottom: Spacing.sm,
  },
  quickPromptsScrollContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  quickPromptChipLabel: {
    ...Typography.small,
    fontSize: 12,
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
    color: LUXURY_COLORS.berry,
  },
});
