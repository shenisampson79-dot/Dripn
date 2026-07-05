import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';

type LoadingStep = {
  message: string;
  detail: string;
  icon: keyof typeof Feather.glyphMap;
};

function getLoadingSteps(stylistId: string, stylistName: string): LoadingStep[] {
  const byStylist: Record<string, LoadingStep[]> = {
    ruby: [
      { message: 'Opening your wardrobe, love', detail: 'Pulling up everything you own', icon: 'archive' },
      { message: 'Browsing your pieces', detail: 'Shirts, trousers, shoes — the lot', icon: 'grid' },
      { message: 'Reading the room', detail: 'Weather, occasion, and your notes', icon: 'cloud' },
      { message: 'Building your look', detail: 'Layering pieces that work together', icon: 'layers' },
      { message: 'Almost ready', detail: 'Scoring the outfit and writing your notes', icon: 'star' },
    ],
    max: [
      { message: 'Digging into your wardrobe', detail: 'Finding what actually works', icon: 'archive' },
      { message: 'Shortlisting pieces', detail: 'No filler — only strong options', icon: 'filter' },
      { message: 'Factoring in your day', detail: 'Context, weather, dress code', icon: 'sun' },
      { message: 'Assembling the outfit', detail: 'Top to toe, styled properly', icon: 'layers' },
      { message: 'Final rating', detail: 'Honest score coming up', icon: 'award' },
    ],
    ace: [
      { message: 'Accessing wardrobe', detail: 'Loading your owned items', icon: 'database' },
      { message: 'Filtering candidates', detail: 'Occasion-appropriate pieces only', icon: 'sliders' },
      { message: 'Applying context', detail: 'Temperature and setting', icon: 'thermometer' },
      { message: 'Composing outfit', detail: 'Structured from your clothes', icon: 'layout' },
      { message: 'Calculating rating', detail: 'Style score in progress', icon: 'bar-chart-2' },
    ],
    ivy: [
      { message: 'Reviewing your wardrobe', detail: 'Cataloguing available pieces', icon: 'book-open' },
      { message: 'Selecting combinations', detail: 'Proportion, colour, and balance', icon: 'aperture' },
      { message: 'Considering the context', detail: 'Your brief and the conditions', icon: 'map-pin' },
      { message: 'Curating your outfit', detail: 'A considered look from your rail', icon: 'package' },
      { message: 'Preparing your verdict', detail: 'Rating and styling notes', icon: 'check-circle' },
    ],
  };

  const steps = byStylist[stylistId] || [
    { message: `${stylistName} is on it`, detail: 'Opening your wardrobe', icon: 'archive' as const },
    { message: 'Browsing your pieces', detail: 'Finding the best combination', icon: 'grid' as const },
    { message: 'Matching your context', detail: 'Occasion, weather, and vibe', icon: 'sun' as const },
    { message: 'Putting the look together', detail: 'Layering your outfit', icon: 'layers' as const },
    { message: 'Almost there', detail: 'Rating and final touches', icon: 'star' as const },
  ];

  return steps;
}

type Props = {
  visible: boolean;
  stylistId: string;
  stylistName: string;
  stylistGradient: readonly [string, string];
  stylistIcon: keyof typeof Feather.glyphMap;
};

export function SurpriseMeLoadingOverlay({
  visible,
  stylistId,
  stylistName,
  stylistGradient,
  stylistIcon,
}: Props) {
  const steps = useMemo(() => getLoadingSteps(stylistId, stylistName), [stylistId, stylistName]);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [visible, steps.length]);

  const current = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient colors={stylistGradient} style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              <Feather name={stylistIcon} size={28} color="#FFFFFF" />
            </View>
          </LinearGradient>

          <ActivityIndicator size="large" color="#C9A87C" style={styles.spinner} />

          <ThemedText type="h3" style={styles.title}>
            {stylistName} is styling you
          </ThemedText>

          <View style={styles.messageBlock}>
            <Feather name={current.icon} size={18} color="#C9A87C" style={styles.stepIcon} />
            <View style={styles.messageText}>
              <ThemedText type="body" style={styles.message}>
                {current.message}
              </ThemedText>
              <ThemedText type="small" style={styles.detail}>
                {current.detail}
              </ThemedText>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <ThemedText type="caption" style={styles.stepCounter}>
            Step {stepIndex + 1} of {steps.length}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 11, 9, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: Spacing.xl,
    alignItems: 'center',
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginBottom: Spacing.md,
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  messageBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: Spacing.lg,
    minHeight: 56,
  },
  stepIcon: {
    marginTop: 2,
    marginRight: Spacing.sm,
  },
  messageText: {
    flex: 1,
  },
  message: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  detail: {
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#C9A87C',
  },
  stepCounter: {
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
});
