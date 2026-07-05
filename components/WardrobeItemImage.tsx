import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

import { WardrobeImageShimmer } from '@/components/WardrobeImageShimmer';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';
import {
  wardrobeImageContentFit,
  wardrobeProcessedTileBackground,
  wardrobeTileBackground,
} from '@/utils/wardrobeImage';
import {
  getCachedWardrobeImageUri,
  invalidateWardrobeImageCache,
  loadWardrobeImageForItem,
} from '@/utils/wardrobeImageLoader';

const MAX_RENDER_RETRIES = 2;

type Props = {
  item: Pick<
    WardrobeItem,
    'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed' | 'aiAnalyzed'
  >;
  style?: StyleProp<ImageStyle>;
  processed?: boolean;
  contentFit?: 'contain' | 'cover';
  transition?: number;
  preferCover?: boolean;
  showLoading?: boolean;
  /** Scale up contained cutouts inside the tile (1 = default). */
  displayScale?: number;
  /** Override tile background (e.g. transparent when parent already provides one). */
  tileBackgroundColor?: string;
};

export function WardrobeItemImage({
  item,
  style,
  processed,
  contentFit,
  transition = 280,
  preferCover = false,
  showLoading = true,
  tileBackgroundColor,
  displayScale = 1,
}: Props) {
  const { isDark } = useTheme();
  const isProcessed = processed ?? !!(item.imageProcessed || item.aiAnalyzed);
  const tileBg =
    tileBackgroundColor ??
    (isProcessed ? wardrobeProcessedTileBackground() : wardrobeTileBackground(isDark));

  const cached = getCachedWardrobeImageUri(item.id);
  const [uri, setUri] = useState<string | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const containerStyle = useMemo(() => StyleSheet.flatten(style), [style]);

  useEffect(() => {
    setFailed(false);
    setRetryCount(0);
  }, [item.id, item.imageUri, item.enhancedImageUri, item.originalImageUri, item.imageProcessed]);

  useEffect(() => {
    let cancelled = false;

    const warm = getCachedWardrobeImageUri(item.id);
    if (warm) {
      setUri(warm);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    setUri(null);
    setFailed(false);

    loadWardrobeImageForItem(item).then((result) => {
      if (cancelled) return;
      setUri(result);
      setLoading(false);
      if (!result) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [
    item.id,
    item.imageUri,
    item.enhancedImageUri,
    item.originalImageUri,
    item.imageProcessed,
    retryCount,
  ]);

  const handleError = useCallback(() => {
    if (__DEV__) {
      console.warn('[WardrobeImage] render error', item.id, uri);
    }
    if (retryCount >= MAX_RENDER_RETRIES) {
      setFailed(true);
      setUri(null);
      return;
    }
    invalidateWardrobeImageCache(item.id);
    setRetryCount((n) => n + 1);
  }, [item.id, uri, retryCount]);

  if (loading && showLoading) {
    return (
      <WardrobeImageShimmer
        style={containerStyle}
        backgroundColor={tileBg}
        isDark={isDark}
      />
    );
  }

  if (failed || !uri) {
    return (
      <View style={[containerStyle, styles.failedRoot, { backgroundColor: tileBg }]}>
        <Feather name="image" size={22} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)'} />
        <Text style={[styles.failedLabel, isDark ? styles.failedLabelDark : styles.failedLabelLight]}>
          No photo
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        containerStyle,
        styles.imageRoot,
        { backgroundColor: tileBg },
      ]}
    >
      <Image
        source={{ uri }}
        style={[
          styles.imageFill,
          { backgroundColor: tileBg },
          displayScale !== 1 ? { transform: [{ scale: displayScale }] } : null,
        ]}
        contentFit={contentFit ?? wardrobeImageContentFit(item, false, preferCover && !isProcessed)}
        transition={transition}
        onError={handleError}
        recyclingKey={`${item.id}:${uri}:${retryCount}`}
        cachePolicy={uri.startsWith('http') ? 'memory-disk' : undefined}
      />
    </View>
  );
}

export function WardrobeItemImageFrame({
  children,
  backgroundColor,
  style,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[style, backgroundColor ? { backgroundColor } : null]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  imageRoot: {
    overflow: 'hidden',
  },
  imageFill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  failedRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  failedLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  failedLabelLight: {
    color: 'rgba(0,0,0,0.28)',
  },
  failedLabelDark: {
    color: 'rgba(255,255,255,0.35)',
  },
});
