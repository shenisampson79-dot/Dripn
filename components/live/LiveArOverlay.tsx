import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import type { LiveFeedback, LiveTrackedItem } from '@/types/liveStylist';

type Props = {
  width: number;
  height: number;
  items: LiveTrackedItem[];
  feedback: LiveFeedback | null;
  onSelectItem?: (item: LiveTrackedItem) => void;
  selectedTrackId?: string | null;
};

function scoreColor(score: number): string {
  if (score >= 75) return '#2F9E6E';
  if (score >= 55) return LuxuryColors.gold;
  return '#C45C4A';
}

export function LiveArOverlay({
  width,
  height,
  items,
  feedback,
  onSelectItem,
  selectedTrackId,
}: Props) {
  const boxes = useMemo(
    () =>
      (items || []).filter(
        (item) => Array.isArray(item.bbox) && item.bbox.length >= 4 && item.bbox[2] > 0.02 && item.bbox[3] > 0.02,
      ),
    [items],
  );

  const coaching = feedback?.coaching;
  const swap = coaching?.swaps?.[0];

  if (width <= 0 || height <= 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {boxes.map((item) => {
          const [nx, ny, nw, nh] = item.bbox!;
          const x = nx * width;
          const y = ny * height;
          const w = nw * width;
          const h = nh * height;
          const active = selectedTrackId === item.trackId;
          const stroke = active ? LuxuryColors.gold : 'rgba(255,255,255,0.85)';
          return (
            <React.Fragment key={item.trackId || item.tempId}>
              <Rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={6}
                ry={6}
                stroke={stroke}
                strokeWidth={active ? 2.5 : 1.5}
                fill={active ? 'rgba(201,169,98,0.12)' : 'rgba(0,0,0,0.08)'}
              />
              <SvgText
                x={x + 6}
                y={Math.max(14, y + 14)}
                fill="#FFFFFF"
                fontSize="11"
                fontWeight="600"
              >
                {(item.name || item.category || 'Item').slice(0, 22)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {boxes.map((item) => {
        const [nx, ny, nw, nh] = item.bbox!;
        return (
          <Pressable
            key={`hit_${item.trackId || item.tempId}`}
            onPress={() => onSelectItem?.(item)}
            style={{
              position: 'absolute',
              left: nx * width,
              top: ny * height,
              width: nw * width,
              height: nh * height,
            }}
            accessibilityRole="button"
            accessibilityLabel={item.name || item.category}
          />
        );
      })}

      {feedback ? (
        <View style={styles.hud} pointerEvents="box-none">
          <View style={styles.topRow}>
            <View style={[styles.scoreBadge, { borderColor: scoreColor(feedback.score) }]}>
              <ThemedText type="h3" style={{ color: '#FFF', fontWeight: '700' }}>
                {feedback.score}
              </ThemedText>
              <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                score
              </ThemedText>
            </View>
            {coaching?.headline ? (
              <View style={styles.headlinePill}>
                <ThemedText type="body" style={styles.headlineText} numberOfLines={1}>
                  {coaching.headline}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {coaching?.summary ? (
            <View style={styles.card}>
              <ThemedText type="caption" style={styles.summaryText} numberOfLines={2}>
                {coaching.summary}
              </ThemedText>
              {coaching.bullets?.[0] ? (
                <ThemedText type="caption" style={styles.bulletText} numberOfLines={2}>
                  · {coaching.bullets[0]}
                </ThemedText>
              ) : null}
              {swap ? (
                <ThemedText type="caption" style={styles.swapText} numberOfLines={2}>
                  Try {swap.suggestion} — {swap.reason}
                </ThemedText>
              ) : null}
            </View>
          ) : (feedback.hints?.[0] || feedback.suggestions?.[0]) ? (
            <View style={styles.chipRow}>
              {feedback.hints?.[0] ? (
                <View style={styles.chip}>
                  <ThemedText type="caption" style={styles.chipText} numberOfLines={2}>
                    {feedback.hints[0]}
                  </ThemedText>
                </View>
              ) : null}
              {feedback.suggestions?.[0] ? (
                <View style={[styles.chip, styles.chipGold]}>
                  <ThemedText type="caption" style={styles.chipText} numberOfLines={2}>
                    {feedback.suggestions[0]}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 2,
  },
  hud: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreBadge: {
    alignSelf: 'flex-start',
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    backgroundColor: 'rgba(15,15,20,0.55)',
    alignItems: 'center',
  },
  headlinePill: {
    flexShrink: 1,
    backgroundColor: 'rgba(15,15,20,0.55)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headlineText: {
    color: '#FFF',
    fontWeight: '700',
  },
  card: {
    maxWidth: '96%',
    backgroundColor: 'rgba(15,15,20,0.62)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  summaryText: {
    color: 'rgba(255,255,255,0.92)',
  },
  bulletText: {
    color: 'rgba(255,255,255,0.78)',
  },
  swapText: {
    color: LuxuryColors.gold,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    maxWidth: '92%',
    backgroundColor: 'rgba(15,15,20,0.6)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipGold: {
    backgroundColor: 'rgba(201,169,98,0.35)',
  },
  chipText: {
    color: '#FFF',
  },
});
