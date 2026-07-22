import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { wardrobeTileBackground } from '@/utils/wardrobeImage';

type Props = {
  message?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

/**
 * Soft degraded UI when outfit/wardrobe visuals cannot render.
 * Not the full-screen ErrorFallback — stays inline in chat/cards.
 */
export function SoftRenderFallback({
  message = 'Outfit preview unavailable',
  style,
  compact = false,
}: Props) {
  const { isDark } = useTheme();
  const bg = wardrobeTileBackground(isDark);

  return (
    <View
      style={[
        styles.container,
        compact && styles.compact,
        { backgroundColor: bg },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={message}
    >
      <Feather name="image" size={compact ? 22 : 28} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)'} />
      <ThemedText
        type="small"
        lightColor="#8A7A68"
        darkColor="rgba(255,255,255,0.55)"
        style={styles.text}
      >
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignSelf: 'stretch',
  },
  compact: {
    minHeight: 72,
    paddingVertical: Spacing.md,
  },
  text: {
    textAlign: 'center',
  },
});
