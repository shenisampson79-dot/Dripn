import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

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
const CARD_HEIGHT = SCREEN_HEIGHT * 0.55;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const ROTATION_RANGE = 15;

const LIKED_OUTFITS_KEY = '@dripn_liked_shuffle_outfits';
const DAILY_SWIPES_KEY = '@dripn_daily_swipes';

interface ShuffleOutfit {
  id: string;
  image: ImageSourcePropType;
  name: string;
  style: string;
  occasion: string;
  season: string;
  items: { name: string; category: string }[];
  matchScore: number;
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
  },
];

type NavigationProp = NativeStackNavigationProp<DiscoverStackParamList>;

export default function StyleShuffleScreen() {
  const { theme, isDark } = useTheme();
  const { limits, tier } = useSubscription();
  const { user } = useAuth();
  const screenInsets = useScreenInsets();
  const navigation = useNavigation<NavigationProp>();

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

  const [outfits, setOutfits] = useState<ShuffleOutfit[]>([...SHUFFLE_OUTFITS]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedOutfits, setLikedOutfits] = useState<string[]>([]);
  const [swipesToday, setSwipesToday] = useState(0);
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [lastAction, setLastAction] = useState<'like' | 'pass' | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);

  const dailyLimit = limits.styleShuffleSwipesPerDay;
  const remainingSwipes = dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - swipesToday);

  useEffect(() => {
    loadData();
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

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    if (currentIndex >= outfits.length) return;

    const currentOutfit = outfits[currentIndex];
    
    if (direction === 'right') {
      saveLikedOutfit(currentOutfit.id);
      setLastAction('like');
      setShowMatchOverlay(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setShowMatchOverlay(false), 800);
    } else {
      setLastAction('pass');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    incrementSwipeCount();
    setCurrentIndex((prev) => prev + 1);

    translateX.value = 0;
    translateY.value = 0;
  }, [currentIndex, outfits, likedOutfits]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
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

    const targetX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    translateX.value = withTiming(targetX, { duration: 300 }, () => {
      runOnJS(handleSwipeComplete)(direction);
    });
  }, [remainingSwipes, dailyLimit, handleSwipeComplete, navigateToSubscription]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        if (remainingSwipes === 0 && dailyLimit !== Infinity) {
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          runOnJS(Alert.alert)(
            'Daily Limit Reached',
            `You've used all ${dailyLimit} swipes for today.`
          );
        } else {
          const targetX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
          translateX.value = withTiming(targetX, { duration: 250 }, () => {
            runOnJS(handleSwipeComplete)(direction);
          });
        }
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-ROTATION_RANGE, 0, ROTATION_RANGE],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: cardScale.value },
      ],
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SCREEN_WIDTH * 0.3],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const passOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 0.3, 0],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, SCREEN_WIDTH * 0.5],
      [0.92, 1],
      Extrapolation.CLAMP
    );
    return { transform: [{ scale }] };
  });

  const resetDeck = () => {
    setCurrentIndex(0);
    setOutfits([...SHUFFLE_OUTFITS].sort(() => Math.random() - 0.5));
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

  return (
    <ThemedView style={[styles.container, { paddingTop: screenInsets.paddingTop, paddingBottom: screenInsets.paddingBottom }]}>
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

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.passButton, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => handleSwipe('left')}
        >
          <Feather name="x" size={32} color={theme.error || '#C94C5A'} />
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.infoButton, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => {
            if (currentOutfit) {
              Alert.alert(
                currentOutfit.name,
                `Style: ${currentOutfit.style}\nOccasion: ${currentOutfit.occasion}\nSeason: ${currentOutfit.season}\n\nItems:\n${currentOutfit.items.map(i => `- ${i.name} (${i.category})`).join('\n')}`
              );
            }
          }}
        >
          <Feather name="info" size={24} color={theme.link} />
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.likeButton, { backgroundColor: theme.link }]}
          onPress={() => handleSwipe('right')}
        >
          <Feather name="heart" size={32} color="#FFFFFF" />
        </Pressable>
      </View>

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

      {showMatchOverlay ? (
        <View style={styles.matchOverlay}>
          <Animated.View style={styles.matchContent}>
            <Feather name="heart" size={64} color="#FFFFFF" />
            <ThemedText style={styles.matchText}>Added to Favorites!</ThemedText>
          </Animated.View>
        </View>
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
    marginBottom: Spacing.lg,
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
    gap: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  passButton: {
    width: 60,
    height: 60,
  },
  infoButton: {
    width: 48,
    height: 48,
  },
  likeButton: {
    width: 60,
    height: 60,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xl,
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
    backgroundColor: 'rgba(0, 217, 165, 0.9)',
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
});
