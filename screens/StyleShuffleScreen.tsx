import React, { useState, useCallback, useEffect, useRef, useContext } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Image,
  Pressable,
  ImageSourcePropType,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
  withSequence,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DiscoverStackParamList } from '@/navigation/DiscoverStackNavigator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing['3xl'] * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.48;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const VELOCITY_THRESHOLD = 500;
const ROTATION_RANGE = 12;

const SPRING_CONFIG = {
  damping: 25,
  stiffness: 250,
  mass: 0.6,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const SNAP_BACK_SPRING = {
  damping: 22,
  stiffness: 200,
  mass: 0.5,
  overshootClamping: false,
};

const SWIPE_OUT_SPRING = {
  damping: 30,
  stiffness: 300,
  mass: 0.5,
  overshootClamping: true,
};

const LIKED_OUTFITS_KEY = '@dripn_liked_shuffle_outfits';
const DAILY_SWIPES_KEY = '@dripn_daily_swipes';

type GenderFilter = 'all' | 'female' | 'male' | 'forme';

interface ShuffleOutfit {
  id: string;
  image: ImageSourcePropType;
  name: string;
  style: string;
  occasion: string;
  season: string;
  items: { name: string; category: string }[];
  matchScore: number;
  gender: 'female' | 'male';
}

const SHUFFLE_OUTFITS: ShuffleOutfit[] = [
  {
    id: 'outfit_1',
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit.png'),
    name: 'Urban Street Style',
    style: 'Streetwear',
    occasion: 'Casual',
    season: 'Spring',
    items: [
      { name: 'Oversized Blazer', category: 'Outerwear' },
      { name: 'High-Waisted Jeans', category: 'Bottoms' },
      { name: 'White Sneakers', category: 'Shoes' },
    ],
    matchScore: 92,
    gender: 'female',
  },
  {
    id: 'outfit_2',
    image: require('../assets/images/celebrity-looks/elegant_evening_slip_dress.png'),
    name: 'Evening Elegance',
    style: 'Luxury',
    occasion: 'Formal',
    season: 'All Season',
    items: [
      { name: 'Satin Slip Dress', category: 'Dresses' },
      { name: 'Strappy Heels', category: 'Shoes' },
      { name: 'Statement Earrings', category: 'Accessories' },
    ],
    matchScore: 88,
    gender: 'female',
  },
  {
    id: 'outfit_3',
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look.png'),
    name: 'Athleisure Vibes',
    style: 'Sporty',
    occasion: 'Casual',
    season: 'Summer',
    items: [
      { name: 'Workout Set', category: 'Activewear' },
      { name: 'Oversized Hoodie', category: 'Tops' },
      { name: 'Running Sneakers', category: 'Shoes' },
    ],
    matchScore: 95,
    gender: 'female',
  },
  {
    id: 'outfit_4',
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit_male.png'),
    name: 'Casual Edge',
    style: 'Streetwear',
    occasion: 'Weekend',
    season: 'Autumn',
    items: [
      { name: 'Denim Jacket', category: 'Outerwear' },
      { name: 'Slim Jeans', category: 'Bottoms' },
      { name: 'Leather Sneakers', category: 'Shoes' },
    ],
    matchScore: 90,
    gender: 'male',
  },
  {
    id: 'outfit_5',
    image: require('../assets/images/celebrity-looks/elegant_evening_formal_male.png'),
    name: 'Formal Sophistication',
    style: 'Business',
    occasion: 'Formal',
    season: 'All Season',
    items: [
      { name: 'Tailored Blazer', category: 'Outerwear' },
      { name: 'Dress Shirt', category: 'Tops' },
      { name: 'Oxford Shoes', category: 'Shoes' },
    ],
    matchScore: 87,
    gender: 'male',
  },
  {
    id: 'outfit_6',
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look_male.png'),
    name: 'Sport Luxe',
    style: 'Sporty',
    occasion: 'Casual',
    season: 'Spring',
    items: [
      { name: 'Tech Joggers', category: 'Bottoms' },
      { name: 'Performance Hoodie', category: 'Tops' },
      { name: 'Premium Sneakers', category: 'Shoes' },
    ],
    matchScore: 93,
    gender: 'male',
  },
  {
    id: 'outfit_7',
    image: require('../assets/images/styles/boho/female/african.png'),
    name: 'Bohemian Spirit',
    style: 'Boho',
    occasion: 'Festival',
    season: 'Summer',
    items: [
      { name: 'Flowing Maxi Dress', category: 'Dresses' },
      { name: 'Layered Necklaces', category: 'Accessories' },
      { name: 'Strappy Sandals', category: 'Shoes' },
    ],
    matchScore: 89,
    gender: 'female',
  },
  {
    id: 'outfit_8',
    image: require('../assets/images/styles/boho/female/asian.png'),
    name: 'Free Spirit Look',
    style: 'Boho',
    occasion: 'Brunch',
    season: 'Spring',
    items: [
      { name: 'Embroidered Top', category: 'Tops' },
      { name: 'Wide-Leg Pants', category: 'Bottoms' },
      { name: 'Woven Bag', category: 'Accessories' },
    ],
    matchScore: 91,
    gender: 'female',
  },
  {
    id: 'outfit_9',
    image: require('../assets/images/styles/boho/female/latin-american.png'),
    name: 'Sunset Boho',
    style: 'Boho',
    occasion: 'Beach',
    season: 'Summer',
    items: [
      { name: 'Crochet Cover-Up', category: 'Tops' },
      { name: 'Flowy Skirt', category: 'Bottoms' },
      { name: 'Espadrilles', category: 'Shoes' },
    ],
    matchScore: 86,
    gender: 'female',
  },
  {
    id: 'outfit_10',
    image: require('../assets/images/styles/boho/female/south-asian.png'),
    name: 'Earthy Bohemian',
    style: 'Boho',
    occasion: 'Casual',
    season: 'Autumn',
    items: [
      { name: 'Printed Kimono', category: 'Outerwear' },
      { name: 'Linen Pants', category: 'Bottoms' },
      { name: 'Ankle Boots', category: 'Shoes' },
    ],
    matchScore: 88,
    gender: 'female',
  },
  {
    id: 'outfit_11',
    image: require('../assets/images/styles/boho/male/african.png'),
    name: 'Relaxed Boho',
    style: 'Boho',
    occasion: 'Casual',
    season: 'Summer',
    items: [
      { name: 'Linen Shirt', category: 'Tops' },
      { name: 'Loose Trousers', category: 'Bottoms' },
      { name: 'Leather Sandals', category: 'Shoes' },
    ],
    matchScore: 87,
    gender: 'male',
  },
  {
    id: 'outfit_12',
    image: require('../assets/images/styles/boho/male/asian.png'),
    name: 'Coastal Casual',
    style: 'Boho',
    occasion: 'Beach',
    season: 'Summer',
    items: [
      { name: 'Open Weave Shirt', category: 'Tops' },
      { name: 'Drawstring Pants', category: 'Bottoms' },
      { name: 'Woven Belt', category: 'Accessories' },
    ],
    matchScore: 85,
    gender: 'male',
  },
  {
    id: 'outfit_13',
    image: require('../assets/images/styles/smart-casual/female/african.png'),
    name: 'Polished Ease',
    style: 'Smart Casual',
    occasion: 'Office',
    season: 'All Season',
    items: [
      { name: 'Tailored Blouse', category: 'Tops' },
      { name: 'Ankle Pants', category: 'Bottoms' },
      { name: 'Pointed Flats', category: 'Shoes' },
    ],
    matchScore: 94,
    gender: 'female',
  },
  {
    id: 'outfit_14',
    image: require('../assets/images/styles/smart-casual/female/asian.png'),
    name: 'Chic Professional',
    style: 'Smart Casual',
    occasion: 'Meeting',
    season: 'Spring',
    items: [
      { name: 'Structured Blazer', category: 'Outerwear' },
      { name: 'Silk Camisole', category: 'Tops' },
      { name: 'Slim Trousers', category: 'Bottoms' },
    ],
    matchScore: 92,
    gender: 'female',
  },
  {
    id: 'outfit_15',
    image: require('../assets/images/styles/smart-casual/female/middle-eastern.png'),
    name: 'Effortless Elegance',
    style: 'Smart Casual',
    occasion: 'Dinner',
    season: 'Autumn',
    items: [
      { name: 'Wrap Dress', category: 'Dresses' },
      { name: 'Statement Belt', category: 'Accessories' },
      { name: 'Block Heels', category: 'Shoes' },
    ],
    matchScore: 90,
    gender: 'female',
  },
  {
    id: 'outfit_16',
    image: require('../assets/images/styles/smart-casual/male/african.png'),
    name: 'Modern Gentleman',
    style: 'Smart Casual',
    occasion: 'Office',
    season: 'All Season',
    items: [
      { name: 'Button-Down Shirt', category: 'Tops' },
      { name: 'Chinos', category: 'Bottoms' },
      { name: 'Leather Loafers', category: 'Shoes' },
    ],
    matchScore: 91,
    gender: 'male',
  },
  {
    id: 'outfit_17',
    image: require('../assets/images/styles/smart-casual/male/asian.png'),
    name: 'Refined Casual',
    style: 'Smart Casual',
    occasion: 'Brunch',
    season: 'Spring',
    items: [
      { name: 'Polo Shirt', category: 'Tops' },
      { name: 'Tailored Shorts', category: 'Bottoms' },
      { name: 'White Sneakers', category: 'Shoes' },
    ],
    matchScore: 88,
    gender: 'male',
  },
  {
    id: 'outfit_18',
    image: require('../assets/images/styles/smart-casual/male/middle-eastern.png'),
    name: 'Urban Professional',
    style: 'Smart Casual',
    occasion: 'Meeting',
    season: 'Autumn',
    items: [
      { name: 'Knit Sweater', category: 'Tops' },
      { name: 'Dark Jeans', category: 'Bottoms' },
      { name: 'Chelsea Boots', category: 'Shoes' },
    ],
    matchScore: 89,
    gender: 'male',
  },
  {
    id: 'outfit_19',
    image: require('../assets/images/styles/sporty/female/african.png'),
    name: 'Fitness Chic',
    style: 'Sporty',
    occasion: 'Gym',
    season: 'All Season',
    items: [
      { name: 'Sports Bra', category: 'Tops' },
      { name: 'High-Waist Leggings', category: 'Bottoms' },
      { name: 'Training Shoes', category: 'Shoes' },
    ],
    matchScore: 96,
    gender: 'female',
  },
  {
    id: 'outfit_20',
    image: require('../assets/images/styles/sporty/female/latin-american.png'),
    name: 'Active Glow',
    style: 'Sporty',
    occasion: 'Running',
    season: 'Summer',
    items: [
      { name: 'Crop Tank', category: 'Tops' },
      { name: 'Running Shorts', category: 'Bottoms' },
      { name: 'Performance Sneakers', category: 'Shoes' },
    ],
    matchScore: 94,
    gender: 'female',
  },
  {
    id: 'outfit_21',
    image: require('../assets/images/styles/sporty/female/nordic.png'),
    name: 'Weekend Active',
    style: 'Sporty',
    occasion: 'Casual',
    season: 'Spring',
    items: [
      { name: 'Zip-Up Jacket', category: 'Outerwear' },
      { name: 'Joggers', category: 'Bottoms' },
      { name: 'Chunky Trainers', category: 'Shoes' },
    ],
    matchScore: 91,
    gender: 'female',
  },
  {
    id: 'outfit_22',
    image: require('../assets/images/styles/sporty/male/african.png'),
    name: 'Gym Ready',
    style: 'Sporty',
    occasion: 'Workout',
    season: 'All Season',
    items: [
      { name: 'Performance Tee', category: 'Tops' },
      { name: 'Athletic Shorts', category: 'Bottoms' },
      { name: 'Cross Trainers', category: 'Shoes' },
    ],
    matchScore: 93,
    gender: 'male',
  },
  {
    id: 'outfit_23',
    image: require('../assets/images/styles/sporty/male/latin-american.png'),
    name: 'Street Athletics',
    style: 'Sporty',
    occasion: 'Casual',
    season: 'Summer',
    items: [
      { name: 'Tank Top', category: 'Tops' },
      { name: 'Track Pants', category: 'Bottoms' },
      { name: 'Retro Sneakers', category: 'Shoes' },
    ],
    matchScore: 90,
    gender: 'male',
  },
  {
    id: 'outfit_24',
    image: require('../assets/images/styles/sporty/male/nordic.png'),
    name: 'Active Lifestyle',
    style: 'Sporty',
    occasion: 'Weekend',
    season: 'Spring',
    items: [
      { name: 'Windbreaker', category: 'Outerwear' },
      { name: 'Compression Tights', category: 'Bottoms' },
      { name: 'Running Shoes', category: 'Shoes' },
    ],
    matchScore: 88,
    gender: 'male',
  },
  {
    id: 'outfit_25',
    image: require('../assets/images/styles/streetwear/male/african.png'),
    name: 'Urban Culture',
    style: 'Streetwear',
    occasion: 'Casual',
    season: 'Autumn',
    items: [
      { name: 'Graphic Hoodie', category: 'Tops' },
      { name: 'Cargo Pants', category: 'Bottoms' },
      { name: 'High-Top Sneakers', category: 'Shoes' },
    ],
    matchScore: 92,
    gender: 'male',
  },
  {
    id: 'outfit_26',
    image: require('../assets/images/styles/streetwear/male/asian.png'),
    name: 'Tokyo Street',
    style: 'Streetwear',
    occasion: 'Weekend',
    season: 'Spring',
    items: [
      { name: 'Oversized Tee', category: 'Tops' },
      { name: 'Wide Leg Jeans', category: 'Bottoms' },
      { name: 'Platform Sneakers', category: 'Shoes' },
    ],
    matchScore: 94,
    gender: 'male',
  },
  {
    id: 'outfit_27',
    image: require('../assets/images/styles/streetwear/male/multicultural.png'),
    name: 'City Vibes',
    style: 'Streetwear',
    occasion: 'Concert',
    season: 'Summer',
    items: [
      { name: 'Bomber Jacket', category: 'Outerwear' },
      { name: 'Distressed Denim', category: 'Bottoms' },
      { name: 'Designer Sneakers', category: 'Shoes' },
    ],
    matchScore: 91,
    gender: 'male',
  },
  {
    id: 'outfit_28',
    image: require('../assets/images/styles/business/male/african.png'),
    name: 'Executive Style',
    style: 'Business',
    occasion: 'Office',
    season: 'All Season',
    items: [
      { name: 'Slim Fit Suit', category: 'Outerwear' },
      { name: 'Crisp White Shirt', category: 'Tops' },
      { name: 'Leather Oxfords', category: 'Shoes' },
    ],
    matchScore: 95,
    gender: 'male',
  },
  {
    id: 'outfit_29',
    image: require('../assets/images/styles/business/male/asian.png'),
    name: 'Power Meeting',
    style: 'Business',
    occasion: 'Formal',
    season: 'Winter',
    items: [
      { name: 'Double-Breasted Blazer', category: 'Outerwear' },
      { name: 'Silk Tie', category: 'Accessories' },
      { name: 'Dress Shoes', category: 'Shoes' },
    ],
    matchScore: 93,
    gender: 'male',
  },
  {
    id: 'outfit_30',
    image: require('../assets/images/styles/business/male/middle-eastern.png'),
    name: 'Corporate Elegance',
    style: 'Business',
    occasion: 'Presentation',
    season: 'Autumn',
    items: [
      { name: 'Three-Piece Suit', category: 'Outerwear' },
      { name: 'Pocket Square', category: 'Accessories' },
      { name: 'Monk Strap Shoes', category: 'Shoes' },
    ],
    matchScore: 94,
    gender: 'male',
  },
];

type NavigationProp = NativeStackNavigationProp<DiscoverStackParamList>;

export default function StyleShuffleScreen() {
  const { theme, isDark } = useTheme();
  const { limits, tier } = useSubscription();
  const { user } = useAuth();
  const screenInsets = useScreenInsets();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

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

  const [genderFilter, setGenderFilter] = useState<GenderFilter>('forme');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedOutfits, setLikedOutfits] = useState<string[]>([]);
  const [swipesToday, setSwipesToday] = useState(0);
  const [lastAction, setLastAction] = useState<'like' | 'pass' | null>(null);
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const filteredOutfits = React.useMemo(() => {
    if (genderFilter === 'all') {
      return [...SHUFFLE_OUTFITS].sort(() => Math.random() - 0.5);
    }
    if (genderFilter === 'forme') {
      const userGender = user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : null;
      if (userGender) {
        return SHUFFLE_OUTFITS.filter(outfit => outfit.gender === userGender).sort(() => Math.random() - 0.5);
      }
      return [...SHUFFLE_OUTFITS].sort(() => Math.random() - 0.5);
    }
    return SHUFFLE_OUTFITS.filter(outfit => outfit.gender === genderFilter).sort(() => Math.random() - 0.5);
  }, [genderFilter, user?.gender]);

  const [outfits, setOutfits] = useState<ShuffleOutfit[]>(filteredOutfits);

  React.useEffect(() => {
    setOutfits(filteredOutfits);
    setCurrentIndex(0);
  }, [filteredOutfits]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const matchOverlayScale = useSharedValue(0);
  const matchOverlayOpacity = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  const dailyLimit = limits.styleShuffleSwipesPerDay;
  const remainingSwipes = dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - swipesToday);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    matchOverlayOpacity.value = 0;
    matchOverlayScale.value = 0;
    setShowMatchOverlay(false);
    
    return () => {
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }
      if (overlayHideTimerRef.current) {
        clearTimeout(overlayHideTimerRef.current);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [likedData, swipesData] = await Promise.all([
        AsyncStorage.getItem(LIKED_OUTFITS_KEY),
        AsyncStorage.getItem(DAILY_SWIPES_KEY),
      ]);

      if (likedData) {
        setLikedOutfits(JSON.parse(likedData));
      }

      if (swipesData) {
        const { count, date } = JSON.parse(swipesData);
        const today = new Date().toDateString();
        if (date === today) {
          setSwipesToday(count);
        } else {
          await AsyncStorage.setItem(
            DAILY_SWIPES_KEY,
            JSON.stringify({ count: 0, date: today })
          );
        }
      }
    } catch (error) {
      console.error('Failed to load shuffle data:', error);
    }
  };

  const incrementSwipeCount = async () => {
    const newCount = swipesToday + 1;
    setSwipesToday(newCount);
    try {
      await AsyncStorage.setItem(
        DAILY_SWIPES_KEY,
        JSON.stringify({ count: newCount, date: new Date().toDateString() })
      );
    } catch (error) {
      console.error('Failed to save swipe count:', error);
    }
  };

  const saveLikedOutfit = async (outfitId: string) => {
    const updatedLikes = [...likedOutfits, outfitId];
    setLikedOutfits(updatedLikes);
    try {
      await AsyncStorage.setItem(LIKED_OUTFITS_KEY, JSON.stringify(updatedLikes));
    } catch (error) {
      console.error('Failed to save liked outfit:', error);
    }
  };

  const hideOverlay = useCallback(() => {
    matchOverlayOpacity.value = 0;
    matchOverlayScale.value = 0;
    setShowMatchOverlay(false);
  }, []);

  const triggerMatchOverlay = useCallback(() => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
    }
    if (overlayHideTimerRef.current) {
      clearTimeout(overlayHideTimerRef.current);
    }
    
    setShowMatchOverlay(true);
    matchOverlayScale.value = withSequence(
      withSpring(1.2, { damping: 12, stiffness: 300 }),
      withSpring(1, { damping: 15, stiffness: 200 })
    );
    matchOverlayOpacity.value = withTiming(1, { duration: 200 });
    
    overlayTimerRef.current = setTimeout(() => {
      matchOverlayOpacity.value = withTiming(0, { duration: 300 });
      matchOverlayScale.value = withTiming(0, { duration: 300 });
      overlayHideTimerRef.current = setTimeout(() => {
        hideOverlay();
      }, 350);
    }, 700);
  }, [hideOverlay]);

  const resetCardPosition = useCallback(() => {
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(cardOpacity);
    translateX.value = 0;
    translateY.value = 0;
    cardOpacity.value = 1;
    isAnimating.value = false;
  }, []);

  const prevIndexRef = useRef(currentIndex);
  
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      resetCardPosition();
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex, resetCardPosition]);

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    if (currentIndex >= outfits.length) return;

    const currentOutfit = outfits[currentIndex];
    
    if (direction === 'right') {
      saveLikedOutfit(currentOutfit.id);
      setLastAction('like');
      triggerMatchOverlay();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setLastAction('pass');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    incrementSwipeCount();
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, outfits, likedOutfits, triggerMatchOverlay]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (isAnimating.value) return;
    
    if (remainingSwipes === 0 && dailyLimit !== Infinity) {
      Alert.alert(
        'Daily Limit Reached',
        `You've used all ${dailyLimit} swipes for today. Upgrade your plan for more swipes!`,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Upgrade', onPress: navigateToSubscription },
        ]
      );
      return;
    }

    isAnimating.value = true;
    const targetX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    const targetY = direction === 'right' ? -30 : 30;
    
    translateX.value = withSpring(targetX, SWIPE_OUT_SPRING, (finished) => {
      if (finished) {
        runOnJS(handleSwipeComplete)(direction);
      }
    });
    translateY.value = withSpring(targetY, { ...SWIPE_OUT_SPRING, damping: 35 });
  }, [remainingSwipes, dailyLimit, handleSwipeComplete, navigateToSubscription]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      if (isAnimating.value) {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        cancelAnimation(cardOpacity);
        translateX.value = 0;
        translateY.value = 0;
        cardOpacity.value = 1;
        isAnimating.value = false;
      }
    })
    .onUpdate((event) => {
      if (isAnimating.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.25;
    })
    .onEnd((event) => {
      if (isAnimating.value) return;
      
      const velocityX = event.velocityX;
      const shouldSwipe = Math.abs(event.translationX) > SWIPE_THRESHOLD || Math.abs(velocityX) > VELOCITY_THRESHOLD;
      
      if (shouldSwipe) {
        const direction = event.translationX > 0 || velocityX > VELOCITY_THRESHOLD ? 'right' : 'left';
        
        if (remainingSwipes === 0 && dailyLimit !== Infinity) {
          translateX.value = withSpring(0, SNAP_BACK_SPRING);
          translateY.value = withSpring(0, SNAP_BACK_SPRING);
          runOnJS(Alert.alert)(
            'Daily Limit Reached',
            `You've used all ${dailyLimit} swipes for today.`
          );
        } else {
          isAnimating.value = true;
          const targetX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
          const velocityBoost = Math.min(Math.abs(velocityX) / 500, 2);
          
          translateX.value = withSpring(targetX, {
            ...SWIPE_OUT_SPRING,
            velocity: velocityX * velocityBoost,
          }, (finished) => {
            if (finished) {
              runOnJS(handleSwipeComplete)(direction);
            }
          });
          translateY.value = withSpring(event.translationY * 0.3, {
            ...SWIPE_OUT_SPRING,
            damping: 35,
            velocity: event.velocityY * 0.3,
          });
        }
      } else {
        translateX.value = withSpring(0, SNAP_BACK_SPRING);
        translateY.value = withSpring(0, SNAP_BACK_SPRING);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
      [-ROTATION_RANGE, 0, ROTATION_RANGE],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      Math.abs(translateX.value),
      [0, SCREEN_WIDTH * 0.3],
      [1, 0.98],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: scale * cardScale.value },
      ],
      opacity: cardOpacity.value,
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SCREEN_WIDTH * 0.15, SCREEN_WIDTH * 0.35],
      [0, 0.3, 1],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      translateX.value,
      [0, SCREEN_WIDTH * 0.35],
      [0.8, 1],
      Extrapolation.CLAMP
    );
    return { 
      opacity,
      transform: [{ scale }],
    };
  });

  const passOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 0.35, -SCREEN_WIDTH * 0.15, 0],
      [1, 0.3, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 0.35, 0],
      [1, 0.8],
      Extrapolation.CLAMP
    );
    return { 
      opacity,
      transform: [{ scale }],
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / (SCREEN_WIDTH * 0.5), 1);
    const scale = 0.92 + progress * 0.08;
    const opacity = 0.7 + progress * 0.3;
    
    return { 
      transform: [{ scale }],
      opacity,
    };
  });

  const matchOverlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: matchOverlayOpacity.value,
      transform: [{ scale: matchOverlayScale.value }],
    };
  });

  const resetDeck = () => {
    setCurrentIndex(0);
    let newOutfits: ShuffleOutfit[];
    if (genderFilter === 'all') {
      newOutfits = [...SHUFFLE_OUTFITS].sort(() => Math.random() - 0.5);
    } else if (genderFilter === 'forme') {
      const userGender = user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : null;
      if (userGender) {
        newOutfits = SHUFFLE_OUTFITS.filter(outfit => outfit.gender === userGender).sort(() => Math.random() - 0.5);
      } else {
        newOutfits = [...SHUFFLE_OUTFITS].sort(() => Math.random() - 0.5);
      }
    } else {
      newOutfits = SHUFFLE_OUTFITS.filter(outfit => outfit.gender === genderFilter).sort(() => Math.random() - 0.5);
    }
    setOutfits(newOutfits);
  };

  const currentOutfit = outfits[currentIndex];
  const nextOutfit = outfits[currentIndex + 1];

  if (currentIndex >= outfits.length) {
    return (
      <ThemedView style={[styles.container, { paddingTop: screenInsets.paddingTop, paddingBottom: screenInsets.paddingBottom }]}>
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="refresh-cw" size={48} color={theme.link} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            You've seen all outfits!
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            You liked {likedOutfits.length} outfit{likedOutfits.length !== 1 ? 's' : ''} today
          </ThemedText>
          <Pressable
            style={[styles.resetButton, { backgroundColor: theme.link }]}
            onPress={resetDeck}
          >
            <Feather name="shuffle" size={20} color="#FFFFFF" />
            <ThemedText style={styles.resetButtonText}>Shuffle Again</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const floatingBarHeight = 100;

  return (
    <ThemedView style={[styles.container, { paddingTop: screenInsets.paddingTop, paddingBottom: tabBarHeight + floatingBarHeight + Spacing.md }]}>
      <View style={styles.header}>
        <View>
          <ThemedText style={[styles.title, { color: theme.text }]}>Style Shuffle</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            Swipe right to like, left to pass
          </ThemedText>
        </View>
        <View style={[styles.swipeCounter, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="heart" size={16} color={theme.link} />
          <ThemedText style={[styles.swipeCountText, { color: theme.text }]}>
            {remainingSwipes === Infinity ? 'Unlimited' : `${remainingSwipes} left`}
          </ThemedText>
        </View>
      </View>

      <View style={styles.genderToggleContainer}>
        <ThemedText style={[styles.genderToggleLabel, { color: theme.tabIconDefault }]}>
          Browse for:
        </ThemedText>
        <View style={[styles.genderToggleRow, { backgroundColor: theme.backgroundSecondary }]}>
          <Pressable
            onPress={() => setGenderFilter('forme')}
            style={[
              styles.genderToggleButton,
              genderFilter === 'forme' && { backgroundColor: theme.link },
            ]}
          >
            <Feather 
              name="star" 
              size={14} 
              color={genderFilter === 'forme' ? '#FFFFFF' : theme.tabIconDefault} 
            />
            <ThemedText style={[
              styles.genderToggleText,
              { color: genderFilter === 'forme' ? '#FFFFFF' : theme.text }
            ]}>
              For Me
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setGenderFilter('all')}
            style={[
              styles.genderToggleButton,
              genderFilter === 'all' && { backgroundColor: theme.link },
            ]}
          >
            <Feather 
              name="users" 
              size={14} 
              color={genderFilter === 'all' ? '#FFFFFF' : theme.tabIconDefault} 
            />
            <ThemedText style={[
              styles.genderToggleText,
              { color: genderFilter === 'all' ? '#FFFFFF' : theme.text }
            ]}>
              All
            </ThemedText>
          </Pressable>
          {user?.gender !== 'woman' && (
            <Pressable
              onPress={() => setGenderFilter('female')}
              style={[
                styles.genderToggleButton,
                genderFilter === 'female' && { backgroundColor: theme.link },
              ]}
            >
              <Feather 
                name="user" 
                size={14} 
                color={genderFilter === 'female' ? '#FFFFFF' : theme.tabIconDefault} 
              />
              <ThemedText style={[
                styles.genderToggleText,
                { color: genderFilter === 'female' ? '#FFFFFF' : theme.text }
              ]}>
                Her
              </ThemedText>
            </Pressable>
          )}
          {user?.gender !== 'man' && (
            <Pressable
              onPress={() => setGenderFilter('male')}
              style={[
                styles.genderToggleButton,
                genderFilter === 'male' && { backgroundColor: theme.link },
              ]}
            >
              <Feather 
                name="user" 
                size={14} 
                color={genderFilter === 'male' ? '#FFFFFF' : theme.tabIconDefault} 
              />
              <ThemedText style={[
                styles.genderToggleText,
                { color: genderFilter === 'male' ? '#FFFFFF' : theme.text }
              ]}>
                Him
              </ThemedText>
            </Pressable>
          )}
        </View>
        <ThemedText style={[styles.giftHint, { color: theme.tabIconDefault }]}>
          {genderFilter === 'forme' ? 'Personalized for your style' : 'Perfect for gift ideas'}
        </ThemedText>
      </View>

      <View style={styles.cardContainer}>
        {nextOutfit ? (
          <Animated.View style={[styles.cardWrapper, styles.nextCard, nextCardStyle]}>
            <Card style={styles.outfitCard} elevation={2}>
              <Image source={nextOutfit.image} style={styles.outfitImage} resizeMode="cover" />
            </Card>
          </Animated.View>
        ) : null}

        {currentOutfit ? (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.cardWrapper, cardStyle]}>
              <Card style={styles.outfitCard} elevation={3}>
                <Image source={currentOutfit.image} style={styles.outfitImage} resizeMode="cover" />
                
                <Animated.View style={[styles.likeOverlay, likeOverlayStyle]}>
                  <View style={styles.likeStamp}>
                    <ThemedText style={styles.stampText}>LIKE</ThemedText>
                  </View>
                </Animated.View>

                <Animated.View style={[styles.passOverlay, passOverlayStyle]}>
                  <View style={styles.passStamp}>
                    <ThemedText style={styles.stampText}>PASS</ThemedText>
                  </View>
                </Animated.View>

                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardInfo}>
                    <View style={styles.matchBadge}>
                      <ThemedText style={styles.matchScore}>{currentOutfit.matchScore}% Match</ThemedText>
                    </View>
                    <ThemedText style={styles.outfitName}>{currentOutfit.name}</ThemedText>
                    <View style={styles.tagRow}>
                      <View style={styles.tag}>
                        <Feather name="tag" size={12} color="#FFFFFF" />
                        <ThemedText style={styles.tagText}>{currentOutfit.style}</ThemedText>
                      </View>
                      <View style={styles.tag}>
                        <Feather name="calendar" size={12} color="#FFFFFF" />
                        <ThemedText style={styles.tagText}>{currentOutfit.occasion}</ThemedText>
                      </View>
                      <View style={styles.tag}>
                        <Feather name="sun" size={12} color="#FFFFFF" />
                        <ThemedText style={styles.tagText}>{currentOutfit.season}</ThemedText>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </Card>
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>

      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.floatingActionBar,
          { bottom: tabBarHeight + Spacing.md }
        ]}
      >
        <View style={styles.progressRow}>
          {outfits.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index < currentIndex
                    ? theme.link
                    : index === currentIndex
                    ? theme.tabIconDefault
                    : theme.backgroundSecondary,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton, 
              styles.passButton, 
              { 
                backgroundColor: theme.backgroundSecondary,
                transform: [{ scale: pressed ? 0.9 : 1 }],
                opacity: pressed ? 0.8 : 1,
              }
            ]}
            onPress={() => handleSwipe('left')}
          >
            <Feather name="x" size={24} color={theme.error || '#C94C5A'} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton, 
              styles.infoButton, 
              { 
                backgroundColor: theme.backgroundSecondary,
                transform: [{ scale: pressed ? 0.9 : 1 }],
                opacity: pressed ? 0.8 : 1,
              }
            ]}
            onPress={() => {
              if (currentOutfit) {
                Alert.alert(
                  currentOutfit.name,
                  `Style: ${currentOutfit.style}\nOccasion: ${currentOutfit.occasion}\nSeason: ${currentOutfit.season}\n\nItems:\n${currentOutfit.items.map(i => `- ${i.name} (${i.category})`).join('\n')}`
                );
              }
            }}
          >
            <Feather name="info" size={18} color={theme.link} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton, 
              styles.likeButton, 
              { 
                backgroundColor: theme.link,
                transform: [{ scale: pressed ? 0.9 : 1 }],
                opacity: pressed ? 0.8 : 1,
              }
            ]}
            onPress={() => handleSwipe('right')}
          >
            <Feather name="heart" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </BlurView>

      {showMatchOverlay ? (
        <Animated.View 
          style={[
            styles.matchOverlay, 
            { backgroundColor: theme.link + 'E6' },
            matchOverlayAnimatedStyle
          ]} 
          pointerEvents="none"
        >
          <View style={styles.matchContent}>
            <Feather name="heart" size={64} color="#FFFFFF" />
            <ThemedText style={styles.matchText}>Added to Favorites!</ThemedText>
          </View>
        </Animated.View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h2,
  },
  subtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  swipeCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  swipeCountText: {
    ...Typography.small,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingActionBar: {
    position: 'absolute',
    left: Spacing['2xl'],
    right: Spacing['2xl'],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  cardWrapper: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  nextCard: {
    zIndex: 0,
  },
  outfitCard: {
    width: '100%',
    height: '100%',
    padding: 0,
    overflow: 'hidden',
  },
  outfitImage: {
    width: '100%',
    height: '100%',
  },
  likeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeStamp: {
    borderWidth: 4,
    borderColor: '#00D9A5',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    transform: [{ rotate: '-15deg' }],
  },
  passStamp: {
    borderWidth: 4,
    borderColor: '#C94C5A',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    transform: [{ rotate: '15deg' }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing['4xl'],
  },
  cardInfo: {
    gap: Spacing.sm,
  },
  matchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  matchScore: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  outfitName: {
    ...Typography.h2,
    color: '#FFFFFF',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  passButton: {
    width: 48,
    height: 48,
  },
  infoButton: {
    width: 40,
    height: 40,
  },
  likeButton: {
    width: 48,
    height: 48,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchContent: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  matchText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  genderToggleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: 2,
  },
  genderToggleLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  genderToggleRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  genderToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  genderToggleText: {
    ...Typography.small,
    fontWeight: '600',
  },
  giftHint: {
    ...Typography.caption,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
});
