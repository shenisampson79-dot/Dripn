/**
 * Live belief debug overlay — shows what the system sees, believes, and rejects.
 * Staff / __DEV__ only — never shown to App Store subscribers.
 */

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import {
  decisionColor,
  decisionGlyph,
  stabilityBar,
  type LiveBeliefDebugSnapshot,
} from '@/utils/liveBeliefDebug';

type Props = {
  snapshot: LiveBeliefDebugSnapshot;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
};

function fmtConf(n: number): string {
  return n.toFixed(2);
}

function SlotLine({
  role,
  slot,
  filledOnce,
}: {
  role: string;
  slot: LiveBeliefDebugSnapshot['belief']['top'] | LiveBeliefDebugSnapshot['belief']['shoes'];
  filledOnce?: boolean;
}) {
  if (!slot) {
    // An empty slot means we have not read it yet, not that the wearer has
    // nothing there. "None" followed by a garment a second later reads as a
    // wrong answer being corrected. Once a slot has been read, an empty slot
    // is a different fact: we had it and lost it.
    return (
      <ThemedText type="caption" style={styles.mono}>
        {role}: {filledOnce ? 'Lost' : 'Searching…'}
      </ThemedText>
    );
  }
  if ('confidence' in slot) {
    return (
      <ThemedText type="caption" style={styles.mono}>
        {role}: {slot.label} ({fmtConf(slot.confidence)}) [{slot.status}]
      </ThemedText>
    );
  }
  return (
    <ThemedText type="caption" style={styles.mono}>
      {role}: {slot.label}
    </ThemedText>
  );
}

export function LiveBeliefDebugOverlay({
  snapshot,
  collapsed = false,
  onToggleCollapse,
  onClose,
}: Props) {
  const recent = useMemo(
    () => [...(snapshot.decisions || [])].reverse().slice(0, 12),
    [snapshot.decisions],
  );

  const topStab = snapshot.belief.top?.stability ?? 0;
  const botStab = snapshot.belief.bottom?.stability ?? 0;
  const shoeStab =
    snapshot.belief.shoes && 'stability' in snapshot.belief.shoes
      ? snapshot.belief.shoes.stability
      : 0;
  const zone = snapshot.footwear?.zone;
  const shoeScore = snapshot.footwear?.score;
  const shoeCandidates = snapshot.footwear?.candidates || [];

  // Collapsed = compact chip above the footer only. Never a full-width thin bar
  // that can migrate over the score / summary (QA 9 Aug).
  if (collapsed) {
    return (
      <View style={styles.collapsedRoot} pointerEvents="box-none">
        <Pressable
          onPress={onToggleCollapse}
          hitSlop={8}
          style={styles.collapsedChip}
          accessibilityRole="button"
          accessibilityLabel="Expand belief debug"
        >
          <ThemedText type="caption" style={styles.headerTitle}>
            ▸ BELIEF DEBUG · {snapshot.source}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.panel}>
        <View style={styles.header}>
          <Pressable onPress={onToggleCollapse} hitSlop={8} style={styles.headerBtn}>
            <ThemedText type="caption" style={styles.headerTitle}>
              ▾ BELIEF DEBUG · {snapshot.source}
            </ThemedText>
          </Pressable>
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={10}>
              <ThemedText type="caption" style={styles.close}>
                ✕
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              FINAL BELIEF
            </ThemedText>
            <SlotLine
              role="TOP"
              slot={snapshot.belief.top}
              filledOnce={snapshot.filledOnce?.top}
            />
            {snapshot.belief.layer ? <SlotLine role="LAYER" slot={snapshot.belief.layer} /> : null}
            <SlotLine
              role="BOTTOM"
              slot={snapshot.belief.bottom}
              filledOnce={snapshot.filledOnce?.bottom}
            />
            <SlotLine role="SHOES" slot={snapshot.belief.shoes} />
            {(snapshot.belief.accessories || []).map((acc, i) => (
              <SlotLine key={`acc_${i}`} role="ACC" slot={acc} />
            ))}

            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              VISION→BELIEF DIFF
            </ThemedText>
            {(snapshot.mutations || []).length === 0 ? (
              <ThemedText type="caption" style={styles.mono}>
                (none — trust held)
              </ThemedText>
            ) : (
              (snapshot.mutations || []).slice(0, 8).map((m, i) => (
                <ThemedText
                  key={`mut-${i}-${m.before}`}
                  type="caption"
                  style={[styles.mono, { color: '#FF6B6B' }]}
                >
                  ! {m.before} → {m.after}
                </ThemedText>
              ))
            )}

            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              COLOR PIPELINE
            </ThemedText>
            <ThemedText type="caption" style={styles.mono}>
              Top  {snapshot.colorPipeline?.top || '(none)'}
            </ThemedText>
            <ThemedText type="caption" style={styles.mono}>
              Bot  {snapshot.colorPipeline?.bottom || '(none)'}
            </ThemedText>

            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              STABILITY
            </ThemedText>
            <ThemedText type="caption" style={styles.mono}>
              Top  {stabilityBar(topStab)} {fmtConf(topStab)}
            </ThemedText>
            <ThemedText type="caption" style={styles.mono}>
              Bot  {stabilityBar(botStab)} {fmtConf(botStab)}
            </ThemedText>
            <ThemedText type="caption" style={styles.mono}>
              Shoe {stabilityBar(shoeStab)} {fmtConf(shoeStab)}
            </ThemedText>

            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              FOOT ZONE
            </ThemedText>
            {zone ? (
              <>
                <ThemedText type="caption" style={styles.mono}>
                  Visible: {zone.visible ? 'YES' : 'NO'} · Cropped: {zone.cropped ? 'YES' : 'NO'}
                </ThemedText>
                <ThemedText type="caption" style={styles.mono}>
                  Brightness: {zone.brightness != null ? fmtConf(zone.brightness) : 'n/a'}
                </ThemedText>
                <ThemedText type="caption" style={styles.dim}>
                  → {zone.detectionEnabled ? 'Footwear ENABLED' : 'Footwear DISABLED'}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="caption" style={styles.dim}>
                (no foot-zone meta yet)
              </ThemedText>
            )}

            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              FOOTWEAR CANDIDATES
            </ThemedText>
            {shoeCandidates.length === 0 ? (
              <ThemedText type="caption" style={styles.dim}>
                (none this frame)
              </ThemedText>
            ) : (
              shoeCandidates.slice(0, 4).map((c, i) => (
                <ThemedText
                  key={`${c.trackId || i}`}
                  type="caption"
                  style={[styles.mono, c.valid ? null : styles.rejected]}
                >
                  [{i + 1}] {c.label} {fmtConf(c.confidence)} pos={c.position}
                  {c.valid ? ' ✅' : ` ❌ ${c.rejectReason || 'reject'}`}
                  {c.skinRatio != null ? ` skin=${fmtConf(c.skinRatio)}` : ''}
                </ThemedText>
              ))
            )}

            {shoeScore ? (
              <>
                <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
                  SHOE SCORE
                </ThemedText>
                <ThemedText type="caption" style={styles.mono}>
                  {shoeScore.score.toFixed(2)} ({shoeScore.label}) · {shoeScore.subtype || '—'}
                </ThemedText>
                <ThemedText type="caption" style={styles.mono}>
                  F {fmtConf(shoeScore.breakdown.formality)} S {fmtConf(shoeScore.breakdown.structure)}{' '}
                  C {fmtConf(shoeScore.breakdown.color)}
                </ThemedText>
                {shoeScore.explanations[0] ? (
                  <ThemedText type="caption" style={styles.dim}>
                    → {shoeScore.explanations[0]}
                  </ThemedText>
                ) : null}
              </>
            ) : null}

            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              FRAME
            </ThemedText>
            {snapshot.frameDetections.length === 0 ? (
              <ThemedText type="caption" style={styles.dim}>
                (no raw detections)
              </ThemedText>
            ) : (
              snapshot.frameDetections.map((d, i) => (
                <ThemedText
                  key={`${d.label}_${i}`}
                  type="caption"
                  style={[styles.mono, d.rejected ? styles.rejected : null]}
                >
                  {d.source}: {d.label} ({fmtConf(d.confidence)})
                  {d.rejected ? ` ❌ ${d.reason || 'rejected'}` : ''}
                </ThemedText>
              ))
            )}

            <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
              DECISIONS
            </ThemedText>
            {recent.length === 0 ? (
              <ThemedText type="caption" style={styles.dim}>
                (waiting for frames)
              </ThemedText>
            ) : (
              recent.map((d, i) => (
                <View key={`${d.time}_${i}`} style={styles.decisionRow}>
                  <ThemedText
                    type="caption"
                    style={[styles.mono, { color: decisionColor(d.type) }]}
                  >
                    [{decisionGlyph(d.type)}] {d.message}
                  </ThemedText>
                  <ThemedText type="caption" style={styles.reason}>
                    → {d.reason}
                  </ThemedText>
                </View>
              ))
            )}

            {snapshot.inspect ? (
              <>
                <ThemedText type="caption" style={[styles.section, styles.sectionGap]}>
                  BOX INSPECT
                </ThemedText>
                <ThemedText type="caption" style={styles.mono}>
                  {snapshot.inspect.label}
                </ThemedText>
                <ThemedText type="caption" style={styles.mono}>
                  h={snapshot.inspect.height} cy={snapshot.inspect.centerY} · {snapshot.inspect.region}
                </ThemedText>
                <ThemedText type="caption" style={styles.mono}>
                  {snapshot.inspect.subtype
                    ? `→ ${snapshot.inspect.subtype.toUpperCase()}`
                    : `conf ${fmtConf(snapshot.inspect.confidence)}`}
                </ThemedText>
              </>
            ) : null}
          </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'flex-end',
    padding: Spacing.sm,
    paddingBottom: 118,
  },
  collapsedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    paddingBottom: 118,
  },
  collapsedChip: {
    maxWidth: '92%',
    backgroundColor: 'rgba(8,10,14,0.88)',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  panel: {
    maxHeight: '52%',
    backgroundColor: 'rgba(8,10,14,0.88)',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerBtn: { flex: 1 },
  headerTitle: {
    color: '#C9A962',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  close: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', paddingLeft: 12 },
  scroll: { maxHeight: 280 },
  section: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '700',
    letterSpacing: 0.6,
    fontSize: 10,
  },
  sectionGap: { marginTop: 8, marginBottom: 2 },
  mono: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontFamily: 'Courier',
    lineHeight: 15,
  },
  dim: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  rejected: { color: '#FF8A8A' },
  decisionRow: { marginBottom: 3 },
  reason: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: 'Courier',
    marginLeft: 14,
  },
});
