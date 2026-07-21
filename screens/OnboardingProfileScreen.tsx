import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { LoopingBackgroundVideo } from '@/components/LoopingBackgroundVideo';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { AuthStackParamList } from '@/navigation/AuthStackNavigator';
import {
  onboardingProfileService,
  StyleIdentity,
  DressFor,
} from '@/services/OnboardingProfileService';
import { videoRandomizer } from '@/services/VideoRandomizerService';
import { useTranslations } from '@/contexts/TranslationContext';
import { apiService } from '@/services/ApiService';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OnboardingProfile'>;
};

/**
 * Simplified Get Styled path (frontend only).
 * When false, restores occasion → PreSignupStyleQuiz → OnboardingEntry
 * (Decide for me / Style me properly). Screens + backend routes stay registered.
 */
const SHOW_FULL_PRE_STYLIST_FLOW = false;

const IDENTITY_IDS: {
  id: StyleIdentity;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: 'never_learned', icon: 'help-circle' },
  { id: 'starting_zero', icon: 'sunrise' },
  { id: 'level_up', icon: 'trending-up' },
  { id: 'impress_someone', icon: 'star' },
];

const DRESS_FOR_IDS: {
  id: DressFor;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: 'work', icon: 'briefcase' },
  { id: 'date', icon: 'heart' },
  { id: 'friends', icon: 'users' },
  { id: 'event', icon: 'calendar' },
  { id: 'myself', icon: 'user' },
];

export default function OnboardingProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<StyleIdentity | null>(null);
  const [dressFor, setDressFor] = useState<DressFor | null>(null);
  const [backgroundVideo] = useState(() => videoRandomizer.getNextVideo({ tone: 'confidence' }));

  const ui = useMemo(
    () => ({
      gradientColors: isDark
        ? (['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)'] as const)
        : (['rgba(250,248,245,0.78)', 'rgba(250,248,245,0.9)', 'rgba(250,248,245,0.98)'] as const),
      gradientLocations: isDark ? ([0, 0.35, 1] as const) : ([0, 0.2, 1] as const),
      headline: isDark ? '#FFFFFF' : theme.text,
      sub: isDark ? 'rgba(255,255,255,0.88)' : '#5A4D3A',
      icon: isDark ? '#FFFFFF' : theme.text,
      backBg: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.72)',
      backIcon: isDark ? '#FFFFFF' : theme.text,
      optionBg: isDark ? 'rgba(255,255,255,0.08)' : theme.backgroundDefault,
      optionBorder: isDark ? 'rgba(255,255,255,0.12)' : theme.border,
      optionSelectedBg: isDark ? 'rgba(201,168,124,0.15)' : 'rgba(201,168,124,0.22)',
      optionLabel: isDark ? '#FFFFFF' : theme.text,
      optionSub: isDark ? 'rgba(255,255,255,0.75)' : '#6B5E4C',
      rootBg: isDark ? '#0D0B09' : theme.backgroundRoot,
    }),
    [isDark, theme]
  );

  const identityOptions = useMemo(
    () =>
      IDENTITY_IDS.map((opt) => ({
        ...opt,
        label:
          t(`onboardingProfile.identity.${opt.id}.label`) ||
          ({
            never_learned: 'I never really learned how to dress',
            starting_zero: 'I am starting from zero',
            level_up: 'I dress fine but want to level up',
            impress_someone: 'I want to impress someone specific',
          } as Record<string, string>)[opt.id] ||
          opt.id,
        subtitle:
          t(`onboardingProfile.identity.${opt.id}.subtitle`) ||
          ({
            never_learned: 'No shame — we decide for you.',
            starting_zero: 'Basics, confidence, zero jargon.',
            level_up: 'Look sharper with less effort.',
            impress_someone: 'Date, work, event — we optimise for it.',
          } as Record<string, string>)[opt.id] ||
          '',
      })),
    [t]
  );

  const dressForOptions = useMemo(
    () =>
      DRESS_FOR_IDS.map((opt) => ({
        ...opt,
        label:
          t(`onboardingProfile.dressFor.${opt.id}`) ||
          ({
            work: 'Work / meetings',
            date: 'Date or romance',
            friends: 'Friends / going out',
            event: 'Event / special occasion',
            myself: 'Just for me today',
          } as Record<string, string>)[opt.id] ||
          opt.id,
      })),
    [t]
  );

  /** Same destination as OnboardingEntry "See how it works before signing up". */
  const goToChooseStylist = async () => {
    await onboardingProfileService.saveProfile({
      identity: identity || undefined,
      dressFor: dressFor || 'myself',
      quizLikes: [],
      likedStyles: [],
      quizComplete: false,
    });
    try {
      await apiService.post<{ immediateChat?: boolean; browsingMode?: boolean }>(
        '/api/onboarding/entry-choice',
        { choice: 'just_browsing' },
      );
    } catch {
      console.log('Failed to track browsing choice');
    }
    navigation.navigate('GuestBrowse');
  };

  const handleContinue = async () => {
    if (!SHOW_FULL_PRE_STYLIST_FLOW) {
      if (!identity) return;
      await goToChooseStylist();
      return;
    }

    if (step === 0 && identity) {
      setStep(1);
      return;
    }
    if (step === 1) {
      await onboardingProfileService.saveProfile({
        identity: identity || undefined,
        dressFor: dressFor || 'myself',
        quizLikes: [],
        likedStyles: [],
        quizComplete: false,
      });
      navigation.navigate('PreSignupStyleQuiz');
    }
  };

  const showingOccasion = SHOW_FULL_PRE_STYLIST_FLOW && step === 1;

  return (
    <View style={[styles.container, { backgroundColor: ui.rootBg }]}>
      <LoopingBackgroundVideo source={backgroundVideo} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={ui.gradientColors}
        locations={ui.gradientLocations}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={() => (showingOccasion ? setStep(0) : navigation.goBack())}
          style={[styles.back, { backgroundColor: ui.backBg }]}
        >
          <Feather name="arrow-left" size={20} color={ui.backIcon} />
        </Pressable>

        <Animated.View
          key={showingOccasion ? 1 : 0}
          entering={FadeInRight.duration(280)}
          exiting={FadeOutLeft.duration(200)}
          style={styles.body}
        >
          {!showingOccasion ? (
            <>
              <ThemedText type="h1" style={[styles.headline, { color: ui.headline }]}>
                {t('onboardingProfile.identityTitle') || 'Which sounds most like you?'}
              </ThemedText>
              <ThemedText type="body" style={[styles.sub, { color: ui.sub }]}>
                {t('onboardingProfile.identitySubtitle') ||
                  'We will tailor how decisive your stylist is — and how much we explain.'}
              </ThemedText>
              <View style={styles.options}>
                {identityOptions.map((opt) => {
                  const selected = identity === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setIdentity(opt.id)}
                      style={[
                        styles.option,
                        {
                          backgroundColor: selected ? ui.optionSelectedBg : ui.optionBg,
                          borderColor: selected ? LuxuryColors.gold : ui.optionBorder,
                        },
                      ]}
                    >
                      <Feather name={opt.icon} size={20} color={selected ? LuxuryColors.gold : ui.icon} />
                      <View style={styles.optionText}>
                        <ThemedText type="body" style={[styles.optionLabel, { color: ui.optionLabel }]}>
                          {opt.label}
                        </ThemedText>
                        <ThemedText type="small" style={[styles.optionSub, { color: ui.optionSub }]}>
                          {opt.subtitle}
                        </ThemedText>
                      </View>
                      {selected ? <Feather name="check-circle" size={20} color={LuxuryColors.gold} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <ThemedText type="h1" style={[styles.headline, { color: ui.headline }]}>
                {t('onboardingProfile.occasionTitle') || "What's the occasion?"}
              </ThemedText>
              <ThemedText type="body" style={[styles.sub, { color: ui.sub }]}>
                {t('onboardingProfile.occasionSubtitle') ||
                  "We'll tailor your outfit to the moment — or skip if you're just dressing for yourself."}
              </ThemedText>
              <View style={styles.options}>
                {dressForOptions.map((opt) => {
                  const selected = dressFor === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setDressFor(opt.id)}
                      style={[
                        styles.option,
                        {
                          backgroundColor: selected ? ui.optionSelectedBg : ui.optionBg,
                          borderColor: selected ? LuxuryColors.gold : ui.optionBorder,
                        },
                      ]}
                    >
                      <Feather name={opt.icon} size={20} color={selected ? LuxuryColors.gold : ui.icon} />
                      <ThemedText type="body" style={[styles.optionLabel, { flex: 1, color: ui.optionLabel }]}>
                        {opt.label}
                      </ThemedText>
                      {selected ? <Feather name="check-circle" size={20} color={LuxuryColors.gold} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Animated.View>

        <Button
          onPress={handleContinue}
          disabled={!identity && !showingOccasion}
          style={styles.cta}
        >
          {!showingOccasion
            ? t('onboardingProfile.continue') || t('common.continue') || 'Continue'
            : dressFor
              ? t('onboardingProfile.pickOutfits') || 'Pick outfits I like'
              : t('onboardingProfile.skipSurprise') || 'Skip — surprise me'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: Spacing.xl },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  body: { flex: 1 },
  headline: { marginBottom: Spacing.sm },
  sub: { marginBottom: Spacing.xl, lineHeight: 22 },
  options: { gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionText: { flex: 1 },
  optionLabel: { fontWeight: '600', marginBottom: 2 },
  optionSub: { lineHeight: 18 },
  cta: { marginTop: Spacing.lg },
});
