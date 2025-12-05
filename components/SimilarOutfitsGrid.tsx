import React from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ThemedText } from './ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { SimilarOutfit } from '@/services/AIAdviceService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = Spacing.sm;
const GRID_PADDING = Spacing.lg;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.3;

interface SimilarOutfitsGridProps {
  outfits: SimilarOutfit[];
  onOutfitPress?: (outfit: SimilarOutfit) => void;
  onSaveOutfit?: (outfit: SimilarOutfit) => void;
  savedOutfitIds?: string[];
}

interface OutfitCardProps {
  outfit: SimilarOutfit;
  onPress?: () => void;
  onSave?: () => void;
  isSaved: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function OutfitCard({ outfit, onPress, onSave, isSaved }: OutfitCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    'worklet';
    scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    'worklet';
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      handlePressIn();
    })
    .onFinalize(() => {
      handlePressOut();
      if (onPress) {
        runOnJS(onPress)();
      }
    });

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={[
          styles.outfitCard,
          { backgroundColor: theme.backgroundSecondary },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri: outfit.imageUri }}
          style={styles.outfitImage}
          contentFit="cover"
          transition={300}
        />
        <View style={styles.cardOverlay}>
          <View style={styles.cardContent}>
            <ThemedText
              style={styles.outfitTitle}
              numberOfLines={1}
              lightColor="#FFFFFF"
              darkColor="#FFFFFF"
            >
              {outfit.title}
            </ThemedText>
            <ThemedText
              style={styles.outfitStyle}
              numberOfLines={1}
              lightColor="rgba(255,255,255,0.8)"
              darkColor="rgba(255,255,255,0.8)"
            >
              {outfit.style.charAt(0).toUpperCase() + outfit.style.slice(1)}
            </ThemedText>
          </View>
          <Pressable
            onPress={onSave}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: pressed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)' },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name={isSaved ? 'heart' : 'heart'}
              size={18}
              color={isSaved ? '#FF4B6E' : '#FFFFFF'}
              style={isSaved ? { opacity: 1 } : { opacity: 0.9 }}
            />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SimilarOutfitsGrid({
  outfits,
  onOutfitPress,
  onSaveOutfit,
  savedOutfitIds = [],
}: SimilarOutfitsGridProps) {
  const { theme } = useTheme();

  if (!outfits || outfits.length === 0) {
    return null;
  }

  const displayOutfits = outfits.slice(0, 4);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.sectionTitle}>Similar Outfit Ideas</ThemedText>
        <Feather name="grid" size={16} color={theme.tabIconDefault} />
      </View>
      <View style={styles.grid}>
        {displayOutfits.map((outfit, index) => (
          <OutfitCard
            key={outfit.id}
            outfit={outfit}
            onPress={() => onOutfitPress?.(outfit)}
            onSave={() => onSaveOutfit?.(outfit)}
            isSaved={savedOutfitIds.includes(outfit.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: GRID_PADDING,
    marginTop: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  outfitCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  outfitImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
    paddingTop: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  outfitTitle: {
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  outfitStyle: {
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
