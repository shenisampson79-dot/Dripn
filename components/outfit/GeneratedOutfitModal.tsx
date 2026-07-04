import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WardrobeItemImage } from '@/components/WardrobeItemImage';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { CATEGORY_LABELS, type WardrobeItem } from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';
import { wardrobeProcessedTileBackground, wardrobeTileBackground } from '@/utils/wardrobeImage';

export type GeneratedOutfitModalData = {
  items: WardrobeItem[];
  stylistMessage?: string;
};

type Props = {
  visible: boolean;
  outfit: GeneratedOutfitModalData | null;
  onClose: () => void;
};

export function GeneratedOutfitModal({ visible, outfit, onClose }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: isDark ? theme.backgroundDefault : '#FFFFFF' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h2">Your Perfect Outfit</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {outfit?.items?.map((item, idx) => {
              const hasProcessedImage = item.imageProcessed === true;
              const tileBackground = hasProcessedImage
                ? wardrobeProcessedTileBackground()
                : wardrobeTileBackground(isDark);

              return (
                <View key={`${item.id}-${idx}`} style={styles.row}>
                  <View style={[styles.imageWrap, { backgroundColor: tileBackground }]}>
                    <WardrobeItemImage
                      item={item}
                      style={styles.image}
                      processed={hasProcessedImage}
                      preferCover={!hasProcessedImage}
                      tileBackgroundColor={tileBackground}
                    />
                  </View>
                  <View style={styles.info}>
                    <ThemedText type="body" numberOfLines={2}>{item.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </ThemedText>
                  </View>
                </View>
              );
            })}

            {outfit?.stylistMessage ? (
              <View style={styles.stylistMessage}>
                <ThemedText style={{ fontSize: 14, fontStyle: 'italic', color: theme.tabIconDefault }}>
                  "{outfit.stylistMessage}"
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                Got it!
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  imageWrap: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
  },
  stylistMessage: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  button: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: LuxuryColors.violet,
    alignItems: 'center',
  },
});
