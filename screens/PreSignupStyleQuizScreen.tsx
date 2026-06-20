import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Image, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/AuthStackNavigator';
import {
  getPreSignupQuizOutfits,
  type QuizOutfitGender,
} from '@/constants/preSignupQuizOutfits';
import {
  onboardingProfileService,
  type DressFor,
  type OnboardingProfile,
  QUIZ_SCREEN_COPY,
  DRESS_FOR_LABELS,
} from '@/services/OnboardingProfileService';
import { preSignupQuizService, type QuizCompletionSummary } from '@/services/PreSignupQuizService';
import { apiService } from '@/services/ApiService';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PreSignupStyleQuiz'>;
};

function defaultQuizGender(userGender: string | null | undefined): QuizOutfitGender {
  if (userGender === 'man') return 'male';
  return 'female';
}

export default function PreSignupStyleQuizScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [quizGender, setQuizGender] = useState<QuizOutfitGender>(() =>
    defaultQuizGender(user?.gender)
  );
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState(0);
  const [done, setDone] = useState(false);
  const [completion, setCompletion] = useState<QuizCompletionSummary | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [dressFor, setDressFor] = useState<DressFor>('myself');
  const [outfits, setOutfits] = useState(() => getPreSignupQuizOutfits('female', 'myself'));
  const [quizTitle, setQuizTitle] = useState(QUIZ_SCREEN_COPY.myself.title);
  const [quizSubtitle, setQuizSubtitle] = useState(QUIZ_SCREEN_COPY.myself.subtitle);
  const [deckLoading, setDeckLoading] = useState(true);

  const current = outfits[index];

  const loadDeck = useCallback(async (gender: QuizOutfitGender, userProfile: OnboardingProfile) => {
    setDeckLoading(true);
    const deck = await preSignupQuizService.buildDeck(gender, userProfile);
    setOutfits(deck.outfits);
    setQuizTitle(deck.title);
    setQuizSubtitle(deck.subtitle);
    setIndex(0);
    setLikes(0);
    setDeckLoading(false);
  }, []);

  useEffect(() => {
    onboardingProfileService.getProfile().then(async (loaded) => {
      const occasion = loaded.dressFor || 'myself';
      setDressFor(occasion);
      const gender = loaded.quizGender || defaultQuizGender(user?.gender);
      setQuizGender(gender);
      await loadDeck(gender, loaded);
    });
  }, [loadDeck, user?.gender]);

  const finishQuiz = useCallback(async () => {
    setCompletionLoading(true);
    await onboardingProfileService.completeQuiz();
    const profile = await onboardingProfileService.getProfile();
    const summary = await preSignupQuizService.getCompletionSummary(profile);
    setCompletion(summary);
    setCompletionLoading(false);
    setDone(true);
  }, []);

  const handleGenderChange = useCallback(async (gender: QuizOutfitGender) => {
    if (gender === quizGender) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuizGender(gender);
    const nextProfile = await onboardingProfileService.saveProfile({ quizGender: gender });
    await loadDeck(gender, nextProfile);
  }, [quizGender, loadDeck]);

  const handleChoice = useCallback(async (liked: boolean) => {
    if (!current) return;
    if (liked) {
      setLikes((n) => n + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await onboardingProfileService.recordQuizSwipe(
      liked,
      { id: current.id, name: current.name, style: current.style },
      dressFor,
    );

    if (user) {
      apiService.recordOutfitEngagement({
        items: current.items.map((item, i) => ({
          id: `presignup_${current.id}_${i}`,
          name: item.name,
          category: item.category,
        })),
        signal: liked ? 'liked' : 'skipped',
        occasion: current.occasion,
        contextSnapshot: {
          source: 'pre_signup_quiz',
          outfitId: current.id,
          style: current.style,
          quizGender,
          dressFor,
        },
      }).catch(() => {});
    }

    if (index + 1 >= outfits.length) {
      await finishQuiz();
    } else {
      setIndex((i) => i + 1);
    }
  }, [current, index, outfits.length, user, finishQuiz, quizGender, dressFor]);

  const handleContinue = () => {
    navigation.navigate('OnboardingEntry');
  };

  if (deckLoading) {
    return (
      <View style={[styles.container, styles.loadingState, { paddingTop: insets.top + Spacing.xl }]}>
        <ThemedText type="body" style={styles.loadingText}>
          Curating looks for {DRESS_FOR_LABELS[dressFor]}...
        </ThemedText>
      </View>
    );
  }

  if (!outfits.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <ThemedText type="h2" style={styles.title}>Almost there</ThemedText>
        <ThemedText type="body" style={styles.subtitle}>
          We could not load style picks for this occasion. Continue and your stylist will still decide for you.
        </ThemedText>
        <Button onPress={handleContinue} style={{ marginTop: Spacing.xl }}>Continue</Button>
      </View>
    );
  }

  if (done || completionLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.doneContent}>
          {completionLoading ? (
            <ThemedText type="body" style={styles.doneSub}>
              Reading your style picks...
            </ThemedText>
          ) : (
            <>
              <Feather name="check-circle" size={56} color="#C9A87C" />
              <ThemedText type="h1" style={styles.doneTitle}>
                {completion?.headline || 'We know your vibe'}
              </ThemedText>
              <ThemedText type="body" style={styles.doneSub}>
                {completion?.summary || "Got it — we'll use your picks to style you."}
              </ThemedText>
              <ThemedText type="small" style={styles.doneHint}>
                Next, choose how you want your stylist to help.
              </ThemedText>
            </>
          )}
        </View>
        {!completionLoading ? (
          <Button onPress={handleContinue}>Continue</Button>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Feather name="arrow-left" size={20} color="#3D3426" />
      </Pressable>

      <View style={styles.genderRow}>
        <ThemedText type="small" style={styles.genderLabel}>Show me outfits for</ThemedText>
        <View style={styles.genderToggle}>
          <Pressable
            onPress={() => handleGenderChange('female')}
            style={[styles.genderOption, quizGender === 'female' && styles.genderOptionActive]}
          >
            <Feather
              name="user"
              size={14}
              color={quizGender === 'female' ? '#FFF' : '#5A4D3A'}
            />
            <ThemedText
              type="small"
              style={[styles.genderOptionText, quizGender === 'female' && styles.genderOptionTextActive]}
            >
              Women
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleGenderChange('male')}
            style={[styles.genderOption, quizGender === 'male' && styles.genderOptionActive]}
          >
            <Feather
              name="user"
              size={14}
              color={quizGender === 'male' ? '#FFF' : '#5A4D3A'}
            />
            <ThemedText
              type="small"
              style={[styles.genderOptionText, quizGender === 'male' && styles.genderOptionTextActive]}
            >
              Men
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <ThemedText
        type="small"
        lightColor="#5A4D3A"
        darkColor="#3D3426"
        style={styles.progress}
      >
        {index + 1} of {outfits.length} — tap like or skip
      </ThemedText>
      <ThemedText type="h2" style={styles.title}>{quizTitle}</ThemedText>
      <ThemedText type="body" style={styles.subtitle}>
        {quizSubtitle}
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
  genderRow: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  genderLabel: {
    color: '#6B5E4C',
    fontWeight: '500',
  },
  genderToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0EBE4',
    borderRadius: BorderRadius.lg,
    padding: 4,
    gap: 4,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  genderOptionActive: {
    backgroundColor: LuxuryColors.gold,
  },
  genderOptionText: {
    color: '#5A4D3A',
    fontWeight: '600',
  },
  genderOptionTextActive: {
    color: '#FFF',
  },
  progress: {
    marginBottom: Spacing.xs,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
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
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    color: '#5A4D3A',
    textAlign: 'center',
    lineHeight: 24,
  },
});
