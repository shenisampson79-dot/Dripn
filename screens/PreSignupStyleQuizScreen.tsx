import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Image, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/AuthStackNavigator';
import { PRE_SIGNUP_QUIZ_OUTFITS } from '@/constants/preSignupQuizOutfits';
import { onboardingProfileService } from '@/services/OnboardingProfileService';
import { apiService } from '@/services/ApiService';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const QUIZ_COUNT = 5;

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PreSignupStyleQuiz'>;
};

export default function PreSignupStyleQuizScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const outfits = PRE_SIGNUP_QUIZ_OUTFITS.slice(0, QUIZ_COUNT);
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState(0);
  const [done, setDone] = useState(false);
  const [topStyles, setTopStyles] = useState<string[]>([]);

  const current = outfits[index];

  const finishQuiz = useCallback(async () => {
    await onboardingProfileService.completeQuiz();
    setDone(true);
    const profile = await onboardingProfileService.getProfile();
    const styles = profile.likedStyles || [];
    setTopStyles(styles.slice(0, 3));
  }, []);

  const handleChoice = useCallback(async (liked: boolean) => {
    if (!current) return;
    if (liked) {
      setLikes((n) => n + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await onboardingProfileService.recordQuizSwipe(liked, current.style);

    if (user) {
      apiService.recordOutfitEngagement({
        items: current.items.map((item, i) => ({
          id: `presignup_${current.id}_${i}`,
          name: item.name,
          category: item.category,
        })),
        signal: liked ? 'liked' : 'skipped',
        occasion: current.occasion,
        contextSnapshot: { source: 'pre_signup_quiz', outfitId: current.id, style: current.style },
      }).catch(() => {});
    }

    if (index + 1 >= outfits.length) {
      await finishQuiz();
    } else {
      setIndex((i) => i + 1);
    }
  }, [current, index, outfits.length, user, finishQuiz]);

  const handleContinue = () => {
    navigation.navigate('OnboardingEntry');
  };

  if (done) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.doneContent}>
          <Feather name="check-circle" size={56} color="#C9A87C" />
          <ThemedText type="h1" style={styles.doneTitle}>We know your vibe</ThemedText>
          <ThemedText type="body" style={styles.doneSub}>
            {topStyles.length
              ? `You lean ${topStyles.join(' · ')}. Your stylist already picked today's outfit.`
              : 'Your stylist already picked today\'s outfit based on what you told us.'}
          </ThemedText>
          <ThemedText type="small" style={styles.doneHint}>
            Zero wardrobe needed. We decide — you look better.
          </ThemedText>
        </View>
        <Button onPress={handleContinue}>See my outfit</Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Feather name="arrow-left" size={20} color="#3D3426" />
      </Pressable>

      <ThemedText type="caption" style={styles.progress}>
        {index + 1} of {outfits.length} — tap like or skip
      </ThemedText>
      <ThemedText type="h2" style={styles.title}>Would you wear this?</ThemedText>
      <ThemedText type="body" style={styles.subtitle}>
        No wrong answers. This teaches your stylist in seconds.
      </ThemedText>

      {current ? (
        <View style={styles.cardWrap}>
          <Image source={current.image} style={styles.cardImage} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.cardGradient}>
            <ThemedText type="h3" style={styles.cardName}>{current.name}</ThemedText>
            <ThemedText type="small" style={styles.cardMeta}>{current.style} · {current.occasion}</ThemedText>
          </LinearGradient>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.passBtn]} onPress={() => handleChoice(false)}>
          <Feather name="x" size={28} color="#8B6F5C" />
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.likeBtn]} onPress={() => handleChoice(true)}>
          <Feather name="heart" size={28} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.xl, backgroundColor: '#FFF9F0' },
  back: { marginBottom: Spacing.md },
  progress: { opacity: 0.6, marginBottom: Spacing.xs },
  title: { color: '#3D3426' },
  subtitle: { color: '#5A4D3A', marginBottom: Spacing.lg, lineHeight: 22 },
  cardWrap: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.15,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  cardImage: { width: '100%', height: '100%' },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.lg,
  },
  cardName: { color: '#FFF' },
  cardMeta: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn: {
    backgroundColor: '#F0EBE4',
    borderWidth: 2,
    borderColor: '#E5DED4',
  },
  likeBtn: {
    backgroundColor: '#C9A87C',
  },
  doneContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  doneTitle: { textAlign: 'center', color: '#3D3426' },
  doneSub: { textAlign: 'center', color: '#5A4D3A', lineHeight: 24 },
  doneHint: { textAlign: 'center', color: '#8B6F5C', marginTop: Spacing.sm },
});
