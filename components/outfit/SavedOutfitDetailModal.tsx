import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function SavedOutfitDetailModal({ visible, onClose, children }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.min(windowHeight * 0.82, windowHeight - insets.top - Spacing.lg);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: isDark ? theme.backgroundDefault : '#FFFFFF',
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <ThemedText type="h3">Outfit details</ThemedText>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            bounces
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sheet: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});

export function SavedOutfitBadge({
  colors,
  icon,
  label,
}: {
  colors: readonly [string, string];
  icon: keyof typeof Feather.glyphMap;
  label: string;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
      }}
    >
      <Feather name={icon} size={10} color="#FFFFFF" />
      <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 10 }}>
        {label}
      </ThemedText>
    </LinearGradient>
  );
}
