import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/theme';
import { useTranslations } from "@/contexts/TranslationContext";

export function LoadingScreen() {
  const { theme } = useTheme();
  const { t } = useTranslations();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ThemedText style={styles.appName}>Dripn</ThemedText>
      
      <Image
        source={require('@/assets/images/dripn-logo-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      <ThemedText style={[styles.tagline, { color: theme.tabIconDefault }]}>
        {t('common.tagline') || 'Style that flows'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  appName: {
    fontSize: 42,
    fontWeight: '700',
    marginBottom: Spacing.xl,
    letterSpacing: 2,
  },
  logo: {
    width: 180,
    height: 180,
    marginVertical: Spacing.lg,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '400',
    marginTop: Spacing.xl,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
});
