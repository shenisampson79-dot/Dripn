import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  onboardingProfileService,
  TodaysOutfit,
} from '@/services/OnboardingProfileService';

type Props = {
  onOpenStylist?: (prompt: string) => void;
  onRefresh?: () => void;
};

export function TodaysOutfitCard({ onOpenStylist, onRefresh }: Props) {
  const { theme, isDark } = useTheme();
  const [outfit, setOutfit] = useState<TodaysOutfit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await onboardingProfileService.getTodaysOutfit();
    setOutfit(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return null;
  if (!outfit) return null;

  const handleWearThis = () => {
    onOpenStylist?.(`Confirm today's outfit: ${outfit.outfit}`);
  };

  const handleAnother = async () => {
    const profile = await onboardingProfileService.getProfile();
    const next = await onboardingProfileService.refreshTodaysOutfit(profile);
    setOutfit(next);
    onRefresh?.();
  };

  return (
    <Card style={styles.card}>
      <LinearGradient
        colors={isDark ? ['#2A2420', '#1A1614'] : ['#F5E6D3', '#FFF9F0']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <Feather name="zap" size={14} color="#C9A87C" />
            <ThemedText type="caption" style={styles.badgeText}>Decided for you</ThemedText>
          </View>
          <ThemedText type="h3" style={styles.title}>Today&apos;s outfit</ThemedText>
          <ThemedText type="small" style={[styles.sub, { color: theme.tabIconDefault }]}>
            No decisions. Just wear this.
          </ThemedText>
        </View>

        <ThemedText type="body" style={styles.outfitText}>{outfit.outfit}</ThemedText>
        <ThemedText type="small" style={[styles.reason, { color: theme.tabIconDefault }]}>
          {outfit.reasoning}
        </ThemedText>
        {outfit.whyRule ? (
          <View style={[styles.ruleBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(201,168,124,0.15)' }]}>
            <Feather name="book-open" size={14} color="#C9A87C" />
            <ThemedText type="small" style={styles.ruleText}>{outfit.whyRule}</ThemedText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={[styles.primaryBtn, { backgroundColor: theme.link }]} onPress={handleWearThis}>
            <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: '600' }}>Wear this</ThemedText>
          </Pressable>
          <Pressable style={[styles.secondaryBtn, { borderColor: theme.border }]} onPress={handleAnother}>
            <ThemedText type="small" style={{ color: theme.text }}>Pick another</ThemedText>
          </Pressable>
        </View>
      </LinearGradient>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.lg, overflow: 'hidden', padding: 0 },
  gradient: { padding: Spacing.lg, borderRadius: BorderRadius.lg },
  header: { marginBottom: Spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
  badgeText: { color: '#C9A87C', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { marginBottom: 4 },
  sub: {},
  outfitText: { lineHeight: 24, fontWeight: '500', marginBottom: Spacing.sm },
  reason: { lineHeight: 20, marginBottom: Spacing.md },
  ruleBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  ruleText: { flex: 1, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  primaryBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
