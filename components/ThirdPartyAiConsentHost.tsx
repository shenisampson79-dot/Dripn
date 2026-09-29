import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  hydrateThirdPartyAiConsent,
  registerThirdPartyAiConsentPresenter,
  THIRD_PARTY_AI_CONSENT_COPY,
} from '@/utils/thirdPartyAiConsent';

/**
 * App-level host: presents the Apple 5.1 AI-sharing consent sheet.
 * Registered so `ensureThirdPartyAiConsent()` can await a user choice.
 */
export function ThirdPartyAiConsentHost() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const resolverRef = useRef<((allowed: boolean) => void) | null>(null);

  const close = useCallback((allowed: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setVisible(false);
    resolve?.(allowed);
  }, []);

  useEffect(() => {
    void hydrateThirdPartyAiConsent();
    registerThirdPartyAiConsentPresenter(
      () =>
        new Promise<boolean>((resolve) => {
          resolverRef.current = resolve;
          setVisible(true);
        }),
    );
    return () => {
      registerThirdPartyAiConsentPresenter(null);
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  const copy = THIRD_PARTY_AI_CONSENT_COPY;
  const cardBg = isDark ? '#1A1612' : '#FFFFFF';
  const muted = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.68)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => close(false)}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}
        >
          <ThemedText type="h3" style={styles.title}>
            {copy.title}
          </ThemedText>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText type="body" style={[styles.paragraph, { color: muted }]}>
              {copy.intro}
            </ThemedText>
            <ThemedText type="body" style={[styles.paragraph, { color: muted }]}>
              {copy.depending}
            </ThemedText>
            {copy.categories.map((line) => (
              <ThemedText key={line} type="body" style={[styles.bullet, { color: muted }]}>
                {`• ${line}`}
              </ThemedText>
            ))}
            <ThemedText type="body" style={[styles.paragraph, styles.providersHeading, { color: theme.text }]}>
              {copy.providersHeading}
            </ThemedText>
            {copy.providers.map((line) => (
              <ThemedText key={line} type="body" style={[styles.bullet, { color: muted }]}>
                {`• ${line}`}
              </ThemedText>
            ))}
            <ThemedText type="body" style={[styles.paragraph, { color: muted }]}>
              {copy.footer}
            </ThemedText>
          </ScrollView>
          <Pressable
            onPress={() => close(true)}
            style={({ pressed }) => [styles.allowButton, { opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={copy.allow}
          >
            <ThemedText type="body" style={styles.allowLabel}>
              {copy.allow}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => close(false)}
            style={({ pressed }) => [styles.denyButton, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={copy.deny}
          >
            <ThemedText type="body" style={[styles.denyLabel, { color: theme.text }]}>
              {copy.deny}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: '86%',
  },
  title: {
    marginBottom: Spacing.sm,
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  paragraph: {
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  providersHeading: {
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  bullet: {
    lineHeight: 22,
    marginBottom: 4,
    paddingLeft: Spacing.xs,
  },
  allowButton: {
    backgroundColor: LuxuryColors.teal,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  allowLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  denyButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  denyLabel: {
    fontWeight: '500',
  },
});
