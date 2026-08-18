import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import type { LiveFeedback, LiveTrackedItem } from '@/types/liveStylist';
import { REGION } from '@/utils/bodyGeometryGuardrails';
import {
  computePreviewFit,
  formatLiveBboxDiagnostic,
  liveBboxDiagnostic,
  LIVE_PREVIEW_FIT_MODE,
  mapNormalizedBboxToPreview,
  type PreviewFitMode,
} from '@/utils/livePreviewBbox';
import { sanitizeLiveBoxLabel } from '@/utils/livePublishedIdentity';
import { presentLiveScore } from '@/utils/liveScoreStability';

type Props = {
  width: number;
  height: number;
  items: LiveTrackedItem[];
  feedback: LiveFeedback | null;
  onSelectItem?: (item: LiveTrackedItem) => void;
  selectedTrackId?: string | null;
  /** Dev: draw top / transition / bottom / footwear guide lines */
  showRegionGuides?: boolean;
  /** When false, box labels stay blank until identity locks (avoids first-frame lies). */
  showLabels?: boolean;
  /** Source-image size the bboxes are normalized against (detection frame). */
  sourceWidth?: number;
  sourceHeight?: number;
  /** Preview fit — camera fill is cover. */
  previewFit?: PreviewFitMode;
  /** Console diagnostic tuple behind existing staff/__DEV__ debug flag. */
  logBboxTransform?: boolean;
};

function scoreColor(score: number): string {
  if (score >= 75) return '#2F9E6E';
  if (score >= 55) return LuxuryColors.gold;
  return '#C45C4A';
}

/** Truncate at a word boundary — never mid-word ("Casual S"). */
export function fitLiveBoxLabel(raw: string, max = 34): string {
  if (/reject\s*:|skin_overlap/i.test(String(raw || ''))) {
    return sanitizeLiveBoxLabel(raw);
  }
  const t = sanitizeLiveBoxLabel(raw) || String(raw || '').trim();
  if (!t) return 'Item';
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  const base = (sp >= 10 ? cut.slice(0, sp) : cut).trimEnd();
  return `${base}…`;
}

export function LiveArOverlay({
  width,
  height,
  items,
  feedback,
  onSelectItem,
  selectedTrackId,
  showRegionGuides = false,
  showLabels = true,
  sourceWidth = 0,
  sourceHeight = 0,
  previewFit = LIVE_PREVIEW_FIT_MODE,
  logBboxTransform = false,
}: Props) {
  const boxes = useMemo(
    () =>
      (items || []).filter(
        (item) => Array.isArray(item.bbox) && item.bbox.length >= 4 && item.bbox[2] > 0.02 && item.bbox[3] > 0.02,
      ),
    [items],
  );

  const fit = useMemo(
    () => computePreviewFit(
      sourceWidth > 0 ? sourceWidth : width,
      sourceHeight > 0 ? sourceHeight : height,
      width,
      height,
      previewFit,
    ),
    [sourceWidth, sourceHeight, width, height, previewFit],
  );

  const screenBoxes = useMemo(
    () => boxes.map((item) => ({
      item,
      screen: mapNormalizedBboxToPreview(
        item.bbox as [number, number, number, number],
        fit,
      ),
    })),
    [boxes, fit],
  );

  useEffect(() => {
    if (!logBboxTransform || !screenBoxes.length) return;
    for (const row of screenBoxes) {
      const d = liveBboxDiagnostic(row.item.bbox as [number, number, number, number], fit);
      console.log(`[LiveBBox] ${formatLiveBboxDiagnostic(d)} name=${row.item.name || row.item.category || ''}`);
    }
  }, [logBboxTransform, screenBoxes, fit]);

  const coaching = feedback?.coaching;
  const scorePresentation = presentLiveScore(
    feedback?.score,
    feedback?.confidenceLevel || 'high',
  );

  if (width <= 0 || height <= 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {showRegionGuides ? (
          <>
            <Rect x={0} y={REGION.TOP_MAX * fit.srcH * fit.scale + fit.offsetY} width={width} height={1} fill="rgba(80,200,120,0.55)" />
            <Rect x={0} y={REGION.BOTTOM_MIN * fit.srcH * fit.scale + fit.offsetY} width={width} height={1} fill="rgba(80,160,255,0.55)" />
            <Rect x={0} y={REGION.FOOTWEAR_MIN * fit.srcH * fit.scale + fit.offsetY} width={width} height={1} fill="rgba(255,180,80,0.55)" />
            <SvgText x={8} y={REGION.TOP_MAX * fit.srcH * fit.scale + fit.offsetY - 4} fill="rgba(80,200,120,0.9)" fontSize="9">
              top
            </SvgText>
            <SvgText x={8} y={REGION.BOTTOM_MIN * fit.srcH * fit.scale + fit.offsetY - 4} fill="rgba(80,160,255,0.9)" fontSize="9">
              transition→bottom
            </SvgText>
            <SvgText x={8} y={REGION.FOOTWEAR_MIN * fit.srcH * fit.scale + fit.offsetY - 4} fill="rgba(255,180,80,0.9)" fontSize="9">
              footwear
            </SvgText>
          </>
        ) : null}
        {screenBoxes.map(({ item, screen }) => {
          const { x, y, w, h } = screen;
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
                {showLabels
                  ? fitLiveBoxLabel(item.name || item.category || 'Item')
                  : '…'}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {screenBoxes.map(({ item, screen }) => (
          <Pressable
            key={`hit_${item.trackId || item.tempId}`}
            onPress={() => onSelectItem?.(item)}
            style={{
              position: 'absolute',
              left: screen.x,
              top: screen.y,
              width: screen.w,
              height: screen.h,
            }}
            accessibilityRole="button"
            accessibilityLabel={item.name || item.category}
          />
      ))}

      {feedback ? (
        <View style={styles.hud} pointerEvents="box-none">
          <View style={styles.topRow}>
            <View
              style={[
                styles.scoreBadge,
                {
                  borderColor: Number.isFinite(feedback.score)
                    ? scoreColor(Number(feedback.score))
                    : 'rgba(255,255,255,0.35)',
                },
              ]}
            >
              <ThemedText type="h3" style={{ color: '#FFF', fontWeight: '700' }}>
                {scorePresentation.display}
              </ThemedText>
              <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {scorePresentation.soft ? 'approx' : 'score'}
              </ThemedText>
            </View>
            {Number.isFinite(feedback.score) && coaching?.headline ? (
              <View style={styles.headlinePill}>
                <ThemedText type="body" style={styles.headlineText} numberOfLines={1}>
                  {coaching.headline}
                </ThemedText>
              </View>
            ) : !Number.isFinite(feedback.score) ? (
              <View style={styles.headlinePill}>
                <ThemedText type="body" style={styles.headlineText} numberOfLines={1}>
                  —
                </ThemedText>
              </View>
            ) : null}
          </View>

          {Number.isFinite(feedback.score) && coaching?.summary ? (
            <View style={styles.card}>
              <ThemedText type="caption" style={styles.summaryText} numberOfLines={4}>
                {coaching.summary}
              </ThemedText>
              {coaching.bullets?.[0] ? (
                <ThemedText type="caption" style={styles.bulletText} numberOfLines={3}>
                  · {coaching.bullets[0]}
                </ThemedText>
              ) : null}
              {coaching.bullets?.[1] ? (
                <ThemedText type="caption" style={styles.bulletText} numberOfLines={2}>
                  · {coaching.bullets[1]}
                </ThemedText>
              ) : null}
            </View>
          ) : Number.isFinite(feedback.score) && (feedback.hints?.[0] || feedback.suggestions?.[0]) ? (
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
