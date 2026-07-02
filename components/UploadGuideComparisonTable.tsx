import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { UploadGuideComparison, UploadGuideImageSource } from '@/constants/uploadGuideExamples';

type UploadGuideComparisonTableProps = {
  title: string;
  rows: UploadGuideComparison[];
  compact?: boolean;
};

function toImageSource(value: UploadGuideImageSource): ImageSource {
  return typeof value === 'number' ? value : { uri: value };
}

function ComparisonCell({
  image,
  label,
  variant,
  compact,
}: {
  image: UploadGuideImageSource;
  label: string;
  variant: 'do' | 'avoid';
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const isDo = variant === 'do';
  const accent = isDo ? '#34C759' : '#FF3B30';

  return (
    <View style={[compact ? styles.cellCompact : styles.cell]}>
      <View
        style={[
          compact ? styles.imageWrapCompact : styles.imageWrap,
          isDo && styles.imageWrapDo,
        ]}
      >
        <Image
          source={toImageSource(image)}
          style={styles.image}
          contentFit={isDo ? 'contain' : 'cover'}
          transition={200}
        />
        <View style={[styles.badge, compact && styles.badgeCompact, { backgroundColor: accent }]}>
          <Feather name={isDo ? 'check' : 'x'} size={compact ? 10 : 12} color="#FFFFFF" />
        </View>
      </View>
      <ThemedText
        type="caption"
        style={[
          compact ? styles.captionCompact : styles.caption,
          { color: isDo ? theme.text : theme.tabIconDefault },
        ]}
        numberOfLines={2}
      >
        {label}
      </ThemedText>
    </View>
  );
}

export function UploadGuideComparisonTable({ title, rows, compact = false }: UploadGuideComparisonTableProps) {
  const { theme } = useTheme();

  return (
    <View style={compact ? styles.sectionCompact : styles.section}>
      <ThemedText
        type={compact ? 'body' : 'h3'}
        style={[
          compact ? styles.titleCompact : styles.title,
          { color: compact ? theme.tabIconDefault : theme.text },
        ]}
      >
        {title}
      </ThemedText>

      <View
        style={[
          styles.table,
          compact && styles.tableCompact,
          {
            backgroundColor: compact ? theme.backgroundDefault : theme.backgroundSecondary,
            borderColor: theme.backgroundDefault,
          },
        ]}
      >
        <View style={[styles.headerRow, compact && styles.headerRowCompact, { borderBottomColor: theme.backgroundSecondary }]}>
          <View style={styles.headerCell}>
            <Feather name="check-circle" size={compact ? 14 : 16} color="#34C759" />
            <ThemedText type="caption" style={styles.headerLabel}>
              Do this
            </ThemedText>
          </View>
          <View style={[styles.headerDivider, { backgroundColor: theme.backgroundSecondary }]} />
          <View style={styles.headerCell}>
            <Feather name="x-circle" size={compact ? 14 : 16} color="#FF3B30" />
            <ThemedText type="caption" style={styles.headerLabel}>
              Avoid
            </ThemedText>
          </View>
        </View>

        {rows.map((row, index) => (
          <View
            key={row.id}
            style={[
              styles.dataRow,
              index < rows.length - 1
                ? { borderBottomColor: theme.backgroundSecondary, borderBottomWidth: StyleSheet.hairlineWidth }
                : null,
            ]}
          >
            <ComparisonCell image={row.doImage} label={row.doLabel} variant="do" compact={compact} />
            <View style={[styles.columnDivider, { backgroundColor: theme.backgroundSecondary }]} />
            <ComparisonCell image={row.avoidImage} label={row.avoidLabel} variant="avoid" compact={compact} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  sectionCompact: {
    marginBottom: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  titleCompact: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  table: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableCompact: {
    borderRadius: BorderRadius.md,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
  },
  headerRowCompact: {
    paddingVertical: Spacing.sm,
  },
  headerCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  headerLabel: {
    fontWeight: '700',
    fontSize: 12,
  },
  headerDivider: {
    width: StyleSheet.hairlineWidth,
  },
  dataRow: {
    flexDirection: 'row',
  },
  columnDivider: {
    width: StyleSheet.hairlineWidth,
  },
  cell: {
    flex: 1,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  cellCompact: {
    flex: 1,
    padding: Spacing.xs,
    alignItems: 'center',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  imageWrapCompact: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.xs,
  },
  imageWrapDo: {
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCompact: {
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  caption: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  captionCompact: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
});
