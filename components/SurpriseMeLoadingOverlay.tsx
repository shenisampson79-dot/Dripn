import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTranslations } from '@/contexts/TranslationContext';

type LoadingStep = {
  message: string;
  detail: string;
  icon: keyof typeof Feather.glyphMap;
};

function getLoadingSteps(
  stylistId: string,
  stylistName: string,
  t: (key: string) => string,
): LoadingStep[] {
  const tr = (key: string, vars?: Record<string, string | number>) => {
    let s = t(key) || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        s = s.replace(`{${k}}`, String(v));
      });
    }
    return s;
  };

  const iconsByStylist: Record<string, (keyof typeof Feather.glyphMap)[]> = {
    ruby: ['archive', 'grid', 'cloud', 'layers', 'star'],
    max: ['archive', 'filter', 'sun', 'layers', 'award'],
    ace: ['database', 'sliders', 'thermometer', 'layout', 'bar-chart-2'],
    ivy: ['book-open', 'aperture', 'map-pin', 'package', 'check-circle'],
    default: ['archive', 'grid', 'sun', 'layers', 'star'],
  };

  const prefix = ['ruby', 'max', 'ace', 'ivy'].includes(stylistId) ? stylistId : 'default';
  const icons = iconsByStylist[prefix];

  return [1, 2, 3, 4, 5].map((n, i) => ({
    message:
      prefix === 'default' && n === 1
        ? tr(`surpriseMe.default.1`, { name: stylistName })
        : tr(`surpriseMe.${prefix}.${n}`),
    detail: tr(`surpriseMe.${prefix}.${n}d`),
    icon: icons[i],
  }));
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
  const { t } = useTranslations();
  const tr = (key: string, vars?: Record<string, string | number>) => {
    let s = t(key) || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        s = s.replace(`{${k}}`, String(v));
      });
    }
    return s;
  };

  const steps = useMemo(
    () => getLoadingSteps(stylistId, stylistName, t),
    [stylistId, stylistName, t],
  );
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
            {tr('surpriseMe.stylingYou', { name: stylistName })}
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
            {tr('surpriseMe.stepOf', { current: stepIndex + 1, total: steps.length })}
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
