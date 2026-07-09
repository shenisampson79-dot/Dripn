import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from "@/contexts/TranslationContext";

type IllustrationProps = {
  accent: string;
  surface: string;
  ink: string;
  muted: string;
};

function FlatLayVisual({ accent, surface, ink, muted }: IllustrationProps) {
  return (
    <View style={illuStyles.canvas}>
      <View style={[illuStyles.table, { backgroundColor: surface, borderColor: muted }]} />
      <View style={[illuStyles.shirtBody, { backgroundColor: accent }]} />
      <View style={[illuStyles.shirtSleeveLeft, { backgroundColor: accent }]} />
      <View style={[illuStyles.shirtSleeveRight, { backgroundColor: accent }]} />
      <View style={[illuStyles.shirtNeck, { borderColor: surface }]} />
      <View style={[illuStyles.guideLine, { backgroundColor: ink, opacity: 0.15 }]} />
    </View>
  );
}

function NaturalLightVisual({ accent, surface, ink, muted }: IllustrationProps) {
  return (
    <View style={illuStyles.canvas}>
      <View style={[illuStyles.windowFrame, { borderColor: muted, backgroundColor: surface }]}>
        <View style={[illuStyles.sunCore, { backgroundColor: '#F5C842' }]} />
        <View style={[illuStyles.sunRay, illuStyles.sunRay1, { backgroundColor: '#F5C842' }]} />
        <View style={[illuStyles.sunRay, illuStyles.sunRay2, { backgroundColor: '#F5C842' }]} />
        <View style={[illuStyles.sunRay, illuStyles.sunRay3, { backgroundColor: '#F5C842' }]} />
      </View>
      <View style={[illuStyles.floorPatch, { backgroundColor: surface, borderColor: muted }]} />
      <View style={[illuStyles.floorItem, { backgroundColor: accent }]} />
      <View style={[illuStyles.lightBeam, { backgroundColor: '#F5C842', opacity: 0.18 }]} />
    </View>
  );
}

function PlainBackgroundVisual({ accent, surface, ink, muted }: IllustrationProps) {
  return (
    <View style={illuStyles.canvas}>
      <View style={[illuStyles.plainCard, { backgroundColor: '#FFFFFF', borderColor: muted }]} />
      <View style={[illuStyles.plainItem, { backgroundColor: accent }]} />
      <View style={[illuStyles.noiseDot, { backgroundColor: muted, top: 8, left: 10, opacity: 0 }]} />
      <View style={[illuStyles.strike, { backgroundColor: '#FF3B30', opacity: 0.55 }]} />
      <View style={[illuStyles.strikeX1, { backgroundColor: '#FF3B30' }]} />
      <View style={[illuStyles.strikeX2, { backgroundColor: '#FF3B30' }]} />
      <View style={[illuStyles.clutter, { backgroundColor: muted, opacity: 0.35 }]} />
    </View>
  );
}

function FillFrameVisual({ accent, surface, ink }: IllustrationProps) {
  return (
    <View style={illuStyles.canvas}>
      <View style={[illuStyles.frameCorner, illuStyles.frameTL, { borderColor: ink }]} />
      <View style={[illuStyles.frameCorner, illuStyles.frameTR, { borderColor: ink }]} />
      <View style={[illuStyles.frameCorner, illuStyles.frameBL, { borderColor: ink }]} />
      <View style={[illuStyles.frameCorner, illuStyles.frameBR, { borderColor: ink }]} />
      <View style={[illuStyles.frameItem, { backgroundColor: accent }]} />
      <View style={[illuStyles.frameItemInner, { backgroundColor: surface, opacity: 0.25 }]} />
    </View>
  );
}

function SmoothVisual({ accent, surface, ink, muted }: IllustrationProps) {
  return (
    <View style={illuStyles.canvas}>
      <View style={[illuStyles.fabricPanel, { backgroundColor: surface, borderColor: muted }]} />
      <View style={[illuStyles.smoothWave, { borderColor: accent }]} />
      <View style={[illuStyles.smoothWave2, { borderColor: accent }]} />
      <View style={[illuStyles.wrinkleBad, { backgroundColor: '#FF3B30', opacity: 0.7 }]} />
      <View style={[illuStyles.wrinkleBad2, { backgroundColor: '#FF3B30', opacity: 0.7 }]} />
      <View style={[illuStyles.goodBadge, { backgroundColor: '#34C759' }]}>
        <Feather name="check" size={8} color="#FFFFFF" />
      </View>
    </View>
  );
}

function StraightShotVisual({ accent, surface, ink, muted }: IllustrationProps) {
  return (
    <View style={illuStyles.canvas}>
      <View style={[illuStyles.topSurface, { backgroundColor: surface, borderColor: muted }]} />
      <View style={[illuStyles.topGarment, { backgroundColor: accent }]} />
      <View style={[illuStyles.phoneBody, { backgroundColor: ink, borderColor: muted }]}>
        <View style={[illuStyles.phoneLens, { backgroundColor: surface }]} />
      </View>
      <View style={[illuStyles.downArrow, { borderColor: ink }]} />
    </View>
  );
}

const PHOTO_TIP_VISUALS = [
  {
    id: 'flat',
    label: 'Lay flat',
    caption: 'Smooth on a neutral surface',
    Visual: FlatLayVisual,
  },
  {
    id: 'light',
    label: 'Natural light',
    caption: 'Bright, even daylight',
    Visual: NaturalLightVisual,
  },
  {
    id: 'background',
    label: 'Plain background',
    caption: 'No clutter behind item',
    Visual: PlainBackgroundVisual,
  },
  {
    id: 'frame',
    label: 'Fill frame',
    caption: 'Show the whole garment',
    Visual: FillFrameVisual,
  },
  {
    id: 'smooth',
    label: 'No wrinkles',
    caption: 'Straighten folds first',
    Visual: SmoothVisual,
  },
  {
    id: 'angle',
    label: 'Shoot straight',
    caption: 'Camera parallel above',
    Visual: StraightShotVisual,
  },
] as const;

type WardrobePhotoTipsGuideProps = {
  onSeeAll?: () => void;
  compact?: boolean;
};

export function WardrobePhotoTipsGuide({ onSeeAll, compact = false }: WardrobePhotoTipsGuideProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const ink = theme.text;
  const muted = theme.tabIconDefault;
  const surface = theme.backgroundDefault;
  const accent = theme.link;

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Feather name="camera" size={16} color={theme.link} />
          <ThemedText type="body" style={styles.headerTitle}>
            {t('wardrobe.photoTipsTitle') || 'Photo tips for best results'}
          </ThemedText>
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAllButton}>
            <ThemedText type="caption" style={{ color: theme.link, fontWeight: '600' }}>
              {t('wardrobe.seeAll') || 'See all'}
            </ThemedText>
            <Feather name="chevron-right" size={14} color={theme.link} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {PHOTO_TIP_VISUALS.map((tip) => {
          const Visual = tip.Visual;
          return (
            <View
              key={tip.id}
              style={[styles.tipCard, { backgroundColor: theme.backgroundDefault, borderColor: muted + '33' }]}
            >
              <View style={styles.visualSlot}>
                <Visual accent={accent} surface={surface} ink={ink} muted={muted} />
              </View>
              <ThemedText type="caption" style={styles.tipLabel}>
                {tip.label}
              </ThemedText>
              {!compact ? (
                <ThemedText
                  type="caption"
                  style={[styles.tipCaption, { color: theme.tabIconDefault }]}
                  numberOfLines={2}
                >
                  {tip.caption}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.xl,
  },
  wrapCompact: {
    marginTop: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerTitle: {
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  scrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  tipCard: {
    width: 108,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  visualSlot: {
    width: 88,
    height: 64,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
  tipCaption: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
});

const illuStyles = StyleSheet.create({
  canvas: {
    width: 88,
    height: 64,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  table: {
    position: 'absolute',
    bottom: 6,
    width: 72,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
  },
  shirtBody: {
    position: 'absolute',
    bottom: 16,
    width: 34,
    height: 30,
    borderRadius: 6,
  },
  shirtSleeveLeft: {
    position: 'absolute',
    bottom: 22,
    left: 18,
    width: 14,
    height: 8,
    borderRadius: 3,
  },
  shirtSleeveRight: {
    position: 'absolute',
    bottom: 22,
    right: 18,
    width: 14,
    height: 8,
    borderRadius: 3,
  },
  shirtNeck: {
    position: 'absolute',
    bottom: 40,
    width: 10,
    height: 6,
    borderWidth: 2,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  guideLine: {
    position: 'absolute',
    bottom: 14,
    width: 56,
    height: 1,
  },
  windowFrame: {
    position: 'absolute',
    top: 4,
    left: 8,
    width: 28,
    height: 34,
    borderWidth: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sunCore: {
    position: 'absolute',
    top: 4,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sunRay: {
    position: 'absolute',
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  sunRay1: { top: 1, right: 8, transform: [{ rotate: '0deg' }] },
  sunRay2: { top: 6, right: 1, transform: [{ rotate: '55deg' }] },
  sunRay3: { top: 12, right: 2, transform: [{ rotate: '-40deg' }] },
  floorPatch: {
    position: 'absolute',
    bottom: 6,
    width: 64,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
  },
  floorItem: {
    position: 'absolute',
    bottom: 12,
    width: 28,
    height: 16,
    borderRadius: 4,
  },
  lightBeam: {
    position: 'absolute',
    top: 18,
    left: 24,
    width: 34,
    height: 24,
    borderTopLeftRadius: 2,
    borderBottomRightRadius: 18,
    transform: [{ rotate: '18deg' }],
  },
  plainCard: {
    position: 'absolute',
    width: 58,
    height: 46,
    borderRadius: 6,
    borderWidth: 1,
  },
  plainItem: {
    position: 'absolute',
    width: 30,
    height: 24,
    borderRadius: 5,
  },
  noiseDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  strike: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 22,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-28deg' }],
  },
  strikeX1: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    width: 14,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
    opacity: 0.45,
  },
  strikeX2: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    width: 14,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
    opacity: 0.45,
  },
  clutter: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 16,
    height: 10,
    borderRadius: 3,
  },
  frameCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderWidth: 2,
  },
  frameTL: { top: 8, left: 14, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 3 },
  frameTR: { top: 8, right: 14, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 3 },
  frameBL: { bottom: 8, left: 14, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 3 },
  frameBR: { bottom: 8, right: 14, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 3 },
  frameItem: {
    width: 42,
    height: 34,
    borderRadius: 6,
  },
  frameItemInner: {
    position: 'absolute',
    width: 16,
    height: 10,
    borderRadius: 3,
    top: 8,
  },
  fabricPanel: {
    position: 'absolute',
    width: 64,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
  },
  smoothWave: {
    position: 'absolute',
    width: 36,
    height: 18,
    borderBottomWidth: 2,
    borderColor: '#34C759',
    borderRadius: 18,
    top: 20,
  },
  smoothWave2: {
    position: 'absolute',
    width: 28,
    height: 12,
    borderBottomWidth: 2,
    borderRadius: 12,
    top: 30,
    opacity: 0.55,
  },
  wrinkleBad: {
    position: 'absolute',
    left: 10,
    top: 16,
    width: 10,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '35deg' }],
  },
  wrinkleBad2: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    width: 12,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-25deg' }],
  },
  goodBadge: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSurface: {
    position: 'absolute',
    bottom: 8,
    width: 56,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
  },
  topGarment: {
    position: 'absolute',
    bottom: 14,
    width: 24,
    height: 18,
    borderRadius: 4,
  },
  phoneBody: {
    position: 'absolute',
    top: 6,
    width: 22,
    height: 30,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  phoneLens: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  downArrow: {
    position: 'absolute',
    top: 36,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.5,
  },
});
