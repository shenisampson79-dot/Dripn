import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { LoopingBackgroundVideo } from '@/components/LoopingBackgroundVideo';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/AuthStackNavigator';
import {
  onboardingProfileService,
  StyleIdentity,
  DressFor,
} from '@/services/OnboardingProfileService';
import { videoRandomizer } from '@/services/VideoRandomizerService';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OnboardingProfile'>;
};

const IDENTITY_OPTIONS: {
  id: StyleIdentity;
  label: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    id: 'never_learned',
    label: 'I never really learned how to dress',
    subtitle: 'No shame — we decide for you.',
    icon: 'help-circle',
  },
  {
    id: 'starting_zero',
    label: 'I am starting from zero',
    subtitle: 'Basics, confidence, zero jargon.',
    icon: 'sunrise',
  },
  {
    id: 'level_up',
    label: 'I dress fine but want to level up',
    subtitle: 'Look sharper with less effort.',
    icon: 'trending-up',
  },
  {
    id: 'impress_someone',
    label: 'I want to impress someone specific',
    subtitle: 'Date, work, event — we optimise for it.',
    icon: 'star',
  },
];

const DRESS_FOR_OPTIONS: {
  id: DressFor;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: 'work', label: 'Work / meetings', icon: 'briefcase' },
  { id: 'date', label: 'Date or romance', icon: 'heart' },
  { id: 'friends', label: 'Friends / going out', icon: 'users' },
  { id: 'event', label: 'Event / special occasion', icon: 'calendar' },
  { id: 'myself', label: 'Just for me today', icon: 'user' },
];

export default function OnboardingProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<StyleIdentity | null>(null);
  const [dressFor, setDressFor] = useState<DressFor | null>(null);
  const [backgroundVideo] = useState(() => videoRandomizer.getNextVideo());

  const handleContinue = async () => {
    if (step === 0 && identity) {
      setStep(1);
      return;
    }
    if (step === 1) {
      await onboardingProfileService.saveProfile({
        identity: identity || undefined,
        dressFor: dressFor || 'myself',
      });
      navigation.navigate('PreSignupStyleQuiz');
    }
  };

  return (
    <View style={styles.container}>
      <LoopingBackgroundVideo
        source={backgroundVideo}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable onPress={() => (step > 0 ? setStep(0) : navigation.goBack())} style={styles.back}>
          <Feather name="arrow-left" size={20} color="#FFF" />
        </Pressable>

        <Animated.View
          key={step}
          entering={FadeInRight.duration(280)}
          exiting={FadeOutLeft.duration(200)}
          style={styles.body}
        >
          {step === 0 ? (
            <>
              <ThemedText type="h1" style={styles.headline}>
                Which sounds most like you?
              </ThemedText>
              <ThemedText type="body" style={styles.sub}>
                We will tailor how decisive your stylist is — and how much we explain.
              </ThemedText>
              <View style={styles.options}>
                {IDENTITY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setIdentity(opt.id)}
                    style={[
                      styles.option,
                      identity === opt.id && styles.optionSelected,
                    ]}
                  >
                    <Feather name={opt.icon} size={20} color="#FFF" />
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={styles.optionLabel}>{opt.label}</ThemedText>
                      <ThemedText type="small" style={styles.optionSub}>{opt.subtitle}</ThemedText>
                    </View>
                    {identity === opt.id ? <Feather name="check-circle" size={20} color="#C9A87C" /> : null}
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <ThemedText type="h1" style={styles.headline}>
                Who are you dressing for most right now?
              </ThemedText>
              <ThemedText type="body" style={styles.sub}>
                We use this to pick outfits that make you look better than everyone else in that room.
              </ThemedText>
              <View style={styles.options}>
                {DRESS_FOR_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setDressFor(opt.id)}
                    style={[
                      styles.option,
                      dressFor === opt.id && styles.optionSelected,
                    ]}
                  >
                    <Feather name={opt.icon} size={20} color="#FFF" />
                    <ThemedText type="body" style={[styles.optionLabel, { flex: 1 }]}>{opt.label}</ThemedText>
                    {dressFor === opt.id ? <Feather name="check-circle" size={20} color="#C9A87C" /> : null}
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Animated.View>

        <Button
          onPress={handleContinue}
          disabled={step === 0 ? !identity : false}
          style={styles.cta}
        >
          {step === 0 ? 'Continue' : dressFor ? 'Pick outfits I like' : 'Skip — surprise me'}
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  body: { flex: 1 },
  headline: { color: '#FFF', marginBottom: Spacing.sm },
  sub: { color: 'rgba(255,255,255,0.88)', marginBottom: Spacing.xl, lineHeight: 22 },
  options: { gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  optionSelected: {
    borderColor: '#C9A87C',
    backgroundColor: 'rgba(201,168,124,0.15)',
  },
  optionText: { flex: 1 },
  optionLabel: { color: '#FFF', fontWeight: '600' },
  optionSub: { color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  cta: { marginTop: Spacing.lg },
});
